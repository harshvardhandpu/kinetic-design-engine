const FORWARD_STATES = [
  'PLANNED', 'BRIEF_VALIDATED', 'RETRIEVAL_PROVEN', 'PREBUILD_APPROVED', 'BUILDING',
  'BUILT', 'TECHNICAL_EVALUATED', 'VISUAL_CAPTURED', 'DESIGN_EVALUATED',
  'REVIEW_READY', 'HUMAN_REVIEWED',
];
const TERMINAL_STATES = new Set(['HUMAN_REVIEWED', 'REJECTED_FINAL', 'CANCELLED']);
const QUALIFICATION_KEYS = new Set(['technically_qualified', 'design_qualified', 'acceptable_for_further_taste_learning']);

export class TransitionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TransitionError';
    this.code = code;
  }
}

function clone(value) {
  return structuredClone(value);
}

function getSlot(caseRun, slot) {
  if (!caseRun || caseRun.schema !== 'kinetic/gym/case-run@0.2') throw new TransitionError('KINETIC_CASE_RUN_INVALID', 'Phase-2.5 transitions require case-run@0.2');
  const record = caseRun.slots?.[slot];
  if (!record) throw new TransitionError('KINETIC_SLOT_NOT_FOUND', `unknown slot: ${slot}`);
  return record;
}

function assertV0Invariant(record, artifactRefs = {}) {
  if (record.slot !== 'V0') return;
  if (record.deployable !== false || record.original_work !== false || record.design_qualified !== null || record.acceptable_for_further_taste_learning !== null) {
    throw new TransitionError('KINETIC_V0_QUALIFICATION_FORBIDDEN', 'V0 remains nondeployable, nonoriginal, and outside design/taste qualification');
  }
  if (artifactRefs.design_qualified != null || artifactRefs.acceptable_for_further_taste_learning != null || artifactRefs.deployable === true || artifactRefs.original_work === true) {
    throw new TransitionError('KINETIC_V0_QUALIFICATION_FORBIDDEN', 'V0 cannot receive design or taste qualification');
  }
}

export function assertVariantBriefPolicy({ brief, caseId, slot }) {
  if (!brief || brief.schema !== 'kinetic/gym/variant-brief@0.1' || brief.case_id !== caseId || brief.variant_id !== slot) {
    throw new TransitionError('KINETIC_BRIEF_INVALID', 'brief schema, case, and slot identity must match');
  }
  if (!Array.isArray(brief.design_case_ids_used) || brief.design_case_ids_used.length === 0) {
    throw new TransitionError('KINETIC_BRIEF_INVALID', 'brief requires DesignCase provenance');
  }
  for (const group of Object.values(brief.source_provenance ?? {})) {
    if (!Array.isArray(group)) throw new TransitionError('KINETIC_BRIEF_INVALID', 'source provenance groups must be arrays');
    for (const influence of group) {
      if (!Array.isArray(influence.knowledge_used) || !Array.isArray(influence.attribution) || influence.attribution.some(({ knowledge_index: index }) => !Number.isInteger(index) || index < 0 || index >= influence.knowledge_used.length)) {
        throw new TransitionError('KINETIC_BRIEF_INVALID', 'source attribution must index knowledge_used');
      }
    }
  }
  if (brief.planning_exception && brief.planning_exception.scope !== 'OPTIONAL_KNOWLEDGE_SOURCE_UNAVAILABLE') {
    throw new TransitionError('KINETIC_BRIEF_INVALID', 'planning exceptions cannot bypass required provenance or rights');
  }
  if (!['V1', 'V2'].includes(slot)) return true;
  const signature = brief.motion_plan?.signature_move ?? {};
  const substantive = ['central_idea', 'visual_transformation', 'purpose', 'content_relationship']
    .every((key) => typeof signature[key] === 'string' && signature[key].trim().length >= 12);
  const combined = `${signature.name ?? ''} ${signature.central_idea ?? ''} ${signature.visual_transformation ?? ''} ${signature.purpose ?? ''} ${signature.content_relationship ?? ''}`.toLowerCase();
  const onlyDecorative = /^(?:\s*(?:hover|lift|fade|nice|card)\s*)+$/.test(combined.replace(/[^a-z]+/g, ' '));
  const originality = brief.originality_plan;
  if (!substantive || onlyDecorative || !originality || !Array.isArray(originality.composition_differences) || originality.composition_differences.length === 0 || String(originality.signature_move_hypothesis ?? '').trim().length < 12) {
    throw new TransitionError('KINETIC_WEAK_VARIANT_BRIEF', 'V1/V2 require a substantive, composition-linked signature move and originality plan');
  }
  return true;
}

