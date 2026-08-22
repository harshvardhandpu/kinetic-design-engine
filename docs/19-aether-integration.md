# 19 — Aether Integration

Aether and KINETIC are **separate projects** with a token-level contract.
Aether repo: `/home/harshdev/HermesWorkspaces/aether-site` (Vite + React).
No Aether level specification was found inside that repo during Phase 1
(inspection: METADATA-ONLY — file tree + package.json), so Aether-side
definitions below follow the task's conceptual split and must be confirmed
with the Aether project owner. `[EI]`

## Division of ownership

| Concern | Owner |
|---|---|
| Visual language: layout, typography, brand, color, composition, components | **AETHER** |
| Runtime experience: motion, interaction, feedback, scroll, spatial, transitions | **KINETIC** |

Combined expression: e.g. `Aether Level 3 + KINETIC K3` — independent axes
(`09` §relation). Aether level governs visual richness; K-level governs
experience intensity. Neither implies the other.

## Token interaction rules

1. **KINETIC consumes Aether's visual tokens, never redefines them.** Colors,
   fonts, spacing, radii from Aether are inputs to KINETIC primitives (scanner
   reads them, `10`; installer maps them, `06` step 4).
2. **KINETIC owns motion tokens exclusively** (`08`). Aether must not define
   durations/easings; if an Aether design calls for motion, it references
   `kinetic.*` tokens.
3. **Conflict resolution:** visual property → Aether wins; temporal property →
   KINETIC wins; a property that is both (e.g. transition *of a color*) →
   KINETIC owns timing, Aether owns the color values.
4. **No cross-imports of internals.** Integration surface = token files +
   component slots. A KINETIC primitive inside an Aether component receives
   Aether visual tokens via props/CSS vars and emits kinetic ids (`11`).

## Joint workflow

When both operate on one site: Aether decisions come first in the plan
(composition, palette, type), KINETIC plans experience on top of the fixed
visual frame. The KineticJob (`04`) records the Aether level as context so the
evaluator (`13`) judges motion against the visual language actually present —
e.g. a maximalist A3 frame tolerates more expressive motion than a sparse A1
frame before `excessive-animation` fires. `[ER]`

## Boundaries

- KINETIC never modifies Aether's component internals; it wraps or slots.
- Aether site remains a separate repo/workspace; KINETIC work never writes
  into it except through an explicit KineticJob targeting it (Phase-2
  playground may use a *copy* of an Aether-style page, not the live project).
