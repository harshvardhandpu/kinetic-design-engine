import { createHash } from 'node:crypto';
import { isDeepStrictEqual, types } from 'node:util';

const REQUEST_KEYS = [
  'reference_capture_ids', 'candidate_capture_ids', 'variant_brief_ref', 'rubric_version',
  'relevant_provenance_refs', 'optional_fidelity_report_ref', 'capture_hashes', 'prompt_version',
];
const RECEIPT_KEYS = [
  'provider', 'exact_model', 'route', 'vision_image_capability', 'cost_status', 'limits',
  'capture_hashes', 'prompt_version', 'rubric_version', 'response_sha256', 'called_at',
];
const IDENTITY_KEYS = [
  'verified', 'provider', 'exact_model', 'route', 'vision_image_capability', 'verification_source',
];
const CONTEXT_KEYS = ['case_id', 'variant_id'];
const RUBRIC_DIMENSIONS = [
  'composition', 'typography', 'art_direction', 'depth', 'motion', 'interaction',
  'scroll_story', 'originality', 'cohesion', 'surface_fit',
];
const DIMENSIONS = new Set(RUBRIC_DIMENSIONS);
const DESIGN_INPUT_KEYS = ['evaluation', 'captureManifest', 'caseId', 'variantId', 'expectedRefs', 'criticResult'];
const DESIGN_EVALUATION_KEYS = [
  'schema', 'evaluation_id', 'case_id', 'variant_id', 'rubric_version', 'producer',
  'capture_manifest_ref', 'brief_ref', 'provenance_refs', 'vision_receipt', 'dimensions',
  'limitations', 'advisory_recommendation', 'created_at',
];
const DESIGN_DIMENSION_KEYS = [
  'status', 'observations', 'strengths', 'failures', 'severity', 'confidence',
  'evidence_capture_ids', 'producer',
];
const CAPTURE_ID = /^cap-[0-9a-z-]+$/;
const CASE_ID = /^case-[0-9a-z-]+$/;
const VARIANT_ID = /^V[0-9]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GENERIC_IDENTITY = /anonymous|unknown|unverified|unidentified|unspecified|generic|tool|service/i;
const GENERIC_IDENTITY_EXACT = new Set([
  'na', 'none', 'notapplicable', 'notavailable', 'tbd', 'notknown', 'redacted',
  'placeholder', 'default', 'unset', 'missing',
]);
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const VERIFIED_CRITIC_RESULTS = new WeakMap();

function fail(code, message) {
  throw Object.assign(new Error(message), { name: 'VisionCriticError', code });
}