export function nextState(slot) {
  if (!slot || TERMINAL_STATES.has(slot.state)) return null;
  const index = FORWARD_STATES.indexOf(slot.state);
  return index >= 0 && index < FORWARD_STATES.length - 1 ? FORWARD_STATES[index + 1] : null;
}

export function assertTransition({ caseRun, slot, toState, artifactRefs = {} }) {
  const record = getSlot(caseRun, slot);
  assertV0Invariant(record, artifactRefs);
  if (TERMINAL_STATES.has(record.state)) throw new TransitionError('KINETIC_TRANSITION_DENIED', `terminal state ${record.state} cannot advance`);
  const expected = nextState(record, caseRun);
  if (toState !== expected) throw new TransitionError('KINETIC_TRANSITION_DENIED', `expected adjacent state ${expected ?? 'none'}, got ${toState}`);
  if (toState === 'BRIEF_VALIDATED' && (artifactRefs.brief_validated !== true || typeof artifactRefs.variant_brief !== 'string')) {
    throw new TransitionError('KINETIC_BRIEF_REQUIRED', 'BRIEF_VALIDATED requires a persisted schema-valid brief');
  }
  if (toState === 'RETRIEVAL_PROVEN' && (artifactRefs.retrieval_proven !== true || typeof artifactRefs.retrieval_receipt !== 'string')) {
    throw new TransitionError('KINETIC_RETRIEVAL_REQUIRED', 'RETRIEVAL_PROVEN requires a validated rights-filtered receipt');
  }
  if (toState === 'BUILDING' && artifactRefs.brief_hash_unchanged !== true) {
    throw new TransitionError('KINETIC_BRIEF_CHANGED', 'BUILDING requires the persisted brief hash to remain unchanged');
  }
  if (toState === 'VISUAL_CAPTURED' && record.technically_qualified !== true) {
    throw new TransitionError('KINETIC_TECHNICAL_QUALIFICATION_REQUIRED', 'visual capture requires explicit technical qualification');
  }
  for (const key of Object.keys(artifactRefs)) {
    if (QUALIFICATION_KEYS.has(key)) throw new TransitionError('KINETIC_QUALIFICATION_EXPLICIT_REQUIRED', `${key} is not inferred by lifecycle transition`);
  }
  return true;
}

export function applyTransition({ caseRun, slot, toState, artifactRefs = {}, now = new Date().toISOString() }) {
  assertTransition({ caseRun, slot, toState, artifactRefs });
  const next = clone(caseRun);
  const record = next.slots[slot];
  const fromState = record.state;
  record.state = toState;
  record.timestamps[toState] = now;
  record.blocked_condition = null;
  for (const [key, value] of Object.entries(artifactRefs)) {
    if (key in record.refs && !QUALIFICATION_KEYS.has(key)) record.refs[key] = value;
  }
  next.updated_at = now;
  next.history.push({ event_id: `transition-${record.run_id}-${record.attempt}-${fromState}-${toState}`, event: `${fromState}->${toState}`, slot, artifact_ref: null, timestamp: now });
  return next;
}

export function prepareRetry({ caseRun, slot, fromState, diagnosisRef, now = new Date().toISOString() }) {
  const record = getSlot(caseRun, slot);
  if (record.state !== fromState || !['BUILDING', 'TECHNICAL_EVALUATED', 'DESIGN_EVALUATED'].includes(fromState)) {
    throw new TransitionError('KINETIC_TRANSITION_DENIED', `retry is not allowed from ${record.state}`);
  }
  if (typeof diagnosisRef !== 'string' || diagnosisRef.length === 0) throw new TransitionError('KINETIC_RETRY_DIAGNOSIS_REQUIRED', 'retry requires a durable diagnosis reference');
  if (record.attempt >= 3) throw new TransitionError('KINETIC_RETRY_EXHAUSTED', 'retry budget exhausted');
  const next = clone(caseRun);
  const target = next.slots[slot];
  target.attempts.push({
    attempt: target.attempt,
    status: 'FAILED',
    input_sha256: null,
    artifact_refs: [],
    diagnosis_ref: diagnosisRef,
    started_at: target.timestamps.BUILDING ?? target.timestamps[fromState] ?? now,
    ended_at: now,
  });
  target.attempt += 1;
  target.state = fromState === 'BUILDING' ? 'PREBUILD_APPROVED' : 'BUILDING';
  target.timestamps[target.state] = now;
  target.blocked_condition = null;
  next.updated_at = now;
  next.history.push({ event_id: `retry-${target.run_id}-${target.attempt}`, event: `retry-from-${fromState}`, slot, artifact_ref: diagnosisRef, timestamp: now });
  return next;
}

export const phase25States = Object.freeze([...FORWARD_STATES, 'REJECTED_FINAL', 'CANCELLED']);
