import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSourceRegistry, permittedSourcesForInfluences } from './source-registry.mjs';
import { validateValue } from '../core/schema-validate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const canonicalCasesDir = join(root, 'gym', 'corpus', 'cases');
const registryPath = join(root, 'gym', 'knowledge', 'sources', 'registry.json');
const registrySchemaPath = join(root, 'schemas', 'gym', 'source-registry.schema.json');
const receiptSchemaPath = join(root, 'schemas', 'gym', 'retrieval-receipt.schema.json');

const gymRoot = () => process.env.KINETIC_GYM_ROOT || join(root, 'gym');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const sortedUnique = (values) => [...new Set(values)].sort();

export class RetrievalError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RetrievalError';
    this.code = code;
    this.details = details;
  }
}

export function tokenize(value) {
  return sortedUnique(String(value ?? '').normalize('NFKD').toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

async function readJson(path, code = 'KINETIC_RETRIEVAL_INVALID') {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { throw new RetrievalError(code, `${path}: ${error.message}`); }
}

async function loadDesignCases() {
  const names = (await readdir(canonicalCasesDir)).filter((name) => name.endsWith('.json')).sort();
  return Promise.all(names.map(async (name) => {
    const path = join(canonicalCasesDir, name);
    const bytes = await readFile(path, 'utf8');
    return { path, sha256: sha(bytes), value: JSON.parse(bytes) };
  }));
}

function scoreCase(designCase, tokens, filters) {
  const searchable = tokenize(JSON.stringify({
    title: designCase.title,
    studio: designCase.studio,
    surface: designCase.surface,
    principles: designCase.analysis?.principles,
    anti_patterns: designCase.analysis?.anti_patterns,
  }));
  const overlap = tokens.filter((token) => searchable.includes(token)).length;
  const surface = filters.surface && designCase.surface?.surface_types?.includes(filters.surface) ? 4 : 0;
  const studied = designCase.status === 'STUDIED' ? 1 : 0;
  return overlap + surface + studied;
}

function flattenInfluences(brief) {
  return Object.values(brief.source_provenance ?? {}).flat().sort((a, b) =>
    `${a.source_id}:${a.usage_mode}`.localeCompare(`${b.source_id}:${b.usage_mode}`));
}

function normalizeFilters(filters) {
  const normalized = {};
  for (const key of Object.keys(filters ?? {}).sort()) {
    const value = filters[key];
    if (value == null || ['string', 'boolean'].includes(typeof value)) normalized[key] = value;
    else if (Array.isArray(value)) normalized[key] = value.map(String).sort();
  }
  return normalized;
}

export async function retrieveKnowledge({ caseId, slot, query, filters = {}, entitlementRefs = [], now = new Date().toISOString(), obsidian = null }) {
  if (!/^case-[0-9a-z-]+$/.test(caseId) || !/^V[0-9]+$/.test(slot)) throw new RetrievalError('KINETIC_RETRIEVAL_INVALID', 'unsafe case or slot identity');
  const gym = gymRoot();
  const caseRun = await readJson(join(gym, 'runs', caseId, 'case.json'), 'KINETIC_CASE_NOT_FOUND');
  const variant = caseRun.slots?.[slot];
  if (!variant || variant.state !== 'BRIEF_VALIDATED') throw new RetrievalError('KINETIC_TRANSITION_DENIED', 'retrieval requires BRIEF_VALIDATED');
  const briefRef = variant.refs?.variant_brief;
  if (typeof briefRef !== 'string') throw new RetrievalError('KINETIC_BRIEF_REQUIRED', 'persisted brief missing');
  const briefPath = resolve(gym, briefRef);
  const localBriefPath = relative(gym, briefPath);
  if (localBriefPath === '..' || localBriefPath.startsWith(`..${sep}`) || isAbsolute(localBriefPath)) throw new RetrievalError('KINETIC_BRIEF_INVALID', 'brief reference escapes the Gym');
  const brief = await readJson(briefPath, 'KINETIC_BRIEF_INVALID');
  if (brief.case_id !== caseId || brief.variant_id !== slot) throw new RetrievalError('KINETIC_BRIEF_INVALID', 'brief identity mismatch');

  // Registry validation and rights resolution happen before retrieval sees source candidates.
  const registry = await loadSourceRegistry({ registryPath, schemaPath: registrySchemaPath });
  const registryBytes = await readFile(registryPath, 'utf8');
  const registrySha256 = sha(registryBytes);
  const influences = flattenInfluences(brief);
  const permitted = permittedSourcesForInfluences(influences, {
    targetPath: `gym/runs/${caseId}/variants/${slot.toLowerCase()}/`,
    entitlementRefs,
  });

  const designCaseRows = await loadDesignCases();
  const requiredCaseIds = sortedUnique(brief.design_case_ids_used ?? []);
  const selectedCases = designCaseRows.filter(({ value }) => requiredCaseIds.includes(value.case_id));
  if (requiredCaseIds.length === 0 || selectedCases.length !== requiredCaseIds.length) {
    throw new RetrievalError('KINETIC_EMPTY_RETRIEVAL', 'every candidate requires at least one resolvable DesignCase', {
      requested: requiredCaseIds,
      resolved: selectedCases.map(({ value }) => value.case_id),
    });
  }

  const normalizedTokens = tokenize(query);
  const normalizedFilters = normalizeFilters(filters);
  const designCasesRetrieved = selectedCases
    .map(({ value }) => ({
      case_id: value.case_id,
      score: scoreCase(value, normalizedTokens, normalizedFilters),
      retrieval_reason: 'selected by validated VariantBrief DesignCase provenance',
      knowledge_used: [
        ...(value.analysis?.principles ?? []).map(({ rule }) => rule),
        ...(value.analysis?.anti_patterns ?? []).map(({ issue }) => `avoid: ${issue}`),
      ],
    }))
    .sort((a, b) => b.score - a.score || a.case_id.localeCompare(b.case_id));

  const sourcesRetrieved = permitted.map(({ source, decision, influence }) => ({
    source_id: source.source_id,
    score: tokenize(`${source.title} ${source.summary} ${influence.retrieval_reason}`).filter((token) => normalizedTokens.includes(token)).length,
    retrieval_reason: influence.retrieval_reason,
    knowledge_used: structuredClone(influence.knowledge_used),
    usage_mode: influence.usage_mode,
    rights_allowed: decision.allowed,
    rights_evidence_urls: decision.evidence_urls,
  }));

  const rejectedCandidates = designCaseRows
    .filter(({ value }) => !requiredCaseIds.includes(value.case_id))
    .map(({ value }) => ({ candidate_id: value.case_id, reason: 'not selected by validated VariantBrief provenance' }))
    .sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
  const byMode = (modes) => sourcesRetrieved
    .filter(({ usage_mode: mode }) => modes.includes(mode))
    .map(({ source_id, retrieval_reason }) => ({ id: source_id, reason: retrieval_reason }));
  const indexHashes = sortedUnique(designCaseRows.map(({ sha256 }) => sha256).concat(registrySha256));

  const identity = JSON.stringify({ caseId, slot, query: String(query ?? ''), normalizedTokens, normalizedFilters, requiredCaseIds, sourceIds: sourcesRetrieved.map(({ source_id }) => source_id), indexHashes });
  const receipt = {
    schema: 'kinetic/gym/retrieval-receipt@0.1',
    receipt_id: `rr-${sha(identity).slice(0, 20)}`,
    case_id: caseId,
    variant_id: slot,
    query: String(query ?? ''),
    normalized_tokens: normalizedTokens,
    filters: normalizedFilters,
    registry_version: registry.registry_version,
    registry_sha256: registrySha256,
    index_hashes: indexHashes,
    design_cases_retrieved: designCasesRetrieved,
    sources_retrieved: sourcesRetrieved,
    rejected_candidates: rejectedCandidates,
    recipes_selected: byMode(['RECIPE']),
    primitives_selected: byMode(['PRIMITIVE']),
    tools_selected: byMode(['TOOL', 'BUILD_DEPENDENCY']),
    obsidian_notes_used: structuredClone(obsidian?.availability === 'available' ? obsidian.notes : obsidian?.rows ?? []),
    created_at: now,
  };
  const receiptSchema = await readJson(receiptSchemaPath, 'KINETIC_REGISTRY_INVALID');
  const validation = validateValue({ value: receipt, schema: receiptSchema, schemaPath: receiptSchemaPath });
  if (!validation.valid) throw new RetrievalError('KINETIC_SCHEMA_INVALID', `retrieval receipt failed schema validation: ${JSON.stringify(validation.errors)}`, { errors: validation.errors });

  const outputPath = join(gym, 'runs', caseId, 'planning', slot.toLowerCase(), 'retrieval-receipt.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(receipt, null, 2));
  return receipt;
}
