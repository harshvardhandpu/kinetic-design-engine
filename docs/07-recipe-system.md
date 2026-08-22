# 07 — Recipe System

Primitives are too low-level for autonomous design decisions. Recipes are
**named experience compositions** — the unit Hermes selects when planning a
surface upgrade. Recipe = manifest + composition plan, installable via the same
registry mechanics (`06`).

## Recipe = primitives + choreography + policy

A recipe manifest (`schemas/recipe-manifest.schema.json`) declares:

| Field | Meaning |
|---|---|
| `purpose` | one sentence: what experience this creates |
| `surface_compatibility` | eligible surface types (`10`) — hard filter |
| `visual_posture` | calm / confident / cinematic / playful (knowledge-layer term) |
| `required_primitives[]` | pinned primitive ids + versions (registryDependencies) |
| `optional_primitives[]` | enhancements, each with its add-cost (perf class delta) |
| `timeline` | choreography description: entry sequence, stagger map, scroll binding |
| `interaction_model` | what the user can do (hover, drag, scroll-scrub, none) |
| `performance_class` | aggregate class (`15`) — must state the sum, not just parts |
| `mobile_fallback` | downgrade chain per primitive (`14`) |
| `reduced_motion_fallback` | composed end-state (`16`) |
| `stack_requirements` | adapters needed (`17`) |
| `token_overrides` | recipe-level motion token deltas (`08`) |

## Evidence-anchored recipe hypotheses (Phase-2 candidates)

| Recipe | Composition | Evidence |
|---|---|---|
| `kinetic-typography-hero` | split-characters + stagger-reveal (+ ambient gradient) | DIRECT: S5 mechanics measured |
| `swiss-pixel-transition` | pixel-reveal + mask-fade | DIRECT: S7 |
| `bento-deck-nav` | stack-deck + microinteraction hover | DIRECT: S4 |
| `particle-orbit-hero` | particle-sphere + pointer-gravity + split-text-reveal + cta-magnetic + scroll-depth-transition | PARTIAL: sphere DIRECT (S6); magnetic/depth `[ER]` unproven in corpus |
| `editorial-studio-landing` | marquee + split-text + custom-cursor + counter-awards | DIRECT: S8 (needs non-GSAP implementations, `02` §S8) |
| `interactive-gallery` | custom-cursor + hover-reveal + shared-element | PARTIAL: cursor DIRECT (S8); shared-element `[ER]` |

Task-listed recipes without corpus evidence (`luxury-scroll-story`,
`spatial-product-showcase`, `animated-saas-product-demo`, `interactive-pricing`)
are **deferred**: they may be added in Phase 2+ only with evidence or a
principle argument per `05` governance. `[ER]`

## Composition rules

1. **One protagonist.** Each recipe names ONE protagonist primitive; others are
   supporting (`03` P1). Timeline centers the protagonist's moment.
2. **Budget honesty.** Recipe performance class = worst-case simultaneous
   cost, computed from primitive classes + overlap; recipes may not understate.
3. **Fallback completeness.** A recipe is invalid if any required primitive
   lacks a mobile/reduced-motion fallback that composes into a coherent
   end-state (not just "effect off" — the static composition must still be
   designed).
4. **Surface gate.** Planner refuses recipe/surface mismatches regardless of
   user K-level (K-level is a budget, not permission — `09`).
5. **No clone recipes.** Recipes encode composition principles; demo content is
   neutral. `source_inspiration` records provenance (`03` P11).

## Recipe vs block vs component (registry types)

- **primitive** — behavior unit, no opinion about content (`05`).
- **component** — primitive(s) bound to a UI control (e.g. `magnetic-button`).
- **block** — section-level markup + styling + primitives (closest to
  sv-blocks-style inventory).
- **recipe** — the *plan* that composes the above for a surface; may install
  several blocks/primitives and a timeline. Recipes are what the planner
  selects; blocks are what recipes may instantiate.
