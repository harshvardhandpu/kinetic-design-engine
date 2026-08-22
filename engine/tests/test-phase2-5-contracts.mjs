#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const caseRun = parsed.get('schemas/gym/case-run.schema.json');
assert.equal(caseRun.properties.schema.const, 'kinetic/gym/case-run@0.2');
assert.equal(caseRun.properties.slots.additionalProperties.$ref, 'variant-run.schema.json#/$defs/phase25');

const runtimeFiles = [
  'engine/core/schema-validate.mjs',
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
  await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' }, `${path} must remain absent in S01`);
}

console.log(`S01 schema foundations: PASS (${schemaFiles.length} schemas, ${ids.length} unique ids)`);
