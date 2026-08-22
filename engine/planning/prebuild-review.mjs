import { createHash } from 'node:crypto';

const GENERIC = /^(?:default|standard|normal|none|tbd|website|looks? good|hero|cards?|footer)$/i;
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value, null, 2)).digest('hex');
const strings = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim().length > 0);
const meaningful = (value, length = 8) => typeof value === 'string' && value.trim().length >= length && !GENERIC.test(value.trim());
const pass = (ruleId, passed, evidencePath, reason) => ({ rule_id: ruleId, passed, evidence_path: evidencePath, reason });
const influences = (brief) => Object.values(brief.source_provenance ?? {}).flat();

export function reviewBrief({
  brief,
  retrievalReceipt,
  fidelityReport = null,
  sourceRegistry = null,
  advisoryObservations = [],
  now = new Date().toISOString(),
}) {
  const original = ['V1', 'V2'].includes(brief?.variant_id);
  const composition = brief?.composition_plan ?? {};
  const typography = brief?.typography_plan ?? {};
  const art = brief?.art_direction ?? {};
  const motion = brief?.motion_plan ?? {};
  const signature = motion.signature_move ?? {};
  const provenance = influences(brief);
  const implementation = brief?.source_provenance?.implementation_sources ?? [];
  const sourceIds = [...new Set(provenance.map(({ source_id: id }) => id))].sort();
  const receiptSourceIds = [...new Set((retrievalReceipt?.sources_retrieved ?? []).map(({ source_id: id }) => id))].sort();
  const caseIds = [...new Set(brief?.design_case_ids_used ?? [])].sort();
  const receiptCaseIds = [...new Set((retrievalReceipt?.design_cases_retrieved ?? []).map(({ case_id: id }) => id))].sort();
  const signatureText = `${signature.central_idea ?? ''} ${signature.visual_transformation ?? ''} ${signature.purpose ?? ''} ${signature.content_relationship ?? ''}`;
  const genericSections = strings(composition.sections) && composition.sections.every((section) => GENERIC.test(section.trim()));
  const genericTypography = ['display_role', 'body_role', 'scale_strategy', 'contrast_strategy', 'rhythm', 'responsive_behavior']
    .every((key) => !meaningful(typography[key], 4));
  const grounded = caseIds.length > 0
    && retrievalReceipt?.case_id === brief?.case_id && retrievalReceipt?.variant_id === brief?.variant_id
    && JSON.stringify(caseIds) === JSON.stringify(receiptCaseIds)
    && JSON.stringify(sourceIds) === JSON.stringify(receiptSourceIds)
    && provenance.every((row) => meaningful(row.retrieval_reason, 4) && strings(row.knowledge_used) && Array.isArray(row.attribution) && row.attribution.length > 0);
  let registryKnown = true;
  if (sourceRegistry?.lookupSource) {
    registryKnown = sourceIds.every((sourceId) => { try { return sourceRegistry.lookupSource(sourceId).source_id === sourceId; } catch { return false; } });
  }
  const rightsMatch = grounded && registryKnown && (retrievalReceipt?.sources_retrieved ?? []).every(({ rights_allowed }) => rights_allowed === true);
  const substantiveSignature = ['central_idea', 'visual_transformation', 'purpose', 'content_relationship'].every((key) => meaningful(signature[key], 12));
  const decorativeOnly = /^(?:\s*(?:hover|lift|fade|nice|card)\s*)+$/i.test(signatureText.replace(/[^a-z]+/gi, ' ').trim());
  const originalPlan = brief?.originality_plan ?? {};
  const componentDependencies = implementation.filter(({ usage_mode }) => usage_mode === 'BUILD_DEPENDENCY').length;

  const ruleResults = [
    pass('PB01_GENERIC_HERO_CARDS', !(genericSections && (!meaningful(composition.spatial_system) || !meaningful(brief?.core_concept))), '$.composition_plan', 'sections require an authored spatial or narrative concept beyond generic hero/cards/footer'),
    pass('PB02_DEFAULT_TYPOGRAPHY', !genericTypography, '$.typography_plan', 'typography roles and strategies must not all be defaults'),
    pass('PB03_NO_ASSET_STRATEGY', meaningful(art.imagery_strategy, 3) && meaningful(art.asset_strategy, 3), '$.art_direction.asset_strategy', 'imagery and asset strategy must be explicit'),
    pass('PB04_NO_SIGNATURE_MOVE', !original || substantiveSignature, '$.motion_plan.signature_move', original ? 'originals require a substantive composition-linked signature move' : 'V0 is exempt from originality signature requirements'),
    pass('PB05_DECORATIVE_ONLY_MOTION', !original || !decorativeOnly, '$.motion_plan.signature_move', original ? 'motion must serve structure rather than decoration alone' : 'V0 is exempt from originality motion requirements'),
    pass('PB06_NO_TRANSITION_STORYBOARD', strings(motion.scroll_storyboard) && strings(motion.transitions), '$.motion_plan.scroll_storyboard', 'scroll storyboard and transitions must be explicit'),
    pass('PB07_NO_DEPTH_DECISION', meaningful(art.depth, 4) && meaningful(art.layering, 4), '$.art_direction.depth', 'depth and layering decisions must be explicit'),
    pass('PB08_WEAK_NARRATIVE', meaningful(brief?.core_concept, 10) && meaningful(composition.visual_hierarchy, 4) && strings(composition.focal_points), '$.core_concept', 'core concept, hierarchy, and focal points must form an authored narrative'),
    pass('PB09_INSUFFICIENT_SOURCE_GROUNDING', grounded, '$.source_provenance', 'brief DesignCases and influential sources must match retrieval provenance with attribution'),
    pass('PB10_DERIVATIVE_COMPOSITION', !original || (strings(originalPlan.composition_differences) && strings(originalPlan.typography_differences) && strings(originalPlan.motion_differences) && strings(brief?.reference_transfer?.prohibited_copying)), '$.originality_plan', original ? 'originals require explicit composition, typography, motion, and copying differences' : 'V0 fidelity study is exempt from originality differences'),
    pass('PB11_COMPONENT_SOUP', implementation.length <= 2 && componentDependencies <= 1, '$.source_provenance.implementation_sources', 'at most two implementation influences and one catalogue build dependency are allowed'),
    pass('PB12_RIGHTS_MISMATCH', rightsMatch, '$.source_provenance', 'every influential source must be present and rights-authorized in the retrieval receipt'),
    pass('PB13_WEAK_QUALITY_HYPOTHESIS', meaningful(brief?.quality_hypothesis, 12), '$.quality_hypothesis', 'quality hypothesis must be substantive and testable'),
    pass('PB14_SOURCE_ORDER_VIOLATION', implementation.length === 0 || (meaningful(brief?.core_concept, 10) && strings(brief?.reference_transfer?.retained_principles)), '$.source_provenance.implementation_sources', 'concept and retained principles must precede implementation influences'),
    pass('PB15_ORIGINALS_BEFORE_V0', !original || fidelityReport?.human_approval?.decision === 'APPROVED', '$.fidelity_report.human_approval', original ? 'V1/V2 require human-approved V0 fidelity evidence' : 'V0 is the required first study'),
  ];

  const observations = advisoryObservations.map(({ producer, observation, severity, confidence }) => {
    if (!['deterministic', 'ai-critic', 'human'].includes(producer) || typeof observation !== 'string' || observation.length === 0
      || !['info', 'low', 'medium', 'high', 'blocker'].includes(severity)
      || !(confidence === null || (typeof confidence === 'number' && confidence >= 0 && confidence <= 1))) {
      throw Object.assign(new Error('invalid advisory observation'), { code: 'KINETIC_PREBUILD_OBSERVATION_INVALID' });
    }
    return { producer, observation, severity, confidence };
  });
  const failed = ruleResults.filter(({ passed }) => !passed);
  const hardReject = new Set(['PB09_INSUFFICIENT_SOURCE_GROUNDING', 'PB12_RIGHTS_MISMATCH', 'PB15_ORIGINALS_BEFORE_V0']);
  const advisoryBlocker = observations.some(({ severity }) => severity === 'blocker');
  const advisoryRevision = advisoryBlocker || observations.some(({ severity }) => severity === 'high');
  const decision = failed.length > 0 ? (failed.some(({ rule_id }) => hardReject.has(rule_id)) ? 'REJECTED' : 'REVISE')
    : advisoryBlocker ? 'REJECTED' : advisoryRevision ? 'REVISE' : 'APPROVED';
  const identity = `${brief.case_id}:${brief.variant_id}:${sha256(brief)}:${sha256(retrievalReceipt)}`;
  return {
    schema: 'kinetic/gym/prebuild-review@0.1',
    review_id: `pbr-${createHash('sha256').update(identity).digest('hex').slice(0, 20)}`,
    case_id: brief.case_id,
    variant_id: brief.variant_id,
    brief_sha256: sha256(brief),
    retrieval_sha256: sha256(retrievalReceipt),
    decision,
    rule_results: ruleResults,
    advisory_observations: observations,
    blocking_reasons: failed.map(({ rule_id, reason }) => `${rule_id}: ${reason}`).concat(advisoryRevision ? ['advisory observation requires human revision'] : []),
    reviewer: 'kinetic/prebuild-review@0.1',
    created_at: now,
  };
}