function dataValues(value, keys) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || !own.every((key) => typeof key === 'string' && keys.includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!keys.every((key) => descriptors[key]?.enumerable && Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(keys.map((key) => [key, descriptors[key].value]));
}

const exactKeys = (value, keys) => dataValues(value, keys) !== null;

function dataRecord(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !descriptors[key]?.enumerable
    || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

function dataArray(value, { allowEmpty = false } = {}) {
  if (types.isProxy(value) || !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || (!allowEmpty && length === 0)
    || Reflect.ownKeys(value).length !== length + 1) return null;
  const items = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[index];
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    items.push(descriptor.value);
  }
  return items;
}

function nonemptyStrings(value, pattern = null) {
  const items = dataArray(value);
  if (!items) return false;
  for (const item of items) {
    if (typeof item !== 'string' || item.trim().length === 0 || (pattern && !pattern.test(item))) return false;
  }
  return true;
}

export function createVisionRequest(input) {
  let fields;
  try { fields = dataValues(input, REQUEST_KEYS); }
  catch { fail('KINETIC_VISION_REQUEST_INVALID', 'vision request is incomplete or malformed'); }
  if (!fields || !nonemptyStrings(fields.reference_capture_ids, CAPTURE_ID)
    || !nonemptyStrings(fields.candidate_capture_ids, CAPTURE_ID)
    || !nonemptyStrings(fields.relevant_provenance_refs)
    || !nonemptyStrings(fields.capture_hashes, SHA256)
    || typeof fields.variant_brief_ref !== 'string' || fields.variant_brief_ref.trim().length === 0
    || typeof fields.rubric_version !== 'string' || fields.rubric_version.trim().length === 0
    || typeof fields.prompt_version !== 'string' || fields.prompt_version.trim().length === 0
    || !(fields.optional_fidelity_report_ref === null
      || (typeof fields.optional_fidelity_report_ref === 'string' && fields.optional_fidelity_report_ref.trim().length > 0))) {
    fail('KINETIC_VISION_REQUEST_INVALID', 'vision request is incomplete or malformed');
  }
  const captureIds = [...fields.reference_capture_ids, ...fields.candidate_capture_ids];
  if (new Set(captureIds).size !== captureIds.length || fields.capture_hashes.length !== captureIds.length) {
    fail('KINETIC_VISION_REQUEST_INVALID', 'capture IDs and hashes must be unique and complete');
  }
  try { return structuredClone(fields); }
  catch { fail('KINETIC_VISION_REQUEST_INVALID', 'vision request is incomplete or malformed'); }
}

const humanGate = () => ({
  status: 'KINETIC_VISION_UNVERIFIED',
  advisory_recommendation: 'HUMAN_VISUAL_GATE',
  observations: [],
  vision_receipt: null,
});

const identified = (value) => {
  const normalized = typeof value === 'string' ? value.replace(/[^a-z0-9]/gi, '') : '';
  return normalized.length > 0 && value === value.trim() && !GENERIC_IDENTITY.test(normalized)
    && !GENERIC_IDENTITY_EXACT.has(normalized.toLowerCase());
};

function validDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_TIME.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , offsetHour = '00', offsetMinute = '00'] = match;
  const [y, m, d, h, min, s, oh, om] = [year, month, day, hour, minute, second, offsetHour, offsetMinute].map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m]
    && h <= 23 && min <= 59 && s <= 59 && oh <= 23 && om <= 59;
}

function normalizeIdentity(identity) {
  const fields = dataValues(identity, IDENTITY_KEYS);
  if (!fields || fields.verified !== true || fields.verification_source !== 'provider-api-metadata'
    || fields.vision_image_capability !== true
    || ![fields.provider, fields.exact_model, fields.route].every(identified)) return null;
  try { return structuredClone(fields); }
  catch { return null; }
}

function normalizeContext(context) {
  const fields = dataValues(context, CONTEXT_KEYS);
  if (!fields || typeof fields.case_id !== 'string' || !CASE_ID.test(fields.case_id)
    || typeof fields.variant_id !== 'string' || !VARIANT_ID.test(fields.variant_id)) return null;
  try { return structuredClone(fields); }
  catch { return null; }
}

function verifiedReceipt(request, responseText, receipt, identity) {
  const receiptFields = dataValues(receipt, RECEIPT_KEYS);
  if (typeof responseText !== 'string' || !receiptFields || !identity
    || receiptFields.vision_image_capability !== true
    || identity.provider !== receiptFields.provider || identity.exact_model !== receiptFields.exact_model
    || identity.route !== receiptFields.route
    || ![receiptFields.provider, receiptFields.exact_model, receiptFields.route].every(identified)
    || receiptFields.cost_status !== 'UNKNOWN' || receiptFields.limits !== null
    || !nonemptyStrings(receiptFields.capture_hashes, SHA256)
    || JSON.stringify(receiptFields.capture_hashes) !== JSON.stringify(request.capture_hashes)
    || receiptFields.prompt_version !== request.prompt_version || receiptFields.rubric_version !== request.rubric_version
    || typeof receiptFields.response_sha256 !== 'string' || !SHA256.test(receiptFields.response_sha256)
    || !validDateTime(receiptFields.called_at)
    || createHash('sha256').update(responseText).digest('hex') !== receiptFields.response_sha256) return null;
  try { return structuredClone(receiptFields); }
  catch { return null; }
}

