import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFile } from '../core/schema-validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_REGISTRY = join(root, 'gym', 'knowledge', 'sources', 'registry.json');
const DEFAULT_SCHEMA = join(root, 'schemas', 'gym', 'source-registry.schema.json');
const ABSTRACT_MODES = new Set(['PRINCIPLE', 'PATTERN', 'COMPARISON_REFERENCE']);
const AUTOMATED_OPERATIONS = new Set(['automated_fetch', 'capture', 'crawl', 'browser_fetch']);
const POLICY_KEYS = [
  'source_id', 'canonical_url', 'license_status', 'terms_url', 'license_url',
  'rights_status', 'ai_training_status', 'automated_access', 'asset_copy',
  'code_ingest', 'credential_required', 'attribution_required',
  'license_retention_required', 'inspection_quality', 'last_verified_at',
  'evidence_urls', 'ingestion_modes', 'tier_policies', 'audit',
];

let activeRegistry = null;

export class RightsError extends Error {
  constructor(code, message, decision = null) {
    super(message);
    this.name = 'RightsError';
    this.code = code;
    this.decision = decision;
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function normalizedPolicySnapshot(registry) {
  return registry.sources
    .map((source) => Object.fromEntries(POLICY_KEYS.filter((key) => key in source).map((key) => [key, stableObject(source[key])])))
    .sort((a, b) => a.source_id.localeCompare(b.source_id));
}

export function canonicalizeSourceUrl(value) {
  const url = new URL(value);
  url.hash = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function registryOrThrow() {
  if (!activeRegistry) throw new RightsError('KINETIC_REGISTRY_INVALID', 'source registry has not been loaded');
  return activeRegistry;
}

export async function loadSourceRegistry({ registryPath = DEFAULT_REGISTRY, schemaPath = DEFAULT_SCHEMA } = {}) {
  const validation = await validateFile({ artifactPath: registryPath, schemaPath });
  if (!validation.valid) throw new RightsError('KINETIC_REGISTRY_INVALID', 'source registry failed schema validation', validation.errors);
  const parsed = JSON.parse(await readFile(registryPath, 'utf8'));
  const ids = parsed.sources.map(({ source_id }) => source_id);
  const urls = parsed.sources.map(({ canonical_url }) => canonicalizeSourceUrl(canonical_url));
  if (parsed.registry_version !== '0.1.2' || parsed.sources.length !== 27 || new Set(ids).size !== 27 || new Set(urls).size !== 27) {
    throw new RightsError('KINETIC_REGISTRY_INVALID', 'registry must remain version 0.1.2 with 27 unique source IDs and canonical URLs');
  }
  activeRegistry = deepFreeze(structuredClone(parsed));
  return activeRegistry;
}

export function lookupSource(sourceId) {
  const source = registryOrThrow().sources.find((candidate) => candidate.source_id === sourceId);
  if (!source) throw new RightsError('KINETIC_SOURCE_NOT_FOUND', `unknown source: ${sourceId}`);
  return source;
}

export function readSourceAudit(sourceId) {
  return lookupSource(sourceId).audit;
}

function decisionFor(source, usageMode, operation, effectiveMode, obligations = [], warnings = []) {
  if (source.attribution_required) obligations.push('ATTRIBUTION_REQUIRED');
  if (source.license_retention_required) obligations.push('LICENSE_RETENTION_REQUIRED');
  if (source.ai_training_status === 'EXPLICITLY_PROHIBITED') warnings.push('NO_MODEL_WEIGHT_TRAINING');
  if (source.automated_access === 'UNKNOWN') warnings.push('AUTOMATED_ACCESS_UNVERIFIED');
  return deepFreeze({
    allowed: true,
    source_id: source.source_id,
    usage_mode: usageMode,
    operation,
    effective_mode: effectiveMode,
    obligations: [...new Set(obligations)],
    warnings: [...new Set(warnings)],
    evidence_urls: [...source.evidence_urls],
    registry_version: registryOrThrow().registry_version,
  });
}

function deny(code, source, usageMode, operation, message) {
  const decision = deepFreeze({
    allowed: false,
    code,
    source_id: source.source_id,
    usage_mode: usageMode,
    operation,
    effective_mode: null,
    obligations: [],
    warnings: [],
    evidence_urls: [...source.evidence_urls],
    registry_version: registryOrThrow().registry_version,
  });
  throw new RightsError(code, message, decision);
}

function hasEntitlement(entitlementRefs) {
  return Array.isArray(entitlementRefs) && entitlementRefs.length > 0 && entitlementRefs.every((ref) => typeof ref === 'string' && ref.length > 0);
}

function candidateLocalTarget(targetPath) {
  if (typeof targetPath !== 'string' || targetPath.length === 0 || targetPath.includes('\0')) return false;
  const normalized = normalize(targetPath).split(sep).join('/');
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized.startsWith('/')) return false;
  return /^gym\/runs\/case-[0-9a-z-]+\/variants\/v[012](?:\/|$)/.test(normalized);
}

export function authorizeSourceUse({ sourceId, usageMode, operation, targetPath = null, entitlementRefs = [] }) {
  const source = lookupSource(sourceId);
  const modes = new Set(source.ingestion_modes);

  if (AUTOMATED_OPERATIONS.has(operation) && (source.automated_access !== 'ALLOWED' || modes.has('NO_AUTOMATED_INGEST'))) {
    deny('KINETIC_AUTOMATION_DENIED', source, usageMode, operation, 'automated access is not explicitly allowed');
  }
  if (source.rights_status === 'NO_INGEST') deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'source denies ingestion');
  const entitlementGatedUse = source.rights_status === 'LICENSE_GATED'
    || (modes.has('LICENSE_GATED_RUNTIME') && !ABSTRACT_MODES.has(usageMode))
    || (source.credential_required && !['manual_reference', 'metadata'].includes(operation));
  if (entitlementGatedUse && !hasEntitlement(entitlementRefs)) {
    deny('KINETIC_ENTITLEMENT_REQUIRED', source, usageMode, operation, 'a non-secret entitlement reference is required');
  }

  if (source.rights_status === 'TOOL_DISCOVERY_ONLY') {
    if (usageMode === 'TOOL' && operation === 'tool_discovery' && modes.has('TOOL_DISCOVERY_ONLY')) return decisionFor(source, usageMode, operation, 'TOOL_DISCOVERY_ONLY', [], ['NOT_DESIGN_EVIDENCE']);
    deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'tool discovery cannot authorize design knowledge or implementation');
  }

