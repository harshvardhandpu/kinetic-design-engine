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
  result: WINNER_SELECTED | REJECT_ALL   # NONE_OF_THE_ABOVE is first-class
  winner: <variant id | none>
  runner_up: <variant id | null>
  rejected: [variant ids]
  relative_preference: {positive_candidates, ordered, strength}
  quality_floor: {passed, human_perceived_quality_gap}
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
3. **None of the above is first-class.** `REJECT_ALL` never promotes the least-bad
   candidate. Relative-positive candidates may be recorded as an unordered weak
   signal, but the absolute quality-floor rejection takes precedence.
4. **Reasons over ratings.** Tags + freeform are the durable content; numeric
   ratings are optional and low-weight (42).
5. **Context is mandatory.** A decision without surface/goal context cannot
   condition the profile and is quarantined for review.

## Negative knowledge link

Every `rejected` entry with reasons becomes a negative-knowledge record
(`docs/gym/43`): the Gym learns from losers as much as winners.

## Phase 2.5 human review import (`@0.2`)

The static workbench exports a complete decision; it never writes repository state. Import it with:

```bash
node engine/runner/run.mjs record-human-review --decision /path/to/taste-decision.json
```

The guarded command validates the `phase25` schema and case identity, then under the case lock:

1. accepts exactly the original candidates `V1` and `V2`, both already `REVIEW_READY`;
2. checks outcome consistency without deriving any unanswered field;
3. creates `gym/taste/decisions/<decision_id>.json` with create-exclusive semantics;
4. stores each candidate's human `quality_floor_passed` as `design_qualified` and its separate human learning value as `acceptable_for_further_taste_learning`;
5. advances only V1/V2 and the case review state to `HUMAN_REVIEWED`.

`WINNER_SELECTED` requires a matching V1/V2 relative preference and an explicit floor pass for that winner. `PARTIAL_ACCEPTANCE` requires at least one explicit floor or learning acceptance but forces no winner. `REJECT_ALL` requires all four candidate booleans to be false while preserving weak relative evidence.

A correction is a new immutable decision whose `supersedes` equals the case's current decision ID. It may replace the explicit human booleans while the original decision file and terminal `HUMAN_REVIEWED` history remain unchanged. The importer never writes `gym/taste/profile.json`; Phase 2.5 consolidation remains separately human-approved.
