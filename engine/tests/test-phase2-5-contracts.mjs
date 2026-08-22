#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateFile, validateValue } from '../core/schema-validate.mjs';
import { hashFile } from '../runner/store.mjs';
import { assertTransition, assertVariantBriefPolicy, TransitionError } from '../runner/state-machine.mjs';
import { retrieveKnowledge } from '../knowledge/retrieval.mjs';
import { searchVault } from '../knowledge/obsidian-adapter.mjs';
import { generateMirror } from '../cli/gen-obsidian-mirror.mjs';
import { reviewBrief } from '../planning/prebuild-review.mjs';
import * as sourceRegistry from '../knowledge/source-registry.mjs';

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

  const decision = { schema: 'kinetic/gym/taste-decision@0.2', decision_id: 'td-20260822-fixture', context: { case_id: 'case-fixture', batch_id: 'batch-fixture', surface: 'portfolio', goal: 'quality' }, candidates: ['V1', 'V2'], outcome: { result: 'REJECT_ALL', relative_preference: 'neither', winner: null, candidate_decisions: { V1: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' }, V2: { quality_floor_passed: false, acceptable_for_further_taste_learning: false, reason: 'weak' } } }, reason_tags: [], freeform: null, reviewer: 'human-fixture', supersedes: null, timestamp: '2026-08-22T00:00:00Z' };
  const phase25Taste = { $defs: taste.$defs, $ref: '#/$defs/phase25' };
  valid(decision, phase25Taste, join(root, 'schemas', 'gym', 'taste-decision.schema.json'));
  invalid({ ...decision, outcome: { ...decision.outcome, candidate_decisions: {} } }, phase25Taste);

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

console.log(`S01-S08 contract foundations: PASS (T1-T13, T39-T41, CV01-CV18, registry ${registryHashAfter})`);
