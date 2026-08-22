#!/usr/bin/env node
/* KINETIC runner — learning-loop state machine with checkpoint/resume.
 * Owns CurriculumJob + VariantRun records under gym/. The agent executes the
 * browser/build steps and reports back; the runner never loses state.
 *
 * Commands:
 *   init-job  --job <id> --type <t> --cases c1,c2 [--input json]
 *   init-case --case <id> --slots V0,V1,V2,V3 --job <id>
 *   next      --case <id>                 → next pending work item (resume point)
 *   record    --case <id> --slot V1 --state BUILT [--diagnosis json] [--artifact path]
 *   receipt   --case <id> --slot V1 --model m --provider p [--extra json]  (Amendment F)
 *   status    [--case <id>] [--job <id>]
 *   gate      --case <id> --slot V1 --gate technical --result pass --producer objective [--rationale s]
 *
 * Idempotency: (case, slot, state) transitions are append-only; re-recording a
 * terminal state is a no-op. Locks: gym/jobs/locks/<case>.lock with pid+heartbeat.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { applyTransition, nextState } from './state-machine.mjs';
import { readCase as readStoredCase, withCaseLock, writeCaseAtomic } from './store.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const gym = process.env.KINETIC_GYM_ROOT || join(root, 'gym');
const runsDir = join(gym, 'runs');
const jobsDir = join(gym, 'jobs');
const locksDir = join(jobsDir, 'locks');
await mkdir(locksDir, { recursive: true });

const args = process.argv.slice(2);
const cmd = args[0];
const A = Object.fromEntries(args.slice(1).reduce((a, c, i, arr) => {
  if (c.startsWith('--')) a.push([c.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));

const j = async (p) => JSON.parse(await readFile(p, 'utf8').catch(() => 'null'));
const w = async (p, o) => { await mkdir(dirname(p), { recursive: true }); await writeFile(p, JSON.stringify(o, null, 2)); };
const now = () => new Date().toISOString();

const ORDER = ['BRIEFED', 'GENERATING', 'BUILT', 'TECHNICAL_PASS', 'RESPONSIVE_PASS', 'A11Y_PASS', 'PERFORMANCE_PASS', 'DESIGN_EVALUATED', 'QUALIFIED'];
const TERMINAL = new Set(['QUALIFIED', 'REJECTED', 'REJECTED_FINAL', 'EMPTY']);

function gitCommit() { try { return execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { return null; } } // security: fixed command string, no input interpolation
function kineticVersion() { try { return JSON.parse(require_fs(join(root, 'engine', 'registry', 'registry.json'))).version; } catch { return 'unknown'; } }
import { readFileSync } from 'node:fs';
function require_fs(p) { return readFileSync(p, 'utf8'); }

async function lock(caseId) {
  // Advisory lock: sequential CLI invocations are separate processes, so a live
  // lock with a DEAD holder pid is reclaimable (logged takeover).
  const lf = join(locksDir, `${caseId}.lock`);
  const existing = await j(lf);
  const holderAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  if (existing && existing.holder !== process.pid && holderAlive(existing.holder) && Date.now() - new Date(existing.heartbeat_at).getTime() < 60_000) {
    console.error(`LOCKED by live pid ${existing.holder} (heartbeat ${existing.heartbeat_at})`); process.exit(3);
  }
  const takeover = existing && existing.holder !== process.pid;
  await w(lf, { holder: process.pid, acquired_at: now(), heartbeat_at: now(), ttl_seconds: 300, takeover_of: takeover ? existing.holder : undefined });
}

const casePath = (id) => join(runsDir, id, 'case.json');

if (cmd === 'init-case' && A['run-version'] === 'phase2.5') {
  const timestamp = now();
  const caseId = A.case;
  const rec = {
    schema: 'kinetic/gym/case-run@0.2',
    case_id: caseId,
    slots: {
      V0: {
        schema: 'kinetic/gym/variant-run@0.2', run_id: `run-${caseId}-v0`, case_id: caseId, slot: 'V0', mode: 'fidelity-study', state: 'PLANNED', attempt: 1,
        deployable: false, original_work: false, technically_qualified: false, design_qualified: null, acceptable_for_further_taste_learning: null,
        refs: { variant_brief: null, retrieval_receipt: null, prebuild_review: null, build_receipt: null, technical_evaluation: null, capture_manifest: null, design_evaluation: null, fidelity_report: null },
        attempts: [], blocked_condition: null, timestamps: { PLANNED: timestamp },
      },
    },
    reports: { fidelity: null, source_to_output_loss: null, review_package: null },
    review_state: 'NOT_READY', taste_decision_ref: null, blocked_condition: null,
    history: [{ event_id: `init-${caseId}`, event: 'phase2.5-init-v0', slot: 'V0', artifact_ref: null, timestamp }],
    created_at: timestamp, updated_at: timestamp,
  };
  try {
    await withCaseLock(caseId, 'phase2.5-init', async () => writeCaseAtomic(caseId, rec));
    console.log(`case ${caseId}: Phase-2.5 V0 initialized`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
} else if (cmd === 'advance') {
  try {
    await withCaseLock(A.case, `advance-${A.slot}-${A.to}`, async () => {
      const loaded = await readStoredCase(A.case);
      if (loaded.legacy) throw Object.assign(new Error('advance is Phase-2.5 only'), { code: 'KINETIC_PHASE25_REQUIRED' });
      const artifactRefs = A.refs && A.refs !== true ? JSON.parse(A.refs) : {};
      const updated = applyTransition({ caseRun: loaded.record, slot: A.slot, toState: A.to, artifactRefs, now: now() });
      await writeCaseAtomic(A.case, updated);
    });
    console.log(`${A.case}/${A.slot} -> ${A.to}`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
} else if (cmd === 'init-job') {
  const job = {
    schema: 'kinetic/gym/curriculum-job@0.1',
    job_id: A.job, type: A.type, status: 'running', schedule_ref: null,
    input: A.input && A.input !== true ? JSON.parse(A.input) : {},
    checkpoint: null,
    work_items: String(A.cases || '').split(',').filter(Boolean).map((c) => ({ id: c, state: 'pending', attempts: 0, last_error: null, error_class: null, receipt_ref: null })),
    lock: null, budget: { token_class: null, max_candidates: 15, wall_clock_seconds: null },
    provider_notes: [], started_at: now(), finished_at: null,
  };
  await w(join(jobsDir, `${A.job}.json`), job);
  console.log(`job ${A.job} initialized (${job.work_items.length} cases)`);
} else if (cmd === 'init-case') {
  await lock(A.case);
  const slots = String(A.slots || 'V0,V1,V2,V3').split(',');
  const rec = {
    schema: 'kinetic/gym/variant-run@0.1',
    case_id: A.case, job_id: A.job || null, created_at: now(),
    slots: Object.fromEntries(slots.map((s) => [s, {
      run_id: `run-${A.case}-${s.toLowerCase()}`, slot: s,
      mode: s === 'V0' ? 'fidelity-study' : (s === 'V8' || s === 'V9') ? 'experimental' : 'original',
      deployable: s !== 'V0', experimental: s === 'V8' || s === 'V9',
      state: 'BRIEFED', attempt: 1, gates: {}, timestamps: { BRIEFED: now() },
      brief: null, diagnosis: null, receipt: null, artifacts: [],
    }])),
    history: [{ at: now(), event: 'init', slots }],
  };
  await w(casePath(A.case), rec);
  console.log(`case ${A.case}: slots ${slots.join(',')}`);
} else if (cmd === 'next') {
  const rec = await j(casePath(A.case));
  if (!rec) { console.error('no such case'); process.exit(1); }
  if (rec.schema === 'kinetic/gym/case-run@0.2') {
    for (const [slot, value] of Object.entries(rec.slots)) {
      const nextStage = nextState(value, rec);
      if (nextStage) {
        console.log(JSON.stringify({ case_id: A.case, slot, state: value.state, next_stage: nextStage, attempt: value.attempt, mode: value.mode }, null, 2));
        process.exit(0);
      }
    }
    console.log(JSON.stringify({ case_id: A.case, done: true, summary: Object.fromEntries(Object.entries(rec.slots).map(([key, value]) => [key, value.state])) }, null, 2));
  } else {
    // find first non-terminal slot, then its next stage
    for (const [slot, s] of Object.entries(rec.slots)) {
      if (TERMINAL.has(s.state)) continue;
      const idx = ORDER.indexOf(s.state);
      const nextStage = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
      console.log(JSON.stringify({ case_id: A.case, slot, state: s.state, next_stage: nextStage, attempt: s.attempt, mode: s.mode }, null, 2));
      process.exit(0);
    }
    console.log(JSON.stringify({ case_id: A.case, done: true, summary: Object.fromEntries(Object.entries(rec.slots).map(([k, s]) => [k, s.state])) }, null, 2));
  }
} else if (cmd === 'record') {
  const before = await j(casePath(A.case));
  if (before?.schema === 'kinetic/gym/case-run@0.2') {
    console.error('KINETIC_PHASE25_RECORD_FORBIDDEN: use guarded Phase-2.5 commands');
    process.exit(4);
  }
  await lock(A.case);
  const rec = await j(casePath(A.case));
  const s = rec.slots[A.slot];
  if (!s) { console.error('no such slot'); process.exit(1); }
  if (TERMINAL.has(s.state) && A.state !== s.state) { console.log(`NO-OP: ${A.slot} already terminal (${s.state})`); process.exit(0); }
  s.state = A.state;
  s.timestamps[A.state] = now();
  if (A.diagnosis && A.diagnosis !== true) s.diagnosis = JSON.parse(A.diagnosis);
  if (A.artifact && A.artifact !== true) s.artifacts.push(A.artifact);
  if (A.brief && A.brief !== true) s.brief = JSON.parse(A.brief);
  if (String(A.state).startsWith('REJECTED')) { s.attempt += 1; }
  rec.history.push({ at: now(), event: `${A.slot} -> ${A.state}`, attempt: s.attempt });
  await w(casePath(A.case), rec);
  console.log(`${A.case}/${A.slot} -> ${A.state} (attempt ${s.attempt})`);
} else if (cmd === 'gate') {
  await lock(A.case);
  const rec = await j(casePath(A.case));
  const s = rec.slots[A.slot];
  s.gates[A.gate] = { result: A.result, producer: A.producer || 'objective', rationale: typeof A.rationale === 'string' ? A.rationale : null, at: now() };
  rec.history.push({ at: now(), event: `${A.slot} gate ${A.gate}=${A.result}` });
  await w(casePath(A.case), rec);
  console.log(`${A.case}/${A.slot} gate ${A.gate} = ${A.result} (${A.producer || 'objective'})`);
} else if (cmd === 'receipt') {
  // Amendment F reproducibility receipt
  await lock(A.case);
  const rec = await j(casePath(A.case));
  const s = rec.slots[A.slot];
  let installed = null;
  try { installed = JSON.parse(require_fs(join(String(A.target || ''), '.kinetic', 'installed.json'))); } catch {}
  s.receipt = {
    schema: 'kinetic/reproducibility-receipt@0.1',
    kinetic_version: kineticVersion(),
    repo_commit: gitCommit(),
    model: A.model || 'unrecorded', provider: A.provider || 'unrecorded',
    prompt_skill_version: A.skill_version || 'phase2-v1',
    design_cases_retrieved: A.cases_retrieved && A.cases_retrieved !== true ? String(A.cases_retrieved).split(',') : [],
    tool_versions: { node: process.version, browser: A.browser || 'hermes-browser', viewport: A.viewport || 'desktop' },
    registry_entries: installed ? installed.items.map((i) => i.id) : [],
    recipe_versions: installed ? Object.fromEntries(installed.items.filter((i) => i.kind === 'recipe').map((i) => [i.id, i.version])) : {},
    primitive_versions: installed ? Object.fromEntries(installed.items.filter((i) => i.kind === 'primitive').map((i) => [i.id, i.version])) : {},
    dependency_lock_hash: A.lock_hash || null,
    random_seed: A.seed ?? null,
    evaluator_version: 'gates.browser@0.1',
    generated_at: now(),
    extra: A.extra && A.extra !== true ? JSON.parse(A.extra) : null,
  };
  rec.history.push({ at: now(), event: `${A.slot} receipt recorded` });
  await w(casePath(A.case), rec);
  console.log(`receipt recorded for ${A.case}/${A.slot}`);
} else if (cmd === 'status') {
  if (A.case) {
    const rec = await j(casePath(A.case));
    if (rec.schema === 'kinetic/gym/case-run@0.2') {
      console.log(JSON.stringify({ case: A.case, run_version: 'phase2.5', slots: Object.fromEntries(Object.entries(rec.slots).map(([key, value]) => [key, { state: value.state, attempt: value.attempt, technically_qualified: value.technically_qualified, design_qualified: value.design_qualified, acceptable_for_further_taste_learning: value.acceptable_for_further_taste_learning }])) }, null, 2));
    } else {
      console.log(JSON.stringify({ case: A.case, slots: Object.fromEntries(Object.entries(rec.slots).map(([k, s]) => [k, { state: s.state, attempt: s.attempt, gates: Object.fromEntries(Object.entries(s.gates).map(([g, v]) => [g, v.result])) }])) }, null, 2));
    }
  } else {
    const files = await readdir(jobsDir).catch(() => []);
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const job = await j(join(jobsDir, f));
      console.log(`${job.job_id} [${job.type}] ${job.status} — items: ${job.work_items.map((i) => `${i.id}:${i.state}`).join(', ')}`);
    }
  }
} else {
  console.error('commands: init-job | init-case [--run-version phase2.5] | advance | next | record | gate | receipt | status');
  process.exit(2);
}
