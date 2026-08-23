import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, statfs, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { chromium } from 'playwright-chromium';
import { appendCaptureEntry, assertArtifactDirectoryContained, assertCaptureCompleteness, captureBrowserSpec, captureId, capturePlan, captureRouteAction, performAction, removeUnreferencedCaptureArtifact, runCapturePipeline, validateCaptureManifest, withinCaptureTimeout, writeJsonAtomic } from '../cli/capture.mjs';

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

let s11Receipt = process.env.KINETIC_TEST_SLICE === 'S13'
  ? { playwright_version: '1.62.1', browser_version: '151.0.7922.34' }
  : null;
if (!['S12', 'S13'].includes(process.env.KINETIC_TEST_SLICE)) {
  s11Receipt = await smoke();
  await assert.rejects(smoke({ injectLaunchFailure: true }), /missing-chromium|executable/i);
  await assert.rejects(statfs(runTmp), (error) => error.code === 'ENOENT');
  console.log(`S11 Playwright boundary: PASS (T45, ${JSON.stringify(s11Receipt)})`);
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

    const duplicateManifestPath = join(s12Tmp, 'duplicate-manifest.json');
    await writeFile(duplicateManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await Promise.all([now, '2026-08-23T00:00:01.000Z'].map((timestamp) => appendCaptureEntry({
      manifestPath: duplicateManifestPath,
      caseRoot: s12Tmp,
      entry: { ...stored.entries[0], timestamp },
      now: timestamp,
    })));
    assert.equal(
      (JSON.parse(await readFile(duplicateManifestPath, 'utf8'))).entries.length,
      1,
      'concurrent identical capture_id appends must reuse the committed entry',
    );

    const corruptReusePath = join(s12Tmp, 'corrupt-reuse-manifest.json');
    const missingEntryForReuse = { ...stored.entries[0], artifact_path: 'artifacts/missing-reuse.webp' };
    await writeFile(corruptReusePath, `${JSON.stringify({ ...manifest, entries: [missingEntryForReuse] }, null, 2)}\n`);
    await assert.rejects(
      appendCaptureEntry({ manifestPath: corruptReusePath, caseRoot: s12Tmp, entry: missingEntryForReuse, now }),
      (error) => error.code === 'KINETIC_CAPTURE_ARTIFACT_MISSING',
      'same-ID reuse must validate the locked manifest before returning',
    );

    const existingDuplicatePath = join(s12Tmp, 'existing-duplicate-manifest.json');
    await writeFile(existingDuplicatePath, `${JSON.stringify({
      ...manifest,
      entries: [stored.entries[0], { ...stored.entries[0], timestamp: '2026-08-23T00:00:01.000Z' }],
    }, null, 2)}\n`);
    await assert.rejects(
      appendCaptureEntry({ manifestPath: existingDuplicatePath, caseRoot: s12Tmp, entry: stored.entries[0], now }),
      (error) => error.code === 'KINETIC_CAPTURE_ENTRY_DUPLICATE',
      'same-ID reuse must not conceal pre-existing duplicate entries',
    );

    const failedAtomicPath = join(s12Tmp, 'failed-atomic.json');
    await assert.rejects(writeJsonAtomic(failedAtomicPath, { invalid: 1n }), TypeError);
    assert.ok(!(await readdir(s12Tmp)).some((name) => name.startsWith('failed-atomic.json.tmp-')), 'failed atomic writes must remove temp files');

    const cleanupManifestPath = join(s12Tmp, 'cleanup-manifest.json');
    await writeFile(cleanupManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const cleanupLock = await open(`${cleanupManifestPath}.lock`, 'wx', 0o600);
    const cleanup = removeUnreferencedCaptureArtifact({
      manifestPath: cleanupManifestPath,
      caseRoot: s12Tmp,
      artifactPath: stored.entries[0].artifact_path,
    });
    await new Promise((done) => setTimeout(done, 25));
    await writeFile(cleanupManifestPath, `${JSON.stringify({ ...manifest, entries: [stored.entries[0]] }, null, 2)}\n`);
    await cleanupLock.close();
    await rm(`${cleanupManifestPath}.lock`);
    await cleanup;
    assert.ok((await readFile(join(s12Tmp, stored.entries[0].artifact_path))).length > 0, 'locked publication must win over cleanup');

    const renameCaseRoot = join(s12Tmp, 'rename-case');
    const renamedArtifacts = join(controlledTmp, 'renamed-artifacts-outside');
    await rm(renamedArtifacts, { recursive: true, force: true });
    await mkdir(join(renameCaseRoot, 'artifacts'), { recursive: true });
    const renamedHandle = await open(join(renameCaseRoot, 'artifacts'), 'r');
    try {
      await rename(join(renameCaseRoot, 'artifacts'), renamedArtifacts);
      await assert.rejects(
        assertArtifactDirectoryContained(renameCaseRoot, renamedHandle),
        (error) => error.code === 'KINETIC_CAPTURE_PATH_INVALID',
      );
    } finally {
      await renamedHandle.close();
      await rm(renamedArtifacts, { recursive: true, force: true });
    }

    const beforeRejectedAppend = await readFile(manifestPath, 'utf8');
    await assert.rejects(
      appendCaptureEntry({ manifestPath, caseRoot: s12Tmp, entry: { ...stored.entries[0], sha256: 'd'.repeat(64) }, now }),
      (error) => error.code === 'KINETIC_CAPTURE_ENTRY_DUPLICATE',
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

if (process.env.KINETIC_TEST_SLICE !== 'S13') {
  await testS12();
  console.log('S12 capture manifest: PASS (T17-T19)');
}

async function testS13RightsPreflight() {
  const testRoot = join(controlledTmp, 's13-rights');
  const manifestPath = join(testRoot, 'manifest.json');
  const registryPath = join(root, 'gym', 'knowledge', 'sources', 'registry.json');
  const registryBefore = await readFile(registryPath);
  const previousGymRoot = process.env.KINETIC_GYM_ROOT;
  await rm(testRoot, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });
  try {
    const manifest = capturePlan({
      caseId: 'case-fixture',
      subjectId: 'reference',
      url: 'https://labs.cuvii.dev/volume/motion',
      specs: [{
        attempt: 1,
        viewport: viewport.desktop,
        capture_mode: 'STATIC_CAPTURE_STABLE',
        state: 'initial',
        trigger_action: 'goto',
        target_selector: null,
        checkpoint_ms: null,
        checkpoint_progress: null,
        reduced_motion: 'no-preference',
        build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1',
      browserVersion: '151.0.7922.34',
      now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    let launches = 0;
    await assert.rejects(
      runCapturePipeline({
        manifestPath,
        caseRoot: testRoot,
        sourceIdsByUrl: { [manifest.specs[0].url]: 'src-cuvii-labs-motion' },
        recordTelemetry: async () => {},
        launchBrowser: async () => { launches++; throw new Error('launch must not run'); },
      }),
      (error) => error.code === 'KINETIC_CAPTURE_ACCESS_DENIED',
    );
    assert.equal(launches, 0, 'rights denial must happen before browser launch');
    assert.deepEqual(await readFile(registryPath), registryBefore, 'capture preflight must not mutate Source Registry bytes');

    const gymRoot = join(testRoot, 'gym');
    const sourcePath = join(gymRoot, 'runs', 'case-fixture', 'source.html');
    const localManifestPath = join(testRoot, 'local-manifest.json');
    const authorizedBytes = Buffer.from('<main data-kinetic-capture-ready>authorized</main>');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, authorizedBytes);
    process.env.KINETIC_GYM_ROOT = gymRoot;
    await writeFile(localManifestPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(sourcePath).href,
      specs: [{
        attempt: 1, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial',
        trigger_action: 'goto', target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
        reduced_motion: 'no-preference', build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    await runCapturePipeline({
      manifestPath: localManifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async (options) => {
        assert.ok(options.args.includes('--force-webrtc-ip-handling-policy=disable_non_proxied_udp'));
        await writeFile(sourcePath, '<main>replaced after authorization</main>');
        return { close: async () => {} };
      },
      captureSpec: async ({ navigationBody, spec }) => {
        assert.deepEqual(navigationBody, authorizedBytes, 'capture must consume the preflight-opened local bytes');
        return { webp: Buffer.from(`local:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    await rm(sourcePath);
    const reused = await runCapturePipeline({
      manifestPath: localManifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => { throw new Error('complete local reuse must not launch'); },
      now: () => now,
    });
    assert.equal(reused.entries.length, 1, 'complete reuse must not re-read a deleted local source');
  } finally {
    if (previousGymRoot === undefined) delete process.env.KINETIC_GYM_ROOT;
    else process.env.KINETIC_GYM_ROOT = previousGymRoot;
    await rm(testRoot, { recursive: true, force: true });
  }
}

await testS13RightsPreflight();
console.log('S13 rights preflight: PASS (T42)');

async function testS13BoundedReadinessAndNavigation() {
  assert.equal(captureRouteAction('https://allowed.example/page', 'https://allowed.example/page', true), 'abort');
  assert.equal(captureRouteAction('https://allowed.example/page', 'https://elsewhere.example/', true), 'abort');
  assert.equal(captureRouteAction('file:///approved/page.html', 'file:///approved/page.html', true), 'abort');
  assert.equal(captureRouteAction('file:///approved/page.html', 'file:///approved/style.css', false), 'abort');
  assert.equal(captureRouteAction('https://allowed.example/page', 'https://allowed.example/collect', false, 'POST'), 'abort');
  assert.equal(captureRouteAction('file:///approved/page.html', 'https://attacker.example/leak?data=secret', false), 'abort');
  assert.equal(captureRouteAction('https://allowed.example/page', 'https://allowed.example/leak?data=secret', false), 'abort');
  assert.equal(captureRouteAction('https://allowed.example/page', 'data:image/png;base64,AA==', false), 'continue');
  await assert.rejects(
    withinCaptureTimeout(new Promise(() => {}), 10, 'KINETIC_CAPTURE_READINESS_TIMEOUT', 'ready hook timed out'),
    (error) => error.code === 'KINETIC_CAPTURE_READINESS_TIMEOUT',
  );
  const spec = {
    viewport: viewport.desktop,
    reduced_motion: 'no-preference',
    url: pathToFileURL(fixture).href,
  };
  const fakeBrowser = (navigationError, closeError = null) => ({
    newContext: async (options) => {
      assert.equal(options.serviceWorkers, 'block');
      let blockedWebRtc = false;
      return {
        addInitScript: async (script, arg) => {
          if (arg === 1337) return;
          assert.match(String(script), /RTCPeerConnection/);
          assert.match(String(script), /SharedWorker/);
          assert.match(String(script), /Worker/);
          assert.match(String(script), /configurable:\s*false/);
          blockedWebRtc = true;
        },
        routeWebSocket: async () => {},
        route: async () => {},
        newPage: async () => ({
          mainFrame: () => ({}),
          goto: async () => { assert.equal(blockedWebRtc, true); throw navigationError; },
        }),
        close: async () => { if (closeError) throw closeError; },
      };
    },
  });
  const contextCloseError = Object.assign(new Error('context cleanup failed'), { code: 'CONTEXT_CLOSE_FAILED' });
  await assert.rejects(
    captureBrowserSpec({ browser: fakeBrowser(new Error('net::ERR_FILE_NOT_FOUND'), contextCloseError), spec }),
    (error) => error.code === 'KINETIC_CAPTURE_NAVIGATION_FAILED'
      && error.transient === false
      && error.suppressed?.[0] === contextCloseError,
  );
  const timeout = Object.assign(new Error('page.goto: Timeout 10000ms exceeded'), { name: 'TimeoutError' });
  await assert.rejects(
    captureBrowserSpec({ browser: fakeBrowser(timeout), spec }),
    (error) => error.code === 'KINETIC_CAPTURE_NAVIGATION_TRANSIENT' && error.transient === true,
  );
  let seekCompleted = false;
  const previousWindow = globalThis.window;
  globalThis.window = { __KINETIC_CAPTURE__: { seek: async () => {
    await new Promise((done) => setTimeout(done, 10));
    seekCompleted = true;
  } } };
  try {
    await performAction({ evaluate: (operation, value) => operation(value) }, {
      trigger_action: 'kinetic_seek', target_selector: 'hero', checkpoint_progress: 0.5, checkpoint_ms: null,
    });
    assert.equal(seekCompleted, true, 'kinetic_seek must settle before capture');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

await testS13BoundedReadinessAndNavigation();
console.log('S13 readiness bounds/navigation classification: PASS');

async function testS13ReuseAndResume() {
  const testRoot = join(controlledTmp, 's13-resume');
  const manifestPath = join(testRoot, 'manifest.json');
  const outsideArtifacts = join(controlledTmp, 's13-outside-artifacts');
  await rm(testRoot, { recursive: true, force: true });
  await rm(outsideArtifacts, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });
  try {
    const specs = [
      { attempt: 1, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', trigger_action: 'goto' },
      { attempt: 1, viewport: viewport.mobile, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'content', trigger_action: 'wait_for_selector', target_selector: 'main' },
    ].map((spec) => ({
      target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
      reduced_motion: 'no-preference', build_sha256: buildSha256, ...spec,
    }));
    const manifest = capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href, specs,
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const captured = [];
    const fakeBrowser = { close: async () => {} };
    let stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => fakeBrowser,
      captureSpec: async ({ spec }) => {
        captured.push(spec.capture_id);
        return { webp: Buffer.from(`webp:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    assert.equal(stored.entries.length, 2);
    assert.deepEqual(captured.sort(), manifest.specs.map(({ capture_id }) => capture_id).sort());
    assert.deepEqual((await readdir(join(testRoot, 'artifacts'))).filter((name) => name.includes('.tmp-')), []);

    captured.length = 0;
    stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => { throw new Error('complete rerun must not launch'); },
      captureSpec: async () => { throw new Error('complete rerun must not capture'); },
      now: () => now,
    });
    assert.equal(stored.entries.length, 2);
    assert.deepEqual(captured, []);

    stored.entries.pop();
    await writeFile(manifestPath, `${JSON.stringify(stored, null, 2)}\n`);
    stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => fakeBrowser,
      captureSpec: async ({ spec }) => {
        captured.push(spec.capture_id);
        return { webp: Buffer.from(`webp:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    assert.equal(stored.entries.length, 2);
    assert.deepEqual(captured, [manifest.specs[1].capture_id]);

    const unsafeRoot = join(controlledTmp, 's13-unsafe-writer');
    const unsafeManifestPath = join(unsafeRoot, 'manifest.json');
    await mkdir(unsafeRoot, { recursive: true });
    await mkdir(outsideArtifacts, { recursive: true });
    await symlink(outsideArtifacts, join(unsafeRoot, 'artifacts'));
    await writeFile(unsafeManifestPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href,
      specs: [specs[0]], playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    await assert.rejects(runCapturePipeline({
      manifestPath: unsafeManifestPath,
      caseRoot: unsafeRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => fakeBrowser,
      captureSpec: async ({ spec }) => ({
        webp: Buffer.from(`unsafe:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [],
      }),
      now: () => now,
    }), (error) => error.code === 'KINETIC_CAPTURE_PATH_INVALID');
    assert.deepEqual(await readdir(outsideArtifacts), [], 'writer must reject a symlinked artifact directory before writing bytes');
  } finally {
    await rm(testRoot, { recursive: true, force: true });
    await rm(join(controlledTmp, 's13-unsafe-writer'), { recursive: true, force: true });
    await rm(outsideArtifacts, { recursive: true, force: true });
  }
}

await testS13ReuseAndResume();
console.log('S13 capture reuse/resume: PASS (T20)');

async function testS13RetryPolicy() {
  const testRoot = join(controlledTmp, 's13-retry');
  const manifestPath = join(testRoot, 'manifest.json');
  await rm(testRoot, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });
  try {
    const manifest = capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href,
      specs: [{
        attempt: 1, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial',
        trigger_action: 'goto', target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
        reduced_motion: 'no-preference', build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    let attempts = 0;
    const stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => ({ close: async () => {} }),
      captureSpec: async ({ spec }) => {
        attempts++;
        if (attempts < 3) throw Object.assign(new Error('transient navigation'), { code: 'KINETIC_CAPTURE_NAVIGATION_TRANSIENT', transient: true });
        return { webp: Buffer.from(`webp:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    assert.equal(attempts, 3);
    assert.equal(stored.entries.length, 1);

    const contextRetryPath = join(testRoot, 'context-retry.json');
    await writeFile(contextRetryPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V2', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    let contextAttempts = 0;
    let contextLaunches = 0;
    await runCapturePipeline({
      manifestPath: contextRetryPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => { contextLaunches++; return { isConnected: () => true, close: async () => {} }; },
      captureSpec: async ({ spec }) => {
        if (++contextAttempts === 1) throw new Error('Target page, context or browser has been closed');
        return { webp: Buffer.from(`context-retry:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    assert.equal(contextLaunches, 1, 'context-local closure must not restart a connected browser');

    const launchFailurePath = join(testRoot, 'launch-failure.json');
    await writeFile(launchFailurePath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V2', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    await assert.rejects(runCapturePipeline({
      manifestPath: launchFailurePath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => { throw Object.assign(new Error('browser unavailable'), { transient: false }); },
      now: () => now,
    }), /browser unavailable/);
    assert.equal((JSON.parse(await readFile(launchFailurePath, 'utf8'))).failures.length, 0, 'pipeline launch failure must not be attributed to a capture attempt');

    const deterministicPath = join(testRoot, 'deterministic.json');
    await writeFile(deterministicPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V2', url: pathToFileURL(fixture).href,
      specs: [{
        attempt: 1, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial',
        trigger_action: 'wait_for_selector', target_selector: '#missing', checkpoint_ms: null, checkpoint_progress: null,
        reduced_motion: 'no-preference', build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    let deterministicAttempts = 0;
    let closed = 0;
    await assert.rejects(runCapturePipeline({
      manifestPath: deterministicPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => ({ close: async () => { closed++; } }),
      captureSpec: async () => {
        deterministicAttempts++;
        throw Object.assign(new Error('browser crashed label missing'), { code: 'KINETIC_CAPTURE_SELECTOR_FAILED', transient: false });
      },
      now: () => now,
    }), (error) => error.code === 'KINETIC_CAPTURE_SELECTOR_FAILED');
    assert.equal(deterministicAttempts, 1);
    assert.equal(closed, 1);
    const failed = JSON.parse(await readFile(deterministicPath, 'utf8'));
    assert.equal(failed.failures.length, 1);
    assert.equal(failed.failures[0].code, 'KINETIC_CAPTURE_SELECTOR_FAILED');

    const suppressedPath = join(testRoot, 'suppressed.json');
    await writeFile(suppressedPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V2', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    const browserCloseError = Object.assign(new Error('browser cleanup failed'), { code: 'BROWSER_CLOSE_FAILED' });
    const telemetryError = Object.assign(new Error('final telemetry failed'), { code: 'TELEMETRY_FAILED' });
    let telemetryCalls = 0;
    await assert.rejects(runCapturePipeline({
      manifestPath: suppressedPath,
      caseRoot: testRoot,
      recordTelemetry: async () => { if (++telemetryCalls === 2) throw telemetryError; },
      launchBrowser: async () => ({ close: async () => { throw browserCloseError; } }),
      captureSpec: async () => { throw Object.assign(new Error('primary selector failure'), { code: 'KINETIC_CAPTURE_SELECTOR_FAILED' }); },
      now: () => now,
    }), (error) => error.code === 'KINETIC_CAPTURE_SELECTOR_FAILED'
      && error.suppressed?.includes(browserCloseError)
      && error.suppressed?.includes(telemetryError));

    const receiptMaskPath = join(testRoot, 'receipt-mask.json');
    await writeFile(receiptMaskPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V2', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    const primaryFailure = Object.assign(new Error('primary capture failure'), { code: 'KINETIC_CAPTURE_SELECTOR_FAILED' });
    await assert.rejects(runCapturePipeline({
      manifestPath: receiptMaskPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => ({ close: async () => {} }),
      captureSpec: async () => {
        await rm(receiptMaskPath);
        throw primaryFailure;
      },
      now: () => now,
    }), (error) => error === primaryFailure && error.suppressed?.some(({ code }) => code === 'ENOENT'));

    const crashPath = join(testRoot, 'browser-crash.json');
    await writeFile(crashPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V0', url: pathToFileURL(fixture).href,
      specs: [{
        attempt: 1, viewport: viewport.mobile, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial',
        trigger_action: 'goto', target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
        reduced_motion: 'no-preference', build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    let launches = 0;
    const recovered = await runCapturePipeline({
      manifestPath: crashPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => ({ id: ++launches, close: async () => {} }),
      captureSpec: async ({ browser, spec }) => {
        if (browser.id === 1) throw Object.assign(new Error('browser crashed'), { code: 'KINETIC_CAPTURE_BROWSER_CRASHED' });
        return { webp: Buffer.from(`recovered:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    });
    assert.equal(launches, 2, 'browser crash must relaunch before retrying the missing spec');
    assert.equal(recovered.entries.length, 1);

    const crashCleanupPath = join(testRoot, 'browser-crash-cleanup.json');
    await writeFile(crashCleanupPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V0', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    const crashCloseError = Object.assign(new Error('crashed browser did not close'), { code: 'BROWSER_CLOSE_FAILED' });
    launches = 0;
    await assert.rejects(runCapturePipeline({
      manifestPath: crashCleanupPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => ({ id: ++launches, close: async () => { if (launches === 1) throw crashCloseError; } }),
      captureSpec: async ({ browser, spec }) => {
        if (browser.id === 1) throw Object.assign(new Error('browser crashed'), { code: 'KINETIC_CAPTURE_BROWSER_CRASHED' });
        return { webp: Buffer.from(`recovered-cleanup:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [] };
      },
      now: () => now,
    }), (error) => error === crashCloseError);
    assert.equal((JSON.parse(await readFile(crashCleanupPath, 'utf8'))).entries.length, 1);

    const relaunchPath = join(testRoot, 'browser-relaunch-failure.json');
    await writeFile(relaunchPath, `${JSON.stringify(capturePlan({
      caseId: 'case-fixture', subjectId: 'V0', url: pathToFileURL(fixture).href,
      specs: manifest.specs.map(({ capture_id: ignored, ...spec }) => spec),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    }), null, 2)}\n`);
    const crashError = Object.assign(new Error('browser crashed'), { code: 'KINETIC_CAPTURE_BROWSER_CRASHED' });
    const relaunchError = Object.assign(new Error('browser relaunch failed'), { code: 'KINETIC_CAPTURE_BROWSER_FAILED' });
    launches = 0;
    await assert.rejects(runCapturePipeline({
      manifestPath: relaunchPath,
      caseRoot: testRoot,
      recordTelemetry: async () => {},
      launchBrowser: async () => {
        if (++launches === 1) return { close: async () => {} };
        throw relaunchError;
      },
      captureSpec: async () => { throw crashError; },
      now: () => now,
    }), (error) => error === crashError && error.suppressed?.includes(relaunchError));
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

await testS13RetryPolicy();
console.log('S13 bounded retry: PASS (T20)');

async function testS13DivergenceLimit() {
  const testRoot = join(controlledTmp, 's13-divergence');
  const manifestPath = join(testRoot, 'manifest.json');
  await rm(testRoot, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });
  try {
    const common = {
      viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', trigger_action: 'goto',
      target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
      reduced_motion: 'no-preference', build_sha256: buildSha256,
    };
    const manifest = capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href,
      specs: [1, 2, 3].map((attempt) => ({ ...common, attempt })),
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      runCapturePipeline({
        manifestPath,
        caseRoot: testRoot,
        recordTelemetry: async () => {},
        launchBrowser: async () => ({ close: async () => {} }),
        captureSpec: async ({ spec }) => ({
          webp: Buffer.from(`divergent-attempt:${spec.attempt}`),
          visualPhash: String(spec.attempt).repeat(64), readiness: 'READY', notes: [],
        }),
        now: () => now,
      }),
      (error) => error.code === 'KINETIC_CAPTURE_NONDETERMINISTIC',
    );
    const stored = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(stored.entries.length, 2, 'first two divergent attempts must remain evidence');
    assert.match(stored.entries[1].notes.join(' '), /nondeterministic/i);
    assert.equal(stored.failures.length, 1, 'third distinct attempt must be recorded as a failure');
    assert.equal(stored.failures[0].capture_id, manifest.specs[2].capture_id);
    assert.equal((await readdir(join(testRoot, 'artifacts'))).length, 2, 'rejected third divergence must not publish an orphan artifact');
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

await testS13DivergenceLimit();
console.log('S13 divergence limit: PASS (T20)');

async function testS13Telemetry() {
  const testRoot = join(controlledTmp, 's13-telemetry');
  const gymRoot = join(testRoot, 'gym');
  const capturesRoot = join(gymRoot, 'runs', 'case-fixture', 'captures');
  const manifestPath = join(capturesRoot, 'manifest.json');
  const previousGymRoot = process.env.KINETIC_GYM_ROOT;
  await rm(testRoot, { recursive: true, force: true });
  await mkdir(capturesRoot, { recursive: true });
  process.env.KINETIC_GYM_ROOT = gymRoot;
  try {
    const manifest = capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href,
      specs: [{
        attempt: 1, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial',
        trigger_action: 'goto', target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
        reduced_motion: 'no-preference', build_sha256: buildSha256,
      }],
      playwrightVersion: '1.62.1', browserVersion: '151.0.7922.34', now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await runCapturePipeline({
      manifestPath,
      caseRoot: capturesRoot,
      launchBrowser: async () => ({ close: async () => {} }),
      captureSpec: async ({ spec }) => ({
        webp: Buffer.from(`telemetry:${spec.capture_id}`), visualPhash: '0'.repeat(64), readiness: 'READY', notes: [],
      }),
      now: () => now,
    });
    const telemetry = JSON.parse(await readFile(join(gymRoot, 'runs', 'case-fixture', 'telemetry.json'), 'utf8'));
    assert.equal(telemetry.stages.capture.status, 'COMPLETED');
    assert.deepEqual(telemetry.stages.capture.receipt_refs, [manifestPath]);
  } finally {
    if (previousGymRoot === undefined) delete process.env.KINETIC_GYM_ROOT;
    else process.env.KINETIC_GYM_ROOT = previousGymRoot;
    await rm(testRoot, { recursive: true, force: true });
  }
}

await testS13Telemetry();
console.log('S13 capture telemetry: PASS');

async function testS13BrowserPipeline(receipt) {
  const testRoot = join(controlledTmp, 's13-browser');
  const manifestPath = join(testRoot, 'manifest.json');
  await rm(testRoot, { recursive: true, force: true });
  await mkdir(testRoot, { recursive: true });
  try {
    const common = { attempt: 1, target_selector: null, checkpoint_ms: null, checkpoint_progress: null, build_sha256: buildSha256 };
    const specs = [
      { ...common, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', trigger_action: 'goto', reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'mid-scroll', trigger_action: 'scroll_to_selector', target_selector: '#checkpoint', reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.desktop, capture_mode: 'MOTION_STATE_CAPTURE', state: 'signature', trigger_action: 'hover', target_selector: '.mark', checkpoint_ms: 150, reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'final', trigger_action: 'scroll_to_selector', target_selector: '#checkpoint', reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.mobile, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', trigger_action: 'goto', reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.mobile, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'content', trigger_action: 'scroll_to_selector', target_selector: '#checkpoint', reduced_motion: 'no-preference' },
      { ...common, viewport: viewport.desktop, capture_mode: 'STATIC_CAPTURE_STABLE', state: 'reduced-motion', trigger_action: 'goto', reduced_motion: 'reduce' },
    ];
    const manifest = capturePlan({
      caseId: 'case-fixture', subjectId: 'V1', url: pathToFileURL(fixture).href, specs,
      playwrightVersion: receipt.playwright_version, browserVersion: receipt.browser_version, now,
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const telemetry = [];
    let stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      recordTelemetry: async (caseId, event) => telemetry.push({ caseId, ...event }),
      now: () => now,
    });
    assert.equal(stored.entries.length, 7);
    await assertCaptureCompleteness(stored);
    await validateCaptureManifest({ manifest: stored, caseRoot: testRoot });
    for (const entry of stored.entries) {
      assert.match(entry.visual_phash, /^[a-f0-9]{64}$/);
      const bytes = await readFile(join(testRoot, entry.artifact_path));
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    }
    assert.deepEqual(telemetry.map(({ status }) => status), ['RUNNING', 'COMPLETED']);

    stored = await runCapturePipeline({
      manifestPath,
      caseRoot: testRoot,
      launchBrowser: async () => { throw new Error('matching rerun must reuse entries'); },
      recordTelemetry: async () => {},
      now: () => now,
    });
    assert.equal(stored.entries.length, 7);
    const leftovers = (await readdir(controlledTmp)).filter((name) => /^playwright_(?:chromiumdev_profile|artifacts)-/.test(name));
    assert.deepEqual(leftovers, [], 'Playwright profile/artifact temp must be cleaned');
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

if (s11Receipt) {
  await testS13BrowserPipeline(s11Receipt);
  console.log('S13 deterministic browser capture: PASS (T18-T20, T45, T48)');
}
