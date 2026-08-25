#!/usr/bin/env node
/* Regression test: every href in every generated review-package.html must
 * resolve to an existing artifact (relative to the package's dir).
 * Phase-2 packages keep the legacy card contract.
 * Phase-2.5 workbenches also prove T29/T44: IZANAMI baseline, V1/V2-only
 * controls, and no preselected outcomes.
 * Run: node engine/tests/test-review-package-links.mjs
 */
import assert from 'node:assert/strict';
import { readFile, stat, readdir, mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateReviewPackage, inspectReviewPackageHtml } from '../cli/gen-review-package.mjs';
import { assertReviewPackagePolicy } from '../runner/state-machine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const runsDir = join(root, 'gym', 'runs');
let failures = 0, checked = 0;

const cases = await readdir(runsDir).catch(() => []);
for (const c of cases) {
  const pkg = join(runsDir, c, 'review-package.html');
  let html;
  try { html = await readFile(pkg, 'utf8'); } catch { continue; }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('data:'));
  for (const h of hrefs) {
    checked++;
    const target = resolve(dirname(pkg), h);
    const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
    if (!ok) { failures++; console.error(`FAIL ${c}: href="${h}" -> ${target} does not exist`); }
  }
  if (hrefs.length === 0) { failures++; console.error(`FAIL ${c}: review-package has no local hrefs`); }

  // T29/T44 for any phase2.5 package already on disk.
  if (/data-kinetic-workbench=["']phase2\.5["']/.test(html)) {
    const inspection = inspectReviewPackageHtml(html);
    if (!inspection.ok) {
      failures++;
      console.error(`FAIL ${c}: phase2.5 workbench policy: ${inspection.issues.join('; ')}`);
    }
    const winnerValues = [...html.matchAll(/name=["']winner["'][^>]*value=["']([^"']+)["']/g)].map((m) => m[1]);
    if (winnerValues.some((value) => !['V1', 'V2'].includes(value))) {
      failures++;
      console.error(`FAIL ${c}: selectable controls must be V1/V2 only`);
    }
    if (!/IZANAMI/.test(html) || !/data-role=["']rejected-baseline["']/.test(html)) {
      failures++;
      console.error(`FAIL ${c}: missing IZANAMI rejected baseline`);
    }
    if (/\schecked(\s|>|=)/i.test(html) || /\sselected(\s|>|=)/i.test(html)) {
      failures++;
      console.error(`FAIL ${c}: preselected control found`);
    }
  }
}

// T29/T44 fixture generation against a temporary Phase-2.5 case.
const tempDir = await mkdtemp(join(root, 'gym', '.s19-review-'));
const prior = process.env.KINETIC_GYM_ROOT;
process.env.KINETIC_GYM_ROOT = tempDir;
try {
  const caseId = 'case-s19-workbench';
  const caseDir = join(tempDir, 'runs', caseId);
  await mkdir(join(caseDir, 'reports'), { recursive: true });
  await mkdir(join(caseDir, 'captures', 'v1', 'artifacts'), { recursive: true });
  await mkdir(join(caseDir, 'captures', 'v2', 'artifacts'), { recursive: true });
  await mkdir(join(caseDir, 'captures', 'v0', 'artifacts'), { recursive: true });
  await mkdir(join(caseDir, 'variants', 'v1'), { recursive: true });
  await mkdir(join(caseDir, 'variants', 'v2'), { recursive: true });
  await mkdir(join(caseDir, 'variants', 'v0'), { recursive: true });
  await writeFile(join(caseDir, 'variants', 'v0', 'index.html'), '<html><body>v0</body></html>');
  await writeFile(join(caseDir, 'variants', 'v1', 'index.html'), '<html><body>v1</body></html>');
  await writeFile(join(caseDir, 'variants', 'v2', 'index.html'), '<html><body>v2</body></html>');

  const sha = 'a'.repeat(64);
  for (const slot of ['v0', 'v1', 'v2']) {
    const bytes = Buffer.from(`s19-${slot}`);
    const { createHash } = await import('node:crypto');
    const digest = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(caseDir, 'captures', slot, 'artifacts', `${digest}.webp`), bytes);
    const manifest = {
      schema: 'kinetic/gym/capture-manifest@0.1',
      manifest_id: `cm-s19-${slot}`,
      case_id: caseId,
      playwright_version: '1.55.0',
      browser_version: 'fixture',
      specs: [{
        capture_id: `cap-${slot}`, subject_id: slot.toUpperCase() === 'V0' ? 'V0' : slot.toUpperCase(),
        attempt: 1, viewport: { name: 'desktop', width: 1440, height: 900, device_scale: 1, is_mobile: false, has_touch: false },
        capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', url: 'file:///x.html', trigger_action: 'goto',
        target_selector: null, checkpoint_ms: null, checkpoint_progress: null, reduced_motion: 'no-preference',
        build_sha256: sha,
      }],
      entries: [{
        capture_id: `cap-${slot}`, subject_id: slot.toUpperCase() === 'V0' ? 'V0' : slot.toUpperCase(),
        attempt: 1, viewport: { name: 'desktop', width: 1440, height: 900, device_scale: 1, is_mobile: false, has_touch: false },
        capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', url: 'file:///x.html', trigger_action: 'goto',
        target_selector: null, checkpoint_ms: null, checkpoint_progress: null, reduced_motion: 'no-preference',
        timestamp: '2026-08-22T00:00:00Z', playwright_version: '1.55.0', browser_version: 'fixture',
        artifact_path: `artifacts/${digest}.webp`, sha256: digest, visual_phash: 'c'.repeat(64), readiness: 'READY', notes: [],
      }],
      failures: [], created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z',
    };
    // subject_id for v0 should be V0
    if (slot === 'v0') {
      manifest.specs[0].subject_id = 'V0';
      manifest.entries[0].subject_id = 'V0';
    } else {
      manifest.specs[0].subject_id = slot.toUpperCase();
      manifest.entries[0].subject_id = slot.toUpperCase();
    }
    await writeFile(join(caseDir, 'captures', slot, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeFile(join(caseDir, 'reports', `design-evaluation-${slot}.json`), JSON.stringify({
      schema: 'kinetic/gym/design-quality-evaluation@0.1',
      evaluation_id: `dqe-s19-${slot}`,
      case_id: caseId,
      variant_id: slot.toUpperCase(),
    }, null, 2));
  }
  await writeFile(join(caseDir, 'reports', 'fidelity-v0.json'), JSON.stringify({ schema: 'kinetic/gym/fidelity-report@0.1', case_id: caseId, variant_id: 'V0' }, null, 2));
  await writeFile(join(caseDir, 'reports', 'source-to-output-loss.json'), JSON.stringify({ schema: 'kinetic/gym/source-to-output-loss@0.1', case_id: caseId }, null, 2));

  const slotRecord = (slot) => ({
    schema: 'kinetic/gym/variant-run@0.2',
    run_id: `run-${caseId}-${slot.toLowerCase()}`,
    case_id: caseId,
    slot,
    mode: slot === 'V0' ? 'fidelity-study' : 'original',
    state: 'DESIGN_EVALUATED',
    attempt: 1,
    deployable: slot !== 'V0',
    original_work: slot !== 'V0',
    technically_qualified: true,
    design_qualified: null,
    acceptable_for_further_taste_learning: null,
    refs: {
      variant_brief: null,
      retrieval_receipt: null,
      prebuild_review: null,
      build_receipt: null,
      technical_evaluation: null,
      capture_manifest: `runs/${caseId}/captures/${slot.toLowerCase()}/manifest.json`,
      design_evaluation: `runs/${caseId}/reports/design-evaluation-${slot.toLowerCase()}.json`,
      fidelity_report: `runs/${caseId}/reports/fidelity-v0.json`,
    },
    attempts: [],
    blocked_condition: null,
    timestamps: { DESIGN_EVALUATED: '2026-08-22T00:00:00Z' },
  });
  const caseRun = {
    schema: 'kinetic/gym/case-run@0.2',
    case_id: caseId,
    slots: { V0: slotRecord('V0'), V1: slotRecord('V1'), V2: slotRecord('V2') },
    reports: {
      fidelity: `runs/${caseId}/reports/fidelity-v0.json`,
      source_to_output_loss: `runs/${caseId}/reports/source-to-output-loss.json`,
      review_package: null,
    },
    review_state: 'NOT_READY',
    taste_decision_ref: null,
    blocked_condition: null,
    history: [],
    created_at: '2026-08-22T00:00:00Z',
    updated_at: '2026-08-22T00:00:00Z',
  };
  await writeFile(join(caseDir, 'case.json'), JSON.stringify(caseRun, null, 2));

  const generated = await generateReviewPackage({ caseId, gymRoot: tempDir, repoGym: join(root, 'gym') });
  assert.equal(generated.phase25, true);
  const inspection = inspectReviewPackageHtml(generated.html);
  assert.equal(inspection.ok, true, inspection.issues.join('; '));
  assert.doesNotThrow(() => assertReviewPackagePolicy({
    caseRun,
    html: generated.html,
    packageRef: generated.ref,
  }));

  // T44: no defaults / baseline present
  assert.match(generated.html, /IZANAMI/);
  assert.match(generated.html, /data-role="rejected-baseline"/);
  assert.doesNotMatch(generated.html, /\schecked(\s|>|=)/i);
  assert.doesNotMatch(generated.html, /\sselected(\s|>|=)/i);
  assert.match(generated.html, /id="export-decision"[^>]*\bdisabled\b/);

  // T29: only V1/V2 controls + all hrefs resolve
  const winnerValues = [...generated.html.matchAll(/name="winner"[^>]*value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(winnerValues)].sort(), ['V1', 'V2']);
  const hrefs = [...generated.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
    .filter((h) => !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('data:'));
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) {
    checked++;
    const target = resolve(caseDir, href);
    const ok = await stat(target).then((s) => s.isFile()).catch(() => false);
    assert.equal(ok, true, `unresolved href ${href}`);
  }

  // Legacy Phase-2 package still generates and keeps prior behavior.
  const legacyDir = join(tempDir, 'runs', 'case-legacy-review');
  await mkdir(join(legacyDir, 'variants', 'v1'), { recursive: true });
  await writeFile(join(legacyDir, 'variants', 'v1', 'index.html'), '<html><body>legacy</body></html>');
  await writeFile(join(legacyDir, 'case.json'), JSON.stringify({
    schema: 'kinetic/gym/variant-run@0.1',
    case_id: 'case-legacy-review',
    slots: { V1: { mode: 'original', deployable: true, state: 'BUILT', attempt: 1, gates: { design: { result: 'fail' } } } },
  }, null, 2));
  const legacy = await generateReviewPackage({ caseId: 'case-legacy-review', gymRoot: tempDir, repoGym: join(root, 'gym') });
  assert.equal(legacy.phase25, false);
  assert.doesNotMatch(legacy.html, /data-kinetic-workbench="phase2.5"/);
  assert.match(legacy.html, /Open V1/);
} catch (error) {
  failures++;
  console.error(`FAIL T29/T44 fixture: ${error.stack || error.message}`);
} finally {
  if (prior == null) delete process.env.KINETIC_GYM_ROOT;
  else process.env.KINETIC_GYM_ROOT = prior;
  await rm(tempDir, { recursive: true, force: true });
}

// Existing IZANAMI package remains link-valid and untouched by generation policy.
const izanami = await readFile(join(root, 'gym/runs/case-fe653973ef/review-package.html'), 'utf8');
assert.equal((izanami.match(/design: fail/g) || []).length, 4);

console.log(`checked ${checked} hrefs across review packages; ${failures} failures`);
process.exit(failures ? 1 : 0);
