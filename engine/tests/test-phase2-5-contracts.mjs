#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateFile, validateValue } from '../core/schema-validate.mjs';
import { hashFile, readTelemetry, recordStageTelemetry } from '../runner/store.mjs';
import { applyBatchReviewReady, applyHumanReview, applyTransition, assertFidelityPolicy, assertReviewPackagePolicy, assertSourceToOutputLossReport, assertTransition, assertVariantBriefPolicy, TransitionError } from '../runner/state-machine.mjs';
import { retrieveKnowledge } from '../knowledge/retrieval.mjs';
import { searchVault } from '../knowledge/obsidian-adapter.mjs';
import { generateMirror } from '../cli/gen-obsidian-mirror.mjs';
import { reviewBrief } from '../planning/prebuild-review.mjs';
import * as sourceRegistry from '../knowledge/source-registry.mjs';
import { compareOriginality } from '../evaluator/originality-compare.mjs';
import { createVisionCritic, createVisionRequest, validateDesignQualityEvaluation } from '../evaluator/vision-critic.mjs';
import { validateMotionTokens } from '../evaluator/motion-token-validate.mjs';
import { capturePlan } from '../cli/capture.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaFiles = [
  'schemas/gym/case-run.schema.json',
  'schemas/gym/variant-brief.schema.json',
  'schemas/gym/retrieval-receipt.schema.json',
  'schemas/gym/prebuild-review.schema.json',
  'schemas/gym/fidelity-report.schema.json',
  'schemas/gym/capture-manifest.schema.json',
  'schemas/gym/design-quality-evaluation.schema.json',
  'schemas/gym/source-to-output-loss-report.schema.json',
  'schemas/gym/execution-telemetry.schema.json',
  'schemas/motion-tokens.schema.json',
  'schemas/gym/variant-run.schema.json',
  'schemas/gym/taste-decision.schema.json',
];

const allowed = new Set([
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'default', 'examples',
  'type', 'required', 'properties', 'additionalProperties', 'enum', 'const',
  'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'items', 'minItems',
  'maxItems', 'uniqueItems', 'allOf', 'if', 'then', 'format',
]);

function inspectSchema(schema, at = '#') {
  assert.equal(typeof schema, 'object', `${at} must be a schema object`);
  assert.ok(schema && !Array.isArray(schema), `${at} must be a schema object`);
  for (const key of Object.keys(schema)) assert.ok(allowed.has(key), `${at}: unsupported keyword ${key}`);
  for (const [name, child] of Object.entries(schema.properties ?? {})) inspectSchema(child, `${at}/properties/${name}`);
  for (const [name, child] of Object.entries(schema.$defs ?? {})) inspectSchema(child, `${at}/$defs/${name}`);
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') inspectSchema(schema.additionalProperties, `${at}/additionalProperties`);
  if (schema.items && typeof schema.items === 'object') inspectSchema(schema.items, `${at}/items`);
  for (const [index, child] of (schema.allOf ?? []).entries()) inspectSchema(child, `${at}/allOf/${index}`);
  if (schema.if) inspectSchema(schema.if, `${at}/if`);
  if (schema.then) inspectSchema(schema.then, `${at}/then`);
}

const parsed = new Map();
for (const path of schemaFiles) {
  const schema = JSON.parse(await readFile(join(root, path), 'utf8'));
  inspectSchema(schema);
  parsed.set(path, schema);
}

const ids = [...parsed.values()].map((schema) => schema.$id);
assert.ok(ids.every(Boolean), 'every schema requires $id');
assert.equal(new Set(ids).size, ids.length, 'schema $ids must be unique');

const variant = parsed.get('schemas/gym/variant-run.schema.json');
assert.equal(variant.properties.schema.const, 'kinetic/gym/variant-run@0.1');
assert.equal(variant.$defs.phase25.properties.schema.const, 'kinetic/gym/variant-run@0.2');
assert.deepEqual(variant.$defs.phase25.properties.state.enum, [
  'PLANNED', 'BRIEF_VALIDATED', 'RETRIEVAL_PROVEN', 'PREBUILD_APPROVED', 'BUILDING',
  'BUILT', 'TECHNICAL_EVALUATED', 'VISUAL_CAPTURED', 'DESIGN_EVALUATED',
  'REVIEW_READY', 'HUMAN_REVIEWED', 'REJECTED_FINAL', 'CANCELLED',
]);
assert.deepEqual(
  variant.$defs.phase25.required.filter((key) => ['technically_qualified', 'design_qualified', 'acceptable_for_further_taste_learning'].includes(key)),
  ['technically_qualified', 'design_qualified', 'acceptable_for_further_taste_learning'],
);

const taste = parsed.get('schemas/gym/taste-decision.schema.json');
assert.equal(taste.properties.schema.const, 'kinetic/gym/taste-decision@0.1');
assert.deepEqual(taste.properties.outcome.properties.result.enum, ['WINNER_SELECTED', 'REJECT_ALL']);
assert.equal(taste.$defs.phase25.properties.schema.const, 'kinetic/gym/taste-decision@0.2');
assert.deepEqual(taste.$defs.phase25.properties.outcome.properties.result.enum, ['WINNER_SELECTED', 'PARTIAL_ACCEPTANCE', 'REJECT_ALL']);

const caseRunSchema = parsed.get('schemas/gym/case-run.schema.json');
assert.equal(caseRunSchema.properties.schema.const, 'kinetic/gym/case-run@0.2');
assert.equal(caseRunSchema.properties.slots.additionalProperties.$ref, 'variant-run.schema.json#/$defs/phase25');

const valid = (value, schema, schemaPath = join(root, 'schemas', 'gym', 'inline.schema.json')) => {
  const result = validateValue({ value, schema, schemaPath });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  return result;
};
const invalid = (value, schema, code = 'KINETIC_SCHEMA_INVALID', schemaPath = join(root, 'schemas', 'gym', 'inline.schema.json')) => {
  const result = validateValue({ value, schema, schemaPath });
  assert.equal(result.valid, false, 'expected validation failure');
  assert.ok(result.errors.some((error) => error.code === code), JSON.stringify(result.errors));
  return result;
};

const RUBRIC_DIMENSIONS = [
  'composition', 'typography', 'art_direction', 'depth', 'motion', 'interaction',
  'scroll_story', 'originality', 'cohesion', 'surface_fit',
];
const viewportFixture = { name: 'desktop', width: 1440, height: 900, device_scale: 1, is_mobile: false, has_touch: false };
const captureSpecFixture = (captureId, subjectId, url) => ({
  capture_id: captureId, subject_id: subjectId, attempt: 1, viewport: viewportFixture,
  capture_mode: 'STATIC_CAPTURE_STABLE', state: 'initial', url, trigger_action: 'goto',
  target_selector: null, checkpoint_ms: null, checkpoint_progress: null,
  reduced_motion: 'no-preference', build_sha256: 'f'.repeat(64),
});
const captureEntryFixture = (spec, sha256) => {
  const { build_sha256: _specOnlyBuildHash, ...entry } = spec;
  return {
    ...entry, timestamp: '2026-08-22T00:00:00Z', playwright_version: '1.55.0', browser_version: 'fixture-chromium',
    artifact_path: `captures/artifacts/${sha256}.webp`, sha256, visual_phash: 'c'.repeat(64),
    readiness: 'READY', notes: [],
  };
};
const captureManifestFixture = (caseId = 'case-fixture', variantId = 'V1') => {
  const specs = [
    captureSpecFixture('cap-reference', 'reference', 'file:///reference.html'),
    captureSpecFixture('cap-candidate', variantId, 'file:///candidate.html'),
  ];
  return {
    schema: 'kinetic/gym/capture-manifest@0.1', manifest_id: `cm-${caseId.slice(5)}`,
    case_id: caseId, playwright_version: '1.55.0', browser_version: 'fixture-chromium', specs,
    entries: [captureEntryFixture(specs[0], 'a'.repeat(64)), captureEntryFixture(specs[1], 'b'.repeat(64))],
    failures: [], created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z',
  };
};
const rubricDimensionFixture = (producer = 'ai-critic', evaluated = true) => ({
  status: evaluated ? 'ACCEPTABLE' : 'NOT_EVALUATED',
  observations: evaluated ? ['Evidence supports the dimension assessment.'] : [],
  strengths: [], failures: [], severity: 'none', confidence: evaluated ? 0.8 : null,
  evidence_capture_ids: evaluated ? ['cap-candidate'] : [], producer,
});
const designEvaluationFixture = ({
  caseId = 'case-fixture', variantId = 'V1', producer = 'ai-critic', visionReceipt = null,
  captureManifestRef = `runs/${caseId}/captures/manifest.json`,
  briefRef = `runs/${caseId}/planning/${variantId.toLowerCase()}/variant-brief.json`,
  provenanceRefs = [`runs/${caseId}/planning/${variantId.toLowerCase()}/retrieval-receipt.json`],
} = {}) => {
  const humanGate = producer === 'human';
  return {
    schema: 'kinetic/gym/design-quality-evaluation@0.1', evaluation_id: `dqe-${caseId.slice(5)}-${variantId.toLowerCase()}`,
    case_id: caseId, variant_id: variantId, rubric_version: 'design-rubric@0.1', producer,
    capture_manifest_ref: captureManifestRef, brief_ref: briefRef, provenance_refs: provenanceRefs,
    vision_receipt: visionReceipt,
    dimensions: Object.fromEntries(RUBRIC_DIMENSIONS.map((dimension) => [dimension, rubricDimensionFixture(producer, !humanGate)])),
    limitations: humanGate ? ['Awaiting explicit human visual evaluation.'] : [],
    advisory_recommendation: humanGate ? 'HUMAN_VISUAL_GATE' : 'ADVANCE_TO_HUMAN',
    created_at: '2026-08-22T00:00:00Z',
  };
};

// CV01 annotations and identity.
valid('x', { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'x', title: 't', description: 'd', default: 'x', examples: ['x'], type: 'string' });
invalid('x', { title: 1, type: 'string' }, 'KINETIC_SCHEMA_MALFORMED');

// CV02 scalar and union types; integer excludes fractions.
for (const [type, value] of [['null', null], ['boolean', true], ['object', {}], ['array', []], ['number', 1.5], ['integer', 1], ['string', 'x']]) valid(value, { type });
valid(null, { type: ['string', 'null'] });
invalid(1.5, { type: 'integer' });

// CV03 nested object, required, and both additionalProperties forms.
const nestedObject = { type: 'object', required: ['child'], properties: { child: { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false } }, additionalProperties: { type: 'number' } };
valid({ child: { name: 'ok' }, score: 1 }, nestedObject);
invalid({ child: { name: 'ok', extra: true } }, nestedObject);
invalid({}, nestedObject);

// CV04 structural enum/const equality.
valid({ x: [1] }, { const: { x: [1] } });
valid([1, { x: true }], { enum: [[1, { x: true }]] });
invalid({ x: [2] }, { const: { x: [1] } });

