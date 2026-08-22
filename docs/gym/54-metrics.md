# 54 — Metrics

Measured by the EvaluationJob + weekly consolidation. Every metric has a
producer, a denominator, and a version — no vibes.

## North star

```
first_shot_preference_rate
  = batches where human winner came from the FIRST generation round
    / batches with a human winner
```

The real target: Hermes produces the design the user would choose, first try.
Tracked overall and per (surface × goal cell). This is the metric the whole
Gym optimizes; everything else is diagnostic.

## Pipeline health

| Metric | Definition |
|---|---|
| candidate_qualification_rate | QUALIFIED / generated (per slot class) |
| gate_pass_rates | per gate (technical/responsive/a11y/perf) |
| repair_iterations_avg | repair attempts per qualified candidate |
| empty_slot_rate | slots honestly left empty (quality-floor working, not filler) |
| fidelity_score | V0 per-aspect match distribution |
| resolution_accuracy | visual→source mapping correct on first probe (Phase-1 metric) |
| build_cost | tokens + wall-clock per candidate, by stage |
| free_model_completion_rate | stages completed on `min_model_class: any` (48) |

## Learning health

| Metric | Definition |
|---|---|
| pairwise_confidence | taste cells above observation threshold / all cells |
| recipe_reuse_rate | candidates using registry recipes vs from-scratch |
| experiment_promotion_rate | promotions / experiments (too high = lax gate; too low = dead lab) |
| slop_rejection_rate | candidates rejected for slop/genericness (trend should FALL as taste improves) |
| negative_recurrence | same failure_class×context recurring after negative entry exists (should → 0) |
| corpus_coverage | strata saturation map (33) |

## Benchmark: Image-to-Award-Quality (37, 40)

Fixed held-out set (≥10 screenshots across surfaces, versioned, never in the
training corpus). Per engine version, generate → score:

```
visual understanding · layout reconstruction · brand interpretation ·
responsive inference · motion quality · interaction quality · originality ·
technical quality · performance · accessibility
```

Scored by: objective gates (scripted) + AI critic (labeled) + human pairwise
vs previous-version outputs (highest authority). Version-over-version deltas
are the honest progress report for image-only mode.

## Anti-Goodhart rules

- volume metrics (cases studied, builds produced) are REPORTED, never targets
- a metric moving while first_shot_preference_rate is flat triggers
  FailureAnalysisJob investigation, not celebration
- all metric definitions are versioned; changing a definition starts a new
  series (no retroactive smoothing)
