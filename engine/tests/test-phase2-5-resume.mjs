#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyHumanReview, applyTransition, assertTransition, nextState, prepareRetry, TransitionError } from '../runner/state-machine.mjs';
import { appendArtifactReceipt, findIdempotentReceipt, hashFile, readCase, readTasteDecision, withCaseLock, writeCaseAtomic, writeTasteDecisionExclusive } from '../runner/store.mjs';
import { validateFile } from '../core/schema-validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempGym = join(root, `.s04-${randomUUID()}`);
process.env.KINETIC_GYM_ROOT = tempGym;
const now = '2026-08-22T00:00:00.000Z';
const sha = 'a'.repeat(64);

function slot(state = 'PLANNED', overrides = {}) {
  return {
    schema: 'kinetic/gym/variant-run@0.2', run_id: 'run-case-fixture-v0', case_id: 'case-fixture', slot: 'V0', mode: 'fidelity-study', state, attempt: 1,
    deployable: false, original_work: false, technically_qualified: false, design_qualified: null, acceptable_for_further_taste_learning: null,
    refs: { variant_brief: null, retrieval_receipt: null, prebuild_review: null, build_receipt: null, technical_evaluation: null, capture_manifest: null, design_evaluation: null, fidelity_report: null },
    attempts: [], blocked_condition: null, timestamps: { [state]: now }, ...overrides,
  };
}
function caseRun(state = 'PLANNED', overrides = {}) {
  return {
    schema: 'kinetic/gym/case-run@0.2', case_id: 'case-fixture', slots: { V0: slot(state, overrides) }, reports: { fidelity: null, source_to_output_loss: null, review_package: null },
    review_state: 'NOT_READY', taste_decision_ref: null, blocked_condition: null, history: [], created_at: now, updated_at: now,
  };
}
const denied = (fn, code = 'KINETIC_TRANSITION_DENIED') => assert.throws(fn, (error) => error instanceof TransitionError && error.code === code);