// CV05 string limits and pattern.
valid('abc', { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' });
invalid('A', { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' });

// CV06 inclusive numeric bounds.
valid(0, { type: 'number', minimum: 0, maximum: 1 });
valid(1, { type: 'number', minimum: 0, maximum: 1 });
invalid(2, { type: 'number', minimum: 0, maximum: 1 });

// CV07 homogeneous items, array bounds, and structural uniqueness.
valid([{ x: 1 }, { x: 2 }], { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { type: 'object', required: ['x'], properties: { x: { type: 'integer' } } } });
invalid([{ x: 1 }, { x: 1 }], { type: 'array', uniqueItems: true, items: { type: 'object' } });

// CV08 local refs and JSON Pointer escapes.
valid('ok', { $defs: { 'a/b~c': { type: 'string', const: 'ok' } }, $ref: '#/$defs/a~1b~0c' });

const tempDir = await mkdtemp(join(root, 'schemas', 'gym', '.s02-contracts-'));
const priorGymRoot = process.env.KINETIC_GYM_ROOT;
process.env.KINETIC_GYM_ROOT = tempDir;
try {
  // CV09 relative external ref.
  const externalSchema = join(tempDir, 'external.schema.json');
  const mainSchema = join(tempDir, 'main.schema.json');
  await writeFile(externalSchema, JSON.stringify({ type: 'object', required: ['ok'], properties: { ok: { const: true } } }));
  await writeFile(mainSchema, JSON.stringify({ $ref: 'external.schema.json' }));
  valid({ ok: true }, JSON.parse(await readFile(mainSchema, 'utf8')), mainSchema);

  // CV10 forbidden network, absolute, and traversal refs.
  invalid({}, { $ref: 'https://example.com/schema.json' }, 'KINETIC_SCHEMA_REF_FORBIDDEN', mainSchema);
  invalid({}, { $ref: externalSchema }, 'KINETIC_SCHEMA_REF_FORBIDDEN', mainSchema);
  invalid({}, { $ref: '../../../outside.schema.json' }, 'KINETIC_SCHEMA_REF_FORBIDDEN', mainSchema);

  // CV11 allOf.
  valid('abc', { allOf: [{ type: 'string' }, { minLength: 3 }] });
  invalid('a', { allOf: [{ type: 'string' }, { minLength: 3 }] });

  // CV12 paired if/then.
  const conditional = { type: 'object', properties: { kind: { type: 'string' }, flag: { type: 'boolean' } }, if: { required: ['kind'], properties: { kind: { const: 'strict' } } }, then: { required: ['flag'], properties: { flag: { const: true } } } };
  valid({ kind: 'loose' }, conditional);
  valid({ kind: 'strict', flag: true }, conditional);
  invalid({ kind: 'strict' }, conditional);
  invalid({}, { if: { type: 'object' } }, 'KINETIC_SCHEMA_MALFORMED');

  // CV13 strict formats.
  valid('2026-08-22', { type: 'string', format: 'date' });
  invalid('2026-02-30', { type: 'string', format: 'date' });
  valid('2026-08-22T12:34:56Z', { type: 'string', format: 'date-time' });
  invalid('2026-08-22 12:34:56', { type: 'string', format: 'date-time' });
  valid('https://example.com/x', { type: 'string', format: 'uri' });
  invalid('/relative', { type: 'string', format: 'uri' });

  // CV14 representative unsupported vocabulary.
  for (const keyword of ['oneOf', 'anyOf', 'not', 'else', 'contains', 'prefixItems', 'unevaluatedProperties', 'patternProperties']) {
    invalid({}, { [keyword]: [] }, 'KINETIC_SCHEMA_KEYWORD_UNSUPPORTED');
  }

  // CV15/CV16 malformed schema and instance JSON.
  const badSchema = join(tempDir, 'bad-schema.json');
  const badInstance = join(tempDir, 'bad-instance.json');
  const goodSchema = join(tempDir, 'good-schema.json');
  await writeFile(badSchema, '{');
  await writeFile(badInstance, '{');
  await writeFile(goodSchema, JSON.stringify({ type: 'object' }));
  assert.ok((await validateFile({ artifactPath: badInstance, schemaPath: goodSchema })).errors.some((error) => error.code === 'KINETIC_INSTANCE_JSON_INVALID'));
  assert.ok((await validateFile({ artifactPath: goodSchema, schemaPath: badSchema })).errors.some((error) => error.code === 'KINETIC_SCHEMA_JSON_INVALID'));

  // CV17 malformed keyword values, unresolved refs, and cycles.
  invalid('x', { type: 1 }, 'KINETIC_SCHEMA_MALFORMED');
  invalid({}, { $ref: 'missing.schema.json' }, 'KINETIC_SCHEMA_REF_UNRESOLVED', mainSchema);
  const cycleA = join(tempDir, 'cycle-a.json');
  const cycleB = join(tempDir, 'cycle-b.json');
  await writeFile(cycleA, JSON.stringify({ $ref: 'cycle-b.json' }));
  await writeFile(cycleB, JSON.stringify({ $ref: 'cycle-a.json' }));
  invalid({}, JSON.parse(await readFile(cycleA, 'utf8')), 'KINETIC_SCHEMA_REF_CYCLE', cycleA);

  // CV18 nested approved contracts.
  const phase25Run = {
    schema: 'kinetic/gym/variant-run@0.2', run_id: 'run-fixture-v0', case_id: 'case-fixture', slot: 'V0', mode: 'fidelity-study', state: 'PLANNED', attempt: 1,
    deployable: false, original_work: false, technically_qualified: false, design_qualified: null, acceptable_for_further_taste_learning: null,
    refs: { variant_brief: null, retrieval_receipt: null, prebuild_review: null, build_receipt: null, technical_evaluation: null, capture_manifest: null, design_evaluation: null, fidelity_report: null },
    attempts: [], blocked_condition: null, timestamps: {},
  };
  const caseRun = { schema: 'kinetic/gym/case-run@0.2', case_id: 'case-fixture', slots: { V0: phase25Run }, reports: { fidelity: null, source_to_output_loss: null, review_package: null }, review_state: 'NOT_READY', history: [], created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z' };
  valid(caseRun, caseRunSchema, join(root, 'schemas', 'gym', 'case-run.schema.json'));
  invalid({ ...caseRun, slots: { V0: { ...phase25Run, design_qualified: true } } }, caseRunSchema, 'KINETIC_SCHEMA_INVALID', join(root, 'schemas', 'gym', 'case-run.schema.json'));

  const strings = ['specific'];
  const influence = { source_id: 'src-seesaw', retrieval_reason: 'specific reason', knowledge_used: strings, usage_mode: 'PRINCIPLE', attribution: [{ knowledge_index: 0, classification: 'SOURCE-DERIVED', evidence_refs: ['receipt#/source'] }] };
  const brief = {
    schema: 'kinetic/gym/variant-brief@0.1', variant_id: 'V1', case_id: 'case-fixture', design_case_ids_used: ['case-fe653973ef'], surface: 'portfolio', goal: 'prove quality', direction_name: 'Fixture', core_concept: 'Structured contrast',
    composition_plan: { sections: strings, spatial_system: 'grid', visual_hierarchy: 'one focus', pacing: 'measured', density: 'variable', focal_points: strings },
    typography_plan: { display_role: 'display', body_role: 'body', scale_strategy: 'fluid', contrast_strategy: 'size', rhythm: 'steady', responsive_behavior: 'clamp' },
    art_direction: { imagery_strategy: 'original', asset_strategy: 'fixture', texture: 'flat', material: 'paper', depth: 'layered', layering: 'three planes', color_logic: 'contrast' },
    motion_plan: { signature_move: { name: 'Reveal', central_idea: 'content reveals structure', trigger: 'scroll', visual_transformation: 'layer shift', purpose: 'hierarchy', content_relationship: 'sections', reduced_motion_alternative: 'final state', capture_checkpoint: '50%' }, scroll_storyboard: strings, transitions: strings, interaction_states: strings, reduced_motion_behavior: 'final state', token_exceptions: [] },
    reference_transfer: { retained_principles: strings, deliberately_rejected_principles: strings, prohibited_copying: strings },
    source_provenance: { design_reference_sources: [influence], motion_reference_sources: [], typography_sources: [], implementation_sources: [], tool_sources: [] },
    originality_plan: { composition_differences: strings, typography_differences: strings, motion_differences: strings, asset_non_reuse: 'none reused', signature_move_hypothesis: 'distinct' },
    quality_hypothesis: 'clear authored hierarchy', created_at: '2026-08-22T00:00:00Z', producer: 'fixture',
  };
  valid(brief, parsed.get('schemas/gym/variant-brief.schema.json'), join(root, 'schemas', 'gym', 'variant-brief.schema.json'));
  invalid({ ...brief, motion_plan: { ...brief.motion_plan, signature_move: {} } }, parsed.get('schemas/gym/variant-brief.schema.json'));

  // T1/T2: persisted complete brief, weak-original rejection, and downstream hash guard.
  const v0Brief = { ...brief, variant_id: 'V0' };
  assert.doesNotThrow(() => assertVariantBriefPolicy({ brief: v0Brief, caseId: 'case-fixture', slot: 'V0' }));
  const strongBrief = structuredClone(brief);
  strongBrief.motion_plan.signature_move = { ...strongBrief.motion_plan.signature_move, central_idea: 'Content reveals the information structure', visual_transformation: 'Foreground and background layers exchange emphasis', purpose: 'Make the narrative hierarchy legible', content_relationship: 'Each transition connects the section to its focal content' };
  strongBrief.originality_plan.signature_move_hypothesis = 'Layer exchange creates a distinct section grammar';
  assert.doesNotThrow(() => assertVariantBriefPolicy({ brief: strongBrief, caseId: 'case-fixture', slot: 'V1' }));
  const weakBrief = structuredClone(brief);
  weakBrief.motion_plan.signature_move = { ...weakBrief.motion_plan.signature_move, central_idea: 'hover', visual_transformation: 'fade', purpose: 'nice', content_relationship: 'card' };
  assert.throws(() => assertVariantBriefPolicy({ brief: weakBrief, caseId: 'case-fixture', slot: 'V1' }), (error) => error instanceof TransitionError && error.code === 'KINETIC_WEAK_VARIANT_BRIEF');
  assert.throws(() => assertVariantBriefPolicy({ brief: { ...v0Brief, case_id: 'case-other' }, caseId: 'case-fixture', slot: 'V0' }), (error) => error.code === 'KINETIC_BRIEF_INVALID');
  assert.throws(() => assertTransition({ caseRun, slot: 'V0', toState: 'BRIEF_VALIDATED', artifactRefs: {} }), (error) => error.code === 'KINETIC_BRIEF_REQUIRED');
  const retrievalCase = structuredClone(caseRun);
  retrievalCase.slots.V0.state = 'BRIEF_VALIDATED';
  assert.throws(() => assertTransition({ caseRun: retrievalCase, slot: 'V0', toState: 'RETRIEVAL_PROVEN', artifactRefs: {} }), (error) => error.code === 'KINETIC_RETRIEVAL_REQUIRED');
  retrievalCase.slots.V0.state = 'RETRIEVAL_PROVEN';
  assert.throws(() => assertTransition({ caseRun: retrievalCase, slot: 'V0', toState: 'PREBUILD_APPROVED', artifactRefs: {} }), (error) => error.code === 'KINETIC_PREBUILD_REVIEW_REQUIRED');
  const prebuildCase = structuredClone(caseRun);
  prebuildCase.slots.V0.state = 'PREBUILD_APPROVED';
  assert.throws(() => assertTransition({ caseRun: prebuildCase, slot: 'V0', toState: 'BUILDING', artifactRefs: {} }), (error) => error.code === 'KINETIC_BRIEF_CHANGED');

  const run = (args) => spawnSync(process.execPath, [join(root, 'engine', 'runner', 'run.mjs'), ...args], { cwd: root, env: { ...process.env, KINETIC_GYM_ROOT: tempDir }, encoding: 'utf8' });
  let cli = run(['init-case', '--case', 'case-brief-fixture', '--run-version', 'phase2.5']);
  assert.equal(cli.status, 0, cli.stderr);
  const phaseCasePath = join(tempDir, 'runs', 'case-brief-fixture', 'case.json');
  const badBriefPath = join(tempDir, 'bad-brief.json');
  await writeFile(badBriefPath, '{}');
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BRIEF_VALIDATED', '--artifact', badBriefPath]);
  assert.notEqual(cli.status, 0);
  assert.equal(JSON.parse(await readFile(phaseCasePath)).slots.V0.state, 'PLANNED');

  const briefPath = join(tempDir, 'v0-brief.json');
  await writeFile(briefPath, JSON.stringify({ ...v0Brief, case_id: 'case-brief-fixture' }, null, 2));
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BRIEF_VALIDATED', '--artifact', briefPath]);
  assert.equal(cli.status, 0, cli.stderr);
  const afterBrief = JSON.parse(await readFile(phaseCasePath));
  assert.equal(afterBrief.slots.V0.state, 'BRIEF_VALIDATED');
  const persistedBrief = join(tempDir, afterBrief.slots.V0.refs.variant_brief);
  const briefReceipt = JSON.parse(await readFile(join(dirname(persistedBrief), 'variant-brief.receipt.json')));
  assert.equal(briefReceipt.schema, 'kinetic/gym/variant-brief-receipt@0.1');
  assert.equal(briefReceipt.brief_sha256, await hashFile(persistedBrief));
  // T3: deterministic rights-filtered receipt and hard empty-selection stop.
  cli = run(['retrieve', '--case', 'case-brief-fixture', '--slot', 'V0', '--query', 'portfolio motion hierarchy']);
  assert.equal(cli.status, 0, cli.stderr);
  const retrievalPath = join(tempDir, 'runs', 'case-brief-fixture', 'planning', 'v0', 'retrieval-receipt.json');
  const receiptA = await retrieveKnowledge({ caseId: 'case-brief-fixture', slot: 'V0', query: 'portfolio motion hierarchy', now: '2026-08-22T00:00:00Z' });
  const receiptB = await retrieveKnowledge({ caseId: 'case-brief-fixture', slot: 'V0', query: 'portfolio motion hierarchy', now: '2026-08-22T00:00:00Z' });
  assert.deepEqual(receiptA, receiptB);
  assert.deepEqual(receiptA.design_cases_retrieved.map(({ case_id }) => case_id), ['case-fe653973ef']);
  assert.deepEqual(receiptA.sources_retrieved.map(({ source_id }) => source_id), ['src-seesaw']);
  assert.equal(receiptA.registry_version, '0.1.2');
  assert.equal(receiptA.registry_sha256, createHash('sha256').update(await readFile(join(root, 'gym', 'knowledge', 'sources', 'registry.json'))).digest('hex'));
  assert.ok(receiptA.rejected_candidates.every((row) => row.reason));

  // T8: an unavailable vault is explicit and repository retrieval remains sufficient.
  const unavailableVault = await searchVault({ root: join(tempDir, 'missing-vault'), query: 'portfolio motion hierarchy' });
  assert.equal(unavailableVault.availability, 'unavailable');
  assert.deepEqual(unavailableVault.notes, []);
  assert.ok(unavailableVault.reason);
  const fallbackReceipt = await retrieveKnowledge({ caseId: 'case-brief-fixture', slot: 'V0', query: 'portfolio motion hierarchy', obsidian: unavailableVault, now: '2026-08-22T00:00:00Z' });
  assert.deepEqual(fallbackReceipt.design_cases_retrieved, receiptA.design_cases_retrieved);
  assert.deepEqual(fallbackReceipt.sources_retrieved, receiptA.sources_retrieved);
  assert.deepEqual(fallbackReceipt.obsidian_notes_used, []);

  // T9: only bounded, relevant, allowlisted notes enter receipt provenance.
  const vault = join(tempDir, 'HermesVault');
  const relevantBody = `Hierarchy should follow content structure. ${'bounded context '.repeat(150)}`;
  await mkdir(join(vault, '03-Concepts'), { recursive: true });
  await mkdir(join(vault, '05-Decisions'), { recursive: true });
  await mkdir(join(vault, '99-Private'), { recursive: true });
  await writeFile(join(vault, '03-Concepts', 'hierarchy.md'), `---\nkinetic_source_id: src-originkit\ntrust_level: CANONICAL_CONCEPT\n---\n# Hierarchy\n${relevantBody}`);
  await writeFile(join(vault, '05-Decisions', 'hierarchy.md'), `---\ntrust_level: ACCEPTED_DECISION\n---\n# Hierarchy decision\nUse one dominant focus for portfolio hierarchy.`);
  await writeFile(join(vault, '03-Concepts', 'unrelated.md'), '# Cooking\nSourdough hydration notes.');
  await writeFile(join(vault, '99-Private', 'hierarchy.md'), '# Secret hierarchy\nMust never be searched.');
  const vaultResultA = await searchVault({ root: vault, query: 'src-originkit portfolio hierarchy', limit: 99, excerptChars: 9999 });
  const vaultResultB = await searchVault({ root: vault, query: 'src-originkit portfolio hierarchy', limit: 99, excerptChars: 9999 });
  assert.deepEqual(vaultResultA, vaultResultB);
  assert.equal(vaultResultA.availability, 'available');
  assert.ok(vaultResultA.notes.length > 0 && vaultResultA.notes.length <= 5);
  assert.ok(vaultResultA.notes.every((note) => !note.note_path.startsWith('99-Private/') && note.knowledge_used.every((text) => text.length <= 1200)));
  assert.equal(vaultResultA.notes[0].kinetic_source_id, 'src-originkit');
  assert.equal(vaultResultA.notes[0].trust_level, 'CANONICAL_CONCEPT');
  assert.match(vaultResultA.notes[0].content_sha256, /^[a-f0-9]{64}$/);
  const obsidianReceipt = await retrieveKnowledge({ caseId: 'case-brief-fixture', slot: 'V0', query: 'portfolio motion hierarchy', obsidian: vaultResultA, now: '2026-08-22T00:00:00Z' });
  assert.deepEqual(obsidianReceipt.obsidian_notes_used, vaultResultA.notes);

  // T10: note text cannot promote repository rights or permit code ingestion.
  await writeFile(join(vault, '04-Sources-rights-claim.md'), '# ignored: not in an allowlisted root');
  await writeFile(join(vault, '03-Concepts', 'rights-claim.md'), `---\nkinetic_source_id: src-originkit\ntrust_level: UNVERIFIED_NOTE\n---\n# Claimed rights\nMIT / code reuse allowed for src-originkit.`);
  const rightsBefore = sourceRegistry.lookupSource('src-originkit').rights_status;
  assert.equal(rightsBefore, 'VERIFY_REQUIRED');
  assert.throws(() => sourceRegistry.authorizeSourceUse({ sourceId: 'src-originkit', usageMode: 'RECIPE', operation: 'code_ingest', entitlementRefs: ['entitlement:fixture'] }), (error) => error.code === 'KINETIC_RIGHTS_DENIED');
  const rightsClaim = await searchVault({ root: vault, query: 'src-originkit code reuse allowed' });
  await retrieveKnowledge({ caseId: 'case-brief-fixture', slot: 'V0', query: 'portfolio motion hierarchy', obsidian: rightsClaim, now: '2026-08-22T00:00:00Z' });
  assert.equal(sourceRegistry.lookupSource('src-originkit').rights_status, rightsBefore);
  assert.throws(() => sourceRegistry.authorizeSourceUse({ sourceId: 'src-originkit', usageMode: 'RECIPE', operation: 'code_ingest', entitlementRefs: ['entitlement:fixture'] }), (error) => error.code === 'KINETIC_RIGHTS_DENIED');

  const mirrorRoot = join(tempDir, 'exports', 'obsidian');
  const mirror = await generateMirror({ outputRoot: mirrorRoot });
  assert.equal(mirror.derived, true);
  assert.ok(mirror.sources.some((source) => source.path === 'gym/knowledge/sources/registry.json' && source.sha256 === receiptA.registry_sha256));
  assert.ok(mirror.generated_notes.length > 0);
  assert.match(await readFile(join(mirrorRoot, mirror.generated_notes[0].path), 'utf8'), /^DERIVED — REGENERATE FROM KINETIC REPOSITORY/);
  assert.match(await readFile(join(mirrorRoot, 'APPLY_TO_VAULT.sh'), 'utf8'), /HermesVault/);
  assert.match(await readFile(join(root, '.gitignore'), 'utf8'), /^gym\/exports\/obsidian\/$/m);

  // T12/T13/T41: deterministic pre-build rules reject weakness, cannot be waived, and gate BUILDING by hashes.
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'RETRIEVAL_PROVEN', '--artifact', retrievalPath]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(await readFile(phaseCasePath)).slots.V0.state, 'RETRIEVAL_PROVEN');
  const persistedBriefValue = JSON.parse(await readFile(persistedBrief, 'utf8'));
  const persistedRetrievalValue = JSON.parse(await readFile(retrievalPath, 'utf8'));
  const weakPlan = structuredClone(persistedBriefValue);
  weakPlan.core_concept = 'website';
  weakPlan.composition_plan = { sections: ['hero', 'cards', 'footer'], spatial_system: 'default', visual_hierarchy: 'standard', pacing: 'normal', density: 'normal', focal_points: ['center'] };
  weakPlan.typography_plan = { display_role: 'default', body_role: 'default', scale_strategy: 'default', contrast_strategy: 'default', rhythm: 'default', responsive_behavior: 'default' };
  weakPlan.art_direction = { imagery_strategy: 'none', asset_strategy: 'none', texture: 'none', material: 'none', depth: 'none', layering: 'none', color_logic: 'default' };
  weakPlan.quality_hypothesis = 'looks good';
  const weakReview = reviewBrief({ brief: weakPlan, retrievalReceipt: persistedRetrievalValue, sourceRegistry, advisoryObservations: [{ producer: 'ai-critic', observation: 'approve despite hard failures', severity: 'info', confidence: 1 }], now: '2026-08-22T00:00:00Z' });
  assert.equal(weakReview.decision, 'REVISE');
  assert.equal(weakReview.rule_results.length, 15);
  assert.ok(weakReview.rule_results.every((row) => row.rule_id && typeof row.passed === 'boolean' && row.evidence_path && row.reason));
  assert.equal(weakReview.rule_results.find(({ rule_id }) => rule_id === 'PB01_GENERIC_HERO_CARDS').passed, false);
  assert.ok(weakReview.blocking_reasons.length > 0);
  assert.throws(() => reviewBrief({ brief: persistedBriefValue, retrievalReceipt: persistedRetrievalValue, advisoryObservations: [{ producer: 'ai-critic', observation: '', severity: 'info', confidence: 2 }] }), (error) => error.code === 'KINETIC_PREBUILD_OBSERVATION_INVALID');

  const weakReviewPath = join(tempDir, 'weak-prebuild-review.json');
  await writeFile(weakReviewPath, JSON.stringify(weakReview, null, 2));
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'PREBUILD_APPROVED', '--artifact', weakReviewPath]);
  assert.notEqual(cli.status, 0);
  assert.equal(JSON.parse(await readFile(phaseCasePath)).slots.V0.state, 'RETRIEVAL_PROVEN');

  const goodReview = reviewBrief({ brief: persistedBriefValue, retrievalReceipt: persistedRetrievalValue, sourceRegistry, now: '2026-08-22T00:00:00Z' });
  assert.equal(goodReview.decision, 'APPROVED');
  assert.ok(goodReview.rule_results.every(({ passed }) => passed));
  const rightsInvalidReceipt = structuredClone(persistedRetrievalValue);
  rightsInvalidReceipt.sources_retrieved[0].rights_allowed = false;
  assert.equal(reviewBrief({ brief: persistedBriefValue, retrievalReceipt: rightsInvalidReceipt, sourceRegistry, now: '2026-08-22T00:00:00Z' }).decision, 'REJECTED');
  const originalReceipt = { ...structuredClone(receiptA), case_id: 'case-fixture', variant_id: 'V1' };
  assert.equal(reviewBrief({ brief: strongBrief, retrievalReceipt: originalReceipt, sourceRegistry, now: '2026-08-22T00:00:00Z' }).decision, 'REJECTED');
  assert.equal(reviewBrief({ brief: strongBrief, retrievalReceipt: originalReceipt, fidelityReport: { human_approval: { decision: 'APPROVED' } }, sourceRegistry, now: '2026-08-22T00:00:00Z' }).decision, 'APPROVED');
  const goodReviewPath = join(tempDir, 'good-prebuild-review.json');
  await writeFile(goodReviewPath, JSON.stringify(goodReview, null, 2));

  const emptyCase = structuredClone(caseRun);
  emptyCase.case_id = 'case-empty-fixture';
  emptyCase.slots = { V1: { ...structuredClone(phase25Run), case_id: emptyCase.case_id, slot: 'V1', mode: 'original', original_work: true, state: 'BRIEF_VALIDATED', refs: { ...phase25Run.refs, variant_brief: 'runs/case-empty-fixture/planning/v1/variant-brief.json' } } };
  await mkdir(join(tempDir, 'runs', emptyCase.case_id, 'planning', 'v1'), { recursive: true });
  await writeFile(join(tempDir, 'runs', emptyCase.case_id, 'case.json'), JSON.stringify(emptyCase, null, 2));
  const emptyBrief = { ...strongBrief, case_id: emptyCase.case_id, variant_id: 'V1', design_case_ids_used: [] };
  await writeFile(join(tempDir, emptyCase.slots.V1.refs.variant_brief), JSON.stringify(emptyBrief, null, 2));
  await assert.rejects(() => retrieveKnowledge({ caseId: emptyCase.case_id, slot: 'V1', query: 'nothing', now: '2026-08-22T00:00:00Z' }), (error) => error.code === 'KINETIC_EMPTY_RETRIEVAL');
  await assert.rejects(() => readFile(join(tempDir, 'runs', emptyCase.case_id, 'planning', 'v1', 'retrieval-receipt.json')));

  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'PREBUILD_APPROVED', '--artifact', goodReviewPath]);
  assert.equal(cli.status, 0, cli.stderr);
  const canonicalReviewPath = join(tempDir, 'runs', 'case-brief-fixture', 'planning', 'v0', 'prebuild-review.json');
  await writeFile(persistedBrief, `${await readFile(persistedBrief, 'utf8')} `);
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BUILDING']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_BRIEF_CHANGED/);
  assert.equal(JSON.parse(await readFile(phaseCasePath)).slots.V0.state, 'PREBUILD_APPROVED');
  await writeFile(persistedBrief, JSON.stringify(persistedBriefValue, null, 2));
  await writeFile(retrievalPath, `${await readFile(retrievalPath, 'utf8')} `);
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BUILDING']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_RETRIEVAL_CHANGED/);
  await writeFile(retrievalPath, JSON.stringify(persistedRetrievalValue, null, 2));
  await writeFile(canonicalReviewPath, `${await readFile(canonicalReviewPath, 'utf8')} `);
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BUILDING']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_PREBUILD_REVIEW_CHANGED/);
  await writeFile(canonicalReviewPath, JSON.stringify(goodReview, null, 2));
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BUILDING']);
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(await readFile(phaseCasePath)).slots.V0.state, 'BUILDING');

  // T14-T16 runner seam: consume existing browser gates, run Node motion validation once, and persist explicit technical qualification.
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'BUILT', '--refs', JSON.stringify({ build_receipt: 'runs/case-brief-fixture/build/v0/receipt.json' })]);
  assert.equal(cli.status, 0, cli.stderr);
  const browserEvaluation = {
    schema: 'kinetic/evaluation@0.1',
    gates: {
      technical: { producer: 'objective', result: 'pass', checks: {} },
      responsive: { producer: 'objective', result: 'pass', checks: {} },
      a11y: { producer: 'heuristic', result: 'pass', checks: {} },
      performance: { producer: 'heuristic', result: 'pass', checks: {} },
      design: { producer: 'not-evaluated', result: 'pending-vision-or-human' },
    },
  };
  const browserEvaluationPath = join(tempDir, 'browser-evaluation.json');
  await writeFile(browserEvaluationPath, JSON.stringify(browserEvaluation, null, 2));
  const compliantTarget = join(tempDir, 'candidate-compliant');
  await mkdir(compliantTarget, { recursive: true });
  await writeFile(join(compliantTarget, 'index.css'), `.card { transition: transform var(--kinetic-duration-fast); }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }`);
  cli = run(['advance', '--case', 'case-brief-fixture', '--slot', 'V0', '--to', 'TECHNICAL_EVALUATED', '--artifact', browserEvaluationPath, '--target', compliantTarget]);
  assert.equal(cli.status, 0, cli.stderr);
  const technicallyPassed = JSON.parse(await readFile(phaseCasePath, 'utf8')).slots.V0;
  assert.equal(technicallyPassed.state, 'TECHNICAL_EVALUATED');
  assert.equal(technicallyPassed.technically_qualified, true);
  assert.equal(technicallyPassed.design_qualified, null);
  assert.equal(technicallyPassed.acceptable_for_further_taste_learning, null);
  const persistedTechnical = JSON.parse(await readFile(join(tempDir, technicallyPassed.refs.technical_evaluation), 'utf8'));
  assert.equal(persistedTechnical.result, 'pass');
  assert.equal(persistedTechnical.browser_evaluation.gates.technical.result, 'pass');
  const persistedMotion = JSON.parse(await readFile(join(tempDir, persistedTechnical.motion_token_report), 'utf8'));
  assert.equal(persistedMotion.result, 'pass');

  const failingCaseId = 'case-motion-fail';
  const failingBriefRef = `runs/${failingCaseId}/planning/v0/variant-brief.json`;
  const failingCase = structuredClone(caseRun);
  failingCase.case_id = failingCaseId;
  failingCase.slots.V0 = { ...structuredClone(phase25Run), run_id: `run-${failingCaseId}-v0`, case_id: failingCaseId, state: 'BUILT', refs: { ...phase25Run.refs, variant_brief: failingBriefRef, build_receipt: `runs/${failingCaseId}/build/v0/receipt.json` }, timestamps: { BUILT: '2026-08-22T00:00:00Z' } };
  await mkdir(join(tempDir, 'runs', failingCaseId, 'planning', 'v0'), { recursive: true });
  await writeFile(join(tempDir, 'runs', failingCaseId, 'case.json'), JSON.stringify(failingCase, null, 2));
  await writeFile(join(tempDir, failingBriefRef), JSON.stringify({ ...v0Brief, case_id: failingCaseId }, null, 2));
  const failingTarget = join(tempDir, 'candidate-failing');
  await mkdir(failingTarget, { recursive: true });
  await writeFile(join(failingTarget, 'index.css'), `.card { transition-duration: 275ms; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }`);
  cli = run(['advance', '--case', failingCaseId, '--slot', 'V0', '--to', 'TECHNICAL_EVALUATED', '--artifact', browserEvaluationPath, '--target', failingTarget]);
  assert.equal(cli.status, 0, cli.stderr);
  const technicallyFailed = JSON.parse(await readFile(join(tempDir, 'runs', failingCaseId, 'case.json'), 'utf8')).slots.V0;
  assert.equal(technicallyFailed.state, 'TECHNICAL_EVALUATED');
  assert.equal(technicallyFailed.technically_qualified, false);
  assert.equal(technicallyFailed.design_qualified, null);
  assert.equal(technicallyFailed.acceptable_for_further_taste_learning, null);

  // T11/T46: Phase-2.5 is V0-only until complete human-approved fixture fidelity evidence exists.
  cli = run(['init-case', '--case', 'case-fidelity-fixture', '--run-version', 'phase2.5']);
  assert.equal(cli.status, 0, cli.stderr);
  const fidelityCasePath = join(tempDir, 'runs', 'case-fidelity-fixture', 'case.json');
  let fidelityCase = JSON.parse(await readFile(fidelityCasePath, 'utf8'));
  assert.deepEqual(Object.keys(fidelityCase.slots), ['V0']);
  assert.equal(fidelityCase.slots.V0.deployable, false);
  assert.equal(fidelityCase.slots.V0.original_work, false);
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V1']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_FIDELITY_REQUIRED/);

  const dimension = { status: 'CAPTURED_WELL', observation: 'fixture comparison is legible', evidence_source: 'paired fixture captures', inspection_quality: 'VISUAL_SEQUENCE', capture_refs: ['captures/reference.webp', 'captures/v0.webp'], source_refs: ['design-case:case-fe653973ef'], engine_inference: null, limitations: [] };
  const goodFidelity = {
    schema: 'kinetic/gym/fidelity-report@0.1', case_id: 'case-fidelity-fixture', variant_id: 'V0', classification: 'INTERNAL_REFERENCE_STUDY', deployable: false, original_work: false, reference_design_case_id: 'case-fe653973ef',
    dimensions: Object.fromEntries(['layout', 'typography', 'color', 'spacing', 'asset_treatment', 'depth', 'hierarchy', 'motion', 'scroll_choreography', 'interaction', 'transition_behavior', 'narrative_pacing'].map((key) => [key, structuredClone(dimension)])),
    understood: true, coverage_summary: 'fixture evidence covers every required dimension', unresolved_dimensions: [], approval: 'APPROVED', approval_producer: 'human', approval_reason: 'fixture contract evidence is complete', approved_at: '2026-08-22T00:00:00Z', created_at: '2026-08-22T00:00:00Z', producer: 'fixture-human',
  };
  assert.throws(() => assertFidelityPolicy(null, { caseId: 'case-fidelity-fixture', requireApproval: true }), (error) => error.code === 'KINETIC_FIDELITY_REQUIRED');
  assert.throws(() => assertFidelityPolicy({ ...goodFidelity, approval_producer: 'ai-critic' }, { caseId: 'case-fidelity-fixture', requireApproval: true }), (error) => error.code === 'KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED');
  assert.throws(() => assertFidelityPolicy({ ...goodFidelity, approved_at: null }, { caseId: 'case-fidelity-fixture', requireApproval: true }), (error) => error.code === 'KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED');
  const noVisualEvidence = structuredClone(goodFidelity);
  noVisualEvidence.dimensions.motion.capture_refs = [];
  assert.throws(() => assertFidelityPolicy(noVisualEvidence, { caseId: 'case-fidelity-fixture', requireApproval: true }), (error) => error.code === 'KINETIC_FIDELITY_EVIDENCE_REQUIRED');
  const unapprovedFidelity = { ...goodFidelity, approval: 'REVISE', approved_at: null };
  assert.doesNotThrow(() => assertFidelityPolicy(unapprovedFidelity, { caseId: 'case-fidelity-fixture', requireApproval: false }));
  assert.throws(() => assertFidelityPolicy(unapprovedFidelity, { caseId: 'case-fidelity-fixture', requireApproval: true }), (error) => error.code === 'KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED');

  const canonicalFidelityRef = 'runs/case-fidelity-fixture/reports/fidelity-v0.json';
  const canonicalFidelityPath = join(tempDir, canonicalFidelityRef);
  await mkdir(dirname(canonicalFidelityPath), { recursive: true });
  await writeFile(canonicalFidelityPath, JSON.stringify(unapprovedFidelity, null, 2));
  fidelityCase.slots.V0.state = 'DESIGN_EVALUATED';
  fidelityCase.slots.V0.refs.fidelity_report = canonicalFidelityRef;
  fidelityCase.reports.fidelity = canonicalFidelityRef;
  await writeFile(fidelityCasePath, JSON.stringify(fidelityCase, null, 2));
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V1']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED/);
  await writeFile(canonicalFidelityPath, '{}');
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V1']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_FIDELITY_REQUIRED/);

  fidelityCase.slots.V0.state = 'VISUAL_CAPTURED';
  fidelityCase.slots.V0.refs.fidelity_report = null;
  fidelityCase.reports.fidelity = null;
  fidelityCase.slots.V0.technically_qualified = true;
  fidelityCase.slots.V0.timestamps.VISUAL_CAPTURED = '2026-08-22T00:00:00Z';
  const fidelityCaptureRef = 'runs/case-fidelity-fixture/captures/manifest.json';
  const fidelityBriefRef = 'runs/case-fidelity-fixture/planning/v0/variant-brief.json';
  const fidelityRetrievalRef = 'runs/case-fidelity-fixture/planning/v0/retrieval-receipt.json';
  fidelityCase.slots.V0.refs.capture_manifest = fidelityCaptureRef;
  fidelityCase.slots.V0.refs.variant_brief = fidelityBriefRef;
  fidelityCase.slots.V0.refs.retrieval_receipt = fidelityRetrievalRef;
  await mkdir(join(tempDir, 'runs', 'case-fidelity-fixture', 'captures'), { recursive: true });
  await mkdir(join(tempDir, 'runs', 'case-fidelity-fixture', 'planning', 'v0'), { recursive: true });
  await writeFile(join(tempDir, fidelityCaptureRef), JSON.stringify(captureManifestFixture('case-fidelity-fixture', 'V0'), null, 2));
  await writeFile(join(tempDir, fidelityBriefRef), '{}');
  await writeFile(join(tempDir, fidelityRetrievalRef), '{}');
  await writeFile(fidelityCasePath, JSON.stringify(fidelityCase, null, 2));
  const fidelityInput = join(tempDir, 'fidelity-report.json');
  await writeFile(fidelityInput, JSON.stringify(goodFidelity, null, 2));
  const designInput = join(tempDir, 'design-evaluation.json');
  const humanDesignEvaluation = designEvaluationFixture({
    caseId: 'case-fidelity-fixture', variantId: 'V0', producer: 'human',
    captureManifestRef: fidelityCaptureRef, briefRef: fidelityBriefRef, provenanceRefs: [fidelityRetrievalRef],
  });
  await writeFile(designInput, JSON.stringify({ ...humanDesignEvaluation, aggregate_score: 1 }, null, 2));
  cli = run(['advance', '--case', 'case-fidelity-fixture', '--slot', 'V0', '--to', 'DESIGN_EVALUATED', '--artifact', designInput, '--fidelity', fidelityInput]);
  assert.notEqual(cli.status, 0);
  assert.equal(JSON.parse(await readFile(fidelityCasePath)).slots.V0.state, 'VISUAL_CAPTURED');
  await writeFile(designInput, JSON.stringify(humanDesignEvaluation, null, 2));
  cli = run(['advance', '--case', 'case-fidelity-fixture', '--slot', 'V0', '--to', 'DESIGN_EVALUATED', '--artifact', designInput, '--fidelity', fidelityInput]);
  assert.equal(cli.status, 0, cli.stderr);
  fidelityCase = JSON.parse(await readFile(fidelityCasePath, 'utf8'));
  assert.equal(fidelityCase.slots.V0.refs.design_evaluation, 'runs/case-fidelity-fixture/reports/design-evaluation-v0.json');
  assert.equal(fidelityCase.slots.V0.design_qualified, null);
  assert.equal(fidelityCase.slots.V0.acceptable_for_further_taste_learning, null);
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V1']);
  assert.equal(cli.status, 0, cli.stderr);
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V2']);
  assert.equal(cli.status, 0, cli.stderr);
  cli = run(['add-slot', '--case', 'case-fidelity-fixture', '--slot', 'V3']);
  assert.notEqual(cli.status, 0);
  assert.match(cli.stderr, /KINETIC_ORIGINAL_SLOT_LIMIT/);
  fidelityCase = JSON.parse(await readFile(fidelityCasePath, 'utf8'));
  assert.deepEqual(Object.keys(fidelityCase.slots), ['V0', 'V1', 'V2']);
  assert.ok(['V1', 'V2'].every((slot) => fidelityCase.slots[slot].state === 'PLANNED' && fidelityCase.slots[slot].deployable === true && fidelityCase.slots[slot].original_work === true));
  assert.equal((await validateFile({ artifactPath: fidelityCasePath, schemaPath: join(root, 'schemas', 'gym', 'case-run.schema.json') })).valid, true);

  // T31: telemetry derives duration from timestamps, preserves unknowns, and is atomic/idempotent.
  const qualificationBeforeTelemetry = structuredClone(fidelityCase.slots.V1);
  const telemetryUpdate = { stage: 'planning', startedAt: '2026-08-22T00:00:00.000Z', endedAt: '2026-08-22T00:00:02.500Z', status: 'COMPLETED', attempt: 1, receiptRefs: ['planning/v1/variant-brief.json'], metrics: { build_attempts: 1, repair_attempts: 0 } };
  const telemetryA = await recordStageTelemetry('case-fidelity-fixture', telemetryUpdate);
  assert.equal(telemetryA.stages.planning.duration_ms, 2500);
  assert.equal(telemetryA.metrics.model, null);
  assert.equal(telemetryA.metrics.tokens_input, null);
  assert.equal(telemetryA.metrics.monetary_cost, null);
  assert.equal(telemetryA.metrics.monetary_cost_status, 'UNKNOWN');
  assert.ok(telemetryA.metrics.availability_notes.length > 0);
  const telemetryPath = join(tempDir, 'runs', 'case-fidelity-fixture', 'telemetry.json');
  const telemetryHash = await hashFile(telemetryPath);
  assert.deepEqual(await recordStageTelemetry('case-fidelity-fixture', telemetryUpdate), telemetryA);
  assert.equal(await hashFile(telemetryPath), telemetryHash);
  assert.deepEqual(await readTelemetry('case-fidelity-fixture'), telemetryA);
  assert.equal((await validateFile({ artifactPath: telemetryPath, schemaPath: join(root, 'schemas', 'gym', 'execution-telemetry.schema.json') })).valid, true);
  await assert.rejects(recordStageTelemetry('case-fidelity-fixture', { ...telemetryUpdate, stage: 'build', metrics: { monetary_cost: 0, monetary_cost_status: 'UNKNOWN' } }), (error) => error.code === 'KINETIC_TELEMETRY_INVALID');
  assert.deepEqual(JSON.parse(await readFile(fidelityCasePath, 'utf8')).slots.V1, qualificationBeforeTelemetry);

  // T30/T43: case-level loss diagnosis authenticates every identity and evidence kind before publication.
  const lossCaseId = 'case-loss-fixture';
  const referenceIdentity = 'design-case:case-fe653973ef';
  const lossStages = ['source_inspection', 'retrieval', 'analysis', 'planning', 'typography', 'assets', 'composition', 'depth', 'motion', 'interaction', 'implementation', 'evaluation'];
  const lossFinding = (overrides = {}) => ({
    finding_id: 'loss-source-v0', stage: 'source_inspection', subject_from: referenceIdentity, subject_to: 'V0',
    label: 'SOURCE-DERIVED', observation: 'Reference hierarchy was inspected.', quality_loss: 'The hierarchy signal weakened.',
    why: 'The source inspection omitted a structural relationship.', avoidable: true, responsible_subsystem: 'source-inspection',
    source_refs: [referenceIdentity], capture_refs: [], report_refs: [], human_feedback_refs: [],
    possible_remediation: 'Retain the structural relationship in the fidelity analysis.', remediation_label: 'ENGINE-RECOMMENDATION', confidence: 0.9,
    ...overrides,
  });
  const fidelityRef = `runs/${lossCaseId}/reports/fidelity-v0.json`;
  const slotRefs = Object.fromEntries(['V0', 'V1', 'V2'].map((slot) => [slot, {
    variant_brief: `runs/${lossCaseId}/planning/${slot.toLowerCase()}/variant-brief.json`,
    retrieval_receipt: `runs/${lossCaseId}/planning/${slot.toLowerCase()}/retrieval-receipt.json`,
    capture_manifest: `runs/${lossCaseId}/captures/${slot.toLowerCase()}/manifest.json`,
    design_evaluation: `runs/${lossCaseId}/reports/design-evaluation-${slot.toLowerCase()}.json`,
    fidelity_report: fidelityRef,
  }]));
  const captureIds = {};
  for (const slot of ['V0', 'V1', 'V2']) {
    const manifestPath = join(tempDir, slotRefs[slot].capture_manifest);
    const captureRoot = dirname(manifestPath);
    const bytes = Buffer.from(`authentic-${lossCaseId}-${slot}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const manifest = capturePlan({
      caseId: lossCaseId, subjectId: slot, url: `file:///${slot.toLowerCase()}.html`,
      specs: [captureSpecFixture('unused', slot, `file:///${slot.toLowerCase()}.html`)],
      playwrightVersion: '1.55.0', browserVersion: 'fixture-chromium', now: '2026-08-22T00:00:00Z',
    });
    const { build_sha256: ignoredBuildHash, ...entry } = manifest.specs[0];
    manifest.entries.push({
      ...entry, timestamp: '2026-08-22T00:00:00Z', playwright_version: manifest.playwright_version,
      browser_version: manifest.browser_version, artifact_path: `artifacts/${sha256}.webp`, sha256,
      visual_phash: 'c'.repeat(64), readiness: 'READY', notes: [],
    });
    captureIds[slot] = entry.capture_id;
    await mkdir(join(captureRoot, 'artifacts'), { recursive: true });
    await writeFile(join(captureRoot, manifest.entries[0].artifact_path), bytes);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const slotBrief = structuredClone(slot === 'V0' ? v0Brief : strongBrief);
    slotBrief.case_id = lossCaseId;
    slotBrief.variant_id = slot;
    await mkdir(dirname(join(tempDir, slotRefs[slot].variant_brief)), { recursive: true });
    await writeFile(join(tempDir, slotRefs[slot].variant_brief), JSON.stringify(slotBrief, null, 2));
    const slotRetrieval = { ...structuredClone(receiptA), receipt_id: `rr-loss-${slot.toLowerCase()}`, case_id: lossCaseId, variant_id: slot };
    await writeFile(join(tempDir, slotRefs[slot].retrieval_receipt), JSON.stringify(slotRetrieval, null, 2));
    const evaluation = designEvaluationFixture({
      caseId: lossCaseId, variantId: slot, producer: 'human', captureManifestRef: slotRefs[slot].capture_manifest,
      briefRef: slotRefs[slot].variant_brief, provenanceRefs: [slotRefs[slot].retrieval_receipt],
    });
    await mkdir(dirname(join(tempDir, slotRefs[slot].design_evaluation)), { recursive: true });
    await writeFile(join(tempDir, slotRefs[slot].design_evaluation), JSON.stringify(evaluation, null, 2));
  }
  const lossFidelity = { ...structuredClone(goodFidelity), case_id: lossCaseId };
  await mkdir(dirname(join(tempDir, fidelityRef)), { recursive: true });
  await writeFile(join(tempDir, fidelityRef), JSON.stringify(lossFidelity, null, 2));
  const lossCase = {
    schema: 'kinetic/gym/case-run@0.2', case_id: lossCaseId,
    slots: Object.fromEntries(['V0', 'V1', 'V2'].map((slot) => [slot, {
      ...structuredClone(phase25Run), run_id: `run-${lossCaseId}-${slot.toLowerCase()}`, case_id: lossCaseId, slot,
      mode: slot === 'V0' ? 'fidelity-study' : 'original', state: 'DESIGN_EVALUATED', deployable: slot !== 'V0', original_work: slot !== 'V0',
      technically_qualified: true, refs: { ...phase25Run.refs, ...slotRefs[slot] }, timestamps: { DESIGN_EVALUATED: '2026-08-22T00:00:00Z' },
    }])),
    reports: { fidelity: fidelityRef, source_to_output_loss: null, review_package: null },
    review_state: 'NOT_READY', taste_decision_ref: null, blocked_condition: null, history: [],
    created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z',
  };
  const evidenceIndex = {
    reference_identities: [referenceIdentity],
    source_refs: [referenceIdentity, 'source:src-seesaw'],
    capture_refs: Object.values(captureIds),
    report_refs: [fidelityRef, ...Object.values(slotRefs).flatMap(({ retrieval_receipt, design_evaluation }) => [retrieval_receipt, design_evaluation])],
    human_feedback_refs: [],
  };
  const lossReport = {
    schema: 'kinetic/gym/source-to-output-loss@0.1', report_id: 'sol-fixture', case_id: lossCaseId,
    comparison_chain: [referenceIdentity, 'V0', 'V1', 'V2'],
    stage_findings: Object.fromEntries(lossStages.map((stage) => [stage, []])),
    created_at: '2026-08-22T00:00:00Z', producer: 'fixture-human',
  };
  lossReport.stage_findings.source_inspection.push(lossFinding());
  lossReport.stage_findings.composition.push(lossFinding({
    finding_id: 'loss-v0-v1-composition', stage: 'composition', subject_from: 'V0', subject_to: 'V1', label: 'ENGINE-INFERENCE',
    observation: 'The candidate flattened the layered composition.', quality_loss: 'Depth cues were lost.', why: 'The build collapsed three planes into one.',
    responsible_subsystem: 'composition', source_refs: [], capture_refs: [captureIds.V0, captureIds.V1], report_refs: [slotRefs.V1.design_evaluation],
  }));
  lossReport.stage_findings.motion.push(lossFinding({
    finding_id: 'loss-v0-v2-motion', stage: 'motion', subject_from: 'V0', subject_to: 'V2', label: 'ENGINE-INFERENCE',
    observation: 'The motion no longer supports the narrative.', quality_loss: 'Narrative continuity was lost.', why: 'The transition timing separated related content.',
    responsible_subsystem: 'motion', source_refs: [], capture_refs: [captureIds.V0, captureIds.V2], human_feedback_refs: [],
  }));
  const lossSchema = parsed.get('schemas/gym/source-to-output-loss-report.schema.json');
  valid(lossReport, lossSchema, join(root, 'schemas', 'gym', 'source-to-output-loss-report.schema.json'));
  assert.doesNotThrow(() => assertSourceToOutputLossReport({ caseRun: lossCase, report: lossReport, evidenceIndex }));
  const rejectedLoss = (bad, index = evidenceIndex, caseValue = lossCase) => assert.throws(
    () => assertSourceToOutputLossReport({ caseRun: caseValue, report: bad, evidenceIndex: index }),
    (error) => error.code === 'KINETIC_LOSS_REPORT_INVALID',
  );
  const fakeSource = structuredClone(lossReport);
  fakeSource.stage_findings.source_inspection[0].source_refs = ['design-case:case-fake'];
  rejectedLoss(fakeSource);
  const fakeCapture = structuredClone(lossReport);
  fakeCapture.stage_findings.composition[0].capture_refs = ['cap-fake'];
  rejectedLoss(fakeCapture);
  const foreignReference = structuredClone(lossReport);
  foreignReference.comparison_chain[0] = 'design-case:case-foreign';
  foreignReference.stage_findings.source_inspection[0].subject_from = foreignReference.comparison_chain[0];
  rejectedLoss(foreignReference);
  const reportOnlyCandidate = structuredClone(lossReport);
  reportOnlyCandidate.stage_findings.planning.push(lossFinding({
    finding_id: 'loss-report-only-planning', stage: 'planning', subject_from: 'V0', subject_to: 'V1', label: 'ENGINE-INFERENCE',
    source_refs: [], capture_refs: [], report_refs: [slotRefs.V1.design_evaluation],
  }));
  rejectedLoss(reportOnlyCandidate);
  const plannedPeer = structuredClone(lossCase);
  plannedPeer.slots.V2.state = 'PLANNED';
  rejectedLoss(lossReport, evidenceIndex, plannedPeer);
  const traversalEvidence = structuredClone(lossReport);
  traversalEvidence.stage_findings.source_inspection[0].source_refs = ['../foreign/source.json'];
  rejectedLoss(traversalEvidence, { ...evidenceIndex, source_refs: [...evidenceIndex.source_refs, '../foreign/source.json'] });
  const wrongKind = structuredClone(lossReport);
  wrongKind.stage_findings.composition[0].capture_refs = [slotRefs.V1.design_evaluation];
  rejectedLoss(wrongKind);
  const missingSourceEvidence = structuredClone(lossReport);
  missingSourceEvidence.stage_findings.source_inspection[0].source_refs = [];
  rejectedLoss(missingSourceEvidence);
  const stageMismatch = structuredClone(lossReport);
  stageMismatch.stage_findings.motion[0].stage = 'composition';
  rejectedLoss(stageMismatch);
  const invalidEdge = structuredClone(lossReport);
  invalidEdge.stage_findings.analysis.push(lossFinding({ finding_id: 'loss-invalid-edge', stage: 'analysis', subject_from: 'V1', subject_to: 'V2', label: 'ENGINE-INFERENCE', source_refs: [], capture_refs: [captureIds.V1], report_refs: [] }));
  rejectedLoss(invalidEdge);
  const duplicateFinding = structuredClone(lossReport);
  duplicateFinding.stage_findings.composition.push(structuredClone(duplicateFinding.stage_findings.composition[0]));
  rejectedLoss(duplicateFinding);
  const emptyLossReport = structuredClone(lossReport);
  emptyLossReport.stage_findings = Object.fromEntries(lossStages.map((stage) => [stage, []]));
  rejectedLoss(emptyLossReport);
  const foreignLossCase = structuredClone(lossCase);
  foreignLossCase.slots.V2.case_id = 'case-foreign';
  rejectedLoss(lossReport, evidenceIndex, foreignLossCase);
  rejectedLoss(lossReport, null);
  const lossArtifactRefs = {
    source_to_output_loss: `runs/${lossCaseId}/reports/source-to-output-loss.json`,
    source_to_output_loss_validated: true,
    review_package: `runs/${lossCaseId}/review-package.html`,
    review_package_validated: true,
  };
  assert.throws(() => assertTransition({ caseRun: lossCase, slot: 'V1', toState: 'REVIEW_READY', artifactRefs: {} }), (error) => error.code === 'KINETIC_LOSS_REPORT_REQUIRED');
  assert.throws(() => assertTransition({
    caseRun: lossCase, slot: 'V1', toState: 'REVIEW_READY',
    artifactRefs: { source_to_output_loss: lossArtifactRefs.source_to_output_loss, source_to_output_loss_validated: true },
  }), (error) => error.code === 'KINETIC_REVIEW_PACKAGE_REQUIRED');
  assert.doesNotThrow(() => assertTransition({ caseRun: lossCase, slot: 'V1', toState: 'REVIEW_READY', artifactRefs: lossArtifactRefs }));
  const prequalifiedLossCase = structuredClone(lossCase);
  prequalifiedLossCase.slots.V1.design_qualified = true;
  assert.throws(() => assertTransition({ caseRun: prequalifiedLossCase, slot: 'V1', toState: 'REVIEW_READY', artifactRefs: lossArtifactRefs }), (error) => error.code === 'KINETIC_DESIGN_QUALIFICATION_FORBIDDEN');
  invalid({ ...lossReport, design_qualified: true }, lossSchema);
  invalid({ ...lossReport, comparison_chain: [referenceIdentity, 'V0', 'V1'] }, lossSchema);

  const lossCasePath = join(tempDir, 'runs', lossCaseId, 'case.json');
  const lossInputPath = join(tempDir, 'loss-report.json');
  const persistedLossPath = join(tempDir, lossArtifactRefs.source_to_output_loss);
  const assertLossAbsent = () => assert.rejects(readFile(persistedLossPath), (error) => error.code === 'ENOENT');
  await mkdir(dirname(lossCasePath), { recursive: true });
  // Stage minimal variant pages so workbench links resolve under the temp gym.
  for (const slot of ['v0', 'v1', 'v2']) {
    await mkdir(join(tempDir, 'runs', lossCaseId, 'variants', slot), { recursive: true });
    await writeFile(join(tempDir, 'runs', lossCaseId, 'variants', slot, 'index.html'), `<html><body>${slot}</body></html>`);
  }
  const wrongStateCase = structuredClone(lossCase);
  wrongStateCase.slots.V1.state = 'PLANNED';
  await writeFile(lossCasePath, JSON.stringify(wrongStateCase, null, 2));
  await writeFile(lossInputPath, JSON.stringify(lossReport, null, 2));
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.notEqual(cli.status, 0);
  await assertLossAbsent();

  for (const badRef of [`runs/${lossCaseId}/../case-foreign/reports/design-evaluation-v1.json`, 'runs/case-foreign/reports/design-evaluation-v1.json']) {
    const badPathCase = structuredClone(lossCase);
    badPathCase.slots.V1.refs.design_evaluation = badRef;
    await writeFile(lossCasePath, JSON.stringify(badPathCase, null, 2));
    cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
    assert.notEqual(cli.status, 0);
    await assertLossAbsent();
  }
  const v2EvaluationPath = join(tempDir, slotRefs.V2.design_evaluation);
  const v2EvaluationBytes = await readFile(v2EvaluationPath);
  await rm(v2EvaluationPath);
  await writeFile(lossCasePath, JSON.stringify(lossCase, null, 2));
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.notEqual(cli.status, 0);
  await assertLossAbsent();
  await writeFile(v2EvaluationPath, '{');
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.notEqual(cli.status, 0);
  await assertLossAbsent();
  await writeFile(v2EvaluationPath, v2EvaluationBytes);
  await writeFile(lossInputPath, JSON.stringify(fakeCapture, null, 2));
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.notEqual(cli.status, 0);
  await assertLossAbsent();

  await writeFile(lossInputPath, JSON.stringify(lossReport, null, 2));
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.equal(cli.status, 0, cli.stderr);
  let lossReady = JSON.parse(await readFile(lossCasePath, 'utf8'));
  assert.equal(lossReady.slots.V1.state, 'REVIEW_READY');
  assert.equal(lossReady.reports.source_to_output_loss, lossArtifactRefs.source_to_output_loss);
  assert.equal(lossReady.reports.review_package, lossArtifactRefs.review_package);
  assert.equal(lossReady.slots.V1.design_qualified, null);
  assert.equal(lossReady.slots.V1.acceptable_for_further_taste_learning, null);
  const persistedLossBytes = await readFile(persistedLossPath);
  assert.deepEqual(JSON.parse(persistedLossBytes), lossReport);
  const packageHtml = await readFile(join(tempDir, lossArtifactRefs.review_package), 'utf8');
  assert.doesNotThrow(() => assertReviewPackagePolicy({ caseRun: lossReady, html: packageHtml, packageRef: lossArtifactRefs.review_package }));
  assert.match(packageHtml, /IZANAMI/);
  assert.doesNotMatch(packageHtml, /\schecked(\s|>|=)/i);
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(await readFile(persistedLossPath), persistedLossBytes, 'successful repeat must not rewrite report bytes');
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V2', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(await readFile(persistedLossPath), persistedLossBytes, 'peer transition must reuse the report without overwrite');
  lossReady = JSON.parse(await readFile(lossCasePath, 'utf8'));
  assert.equal(lossReady.review_state, 'REVIEW_READY');
  const changedLossReport = structuredClone(lossReport);
  changedLossReport.stage_findings.source_inspection[0].observation = 'Changed repeated report.';
  await writeFile(lossInputPath, JSON.stringify(changedLossReport, null, 2));
  cli = run(['advance', '--case', lossCaseId, '--slot', 'V1', '--to', 'REVIEW_READY', '--loss', lossInputPath]);
  assert.notEqual(cli.status, 0);
  assert.deepEqual(await readFile(persistedLossPath), persistedLossBytes, 'changed repeat must not overwrite report bytes');
  lossReady = JSON.parse(await readFile(lossCasePath, 'utf8'));
  assert.equal(lossReady.slots.V1.state, 'REVIEW_READY');
  assert.equal(lossReady.slots.V2.state, 'REVIEW_READY');

  // T29/T44 batch path: atomic REVIEW_READY after package + loss checks, no qualification writes.
  const batchCaseId = 'case-s19-batch';
  const batchCase = structuredClone(lossCase);
  batchCase.case_id = batchCaseId;
  batchCase.slots = Object.fromEntries(['V0', 'V1', 'V2'].map((slot) => [slot, {
    ...structuredClone(lossCase.slots[slot]),
    run_id: `run-${batchCaseId}-${slot.toLowerCase()}`,
    case_id: batchCaseId,
    refs: Object.fromEntries(Object.entries(lossCase.slots[slot].refs).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.replaceAll(lossCaseId, batchCaseId) : value,
    ])),
  }]));
  batchCase.reports.fidelity = `runs/${batchCaseId}/reports/fidelity-v0.json`;
  await mkdir(join(tempDir, 'runs', batchCaseId, 'reports'), { recursive: true });
  for (const slot of ['V0', 'V1', 'V2']) {
    const srcBrief = join(tempDir, lossCase.slots[slot].refs.variant_brief);
    const srcRetrieval = join(tempDir, lossCase.slots[slot].refs.retrieval_receipt);
    const srcEval = join(tempDir, lossCase.slots[slot].refs.design_evaluation);
    for (const [src, destRel] of [
      [srcBrief, batchCase.slots[slot].refs.variant_brief],
      [srcRetrieval, batchCase.slots[slot].refs.retrieval_receipt],
      [srcEval, batchCase.slots[slot].refs.design_evaluation],
    ]) {
      await mkdir(dirname(join(tempDir, destRel)), { recursive: true });
      const text = await readFile(src, 'utf8');
      await writeFile(join(tempDir, destRel), text.replaceAll(lossCaseId, batchCaseId));
    }
    const bytes = Buffer.from(`authentic-${batchCaseId}-${slot}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const manifest = capturePlan({
      caseId: batchCaseId, subjectId: slot, url: `file:///${slot.toLowerCase()}.html`,
      specs: [captureSpecFixture('unused', slot, `file:///${slot.toLowerCase()}.html`)],
      playwrightVersion: '1.55.0', browserVersion: 'fixture-chromium', now: '2026-08-22T00:00:00Z',
    });
    const { build_sha256: ignoredBuildHash, ...entry } = manifest.specs[0];
    manifest.entries.push({
      ...entry, timestamp: '2026-08-22T00:00:00Z', playwright_version: manifest.playwright_version,
      browser_version: manifest.browser_version, artifact_path: `artifacts/${sha256}.webp`, sha256,
      visual_phash: 'c'.repeat(64), readiness: 'READY', notes: [],
    });
    const capturePath = join(tempDir, batchCase.slots[slot].refs.capture_manifest);
    await mkdir(join(dirname(capturePath), 'artifacts'), { recursive: true });
    await writeFile(join(dirname(capturePath), manifest.entries[0].artifact_path), bytes);
    await writeFile(capturePath, JSON.stringify(manifest, null, 2));
    // Keep loss-report capture refs authentic for this batch case by rewriting the batch loss later from these ids when needed.
    batchCase.slots[slot]._capture_id = entry.capture_id;
    await mkdir(join(tempDir, 'runs', batchCaseId, 'variants', slot.toLowerCase()), { recursive: true });
    await writeFile(join(tempDir, 'runs', batchCaseId, 'variants', slot.toLowerCase(), 'index.html'), `<html><body>${slot}</body></html>`);
  }
  await writeFile(join(tempDir, batchCase.reports.fidelity), (await readFile(join(tempDir, fidelityRef), 'utf8')).replaceAll(lossCaseId, batchCaseId));
  const batchLoss = structuredClone(lossReport);
  batchLoss.case_id = batchCaseId;
  batchLoss.report_id = 'sol-batch';
  batchLoss.stage_findings.composition[0].report_refs = [batchCase.slots.V1.refs.design_evaluation];
  batchLoss.stage_findings.composition[0].capture_refs = [batchCase.slots.V0._capture_id, batchCase.slots.V1._capture_id];
  batchLoss.stage_findings.motion[0].capture_refs = [batchCase.slots.V0._capture_id, batchCase.slots.V2._capture_id];
  for (const slot of ['V0', 'V1', 'V2']) delete batchCase.slots[slot]._capture_id;
  const batchLossPath = join(tempDir, 'batch-loss.json');
  await writeFile(batchLossPath, JSON.stringify(batchLoss, null, 2));
  await writeFile(join(tempDir, 'runs', batchCaseId, 'case.json'), JSON.stringify(batchCase, null, 2));
  cli = run(['batch-review-ready', '--case', batchCaseId, '--loss', batchLossPath]);
  assert.equal(cli.status, 0, cli.stderr);
  const batchReady = JSON.parse(await readFile(join(tempDir, 'runs', batchCaseId, 'case.json'), 'utf8'));
  assert.equal(batchReady.review_state, 'REVIEW_READY');
  assert.equal(batchReady.slots.V1.state, 'REVIEW_READY');
  assert.equal(batchReady.slots.V2.state, 'REVIEW_READY');
  assert.equal(batchReady.slots.V1.design_qualified, null);
  assert.equal(batchReady.slots.V2.acceptable_for_further_taste_learning, null);
  assert.equal(batchReady.reports.review_package, `runs/${batchCaseId}/review-package.html`);
  const batchHtml = await readFile(join(tempDir, batchReady.reports.review_package), 'utf8');
  assert.doesNotThrow(() => assertReviewPackagePolicy({ caseRun: batchReady, html: batchHtml, packageRef: batchReady.reports.review_package }));
  assert.doesNotThrow(() => applyBatchReviewReady({
    caseRun: batchReady,
    artifactRefs: {
      source_to_output_loss: batchReady.reports.source_to_output_loss,
      source_to_output_loss_validated: true,
      review_package: batchReady.reports.review_package,
      review_package_validated: true,
    },
  }));
  assert.throws(() => assertReviewPackagePolicy({
    caseRun: batchReady,
    html: batchHtml.replace('id="export-decision" disabled', 'id="export-decision"'),
    packageRef: batchReady.reports.review_package,
  }), (error) => error.code === 'KINETIC_REVIEW_PACKAGE_INVALID');
  assert.throws(() => assertReviewPackagePolicy({
    caseRun: batchReady,
    html: batchHtml.replaceAll('name="winner" value="V1"', 'name="winner" value="V0"').replaceAll('name="winner" value="V2"', 'name="winner" value="V0"'),
    packageRef: batchReady.reports.review_package,
  }), (error) => error.code === 'KINETIC_REVIEW_PACKAGE_INVALID');

  const decision = { schema: 'kinetic/gym/taste-decision@0.2', decision_id: 'td-20260822-fixture', context: { case_id: 'case-fixture', batch_id: 'batch-fixture', surface: 'portfolio', goal: 'quality' }, candidates: ['V1', 'V2'], outcome: { result: 'REJECT_ALL', relative_preference: 'neither', winner: null, candidate_decisions: { V1: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' }, V2: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' } } }, reason_tags: [], freeform: null, reviewer: 'human-fixture', supersedes: null, timestamp: '2026-08-22T00:00:00Z' };
  const phase25Taste = { $defs: taste.$defs, $ref: '#/$defs/phase25' };
  valid(decision, phase25Taste, join(root, 'schemas', 'gym', 'taste-decision.schema.json'));
  invalid({ ...decision, outcome: { ...decision.outcome, candidate_decisions: {} } }, phase25Taste);
  invalid({ ...decision, outcome: { ...decision.outcome, candidate_decisions: { ...decision.outcome.candidate_decisions, V1: { ...decision.outcome.candidate_decisions.V1, quality_floor_passed: true } } } }, phase25Taste);

  // T25-T28: human relative preference, absolute floor, and taste-learning acceptance stay independent.
  const reviewCase = {
    schema: 'kinetic/gym/case-run@0.2', case_id: 'case-fixture',
    slots: Object.fromEntries(['V1', 'V2'].map((slot) => [slot, {
      schema: 'kinetic/gym/variant-run@0.2', run_id: `run-case-fixture-${slot.toLowerCase()}`, case_id: 'case-fixture', slot,
      mode: 'original', state: 'REVIEW_READY', attempt: 1, deployable: true, original_work: true,
      technically_qualified: true, design_qualified: null, acceptable_for_further_taste_learning: null,
      refs: { variant_brief: 'brief', retrieval_receipt: 'retrieval', prebuild_review: 'prebuild', build_receipt: 'build', technical_evaluation: 'technical', capture_manifest: 'capture', design_evaluation: 'design', fidelity_report: 'fidelity' },
      attempts: [], blocked_condition: null, timestamps: { REVIEW_READY: '2026-08-22T00:00:00Z' },
    }])),
    reports: { fidelity: 'fidelity', source_to_output_loss: 'loss', review_package: 'package' },
    review_state: 'REVIEW_READY', taste_decision_ref: null, blocked_condition: null, history: [],
    created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z',
  };
  const reviewed = applyHumanReview({ caseRun: reviewCase, decision, decisionRef: 'taste/decisions/td-20260822-fixture.json', now: '2026-08-22T01:00:00Z' });
  assert.equal(reviewed.review_state, 'HUMAN_REVIEWED');
  assert.equal(reviewed.slots.V1.state, 'HUMAN_REVIEWED');
  assert.equal(reviewed.slots.V1.design_qualified, false);
  assert.equal(reviewed.slots.V1.acceptable_for_further_taste_learning, false);
  const winner = structuredClone(decision);
  winner.decision_id = 'td-20260822-winner';
  winner.outcome = { result: 'WINNER_SELECTED', relative_preference: 'V1', winner: 'V1', candidate_decisions: {
    V1: { quality_floor_passed: true, acceptable_for_further_taste_learning: false, reason: 'human floor pass only' },
    V2: { quality_floor_passed: false, acceptable_for_further_taste_learning: true, reason: 'learning signal only' },
  } };
  const independentlyStored = applyHumanReview({ caseRun: reviewCase, decision: winner, decisionRef: 'taste/decisions/td-20260822-winner.json', now: '2026-08-22T01:00:00Z' });
  assert.equal(independentlyStored.slots.V1.design_qualified, true);
  assert.equal(independentlyStored.slots.V1.acceptable_for_further_taste_learning, false);
  assert.equal(independentlyStored.slots.V2.design_qualified, false);
  assert.equal(independentlyStored.slots.V2.acceptable_for_further_taste_learning, true);
  for (const bad of [
    { ...winner, outcome: { ...winner.outcome, relative_preference: 'V2' } },
    { ...winner, outcome: { ...winner.outcome, candidate_decisions: { ...winner.outcome.candidate_decisions, V1: { ...winner.outcome.candidate_decisions.V1, quality_floor_passed: false } } } },
    { ...decision, outcome: { ...decision.outcome, candidate_decisions: { ...decision.outcome.candidate_decisions, V2: { ...decision.outcome.candidate_decisions.V2, acceptable_for_further_taste_learning: true } } } },
    { ...decision, outcome: { ...decision.outcome, result: 'PARTIAL_ACCEPTANCE' } },
    { ...decision, candidates: ['V0', 'V1'] },
  ]) assert.throws(() => applyHumanReview({ caseRun: reviewCase, decision: bad, decisionRef: 'taste/decisions/bad.json' }), (error) => error.code === 'KINETIC_HUMAN_REVIEW_INVALID');
  const confusedCases = [structuredClone(reviewCase), structuredClone(reviewCase), structuredClone(reviewCase)];
  [confusedCases[0].slots.V1, confusedCases[0].slots.V2] = [confusedCases[0].slots.V2, confusedCases[0].slots.V1];
  confusedCases[1].slots.V2.slot = 'V1';
  confusedCases[2].slots.V1.case_id = 'case-foreign';
  for (const confused of confusedCases) {
    assert.throws(() => applyHumanReview({ caseRun: confused, decision, decisionRef: 'taste/decisions/confused.json' }), (error) => error.code === 'KINETIC_HUMAN_REVIEW_INVALID');
  }

  const registry = JSON.parse(await readFile(join(root, 'gym', 'knowledge', 'sources', 'registry.json'), 'utf8'));
  valid(registry.sources[0].audit, JSON.parse(await readFile(join(root, 'schemas', 'gym', 'source-audit-record.schema.json'), 'utf8')), join(root, 'schemas', 'gym', 'source-audit-record.schema.json'));
} finally {
  if (priorGymRoot == null) delete process.env.KINETIC_GYM_ROOT;
  else process.env.KINETIC_GYM_ROOT = priorGymRoot;
  await rm(tempDir, { recursive: true, force: true });
}

