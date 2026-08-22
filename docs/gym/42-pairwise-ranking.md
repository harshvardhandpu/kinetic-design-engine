# 42 — Pairwise Preference Learning

Absolute 1–10 ratings are noisy and non-comparable across sessions. Pairwise
outcomes ("A over B, because…") are the primary signal.

## Data

Every TasteDecision may carry pairwise rows:

```yaml
{preferred: V6, over: V3, reasons: [hierarchy, typography, motion-purpose]}
```

Plus two synthetic producer classes (kept separate, lower authority):

- **automated critic pairs** — the AI critic's forced-choice between two
  candidates, with rationale (producer: `evaluator`)
- **external weak labels** — award outcomes as implicit pairs (winner over
  nominees of the same category/year; producer: `award-signal`, lowest weight)

## Ranking model (specified, not built)

Maintain per-candidate-ATTRIBUTE scores, not per-variant scores — variants are
one-off; attributes transfer. A lightweight Bradley-Terry-style update over
attribute-level outcomes:

```
each pairwise row votes on the differing attributes between the two variants
(variant briefs declare varied_dimensions, so the diff is known)
weight: human=1.0, evaluator=0.3, award-signal=0.1   (configurable)
update: attribute score += w · (outcome − expected)
```

Deliberately simple: interpretable, resumable, no training infrastructure.
Upgrade path (documented, not scheduled): move to a contextual bandit if
attribute-level BT proves too coarse. `ponytail:` ceiling noted in schema.

## Conditioning

Scores are stored per (attribute × context-cell), context-cell = surface type ×
goal class. "Prefers dense layouts on dashboards, airy on landing" is
representable; "user likes dark sites" is not a valid profile entry unless it
holds across cells.

## Confidence & decay

- each cell carries observation count; cells below threshold are marked
  `low_confidence` and generation falls back to corpus priors there
- exponential decay (configurable half-life) so taste can drift with the user
- consolidation is a weekly job; profile version bumps are auditable (41)

## Authority order (hard)

```
human decision  >  human pairwise  >  evaluator  >  award signal
```

No automated signal ever overrides an explicit human choice in the same context.
