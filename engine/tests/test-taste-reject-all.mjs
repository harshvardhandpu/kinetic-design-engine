#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const j = async (p) => JSON.parse(await readFile(join(root, p), 'utf8'));

const schema = await j('schemas/gym/taste-decision.schema.json');
assert.deepEqual(schema.properties.outcome.properties.result.enum, ['WINNER_SELECTED', 'REJECT_ALL']);

const d = await j('gym/taste/decisions/td-20260822-izanami1.json');
assert.equal(d.outcome.result, 'REJECT_ALL');
assert.equal(d.outcome.winner, null);
assert.equal(d.outcome.runner_up, null);
assert.deepEqual(d.outcome.rejected, ['V0', 'V1', 'V2', 'V3']);
assert.deepEqual(d.outcome.relative_preference.positive_candidates, ['V2', 'V3']);
assert.equal(d.outcome.relative_preference.ordered, false);
assert.equal(d.outcome.relative_preference.strength, 'weak');
assert.equal(d.outcome.quality_floor.passed, false);
assert.equal(d.outcome.quality_floor.human_perceived_quality_gap, 'substantial');
assert.equal(d.pairwise.length, 0, 'V2 and V3 must not be ranked');
assert.equal(d.reviewer, 'human-user');
assert.match(d.freeform, /None of them is particularly good/);

const batch = await j('gym/runs/case-fe653973ef/taste-decision-batch1.json');
assert.equal(batch.status, 'DECIDED');
assert.equal(batch.taste_decision_id, d.decision_id);
assert.equal(batch.taste_decision_path, 'gym/taste/decisions/td-20260822-izanami1.json');

const p = await j('gym/taste/profile.json');
assert.equal(p.evidence_summary.sample_count, 1);
assert.equal(p.evidence_summary.accepted_winners, 0);
assert.equal(p.evidence_summary.rejected_batches, 1);
assert.equal(p.evidence_summary.quality_floor_failure, true);
assert.deepEqual(p.evidence_summary.relative_positive_candidates, ['V2', 'V3']);
assert.equal(p.evidence_summary.confidence, 'very_low');
assert.deepEqual(p.cells, [], 'one rejected batch must not create attribute-level taste claims');

const run = await j('gym/runs/case-fe653973ef/case.json');
assert.equal(run.slots.V0.state, 'BUILT');
for (const v of ['V1', 'V2', 'V3']) assert.equal(run.slots[v].state, 'TECHNICAL_PASS');
for (const v of ['V0', 'V1', 'V2', 'V3']) {
  assert.equal(run.slots[v].gates.design.result, 'fail');
  assert.equal(run.slots[v].gates.design.producer, 'human');
}

const review = await readFile(join(root, 'gym/runs/case-fe653973ef/review-package.html'), 'utf8');
assert.equal((review.match(/design: fail/g) || []).length, 4);

const nk = await j('gym/knowledge/negative/nk-izanami-human-quality-floor-batch1.json');
assert.equal(nk.technical_gates_failed, false);
assert.equal(nk.quality_floor_failure, true);
assert.equal(nk.design_qualified, false);

console.log('TasteDecision REJECT_ALL semantics: PASS');
