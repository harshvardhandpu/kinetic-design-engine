# 39 — Static-to-Experience Pairs

Schema: `schemas/gym/static-to-experience-pair.schema.json`.

A pair records one mapping from static visual intent to runtime behavior, with
provenance and confidence. Pairs accumulate into a retrieval library used at
generation time: "this static pattern usually becomes this kind of behavior."

## Schema shape

```yaml
id:
case_id:                    # DesignCase it came from (or null for synthetic)
static:
  description:              # what the static artifact shows
  artifact_ref:             # screenshot/figma-node ref (content-addressed)
  kind: hero|card|nav|illustration|composition|3d-artwork|other
experience:
  description:              # the observed runtime behavior
  kind: entrance|hover|scroll|parallax|transition|responsive|spatial-interaction|ambient
  evidence: DIRECTLY-INSPECTED|VISUALLY-INSPECTED|FIGMA-LIVE-COMPARE|INFERRED
  confidence: 0..1
  motion_tokens:            # Phase-1 motion-token values if measured
  primitive_refs:           # KINETIC primitive ids if mappable
notes:
```

## Canonical pair families (hypotheses to validate with evidence)

```
static hero            → entrance choreography
static card            → hover behavior / expand
static illustration    → parallax / scroll-driven transform
static nav             → transition + mobile pattern
static composition     → responsive transformation rules
static 3D artwork      → runtime spatial interaction
```

These are ENGINE-INFERENCE until populated with observed pairs. The corpus job
extracts pairs during reference study; the Figma loop (38) produces the
highest-confidence ones.

## Use

- **Generation:** candidate briefs retrieve top-k pairs matching the static
  pattern being built → grounded motion choices instead of invented ones.
- **Image-only mode (40):** the ONLY legitimate source of motion hypotheses
  when no live reference exists.
- **Evaluation:** pairs justify "expected behavior" checks in the evaluator.

## Hard rule

An image cannot reveal interactions it never displayed. Where behavior was not
observable, the pair says `evidence: INFERRED` and the inference is attributed
to learned design knowledge — never presented as recovered fact.
