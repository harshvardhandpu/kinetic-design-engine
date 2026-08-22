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