function parseObservations(responseText, request) {
  let response;
  try { response = JSON.parse(responseText); }
  catch { fail('KINETIC_VISION_RESPONSE_INVALID', 'vision response is not valid JSON'); }
  const requestSha256 = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  if (!exactKeys(response, ['request_sha256', 'observations']) || response.request_sha256 !== requestSha256
    || !Array.isArray(response.observations)
    || response.observations.length === 0 || Reflect.ownKeys(response.observations).length !== response.observations.length + 1) {
    fail('KINETIC_VISION_RESPONSE_INVALID', 'vision response requires structured observations');
  }
  const allowedCaptureIds = new Set([...request.reference_capture_ids, ...request.candidate_capture_ids]);
  for (const observation of response.observations) {
    if (!exactKeys(observation, ['dimension', 'observation', 'kind', 'severity', 'confidence', 'evidence_capture_ids'])
      || !DIMENSIONS.has(observation.dimension)
      || typeof observation.observation !== 'string' || observation.observation.trim().length === 0
      || !['STRENGTH', 'FAILURE'].includes(observation.kind)
      || !['none', 'low', 'medium', 'high', 'blocker'].includes(observation.severity)
      || !(observation.confidence === null
        || (typeof observation.confidence === 'number' && Number.isFinite(observation.confidence)
          && observation.confidence >= 0 && observation.confidence <= 1))
      || !nonemptyStrings(observation.evidence_capture_ids, CAPTURE_ID)
      || !observation.evidence_capture_ids.every((captureId) => allowedCaptureIds.has(captureId))) {
      fail('KINETIC_VISION_RESPONSE_INVALID', 'vision observation is malformed or unsupported');
    }
  }
  return structuredClone(response.observations);
}

export function createVisionCritic(verifiedIdentity = null, trustedContext = null) {
  // The trusted composition root supplies provider metadata once; callers receive only this evaluator capability.
  let identity = null;
  let context = null;
  try { identity = normalizeIdentity(verifiedIdentity); }
  catch { /* malformed identity remains unverified */ }
  try { context = normalizeContext(trustedContext); }
  catch { /* malformed context cannot authorize durable design evaluation */ }
  return function evaluateVisionCritic(input = {}) {
    let fields;
    try { fields = dataRecord(input); }
    catch { return humanGate(); }
    if (!fields || !Object.hasOwn(fields, 'request')) return humanGate();
    const { request, responseText = '', receipt = null } = fields;
    const validatedRequest = createVisionRequest(request);
    let acceptedReceipt;
    try { acceptedReceipt = verifiedReceipt(validatedRequest, responseText, receipt, identity); }
    catch { return humanGate(); }
    if (!acceptedReceipt) return humanGate();
    const result = {
      status: 'VERIFIED_ADVISORY',
      advisory_recommendation: 'ADVANCE_TO_HUMAN',
      observations: parseObservations(responseText, validatedRequest),
      vision_receipt: acceptedReceipt,
    };
    VERIFIED_CRITIC_RESULTS.set(result, {
      context,
      request: structuredClone(validatedRequest),
      result: structuredClone(result),
    });
    return result;
  };
}

function designInvalid(message) {
  fail('KINETIC_DESIGN_EVALUATION_INVALID', message);
}

function textArray(value, { allowEmpty = true, pattern = null } = {}) {
  const items = dataArray(value, { allowEmpty });
  if (!items || new Set(items).size !== items.length
    || items.some((item) => typeof item !== 'string' || item.trim().length === 0
      || (pattern && !pattern.test(item)))) return null;
  return items;
}