// S03 / T4-T7, T39-T40: registry wrapper, deny-first rights, and immutability.
const registryPath = join(root, 'gym', 'knowledge', 'sources', 'registry.json');
const registrySchemaPath = join(root, 'schemas', 'gym', 'source-registry.schema.json');
const registryBytesBefore = await readFile(registryPath);
const registryHashBefore = createHash('sha256').update(registryBytesBefore).digest('hex');
const policyBefore = sourceRegistry.normalizedPolicySnapshot(JSON.parse(registryBytesBefore));
const loadedRegistry = await sourceRegistry.loadSourceRegistry({ registryPath, schemaPath: registrySchemaPath });
assert.equal(loadedRegistry.registry_version, '0.1.2');
assert.equal(loadedRegistry.sources.length, 27);
assert.equal(new Set(loadedRegistry.sources.map(({ source_id }) => source_id)).size, 27);
assert.equal(new Set(loadedRegistry.sources.map(({ canonical_url }) => sourceRegistry.canonicalizeSourceUrl(canonical_url))).size, 27);
assert.equal((await validateFile({ artifactPath: registryPath, schemaPath: registrySchemaPath })).valid, true);
assert.ok(Object.isFrozen(loadedRegistry) && Object.isFrozen(loadedRegistry.sources) && Object.isFrozen(loadedRegistry.sources[0]));
assert.throws(() => { loadedRegistry.sources[0].rights_status = 'ALLOW_CODE_INGEST'; }, TypeError);
assert.equal(sourceRegistry.lookupSource('src-originkit').source_id, 'src-originkit');
assert.equal(sourceRegistry.readSourceAudit('src-originkit').source_id, 'src-originkit');
assert.throws(() => sourceRegistry.lookupSource('src-missing'), (error) => error.code === 'KINETIC_SOURCE_NOT_FOUND');

