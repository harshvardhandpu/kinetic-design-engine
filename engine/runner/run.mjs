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
import { readFile, writeFile, mkdir, readdir, realpath } from 'node:fs/promises';
import { join, dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { addOriginalSlot, applyBatchReviewReady, applyHumanReview, applyTransition, assertFidelityPolicy, assertReviewPackagePolicy, assertSourceToOutputLossReport, assertTransition, assertVariantBriefPolicy, nextState } from './state-machine.mjs';
import { hashFile, readCase as readStoredCase, recordStageTelemetry, withCaseLock, writeCaseAtomic, writeTasteDecisionExclusive } from './store.mjs';
import { validateValue } from '../core/schema-validate.mjs';
import { retrieveKnowledge } from '../knowledge/retrieval.mjs';
import { validateDesignQualityEvaluation } from '../evaluator/vision-critic.mjs';
import { validateMotionTokens } from '../evaluator/motion-token-validate.mjs';
import { validateCaptureManifest } from '../cli/capture.mjs';
import { generateReviewPackage } from '../cli/gen-review-package.mjs';

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

async function persistValidatedBrief(caseId, slot, artifactPath, timestamp) {
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) throw Object.assign(new Error('BRIEF_VALIDATED requires --artifact'), { code: 'KINETIC_BRIEF_REQUIRED' });
  let brief;
  try { brief = JSON.parse(await readFile(artifactPath, 'utf8')); }
  catch (error) { throw Object.assign(new Error(`invalid brief JSON: ${error.message}`), { code: 'KINETIC_BRIEF_INVALID' }); }
  const schemaPath = join(root, 'schemas', 'gym', 'variant-brief.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value: brief, schema, schemaPath });
  if (!validation.valid) throw Object.assign(new Error(JSON.stringify(validation.errors)), { code: 'KINETIC_SCHEMA_INVALID' });
  assertVariantBriefPolicy({ brief, caseId, slot });
  const briefPath = join(gym, 'runs', caseId, 'planning', slot.toLowerCase(), 'variant-brief.json');
  await w(briefPath, brief);
  const briefSha256 = await hashFile(briefPath);
  const briefRef = relative(gym, briefPath).split('\\').join('/');
  await w(join(dirname(briefPath), 'variant-brief.receipt.json'), {
    schema: 'kinetic/gym/variant-brief-receipt@0.1', case_id: caseId, slot,
    brief_ref: briefRef, brief_sha256: briefSha256, brief_schema: brief.schema,
    validated_at: timestamp,
  });
  return { variant_brief: briefRef, brief_validated: true };
}

async function assertPersistedBriefUnchanged(caseId, slot, briefRef) {
  if (typeof briefRef !== 'string') throw Object.assign(new Error('persisted brief reference missing'), { code: 'KINETIC_BRIEF_REQUIRED' });
  const briefPath = resolveGymRef(briefRef, 'KINETIC_BRIEF_CHANGED');
  const receipt = await j(join(dirname(briefPath), 'variant-brief.receipt.json'));
  if (!receipt || receipt.brief_ref !== briefRef || receipt.brief_schema !== 'kinetic/gym/variant-brief@0.1') {
    throw Object.assign(new Error('brief validation receipt missing or mismatched'), { code: 'KINETIC_BRIEF_CHANGED' });
  }
  if (receipt.case_id !== caseId || receipt.slot !== slot || await hashFile(briefPath).catch(() => null) !== receipt.brief_sha256) {
    throw Object.assign(new Error('persisted brief hash changed'), { code: 'KINETIC_BRIEF_CHANGED' });
  }
  return { brief_hash_unchanged: true };
}

function resolveGymRef(ref, code) {
  if (typeof ref !== 'string') throw Object.assign(new Error('persisted artifact reference missing'), { code });
  const path = resolve(gym, ref);
  const local = relative(gym, path);
  if (local === '..' || local.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(local)) {
    throw Object.assign(new Error('persisted artifact reference escapes the Gym'), { code });
  }
  return path;
}

async function persistValidatedRetrieval(caseId, slot, artifactPath, briefRef) {
  if (typeof artifactPath !== 'string') throw Object.assign(new Error('RETRIEVAL_PROVEN requires --artifact'), { code: 'KINETIC_RETRIEVAL_REQUIRED' });
  const receipt = await j(artifactPath);
  if (!receipt) throw Object.assign(new Error('retrieval receipt is missing or invalid JSON'), { code: 'KINETIC_RETRIEVAL_REQUIRED' });
  const schemaPath = join(root, 'schemas', 'gym', 'retrieval-receipt.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value: receipt, schema, schemaPath });
  if (!validation.valid || receipt.case_id !== caseId || receipt.variant_id !== slot) {
    throw Object.assign(new Error(JSON.stringify(validation.errors ?? [])), { code: 'KINETIC_RETRIEVAL_REQUIRED' });
  }
  await assertPersistedBriefUnchanged(caseId, slot, briefRef);
  const brief = await j(resolve(gym, briefRef));
  const briefSources = [...new Set(Object.values(brief?.source_provenance ?? {}).flat().map(({ source_id: id }) => id))].sort();
  const receiptSources = [...new Set(receipt.sources_retrieved.map(({ source_id: id }) => id))].sort();
  const briefCases = [...new Set(brief?.design_case_ids_used ?? [])].sort();
  const receiptCases = [...new Set(receipt.design_cases_retrieved.map(({ case_id: id }) => id))].sort();
  const currentRegistrySha = await hashFile(join(root, 'gym', 'knowledge', 'sources', 'registry.json'));
  if (JSON.stringify(briefSources) !== JSON.stringify(receiptSources) || JSON.stringify(briefCases) !== JSON.stringify(receiptCases)
    || receipt.sources_retrieved.some(({ rights_allowed }) => rights_allowed !== true)
    || receipt.registry_version !== '0.1.2' || receipt.registry_sha256 !== currentRegistrySha) {
    throw Object.assign(new Error('retrieval receipt does not match brief provenance or current rights registry'), { code: 'KINETIC_RETRIEVAL_MISMATCH' });
  }
  const outputPath = join(gym, 'runs', caseId, 'planning', slot.toLowerCase(), 'retrieval-receipt.json');
  await w(outputPath, receipt);
  return { retrieval_receipt: relative(gym, outputPath).split('\\').join('/'), retrieval_proven: true };
}

async function persistValidatedPrebuild(caseId, slot, artifactPath, refs) {
  if (typeof artifactPath !== 'string') throw Object.assign(new Error('PREBUILD_APPROVED requires --artifact'), { code: 'KINETIC_PREBUILD_REVIEW_REQUIRED' });
  const review = await j(artifactPath);
  if (!review) throw Object.assign(new Error('prebuild review is missing or invalid JSON'), { code: 'KINETIC_PREBUILD_REVIEW_REQUIRED' });
  const schemaPath = join(root, 'schemas', 'gym', 'prebuild-review.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value: review, schema, schemaPath });
  const briefPath = resolveGymRef(refs?.variant_brief, 'KINETIC_BRIEF_CHANGED');
  const retrievalPath = resolveGymRef(refs?.retrieval_receipt, 'KINETIC_RETRIEVAL_CHANGED');
  if (!validation.valid || review.case_id !== caseId || review.variant_id !== slot || review.decision !== 'APPROVED'
    || review.rule_results.some(({ passed }) => passed !== true)
    || await hashFile(briefPath) !== review.brief_sha256 || await hashFile(retrievalPath) !== review.retrieval_sha256) {
    throw Object.assign(new Error('prebuild review is not an approved match for current planning artifacts'), { code: 'KINETIC_PREBUILD_REVIEW_REQUIRED' });
  }
  const outputPath = join(gym, 'runs', caseId, 'planning', slot.toLowerCase(), 'prebuild-review.json');
  await w(outputPath, review);
  const reviewRef = relative(gym, outputPath).split('\\').join('/');
  await w(join(dirname(outputPath), 'prebuild-review.receipt.json'), {
    schema: 'kinetic/gym/prebuild-review-receipt@0.1', case_id: caseId, slot,
    review_ref: reviewRef, review_sha256: await hashFile(outputPath),
  });
  return { prebuild_review: reviewRef, prebuild_approved: true };
}

async function assertPersistedPlanningUnchanged(caseId, slot, refs) {
  const brief = await assertPersistedBriefUnchanged(caseId, slot, refs?.variant_brief);
  const briefPath = resolveGymRef(refs?.variant_brief, 'KINETIC_BRIEF_CHANGED');
  const retrievalPath = resolveGymRef(refs?.retrieval_receipt, 'KINETIC_RETRIEVAL_CHANGED');
  const reviewPath = resolveGymRef(refs?.prebuild_review, 'KINETIC_PREBUILD_REVIEW_CHANGED');
  const review = await j(reviewPath);
  const receipt = await j(join(dirname(reviewPath), 'prebuild-review.receipt.json'));
  if (!review || review.case_id !== caseId || review.variant_id !== slot || review.decision !== 'APPROVED'
    || review.rule_results.some(({ passed }) => passed !== true)
    || await hashFile(briefPath) !== review.brief_sha256
    || await hashFile(retrievalPath).catch(() => null) !== review.retrieval_sha256) {
    throw Object.assign(new Error('persisted retrieval artifact changed'), { code: 'KINETIC_RETRIEVAL_CHANGED' });
  }
  if (!receipt || receipt.review_ref !== refs.prebuild_review || await hashFile(reviewPath).catch(() => null) !== receipt.review_sha256) {
    throw Object.assign(new Error('approved prebuild review changed'), { code: 'KINETIC_PREBUILD_REVIEW_CHANGED' });
  }
  return { ...brief, retrieval_hash_unchanged: true, prebuild_hash_unchanged: true };
}

async function persistValidatedFidelity(caseId, slot, artifactPath) {
  if (slot !== 'V0' || typeof artifactPath !== 'string') throw Object.assign(new Error('V0 FidelityReport requires --fidelity'), { code: 'KINETIC_FIDELITY_REQUIRED' });
  const report = await j(artifactPath);
  const schemaPath = join(root, 'schemas', 'gym', 'fidelity-report.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value: report, schema, schemaPath });
  if (!validation.valid) throw Object.assign(new Error(JSON.stringify(validation.errors)), { code: 'KINETIC_FIDELITY_REQUIRED' });
  assertFidelityPolicy(report, { caseId, requireApproval: false });
  const outputPath = join(gym, 'runs', caseId, 'reports', 'fidelity-v0.json');
  await w(outputPath, report);
  return { fidelity_report: relative(gym, outputPath).split('\\').join('/'), fidelity_validated: true };
}

async function persistValidatedDesignEvaluation(caseId, slot, artifactPath, refs) {
  if (typeof artifactPath !== 'string') {
    throw Object.assign(new Error('DESIGN_EVALUATED requires --artifact'), { code: 'KINETIC_DESIGN_EVALUATION_REQUIRED' });
  }
  const evaluation = await j(artifactPath);
  const evaluationSchemaPath = join(root, 'schemas', 'gym', 'design-quality-evaluation.schema.json');
  const evaluationSchema = JSON.parse(await readFile(evaluationSchemaPath, 'utf8'));
  const evaluationValidation = validateValue({ value: evaluation, schema: evaluationSchema, schemaPath: evaluationSchemaPath });
  if (!evaluationValidation.valid) {
    throw Object.assign(new Error(JSON.stringify(evaluationValidation.errors)), { code: 'KINETIC_DESIGN_EVALUATION_REQUIRED' });
  }

  const capturePath = resolveGymRef(refs?.capture_manifest, 'KINETIC_CAPTURE_MANIFEST_REQUIRED');
  const briefPath = resolveGymRef(refs?.variant_brief, 'KINETIC_DESIGN_EVALUATION_REQUIRED');
  const retrievalPath = resolveGymRef(refs?.retrieval_receipt, 'KINETIC_DESIGN_EVALUATION_REQUIRED');
  const captureManifest = await j(capturePath);
  const captureSchemaPath = join(root, 'schemas', 'gym', 'capture-manifest.schema.json');
  const captureSchema = JSON.parse(await readFile(captureSchemaPath, 'utf8'));
  const captureValidation = validateValue({ value: captureManifest, schema: captureSchema, schemaPath: captureSchemaPath });
  if (!captureValidation.valid) {
    throw Object.assign(new Error(JSON.stringify(captureValidation.errors)), { code: 'KINETIC_CAPTURE_MANIFEST_REQUIRED' });
  }
  await Promise.all([readFile(briefPath), readFile(retrievalPath)]).catch((error) => {
    throw Object.assign(new Error(`persisted design input missing: ${error.message}`), { code: 'KINETIC_DESIGN_EVALUATION_REQUIRED' });
  });
  const accepted = validateDesignQualityEvaluation({
    evaluation, captureManifest, caseId, variantId: slot, expectedRefs: refs, criticResult: null,
  });
  const outputPath = join(gym, 'runs', caseId, 'reports', `design-evaluation-${slot.toLowerCase()}.json`);
  await w(outputPath, accepted);
  return { design_evaluation: relative(gym, outputPath).split('\\').join('/'), design_evaluation_validated: true };
}

function resolveCaseRef(caseId, ref) {
  const code = 'KINETIC_LOSS_EVIDENCE_INVALID';
  if (typeof ref !== 'string' || !ref.startsWith(`runs/${caseId}/`) || ref.includes('\\')) {
    throw Object.assign(new Error('loss evidence reference is not bound to the case'), { code });
  }
  const path = resolveGymRef(ref, code);
  if (relative(gym, path).split('\\').join('/') !== ref) {
    throw Object.assign(new Error('loss evidence reference is non-canonical or traverses outside the case'), { code });
  }
  return path;
}

async function readLossArtifact(caseId, ref, schemaName, expected = {}) {
  const code = 'KINETIC_LOSS_EVIDENCE_INVALID';
  const path = resolveCaseRef(caseId, ref);
  let containedPath;
  try {
    const [caseRoot, artifactPath] = await Promise.all([realpath(join(gym, 'runs', caseId)), realpath(path)]);
    const local = relative(caseRoot, artifactPath);
    if (local === '..' || local.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(local)) throw new Error('artifact resolves outside the case');
    containedPath = artifactPath;
  } catch (error) {
    throw Object.assign(new Error(`loss evidence is missing or outside the case: ${ref}: ${error.message}`), { code });
  }
  let value;
  try { value = JSON.parse(await readFile(containedPath, 'utf8')); }
  catch (error) { throw Object.assign(new Error(`loss evidence is missing or invalid JSON: ${ref}: ${error.message}`), { code }); }
  const schemaPath = join(root, 'schemas', 'gym', schemaName);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value, schema, schemaPath });
  if (!validation.valid || Object.entries(expected).some(([key, expectedValue]) => value?.[key] !== expectedValue)) {
    throw Object.assign(new Error(`loss evidence is invalid or identity-mismatched: ${ref}`), { code });
  }
  return { path: containedPath, value };
}

async function buildLossEvidenceIndex(caseRun) {
  const caseId = caseRun.case_id;
  const index = {
    reference_identities: new Set(), source_refs: new Set(), capture_refs: new Set(),
    report_refs: new Set(), human_feedback_refs: new Set(),
  };
  const fidelityRef = caseRun.reports?.fidelity;
  const { value: fidelity } = await readLossArtifact(caseId, fidelityRef, 'fidelity-report.schema.json', { case_id: caseId, variant_id: 'V0' });
  assertFidelityPolicy(fidelity, { caseId, requireApproval: true });
  const referenceIdentity = `design-case:${fidelity.reference_design_case_id}`;
  index.reference_identities.add(referenceIdentity);
  index.source_refs.add(referenceIdentity);
  index.report_refs.add(fidelityRef);

  for (const slot of ['V0', 'V1', 'V2']) {
    const record = caseRun.slots?.[slot];
    const refs = record?.refs ?? {};
    const brief = await readLossArtifact(caseId, refs.variant_brief, 'variant-brief.schema.json', { case_id: caseId, variant_id: slot });
    const retrieval = await readLossArtifact(caseId, refs.retrieval_receipt, 'retrieval-receipt.schema.json', { case_id: caseId, variant_id: slot });
    const capture = await readLossArtifact(caseId, refs.capture_manifest, 'capture-manifest.schema.json', { case_id: caseId });
    await validateCaptureManifest({ manifest: capture.value, caseRoot: dirname(capture.path) });
    const evaluation = await readLossArtifact(caseId, refs.design_evaluation, 'design-quality-evaluation.schema.json', { case_id: caseId, variant_id: slot });
    validateDesignQualityEvaluation({
      evaluation: evaluation.value, captureManifest: capture.value, caseId, variantId: slot, expectedRefs: refs, criticResult: null,
    });
    for (const ref of [refs.retrieval_receipt, refs.design_evaluation]) index.report_refs.add(ref);
    for (const row of retrieval.value.design_cases_retrieved) index.source_refs.add(`design-case:${row.case_id}`);
    for (const row of retrieval.value.sources_retrieved) index.source_refs.add(`source:${row.source_id}`);
    for (const entry of capture.value.entries) {
      if (entry.subject_id === slot || entry.subject_id === 'reference') index.capture_refs.add(entry.capture_id);
    }
    assertVariantBriefPolicy({ brief: brief.value, caseId, slot });
    if (slot === 'V0' && (!brief.value.design_case_ids_used.includes(fidelity.reference_design_case_id)
      || !retrieval.value.design_cases_retrieved.some(({ case_id: designCaseId }) => designCaseId === fidelity.reference_design_case_id))) {
      throw Object.assign(new Error('FidelityReport reference is not bound to V0 planning and retrieval evidence'), { code: 'KINETIC_LOSS_EVIDENCE_INVALID' });
    }
  }
  return Object.fromEntries(Object.entries(index).map(([key, refs]) => [key, [...refs].sort()]));
}

async function prepareValidatedLossReport(caseRun, artifactPath) {
  if (typeof artifactPath !== 'string') {
    throw Object.assign(new Error('REVIEW_READY requires --loss'), { code: 'KINETIC_LOSS_REPORT_REQUIRED' });
  }
  let report;
  try { report = JSON.parse(await readFile(artifactPath, 'utf8')); }
  catch (error) { throw Object.assign(new Error(`loss report is missing or invalid JSON: ${error.message}`), { code: 'KINETIC_LOSS_REPORT_INVALID' }); }
  const schemaPath = join(root, 'schemas', 'gym', 'source-to-output-loss-report.schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validation = validateValue({ value: report, schema, schemaPath });
  if (!validation.valid) throw Object.assign(new Error(JSON.stringify(validation.errors)), { code: 'KINETIC_LOSS_REPORT_INVALID' });
  const evidenceIndex = await buildLossEvidenceIndex(caseRun);
  assertSourceToOutputLossReport({ caseRun, report, evidenceIndex });
  const outputPath = join(gym, 'runs', caseRun.case_id, 'reports', 'source-to-output-loss.json');
  return {
    report, outputPath, ref: relative(gym, outputPath).split('\\').join('/'),
  };
}

async function persistLossReportExclusive({ report, outputPath }, mustExist = false) {
  if (mustExist) {
    let existing;
    try { existing = JSON.parse(await readFile(outputPath, 'utf8')); }
    catch (error) { throw Object.assign(new Error(`persisted loss report is missing or unreadable: ${error.message}`), { code: 'KINETIC_LOSS_REPORT_CONFLICT' }); }
    if (!isDeepStrictEqual(existing, report)) {
      throw Object.assign(new Error('persisted loss report differs; overwrite is forbidden'), { code: 'KINETIC_LOSS_REPORT_CONFLICT' });
    }
    return;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  try { await writeFile(outputPath, JSON.stringify(report, null, 2), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let existing;
    try { existing = JSON.parse(await readFile(outputPath, 'utf8')); }
    catch (readError) { throw Object.assign(new Error(`persisted loss report is unreadable: ${readError.message}`), { code: 'KINETIC_LOSS_REPORT_CONFLICT' }); }
    if (!isDeepStrictEqual(existing, report)) {
      throw Object.assign(new Error('persisted loss report differs; overwrite is forbidden'), { code: 'KINETIC_LOSS_REPORT_CONFLICT' });
    }
  }
}

async function resolveLocalPackageHrefs(caseDir, html) {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    .filter((href) => !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('data:'));
  for (const href of hrefs) {
    const target = resolve(caseDir, href);
    const caseRoot = await realpath(caseDir).catch(() => caseDir);
    let absolute;
    try { absolute = await realpath(target); }
    catch {
      throw Object.assign(new Error(`review package href does not resolve: ${href}`), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
    }
    const local = relative(caseRoot, absolute);
    // Allow baseline links that resolve outside the case but still under the active gym root.
    const gymRoot = await realpath(gym).catch(() => gym);
    const underGym = relative(gymRoot, absolute);
    if ((local === '..' || local.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(local))
      && (underGym === '..' || underGym.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(underGym))) {
      throw Object.assign(new Error(`review package href escapes gym root: ${href}`), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
    }
    const st = await readFile(absolute).catch(() => null);
    if (st == null) throw Object.assign(new Error(`review package href missing file: ${href}`), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
  }
  return hrefs.length;
}

async function prepareValidatedReviewPackage(caseRun) {
  const generated = await generateReviewPackage({ caseId: caseRun.case_id, gymRoot: gym, repoGym: join(root, 'gym') });
  assertReviewPackagePolicy({ caseRun, html: generated.html, packageRef: generated.ref });
  const caseDir = join(gym, 'runs', caseRun.case_id);
  await resolveLocalPackageHrefs(caseDir, generated.html);
  return {
    review_package: generated.ref,
    review_package_validated: true,
    html: generated.html,
    outputPath: generated.outputPath,
  };
}

async function persistTechnicalEvaluation(caseId, slot, artifactPath, variantDir, refs, timestamp) {
  if (typeof artifactPath !== 'string' || typeof variantDir !== 'string') {
    throw Object.assign(new Error('TECHNICAL_EVALUATED requires --artifact browser report and --target variant directory'), { code: 'KINETIC_TECHNICAL_EVALUATION_REQUIRED' });
  }
  const browserEvaluation = await j(artifactPath);
  const gateNames = ['technical', 'responsive', 'a11y', 'performance'];
  if (browserEvaluation?.schema !== 'kinetic/evaluation@0.1' || browserEvaluation.gates === null || typeof browserEvaluation.gates !== 'object'
    || gateNames.some((name) => !['pass', 'warn', 'fail'].includes(browserEvaluation.gates?.[name]?.result))
    || browserEvaluation.gates?.design?.result !== 'pending-vision-or-human') {
    throw Object.assign(new Error('browser technical evaluation is missing required gate results'), { code: 'KINETIC_TECHNICAL_EVALUATION_REQUIRED' });
  }
  const briefPath = resolveGymRef(refs?.variant_brief, 'KINETIC_BRIEF_REQUIRED');
  const brief = await j(briefPath);
  const briefSchemaPath = join(root, 'schemas', 'gym', 'variant-brief.schema.json');
  const briefSchema = JSON.parse(await readFile(briefSchemaPath, 'utf8'));
  const briefValidation = validateValue({ value: brief, schema: briefSchema, schemaPath: briefSchemaPath });
  if (!briefValidation.valid || brief.case_id !== caseId || brief.variant_id !== slot) {
    throw Object.assign(new Error('persisted VariantBrief is invalid for technical evaluation'), { code: 'KINETIC_BRIEF_INVALID' });
  }
  const catalogPath = join(root, 'engine', 'tokens', 'motion-tokens.json');
  const catalogSchemaPath = join(root, 'schemas', 'motion-tokens.schema.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const catalogSchema = JSON.parse(await readFile(catalogSchemaPath, 'utf8'));
  const catalogValidation = validateValue({ value: catalog, schema: catalogSchema, schemaPath: catalogSchemaPath });
  if (!catalogValidation.valid) throw Object.assign(new Error('motion token catalog is invalid'), { code: 'KINETIC_MOTION_CATALOG_INVALID' });
  const motionReport = await validateMotionTokens({ variantDir, brief, tokenCatalog: catalog });
  const reportsDir = join(gym, 'runs', caseId, 'reports');
  const motionPath = join(reportsDir, `motion-token-${slot.toLowerCase()}.json`);
  await w(motionPath, motionReport);
  const blockingGates = gateNames.filter((name) => browserEvaluation.gates[name].result === 'fail');
  const qualified = motionReport.result === 'pass'
    && browserEvaluation.gates.technical.result === 'pass'
    && browserEvaluation.gates.responsive.result === 'pass'
    && blockingGates.length === 0;
  const technicalReport = {
    schema: 'kinetic/technical-evaluation@0.1', case_id: caseId, variant_id: slot,
    result: qualified ? 'pass' : 'fail', browser_evaluation: browserEvaluation,
    motion_token_report: relative(gym, motionPath).split('\\').join('/'), blocking_gates: blockingGates,
    created_at: timestamp,
  };
  const technicalPath = join(reportsDir, `technical-evaluation-${slot.toLowerCase()}.json`);
  await w(technicalPath, technicalReport);
  return {
    refs: { technical_evaluation: relative(gym, technicalPath).split('\\').join('/'), technical_evaluation_validated: true },
    qualified,
  };
}

async function recordTransitionTelemetry(caseId, before, after, toState, timestamp) {
  const mapping = {
    BRIEF_VALIDATED: ['planning', 'PLANNED', 'COMPLETED'],
    RETRIEVAL_PROVEN: ['retrieval', 'BRIEF_VALIDATED', 'COMPLETED'],
    PREBUILD_APPROVED: ['prebuild_review', 'RETRIEVAL_PROVEN', 'COMPLETED'],
    BUILDING: ['build', 'BUILDING', 'RUNNING'],
    BUILT: ['build', 'BUILDING', 'COMPLETED'],
    TECHNICAL_EVALUATED: ['technical_evaluation', 'BUILT', 'COMPLETED'],
    VISUAL_CAPTURED: ['capture', 'TECHNICAL_EVALUATED', 'COMPLETED'],
    DESIGN_EVALUATED: ['design_evaluation', 'VISUAL_CAPTURED', 'COMPLETED'],
    REVIEW_READY: ['review_package_generation', 'DESIGN_EVALUATED', 'COMPLETED'],
    HUMAN_REVIEWED: ['human_review_waiting', 'REVIEW_READY', 'COMPLETED'],
  };
  const row = mapping[toState];
  if (!row) return;
  const [stage, startState, status] = row;
  const startedAt = toState === 'BUILDING' ? timestamp : before.timestamps?.[startState] ?? timestamp;
  const endedAt = status === 'RUNNING' ? null : timestamp;
  const receiptRefs = Object.values(after.refs ?? {}).filter((value) => typeof value === 'string');
  await recordStageTelemetry(caseId, {
    stage, startedAt, endedAt, status, attempt: after.attempt, receiptRefs,
    metrics: { repair_attempts: Math.max(0, after.attempt - 1), ...(['BUILDING', 'BUILT'].includes(toState) ? { build_attempts: after.attempt } : {}) },
  });
}

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
} else if (cmd === 'add-slot') {
  try {
    await withCaseLock(A.case, `add-slot-${A.slot}`, async () => {
      const loaded = await readStoredCase(A.case);
      if (loaded.legacy) throw Object.assign(new Error('add-slot is Phase-2.5 only'), { code: 'KINETIC_PHASE25_REQUIRED' });
      const fidelityRef = loaded.record.reports?.fidelity;
      const fidelityPath = resolveGymRef(fidelityRef, 'KINETIC_FIDELITY_REQUIRED');
      const report = await j(fidelityPath);
      const schemaPath = join(root, 'schemas', 'gym', 'fidelity-report.schema.json');
      const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
      const validation = validateValue({ value: report, schema, schemaPath });
      if (!validation.valid) throw Object.assign(new Error('stored FidelityReport is invalid'), { code: 'KINETIC_FIDELITY_REQUIRED' });
      assertFidelityPolicy(report, { caseId: A.case, requireApproval: true });
      const updated = addOriginalSlot({ caseRun: loaded.record, slot: A.slot, fidelityValidated: true, fidelityRef, now: now() });
      await writeCaseAtomic(A.case, updated);
    });
    console.log(`${A.case}/${A.slot} -> PLANNED`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
} else if (cmd === 'retrieve') {
  try {
    let receipt;
    await withCaseLock(A.case, `retrieve-${A.slot}`, async () => {
      const filters = A.filters && A.filters !== true ? JSON.parse(A.filters) : {};
      const entitlementRefs = A.entitlements && A.entitlements !== true ? String(A.entitlements).split(',').filter(Boolean) : [];
      receipt = await retrieveKnowledge({ caseId: A.case, slot: A.slot, query: A.query ?? '', filters, entitlementRefs });
    });
    console.log(JSON.stringify({ receipt_id: receipt.receipt_id, path: `runs/${A.case}/planning/${A.slot.toLowerCase()}/retrieval-receipt.json` }));
  } catch (error) {
    console.error(`${error.code ?? 'KINETIC_RETRIEVAL_INVALID'}: ${error.message}`);
    process.exit(1);
  }
} else if (cmd === 'advance') {
  try {
    await withCaseLock(A.case, `advance-${A.slot}-${A.to}`, async () => {
      const loaded = await readStoredCase(A.case);
      if (loaded.legacy) throw Object.assign(new Error('advance is Phase-2.5 only'), { code: 'KINETIC_PHASE25_REQUIRED' });
      const timestamp = now();
      let artifactRefs = A.refs && A.refs !== true ? JSON.parse(A.refs) : {};
      let technicalQualification = null;
      if (A.to === 'BRIEF_VALIDATED') artifactRefs = { ...artifactRefs, ...await persistValidatedBrief(A.case, A.slot, A.artifact, timestamp) };
      if (A.to === 'RETRIEVAL_PROVEN') artifactRefs = { ...artifactRefs, ...await persistValidatedRetrieval(A.case, A.slot, A.artifact, loaded.record.slots?.[A.slot]?.refs?.variant_brief) };
      if (A.to === 'PREBUILD_APPROVED') artifactRefs = { ...artifactRefs, ...await persistValidatedPrebuild(A.case, A.slot, A.artifact, loaded.record.slots?.[A.slot]?.refs) };
      if (A.to === 'BUILDING') artifactRefs = { ...artifactRefs, ...await assertPersistedPlanningUnchanged(A.case, A.slot, loaded.record.slots?.[A.slot]?.refs) };
      if (A.to === 'TECHNICAL_EVALUATED') {
        const technical = await persistTechnicalEvaluation(A.case, A.slot, A.artifact, A.target, loaded.record.slots?.[A.slot]?.refs, timestamp);
        artifactRefs = { ...artifactRefs, ...technical.refs };
        technicalQualification = technical.qualified;
      }
      if (A.to === 'DESIGN_EVALUATED' && A.slot === 'V0') artifactRefs = { ...artifactRefs, ...await persistValidatedFidelity(A.case, A.slot, A.fidelity) };
      if (A.to === 'DESIGN_EVALUATED') artifactRefs = { ...artifactRefs, ...await persistValidatedDesignEvaluation(A.case, A.slot, A.artifact, loaded.record.slots?.[A.slot]?.refs) };
      if (A.to === 'REVIEW_READY') {
        const lossRef = `runs/${A.case}/reports/source-to-output-loss.json`;
        const packageRef = `runs/${A.case}/review-package.html`;
        const repeated = loaded.record.slots?.[A.slot]?.state === 'REVIEW_READY';
        if (loaded.record.reports?.source_to_output_loss !== null && loaded.record.reports?.source_to_output_loss !== lossRef) {
          throw Object.assign(new Error('case points to a different loss report; overwrite is forbidden'), { code: 'KINETIC_LOSS_REPORT_CONFLICT' });
        }
        if (loaded.record.reports?.review_package !== null && loaded.record.reports?.review_package !== packageRef) {
          throw Object.assign(new Error('case points to a different review package; overwrite is forbidden'), { code: 'KINETIC_REVIEW_PACKAGE_INVALID' });
        }
        artifactRefs = {
          ...artifactRefs,
          source_to_output_loss: lossRef,
          source_to_output_loss_validated: true,
          review_package: packageRef,
          review_package_validated: true,
        };
        if (!repeated) assertTransition({ caseRun: loaded.record, slot: A.slot, toState: A.to, artifactRefs });
        const prepared = await prepareValidatedLossReport(loaded.record, A.loss);
        await persistLossReportExclusive(prepared, repeated);
        await prepareValidatedReviewPackage(loaded.record);
        if (repeated) return;
      }
      const updated = applyTransition({ caseRun: loaded.record, slot: A.slot, toState: A.to, artifactRefs, now: timestamp });
      if (technicalQualification !== null) updated.slots[A.slot].technically_qualified = technicalQualification;
      if (artifactRefs.fidelity_report) updated.reports.fidelity = artifactRefs.fidelity_report;
      if (artifactRefs.source_to_output_loss) updated.reports.source_to_output_loss = artifactRefs.source_to_output_loss;
      if (artifactRefs.review_package) {
        updated.reports.review_package = artifactRefs.review_package;
        if (['V1', 'V2'].every((slot) => updated.slots?.[slot]?.state === 'REVIEW_READY')) updated.review_state = 'REVIEW_READY';
      }
      await writeCaseAtomic(A.case, updated);
      await recordTransitionTelemetry(A.case, loaded.record.slots[A.slot], updated.slots[A.slot], A.to, timestamp);
    });
    console.log(`${A.case}/${A.slot} -> ${A.to}`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
} else if (cmd === 'batch-review-ready') {
  try {
    await withCaseLock(A.case, `batch-review-ready`, async () => {
      const loaded = await readStoredCase(A.case);
      if (loaded.legacy) throw Object.assign(new Error('batch-review-ready is Phase-2.5 only'), { code: 'KINETIC_PHASE25_REQUIRED' });
      const timestamp = now();
      const lossRef = `runs/${A.case}/reports/source-to-output-loss.json`;
      const packageRef = `runs/${A.case}/review-package.html`;
      const artifactRefs = {
        source_to_output_loss: lossRef,
        source_to_output_loss_validated: true,
        review_package: packageRef,
        review_package_validated: true,
      };
      const preparedLoss = await prepareValidatedLossReport(loaded.record, A.loss);
      await prepareValidatedReviewPackage(loaded.record);
      const updated = applyBatchReviewReady({ caseRun: loaded.record, artifactRefs, now: timestamp });
      await persistLossReportExclusive(preparedLoss, loaded.record.reports?.source_to_output_loss === lossRef);
      await writeCaseAtomic(A.case, updated);
      for (const slot of ['V1', 'V2']) {
        if (loaded.record.slots?.[slot]?.state !== 'REVIEW_READY') {
          await recordTransitionTelemetry(A.case, loaded.record.slots[slot], updated.slots[slot], 'REVIEW_READY', timestamp);
        }
      }
    });
    console.log(`${A.case}: batch REVIEW_READY`);
  } catch (error) {
    console.error(`${error.code || 'KINETIC_ERROR'}: ${error.message}`);
    process.exitCode = 1;
  }
} else if (cmd === 'record-human-review') {
  try {
    if (typeof A.decision !== 'string') throw Object.assign(new Error('record-human-review requires --decision'), { code: 'KINETIC_DECISION_INVALID' });
    const decision = await j(A.decision);
    const schemaPath = join(root, 'schemas', 'gym', 'taste-decision.schema.json');
    const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
    const validation = validateValue({ value: decision, schema: { $defs: schema.$defs, $ref: '#/$defs/phase25' }, schemaPath });
    if (!validation.valid) throw Object.assign(new Error(JSON.stringify(validation.errors)), { code: 'KINETIC_SCHEMA_INVALID' });
    const caseId = decision.context.case_id;
    await withCaseLock(caseId, `record-human-review-${decision.decision_id}`, async () => {
      const loaded = await readStoredCase(caseId);
      if (loaded.legacy) throw Object.assign(new Error('human review import is Phase-2.5 only'), { code: 'KINETIC_PHASE25_REQUIRED' });
      const currentDecision = loaded.record.taste_decision_ref
        ? await j(resolveGymRef(loaded.record.taste_decision_ref, 'KINETIC_DECISION_NOT_FOUND'))
        : null;
      if (currentDecision) {
        const currentValidation = validateValue({ value: currentDecision, schema: { $defs: schema.$defs, $ref: '#/$defs/phase25' }, schemaPath });
        if (!currentValidation.valid || currentDecision.context.case_id !== caseId
          || loaded.record.taste_decision_ref !== `taste/decisions/${currentDecision.decision_id}.json`) {
          throw Object.assign(new Error('current human decision reference is invalid'), { code: 'KINETIC_DECISION_INVALID' });
        }
      }
      const decisionRef = `taste/decisions/${decision.decision_id}.json`;
      const timestamp = now();
      const updated = applyHumanReview({
        caseRun: loaded.record, decision, decisionRef, currentDecisionId: currentDecision?.decision_id ?? null, now: timestamp,
      });
      await writeTasteDecisionExclusive(decision);
      await writeCaseAtomic(caseId, updated);
      if (loaded.record.review_state !== 'HUMAN_REVIEWED') {
        await recordTransitionTelemetry(caseId, loaded.record.slots.V1, updated.slots.V1, 'HUMAN_REVIEWED', timestamp);
      }
    });
    console.log(`${decision.context.case_id}: human review ${decision.decision_id} recorded`);
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
  console.error('commands: init-job | init-case [--run-version phase2.5] | retrieve | advance | record-human-review | next | record | gate | receipt | status');
  process.exit(2);
}
