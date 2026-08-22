# 35 — Ten-Variant Protocol

For every studied reference, the Gym may produce up to ten candidates:

```
V0  fidelity study          (internal benchmark, never deployed)
V1–V7  original directions  (must each clear the quality floor on their own merit)
V8–V9  experimental         (hypothesis-driven, `experimental: true`)
```

Schema: `schemas/gym/variant-run.schema.json` (one VariantRun per candidate).

## V0 — fidelity study (`docs/gym/36`)

Purpose: prove KINETIC understood the reference. Reconstruct the design/interaction
CONCEPT with placeholder assets. Scored against the reference by the evaluator +
human. `deployable: false`, always.

## V1–V7 — original directions

Each must differ along at least one MAJOR dimension, declared up front in the
variant brief:

```
art direction | layout grammar | typography system | narrative structure |
interaction model | motion choreography | navigation grammar | depth/spatial |
media treatment | information hierarchy | responsive strategy
```

**Forbidden non-variation** (auto-reject at review-prep):
- same layout + different palette
- same template + different font
- same hero + rearranged cards

A diversity check compares variant briefs pairwise; if two briefs share all major
dimensions, the second is regenerated with a forced dimension change.

### Quality floor applies to EVERY variant

A variant that is generic, broken, weak, visually average, surface-inappropriate,
or static-when-the-concept-requires-experience is:

```
REJECTED → diagnosed (which gate failed + why) → REGENERATED (max N attempts,
configurable, default 2) → still failing → slot stays EMPTY
```

**Seven qualified variants beat ten with filler.** An empty slot with a recorded
diagnosis is a valid, honest outcome — it is itself negative knowledge (43).

## V8–V9 — experimental slots (`docs/gym/37`)

Reserved for hypothesis-driven experiments. Still must pass the TECHNICAL /
RESPONSIVE / A11Y / PERFORMANCE gates (an experiment that breaks the page teaches
nothing about design); the DESIGN gate is scored but does not block, because the
point is to explore beyond current taste.

## Variant brief (input to generation)

Each candidate gets a machine-readable brief:

```yaml
case_id:
slot: V0|V1..V9
mode: fidelity-study | original | experimental
surface: <from case>
k_level: <ceiling from case estimate, may be lowered per variant>
direction: <one paragraph, distinct per slot>
varied_dimensions: [...]
constraints: <tokens from case, protected behaviors>
negative_context: <relevant negative-knowledge entries to avoid>
taste_context: <relevant TasteProfile preferences for this surface>
```

The brief is the model-agnostic lever (`docs/gym/48`): a weaker model gets a
tighter brief with more retrieved context, not a vaguer one.

## States

```
BRIEFED → GENERATING → BUILT → TECHNICAL_PASS/FAIL → RESPONSIVE_PASS/FAIL
→ A11Y_PASS/FAIL → PERFORMANCE_PASS/FAIL → DESIGN_EVALUATED
→ QUALIFIED | REJECTED(diagnosis, attempt n) | EMPTY(after retries)
```

All states durable on the VariantRun record; generation is resumable per-slot,
never all-or-nothing (`docs/gym/50`).

## Additive Phase-2.5 lifecycle

Phase 2.5 does not migrate or reinterpret the Phase-2 sequence above. It is selected
explicitly with `init-case --run-version phase2.5`, creates V0 only, and stores
`case-run@0.2` with `variant-run@0.2` slot records.

```text
PLANNED → BRIEF_VALIDATED → RETRIEVAL_PROVEN → PREBUILD_APPROVED → BUILDING
→ BUILT → TECHNICAL_EVALUATED → VISUAL_CAPTURED → DESIGN_EVALUATED
→ REVIEW_READY → HUMAN_REVIEWED
```

Transitions are adjacent and guarded. `HUMAN_REVIEWED`, `REJECTED_FINAL`, and
`CANCELLED` are terminal. `BLOCKED` is a condition on the current state, not a
replacement state. The legacy `record --state` command refuses Phase-2.5 records;
Phase-2 commands and files remain unchanged.

Lifecycle progress never infers merit. Every Phase-2.5 slot stores these separately:

```text
technically_qualified: boolean
design_qualified: boolean | null
acceptable_for_further_taste_learning: boolean | null
```

V0 remains `deployable:false`, `original_work:false`, and outside design/taste
qualification. Filesystem writes and lock takeover follow the atomic project-local
rules in `docs/gym/50-resumability.md`.