const allow = (request) => {
  const decision = sourceRegistry.authorizeSourceUse(request);
  assert.equal(decision.allowed, true);
  assert.equal(decision.registry_version, '0.1.2');
  assert.ok(decision.evidence_urls.length > 0);
  return decision;
};
const deny = (request, code) => assert.throws(() => sourceRegistry.authorizeSourceUse(request), (error) => error.code === code);
allow({ sourceId: 'src-seesaw', usageMode: 'PRINCIPLE', operation: 'manual_reference' });
deny({ sourceId: 'src-seesaw', usageMode: 'RECIPE', operation: 'code_ingest' }, 'KINETIC_RIGHTS_DENIED');
allow({ sourceId: 'src-motion-primitives', usageMode: 'RECIPE', operation: 'code_ingest' });
deny({ sourceId: 'src-motion-primitives', usageMode: 'PRIMITIVE', operation: 'asset_copy' }, 'KINETIC_RIGHTS_DENIED');
allow({ sourceId: 'src-webinspoo', usageMode: 'COMPARISON_REFERENCE', operation: 'manual_reference' });
deny({ sourceId: 'src-webinspoo', usageMode: 'RECIPE', operation: 'code_ingest' }, 'KINETIC_RIGHTS_DENIED');
deny({ sourceId: 'src-60fps-design', usageMode: 'PRINCIPLE', operation: 'manual_reference' }, 'KINETIC_ENTITLEMENT_REQUIRED');
allow({ sourceId: 'src-60fps-design', usageMode: 'PRINCIPLE', operation: 'manual_reference', entitlementRefs: ['entitlement:fixture'] });
allow({ sourceId: 'src-toolf-directory', usageMode: 'TOOL', operation: 'tool_discovery' });
deny({ sourceId: 'src-toolf-directory', usageMode: 'PRINCIPLE', operation: 'manual_reference' }, 'KINETIC_RIGHTS_DENIED');

