#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateValue } from '../core/schema-validate.mjs';
import { resolveToolPlan } from '../knowledge/tool-resolver.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = join(root, 'schemas/gym/tool-knowledge.schema.json');
const planSchemaPath = join(root, 'schemas/gym/tool-plan.schema.json');
const catalogSchemaPath = join(root, 'schemas/gym/tool-catalog.schema.json');
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const planSchema = JSON.parse(await readFile(planSchemaPath, 'utf8'));
const catalogSchema = JSON.parse(await readFile(catalogSchemaPath, 'utf8'));

function provider(overrides) {
  return {
    schema: 'kinetic/gym/tool-knowledge@0.1',
    tool: overrides.provider_id,
    kind: 'tool',
    version_checked: { version: 'test', date: '2026-09-04' },
    status: 'active',
    integration_status: 'sandboxed',
    provider_id: 'tool-fixture',
    category: 'COMPONENT_LIBRARY',
    capabilities: [{ capability: 'motion.hero' }],
    frameworks: ['react', 'web'],
    integration_mode: 'cli_copy',
    rights_status: 'verified_open',
    cost_class: 'free',
    requires_account: false,
    requires_secret: false,
    secret_name: null,
    network_required: false,
    autonomous_allowed: true,
    human_required: false,
    priority: 50,
    fallbacks: [],
    lifecycle_stage: 'build',
    installable_as_component: true,
    ...overrides,
  };
}

const fixtures = [
  provider({
    provider_id: 'tool-react-bits', tool: 'React Bits',
    capabilities: [
      { capability: 'motion.hero' }, { capability: 'motion.cursor' },
      { capability: 'visual.webgl' }, { capability: 'component.cards' },
      { capability: 'three.webgl' },
    ],
    priority: 20, category: 'COMPONENT_LIBRARY', rights_status: 'verified_open_with_clause',
  }),
  provider({
    provider_id: 'tool-skiper-ui', tool: 'Skiper UI',
    capabilities: [{ capability: 'motion.hero' }, { capability: 'component.cards' }, { capability: 'component.carousel' }],
    priority: 25, category: 'COMPONENT_REGISTRY', rights_status: 'mixed_free_and_licensed', cost_class: 'freemium',
  }),
  provider({
    provider_id: 'tool-vengeance-ui', tool: 'Vengeance UI',
    capabilities: [{ capability: 'motion.hero' }, { capability: 'visual.webgl' }, { capability: 'component.cards' }],
    priority: 30, rights_status: 'unverified',
  }),
  provider({
    provider_id: 'tool-threeui', tool: 'ThreeUI Community',
    capabilities: [{ capability: 'three.webgl' }, { capability: 'three.shader' }, { capability: 'visual.webgl' }],
    priority: 15, category: 'WEBGL_3D_LIBRARY', integration_mode: 'npm',
  }),
  provider({
    provider_id: 'tool-animmaster', tool: 'Animmaster Lib',
    capabilities: [{ capability: 'motion.hero' }, { capability: 'motion.physics' }, { capability: 'motion.webgl' }],
    priority: 40, category: 'MOTION_LIBRARY', rights_status: 'verified_proprietary',
    cost_class: 'paid', autonomous_allowed: false, human_required: true, entitlement_id: 'animmaster',
  }),
  provider({
    provider_id: 'tool-meigen', tool: 'MeiGen', kind: 'mcp',
    capabilities: [{ capability: 'visual.generative' }, { capability: 'visual.image' }],
    priority: 60, category: 'AI_ASSET_GENERATOR', cost_class: 'metered',
    requires_account: true, requires_secret: true, secret_name: 'MEIGEN_API_TOKEN',
    network_required: true, integration_mode: 'mcp', installable_as_component: false,
  }),
  provider({
    provider_id: 'tool-metalforge', tool: 'MetalForge',
    capabilities: [{ capability: 'three.shader' }],
    frameworks: ['swiftui', 'native'], priority: 80, category: 'SHADER_TOOL',
    cost_class: 'freemium', human_required: true, autonomous_allowed: false, installable_as_component: false,
  }),
  provider({
    provider_id: 'tool-strix', tool: 'Strix',
    capabilities: [{ capability: 'security.application' }],
    frameworks: ['web', 'any'], priority: 10, category: 'SECURITY_VALIDATOR',
    lifecycle_stage: 'after_build', integration_mode: 'cli', installable_as_component: false,
    requires_secret: true, secret_name: 'LLM_API_KEY', network_required: true,
  }),
  provider({
    provider_id: 'tool-seesaw', tool: 'SeeSaw',
    capabilities: [{ capability: 'research.reference-discovery' }],
    priority: 90, category: 'REFERENCE_DISCOVERY_PROVIDER', integration_mode: 'research_only',
    installable_as_component: false, autonomous_allowed: false, human_required: true,
  }),
  provider({
    provider_id: 'tool-unknown-rights', tool: 'Unknown Source',
    capabilities: [{ capability: 'motion.hero' }],
    priority: 99, rights_status: 'unknown',
  }),
];

