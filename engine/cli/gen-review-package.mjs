#!/usr/bin/env node
/* KINETIC review-package generator.
 * Root-cause fix: hrefs are DERIVED from runner state + real artifact paths
 * (path.relative), never hand-written. Phase-2 packages keep the legacy card UI.
 * Phase-2.5 packages emit a neutral workbench with rejected IZANAMI baseline,
 * reference/V0 context, V1/V2-only controls, and no default outcomes.
 * Usage: node engine/cli/gen-review-package.mjs --case <case-id>
 */
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultGym = process.env.KINETIC_GYM_ROOT || join(root, 'gym');
const IZANAMI_CASE = 'case-fe653973ef';
const IZANAMI_DECISION = 'taste/decisions/td-20260822-izanami1.json';

const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function rel(fromDir, targetPath) {
  return relative(fromDir, targetPath).split('\\').join('/');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function collectCaptureLinks(caseDir, slot, captureRef, gymRoot) {
  if (typeof captureRef !== 'string') return [];
  const manifestPath = join(gymRoot, captureRef);
  if (!await exists(manifestPath)) return [];
  const manifest = await readJson(manifestPath);
  const links = [];
  for (const entry of manifest.entries ?? []) {
    if (!entry?.artifact_path || !entry?.capture_id) continue;
    if (entry.subject_id !== slot && entry.subject_id !== 'reference') continue;
    const absolute = resolve(dirname(manifestPath), entry.artifact_path);
    if (!await exists(absolute)) continue;
    links.push({
      label: `${entry.subject_id}:${entry.capture_id}`,
      href: rel(caseDir, absolute),
      capture_id: entry.capture_id,
    });
  }
  return links;
}

async function collectReferenceCaptureLinks(caseDir) {
  const observationPath = join(caseDir, 'reference', 'reference-observation.json');
  if (!await exists(observationPath)) return [];
  const observation = await readJson(observationPath);
  const links = [];
  for (const capture of observation.captures ?? []) {
    if (!capture?.artifact_path || !capture?.capture_id) continue;
    const absolute = resolve(caseDir, capture.artifact_path);
    if (!absolute.startsWith(`${caseDir}/`) || !await exists(absolute)) continue;
    links.push({
      label: `reference:${capture.capture_id}`,
      href: rel(caseDir, absolute),
      capture_id: capture.capture_id,
    });
  }
  return links;
}

async function collectReportLink(caseDir, ref, gymRoot, label) {
  if (typeof ref !== 'string') return null;
  const absolute = join(gymRoot, ref);
  if (!await exists(absolute)) return null;
  return { label, href: rel(caseDir, absolute) };
}

async function ensureIzanamiBaseline(gymRoot, repoGym) {
  const copies = [
    IZANAMI_DECISION,
    `runs/${IZANAMI_CASE}/review-package.html`,
    `runs/${IZANAMI_CASE}/case.json`,
    ...['v0', 'v1', 'v2', 'v3'].map((slot) => `runs/${IZANAMI_CASE}/variants/${slot}/index.html`),
  ];
  for (const relPath of copies) {
    const dest = join(gymRoot, relPath);
    if (await exists(dest)) continue;
    const src = join(repoGym, relPath);
    if (!await exists(src)) continue;
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, await readFile(src));
  }
}

