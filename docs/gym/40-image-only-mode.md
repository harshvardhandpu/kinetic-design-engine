# 40 — Image-Only Mode

Long-term capability: input = one image (screenshot/mockup/sketch); output =
working responsive site with appropriate motion. SPECIFIED here, not built.

## Pipeline

```
image
 → layout segmentation        (regions, grid hypothesis, reading order)
 → visual token extraction    (palette, type roles, spacing rhythm, radii, shadows)
 → surface classification     (Phase-1 surface taxonomy)
 → component hypothesis       (nav/hero/cards/forms/… with roles)
 → design grammar retrieval   (similar DesignCases by tokens+layout+surface)
 → motion hypotheses          (StaticToExperiencePairs ONLY — never invented-as-observed)
 → candidate generation       (brief assembled from retrieved context)
 → browser rendering
 → evaluation                 (quality floor, 44)
 → repair                     (Phase-1 repair stage)
```

## Epistemic rule (the whole point of this doc)

An image contains NO interaction information. Therefore:

1. Every motion/interaction decision in image-only mode is tagged
   `origin: inferred-from-knowledge` and cites the retrieved cases/pairs that
   motivated it.
2. The system never claims to "recover" the original site's behavior.
3. Confidence of the whole output is capped by retrieval quality: if similar
   cases are weak, the brief says so and the evaluator weights originality
   over fidelity (there is no fidelity target).

## Model-agnostic requirement

Each pipeline stage produces a schema'd intermediate artifact so stages can run
on different models/providers and resume independently (`docs/gym/48`,
`docs/gym/50`). Segmentation and token extraction must work with a vision
model OR with DOM probes when the image came from a live page.

## Benchmark

The Image-to-Award-Quality benchmark (`docs/gym/54` §benchmark) is the
acceptance test for this mode: fixed held-out screenshots, scored across engine
versions. Image-only mode is considered "working" only when benchmark scores
trend up across versions — never declared from anecdotes.

## Dependency on the learning loop

Image-only quality = retrieval quality × generation quality. More cases, better
pairs, sharper taste profile all raise the ceiling; the generator model is only
one factor. This is why the Gym exists (30).
