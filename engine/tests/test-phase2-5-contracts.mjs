#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile, validateValue } from '../core/schema-validate.mjs';

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

const runtimeFiles = [
  'engine/runner/state-machine.mjs',
  'engine/runner/store.mjs',
  'engine/knowledge/source-registry.mjs',
  'engine/knowledge/retrieval.mjs',
  'engine/knowledge/obsidian-adapter.mjs',
  'engine/planning/prebuild-review.mjs',
  'engine/cli/capture.mjs',
  'engine/evaluator/vision-critic.mjs',
];
for (const path of runtimeFiles) {
  await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' }, `${path} must remain absent before its slice`);
}

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

const tempDir = await mkdtemp(join(root, 'schemas', 'gym', '.s02-'));
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
    attempts: [], timestamps: {},
  };
  const caseRun = { schema: 'kinetic/gym/case-run@0.2', case_id: 'case-fixture', slots: { V0: phase25Run }, reports: { fidelity: null, source_to_output_loss: null, review_package: null }, review_state: 'NOT_READY', history: [], created_at: '2026-08-22T00:00:00Z', updated_at: '2026-08-22T00:00:00Z' };
  valid(caseRun, caseRunSchema, join(root, 'schemas', 'gym', 'case-run.schema.json'));
  invalid({ ...caseRun, slots: { V0: { ...phase25Run, design_qualified: true } } }, caseRunSchema, 'KINETIC_SCHEMA_INVALID', join(root, 'schemas', 'gym', 'case-run.schema.json'));

  const strings = ['specific'];
  const influence = { source_id: 'src-fixture', retrieval_reason: 'specific reason', knowledge_used: strings, usage_mode: 'PRINCIPLE', attribution: [{ knowledge_index: 0, classification: 'SOURCE-DERIVED', evidence_refs: ['receipt#/source'] }] };
  const brief = {
    schema: 'kinetic/gym/variant-brief@0.1', variant_id: 'V1', case_id: 'case-fixture', design_case_ids_used: ['case-reference'], surface: 'portfolio', goal: 'prove quality', direction_name: 'Fixture', core_concept: 'Structured contrast',
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

  const decision = { schema: 'kinetic/gym/taste-decision@0.2', decision_id: 'td-20260822-fixture', context: { case_id: 'case-fixture', batch_id: 'batch-fixture', surface: 'portfolio', goal: 'quality' }, candidates: ['V1', 'V2'], outcome: { result: 'REJECT_ALL', relative_preference: 'neither', winner: null, candidate_decisions: { V1: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' }, V2: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' } } }, reason_tags: [], freeform: null, reviewer: 'human-fixture', supersedes: null, timestamp: '2026-08-22T00:00:00Z' };
  const phase25Taste = { $defs: taste.$defs, $ref: '#/$defs/phase25' };
  valid(decision, phase25Taste, join(root, 'schemas', 'gym', 'taste-decision.schema.json'));
  invalid({ ...decision, outcome: { ...decision.outcome, candidate_decisions: {} } }, phase25Taste);

  const registry = JSON.parse(await readFile(join(root, 'gym', 'knowledge', 'sources', 'registry.json'), 'utf8'));
  valid(registry.sources[0].audit, JSON.parse(await readFile(join(root, 'schemas', 'gym', 'source-audit-record.schema.json'), 'utf8')), join(root, 'schemas', 'gym', 'source-audit-record.schema.json'));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log(`S01/S02 contract foundations: PASS (${schemaFiles.length} schemas, ${ids.length} unique ids, CV01-CV18)`);
