# 44 — Quality Floor

No candidate reaches human review without durable technical and visual evidence.
Phase 2.5 separates evidence readiness from human qualification.

## Phase 2.5 sequence

```text
TECHNICAL_EVALUATED
 → VISUAL_CAPTURED
 → DESIGN_EVALUATED
 → REVIEW_READY
 → HUMAN_REVIEWED
```

`DESIGN_EVALUATED` means a schema-valid DesignQualityEvaluation was persisted
against a validated CaptureManifest. It does **not** mean the design passed.
The evaluation records all ten rubric dimensions separately:

- composition
- typography
- art direction
- depth
- motion
- interaction
- scroll story
- originality
- cohesion
- surface fit

Every evaluated visual claim cites a ready capture ID from the persisted
manifest. Aggregate design scores are not part of the contract.

## Producer and authority separation

```text
objective checks       → deterministic technical evidence
capture pipeline       → deterministic visual evidence
verified AI critic     → evidence-bound advisory observations from a case/variant-bound in-process result
unverified/serialized AI output → HUMAN_VISUAL_GATE, without fabricated observations
human review           → final design and taste-learning authority
```

An AI critic may recommend `ADVANCE_TO_HUMAN`, `REVISE`, or `REJECT`, but that
recommendation cannot set qualification. Until explicit human review:

```text
design_qualified = null
acceptable_for_further_taste_learning = null
```

Technical qualification remains independent and is not rewritten by design
evaluation. Reports always identify their producer; subjective observations are
never presented as deterministic results.

## V0 fidelity boundary

V0 remains a nondeployable internal reference study. Its transition to
`DESIGN_EVALUATED` requires both a DesignQualityEvaluation and a complete
FidelityReport. That transition still does not approve V0 for design or taste
learning. Original slots require the separate human-approved V0 fidelity gate.

## Repair loop

```text
REJECTED(diagnosis) → targeted repair
                    → resume from the failed gate
                    → exhausted retry budget → REJECTED_FINAL
```

Regeneration is a batch-level decision and consumes a new slot attempt; targeted
repair remains the cheaper first path.

## Legacy Phase 2

The earlier generated → technical/responsive/a11y/performance → design →
qualified flow remains a separate compatibility path. Its historical score and
rejection language does not define Phase 2.5 qualification semantics.
