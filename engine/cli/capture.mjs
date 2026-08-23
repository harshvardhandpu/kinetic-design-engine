import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { validateValue } from '../core/schema-validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(root, 'schemas', 'gym', 'capture-manifest.schema.json');
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const requiredStates = {
  desktop: ['initial', 'mid-scroll', 'signature', 'final'],
  mobile: ['initial', 'content'],
};

function fail(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'CaptureError';
  error.code = code;
  throw error;
}

function inside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function assertStructure(manifest) {
  const result = validateValue({ value: manifest, schema, schemaPath });
  if (!result.valid) fail('KINETIC_CAPTURE_MANIFEST_INVALID', JSON.stringify(result.errors));
}

export function captureId(spec) {
  const viewport = spec.viewport ?? {};
  const identity = [
    spec.subject_id,
    spec.attempt,
    viewport.name,
    viewport.width,
    viewport.height,
    viewport.device_scale,
    viewport.is_mobile,
    viewport.has_touch,
    spec.capture_mode,
    spec.state,
    spec.url,
    spec.trigger_action,
    spec.target_selector,
    spec.checkpoint_ms,
    spec.checkpoint_progress,
    spec.reduced_motion,
    spec.build_sha256,
    spec.sequence_id,
    spec.sequence_index,
  ];
  return `cap-${createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 32)}`;
}

function manifestId(caseId, specs) {
  return `cm-${createHash('sha256').update(JSON.stringify([caseId, ...specs.map(({ capture_id }) => capture_id)])).digest('hex').slice(0, 32)}`;
}

export function capturePlan({ caseId, subjectId, url, specs, playwrightVersion, browserVersion, now = new Date().toISOString() }) {
  const planned = specs.map((spec) => {
    const value = { ...spec, subject_id: subjectId, url };
    return { ...value, capture_id: captureId(value) };
  });
  const manifest = {
    schema: 'kinetic/gym/capture-manifest@0.1',
    manifest_id: manifestId(caseId, planned),
    case_id: caseId,
    playwright_version: playwrightVersion,
    browser_version: browserVersion,
    specs: planned,
    entries: [],
    failures: [],
    created_at: now,
    updated_at: now,
  };
  assertStructure(manifest);
  return manifest;
}

function assertEntryMatchesSpec(entry, spec, manifest) {
  const fields = [
    'subject_id', 'attempt', 'viewport', 'capture_mode', 'state', 'url', 'trigger_action',
    'target_selector', 'checkpoint_ms', 'checkpoint_progress', 'reduced_motion', 'sequence_id', 'sequence_index',
  ];
  for (const field of fields) {
    if (!isDeepStrictEqual(entry[field] ?? null, spec[field] ?? null)) {
      fail('KINETIC_CAPTURE_ENTRY_MISMATCH', `${entry.capture_id} differs from its spec at ${field}`);
    }
  }
  if (entry.playwright_version !== manifest.playwright_version || entry.browser_version !== manifest.browser_version) {
    fail('KINETIC_CAPTURE_ENTRY_MISMATCH', `${entry.capture_id} browser versions differ from the manifest`);
  }
}

export async function validateCaptureManifest({ manifest, caseRoot }) {
  assertStructure(manifest);
  if (manifest.manifest_id !== manifestId(manifest.case_id, manifest.specs)) {
    fail('KINETIC_CAPTURE_MANIFEST_ID_INVALID', `manifest_id does not match case_id and ordered specs: ${manifest.manifest_id}`);
  }
  const realCaseRoot = await realpath(caseRoot);
  const specs = new Map();
  for (const spec of manifest.specs) {
    if (spec.capture_id !== captureId(spec) || specs.has(spec.capture_id)) {
      fail('KINETIC_CAPTURE_SPEC_INVALID', `invalid or duplicate capture spec: ${spec.capture_id}`);
    }
    specs.set(spec.capture_id, spec);
  }
  for (const failure of manifest.failures) {
    const spec = specs.get(failure.capture_id);
    if (!spec || failure.attempt !== spec.attempt) {
      fail('KINETIC_CAPTURE_FAILURE_MISMATCH', `failure has no matching capture attempt: ${failure.capture_id}/${failure.attempt}`);
    }
  }
  for (const entry of manifest.entries) {
    const spec = specs.get(entry.capture_id);
    if (!spec) fail('KINETIC_CAPTURE_ENTRY_MISMATCH', `entry has no matching spec: ${entry.capture_id}`);
    assertEntryMatchesSpec(entry, spec, manifest);
    const artifact = resolve(caseRoot, entry.artifact_path);
    if (!inside(caseRoot, artifact)) fail('KINETIC_CAPTURE_PATH_INVALID', `artifact escapes case root: ${entry.artifact_path}`);
    let handle;
    try {
      handle = await open(artifact, 'r');
    } catch (error) {
      if (error.code === 'ENOENT') fail('KINETIC_CAPTURE_ARTIFACT_MISSING', `missing artifact: ${entry.artifact_path}`, error);
      throw error;
    }
    try {
      const realArtifact = await realpath(`/proc/self/fd/${handle.fd}`);
      if (!inside(realCaseRoot, realArtifact)) fail('KINETIC_CAPTURE_PATH_INVALID', `artifact escapes case root: ${entry.artifact_path}`);
      const bytes = await handle.readFile();
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== entry.sha256) fail('KINETIC_CAPTURE_HASH_MISMATCH', `${entry.capture_id}: expected ${entry.sha256}, found ${actual}`);
    } finally {
      await handle.close();
    }
  }
  return true;
}

export function assertCaptureCompleteness(manifest) {
  assertStructure(manifest);
  const entries = new Map(manifest.entries.map((entry) => [entry.capture_id, entry]));
  const subjects = new Set(manifest.specs.map(({ subject_id }) => subject_id));
  for (const subject of subjects) {
    for (const [viewport, states] of Object.entries(requiredStates)) {
      for (const state of states) {
        const spec = manifest.specs.find((candidate) => candidate.subject_id === subject && candidate.viewport.name === viewport && candidate.state === state);
        const entry = spec && entries.get(spec.capture_id);
        if (!entry) fail('KINETIC_CAPTURE_INCOMPLETE', `${subject} missing ${viewport}/${state}`);
        assertEntryMatchesSpec(entry, spec, manifest);
      }
    }
  }
  return true;
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temp, path);
    await fsyncDirectory(dirname(path));
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

async function withFileLock(path, operation) {
  const lockPath = `${path}.lock`;
  let handle;
  while (!handle) {
    try {
      handle = await open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise((done) => setTimeout(done, 10));
    }
  }
  try {
    return await operation();
  } finally {
    try { await handle.close(); } finally { await rm(lockPath, { force: true }); }
  }
}

export async function appendCaptureEntry({ manifestPath, caseRoot, entry, now = new Date().toISOString() }) {
  return withFileLock(manifestPath, async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const next = { ...manifest, entries: [...manifest.entries, entry], updated_at: now };
    await validateCaptureManifest({ manifest: next, caseRoot });
    await writeJsonAtomic(manifestPath, next);
    return next;
  });
}
