# 41 — Taste Memory

Human choice is a first-class learning signal. Two artifacts:

- **TasteDecision** (`schemas/gym/taste-decision.schema.json`) — one immutable
  record per human judgment event. Append-only log under `gym/taste/decisions/`.
- **TasteProfile** (`schemas/gym/taste-profile.schema.json`) — versioned,
  consolidated model of preferences, rebuilt from decisions by the weekly
  TasteConsolidationJob. `gym/taste/profile.json` = current version; history kept.

## TasteDecision captures

```yaml
context: {case_id, surface, industry, goal, k_level, batch_id}
candidates: [variant ids shown]
outcome:
  winner: <variant id | none>
  runner_up: <variant id | null>
  rejected: [variant ids]
pairwise: [{preferred, over, reasons[]}]     # optional fine-grained pairs
reason_tags: [hierarchy, typography, motion-purpose, originality, density,
              color, spacing, interaction, accessibility, performance, other]
freeform: <human's own words, verbatim>
first_shot: true|false    # was the winner from the FIRST generation round?
reviewer: user            # (future: multiple reviewers, weighted)
timestamp:
```

`first_shot` feeds the north-star metric directly (`docs/gym/54`).

## Rules

1. **Never edit a decision.** Corrections are new decisions referencing the old.
2. **No decision is required.** A skipped review is recorded as
   `outcome.winner: none` with reason `not_reviewed` — absence of signal is
   data too (prevents silent survivorship bias).
3. **Reasons over ratings.** Tags + freeform are the durable content; numeric
   ratings are optional and low-weight (42).
4. **Context is mandatory.** A decision without surface/goal context cannot
   condition the profile and is quarantined for review.

## Negative knowledge link

Every `rejected` entry with reasons becomes a negative-knowledge record
(`docs/gym/43`): the Gym learns from losers as much as winners.