  if (usageMode === 'BUILD_DEPENDENCY' || operation === 'build_dependency') {
    if (!modes.has('BUILD_TIME_LIBRARY')) deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'source is not approved as a build-time library');
    if (!candidateLocalTarget(targetPath)) deny('KINETIC_TARGET_FORBIDDEN', source, usageMode, operation, 'build-time dependency target must remain candidate-local');
    return decisionFor(source, usageMode, operation, 'BUILD_TIME_LIBRARY', ['CANDIDATE_LOCAL_ONLY']);
  }

  if (operation === 'asset_copy') {
    if (source.asset_copy === 'ALLOWED') return decisionFor(source, usageMode, operation, 'ASSET_COPY', ['RECORD_SOURCE_VERSION']);
    if (source.asset_copy === 'PER_ITEM' && hasEntitlement(entitlementRefs)) return decisionFor(source, usageMode, operation, 'ASSET_COPY_PER_ITEM', ['EXACT_ITEM_RIGHTS_EVIDENCE']);
    deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'asset copying is not allowed');
  }

  if (usageMode === 'RECIPE' || usageMode === 'PRIMITIVE' || operation === 'code_ingest') {
    if (source.rights_status !== 'ALLOW_CODE_INGEST' || !modes.has('CODE_RECIPE_INGEST') || source.code_ingest !== 'ALLOWED') {
      deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'exact code ingestion is not allowed for this route');
    }
    return decisionFor(source, usageMode, operation, 'CODE_RECIPE_INGEST', ['RECORD_SOURCE_VERSION']);
  }

  if (source.rights_status === 'ALLOW_METADATA_ONLY') {
    if (operation === 'metadata' && usageMode === 'COMPARISON_REFERENCE') return decisionFor(source, usageMode, operation, 'METADATA_ONLY', [], ['NOT_SUBSTANTIVE_DESIGN_GROUNDING']);
    deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'only metadata is allowed');
  }

  if (ABSTRACT_MODES.has(usageMode) && ['manual_reference', 'metadata'].includes(operation)) {
    if (['ALLOW_ABSTRACT_PATTERN', 'ALLOW_CODE_INGEST', 'REFERENCE_ONLY', 'VERIFY_REQUIRED', 'LICENSE_GATED'].includes(source.rights_status) && modes.has('REFERENCE_ABSTRACTION')) {
      const warnings = [];
      if (source.rights_status === 'VERIFY_REQUIRED') warnings.push('RIGHTS_UNVERIFIED_ABSTRACT_ONLY');
      if (source.rights_status === 'REFERENCE_ONLY') warnings.push('REFERENCE_ONLY');
      return decisionFor(source, usageMode, operation, 'REFERENCE_ABSTRACTION', [], warnings);
    }
  }

  deny('KINETIC_RIGHTS_DENIED', source, usageMode, operation, 'requested use exceeds the source rights boundary');
}