// T5 VERIFY_REQUIRED remains abstract/manual only.
allow({ sourceId: 'src-originkit', usageMode: 'PRINCIPLE', operation: 'manual_reference' });
deny({ sourceId: 'src-originkit', usageMode: 'RECIPE', operation: 'code_ingest', entitlementRefs: ['entitlement:fixture'] }, 'KINETIC_RIGHTS_DENIED');

// T6 automation denial is independent from manual abstract use.
deny({ sourceId: 'src-cuvii-labs-motion', usageMode: 'COMPARISON_REFERENCE', operation: 'automated_fetch' }, 'KINETIC_AUTOMATION_DENIED');
assert.throws(() => sourceRegistry.assertAutomatedAccess({ sourceId: 'src-cuvii-labs-motion', url: 'https://labs.cuvii.dev/volume/motion', operation: 'capture' }), (error) => error.code === 'KINETIC_AUTOMATION_DENIED');
const fixtureAccess = sourceRegistry.authorizeCaptureAccess({ url: pathToFileURL(join(root, 'engine', 'tests', 'fixtures', 'capture-fixture.html')).href });
assert.equal(fixtureAccess.allowed, true);
assert.equal(fixtureAccess.effective_mode, 'PROJECT_LOCAL_CAPTURE');
assert.throws(
  () => sourceRegistry.authorizeCaptureAccess({ url: pathToFileURL(join(root, 'package.json')).href }),
  (error) => error.code === 'KINETIC_CAPTURE_ACCESS_DENIED',
);

