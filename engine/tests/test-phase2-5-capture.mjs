import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { statfs, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { chromium } from 'playwright-chromium';
import { appendCaptureEntry, assertCaptureCompleteness, captureId, capturePlan, validateCaptureManifest } from '../cli/capture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = join(root, 'engine', 'tests', 'fixtures', 'capture-fixture.html');
const browserCache = join(root, '.cache', 'ms-playwright');
const controlledTmp = join(root, '.tmp', 'playwright');
const runTmp = join(controlledTmp, 's11-smoke');
const profile = join(runTmp, 'profile');
const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

assert.equal(resolve(process.env.PLAYWRIGHT_BROWSERS_PATH ?? ''), browserCache, 'browser cache must be project-local');
assert.equal(resolve(process.env.TMPDIR ?? ''), controlledTmp, 'TMPDIR must be project-local');
assert.ok(inside(root, browserCache) && inside(root, controlledTmp));
assert.notEqual(resolve(process.env.TMPDIR), '/tmp');

const disk = await statfs(root);
const availableBytes = Number(disk.bavail) * Number(disk.bsize);
assert.ok(availableBytes >= 1_073_741_824, `browser preflight requires 1 GiB free; found ${availableBytes}`);

async function smoke({ injectLaunchFailure = false } = {}) {
  await rm(runTmp, { recursive: true, force: true });
  await mkdir(profile, { recursive: true });
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      ...(injectLaunchFailure ? { executablePath: join(runTmp, 'missing-chromium') } : {}),
    });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(pathToFileURL(fixture).href);
    assert.equal(await page.title(), 'KINETIC capture fixture');
    assert.equal(await page.locator('main').getAttribute('data-kinetic-fixture'), 'ready');
    const packageVersion = createRequire(import.meta.url)('playwright-chromium/package.json').version;
    const browserVersion = context.browser()?.version();
    assert.equal(packageVersion, '1.62.1');
    assert.match(browserVersion ?? '', /^\d+\.\d+\.\d+\.\d+$/);
    return { playwright_version: packageVersion, browser_version: browserVersion };
  } finally {
    await context?.close();
    await rm(runTmp, { recursive: true, force: true });
  }
}

if (process.env.KINETIC_TEST_SLICE !== 'S12') {
  const receipt = await smoke();
  await assert.rejects(smoke({ injectLaunchFailure: true }), /missing-chromium|executable/i);
  await assert.rejects(statfs(runTmp), (error) => error.code === 'ENOENT');
  console.log(`S11 Playwright boundary: PASS (T45, ${JSON.stringify(receipt)})`);
}

const s12Tmp = join(controlledTmp, 's12-manifest');
const now = '2026-08-23T00:00:00.000Z';
const buildSha256 = 'a'.repeat(64);
const viewport = {
  desktop: { name: 'desktop', width: 1440, height: 900, device_scale: 1, is_mobile: false, has_touch: false },
  mobile: { name: 'mobile', width: 390, height: 844, device_scale: 1, is_mobile: true, has_touch: true },
};
const requiredStates = { desktop: ['initial', 'mid-scroll', 'signature', 'final'], mobile: ['initial', 'content'] };

function entryFor(spec, artifactPath, sha256) {
  const { build_sha256: ignored, ...entry } = spec;
  return {
    ...entry,
    timestamp: now,
    playwright_version: '1.62.1',
    browser_version: '151.0.7922.34',
    artifact_path: artifactPath,
    sha256,
    visual_phash: 'b'.repeat(64),
    readiness: 'READY',
    notes: [],
  };
}