export function assertAutomatedAccess({ sourceId, url, operation }) {
  const source = lookupSource(sourceId);
  if (canonicalizeSourceUrl(url) !== canonicalizeSourceUrl(source.canonical_url)) {
    deny('KINETIC_RIGHTS_DENIED', source, 'COMPARISON_REFERENCE', operation, 'URL does not match the exact registered route');
  }
  if (source.automated_access !== 'ALLOWED' || source.ingestion_modes.includes('NO_AUTOMATED_INGEST')) {
    deny('KINETIC_AUTOMATION_DENIED', source, 'COMPARISON_REFERENCE', operation, 'automated access is not explicitly allowed');
  }
}

export function authorizeCaptureAccess({ sourceId = null, url }) {
  let parsed;
  try { parsed = new URL(url); }
  catch { throw new RightsError('KINETIC_CAPTURE_ACCESS_DENIED', `invalid capture URL: ${url}`); }
  if (parsed.protocol === 'file:') {
    let path;
    let realPath;
    try {
      path = fileURLToPath(parsed);
      realPath = realpathSync(path);
    } catch { throw new RightsError('KINETIC_CAPTURE_ACCESS_DENIED', `local capture URL does not resolve: ${url}`); }
    const gymRoot = process.env.KINETIC_GYM_ROOT || join(root, 'gym');
    const allowed = [join(root, 'engine', 'tests', 'fixtures'), join(gymRoot, 'runs')].some((parent) => {
      try {
        const rel = relative(realpathSync(parent), realPath);
        return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
      } catch { return false; }
    });
    if (!allowed) throw new RightsError('KINETIC_CAPTURE_ACCESS_DENIED', `local capture path is outside approved roots: ${path}`);
    return deepFreeze({
      allowed: true,
      source_id: null,
      usage_mode: 'COMPARISON_REFERENCE',
      operation: 'capture',
      effective_mode: 'PROJECT_LOCAL_CAPTURE',
      obligations: [], warnings: [], evidence_urls: [],
      registry_version: registryOrThrow().registry_version,
    });
  }
  throw new RightsError('KINETIC_CAPTURE_ACCESS_DENIED', 'external capture navigation is forbidden');
}

export function permittedRetrievalView(request) {
  const rows = [];
  for (const source of registryOrThrow().sources) {
    try {
      rows.push(deepFreeze({ source, decision: authorizeSourceUse({ ...request, sourceId: source.source_id }) }));
    } catch (error) {
      if (!(error instanceof RightsError)) throw error;
    }
  }
  return deepFreeze(rows);
}

export function permittedSourcesForInfluences(influences, { targetPath = null, entitlementRefs = [] } = {}) {
  if (!Array.isArray(influences)) throw new RightsError('KINETIC_RIGHTS_DENIED', 'influences must be an array');
  return influences.map((influence) => {
    const usageMode = influence.usage_mode;
    const operation = usageMode === 'BUILD_DEPENDENCY' ? 'build_dependency'
      : ['RECIPE', 'PRIMITIVE'].includes(usageMode) ? 'code_ingest'
      : usageMode === 'TOOL' ? 'tool_discovery' : 'manual_reference';
    const source = lookupSource(influence.source_id);
    const decision = authorizeSourceUse({ sourceId: influence.source_id, usageMode, operation, targetPath, entitlementRefs });
    return { source, decision, influence: structuredClone(influence) };
  });
}

export function exportSourceProvenance(sourceIds) {
  return deepFreeze(sourceIds.map((sourceId) => {
    const source = lookupSource(sourceId);
    return {
      source_id: source.source_id,
      canonical_url: source.canonical_url,
      rights_status: source.rights_status,
      last_verified_at: source.last_verified_at,
      evidence_urls: [...source.evidence_urls],
    };
  }));
}
