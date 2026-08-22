# 04 — Hermes Closed-Loop Architecture

The central thesis of KINETIC. This document specifies every stage and every
boundary of the loop so Phase 2 can prove it experimentally.

```
USER → HERMES
        ├─ 1 SCAN repository            → ProjectDesignProfile
        ├─ 2 CLASSIFY surfaces          → surface map
        ├─ 3 READ design system         → token map
        ├─ 4 QUERY knowledge            → design posture, anti-patterns
        ├─ 5 QUERY registry             → eligible primitives/recipes
        ├─ 6 SELECT K-level + options   → 3 directions (CONSERVATIVE/STRONG-FIT/DIVERGENT)
        ├─ 7 USER APPROVAL gate         → chosen direction
        ▼
      IMPLEMENTATION
        ├─ 8 install/copy primitives    → project-owned source
        ├─ 9 adapt tokens               → local design tokens
        ├─ 10 compose recipe            → page/section wiring
        └─ 11 preserve product core     → protected-area diff check
        ▼
      RUN PROJECT (dev server)
        ▼
      VISUAL INSPECTION
        ├─ 12 screenshots / responsive checks
        ├─ 13 human annotation (inspector) and/or automated evaluator
        └─ 14 motion inspection + performance data
        ▼
      STRUCTURED FEEDBACK (VisualFeedback[])
        ▼
      SOURCE RESOLUTION (feedback → file:range)
        ▼
      HERMES PATCH (minimal diff, experience layer only)
        ▼
      RE-RENDER → QUALITY GATES
        ▼
      ACCEPT / ITERATE (loop back to 12, bounded)
        ▼
      OPTIONALLY CAPTURE VERIFIED LEARNING (knowledge/registry promotion)
```

## Stage contracts

### Stage 1–3 — Understand (Design Intelligence, doc `10`)

- **Input:** repo path, optional route focus.
- **Output:** `ProjectDesignProfile` (schema `schemas/project-design-profile.schema.json`):
  framework, routing, component architecture, CSS strategy, Tailwind config,
  design tokens, fonts, spacing, colors, radii, shadows, existing animations,
  dependencies, reusable components, page hierarchy, **surface classification
  per route**, interactive states, responsive behavior, a11y patterns, and the
  three-zone map: `product_core[]` / `design_system[]` / `experience_layer[]`.
- **Boundary:** read-only. No writes. Scanner must be safe on any repo.
- **Failure mode:** unknown stack → profile with `confidence: low` + explicit
  gaps; planner then asks, never guesses.

### Stage 4–5 — Query knowledge, then registry (docs `03`, `06`, `07`)

- Knowledge answers **WHAT is appropriate** (surface → posture, principles,
  anti-patterns, reference principles from `knowledge/sources`).
- Registry answers **HOW to implement** (eligible items filtered by:
  `supported_frameworks ∋ target stack`, `surface_types ∋ surface`,
  `kinetic_levels ≤ budget`, `performance_class ≤ budget`, dependency
  conflicts empty against project deps).
- **Boundary:** both queries are pure functions over local data. Order matters:
  knowledge first so registry filtering has a posture to serve.

### Stage 6 — Plan + options (doc `09`, `20`)

- Planner emits a `KineticJob` (schema `schemas/kinetic-job.schema.json`) plus,
  for meaningful redesigns, **three directions** that differ in composition or
  interaction philosophy — never three recolors (`[ER]` enforced by requiring
  each option to vary at least one of: recipe set, motion class mix, layout
  device, interaction model).
- Each option lists: primitives/recipes to install, K-level, token deltas,
  performance budget, reduced-motion plan, protected areas, risk notes.

### Stage 7 — Approval gate

`[ER]` Mandatory human approval before implementation for: K-level changes,
new dependencies, any file outside experience layer, recipe install touching
> N files (N configurable, default 8). Trivial token tweaks may be
auto-approved if the job's `approval_mode: permissive`.

