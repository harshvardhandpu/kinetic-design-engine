#!/usr/bin/env node
/* Regression test: every href in every generated review-package.html must
 * resolve to an existing variant artifact (relative to the package's dir).
 * Guards the Phase-2 defect where hand-written hrefs pointed at v0/ instead
 * of variants/v0/. Run: node engine/tests/test-review-package-links.mjs
 */
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runsDir = join(root, 'gym', 'runs');
let failures = 0, checked = 0;

const cases = await readdir(runsDir).catch(() => []);
for (const c of cases) {
  const pkg = join(runsDir, c, 'review-package.html');
  let html;
  try { html = await readFile(pkg, 'utf8'); } catch { continue; } // no package for this case
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('http') && !h.startsWith('#'));
  for (const h of hrefs) {
    checked++;
    const target = resolve(dirname(pkg), h);
    const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
    if (!ok) { failures++; console.error(`FAIL ${c}: href="${h}" -> ${target} does not exist`); }
  }
  if (hrefs.length === 0) { failures++; console.error(`FAIL ${c}: review-package has no local hrefs`); }
}
console.log(`checked ${checked} hrefs across review packages; ${failures} failures`);
process.exit(failures ? 1 : 0);
