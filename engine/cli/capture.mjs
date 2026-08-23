import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, realpath, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright-chromium';
import { validateValue } from '../core/schema-validate.mjs';
import { authorizeCaptureAccess, loadSourceRegistry } from '../knowledge/source-registry.mjs';
import { recordStageTelemetry } from '../runner/store.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const playwrightVersion = createRequire(import.meta.url)('playwright-chromium/package.json').version;
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
  const entries = new Set();
  for (const entry of manifest.entries) {
    if (entries.has(entry.capture_id)) fail('KINETIC_CAPTURE_ENTRY_DUPLICATE', `duplicate capture entry: ${entry.capture_id}`);
    entries.add(entry.capture_id);
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
    let artifactFailure;
    try {
      const realArtifact = await realpath(`/proc/self/fd/${handle.fd}`);
      if (!inside(realCaseRoot, realArtifact)) fail('KINETIC_CAPTURE_PATH_INVALID', `artifact escapes case root: ${entry.artifact_path}`);
      const bytes = await handle.readFile();
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== entry.sha256) fail('KINETIC_CAPTURE_HASH_MISMATCH', `${entry.capture_id}: expected ${entry.sha256}, found ${actual}`);
    } catch (error) {
      artifactFailure = error;
      throw error;
    } finally {
      try { await handle.close(); }
      catch (error) { if (artifactFailure) suppress(artifactFailure, error); else throw error; }
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
  let failure;
  try { await handle.sync(); }
  catch (error) { failure = error; throw error; }
  finally {
    try { await handle.close(); }
    catch (error) { if (failure) suppress(failure, error); else throw error; }
  }
}

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}-${randomUUID()}`;
  let handle;
  let failure;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temp, path);
    await fsyncDirectory(dirname(path));
  } catch (error) { failure = error; throw error; }
  finally {
    let cleanupFailure;
    for (const cleanup of [() => handle?.close(), () => rm(temp, { force: true })]) {
      try { await cleanup(); }
      catch (error) {
        if (failure) suppress(failure, error);
        else if (cleanupFailure) suppress(cleanupFailure, error);
        else cleanupFailure = error;
      }
    }
    if (!failure && cleanupFailure) throw cleanupFailure;
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
  let failure;
  try {
    return await operation();
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    let cleanupFailure;
    for (const cleanup of [() => handle.close(), () => rm(lockPath, { force: true })]) {
      try { await cleanup(); }
      catch (error) {
        if (failure) suppress(failure, error);
        else if (cleanupFailure) suppress(cleanupFailure, error);
        else cleanupFailure = error;
      }
    }
    if (!failure && cleanupFailure) throw cleanupFailure;
  }
}

function sameCaptureEntry(left, right) {
  const { timestamp: leftTimestamp, ...leftStable } = left;
  const { timestamp: rightTimestamp, ...rightStable } = right;
  return isDeepStrictEqual(leftStable, rightStable);
}

export async function appendCaptureEntry({ manifestPath, caseRoot, entry, now = new Date().toISOString() }) {
  return withFileLock(manifestPath, async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await validateCaptureManifest({ manifest, caseRoot });
    const existing = manifest.entries.find(({ capture_id }) => capture_id === entry.capture_id);
    if (existing && sameCaptureEntry(existing, entry)) return manifest;
    const next = { ...manifest, entries: [...manifest.entries, entry], updated_at: now };
    await validateCaptureManifest({ manifest: next, caseRoot });
    if (existing) fail('KINETIC_CAPTURE_ENTRY_CONFLICT', `capture_id already has a different entry: ${entry.capture_id}`);
    await writeJsonAtomic(manifestPath, next);
    return next;
  });
}

async function appendCaptureFailure({ manifestPath, caseRoot, failure, now }) {
  return withFileLock(manifestPath, async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await validateCaptureManifest({ manifest, caseRoot });
    const next = { ...manifest, failures: [...manifest.failures, failure], updated_at: now };
    await validateCaptureManifest({ manifest: next, caseRoot });
    await writeJsonAtomic(manifestPath, next);
    return next;
  });
}

function comparisonKey(spec) {
  return captureId({ ...spec, attempt: 0 });
}

async function assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle) {
  const realArtifacts = await realpath(`/proc/self/fd/${artifactsHandle.fd}`);
  if (realArtifacts !== join(realCaseRoot, 'artifacts')) fail('KINETIC_CAPTURE_PATH_INVALID', 'artifact directory moved from case root');
  return realArtifacts;
}

export async function assertArtifactDirectoryContained(caseRoot, artifactsHandle) {
  return assertOpenArtifactDirectoryContained(await realpath(caseRoot), artifactsHandle);
}

async function writeCaptureArtifact(caseRoot, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) fail('KINETIC_CAPTURE_ARTIFACT_INVALID', 'capture must produce non-empty WebP bytes');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const artifactPath = join('artifacts', `${sha256}.webp`);
  const realCaseRoot = await realpath(caseRoot);
  const caseHandle = await open(realCaseRoot, 'r');
  let artifactsHandle;
  let tempHandle;
  let temp;
  let absolute;
  let created = false;
  let failure;
  try {
    const boundCaseRoot = join('/proc/self/fd', String(caseHandle.fd));
    const boundArtifacts = join(boundCaseRoot, 'artifacts');
    try { await mkdir(boundArtifacts); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    artifactsHandle = await open(boundArtifacts, 'r');
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
    absolute = join('/proc/self/fd', String(artifactsHandle.fd), `${sha256}.webp`);
    temp = join(boundCaseRoot, `.${sha256}.tmp-${process.pid}-${randomUUID()}`);
    tempHandle = await open(temp, 'wx', 0o600);
    await tempHandle.writeFile(bytes);
    await tempHandle.sync();
    await tempHandle.close();
    tempHandle = null;
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
    try {
      await link(temp, absolute);
      created = true;
    }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existingHandle = await open(absolute, 'r');
      let existingFailure;
      try {
        const realArtifact = await realpath(`/proc/self/fd/${existingHandle.fd}`);
        if (!inside(realCaseRoot, realArtifact)) fail('KINETIC_CAPTURE_PATH_INVALID', `artifact escapes case root: ${artifactPath}`);
        const existing = await existingHandle.readFile();
        if (createHash('sha256').update(existing).digest('hex') !== sha256) fail('KINETIC_CAPTURE_HASH_MISMATCH', `existing artifact differs: ${artifactPath}`);
      } catch (readError) {
        existingFailure = readError;
        throw readError;
      } finally {
        try { await existingHandle.close(); }
        catch (closeError) { if (existingFailure) suppress(existingFailure, closeError); else throw closeError; }
      }
    }
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
    await rm(temp, { force: true });
    temp = null;
    await artifactsHandle.sync();
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
  } catch (error) {
    failure = error;
    if (created && absolute) {
      try {
        await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
        await rm(absolute, { force: true });
        await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
        let remaining;
        try { remaining = await open(join('/proc/self/fd', String(artifactsHandle.fd), basename(absolute)), 'r'); }
        catch (openError) { if (openError.code !== 'ENOENT') throw openError; }
        if (remaining) {
          await remaining.close();
          fail('KINETIC_CAPTURE_CLEANUP_FAILED', `artifact remained after failed publication: ${artifactPath}`);
        }
        await artifactsHandle.sync();
        created = false;
      } catch (cleanupError) { suppress(error, cleanupError); }
    }
    throw error;
  } finally {
    let cleanupFailure;
    for (const cleanup of [
      () => tempHandle?.close(),
      () => temp ? rm(temp, { force: true }) : undefined,
      () => artifactsHandle?.close(),
      () => caseHandle.close(),
    ]) {
      try { await cleanup(); }
      catch (error) {
        if (failure) suppress(failure, error);
        else if (cleanupFailure) suppress(cleanupFailure, error);
        else cleanupFailure = error;
      }
    }
    if (!failure && cleanupFailure) throw cleanupFailure;
  }
  return { artifactPath, sha256, created };
}

async function removeCaptureArtifact(caseRoot, artifactPath) {
  const realCaseRoot = await realpath(caseRoot);
  const caseHandle = await open(realCaseRoot, 'r');
  let artifactsHandle;
  let failure;
  try {
    artifactsHandle = await open(join('/proc/self/fd', String(caseHandle.fd), 'artifacts'), 'r');
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
    const absolute = join('/proc/self/fd', String(artifactsHandle.fd), basename(artifactPath));
    await rm(absolute, { force: true });
    await artifactsHandle.sync();
    await assertOpenArtifactDirectoryContained(realCaseRoot, artifactsHandle);
    let remaining;
    try { remaining = await open(absolute, 'r'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (remaining) {
      const cleanupError = captureError('KINETIC_CAPTURE_CLEANUP_FAILED', `artifact remained after cleanup: ${artifactPath}`);
      try { await remaining.close(); } catch (closeError) { suppress(cleanupError, closeError); }
      throw cleanupError;
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    let cleanupFailure;
    for (const cleanup of [() => artifactsHandle?.close(), () => caseHandle.close()]) {
      try { await cleanup(); }
      catch (error) {
        if (failure) suppress(failure, error);
        else if (cleanupFailure) suppress(cleanupFailure, error);
        else cleanupFailure = error;
      }
    }
    if (!failure && cleanupFailure) throw cleanupFailure;
  }
}

export async function removeUnreferencedCaptureArtifact({ manifestPath, caseRoot, artifactPath }) {
  return withFileLock(manifestPath, async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    await validateCaptureManifest({ manifest, caseRoot });
    if (!manifest.entries.some(({ artifact_path }) => artifact_path === artifactPath)) {
      await removeCaptureArtifact(caseRoot, artifactPath);
    }
    return manifest;
  });
}

function isTransientBrowserError(error) {
  if (error.transient === false) return false;
  if (error.code === 'KINETIC_CAPTURE_BROWSER_CRASHED') return true;
  return /target (?:page, context or browser has been closed|crashed)|browser has been closed|connection closed|websocket.*closed|econnreset|epipe|socket hang up/i.test(error.message);
}

async function retryTransient(operation, onRetry = async () => {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      const browserTransient = isTransientBrowserError(error);
      if ((!error.transient && !browserTransient) || attempt === 3) throw error;
      try { await onRetry(error); }
      catch (retryError) {
        suppress(error, retryError);
        throw error;
      }
      await new Promise((done) => setTimeout(done, attempt * 25));
    }
  }
}

function captureError(code, message, transient = false) {
  return Object.assign(new Error(message), { code, transient });
}

function suppress(primary, secondary) {
  primary.suppressed ??= [];
  primary.suppressed.push(secondary);
}

function captureBrowserLaunchOptions() {
  return { headless: true, args: ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'] };
}

export async function withinCaptureTimeout(promise, timeoutMs, code, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(captureError(code, message)), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function performAction(page, spec) {
  const selector = spec.target_selector;
  switch (spec.trigger_action) {
    case 'goto': break;
    case 'scroll_to_px': {
      const y = Number(selector);
      if (!Number.isFinite(y)) throw captureError('KINETIC_CAPTURE_ACTION_INVALID', 'scroll_to_px requires a numeric target_selector');
      await page.evaluate((value) => window.scrollTo(0, value), y);
      break;
    }
    case 'scroll_to_selector': await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 3_000 }); break;
    case 'hover': await page.locator(selector).hover({ timeout: 3_000 }); break;
    case 'focus': await page.locator(selector).focus({ timeout: 3_000 }); break;
    case 'click': await page.locator(selector).click({ timeout: 3_000 }); break;
    case 'wait_for_selector': await page.locator(selector).waitFor({ state: 'visible', timeout: 3_000 }); break;
    case 'wait_ms': await page.waitForTimeout(Math.min(spec.checkpoint_ms ?? 0, 5_000)); break;
    case 'kinetic_seek': {
      const sought = await withinCaptureTimeout(page.evaluate(async ({ handle, progress }) => {
        const hook = window.__KINETIC_CAPTURE__;
        if (!hook || typeof hook.seek !== 'function') return false;
        await hook.seek(handle, progress);
        return true;
      }, { handle: selector, progress: spec.checkpoint_progress }), 3_000, 'KINETIC_CAPTURE_ACTION_TIMEOUT', 'kinetic_seek timed out');
      if (!sought) throw captureError('KINETIC_CAPTURE_HOOK_MISSING', 'kinetic_seek requires window.__KINETIC_CAPTURE__.seek');
      break;
    }
    default: throw captureError('KINETIC_CAPTURE_ACTION_INVALID', `unsupported capture action: ${spec.trigger_action}`);
  }
  if (spec.trigger_action !== 'wait_ms' && spec.checkpoint_ms !== null) await page.waitForTimeout(Math.min(spec.checkpoint_ms, 5_000));
}

async function convertPng(page, png) {
  const converted = await withinCaptureTimeout(page.evaluate(async (base64) => {
    const source = await (await fetch(`data:image/png;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(bitmap, 0, 0);
    const webp = await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, 'image/webp', 0.9));
    if (!webp || webp.type !== 'image/webp') throw new Error('Chromium WebP conversion failed');
    const small = document.createElement('canvas');
    small.width = 16;
    small.height = 16;
    const smallContext = small.getContext('2d', { alpha: false });
    smallContext.drawImage(bitmap, 0, 0, 16, 16);
    bitmap.close();
    const pixels = smallContext.getImageData(0, 0, 16, 16).data;
    const luminance = [];
    for (let index = 0; index < pixels.length; index += 4) luminance.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
    let visualPhash = '';
    for (let index = 0; index < luminance.length; index += 4) {
      let nibble = 0;
      for (let bit = 0; bit < 4; bit++) nibble = (nibble << 1) | Number(luminance[index + bit] >= mean);
      visualPhash += nibble.toString(16);
    }
    const webpBase64 = await new Promise((resolveData, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolveData(reader.result.split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(webp);
    });
    return { webpBase64, visualPhash };
  }, png.toString('base64')), 10_000, 'KINETIC_CAPTURE_CONVERSION_TIMEOUT', 'PNG to WebP conversion timed out');
  return { webp: Buffer.from(converted.webpBase64, 'base64'), visualPhash: converted.visualPhash };
}

