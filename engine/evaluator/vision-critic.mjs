import { createHash } from 'node:crypto';
import { types } from 'node:util';

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
const DIMENSIONS = new Set([
  'composition', 'typography', 'art_direction', 'depth', 'motion', 'interaction',
  'scroll_story', 'originality', 'cohesion', 'surface_fit',
]);
const CAPTURE_ID = /^cap-[0-9a-z-]+$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GENERIC_IDENTITY = /anonymous|unknown|unverified|unidentified|unspecified|generic|tool|service/i;
const GENERIC_IDENTITY_EXACT = new Set([
  'na', 'none', 'notapplicable', 'notavailable', 'tbd', 'notknown', 'redacted',
  'placeholder', 'default', 'unset', 'missing',
]);
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

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

function dataArray(value) {
  if (types.isProxy(value) || !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length === 0 || Reflect.ownKeys(value).length !== length + 1) return null;
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

export function createVisionCritic(verifiedIdentity = null) {
  // The trusted composition root supplies provider metadata once; callers receive only this evaluator capability.
  let identity = null;
  try { identity = normalizeIdentity(verifiedIdentity); }
  catch { /* malformed identity remains unverified */ }
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
    return {
      status: 'VERIFIED_ADVISORY',
      advisory_recommendation: 'ADVANCE_TO_HUMAN',
      observations: parseObservations(responseText, validatedRequest),
      vision_receipt: acceptedReceipt,
    };
  };
}
