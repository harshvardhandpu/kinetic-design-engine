import assert from 'node:assert/strict';
import { statfs, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-chromium';

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

const receipt = await smoke();
await assert.rejects(smoke({ injectLaunchFailure: true }), /missing-chromium|executable/i);
await assert.rejects(statfs(runTmp), (error) => error.code === 'ENOENT');
console.log(`S11 Playwright boundary: PASS (T45, ${JSON.stringify(receipt)})`);