function isTransientNavigationError(error) {
  return error.name === 'TimeoutError' || isTransientBrowserError(error)
    || /net::ERR_(?:TIMED_OUT|CONNECTION_RESET|CONNECTION_CLOSED|NETWORK_CHANGED|EMPTY_RESPONSE)/i.test(error.message);
}

export function captureRouteAction(specUrl, requestUrl, isMainNavigation, method = 'GET') {
  if (!['GET', 'HEAD'].includes(method)) return 'abort';
  if (['about:', 'blob:', 'data:'].includes(new URL(requestUrl).protocol)) return 'continue';
  return 'abort';
}

export async function captureBrowserSpec({ browser, spec, navigationBody = null }) {
  let context;
  let failure;
  try {
    context = await browser.newContext({
      viewport: { width: spec.viewport.width, height: spec.viewport.height },
      deviceScaleFactor: spec.viewport.device_scale,
      isMobile: spec.viewport.is_mobile,
      hasTouch: spec.viewport.has_touch,
      reducedMotion: spec.reduced_motion,
      serviceWorkers: 'block',
    });
    await context.addInitScript((seed) => Object.defineProperty(window, '__KINETIC_SEED__', { value: seed, configurable: false }), 1337);
    await context.addInitScript(() => {
      for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'Worker', 'SharedWorker']) {
        Object.defineProperty(globalThis, name, { value: undefined, writable: false, configurable: false });
      }
    });
    const page = await context.newPage();
    await context.routeWebSocket('**/*', (webSocket) => webSocket.close({ code: 1008, reason: 'capture network disabled' }));
    await context.route('**/*', (route) => {
      const request = route.request();
      const action = captureRouteAction(
        spec.url,
        request.url(),
        request.isNavigationRequest() && request.frame() === page.mainFrame(),
        request.method(),
      );
      if (action === 'abort') return route.abort('blockedbyclient');
      return route.continue();
    });
    try {
      if (navigationBody) await page.setContent(navigationBody.toString('utf8'), { waitUntil: 'domcontentloaded', timeout: 10_000 });
      else await page.goto(spec.url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    }
    catch (error) {
      const transient = isTransientNavigationError(error);
      throw captureError(transient ? 'KINETIC_CAPTURE_NAVIGATION_TRANSIENT' : 'KINETIC_CAPTURE_NAVIGATION_FAILED', error.message, transient);
    }
    const notes = [];
    let readiness = 'READY';
    const fontsReady = await withinCaptureTimeout(page.evaluate(() => Promise.race([
      document.fonts.ready.then(() => true),
      new Promise((resolveWait) => setTimeout(() => resolveWait(false), 3_000)),
    ])), 3_500, 'KINETIC_CAPTURE_FONT_TIMEOUT', 'font readiness timed out');
    if (!fontsReady) { readiness = 'READY_WITH_LIMITATIONS'; notes.push('document.fonts.ready timed out'); }
    const brokenImages = await withinCaptureTimeout(page.evaluate(async () => {
      const images = [...document.images].filter((image) => image.getBoundingClientRect().width > 0 && image.getBoundingClientRect().height > 0);
      const results = await Promise.all(images.map(async (image) => {
        try { await image.decode(); return null; }
        catch { return image.currentSrc || image.src || '<inline-image>'; }
      }));
      return results.filter(Boolean);
    }), 3_000, 'KINETIC_CAPTURE_IMAGE_TIMEOUT', 'visible image decode timed out');
    if (brokenImages.length) throw captureError('KINETIC_CAPTURE_IMAGE_BROKEN', `visible image decode failed: ${brokenImages.join(', ')}`);
    try { await page.waitForLoadState('networkidle', { timeout: 3_000 }); }
    catch { readiness = 'READY_WITH_LIMITATIONS'; notes.push('network idle timed out'); }
    const ready = await withinCaptureTimeout(page.evaluate(async () => {
      if (typeof window.__KINETIC_CAPTURE__?.ready === 'function') return Boolean(await window.__KINETIC_CAPTURE__.ready());
      return Boolean(document.querySelector('[data-kinetic-fixture="ready"], [data-kinetic-capture-ready]'));
    }), 3_000, 'KINETIC_CAPTURE_READINESS_TIMEOUT', 'capture ready hook timed out');
    if (!ready) throw captureError('KINETIC_CAPTURE_READINESS_FAILED', 'page did not expose a deterministic ready signal');
    try { await performAction(page, spec); }
    catch (error) {
      if (error.code?.startsWith('KINETIC_')) throw error;
      throw captureError('KINETIC_CAPTURE_SELECTOR_FAILED', error.message);
    }
    if (spec.capture_mode === 'STATIC_CAPTURE_STABLE') {
      await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}' });
      notes.push('unrelated CSS animation and caret noise stabilized');
    }
    await withinCaptureTimeout(
      page.evaluate(() => new Promise((resolveFrames) => requestAnimationFrame(() => requestAnimationFrame(resolveFrames)))),
      3_000,
      'KINETIC_CAPTURE_SETTLE_TIMEOUT',
      'two-frame settle timed out',
    );
    const png = await page.screenshot({
      type: 'png', fullPage: false,
      animations: spec.capture_mode === 'STATIC_CAPTURE_STABLE' ? 'disabled' : 'allow',
      timeout: 10_000,
    });
    const converter = await context.newPage();
    await converter.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 3_000 });
    const converted = await convertPng(converter, png);
    return { ...converted, readiness, notes };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try { await context?.close(); }
    catch (error) {
      if (!failure) throw error;
      suppress(failure, error);
    }
  }
}

