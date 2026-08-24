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

export function assertFidelityPolicy(report, { caseId, requireApproval = false } = {}) {
  if (!report || report.schema !== 'kinetic/gym/fidelity-report@0.1' || report.case_id !== caseId
    || report.variant_id !== 'V0' || report.classification !== 'INTERNAL_REFERENCE_STUDY'
    || report.deployable !== false || report.original_work !== false) {
    throw new TransitionError('KINETIC_FIDELITY_REQUIRED', 'a matching internal V0 FidelityReport is required');
  }
  if (report.approval_producer !== 'human') {
    throw new TransitionError('KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED', 'fidelity authority must be an explicit human');
  }
  const dimensions = Object.values(report.dimensions ?? {});
  if (dimensions.length !== 12 || dimensions.some((dimension) => !Array.isArray(dimension.capture_refs) || dimension.capture_refs.length < 2
    || !Array.isArray(dimension.source_refs) || dimension.source_refs.length === 0)) {
    throw new TransitionError('KINETIC_FIDELITY_EVIDENCE_REQUIRED', 'every fidelity dimension requires paired reference/V0 captures and source evidence');
  }
  if (requireApproval && (report.approval !== 'APPROVED' || report.understood !== true || typeof report.approved_at !== 'string' || Number.isNaN(Date.parse(report.approved_at)))) {
    throw new TransitionError('KINETIC_HUMAN_FIDELITY_APPROVAL_REQUIRED', 'originals require a complete human-approved V0 FidelityReport');
  }
  return true;
}