### Stage 8–11 — Implement (docs `06`, `17`, `18`)

- Install = copy source via registry manifest (`install_files`,
  `install_strategy`), apply `cssVars`/token mapping, install npm deps only if
  declared and approved.
- Token adaptation: primitive sources reference **semantic motion/color tokens**;
  installer rewrites them to project tokens (or adds a thin `kinetic.tokens`
  file) — never hardcode constants (`08`).
- **Product-core diff check:** computed diff must not touch `product_core[]`
  paths from the profile. If a design change *requires* behavior change, it is
  re-classified as a product decision and escalated (Stage 7 again), never
  silently applied.

### Stage 12–14 — Render + inspect (docs `11`, `12`, `15`)

- Dev server run by Hermes; inspector available in dev mode only.
- Two feedback producers, one schema:
  - **Human** via inspector (annotation → `VisualFeedback`).
  - **Automated evaluator** (`13`) → `EvaluationResult` which converts 1:1 into
    `VisualFeedback` items with `producer: evaluator`.
- Motion inspector adds motion-state fields (trigger, progress, easing) to the
  same feedback records.

### Source resolution (doc `11` §Resolution)

- `VisualFeedback.target` carries selector + optional `kinetic_id` +
  component hint. Resolver order:
  1. `data-kinetic-id` → manifest `install_files` → exact file (+range if the
     primitive records symbol anchors).
  2. Component/framework devtools mapping (React component name, Svelte
     component via source maps / `data-` hints).
  3. Selector → grep/AST search in experience-layer files.
- **Output:** file path + line range + confidence. Confidence < threshold →
  Hermes asks or narrows with a second probe; never patches on a guess.

### Patch → re-render → quality gates (docs `13`, `18`)

- Patch is the minimal diff addressing the feedback item(s); experience layer
  only; motion changes go through tokens where possible.
- **Quality gates** (all must pass to exit the loop):
  1. Regression contract (`18` §regression): navigation, forms, buttons, auth
     surfaces, API-connected UI, responsive layouts, keyboard nav, app state.
  2. Evaluator re-run: no new errors; targeted checks for the fixed items.
  3. Console clean, no horizontal overflow at the three reference viewports.
  4. Performance budget not exceeded (`15`).
  5. Reduced-motion variant still intact (`16`).
- **Iteration bound:** max N repair cycles per feedback item (default 3); after
  that, escalate to human with full evidence trail.

### Accept / iterate / learn (doc `21`)

- Accepted run → run report (job, diffs, feedback, gate results, iteration log).
- Learning capture is **opt-in and gated**: only patterns that passed quality
  gates (and, where configured, human acceptance) may be promoted to
  knowledge notes or registry improvements. Nothing auto-canonical.

## Boundary summary (what crosses each seam)

| Seam | Artifact | Schema |
|---|---|---|
| Scan → Plan | ProjectDesignProfile | project-design-profile.schema.json |
| Plan → Approval | KineticJob + 3 options | kinetic-job.schema.json |
| Install → Run | installed files + token map + manifest receipt | registry manifest |
| Run → Inspect | live URL + dev-mode inspector | — |
| Inspect → Resolve | VisualFeedback[] | visual-feedback.schema.json |
| Resolve → Patch | file:range + confidence | inside feedback record |
| Patch → Gates | diff + re-render | EvaluationResult |
| Gates → Learn | run report | evaluation-result.schema.json |

## Loop invariants

1. Every stage produces a machine-readable artifact (no stage may communicate
   only via prose).
2. No writes before Stage 8; no product-core writes ever without re-approval.
3. Every repair is traceable: feedback id → patch hunk → gate result.
4. The loop is **bounded** (iteration caps, approval gates) — human stays in
   control.
5. `[ER]` Hermes should need less guessing after every iteration: each artifact
   is designed to raise the next stage's context quality.
