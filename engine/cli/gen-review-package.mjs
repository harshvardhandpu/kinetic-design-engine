#!/usr/bin/env node
/* KINETIC review-package generator.
 * Root-cause fix for the Phase-2 review-link defect: hrefs are DERIVED from the
 * runner state + real artifact paths (path.relative), never hand-written.
 * Usage: node engine/cli/gen-review-package.mjs --case <case-id>
 * Output: gym/runs/<case>/review-package.html  (links relative to the case dir,
 * so `cd gym/runs/<case> && python3 -m http.server 5500` serves it portably).
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const A = Object.fromEntries(args.reduce((a, c, i) => { if (c.startsWith('--')) a.push([c.slice(2), args[i + 1]]); return a; }, []));
if (!A.case) { console.error('usage: gen-review-package.mjs --case <case-id>'); process.exit(2); }

const caseDir = join(root, 'gym', 'runs', A.case);
const rec = JSON.parse(await readFile(join(caseDir, 'case.json'), 'utf8'));
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

const cards = [];
for (const [slot, s] of Object.entries(rec.slots)) {
  const artifact = join(caseDir, 'variants', slot.toLowerCase(), 'index.html');
  if (!await exists(artifact)) continue; // only link real artifacts
  const href = relative(caseDir, artifact); // derived, never hand-written
  const gates = Object.entries(s.gates || {}).map(([g, v]) =>
    `<span class="badge${v.result === 'pending-vision-or-human' ? ' pending' : ''}">${g}: ${v.result}</span>`).join('');
  const orig = s.gates?.originality?.rationale ? ` · ${s.gates.originality.rationale}` : '';
  cards.push(`  <div class="card">
    <h2>${slot} — ${s.mode}${s.deployable === false ? ' (fidelity study, not deployable)' : ''}</h2>
    <p class="dir">state: ${s.state} · attempt ${s.attempt}${orig}</p>
    <div class="badges">${gates}</div>
    <a class="open" href="${href}" target="_blank">Open ${slot} →</a>
  </div>`);
}
if (!cards.length) { console.error(`no variant artifacts found under ${caseDir}/variants`); process.exit(1); }

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${A.case} — Review Package</title>
<style>
body { font-family: system-ui, sans-serif; margin: 0; background: #f5f4f1; color: #1a1a1a; line-height: 1.5; }
header { padding: 2rem 2.5rem; border-bottom: 1px solid #ddd; }
h1 { font-size: 1.4rem; margin: 0 0 0.4rem; }
.meta { font-size: 0.85rem; color: #666; }
main { padding: 2rem 2.5rem; display: grid; gap: 1.5rem; }
.card { background: #fff; border: 1px solid #e2e0dc; border-radius: 10px; padding: 1.4rem 1.6rem; }
.card h2 { font-size: 1.05rem; margin: 0 0 0.3rem; }
.card .dir { font-size: 0.85rem; color: #555; margin-bottom: 0.8rem; }
.badges { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.badge { font-size: 0.7rem; padding: 0.2rem 0.6rem; border-radius: 999px; background: #e8f0e8; color: #2a5a2a; }
.badge.pending { background: #fdf3e0; color: #8a6116; }
a.open { display: inline-block; font-size: 0.85rem; color: #1a5fb4; }
.note { font-size: 0.8rem; color: #8a6116; background: #fdf3e0; padding: 0.8rem 1rem; border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Review Package — ${A.case}</h1>
  <p class="meta">Generated from runner state (gym/runs/${A.case}/case.json) · links derived from real artifact paths</p>
</header>
<main>
  <div class="note">⚠ Deterministic gates only. Design status is pending-vision-or-human until a human (or vision-capable reviewer) decides. Do not treat gate PASSes as design approval.</div>
${cards.join('\n')}
</main>
</body>
</html>
`;
await writeFile(join(caseDir, 'review-package.html'), html);
console.log(`wrote gym/runs/${A.case}/review-package.html (${cards.length} variant links)`);