try {
  // T37: only adjacent forward states; state never infers merit flags.
  const chain = ['PLANNED', 'BRIEF_VALIDATED', 'RETRIEVAL_PROVEN', 'PREBUILD_APPROVED', 'BUILDING', 'BUILT', 'TECHNICAL_EVALUATED'];
  let record = caseRun();
  for (const toState of chain.slice(1)) {
    const beforeQualification = {
      technically_qualified: record.slots.V0.technically_qualified,
      design_qualified: record.slots.V0.design_qualified,
      acceptable_for_further_taste_learning: record.slots.V0.acceptable_for_further_taste_learning,
    };
    assert.equal(nextState(record.slots.V0, record), toState);
    const artifactRefs = toState === 'BRIEF_VALIDATED'
      ? { variant_brief: 'planning/v0/variant-brief.json', brief_validated: true }
      : toState === 'RETRIEVAL_PROVEN'
        ? { retrieval_receipt: 'planning/v0/retrieval-receipt.json', retrieval_proven: true }
        : toState === 'PREBUILD_APPROVED'
          ? { prebuild_review: 'planning/v0/prebuild-review.json', prebuild_approved: true }
          : toState === 'BUILDING'
            ? { brief_hash_unchanged: true, retrieval_hash_unchanged: true, prebuild_hash_unchanged: true }
            : {};
    record = applyTransition({ caseRun: record, slot: 'V0', toState, artifactRefs, now });
    assert.deepEqual({
      technically_qualified: record.slots.V0.technically_qualified,
      design_qualified: record.slots.V0.design_qualified,
      acceptable_for_further_taste_learning: record.slots.V0.acceptable_for_further_taste_learning,
    }, beforeQualification);
  }
  denied(() => assertTransition({ caseRun: caseRun(), slot: 'V0', toState: 'BUILDING', artifactRefs: {} }));
  denied(() => assertTransition({ caseRun: caseRun('BUILT'), slot: 'V0', toState: 'BUILDING', artifactRefs: {} }));
  denied(() => assertTransition({ caseRun: caseRun('HUMAN_REVIEWED'), slot: 'V0', toState: 'PLANNED', artifactRefs: {} }));
  denied(() => assertTransition({ caseRun: caseRun('REJECTED_FINAL'), slot: 'V0', toState: 'PLANNED', artifactRefs: {} }));
  denied(() => assertTransition({ caseRun: caseRun('CANCELLED'), slot: 'V0', toState: 'PLANNED', artifactRefs: {} }));
  denied(() => assertTransition({ caseRun: caseRun('TECHNICAL_EVALUATED'), slot: 'V0', toState: 'VISUAL_CAPTURED', artifactRefs: {} }), 'KINETIC_TECHNICAL_QUALIFICATION_REQUIRED');
  assertTransition({ caseRun: caseRun('TECHNICAL_EVALUATED', { technically_qualified: true }), slot: 'V0', toState: 'VISUAL_CAPTURED', artifactRefs: {} });
  denied(() => applyTransition({ caseRun: caseRun('REVIEW_READY'), slot: 'V0', toState: 'HUMAN_REVIEWED', artifactRefs: { design_qualified: true }, now }), 'KINETIC_V0_QUALIFICATION_FORBIDDEN');

  const retry = prepareRetry({ caseRun: caseRun('TECHNICAL_EVALUATED'), slot: 'V0', fromState: 'TECHNICAL_EVALUATED', diagnosisRef: 'reports/diagnosis.json', now });
  assert.equal(retry.slots.V0.state, 'BUILDING');
  assert.equal(retry.slots.V0.attempt, 2);
  assert.equal(retry.slots.V0.attempts.length, 1);
  denied(() => prepareRetry({ caseRun: caseRun('DESIGN_EVALUATED', { attempt: 3 }), slot: 'V0', fromState: 'DESIGN_EVALUATED', diagnosisRef: 'reports/diagnosis.json', now }), 'KINETIC_RETRY_EXHAUSTED');

  // Store atomicity, hashes, receipts, and in-memory-only legacy normalization.
  await writeCaseAtomic('case-fixture', caseRun());
  const loaded = await readCase('case-fixture');
  assert.equal(loaded.runVersion, 'phase2.5');
  assert.equal(loaded.legacy, false);
  assert.equal(loaded.record.slots.V0.state, 'PLANNED');
  const casePath = join(tempGym, 'runs', 'case-fixture', 'case.json');
  assert.equal(await hashFile(casePath), createHash('sha256').update(await readFile(casePath)).digest('hex'));
  assert.ok(!(await readdir(dirname(casePath))).some((name) => name.includes('.tmp-')));
  const receipt = await appendArtifactReceipt('case-fixture', { idempotency_key: 'fixture-key', artifact_sha256: sha, at: now });
  assert.equal((await findIdempotentReceipt('case-fixture', 'fixture-key')).artifact_sha256, sha);
  assert.deepEqual(await appendArtifactReceipt('case-fixture', receipt), receipt);
  await assert.rejects(appendArtifactReceipt('case-fixture', { ...receipt, artifact_sha256: 'b'.repeat(64) }), (error) => error.code === 'KINETIC_ARTIFACT_MISMATCH');

  const legacyCase = 'case-legacy-read';
  const legacyPath = join(tempGym, 'runs', legacyCase, 'case.json');
  const legacyRecord = { schema: 'kinetic/gym/variant-run@0.1', case_id: legacyCase, slots: { V0: { run_id: 'run-legacy-v0', slot: 'V0', mode: 'fidelity-study', state: 'BRIEFED', attempt: 1, deployable: false, gates: {}, timestamps: { BRIEFED: now } } }, history: [] };
  await mkdir(dirname(legacyPath), { recursive: true });
  await writeFile(legacyPath, JSON.stringify(legacyRecord, null, 2));
  const legacyHash = await hashFile(legacyPath);
  const legacyRead = await readCase(legacyCase);
  assert.equal(legacyRead.runVersion, 'phase2');
  assert.equal(legacyRead.legacy, true);
  assert.equal(legacyRead.record.slots.V0.technically_qualified, false);
  assert.equal(await hashFile(legacyPath), legacyHash, 'legacy read must not write migration data');

  // T38: one concurrent holder; stale takeover is atomic and recorded.
  let releaseFirst;
  let acquiredFirst;
  const firstAcquired = new Promise((resolve) => { acquiredFirst = resolve; });
  const holdFirst = new Promise((resolve) => { releaseFirst = resolve; });
  const first = withCaseLock('case-lock', 'first', async () => { acquiredFirst(); await holdFirst; return 'first'; });
  await firstAcquired;
  await assert.rejects(withCaseLock('case-lock', 'second', async () => 'second'), (error) => error.code === 'KINETIC_CASE_LOCKED');
  releaseFirst();
  assert.equal(await first, 'first');

  const staleDir = join(tempGym, 'jobs', 'locks', 'case-stale.lock');
  await mkdir(staleDir, { recursive: true });
  await writeFile(join(staleDir, 'owner.json'), JSON.stringify({ pid: 999999, nonce: 'dead-nonce', operation: 'dead', acquired_at: '2020-01-01T00:00:00.000Z', heartbeat_at: '2020-01-01T00:00:00.000Z', ttl_seconds: 1 }));
  const takeover = await withCaseLock('case-stale', 'takeover', async (owner) => owner.takeover_of);
  assert.equal(takeover.nonce, 'dead-nonce');
  assert.equal(takeover.pid, 999999);
  assert.ok(!(await readdir(join(tempGym, 'jobs', 'locks'))).some((name) => name.startsWith('case-stale.lock.stale-')));

  // T47: decision files are create-exclusive; corrections supersede without reopening terminal state.
  const humanDecision = {
    schema: 'kinetic/gym/taste-decision@0.2', decision_id: 'td-20260822-review1',
    context: { case_id: 'case-review', batch_id: 'batch-review', surface: 'portfolio', goal: 'quality' },
    candidates: ['V1', 'V2'], outcome: { result: 'REJECT_ALL', relative_preference: 'V1', winner: null, candidate_decisions: {
      V1: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'below floor' },
      V2: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'below floor' },
    } }, reason_tags: [], freeform: null, reviewer: 'human-fixture', supersedes: null, timestamp: now,
  };
  const firstDecisionRef = await writeTasteDecisionExclusive(humanDecision);
  assert.equal(firstDecisionRef, 'taste/decisions/td-20260822-review1.json');
  assert.deepEqual(await readTasteDecision(humanDecision.decision_id), humanDecision);
  await assert.rejects(writeTasteDecisionExclusive(humanDecision), (error) => error.code === 'KINETIC_DECISION_EXISTS');
  const reviewCase = {
    schema: 'kinetic/gym/case-run@0.2', case_id: 'case-review',
    slots: Object.fromEntries(['V1', 'V2'].map((name) => [name, { ...slot('REVIEW_READY', {
      run_id: `run-case-review-${name.toLowerCase()}`, case_id: 'case-review', slot: name, mode: 'original', deployable: true, original_work: true,
      technically_qualified: true,
    }) }])), reports: { fidelity: 'fidelity', source_to_output_loss: 'loss', review_package: 'package' },
    review_state: 'REVIEW_READY', taste_decision_ref: null, blocked_condition: null, history: [], created_at: now, updated_at: now,
  };
  const terminalReview = applyHumanReview({ caseRun: reviewCase, decision: humanDecision, decisionRef: firstDecisionRef, now });
  assert.equal(terminalReview.slots.V1.state, 'HUMAN_REVIEWED');
  assert.throws(() => applyHumanReview({ caseRun: terminalReview, decision: { ...humanDecision, decision_id: 'td-20260822-invalid', supersedes: null }, decisionRef: 'taste/decisions/invalid.json', now }), (error) => error.code === 'KINETIC_HUMAN_REVIEW_INVALID');
  const correction = structuredClone(humanDecision);
  correction.decision_id = 'td-20260822-review2';
  correction.supersedes = humanDecision.decision_id;
  correction.outcome.result = 'PARTIAL_ACCEPTANCE';
  correction.outcome.candidate_decisions.V1.acceptable_for_further_taste_learning = true;
  const corrected = applyHumanReview({ caseRun: terminalReview, decision: correction, decisionRef: 'taste/decisions/td-20260822-review2.json', currentDecisionId: humanDecision.decision_id, now });
  assert.equal(corrected.slots.V1.state, 'HUMAN_REVIEWED');
  assert.equal(corrected.slots.V1.design_qualified, false);
  assert.equal(corrected.slots.V1.acceptable_for_further_taste_learning, true);
  assert.equal(corrected.history.at(-1).event, 'human-review-corrected');

  // T32: legacy CLI remains; Phase-2.5 gets an explicit additive path and no arbitrary record state.
  const run = (args) => spawnSync(process.execPath, [join(root, 'engine', 'runner', 'run.mjs'), ...args], { cwd: root, env: { ...process.env, KINETIC_GYM_ROOT: tempGym }, encoding: 'utf8' });
  let cli = run(['init-case', '--case', 'case-legacy-cli', '--slots', 'V0,V1', '--job', 'fixture']);
  assert.equal(cli.status, 0, cli.stderr);
  cli = run(['record', '--case', 'case-legacy-cli', '--slot', 'V1', '--state', 'BUILT']);
  assert.equal(cli.status, 0, cli.stderr);
  const legacyCliRecord = JSON.parse(await readFile(join(tempGym, 'runs', 'case-legacy-cli', 'case.json')));
  assert.equal(legacyCliRecord.schema, 'kinetic/gym/variant-run@0.1');
  assert.equal(legacyCliRecord.slots.V1.state, 'BUILT');

  cli = run(['init-case', '--case', 'case-phase25-cli', '--run-version', 'phase2.5']);
  assert.equal(cli.status, 0, cli.stderr);
  const phase25Path = join(tempGym, 'runs', 'case-phase25-cli', 'case.json');
  const phase25Record = JSON.parse(await readFile(phase25Path));
  assert.equal(phase25Record.schema, 'kinetic/gym/case-run@0.2');
  assert.deepEqual(Object.keys(phase25Record.slots), ['V0']);
  assert.equal(phase25Record.slots.V0.state, 'PLANNED');
  const phaseValidation = await validateFile({ artifactPath: phase25Path, schemaPath: join(root, 'schemas', 'gym', 'case-run.schema.json') });
  assert.equal(phaseValidation.valid, true, JSON.stringify(phaseValidation.errors));
  cli = run(['record', '--case', 'case-phase25-cli', '--slot', 'V0', '--state', 'BUILT']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_PHASE25_RECORD_FORBIDDEN/);

  const cliReviewCase = structuredClone(reviewCase);
  cliReviewCase.case_id = 'case-cli-review';
  for (const [name, value] of Object.entries(cliReviewCase.slots)) {
    value.case_id = cliReviewCase.case_id;
    value.run_id = `run-${cliReviewCase.case_id}-${name.toLowerCase()}`;
  }
  await writeCaseAtomic(cliReviewCase.case_id, cliReviewCase);
  const cliDecision = structuredClone(humanDecision);
  cliDecision.decision_id = 'td-20260822-cli1';
  cliDecision.context.case_id = cliReviewCase.case_id;
  const cliDecisionInput = join(tempGym, 'cli-decision.json');
  await writeFile(cliDecisionInput, JSON.stringify(cliDecision));
  cli = run(['record-human-review', '--decision', cliDecisionInput]);
  assert.equal(cli.status, 0, cli.stderr);
  let cliReviewed = JSON.parse(await readFile(join(tempGym, 'runs', cliReviewCase.case_id, 'case.json')));
  assert.equal(cliReviewed.review_state, 'HUMAN_REVIEWED');
  assert.equal(cliReviewed.taste_decision_ref, 'taste/decisions/td-20260822-cli1.json');
  assert.equal(cliReviewed.slots.V1.design_qualified, false);
  assert.equal(cliReviewed.slots.V1.acceptable_for_further_taste_learning, false);
  const firstCliDecisionHash = await hashFile(join(tempGym, cliReviewed.taste_decision_ref));
  await assert.rejects(readFile(join(tempGym, 'taste', 'profile.json')), (error) => error.code === 'ENOENT');
  cli = run(['record-human-review', '--decision', cliDecisionInput]);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_DECISION_EXISTS|KINETIC_HUMAN_REVIEW_INVALID/);

  const cliCorrection = structuredClone(cliDecision);
  cliCorrection.decision_id = 'td-20260822-cli2';
  cliCorrection.supersedes = cliDecision.decision_id;
  cliCorrection.outcome.result = 'PARTIAL_ACCEPTANCE';
  cliCorrection.outcome.candidate_decisions.V2.acceptable_for_further_taste_learning = true;
  const cliCorrectionInput = join(tempGym, 'cli-correction.json');
  await writeFile(cliCorrectionInput, JSON.stringify(cliCorrection));
  cli = run(['record-human-review', '--decision', cliCorrectionInput]);
  assert.equal(cli.status, 0, cli.stderr);
  cliReviewed = JSON.parse(await readFile(join(tempGym, 'runs', cliReviewCase.case_id, 'case.json')));
  assert.equal(cliReviewed.taste_decision_ref, 'taste/decisions/td-20260822-cli2.json');
  assert.equal(cliReviewed.slots.V2.state, 'HUMAN_REVIEWED');
  assert.equal(cliReviewed.slots.V2.acceptable_for_further_taste_learning, true);
  assert.equal(await hashFile(join(tempGym, 'taste', 'decisions', 'td-20260822-cli1.json')), firstCliDecisionHash);
} finally {
  await rm(tempGym, { recursive: true, force: true });
}

console.log('S04/S17 lifecycle/store: PASS (T32, T37, T38, T47)');
