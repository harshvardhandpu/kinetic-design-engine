# 05 — Primitive Taxonomy

Primitive = smallest installable unit of experience behavior with a manifest
(`06`), a token contract (`08`), and an accessibility declaration (`16`).

## Method

The task listed 14 candidate families and ~30 example primitives as
**hypotheses**. This document keeps what evidence supports, flags what is
unproven, and drops/renames what doesn't survive contact with the sources
(`02`). Retention rule: a family stays only if (a) ≥1 observed source instance
or (b) a clear agent-operability need exists. Bad abstractions are not kept out
of politeness to the brief.

## Families (12 retained)

| Family | Definition | Evidence anchor |
|---|---|---|
| **Reveal** | Make content appear with choreography | S7 PixelReveal (DOM grid + masks), S5 hero reveal |
| **Typography** | Text as animated material (split, scramble, mask, kinetic) | S5 SplitCharacters, S8 SplitText/ScrambleText |
| **Scroll** | Scroll-linked behavior (reveal, pin, scrub, parallax) | S8 ScrollTrigger loaded; S6 "Scroll & Drag" |
| **Pointer** | Pointer-driven response (magnetic, follow, tilt, proximity) | S6 drag interaction; S8 custom cursor |
| **Microinteraction** | State-change feedback on controls (toggle, morph, fill) | S9 toggle cluster (partial), S4 card hover |
| **Transition** | Between-state/route movement (shared element, curtain, depth) | `[EI]` no direct source instance in corpus — kept for agent need |
| **Spatial** | Depth/3D arrangement (deck stacking, parallax depth, 3D scenes) | S4 deck z-cascade, S6 sphere projection |
| **Particles** | Point/cloud systems (sphere, field, ambient) | S6 Canvas2D sphere (confirmed 2D context) |
| **Ambient** | Non-essential background life (marquee, gradient drift, noise) | S8 marquees (hero + arc) |
| **Navigation** | Nav-specific motion (magnetic nav, menu choreography) | S8 nav + cursor interplay; `[EI]` thin evidence |
| **LayoutMotion** | Container-level reflow choreography (deck, stack, FLIP) | S4 deck reorder transition |
| **Feedback** | System response visuals (loading, success, alert states) | E5 sv-matrix 50+ loaders; S9 risk-alert cards |

### Dropped / merged from the task's candidate list

- `Physics` (standalone family) → **merged into Microinteraction/Spatial as an
  implementation trait** (spring config), not a family. `[EI]` No source showed
  a physics-only effect; springs are a parameter, not a category.
- `Media` → **merged into Reveal/Ambient** (image treatment is reveal or
  ambience depending on function). `[EI]` Kept as a tag, not a family.
- `3D` as family → renamed **Spatial**; true WebGL 3D is an implementation
  ladder inside Spatial/Particles (`23`), not a taxonomy axis. `[SD: S6 proved
  "3D-looking" ≠ WebGL].

## Primitive naming and variant system

`[SD: sv-matrix numbered families]` Each primitive has a stable id and numbered
variants when the same capability has distinct implementations:

```
pixel-reveal            (contract)
├── pixel-reveal-dom    (variant: CSS-grid cells, P2)
└── pixel-reveal-canvas (variant: canvas for large areas, P3)
```

Ids must be semantically true (`03` P16; sv-particles counter-example).

## Hypothesis primitives carried into Phase 2 (with evidence grade)

| Primitive | Family | Evidence | Notes |
|---|---|---|---|
| `split-characters` | Typography | DIRECT (S5) | 1.2s expo-out, 120ms stagger observed; tokenize both |
| `pixel-reveal` | Reveal | DIRECT (S7) | 25×14 grid, scale(0→1), pattern = data |
| `stack-deck` | LayoutMotion | DIRECT (S4) | transform-only, offset cascade, semantic list |
| `particle-sphere` | Particles | DIRECT (S6) | Canvas2D confirmed; WebGL only as ladder rung |
| `marquee` | Ambient | DIRECT (S8) | CSS/WAAPI first; GSAP optional |
| `split-text` (words/lines) | Typography | DIRECT (S8) | non-GSAP implementation needed (licensing) |
| `scramble-text` | Typography | DIRECT (S8 plugin present) | implement from principle; plugin is paid |
| `custom-cursor` | Pointer | DIRECT (S8) | functional only on Explore surfaces |
| `toggle-morph` | Microinteraction | PARTIAL (S9, G3) | design from principle; re-inspect in Phase 2 |
| `magnetic` | Pointer | NONE in corpus | `[ER]` keep as hypothesis; common pattern, unproven here |
| `shared-element-transition` | Transition | NONE in corpus | `[ER]` framework-native APIs first (View Transitions) |

## Per-primitive required metadata (→ manifest, doc `06`)

family, capability description, inputs (typed), variants, implementation
ladder, performance class (`15`), motion intensity, surface eligibility (`10`),
K-level eligibility (`09`), token dependencies (`08`), reduced-motion variant
(`16`), no-JS state (`03` P7), verification hooks, source inspiration
provenance.

## Taxonomy governance

`[ER]` New primitives enter via registry PR with: evidence link or principle
argument, one reference implementation, reduced-motion variant, and a passing
evaluator run on its demo. The taxonomy itself changes only with a doc update
here — ids are stable contracts once published.