function ids(rows) { return rows.map((row) => row.provider_id); }
function assertValidPlan(plan) {
  const result = validateValue({ value: plan, schema: planSchema, schemaPath: planSchemaPath });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
}

const reactHero = resolveToolPlan({
  needs: ['motion.hero'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assertValidPlan(reactHero);
assert.ok(ids(reactHero.ranked).includes('tool-react-bits'));
assert.ok(ids(reactHero.ranked).includes('tool-skiper-ui'));
assert.ok(!ids(reactHero.installable).includes('tool-animmaster'), '1: unpaid Animmaster is not installable');
assert.ok(!ids(reactHero.installable).includes('tool-vengeance-ui'), '1: unverified rights fail closed');
assert.ok(!ids(reactHero.installable).includes('tool-unknown-rights'));

const webgl = resolveToolPlan({
  needs: ['visual.webgl', 'three.webgl'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assertValidPlan(webgl);
assert.ok(ids(webgl.ranked).includes('tool-threeui'));
assert.ok(ids(webgl.ranked).includes('tool-react-bits'));
assert.ok(!ids(webgl.installable).includes('tool-vengeance-ui'));

const animmaster = resolveToolPlan({
  needs: ['motion.physics'],
  project: { frameworks: ['web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assert.ok(animmaster.excluded.some((row) => row.provider_id === 'tool-animmaster' && row.code === 'KINETIC_TOOL_PAID_NO_ENTITLEMENT'));
assert.ok(!ids(animmaster.installable).includes('tool-animmaster'));

const meigenMissing = resolveToolPlan({
  needs: ['visual.image'],
  project: { frameworks: ['web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assertValidPlan(meigenMissing);
assert.ok(meigenMissing.excluded.some((row) => row.provider_id === 'tool-meigen' && row.code === 'KINETIC_TOOL_SECRET_MISSING'));
assert.ok(!ids(meigenMissing.installable).includes('tool-meigen'));

const nativeShader = resolveToolPlan({
  needs: ['three.shader'],
  project: { frameworks: ['web', 'react'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assert.ok(!ids(nativeShader.ranked).includes('tool-metalforge'));
assert.ok(nativeShader.excluded.some((row) => row.provider_id === 'tool-metalforge' && row.code === 'KINETIC_TOOL_FRAMEWORK_INCOMPATIBLE'));
assert.ok(ids(nativeShader.installable).includes('tool-threeui'));

const security = resolveToolPlan({
  needs: ['security.application'],
  project: { frameworks: ['web'] },
  entitlements: [],
  secrets: { LLM_API_KEY: 'present' },
  catalog: fixtures,
});
assertValidPlan(security);
assert.deepEqual(ids(security.ranked), ['tool-strix']);
assert.equal(security.security.influences_taste, false);
assert.equal(security.security.lifecycle_stage, 'after_build');
assert.ok(!('design_qualified' in security));
assert.ok(!('acceptable_for_further_taste_learning' in security));

const research = resolveToolPlan({
  needs: ['research.reference-discovery'],
  project: { frameworks: ['web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assert.ok(ids(research.ranked).includes('tool-seesaw') || research.suggestions.some((row) => row.provider_id === 'tool-seesaw'));
assert.ok(!ids(research.installable).includes('tool-seesaw'));
assert.ok(research.excluded.some((row) => row.provider_id === 'tool-seesaw' && row.code === 'KINETIC_TOOL_RESEARCH_NOT_INSTALLABLE')
  || research.ranked.every((row) => row.provider_id !== 'tool-seesaw' || row.installable !== true));

const unknown = resolveToolPlan({
  needs: ['motion.hero'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assert.ok(unknown.excluded.some((row) => row.provider_id === 'tool-unknown-rights' && row.code === 'KINETIC_TOOL_RIGHTS_UNKNOWN'));

const empty = resolveToolPlan({
  needs: ['motion.hero'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: [],
});
assertValidPlan(empty);
assert.deepEqual(empty.ranked, []);
assert.deepEqual(empty.installable, []);

const once = resolveToolPlan({
  needs: ['motion.hero', 'visual.webgl'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
const twice = resolveToolPlan({
  needs: ['visual.webgl', 'motion.hero'],
  project: { frameworks: ['web', 'react'] },
  entitlements: [],
  secrets: {},
  catalog: fixtures,
});
assert.equal(JSON.stringify(once), JSON.stringify(twice));

const production = JSON.parse(await readFile(join(root, 'gym/knowledge/tools/catalog.json'), 'utf8'));
assert.equal(validateValue({ value: production, schema: catalogSchema, schemaPath: catalogSchemaPath }).valid, true);
for (const entry of production.providers) {
  const result = validateValue({ value: entry, schema, schemaPath });
  assert.equal(result.valid, true, `${entry.provider_id}: ${JSON.stringify(result.errors)}`);
}
const live = resolveToolPlan({
  needs: ['motion.hero'],
  project: { frameworks: ['react', 'web'] },
  entitlements: [],
  secrets: {},
  catalog: production.providers,
});
assertValidPlan(live);
assert.ok(Array.isArray(live.ranked));

console.log('Tool intelligence resolver: PASS (10 fixture cases + production catalog load)');
