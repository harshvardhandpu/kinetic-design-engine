# 30 — Continuous Learning Vision

Phase 1 built the **application loop** (inspect → plan → implement → verify) for one
project at a time. Phase 1.5 specifies the **learning loop**: a permanent Design Gym
that makes every future application-loop run better than the last.

## Thesis

Design quality for an agent is not a model property; it is a **context property**.
A weaker model with the right DesignCase, the right negative examples, the right
taste decisions, and the right recipe in context outperforms a stronger model
guessing cold. Therefore KINETIC's long-term value lives in its accumulated,
retrievable, evidence-tagged design knowledge — not in any single generation.

> Cross-reference: this is the LEARN stage of the Phase-1 loop
> (`docs/04-hermes-closed-loop.md`) made permanent and systematic.

## The two loops

```
APPLICATION LOOP (Phase 1)          LEARNING LOOP (Phase 1.5)
one project, one transformation     corpus, curriculum, variants, taste
        ▲                                     │
        │   promoted recipes, primitives,     │
        │   taste profile, negative knowledge │
        └─────────────────────────────────────┘
```

The learning loop feeds the application loop only through the **promotion gate**
(`docs/gym/53-promotion-gate.md`). Nothing experimental touches the stable core
directly.

## Scope of this phase

SPECIFICATION + ARCHITECTURE ONLY. This phase produces:

- the Design Gym architecture and its subsystems
- the award-corpus access policy (validated against real sources, `docs/gym/32-award-corpus.md`)
- the ten-variant protocol, fidelity policy, experiment protocol
- taste memory, pairwise ranking, negative knowledge
- job/resumability/resource/retention contracts
- 10 new schemas (`schemas/gym/`)
- a revised Phase-2 roadmap proving BOTH loops at small scale

Explicitly NOT in this phase: corpus generation, scheduled job activation,
deployments, large-scale builds, any review UI implementation.

## Capacity target

The architecture must support — without redesign — the future steady state of
10 references/day × up to 10 candidates = 100 candidate builds/day
(`docs/gym/51-resource-budget.md`), starting from a 3-reference proof
(`docs/gym/55-phase-2-revised-roadmap.md`).

## North-star metric

> Increase the probability that the user picks Hermes' design as the winner
> on the FIRST generation. (`first_shot_preference_rate`, `docs/gym/54-metrics.md`)

Everything in the Gym exists to move that number. Volume of builds is not a goal.