function validateDesignQualityEvaluationData(input) {
  const inputFields = dataValues(input, DESIGN_INPUT_KEYS);
  if (!inputFields || typeof inputFields.caseId !== 'string' || typeof inputFields.variantId !== 'string') {
    designInvalid('design evaluation input is incomplete or malformed');
  }
  const evaluation = dataValues(inputFields.evaluation, DESIGN_EVALUATION_KEYS);
  const manifest = dataRecord(inputFields.captureManifest);
  const expectedRefs = dataRecord(inputFields.expectedRefs);
  if (!evaluation || !manifest || !expectedRefs
    || evaluation.schema !== 'kinetic/gym/design-quality-evaluation@0.1'
    || evaluation.case_id !== inputFields.caseId || evaluation.variant_id !== inputFields.variantId
    || typeof evaluation.evaluation_id !== 'string' || !/^dqe-[0-9a-z-]+$/.test(evaluation.evaluation_id)
    || typeof evaluation.rubric_version !== 'string' || evaluation.rubric_version.trim().length === 0
    || !['ai-critic', 'human'].includes(evaluation.producer)
    || !validDateTime(evaluation.created_at)) {
    designInvalid('design evaluation identity is incomplete or mismatched');
  }

  const provenanceRefs = textArray(evaluation.provenance_refs, { allowEmpty: false });
  const limitations = textArray(evaluation.limitations);
  if (!provenanceRefs || !limitations
    || evaluation.capture_manifest_ref !== expectedRefs.capture_manifest
    || evaluation.brief_ref !== expectedRefs.variant_brief
    || typeof expectedRefs.retrieval_receipt !== 'string'
    || !provenanceRefs.includes(expectedRefs.retrieval_receipt)) {
    designInvalid('design evaluation references do not match persisted inputs');
  }

  const entries = dataArray(manifest.entries, { allowEmpty: true });
  if (manifest.schema !== 'kinetic/gym/capture-manifest@0.1'
    || manifest.case_id !== inputFields.caseId || !entries) {
    designInvalid('capture manifest is malformed or mismatched');
  }
  const allowedCaptureIds = new Set();
  const captureSubjects = new Map();
  const readyCaptureHashes = [];
  for (const entry of entries) {
    const fields = dataRecord(entry);
    if (!fields) designInvalid('capture manifest entry is malformed');
    if (fields.readiness !== 'READY') continue;
    if (typeof fields.capture_id !== 'string' || !CAPTURE_ID.test(fields.capture_id)
      || typeof fields.subject_id !== 'string' || fields.subject_id.trim().length === 0
      || typeof fields.sha256 !== 'string' || !SHA256.test(fields.sha256)
      || allowedCaptureIds.has(fields.capture_id)) {
      designInvalid('ready capture evidence is malformed or duplicated');
    }
    allowedCaptureIds.add(fields.capture_id);
    captureSubjects.set(fields.capture_id, fields.subject_id);
    readyCaptureHashes.push(fields.sha256);
  }
  if (allowedCaptureIds.size === 0) designInvalid('design evaluation requires ready capture evidence');

  let trustedVision = null;
  if (evaluation.producer === 'ai-critic') {
    trustedVision = VERIFIED_CRITIC_RESULTS.get(inputFields.criticResult);
    const receipt = dataValues(evaluation.vision_receipt, RECEIPT_KEYS);
    const receiptHashes = receipt && textArray(receipt.capture_hashes, { allowEmpty: false, pattern: SHA256 });
    const requestCaptureIds = trustedVision
      ? [...trustedVision.request.reference_capture_ids, ...trustedVision.request.candidate_capture_ids]
      : [];
    if (!trustedVision || !receipt || !receiptHashes
      || trustedVision.context?.case_id !== inputFields.caseId
      || trustedVision.context?.variant_id !== inputFields.variantId
      || !isDeepStrictEqual(receipt, trustedVision.result.vision_receipt)
      || !isDeepStrictEqual(receiptHashes, readyCaptureHashes)
      || !isDeepStrictEqual(requestCaptureIds, [...allowedCaptureIds])
      || trustedVision.request.reference_capture_ids.some((captureId) => captureSubjects.get(captureId) !== 'reference')
      || trustedVision.request.candidate_capture_ids.some((captureId) => captureSubjects.get(captureId) !== evaluation.variant_id)
      || trustedVision.request.variant_brief_ref !== evaluation.brief_ref
      || trustedVision.request.rubric_version !== evaluation.rubric_version
      || !isDeepStrictEqual(trustedVision.request.relevant_provenance_refs, provenanceRefs)
      || trustedVision.request.optional_fidelity_report_ref !== (expectedRefs.fidelity_report ?? null)
      || trustedVision.result.advisory_recommendation !== evaluation.advisory_recommendation) {
      designInvalid('AI rubric requires the original S14-verified critic capability and request binding');
    }
  } else if (inputFields.criticResult !== null) {
    designInvalid('human visual fallback cannot carry an AI critic capability');
  }

  const dimensions = dataValues(evaluation.dimensions, RUBRIC_DIMENSIONS);
  if (!dimensions) designInvalid('all ten rubric dimensions are required');
  for (const dimension of RUBRIC_DIMENSIONS) {
    const row = dataValues(dimensions[dimension], DESIGN_DIMENSION_KEYS);
    if (!row || !['NOT_EVALUATED', 'STRENGTH', 'ACCEPTABLE', 'WEAK', 'FAILURE'].includes(row.status)
      || !['none', 'low', 'medium', 'high', 'blocker'].includes(row.severity)
      || row.producer !== evaluation.producer
      || !(row.confidence === null || (typeof row.confidence === 'number'
        && Number.isFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1))) {
      designInvalid(`${dimension} rubric result is malformed`);
    }
    const observations = textArray(row.observations);
    const strengths = textArray(row.strengths);
    const failures = textArray(row.failures);
    const evidence = textArray(row.evidence_capture_ids, { pattern: CAPTURE_ID });
    if (!observations || !strengths || !failures || !evidence
      || evidence.some((captureId) => !allowedCaptureIds.has(captureId))) {
      designInvalid(`${dimension} cites unsupported capture evidence`);
    }
    if (row.status === 'NOT_EVALUATED') {
      if (observations.length || strengths.length || failures.length || evidence.length
        || row.severity !== 'none' || row.confidence !== null) {
        designInvalid(`${dimension} cannot claim evidence when not evaluated`);
      }
      if (trustedVision?.result.observations.some((observation) => observation.dimension === dimension)) {
        designInvalid(`${dimension} cannot discard verified critic observations`);
      }
      continue;
    }
    if (evidence.length === 0 || observations.length + strengths.length + failures.length === 0
      || (row.status === 'STRENGTH' && strengths.length === 0)
      || (['WEAK', 'FAILURE'].includes(row.status) && failures.length === 0)) {
      designInvalid(`${dimension} requires evidence-bound rubric observations`);
    }
    if (trustedVision) {
      const source = trustedVision.result.observations.filter((observation) => observation.dimension === dimension);
      const sourceObservations = source.map((observation) => observation.observation);
      const sourceStrengths = source.filter((observation) => observation.kind === 'STRENGTH').map((observation) => observation.observation);
      const sourceFailures = source.filter((observation) => observation.kind === 'FAILURE').map((observation) => observation.observation);
      const sourceEvidence = [...new Set(source.flatMap((observation) => observation.evidence_capture_ids))];
      const severityOrder = ['none', 'low', 'medium', 'high', 'blocker'];
      const sourceSeverity = source.reduce((current, observation) => (
        severityOrder.indexOf(observation.severity) > severityOrder.indexOf(current) ? observation.severity : current
      ), 'none');
      const sourceConfidence = source.every((observation) => typeof observation.confidence === 'number')
        ? Math.min(...source.map((observation) => observation.confidence)) : null;
      if (source.length === 0
        || row.status !== (sourceFailures.length ? 'FAILURE' : 'STRENGTH')
        || !isDeepStrictEqual(observations, sourceObservations)
        || !isDeepStrictEqual(strengths, sourceStrengths)
        || !isDeepStrictEqual(failures, sourceFailures)
        || !isDeepStrictEqual(evidence, sourceEvidence)
        || row.severity !== sourceSeverity || !Object.is(row.confidence, sourceConfidence)) {
        designInvalid(`${dimension} must be an exact projection of verified critic observations`);
      }
    }
  }

  if (evaluation.producer === 'human') {
    if (evaluation.vision_receipt !== null || evaluation.advisory_recommendation !== 'HUMAN_VISUAL_GATE'
      || limitations.length === 0
      || RUBRIC_DIMENSIONS.some((dimension) => dimensions[dimension].status !== 'NOT_EVALUATED')) {
      designInvalid('human visual fallback cannot fabricate an AI evaluation');
    }
  }

  return structuredClone(evaluation);
}

export function validateDesignQualityEvaluation(input) {
  try { return validateDesignQualityEvaluationData(input); }
  catch (error) {
    if (error?.code === 'KINETIC_DESIGN_EVALUATION_INVALID') throw error;
    designInvalid('design evaluation contains unsafe or malformed data');
  }
}