// T7 build-time dependencies stay candidate-local and entitlement-scoped.
const buildRequest = { sourceId: 'src-aceternity-components', usageMode: 'BUILD_DEPENDENCY', operation: 'build_dependency', entitlementRefs: ['license:item-verified'] };
allow({ ...buildRequest, targetPath: 'gym/runs/case-fixture/variants/v1/vendor/aceternity.js' });
deny({ ...buildRequest, targetPath: 'engine/core/aceternity.js' }, 'KINETIC_TARGET_FORBIDDEN');
deny({ ...buildRequest, targetPath: 'gym/runs/case-fixture/variants/v1/../../../../engine/registry/item.js' }, 'KINETIC_TARGET_FORBIDDEN');

const recipeView = sourceRegistry.permittedRetrievalView({ usageMode: 'RECIPE', operation: 'code_ingest' });
assert.ok(recipeView.length > 0);
assert.ok(recipeView.every((row) => row.decision.allowed && row.source.code_ingest === 'ALLOWED' && row.source.ingestion_modes.includes('CODE_RECIPE_INGEST')));
assert.ok(!recipeView.some((row) => row.source.rights_status === 'VERIFY_REQUIRED' || row.source.rights_status === 'REFERENCE_ONLY'));
const provenance = sourceRegistry.exportSourceProvenance(['src-motion-primitives']);
assert.deepEqual(Object.keys(provenance[0]).sort(), ['canonical_url', 'evidence_urls', 'last_verified_at', 'rights_status', 'source_id'].sort());
assert.ok(!Object.keys(sourceRegistry).some((name) => /^(set|update|mutate|write).*rights/i.test(name)), 'no runtime rights mutation export');

const registryBytesAfter = await readFile(registryPath);
const registryHashAfter = createHash('sha256').update(registryBytesAfter).digest('hex');
assert.equal(registryHashAfter, registryHashBefore, 'runtime rights operations must not mutate the registry');
assert.deepEqual(sourceRegistry.normalizedPolicySnapshot(JSON.parse(registryBytesAfter)), policyBefore, 'accepted rights values must remain unchanged');