export function addOriginalSlot({ caseRun, slot, fidelityValidated = false, fidelityRef, now = new Date().toISOString() }) {
  if (!['V1', 'V2'].includes(slot) || caseRun.slots?.[slot] || Object.keys(caseRun.slots ?? {}).filter((key) => ['V1', 'V2'].includes(key)).length >= 2) {
    throw new TransitionError('KINETIC_ORIGINAL_SLOT_LIMIT', 'Phase-2.5 allows exactly V1 and V2 originals');
  }
  if (!caseRun.slots?.V0 || !['DESIGN_EVALUATED', 'REVIEW_READY', 'HUMAN_REVIEWED'].includes(caseRun.slots.V0.state)
    || fidelityValidated !== true || typeof fidelityRef !== 'string') {
    throw new TransitionError('KINETIC_FIDELITY_REQUIRED', 'original slots require completed V0 fidelity evidence');
  }
  const next = clone(caseRun);
  next.slots[slot] = {
    schema: 'kinetic/gym/variant-run@0.2', run_id: `run-${caseRun.case_id}-${slot.toLowerCase()}`, case_id: caseRun.case_id, slot,
    mode: 'original', state: 'PLANNED', attempt: 1, deployable: true, original_work: true,
    technically_qualified: false, design_qualified: null, acceptable_for_further_taste_learning: null,
    refs: { variant_brief: null, retrieval_receipt: null, prebuild_review: null, build_receipt: null, technical_evaluation: null, capture_manifest: null, design_evaluation: null, fidelity_report: fidelityRef },
    attempts: [], blocked_condition: null, timestamps: { PLANNED: now },
  };
  next.updated_at = now;
  next.history.push({ event_id: `add-${caseRun.case_id}-${slot}`, event: 'original-slot-planned', slot, artifact_ref: fidelityRef, timestamp: now });
  return next;
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
  if (toState === 'PREBUILD_APPROVED' && (artifactRefs.prebuild_approved !== true || typeof artifactRefs.prebuild_review !== 'string')) {
    throw new TransitionError('KINETIC_PREBUILD_REVIEW_REQUIRED', 'PREBUILD_APPROVED requires an APPROVED review with all hard rules passing');
  }
  if (toState === 'BUILDING' && artifactRefs.brief_hash_unchanged !== true) {
    throw new TransitionError('KINETIC_BRIEF_CHANGED', 'BUILDING requires the persisted brief hash to remain unchanged');
  }
  if (toState === 'BUILDING' && artifactRefs.retrieval_hash_unchanged !== true) {
    throw new TransitionError('KINETIC_RETRIEVAL_CHANGED', 'BUILDING requires the persisted retrieval hash to remain unchanged');
  }
  if (toState === 'BUILDING' && artifactRefs.prebuild_hash_unchanged !== true) {
    throw new TransitionError('KINETIC_PREBUILD_REVIEW_CHANGED', 'BUILDING requires the approved prebuild review hash to remain unchanged');
  }
  if (toState === 'DESIGN_EVALUATED' && record.technically_qualified !== true) {
    throw new TransitionError('KINETIC_TECHNICAL_QUALIFICATION_REQUIRED', 'design evaluation requires explicit technical qualification');
  }
  if (toState === 'DESIGN_EVALUATED' && (record.design_qualified !== null || record.acceptable_for_further_taste_learning !== null)) {
    throw new TransitionError('KINETIC_DESIGN_QUALIFICATION_FORBIDDEN', 'design evaluation cannot pre-set design or taste qualification');
  }
  if (toState === 'DESIGN_EVALUATED' && (artifactRefs.design_evaluation_validated !== true || typeof artifactRefs.design_evaluation !== 'string')) {
    throw new TransitionError('KINETIC_DESIGN_EVALUATION_REQUIRED', 'DESIGN_EVALUATED requires a persisted validated rubric evaluation');
  }
  if (toState === 'DESIGN_EVALUATED' && record.slot === 'V0' && (artifactRefs.fidelity_validated !== true || typeof artifactRefs.fidelity_report !== 'string')) {
    throw new TransitionError('KINETIC_FIDELITY_REQUIRED', 'V0 DESIGN_EVALUATED requires a complete FidelityReport');
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

export function applyHumanReview({ caseRun, decision, decisionRef, currentDecisionId = null, now = new Date().toISOString() }) {
  const fail = (message) => { throw new TransitionError('KINETIC_HUMAN_REVIEW_INVALID', message); };
  if (caseRun?.schema !== 'kinetic/gym/case-run@0.2' || decision?.schema !== 'kinetic/gym/taste-decision@0.2'
    || decision.context?.case_id !== caseRun.case_id || typeof decisionRef !== 'string' || decisionRef.length === 0
    || !Array.isArray(decision.candidates) || decision.candidates.length !== 2
    || new Set(decision.candidates).size !== 2 || !decision.candidates.every((slot) => ['V1', 'V2'].includes(slot))) {
    fail('human decision must match the Phase-2.5 case and exactly V1/V2');
  }
  const expectedSlots = ['V1', 'V2'];
  const originals = expectedSlots.map((slot) => caseRun.slots?.[slot]);
  const correction = caseRun.review_state === 'HUMAN_REVIEWED';
  if (originals.some((record, index) => !record || record.slot !== expectedSlots[index] || record.case_id !== caseRun.case_id
    || record.mode !== 'original' || record.deployable !== true || record.original_work !== true
    || record.state !== (correction ? 'HUMAN_REVIEWED' : 'REVIEW_READY'))
    || (!correction && (caseRun.review_state !== 'REVIEW_READY' || caseRun.taste_decision_ref !== null || decision.supersedes !== null))
    || (correction && (typeof currentDecisionId !== 'string' || decision.supersedes !== currentDecisionId))) {
    fail('review requires a ready original batch; corrections must supersede the current decision');
  }
  const outcome = decision.outcome;
  const rows = outcome?.candidate_decisions;
  if (!outcome || !rows || !['V1', 'V2'].every((slot) => typeof rows[slot]?.quality_floor_passed === 'boolean'
    && typeof rows[slot]?.acceptable_for_further_taste_learning === 'boolean')) fail('every original requires explicit floor and learning booleans');
  const anyAccepted = ['V1', 'V2'].some((slot) => rows[slot].quality_floor_passed || rows[slot].acceptable_for_further_taste_learning);
  if (outcome.result === 'WINNER_SELECTED') {
    if (!['V1', 'V2'].includes(outcome.relative_preference) || outcome.winner !== outcome.relative_preference
      || rows[outcome.winner].quality_floor_passed !== true) fail('winner requires matching unique preference and explicit floor pass');
  } else if (outcome.result === 'PARTIAL_ACCEPTANCE') {
    if (outcome.winner !== null || !anyAccepted) fail('partial acceptance requires an explicit useful signal and no forced winner');
  } else if (outcome.result === 'REJECT_ALL') {
    if (outcome.winner !== null || anyAccepted) fail('reject-all requires every floor and learning value false');
  } else fail('unsupported human outcome');

  const next = clone(caseRun);
  for (const slot of expectedSlots) {
    const record = next.slots[slot];
    record.design_qualified = rows[slot].quality_floor_passed;
    record.acceptable_for_further_taste_learning = rows[slot].acceptable_for_further_taste_learning;
    if (!correction) {
      record.state = 'HUMAN_REVIEWED';
      record.timestamps.HUMAN_REVIEWED = now;
    }
  }
  next.review_state = 'HUMAN_REVIEWED';
  next.taste_decision_ref = decisionRef;
  next.updated_at = now;
  next.history.push({
    event_id: `human-review-${decision.decision_id}`, event: correction ? 'human-review-corrected' : 'human-review-recorded',
    slot: null, artifact_ref: decisionRef, timestamp: now,
  });
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
