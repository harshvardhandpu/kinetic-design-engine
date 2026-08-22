# 53 — Promotion Gate & Engine Evolution

The ONLY write path from Gym to stable core. A successful experiment is a
CANDIDATE, never a promotion.

## Lifecycle

```
observation (case study / experiment / tool research)
 → pattern candidate        (written as hypothesis, tagged)
 → repeated evidence        (≥ N distinct cases, config default N=3)
 → successful variants      (appears in QUALIFIED candidates across cases)
 → evaluation               (metrics delta measured, 54)
 → human acceptance         (explicit, at review)
 → cross-project validation (used in ≥1 real application-loop job successfully)
 → regression tests         (added to core test suite BEFORE promotion)
 → promotion proposal       (PromotionCandidate schema)
 → stable KINETIC           (registry item / knowledge entry / evaluator rule)
```

## Evidence thresholds (defaults, configurable)

- **primitive/recipe promotion:** ≥3 distinct cases, ≥2 distinct surfaces,
  positive human signal in ≥2, perf/a11y gates green in all
- **knowledge/principle promotion:** ≥3 supporting cases OR 1 strong
  Figma-pair-evidenced mechanism + human acceptance
- **evaluator rule promotion:** zero false positives on the V0 calibration set
- **tool integration:** sandboxed experiment passed + user approval (46)

Single-case successes stay in the Gym as `pattern_candidate` — revisited by
PatternClusteringJob, never promoted.

## PromotionCandidate (schema: `schemas/gym/promotion-candidate.schema.json`)

```yaml
id:
kind: primitive|recipe|principle|evaluator-rule|tool-integration|motion-token
summary:
evidence: {case_ids, experiment_ids, variant_run_ids, metric_deltas}
human_decisions: [TasteDecision ids]
regression_tests: [test ids — must exist before merge]
risk: {compat, perf, a11y, legal}
status: proposed|accepted|rejected|merged
```

## EngineEvolutionRecord (schema: `schemas/gym/engine-evolution-record.schema.json`)

Written at merge; makes KINETIC's evolution auditable:

```yaml
version_introduced:
what: <item id + version>
why: <the problem it solved, in one paragraph>
source_cases: [...]
experiment_ids: [...]
human_decisions: [...]
benchmarks: {before, after, metric ids}
performance: {p_class, measured deltas}
accessibility: {contract summary}
failure_cases: [known failures/limitations at merge time]
supersedes: [prior item ids, if any]
```

## Rules

1. **No silent evolution.** Core changes without an EngineEvolutionRecord are a
   process violation detectable by audit (record ids are referenced from
   registry item metadata).
2. **Rejection is recorded** with reason — rejected promotions are negative
   knowledge about the gate itself.
3. **Rollback path:** every promoted item keeps its promotion evidence; if
   post-merge regressions appear, demotion follows the same audit trail.