async function testS12() {
  const outsideArtifact = join(controlledTmp, 's12-outside.webp');
  await rm(s12Tmp, { recursive: true, force: true });
  await rm(outsideArtifact, { force: true });
  await mkdir(join(s12Tmp, 'artifacts'), { recursive: true });
  try {
    const specs = Object.entries(requiredStates).flatMap(([name, states]) => states.map((state) => ({
      attempt: 1,
      viewport: viewport[name],
      capture_mode: 'STATIC_CAPTURE_STABLE',
      state,
      trigger_action: state === 'initial' ? 'goto' : 'wait_for_selector',
      target_selector: state === 'initial' ? null : 'main',
      checkpoint_ms: null,
      checkpoint_progress: null,
      reduced_motion: 'no-preference',
      build_sha256: buildSha256,
    })));
    const manifest = capturePlan({
      caseId: 'case-fixture',
      subjectId: 'V1',
      url: pathToFileURL(fixture).href,
      specs,
      playwrightVersion: '1.62.1',
      browserVersion: '151.0.7922.34',
      now,
    });
    assert.equal(manifest.playwright_version, '1.62.1');
    assert.equal(manifest.browser_version, '151.0.7922.34');
    const spoofedPlan = capturePlan({
      caseId: 'case-fixture',
      subjectId: 'V1',
      url: pathToFileURL(fixture).href,
      specs: [{ ...specs[0], capture_id: 'cap-attacker' }],
      playwrightVersion: '1.62.1',
      browserVersion: '151.0.7922.34',
      now,
    });
    assert.equal(spoofedPlan.specs[0].capture_id, captureId(spoofedPlan.specs[0]));
    assert.notEqual(spoofedPlan.specs[0].capture_id, 'cap-attacker');
    const identityBase = {
      ...specs[0],
      subject_id: 'V1',
      url: pathToFileURL(fixture).href,
      sequence_id: 'sequence-fixture',
      sequence_index: 0,
    };
    const baseId = captureId(identityBase);
    for (const changed of [
      { subject_id: 'V2' }, { attempt: 2 }, { viewport: { ...identityBase.viewport, name: 'mobile' } },
      { viewport: { ...identityBase.viewport, width: 1439 } }, { viewport: { ...identityBase.viewport, height: 899 } },
      { viewport: { ...identityBase.viewport, device_scale: 2 } }, { viewport: { ...identityBase.viewport, is_mobile: true } },
      { viewport: { ...identityBase.viewport, has_touch: true } }, { capture_mode: 'MOTION_STATE_CAPTURE' },
      { state: 'other' }, { url: 'https://example.test/' }, { trigger_action: 'click' },
      { target_selector: '#target' }, { checkpoint_ms: 1 }, { checkpoint_progress: 0.5 },
      { reduced_motion: 'reduce' }, { build_sha256: 'c'.repeat(64) },
      { sequence_id: 'sequence-other' }, { sequence_index: 1 },
    ]) assert.notEqual(captureId({ ...identityBase, ...changed }), baseId);

    const manifestPath = join(s12Tmp, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    for (const spec of manifest.specs) {
      const artifactPath = join('artifacts', `${spec.capture_id}.webp`);
      const bytes = Buffer.from(`fixture:${spec.capture_id}`);
      await writeFile(join(s12Tmp, artifactPath), bytes);
      await appendCaptureEntry({
        manifestPath,
        caseRoot: s12Tmp,
        entry: entryFor(spec, artifactPath, createHash('sha256').update(bytes).digest('hex')),
        now,
      });
    }

    const stored = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(await validateCaptureManifest({ manifest: stored, caseRoot: s12Tmp }), true);
    for (const failure of [
      { capture_id: 'cap-unbound', attempt: 1, code: 'TEST', reason: 'unbound', transient: false, timestamp: now },
      { capture_id: stored.specs[0].capture_id, attempt: 2, code: 'TEST', reason: 'wrong attempt', transient: false, timestamp: now },
    ]) {
      const invalidFailure = structuredClone(stored);
      invalidFailure.failures.push(failure);
      await assert.rejects(
        validateCaptureManifest({ manifest: invalidFailure, caseRoot: s12Tmp }),
        (error) => error.code === 'KINETIC_CAPTURE_FAILURE_MISMATCH',
      );
    }
    const reorderedViewport = structuredClone(stored);
    reorderedViewport.entries[0].viewport = Object.fromEntries(Object.entries(reorderedViewport.entries[0].viewport).reverse());
    assert.equal(await validateCaptureManifest({ manifest: reorderedViewport, caseRoot: s12Tmp }), true);
    for (const invalidIdentity of [
      { ...structuredClone(stored), case_id: 'case-tampered' },
      { ...structuredClone(stored), specs: structuredClone(stored.specs).reverse() },
    ]) {
      await assert.rejects(
        validateCaptureManifest({ manifest: invalidIdentity, caseRoot: s12Tmp }),
        (error) => error.code === 'KINETIC_CAPTURE_MANIFEST_ID_INVALID',
      );
    }
    assert.equal(assertCaptureCompleteness(stored), true);
    const disagreeingEntry = structuredClone(stored);
    disagreeingEntry.entries[0].viewport.width--;
    assert.throws(
      () => assertCaptureCompleteness(disagreeingEntry),
      (error) => error.code === 'KINETIC_CAPTURE_ENTRY_MISMATCH',
    );
    assert.ok(!(await readdir(s12Tmp)).some((name) => name.includes('.tmp-')), 'atomic append must remove temporary files');

    const concurrentManifestPath = join(s12Tmp, 'concurrent-manifest.json');
    await writeFile(concurrentManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await Promise.all(stored.entries.slice(0, 2).map((entry) => appendCaptureEntry({
      manifestPath: concurrentManifestPath,
      caseRoot: s12Tmp,
      entry,
      now,
    })));
    const concurrentStored = JSON.parse(await readFile(concurrentManifestPath, 'utf8'));
    assert.deepEqual(
      concurrentStored.entries.map(({ capture_id }) => capture_id).sort(),
      stored.entries.slice(0, 2).map(({ capture_id }) => capture_id).sort(),
      'concurrent appends must preserve both entries',
    );
    await assert.rejects(readFile(`${concurrentManifestPath}.lock`), (error) => error.code === 'ENOENT');

    const beforeRejectedAppend = await readFile(manifestPath, 'utf8');
    await assert.rejects(
      appendCaptureEntry({ manifestPath, caseRoot: s12Tmp, entry: { ...stored.entries[0], sha256: 'd'.repeat(64) }, now }),
      (error) => error.code === 'KINETIC_CAPTURE_HASH_MISMATCH',
    );
    assert.equal(await readFile(manifestPath, 'utf8'), beforeRejectedAppend, 'rejected append must leave manifest unchanged');
    await assert.rejects(readFile(`${manifestPath}.lock`), (error) => error.code === 'ENOENT');

    for (const spec of stored.specs) {
      const incomplete = structuredClone(stored);
      incomplete.specs = incomplete.specs.filter(({ capture_id }) => capture_id !== spec.capture_id);
      incomplete.entries = incomplete.entries.filter(({ capture_id }) => capture_id !== spec.capture_id);
      assert.throws(() => assertCaptureCompleteness(incomplete), (error) => error.code === 'KINETIC_CAPTURE_INCOMPLETE');
    }
    const missingEntry = structuredClone(stored);
    missingEntry.entries.pop();
    assert.throws(() => assertCaptureCompleteness(missingEntry), (error) => error.code === 'KINETIC_CAPTURE_INCOMPLETE');

    const missing = structuredClone(stored);
    missing.entries[0].artifact_path = 'artifacts/missing.webp';
    await assert.rejects(validateCaptureManifest({ manifest: missing, caseRoot: s12Tmp }), (error) => error.code === 'KINETIC_CAPTURE_ARTIFACT_MISSING');
    const mismatch = structuredClone(stored);
    mismatch.entries[0].sha256 = 'd'.repeat(64);
    await assert.rejects(validateCaptureManifest({ manifest: mismatch, caseRoot: s12Tmp }), (error) => error.code === 'KINETIC_CAPTURE_HASH_MISMATCH');
    const escaped = structuredClone(stored);
    escaped.entries[0].artifact_path = '../outside.webp';
    await assert.rejects(validateCaptureManifest({ manifest: escaped, caseRoot: s12Tmp }), (error) => error.code === 'KINETIC_CAPTURE_PATH_INVALID');
    const outsideBytes = Buffer.from('outside');
    await writeFile(outsideArtifact, outsideBytes);
    await symlink(outsideArtifact, join(s12Tmp, 'artifacts', 'linked.webp'));
    const linked = structuredClone(stored);
    linked.entries[0].artifact_path = 'artifacts/linked.webp';
    linked.entries[0].sha256 = createHash('sha256').update(outsideBytes).digest('hex');
    await assert.rejects(validateCaptureManifest({ manifest: linked, caseRoot: s12Tmp }), (error) => error.code === 'KINETIC_CAPTURE_PATH_INVALID');

    const racedPath = join(s12Tmp, 'artifacts', 'raced.webp');
    const sparePath = join(s12Tmp, 'artifacts', 'raced-spare.webp');
    const swapPath = join(s12Tmp, 'artifacts', 'raced-swap.webp');
    await writeFile(racedPath, 'inside');
    await symlink(outsideArtifact, sparePath);
    const raced = structuredClone(stored);
    raced.entries[0].artifact_path = 'artifacts/raced.webp';
    raced.entries[0].sha256 = createHash('sha256').update(outsideBytes).digest('hex');
    const raceFlag = new Int32Array(new SharedArrayBuffer(4));
    const toggler = new Worker(`
      const { renameSync } = require('node:fs');
      const { parentPort, workerData } = require('node:worker_threads');
      const flag = new Int32Array(workerData.flag);
      parentPort.postMessage('ready');
      while (Atomics.load(flag, 0) === 0) {
        try {
          renameSync(workerData.raced, workerData.swap);
          renameSync(workerData.spare, workerData.raced);
          renameSync(workerData.swap, workerData.spare);
        } catch {}
      }
    `, { eval: true, workerData: { flag: raceFlag.buffer, raced: racedPath, spare: sparePath, swap: swapPath } });
    await new Promise((done, reject) => {
      toggler.once('message', done);
      toggler.once('error', reject);
    });
    let raceResults;
    try {
      raceResults = await Promise.all(Array.from({ length: 1000 }, async () => {
        try {
          return await validateCaptureManifest({ manifest: raced, caseRoot: s12Tmp });
        } catch (error) {
          assert.ok(['ENOENT', 'KINETIC_CAPTURE_ARTIFACT_MISSING', 'KINETIC_CAPTURE_HASH_MISMATCH', 'KINETIC_CAPTURE_PATH_INVALID'].includes(error.code));
          return false;
        }
      }));
    } finally {
      Atomics.store(raceFlag, 0, 1);
      await new Promise((done, reject) => {
        toggler.once('exit', done);
        toggler.once('error', reject);
      });
    }
    assert.equal(raceResults.includes(true), false, 'validation must bind path checks and hashing to one opened artifact');
  } finally {
    await rm(s12Tmp, { recursive: true, force: true });
    await rm(outsideArtifact, { force: true });
  }
}

await testS12();
console.log('S12 capture manifest: PASS (T17-T19)');