export async function runCapturePipeline({
  manifestPath,
  caseRoot,
  sourceIdsByUrl = {},
  launchBrowser = (options) => chromium.launch(options),
  captureSpec = captureBrowserSpec,
  recordTelemetry = recordStageTelemetry,
  now = () => new Date().toISOString(),
}) {
  const startedAt = now();
  let manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await recordTelemetry(manifest.case_id, { stage: 'capture', startedAt, status: 'RUNNING', attempt: 0 });
  let browser;
  let failure;
  let cleanupFailure;
  try {
    await validateCaptureManifest({ manifest, caseRoot });
    const existing = new Set(manifest.entries.map(({ capture_id }) => capture_id));
    const missing = manifest.specs.filter(({ capture_id }) => !existing.has(capture_id));
    if (missing.length !== 0) {
      await loadSourceRegistry();
      const navigationBodies = new Map();
      for (const url of new Set(missing.map((spec) => spec.url))) {
        if (new URL(url).protocol !== 'file:') {
          authorizeCaptureAccess({ sourceId: sourceIdsByUrl[url], url });
          continue;
        }
        let handle;
        let sourceFailure;
        try {
          handle = await open(fileURLToPath(url), 'r');
          const realSource = await realpath(`/proc/self/fd/${handle.fd}`);
          authorizeCaptureAccess({ url: pathToFileURL(realSource).href });
          navigationBodies.set(url, await handle.readFile());
        } catch (error) {
          if (error.code?.startsWith('KINETIC_')) sourceFailure = error;
          else {
            try { fail('KINETIC_CAPTURE_ACCESS_DENIED', `local capture URL cannot be opened safely: ${url}`, error); }
            catch (denied) { sourceFailure = denied; }
          }
          throw sourceFailure;
        } finally {
          try { await handle?.close(); }
          catch (error) { if (sourceFailure) suppress(sourceFailure, error); else throw error; }
        }
      }
      if (manifest.playwright_version !== playwrightVersion) {
        fail('KINETIC_CAPTURE_PLAYWRIGHT_VERSION_MISMATCH', `manifest expects ${manifest.playwright_version}, installed ${playwrightVersion}`);
      }
      if (!process.env.PLAYWRIGHT_BROWSERS_PATH || !process.env.TMPDIR) {
        fail('KINETIC_CAPTURE_RUNTIME_PATH_INVALID', 'Playwright browser cache and TMPDIR must be explicit project-local paths');
      }
      let realBrowserCache;
      let realTemp;
      try {
        [realBrowserCache, realTemp] = await Promise.all([realpath(process.env.PLAYWRIGHT_BROWSERS_PATH), realpath(process.env.TMPDIR)]);
      } catch {
        fail('KINETIC_CAPTURE_RUNTIME_PATH_INVALID', 'Playwright browser cache and TMPDIR must resolve before launch');
      }
      if (!inside(await realpath(root), realBrowserCache) || !inside(await realpath(root), realTemp)) {
        fail('KINETIC_CAPTURE_RUNTIME_PATH_INVALID', 'Playwright browser cache and TMPDIR must be explicit project-local paths');
      }
      browser = await retryTransient(() => launchBrowser(captureBrowserLaunchOptions()));
      if (typeof browser.version === 'function' && browser.version() !== manifest.browser_version) {
        fail('KINETIC_CAPTURE_BROWSER_VERSION_MISMATCH', `manifest expects ${manifest.browser_version}, launched ${browser.version()}`);
      }
      for (const spec of missing) {
        let result;
        try {
          result = await retryTransient(
            () => captureSpec({ browser, spec, navigationBody: navigationBodies.get(spec.url) ?? null }),
            async (error) => {
              if (!isTransientBrowserError(error)) return;
              if (browser.isConnected?.()) return;
              try { await browser.close(); } catch (closeError) { cleanupFailure ??= closeError; }
              browser = await retryTransient(() => launchBrowser(captureBrowserLaunchOptions()));
              if (typeof browser.version === 'function' && browser.version() !== manifest.browser_version) {
                fail('KINETIC_CAPTURE_BROWSER_VERSION_MISMATCH', `manifest expects ${manifest.browser_version}, launched ${browser.version()}`);
              }
            },
          );
        }
        catch (error) {
          const timestamp = now();
          try {
            manifest = await appendCaptureFailure({
              manifestPath, caseRoot, now: timestamp,
              failure: {
                capture_id: spec.capture_id, attempt: spec.attempt,
                code: error.code ?? 'KINETIC_CAPTURE_FAILED', reason: error.message,
                transient: Boolean(error.transient || isTransientBrowserError(error)), timestamp,
              },
            });
          } catch (receiptError) { suppress(error, receiptError); }
          throw error;
        }
        const candidateSha256 = createHash('sha256').update(result.webp).digest('hex');
        const key = comparisonKey(spec);
        const priorHashes = new Set(manifest.entries.flatMap((entry) => {
          const priorSpec = manifest.specs.find(({ capture_id }) => capture_id === entry.capture_id);
          return priorSpec && comparisonKey(priorSpec) === key ? [entry.sha256] : [];
        }));
        const notes = [...(result.notes ?? [])];
        if (!priorHashes.has(candidateSha256) && priorHashes.size === 1) notes.push('nondeterministic: second distinct artifact hash retained');
        if (!priorHashes.has(candidateSha256) && priorHashes.size >= 2) {
          const timestamp = now();
          const error = captureError('KINETIC_CAPTURE_NONDETERMINISTIC', `capture ${spec.capture_id} produced a third distinct artifact hash`);
          try {
            manifest = await appendCaptureFailure({
              manifestPath,
              caseRoot,
              now: timestamp,
              failure: {
                capture_id: spec.capture_id,
                attempt: spec.attempt,
                code: error.code,
                reason: 'third distinct artifact hash for the same logical capture spec',
                transient: false,
                timestamp,
              },
            });
          } catch (receiptError) { suppress(error, receiptError); }
          throw error;
        }
        let artifact;
        try {
          artifact = await writeCaptureArtifact(caseRoot, result.webp);
          const { build_sha256: ignored, ...entrySpec } = spec;
          const timestamp = now();
          manifest = await appendCaptureEntry({
            manifestPath,
            caseRoot,
            now: timestamp,
            entry: {
              ...entrySpec,
              timestamp,
              playwright_version: manifest.playwright_version,
              browser_version: manifest.browser_version,
              artifact_path: artifact.artifactPath,
              sha256: artifact.sha256,
              visual_phash: result.visualPhash,
              readiness: result.readiness,
              notes,
            },
          });
        } catch (error) {
          if (artifact?.created) {
            try { await removeUnreferencedCaptureArtifact({ manifestPath, caseRoot, artifactPath: artifact.artifactPath }); }
            catch (cleanupError) { suppress(error, cleanupError); }
          }
          const timestamp = now();
          try {
            manifest = await appendCaptureFailure({
              manifestPath,
              caseRoot,
              now: timestamp,
              failure: {
                capture_id: spec.capture_id, attempt: spec.attempt,
                code: error.code ?? 'KINETIC_CAPTURE_PERSISTENCE_FAILED', reason: error.message,
                transient: false, timestamp,
              },
            });
          } catch (receiptError) { suppress(error, receiptError); }
          throw error;
        }
      }
    }
  } catch (error) {
    failure = error;
  }
  try { await browser?.close(); }
  catch (error) {
    if (failure) suppress(failure, error);
    else failure = error;
  }
  if (cleanupFailure) {
    if (failure) suppress(failure, cleanupFailure);
    else failure = cleanupFailure;
  }
  const endedAt = now();
  try {
    await recordTelemetry(manifest.case_id, {
      stage: 'capture', startedAt, endedAt, status: failure ? 'FAILED' : 'COMPLETED', attempt: 0,
      receiptRefs: [manifestPath],
    });
  } catch (error) {
    if (!failure) throw error;
    suppress(failure, error);
  }
  if (failure) throw failure;
  return manifest;
}