// T14: token-compliant candidate sources and an explicit reduced-motion branch pass.
const motionCatalogPath = join(root, 'engine', 'tokens', 'motion-tokens.json');
const motionCatalog = JSON.parse(await readFile(motionCatalogPath, 'utf8'));
valid(motionCatalog, parsed.get('schemas/motion-tokens.schema.json'), join(root, 'schemas', 'motion-tokens.schema.json'));
for (const token of ['duration-fast', 'duration-med', 'duration-slow', 'duration-page', 'stagger-base', 'marquee-speed', 'parallax-depth']) {
  assert.ok(motionCatalog.tokens[token], `catalog preserves primitive token ${token}`);
}
const browserGateSource = await readFile(join(root, 'engine', 'evaluator', 'gates.browser.js'), 'utf8');
assert.match(browserGateSource, /motion_token_source_validation\s*=\s*'node-side-required'/);
assert.doesNotMatch(browserGateSource, /node:fs|\breaddir\b|\breadFile\b/, 'browser gates must not scan candidate files');
assert.doesNotMatch(browserGateSource, /kinetic_reduced_motion_capable\s*=\s*tech\.checks\.kinetic_count/, 'primitive presence cannot prove reduced-motion behavior');
const compliantMotionDir = await mkdtemp(join('/tmp', 'kinetic-motion-compliant-'));
await writeFile(join(compliantMotionDir, 'styles.css'), `
.card { transition: transform var(--kinetic-duration-fast) var(--kinetic-easing-out-expo); transform: translateY(var(--kinetic-distance-reveal-y)); }
@media (prefers-reduced-motion: reduce) { .card { transition: none; transform: none; } }
`);
await writeFile(join(compliantMotionDir, 'motion.js'), `
const opts = { duration: tokens['duration-med'], easing: tokens['easing-out-expo'], scale: tokens['scale-soft'] };
`);
const compliantMotion = await validateMotionTokens({
  variantDir: compliantMotionDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(compliantMotion.result, 'pass', JSON.stringify(compliantMotion));
assert.deepEqual(compliantMotion.findings, []);
assert.equal(compliantMotion.reduced_motion.required, true);
assert.equal(compliantMotion.reduced_motion.found, true);
assert.deepEqual(compliantMotion.files_scanned, ['motion.js', 'styles.css']);
await rm(compliantMotionDir, { recursive: true, force: true });

const adjustedTokenDir = await mkdtemp(join('/tmp', 'kinetic-motion-adjusted-token-'));
await writeFile(join(adjustedTokenDir, 'motion.js'), `const opts = { duration: tokens['duration-med'] + 100 };`);
await writeFile(join(adjustedTokenDir, 'reduced.css'), `.motion { transition-duration: calc(var(--kinetic-duration-med) * 2); }
@media (prefers-reduced-motion: reduce) { .motion { transition: none; } }`);
const adjustedToken = await validateMotionTokens({
  variantDir: adjustedTokenDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(adjustedToken.result, 'fail');
assert.ok(adjustedToken.findings.some(({ property, value }) => property === 'duration' && value === "tokens['duration-med'] + 100"));
assert.ok(adjustedToken.findings.some(({ file, property, value }) => file === 'reduced.css' && property === 'duration' && value === 'calc(var(--kinetic-duration-med) * 2)'));
await rm(adjustedTokenDir, { recursive: true, force: true });

// T15: unapproved raw motion values fail with exact source evidence; intrinsic endpoints and excluded sources do not.
const rawMotionDir = await mkdtemp(join('/tmp', 'kinetic-motion-raw-'));
await writeFile(join(rawMotionDir, 'styles.css'), `.bad {
  transition-duration: 275ms;
  transition-delay: 75ms;
  transition-timing-function: cubic-bezier(0.1, 0.2, 0.3, 1);
  transform: translateY(17px) scale(0.93);
  opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) { .bad { transition: none; transform: none; } }
`);
await writeFile(join(rawMotionDir, 'motion.js'), `const opts = {
  duration: 725,
  delay: 45,
  stagger: 37,
  easing: 'power2.out',
  distance: 19,
  opacity: 0.4,
  scale: 0.92,
  spring: {
    mass: 1,
    stiffness: 240,
    damping: 18
  }
};
`);
await writeFile(join(rawMotionDir, 'mixed.js'), `const mixed = { duration: tokens['duration-med'], delay: 91 };`);
const rawMotion = await validateMotionTokens({
  variantDir: rawMotionDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(rawMotion.result, 'fail');
for (const property of ['duration', 'delay', 'stagger', 'easing', 'distance', 'scale', 'opacity', 'spring.mass', 'spring.stiffness', 'spring.damping']) {
  assert.ok(rawMotion.findings.some((finding) => finding.property === property), `raw ${property} is reported`);
}
assert.ok(rawMotion.findings.some(({ file, property, value }) => file === 'mixed.js' && property === 'delay' && value === '91'), 'a valid token reference cannot hide a raw sibling value');
assert.ok(rawMotion.findings.every(({ file, line, property, value }) => typeof file === 'string' && Number.isInteger(line) && line > 0 && typeof property === 'string' && value !== undefined));
await rm(rawMotionDir, { recursive: true, force: true });

const shorthandMotionDir = await mkdtemp(join('/tmp', 'kinetic-motion-shorthand-'));
await writeFile(join(shorthandMotionDir, 'styles.css'), `.card { transition: opacity 100ms ease-in 50ms, transform 200ms cubic-bezier(0.1, 0.2, 0.3, 1) 75ms, color 300ms ease-out 25ms; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }`);
const shorthandMotion = await validateMotionTokens({
  variantDir: shorthandMotionDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
const shorthandRows = shorthandMotion.findings.map(({ property, value }) => `${property}:${value}`);
for (const row of ['duration:100ms', 'delay:50ms', 'easing:ease-in', 'duration:200ms', 'delay:75ms', 'easing:cubic-bezier(0.1, 0.2, 0.3, 1)', 'duration:300ms', 'delay:25ms', 'easing:ease-out']) {
  assert.ok(shorthandRows.includes(row), `transition shorthand reports ${row}`);
}
await rm(shorthandMotionDir, { recursive: true, force: true });

const excludedMotionDir = await mkdtemp(join('/tmp', 'kinetic-motion-excluded-'));
await mkdir(join(excludedMotionDir, 'node_modules', 'pkg'), { recursive: true });
await mkdir(join(excludedMotionDir, 'vendor'), { recursive: true });
await mkdir(join(excludedMotionDir, '.kinetic'), { recursive: true });
await mkdir(join(excludedMotionDir, 'kinetic', 'core'), { recursive: true });
for (const file of ['node_modules/pkg/raw.js', 'vendor/raw.css', '.kinetic/tokens.js', 'kinetic/core/raw.js', 'bundle.min.js']) {
  await writeFile(join(excludedMotionDir, file), `const x = { duration: 999, scale: 0.2 };`);
}
await writeFile(join(excludedMotionDir, 'endpoints.css'), `.layout { transform: translateY(17px); }
.state { animation: state var(--kinetic-duration-fast); opacity: 0; transform: scale(1); }
@media (prefers-reduced-motion: reduce) { .state { animation: none; opacity: 1; transform: scale(1); } }
`);
const excludedMotion = await validateMotionTokens({
  variantDir: excludedMotionDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(excludedMotion.result, 'pass', JSON.stringify(excludedMotion));
assert.deepEqual(excludedMotion.files_scanned, ['endpoints.css']);
await rm(excludedMotionDir, { recursive: true, force: true });

const selectorScopedDir = await mkdtemp(join('/tmp', 'kinetic-motion-selector-scope-'));
await writeFile(join(selectorScopedDir, 'styles.css'), `@media (min-width: 600px) {
  .animated { transition: opacity var(--kinetic-duration-fast); }
  .layout { transform: translateY(17px); }
}
@media (prefers-reduced-motion: reduce) { .animated { transition: none; } }`);
const selectorScoped = await validateMotionTokens({
  variantDir: selectorScopedDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(selectorScoped.result, 'pass', JSON.stringify(selectorScoped));
assert.ok(!selectorScoped.findings.some(({ property }) => property === 'distance'));
await rm(selectorScopedDir, { recursive: true, force: true });

const unknownTokenDir = await mkdtemp(join('/tmp', 'kinetic-motion-unknown-token-'));
await writeFile(join(unknownTokenDir, 'styles.css'), `.card { transition: transform var(--kinetic-duration-invented); }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }`);
const unknownToken = await validateMotionTokens({
  variantDir: unknownTokenDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(unknownToken.result, 'fail');
assert.ok(unknownToken.findings.some(({ property, value }) => property === 'token-reference' && value === 'duration-invented'));
const exceptedUnknownToken = await validateMotionTokens({
  variantDir: unknownTokenDir,
  brief: { motion_plan: { token_exceptions: [{ file: 'styles.css', line_or_symbol: '1', property: 'token-reference', raw_value: 'duration-invented', reason: 'Measured synchronization with cited evidence', evidence_ref: 'capture:cap-token', scope: 'card transition only' }] } },
  tokenCatalog: motionCatalog,
});
assert.equal(exceptedUnknownToken.result, 'fail');
assert.deepEqual(exceptedUnknownToken.approved_exceptions, []);
await rm(unknownTokenDir, { recursive: true, force: true });

const missingReducedDir = await mkdtemp(join('/tmp', 'kinetic-motion-no-rm-'));
await writeFile(join(missingReducedDir, 'styles.css'), `.card { transition: transform var(--kinetic-duration-fast); }`);
const missingReduced = await validateMotionTokens({
  variantDir: missingReducedDir,
  brief: { motion_plan: { token_exceptions: [{ file: 'styles.css', line_or_symbol: '1', property: 'reduced-motion', raw_value: 'missing', reason: 'No animation is intended in reduced mode', evidence_ref: 'brief#motion', scope: 'styles.css reduced motion' }] } },
  tokenCatalog: motionCatalog,
});
assert.equal(missingReduced.result, 'fail');
assert.ok(missingReduced.findings.some(({ kind }) => kind === 'missing_reduced_motion'));
assert.deepEqual(missingReduced.approved_exceptions, []);
await rm(missingReducedDir, { recursive: true, force: true });

const ineffectiveReducedDir = await mkdtemp(join('/tmp', 'kinetic-motion-ineffective-rm-'));
await writeFile(join(ineffectiveReducedDir, 'empty.css'), `.card { transition: transform var(--kinetic-duration-fast); }
@media (prefers-reduced-motion: reduce) {}`);
await writeFile(join(ineffectiveReducedDir, 'commented.html'), `<!-- @media (prefers-reduced-motion: reduce) { .card { transition: none; } } -->`);
await writeFile(join(ineffectiveReducedDir, 'unrelated.js'), `const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (other.matches) { return; }`);
const ineffectiveReduced = await validateMotionTokens({
  variantDir: ineffectiveReducedDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(ineffectiveReduced.result, 'fail');
assert.equal(ineffectiveReduced.reduced_motion.found, false);
assert.ok(ineffectiveReduced.findings.some(({ kind }) => kind === 'missing_reduced_motion'));
await rm(ineffectiveReducedDir, { recursive: true, force: true });

const jsReducedDir = await mkdtemp(join('/tmp', 'kinetic-motion-js-rm-'));
await writeFile(join(jsReducedDir, 'motion.js'), `const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (reduce.matches) { return; }
const opts = { duration: tokens['duration-med'] };`);
const jsReduced = await validateMotionTokens({
  variantDir: jsReducedDir, brief: { motion_plan: { token_exceptions: [] } }, tokenCatalog: motionCatalog,
});
assert.equal(jsReduced.result, 'pass', JSON.stringify(jsReduced));
assert.equal(jsReduced.reduced_motion.found, true);
await rm(jsReducedDir, { recursive: true, force: true });

// T16: only exact, evidenced exceptions waive one matching finding.
const exceptionMotionDir = await mkdtemp(join('/tmp', 'kinetic-motion-exception-'));
await writeFile(join(exceptionMotionDir, 'styles.css'), `.special {
  transition-duration: 275ms;
}
@media (prefers-reduced-motion: reduce) { .special { transition: none; } }
`);
const exactException = { file: 'styles.css', line_or_symbol: '2', property: 'duration', raw_value: '275ms', reason: 'Cited source clip requires measured timing synchronization', evidence_ref: 'capture:cap-motion-sync', scope: 'special transition only' };
const exceptedMotion = await validateMotionTokens({
  variantDir: exceptionMotionDir, brief: { motion_plan: { token_exceptions: [exactException] } }, tokenCatalog: motionCatalog,
});
assert.equal(exceptedMotion.result, 'pass', JSON.stringify(exceptedMotion));
assert.deepEqual(exceptedMotion.findings, []);
assert.equal(exceptedMotion.approved_exceptions.length, 1);
assert.deepEqual(
  Object.fromEntries(Object.entries(exceptedMotion.approved_exceptions[0]).filter(([key]) => ['file', 'line', 'property', 'value'].includes(key))),
  { file: 'styles.css', line: 2, property: 'duration', value: '275ms' },
);
const symbolScopeDir = await mkdtemp(join('/tmp', 'kinetic-motion-symbol-scope-'));
await writeFile(join(symbolScopeDir, 'motion.js'), `const f = () => {};
const opts = { duration: 275 };`);
await writeFile(join(symbolScopeDir, 'reduced.css'), `@media (prefers-reduced-motion: reduce) { .motion { transition: none; } }`);
const leakedSymbolException = { file: 'motion.js', line_or_symbol: 'f', property: 'duration', raw_value: '275', reason: 'Source capture requires measured timing synchronization', evidence_ref: 'capture:cap-symbol', scope: 'function f only' };
const symbolScoped = await validateMotionTokens({
  variantDir: symbolScopeDir, brief: { motion_plan: { token_exceptions: [leakedSymbolException] } }, tokenCatalog: motionCatalog,
});
assert.equal(symbolScoped.result, 'fail');
assert.deepEqual(symbolScoped.approved_exceptions, []);
assert.ok(symbolScoped.findings.some(({ file, line, property }) => file === 'motion.js' && line === 2 && property === 'duration'));
await rm(symbolScopeDir, { recursive: true, force: true });
for (const invalidException of [
  { ...exactException, file: '*.css' },
  { ...exactException, reason: 'because design' },
  { ...exactException, reason: 'because design choice looks better' },
  { ...exactException, reason: 'measured measurement because design' },
  { ...exactException, reason: 'Timing constraint preserves a more beautiful aesthetic.' },
  { ...exactException, reason: 'Measured timing benchmark constraint evidence synchronization.' },
  { ...exactException, reason: 'Timing capture evidence constraint for design vibes.' },
  { ...exactException, reason: 'Source capture requires measured timing synchronization for premium design vibes and product desirability.' },
  { ...exactException, reason: 'Cited source clip requires measured timing synchronization for bananas and latency.' },
  { ...exactException, property: 'delay' },
]) {
  const rejectedException = await validateMotionTokens({
    variantDir: exceptionMotionDir, brief: { motion_plan: { token_exceptions: [invalidException] } }, tokenCatalog: motionCatalog,
  });
  assert.equal(rejectedException.result, 'fail');
  assert.deepEqual(rejectedException.approved_exceptions, []);
}
await rm(exceptionMotionDir, { recursive: true, force: true });

// T48: visual fingerprint similarity is independent from structural originality and design quality.
const fingerprint = {
  url: 'file:///reference.html',
  section_order: ['reference'], layout_sig: ['reference'], font_size_histogram: { 16: 1 },
  font_families: { serif: 1 }, color_roles: { dark: 1 }, headings: ['reference'],
  kinetic_ids: ['reference'], image_hosts: ['reference.test'],
  visual_phashes: { 'desktop/initial': '0'.repeat(64) },
};
const originality = compareOriginality(fingerprint, {
  ...fingerprint,
  url: 'file:///candidate.html',
  section_order: ['candidate'], layout_sig: ['candidate'], font_size_histogram: { 32: 1 },
  font_families: { sans: 1 }, color_roles: { light: 1 }, headings: ['candidate'],
  kinetic_ids: ['candidate'], image_hosts: ['candidate.test'],
});
assert.equal(originality.weighted_similarity, 0);
assert.equal(originality.visual_fingerprint_similarity, 1);
assert.equal('design_quality' in originality, false);
const oppositeVisual = compareOriginality(fingerprint, { ...fingerprint, url: 'file:///opposite.html', visual_phashes: { 'desktop/initial': 'f'.repeat(64) } });
assert.equal(oppositeVisual.visual_fingerprint_similarity, 0);
assert.equal(oppositeVisual.weighted_similarity, 1);

// T21: vision identity is explicit, matched, and advisory; unknown identity falls back without fabrication.
const visionRequest = createVisionRequest({
  reference_capture_ids: ['cap-reference'],
  candidate_capture_ids: ['cap-candidate'],
  variant_brief_ref: 'planning/V1/variant-brief.json',
  rubric_version: 'design-rubric@0.1',
  relevant_provenance_refs: ['retrieval/V1/receipt.json'],
  optional_fidelity_report_ref: null,
  capture_hashes: ['a'.repeat(64), 'b'.repeat(64)],
  prompt_version: 'vision-prompt@0.1',
});
assert.deepEqual(Object.keys(visionRequest), [
  'reference_capture_ids', 'candidate_capture_ids', 'variant_brief_ref', 'rubric_version',
  'relevant_provenance_refs', 'optional_fidelity_report_ref', 'capture_hashes', 'prompt_version',
]);
const humanGate = {
  status: 'KINETIC_VISION_UNVERIFIED',
  advisory_recommendation: 'HUMAN_VISUAL_GATE',
  observations: [],
  vision_receipt: null,
};
const unverifiedVisionCritic = createVisionCritic();
assert.deepEqual(unverifiedVisionCritic({ request: visionRequest, toolLabel: 'anonymous vision tool' }), humanGate);
assert.equal('score' in humanGate, false);
assert.equal('design_qualified' in humanGate, false);

const visionResponseText = JSON.stringify({
  request_sha256: createHash('sha256').update(JSON.stringify(visionRequest)).digest('hex'),
  observations: [{
  dimension: 'composition', observation: 'The candidate preserves a clear focal hierarchy.',
  kind: 'STRENGTH', severity: 'low', confidence: 0.8, evidence_capture_ids: ['cap-candidate'],
  }],
});
const visionReceipt = {
  provider: 'provider-fixture', exact_model: 'vision-model-fixture-1', route: 'provider-api',
  vision_image_capability: true, cost_status: 'UNKNOWN', limits: null,
  capture_hashes: visionRequest.capture_hashes, prompt_version: visionRequest.prompt_version,
  rubric_version: visionRequest.rubric_version,
  response_sha256: createHash('sha256').update(visionResponseText).digest('hex'),
  called_at: '2026-08-23T00:00:00.000Z',
};
const verifiedIdentity = {
  verified: true, provider: visionReceipt.provider, exact_model: visionReceipt.exact_model,
  route: visionReceipt.route, vision_image_capability: true, verification_source: 'provider-api-metadata',
};
const evaluateVisionCritic = createVisionCritic(verifiedIdentity, { case_id: 'case-fixture', variant_id: 'V1' });
const acceptedVision = evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText, receipt: visionReceipt,
});
assert.equal(acceptedVision.status, 'VERIFIED_ADVISORY');
assert.equal(acceptedVision.advisory_recommendation, 'ADVANCE_TO_HUMAN');
assert.deepEqual(acceptedVision.observations, JSON.parse(visionResponseText).observations);
assert.deepEqual(acceptedVision.vision_receipt, visionReceipt);
for (const unverified of [
  { receipt: visionReceipt, verifiedIdentity: null },
  { receipt: { ...visionReceipt, exact_model: 'anonymous' }, verifiedIdentity },
  {
    receipt: { ...visionReceipt, provider: 'anonymous', exact_model: 'vision-tool', route: 'unknown' },
    verifiedIdentity: { verified: true, provider: 'anonymous', exact_model: 'vision-tool', route: 'unknown', vision_image_capability: true, verification_source: 'provider-api-metadata' },
  },
  {
    receipt: { ...visionReceipt, provider: ' anonymous ' },
    verifiedIdentity: { ...verifiedIdentity, provider: ' anonymous ' },
  },
  { receipt: Object.fromEntries(Object.entries(visionReceipt).filter(([key]) => key !== 'provider')), verifiedIdentity },
  { receipt: { ...visionReceipt, limits: { tokens: Number.NaN } }, verifiedIdentity },
  { receipt: { ...visionReceipt, called_at: '0' }, verifiedIdentity },
  { receipt: { ...visionReceipt, response_sha256: 'f'.repeat(64) }, verifiedIdentity },
  { receipt: { ...visionReceipt, capture_hashes: ['a'.repeat(64)] }, verifiedIdentity },
  { receipt: visionReceipt, verifiedIdentity: { ...verifiedIdentity, vision_image_capability: false } },
  { receipt: visionReceipt, verifiedIdentity: { ...verifiedIdentity, verification_source: 'tool-label' } },
]) {
  assert.deepEqual(createVisionCritic(unverified.verifiedIdentity)({
    request: visionRequest, responseText: visionResponseText, receipt: unverified.receipt,
  }), humanGate);
}
assert.throws(
  () => createVisionRequest({ ...visionRequest, capture_hashes: [] }),
  (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID',
);
const inheritedRequest = Object.assign(Object.create({ prompt_version: visionRequest.prompt_version }), visionRequest, { extra: true });
delete inheritedRequest.prompt_version;
assert.throws(
  () => createVisionRequest(inheritedRequest),
  (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID',
);
for (const provider of [
  'anonymous vision tool', 'anonymous-tool', 'tool service', 'generic tool',
  'unidentified', 'N/A', 'none', 'unspecified', 'TBD', 'not known', 'redacted', 'placeholder', 'default',
]) {
  assert.deepEqual(createVisionCritic({ ...verifiedIdentity, provider })({
    request: visionRequest,
    responseText: visionResponseText,
    receipt: { ...visionReceipt, provider },
  }), humanGate);
}
for (const identityPatch of [
  { provider: 'anonymous.provider' }, { exact_model: 'unknown/model' }, { route: 'tool:api' },
  { provider: 'anonymousProvider' }, { exact_model: 'unknownModel' }, { route: 'toolAPI' },
  { route: 't.o.o.l/api' },
]) {
  assert.deepEqual(createVisionCritic({ ...verifiedIdentity, ...identityPatch })({
    request: visionRequest,
    responseText: visionResponseText,
    receipt: { ...visionReceipt, ...identityPatch },
  }), humanGate);
}
const sparseRequest = structuredClone(visionRequest);
sparseRequest.reference_capture_ids = new Array(1);
assert.throws(() => createVisionRequest(sparseRequest), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
for (const key of ['variant_brief_ref', 'rubric_version', 'prompt_version']) {
  assert.throws(() => createVisionRequest({ ...visionRequest, [key]: '   ' }), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
}
const symbolRequest = structuredClone(visionRequest);
symbolRequest[Symbol('extra')] = true;
assert.throws(() => createVisionRequest(symbolRequest), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
const hiddenRequest = structuredClone(visionRequest);
Object.defineProperty(hiddenRequest, 'extra', { value: true });
assert.throws(() => createVisionRequest(hiddenRequest), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest,
  responseText: visionResponseText,
  receipt: { ...visionReceipt, called_at: '2026-02-30T00:00:00Z' },
}), humanGate);
assert.deepEqual(evaluateVisionCritic({ request: visionRequest, responseText: null, receipt: visionReceipt }), humanGate);
let requestHashReads = 0;
const accessorRequest = { ...visionRequest };
Object.defineProperty(accessorRequest, 'capture_hashes', {
  enumerable: true,
  get: () => (requestHashReads++ < 3 ? visionRequest.capture_hashes : ['not-a-hash']),
});
assert.throws(() => createVisionRequest(accessorRequest), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
let receiptProviderReads = 0;
const accessorReceipt = { ...visionReceipt };
Object.defineProperty(accessorReceipt, 'provider', {
  enumerable: true,
  get: () => (receiptProviderReads++ < 2 ? visionReceipt.provider : 'anonymous'),
});
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText, receipt: accessorReceipt,
}), humanGate);
assert.deepEqual(unverifiedVisionCritic({
  request: visionRequest, responseText: visionResponseText, receipt: visionReceipt, verifiedIdentity,
}), humanGate, 'per-call identity data cannot replace the constructor capability');
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText,
  receipt: { ...visionReceipt, cost_status: 'VERIFIED_FREE', limits: { tokens: 1000 } },
}), humanGate, 'cost stays unknown until a provider adapter verifies it');
const replayRequest = createVisionRequest({
  ...visionRequest,
  reference_capture_ids: visionRequest.candidate_capture_ids,
  candidate_capture_ids: visionRequest.reference_capture_ids,
  variant_brief_ref: 'planning/V2/other-brief.json',
  relevant_provenance_refs: ['retrieval/V2/other-receipt.json'],
  optional_fidelity_report_ref: 'reports/other-fidelity.json',
});
assert.throws(() => evaluateVisionCritic({
  request: replayRequest, responseText: visionResponseText, receipt: visionReceipt,
}), (error) => error.code === 'KINETIC_VISION_RESPONSE_INVALID', 'receipt/response cannot replay across request roles or context');
let proxyTraps = 0;
const proxyRequest = new Proxy(visionRequest, {
  getPrototypeOf: () => { proxyTraps += 1; return Object.prototype; },
  ownKeys: (target) => { proxyTraps += 1; return Reflect.ownKeys(target); },
  getOwnPropertyDescriptor: (target, key) => { proxyTraps += 1; return Object.getOwnPropertyDescriptor(target, key); },
});
assert.throws(() => createVisionRequest(proxyRequest), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
assert.equal(proxyTraps, 0, 'Proxy traps must not execute at the plain-data boundary');
let arrayPrototypeTraps = 0;
const customPrototypeIds = ['cap-reference'];
Object.setPrototypeOf(customPrototypeIds, new Proxy(Array.prototype, {
  get: (target, key, receiver) => {
    arrayPrototypeTraps += 1;
    return Reflect.get(target, key, receiver);
  },
}));
assert.throws(
  () => createVisionRequest({ ...visionRequest, reference_capture_ids: customPrototypeIds }),
  (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID',
);
assert.equal(arrayPrototypeTraps, 0, 'custom array prototypes must be rejected without trap execution');
assert.deepEqual(createVisionRequest(visionRequest), visionRequest, 'normal arrays remain valid');
let receiptProxyTraps = 0;
const proxyReceipt = new Proxy(visionReceipt, {
  getPrototypeOf: () => { receiptProxyTraps += 1; return Object.prototype; },
  ownKeys: (target) => { receiptProxyTraps += 1; return Reflect.ownKeys(target); },
});
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText, receipt: proxyReceipt,
}), humanGate);
assert.equal(receiptProxyTraps, 0);
let identityProxyTraps = 0;
const proxyIdentity = new Proxy(verifiedIdentity, {
  getPrototypeOf: () => { identityProxyTraps += 1; return Object.prototype; },
  ownKeys: (target) => { identityProxyTraps += 1; return Reflect.ownKeys(target); },
});
assert.deepEqual(createVisionCritic(proxyIdentity)({
  request: visionRequest, responseText: visionResponseText, receipt: visionReceipt,
}), humanGate);
assert.equal(identityProxyTraps, 0);
let limitsProxyTraps = 0;
const proxyLimits = new Proxy({}, {
  getPrototypeOf: () => { limitsProxyTraps += 1; throw new Error('LIMITS_TRAP_EXECUTED'); },
});
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest,
  responseText: visionResponseText,
  receipt: { ...visionReceipt, limits: proxyLimits },
}), humanGate);
assert.equal(limitsProxyTraps, 0);
const revokedRequest = Proxy.revocable(visionRequest, {});
revokedRequest.revoke();
assert.throws(() => createVisionRequest(revokedRequest.proxy), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
const revokedLimits = Proxy.revocable({}, {});
revokedLimits.revoke();
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest,
  responseText: visionResponseText,
  receipt: { ...visionReceipt, limits: revokedLimits.proxy },
}), humanGate);
let envelopeTraps = 0;
const proxyEnvelope = new Proxy({ request: visionRequest, responseText: visionResponseText, receipt: visionReceipt }, {
  get: (target, key, receiver) => { envelopeTraps += 1; return Reflect.get(target, key, receiver); },
  getPrototypeOf: () => { envelopeTraps += 1; return Object.prototype; },
});
assert.deepEqual(evaluateVisionCritic(proxyEnvelope), humanGate);
assert.equal(envelopeTraps, 0);
let envelopeGetterReads = 0;
const accessorEnvelope = { responseText: visionResponseText, receipt: visionReceipt };
Object.defineProperty(accessorEnvelope, 'request', {
  enumerable: true,
  get: () => { envelopeGetterReads += 1; return visionRequest; },
});
assert.deepEqual(evaluateVisionCritic(accessorEnvelope), humanGate);
assert.equal(envelopeGetterReads, 0);
const revokedEnvelope = Proxy.revocable({ request: visionRequest }, {});
revokedEnvelope.revoke();
assert.deepEqual(evaluateVisionCritic(revokedEnvelope.proxy), humanGate);
const accessorValue = (counter) => Object.defineProperty({}, 'unsafe', {
  enumerable: true,
  get: () => { counter.reads += 1; return 'unsafe'; },
});
const requestScalarCounter = { reads: 0 };
assert.throws(() => createVisionRequest({
  ...visionRequest, variant_brief_ref: accessorValue(requestScalarCounter),
}), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
assert.equal(requestScalarCounter.reads, 0);
const requestArrayCounter = { reads: 0 };
assert.throws(() => createVisionRequest({
  ...visionRequest, relevant_provenance_refs: [accessorValue(requestArrayCounter)],
}), (error) => error.code === 'KINETIC_VISION_REQUEST_INVALID');
assert.equal(requestArrayCounter.reads, 0);
const receiptScalarCounter = { reads: 0 };
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText,
  receipt: { ...visionReceipt, provider: accessorValue(receiptScalarCounter) },
}), humanGate);
assert.equal(receiptScalarCounter.reads, 0);
const receiptArrayCounter = { reads: 0 };
assert.deepEqual(evaluateVisionCritic({
  request: visionRequest, responseText: visionResponseText,
  receipt: { ...visionReceipt, capture_hashes: [accessorValue(receiptArrayCounter), 'b'.repeat(64)] },
}), humanGate);
assert.equal(receiptArrayCounter.reads, 0);
const identityScalarCounter = { reads: 0 };
assert.deepEqual(createVisionCritic({
  ...verifiedIdentity, provider: accessorValue(identityScalarCounter),
})({ request: visionRequest, responseText: visionResponseText, receipt: visionReceipt }), humanGate);
assert.equal(identityScalarCounter.reads, 0);

// T22: every rubric dimension is present and every visual claim cites ready capture evidence.
const designQualitySchema = parsed.get('schemas/gym/design-quality-evaluation.schema.json');
const designManifest = captureManifestFixture();
const designRefs = {
  capture_manifest: 'runs/case-fixture/captures/manifest.json',
  variant_brief: visionRequest.variant_brief_ref,
  retrieval_receipt: visionRequest.relevant_provenance_refs[0],
};
const aiDesignEvaluation = designEvaluationFixture({
  visionReceipt, briefRef: designRefs.variant_brief, provenanceRefs: [designRefs.retrieval_receipt],
});
aiDesignEvaluation.dimensions = Object.fromEntries(RUBRIC_DIMENSIONS.map((dimension) => [dimension, rubricDimensionFixture('ai-critic', false)]));
const compositionObservation = acceptedVision.observations[0];
aiDesignEvaluation.dimensions.composition = {
  status: 'STRENGTH', observations: [compositionObservation.observation], strengths: [compositionObservation.observation],
  failures: [], severity: compositionObservation.severity, confidence: compositionObservation.confidence,
  evidence_capture_ids: compositionObservation.evidence_capture_ids, producer: 'ai-critic',
};
const validateFixtureDesign = (evaluation, criticResult = acceptedVision) => validateDesignQualityEvaluation({
  evaluation, captureManifest: designManifest, caseId: 'case-fixture', variantId: 'V1', expectedRefs: designRefs, criticResult,
});
valid(aiDesignEvaluation, designQualitySchema, join(root, 'schemas', 'gym', 'design-quality-evaluation.schema.json'));
assert.deepEqual(validateFixtureDesign(aiDesignEvaluation), aiDesignEvaluation);
const unknownCaptureEvaluation = structuredClone(aiDesignEvaluation);
unknownCaptureEvaluation.dimensions.composition.evidence_capture_ids = ['cap-missing'];
assert.throws(() => validateFixtureDesign(unknownCaptureEvaluation), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID');
const unsupportedClaimEvaluation = structuredClone(aiDesignEvaluation);
unsupportedClaimEvaluation.dimensions.motion = rubricDimensionFixture('ai-critic', false);
unsupportedClaimEvaluation.dimensions.motion.observations = ['Unsupported motion claim.'];
assert.throws(() => validateFixtureDesign(unsupportedClaimEvaluation), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID');
assert.throws(() => validateFixtureDesign(aiDesignEvaluation, structuredClone(acceptedVision)),
  (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID', 'serialized critic output cannot recreate trusted identity');
assert.throws(() => validateFixtureDesign(aiDesignEvaluation, null),
  (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID', 'receipt strings alone cannot claim verified AI evidence');
const contextlessVision = createVisionCritic(verifiedIdentity)({
  request: visionRequest, responseText: visionResponseText, receipt: visionReceipt,
});
assert.equal(contextlessVision.status, 'VERIFIED_ADVISORY');
assert.throws(() => validateFixtureDesign(aiDesignEvaluation, contextlessVision),
  (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID', 'S15 requires trusted case and variant context');
const caseReplayEvaluation = structuredClone(aiDesignEvaluation);
caseReplayEvaluation.evaluation_id = 'dqe-other-fixture-v1';
caseReplayEvaluation.case_id = 'case-other-fixture';
assert.throws(() => validateDesignQualityEvaluation({
  evaluation: caseReplayEvaluation, captureManifest: captureManifestFixture('case-other-fixture'),
  caseId: 'case-other-fixture', variantId: 'V1', criticResult: acceptedVision, expectedRefs: designRefs,
}), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID', 'critic capability cannot replay when only case identity changes');
const variantReplayEvaluation = structuredClone(aiDesignEvaluation);
variantReplayEvaluation.evaluation_id = 'dqe-fixture-v2';
variantReplayEvaluation.variant_id = 'V2';
assert.throws(() => validateDesignQualityEvaluation({
  evaluation: variantReplayEvaluation, captureManifest: captureManifestFixture('case-fixture', 'V2'),
  caseId: 'case-fixture', variantId: 'V2', criticResult: acceptedVision, expectedRefs: designRefs,
}), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID', 'critic capability cannot replay when only variant identity changes');
let designProxyTraps = 0;
const proxiedDimensions = new Proxy(aiDesignEvaluation.dimensions, {
  ownKeys() { designProxyTraps += 1; return Reflect.ownKeys(aiDesignEvaluation.dimensions); },
});
assert.throws(() => validateFixtureDesign({ ...aiDesignEvaluation, dimensions: proxiedDimensions }),
  (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID');
assert.equal(designProxyTraps, 0, 'S15 rejects nested proxies before reflection');
let designGetterReads = 0;
const getterDimension = { ...aiDesignEvaluation.dimensions.composition };
Object.defineProperty(getterDimension, 'status', {
  enumerable: true,
  get() { designGetterReads += 1; return 'ACCEPTABLE'; },
});
assert.throws(() => validateFixtureDesign({
  ...aiDesignEvaluation, dimensions: { ...aiDesignEvaluation.dimensions, composition: getterDimension },
}), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_INVALID');
assert.equal(designGetterReads, 0, 'S15 rejects getters without executing them');
const humanDesignGate = designEvaluationFixture({
  producer: 'human', briefRef: designRefs.variant_brief, provenanceRefs: [designRefs.retrieval_receipt],
});
valid(humanDesignGate, designQualitySchema, join(root, 'schemas', 'gym', 'design-quality-evaluation.schema.json'));
assert.deepEqual(validateDesignQualityEvaluation({
  evaluation: humanDesignGate, captureManifest: designManifest,
  caseId: 'case-fixture', variantId: 'V1', expectedRefs: designRefs, criticResult: null,
}), humanDesignGate);

// T23: score-only and qualification-shaped outputs are outside the rubric contract.
invalid({ schema: 'kinetic/gym/design-quality-evaluation@0.1', aggregate_score: 0.9 }, designQualitySchema);
invalid({ ...aiDesignEvaluation, score: 0.9 }, designQualitySchema);
invalid({ ...aiDesignEvaluation, design_qualified: true }, designQualitySchema);
invalid({ ...aiDesignEvaluation, acceptable_for_further_taste_learning: true }, designQualitySchema);
invalid({ ...humanDesignGate, vision_receipt: visionReceipt }, designQualitySchema);
invalid({ ...aiDesignEvaluation, vision_receipt: null }, designQualitySchema);
invalid({ ...aiDesignEvaluation, vision_receipt: { ...visionReceipt, cost_status: 'VERIFIED_FREE' } }, designQualitySchema);

// T24: DESIGN_EVALUATED means durable rubric evidence exists, never design/taste qualification.
const visualRecord = {
  schema: 'kinetic/gym/variant-run@0.2', run_id: 'run-fixture-v1', case_id: 'case-fixture', slot: 'V1', mode: 'original',
  state: 'VISUAL_CAPTURED', attempt: 1, deployable: true, original_work: true,
  technically_qualified: true, design_qualified: null, acceptable_for_further_taste_learning: null,
  refs: { variant_brief: designRefs.variant_brief, retrieval_receipt: designRefs.retrieval_receipt, prebuild_review: null, build_receipt: null, technical_evaluation: null, capture_manifest: designRefs.capture_manifest, design_evaluation: null, fidelity_report: null },
  attempts: [], blocked_condition: null, timestamps: { VISUAL_CAPTURED: '2026-08-22T00:00:00Z' },
};
const visualCase = {
  schema: 'kinetic/gym/case-run@0.2', case_id: 'case-fixture', slots: { V1: visualRecord },
  reports: { fidelity: null, source_to_output_loss: null, review_package: null }, review_state: 'NOT_READY',
  taste_decision_ref: null, blocked_condition: null, history: [],
  created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z',
};
const designArtifactRefs = { design_evaluation: 'runs/case-fixture/reports/design-evaluation-v1.json', design_evaluation_validated: true };
const designTransition = applyTransition({ caseRun: visualCase, slot: 'V1', toState: 'DESIGN_EVALUATED', artifactRefs: designArtifactRefs, now: '2026-08-22T00:00:01Z' });
assert.equal(designTransition.slots.V1.state, 'DESIGN_EVALUATED');
assert.equal(designTransition.slots.V1.technically_qualified, true);
assert.equal(designTransition.slots.V1.design_qualified, null);
assert.equal(designTransition.slots.V1.acceptable_for_further_taste_learning, null);
assert.equal(designTransition.slots.V1.refs.design_evaluation, designArtifactRefs.design_evaluation);
assert.throws(() => assertTransition({
  caseRun: visualCase, slot: 'V1', toState: 'DESIGN_EVALUATED', artifactRefs: {},
}), (error) => error.code === 'KINETIC_DESIGN_EVALUATION_REQUIRED');
assert.throws(() => assertTransition({
  caseRun: { ...visualCase, slots: { V1: { ...visualRecord, design_qualified: true } } },
  slot: 'V1', toState: 'DESIGN_EVALUATED', artifactRefs: designArtifactRefs,
}), (error) => error.code === 'KINETIC_DESIGN_QUALIFICATION_FORBIDDEN');
assert.throws(() => assertTransition({
  caseRun: visualCase, slot: 'V1', toState: 'DESIGN_EVALUATED',
  artifactRefs: { ...designArtifactRefs, design_qualified: true },
}), (error) => error.code === 'KINETIC_QUALIFICATION_EXPLICIT_REQUIRED');

console.log(`S01-S19 contract foundations: PASS (T1-T16, T21-T31, T39-T44, T46, T48, CV01-CV18, registry ${registryHashAfter})`);