async function loadIzanamiBaseline(caseDir, gymRoot, repoGym) {
  await ensureIzanamiBaseline(gymRoot, repoGym);
  const decisionPath = join(gymRoot, IZANAMI_DECISION);
  if (!await exists(decisionPath)) {
    throw Object.assign(new Error('IZANAMI rejected baseline decision is required under the active gym root'), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  }
  const decision = await readJson(decisionPath);
  const links = [];
  const candidates = [
    ['decision', join(gymRoot, IZANAMI_DECISION)],
    ['baseline-package', join(gymRoot, 'runs', IZANAMI_CASE, 'review-package.html')],
    ...['v0', 'v1', 'v2', 'v3'].map((slot) => [`baseline-${slot}`, join(gymRoot, 'runs', IZANAMI_CASE, 'variants', slot, 'index.html')]),
  ];
  for (const [label, absolute] of candidates) {
    if (!await exists(absolute)) continue;
    links.push({ label, href: rel(caseDir, absolute) });
  }
  return {
    title: 'PHASE-2 IZANAMI — REJECTED BASELINE',
    immutable: true,
    decision_id: decision?.decision_id ?? 'td-20260822-izanami1',
    result: decision?.outcome?.result ?? 'REJECT_ALL',
    freeform: decision?.freeform ?? 'None of them is particularly good. V2 and V3 are okay.',
    rejected: decision?.outcome?.rejected ?? ['V0', 'V1', 'V2', 'V3'],
    links,
  };
}

function renderLinks(links) {
  if (!links.length) return '<p class="dir">no local artifacts</p>';
  return `<ul class="links">${links.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('')}</ul>`;
}

function renderLegacy(caseId, cards) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(caseId)} — Review Package</title>
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
.badge.fail { background: #fbe6e6; color: #8a1f1f; }
a.open { display: inline-block; font-size: 0.85rem; color: #1a5fb4; }
.note { font-size: 0.8rem; color: #8a6116; background: #fdf3e0; padding: 0.8rem 1rem; border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Review Package — ${esc(caseId)}</h1>
  <p class="meta">Generated from runner state (gym/runs/${esc(caseId)}/case.json) · links derived from real artifact paths</p>
</header>
<main>
  <div class="note">⚠ Deterministic PASS does not imply design approval. Human-review status is shown separately on each candidate.</div>
${cards.join('\n')}
</main>
</body>
</html>
`;
}

async function generateLegacyPackage(caseId, rec, caseDir) {
  const cards = [];
  for (const [slot, s] of Object.entries(rec.slots)) {
    const artifact = join(caseDir, 'variants', slot.toLowerCase(), 'index.html');
    if (!await exists(artifact)) continue;
    const href = rel(caseDir, artifact);
    const gates = Object.entries(s.gates || {}).map(([g, v]) => {
      const cls = v.result === 'pending-vision-or-human' ? ' pending' : v.result === 'fail' ? ' fail' : '';
      return `<span class="badge${cls}">${esc(g)}: ${esc(v.result)}</span>`;
    }).join('');
    const orig = s.gates?.originality?.rationale ? ` · ${esc(s.gates.originality.rationale)}` : '';
    cards.push(`  <div class="card">
    <h2>${esc(slot)} — ${esc(s.mode)}${s.deployable === false ? ' (fidelity study, not deployable)' : ''}</h2>
    <p class="dir">state: ${esc(s.state)} · attempt ${esc(s.attempt)}${orig}</p>
    <div class="badges">${gates}</div>
    <a class="open" href="${esc(href)}" target="_blank">Open ${esc(slot)} →</a>
  </div>`);
  }
  if (!cards.length) throw Object.assign(new Error(`no variant artifacts found under ${caseDir}/variants`), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  return renderLegacy(caseId, cards);
}

async function generatePhase25Package(caseId, rec, caseDir, gymRoot, repoGym) {
  const baseline = await loadIzanamiBaseline(caseDir, gymRoot, repoGym);
  if (!baseline.links.some((link) => link.label === 'decision')) {
    throw Object.assign(new Error('IZANAMI rejected baseline decision is required'), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  }

  const columns = [];
  const subjects = [
    { key: 'reference', title: 'REFERENCE', role: 'context', slot: null },
    { key: 'V0', title: 'V0 — FIDELITY STUDY', role: 'context', slot: 'V0' },
    { key: 'V1', title: 'V1 — ORIGINAL', role: 'original', slot: 'V1' },
    { key: 'V2', title: 'V2 — ORIGINAL', role: 'original', slot: 'V2' },
  ];

  for (const subject of subjects) {
    const record = subject.slot ? rec.slots?.[subject.slot] : null;
    const links = [];
    if (subject.key === 'reference') {
      links.push(...await collectReferenceCaptureLinks(caseDir));
    } else if (record) {
      links.push(...await collectCaptureLinks(caseDir, subject.slot, record.refs?.capture_manifest, gymRoot));
      const design = await collectReportLink(caseDir, record.refs?.design_evaluation, gymRoot, `${subject.slot}-design-evaluation`);
      if (design) links.push(design);
      const variant = join(caseDir, 'variants', subject.slot.toLowerCase(), 'index.html');
      if (await exists(variant)) links.push({ label: `${subject.slot}-variant`, href: rel(caseDir, variant) });
      if (subject.slot === 'V0') {
        const fidelity = await collectReportLink(caseDir, rec.reports?.fidelity ?? record.refs?.fidelity_report, gymRoot, 'fidelity-report');
        if (fidelity) links.push(fidelity);
      }
    }
    const tech = record?.technically_qualified === true ? 'technical:pass' : record ? 'technical:pending-or-fail' : 'context-only';
    const designStatus = record?.design_qualified == null ? 'design:null-awaiting-human' : `design:${record.design_qualified}`;
    columns.push(`<article class="column" data-role="${esc(subject.role)}" data-subject="${esc(subject.key)}">
  <div class="eyebrow">${esc(subject.role === 'context' ? 'context only · not selectable' : 'original candidate')}</div>
  <h2>${esc(subject.title)}</h2>
  <p class="dir">state: ${esc(record?.state ?? 'n/a')} · ${esc(tech)} · ${esc(designStatus)}</p>
  ${renderLinks(links)}
</article>`);
  }

  const lossRef = rec.reports?.source_to_output_loss ?? `runs/${caseId}/reports/source-to-output-loss.json`;
  const loss = await collectReportLink(caseDir, lossRef, gymRoot, 'source-to-output-loss');
  const lossBlock = loss ? `<p class="meta">Loss report: <a href="${esc(loss.href)}">${esc(loss.label)}</a></p>` : '<p class="meta">Loss report: pending</p>';

  return `<!doctype html>
<html lang="en" data-kinetic-workbench="phase2.5" data-case-id="${esc(caseId)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(caseId)} — Phase 2.5 Review Workbench</title>
<style>
body{margin:0;background:#f4f0e7;color:#171714;font:15px/1.5 system-ui,sans-serif}
header,main{padding:28px 5vw}header{border-bottom:1px solid #d7d0c3;display:flex;justify-content:space-between;gap:24px}
h1{font-size:clamp(28px,4vw,48px);margin:8px 0 0;font-weight:600}.eyebrow,.meta{font:11px/1.2 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6e6a60}
.notice{padding:14px 18px;border-left:3px solid #956716;background:#ede5d3;margin:18px 0}
.baseline,.compare,.decision{display:grid;gap:14px;margin:24px 0}.compare{grid-template-columns:repeat(4,minmax(0,1fr))}
.column,.baseline{border-top:1px solid #171714;padding-top:12px;background:#fff;border:1px solid #d7d0c3;border-radius:10px;padding:14px}
.column h2,.baseline h2{font-size:18px;margin:8px 0}.dir,.links{font-size:13px;color:#444}.links{padding-left:18px}
.choice,.field{border:1px solid #d7d0c3;padding:12px;background:#faf8f3}.choices,.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
button{border:0;background:#171714;color:#f4f0e7;padding:12px 18px;border-radius:999px}
button:disabled{opacity:.45;cursor:not-allowed}textarea,input[type=text]{width:100%;min-height:40px;border:1px solid #d7d0c3;background:#fff;padding:8px;font:inherit}
@media(max-width:900px){.compare,.choices,.fields{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <div><div class="eyebrow">Phase 2.5 · neutral production workbench</div><h1>Calibration review</h1></div>
  <div class="meta">No candidate is pre-selected<br>Technical pass ≠ design pass<br>Export does not write the repository</div>
</header>
<main>
  <div class="notice"><strong>Review instruction:</strong> IZANAMI is an immutable rejected baseline. Reference and V0 are context only. Only V1/V2 may be selected. Absolute floor and learning acceptance are independent fields.</div>
  <section class="baseline" data-role="rejected-baseline" data-immutable="true">
    <div class="eyebrow">historical · rejected · immutable</div>
    <h2>${esc(baseline.title)}</h2>
    <p class="dir">decision: ${esc(baseline.decision_id)} · result: ${esc(baseline.result)} · rejected: ${esc((baseline.rejected || []).join(', '))}</p>
    <p>${esc(baseline.freeform)}</p>
    ${renderLinks(baseline.links)}
  </section>
  <section class="compare" aria-label="Reference and candidate comparison">
${columns.join('\n')}
  </section>
  ${lossBlock}
  <section class="decision" data-role="human-decision">
    <div class="eyebrow">Human decision · no defaults</div>
    <h2>Independent review fields</h2>
    <div class="fields">
      <label class="field">Relative preference
        <div class="choices">
          <label><input type="radio" name="relative_preference" value="V1"> V1</label>
          <label><input type="radio" name="relative_preference" value="V2"> V2</label>
          <label><input type="radio" name="relative_preference" value="tie"> tie</label>
          <label><input type="radio" name="relative_preference" value="neither"> neither</label>
        </div>
      </label>
      <label class="field">Overall outcome
        <div class="choices">
          <label><input type="radio" name="result" value="WINNER_SELECTED"> WINNER_SELECTED</label>
          <label><input type="radio" name="result" value="PARTIAL_ACCEPTANCE"> PARTIAL_ACCEPTANCE</label>
          <label><input type="radio" name="result" value="REJECT_ALL"> REJECT_ALL</label>
        </div>
      </label>
      <label class="field">V1 quality floor
        <div class="choices">
          <label><input type="radio" name="v1_floor" value="true"> yes</label>
          <label><input type="radio" name="v1_floor" value="false"> no</label>
        </div>
      </label>
      <label class="field">V2 quality floor
        <div class="choices">
          <label><input type="radio" name="v2_floor" value="true"> yes</label>
          <label><input type="radio" name="v2_floor" value="false"> no</label>
        </div>
      </label>
      <label class="field">V1 acceptable for further taste learning
        <div class="choices">
          <label><input type="radio" name="v1_learn" value="true"> true</label>
          <label><input type="radio" name="v1_learn" value="false"> false</label>
        </div>
      </label>
      <label class="field">V2 acceptable for further taste learning
        <div class="choices">
          <label><input type="radio" name="v2_learn" value="true"> true</label>
          <label><input type="radio" name="v2_learn" value="false"> false</label>
        </div>
      </label>
      <label class="field">Winner (only if WINNER_SELECTED)
        <div class="choices">
          <label><input type="radio" name="winner" value="V1"> V1</label>
          <label><input type="radio" name="winner" value="V2"> V2</label>
        </div>
      </label>
      <label class="field">Reviewer id<input type="text" id="reviewer" name="reviewer" autocomplete="off"></label>
      <label class="field">V1 reason<input type="text" id="v1_reason" name="v1_reason" autocomplete="off"></label>
      <label class="field">V2 reason<input type="text" id="v2_reason" name="v2_reason" autocomplete="off"></label>
      <label class="field">Freeform<textarea id="freeform" name="freeform"></textarea></label>
      <label class="field">Decision id<input type="text" id="decision_id" name="decision_id" placeholder="td-YYYYMMDD-slug" autocomplete="off"></label>
      <label class="field">Batch id<input type="text" id="batch_id" name="batch_id" autocomplete="off"></label>
      <label class="field">Surface<input type="text" id="surface" name="surface" autocomplete="off"></label>
      <label class="field">Goal<input type="text" id="goal" name="goal" autocomplete="off"></label>
    </div>
    <p class="meta">Export stays disabled until every required independent field is answered. Exported JSON is TasteDecision @0.2 for local download only.</p>
    <button type="button" id="export-decision" disabled>Export TasteDecision JSON</button>
  </section>
</main>
<script>
(() => {
  const requiredRadios = ['relative_preference','result','v1_floor','v2_floor','v1_learn','v2_learn'];
  const requiredText = ['reviewer','v1_reason','v2_reason','decision_id','batch_id','surface','goal'];
  const button = document.getElementById('export-decision');
  const val = (name) => {
    const picked = document.querySelector('input[name="' + name + '"]:checked');
    return picked ? picked.value : '';
  };
  const text = (id) => (document.getElementById(id)?.value || '').trim();
  const complete = () => {
    if (requiredRadios.some((name) => !val(name))) return false;
    if (requiredText.some((id) => !text(id))) return false;
    if (val('result') === 'WINNER_SELECTED' && !val('winner')) return false;
    return true;
  };
  const refresh = () => { button.disabled = !complete(); };
  document.querySelectorAll('input,textarea').forEach((node) => node.addEventListener('input', refresh));
  document.querySelectorAll('input').forEach((node) => node.addEventListener('change', refresh));
  button.addEventListener('click', () => {
    if (!complete()) return;
    const result = val('result');
    const winner = result === 'WINNER_SELECTED' ? val('winner') : null;
    const decision = {
      schema: 'kinetic/gym/taste-decision@0.2',
      decision_id: text('decision_id'),
      context: { case_id: ${JSON.stringify(caseId)}, batch_id: text('batch_id'), surface: text('surface'), goal: text('goal') },
      candidates: ['V1','V2'],
      outcome: {
        result,
        relative_preference: val('relative_preference'),
        winner,
        candidate_decisions: {
          V1: { quality_floor_passed: val('v1_floor') === 'true', acceptable_for_further_taste_learning: val('v1_learn') === 'true', reason: text('v1_reason') },
          V2: { quality_floor_passed: val('v2_floor') === 'true', acceptable_for_further_taste_learning: val('v2_learn') === 'true', reason: text('v2_reason') }
        }
      },
      reason_tags: [],
      freeform: text('freeform') || null,
      reviewer: text('reviewer'),
      supersedes: null,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(decision, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decision.decision_id + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  refresh();
})();
</script>
</body>
</html>
`;
}

export async function generateReviewPackage({
  caseId,
  gymRoot = defaultGym,
  repoGym = join(root, 'gym'),
} = {}) {
  if (typeof caseId !== 'string' || !caseId) {
    throw Object.assign(new Error('generateReviewPackage requires caseId'), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  }
  const caseDir = join(gymRoot, 'runs', caseId);
  const casePath = join(caseDir, 'case.json');
  if (!await exists(casePath)) {
    throw Object.assign(new Error(`missing case.json for ${caseId}`), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  }
  const rec = await readJson(casePath);
  const html = rec.schema === 'kinetic/gym/case-run@0.2'
    ? await generatePhase25Package(caseId, rec, caseDir, gymRoot, repoGym)
    : await generateLegacyPackage(caseId, rec, caseDir);
  await mkdir(caseDir, { recursive: true });
  const outputPath = join(caseDir, 'review-package.html');
  await writeFile(outputPath, html);
  return {
    html,
    outputPath,
    ref: `runs/${caseId}/review-package.html`,
    sha256: createHash('sha256').update(html).digest('hex'),
    phase25: rec.schema === 'kinetic/gym/case-run@0.2',
  };
}

export function inspectReviewPackageHtml(html) {
  const issues = [];
  if (typeof html !== 'string' || html.length === 0) return { ok: false, issues: ['empty package'] };
  const phase25 = /data-kinetic-workbench=["']phase2\.5["']/.test(html);
  if (phase25) {
    if (!/PHASE-2 IZANAMI|IZANAMI/.test(html) || !/rejected baseline|data-role=["']rejected-baseline["']/.test(html)) {
      issues.push('missing immutable IZANAMI rejected baseline');
    }
    if (/\schecked(\s|>|=)/i.test(html) || /\sselected(\s|>|=)/i.test(html)) issues.push('preselected control state');
    if (/design_qualified\s*[:=]\s*true/.test(html)) issues.push('package must not set design qualification');
    const winnerValues = [...html.matchAll(/name=["']winner["'][^>]*value=["']([^"']+)["']/g)].map((m) => m[1]);
    if (winnerValues.some((value) => !['V1', 'V2'].includes(value))) issues.push('winner controls must be V1/V2 only');
    if ([...html.matchAll(/name=["']relative_preference["'][^>]*value=["']([^"']+)["']/g)].some((m) => !['V1', 'V2', 'tie', 'neither'].includes(m[1]))) {
      issues.push('relative preference controls invalid');
    }
    if (!/id=["']export-decision["'][^>]*\bdisabled\b/.test(html) && !/<button[^>]*\bdisabled\b[^>]*id=["']export-decision["']/.test(html)) {
      issues.push('export control must start disabled');
    }
    if (!/data-role=["']context["']/.test(html) || !/not selectable/.test(html)) issues.push('reference/V0 must be context-only');
    if (/name=["']winner["'][^>]*value=["']V0["']/.test(html) || /name=["']relative_preference["'][^>]*value=["']V0["']/.test(html)) {
      issues.push('V0 must not be selectable');
    }
  }
  return { ok: issues.length === 0, phase25, issues };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  const A = Object.fromEntries(args.reduce((a, c, i) => { if (c.startsWith('--')) a.push([c.slice(2), args[i + 1]]); return a; }, []));
  if (!A.case) { console.error('usage: gen-review-package.mjs --case <case-id>'); process.exit(2); }
  try {
    const result = await generateReviewPackage({ caseId: A.case });
    console.log(`wrote ${result.ref} (${result.phase25 ? 'phase2.5 workbench' : 'legacy package'}; sha256=${result.sha256.slice(0, 12)})`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exit(1);
  }
}
