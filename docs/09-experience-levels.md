# 09 — Experience Levels (K0–K5)

K-level is an **upper budget**, not a target. No section is required to use the
maximum allowed effect (`00` prime directive: less guessing, not more motion).
Surface type (`10`) gates eligibility; K-level gates intensity.

## Level definitions

| Level | Name | Allowed primitive classes | Interaction density | Scroll complexity | 3D allowance | GPU expectation |
|---|---|---|---|---|---|---|
| **K0** | Static | None (typography/layout only) | None | None | None | None |
| **K1** | Polish | Microinteraction, Feedback, Reveal (simple fade/slide) | Low — controls only | None or native | None | None |
| **K2** | Dynamic | + Typography (split/stagger), Scroll (reveal), LayoutMotion, Ambient (single, subtle) | Medium — sections respond | Reveal-on-scroll, no pins | None | Compositor-only (transform/opacity) |
| **K3** | Cinematic | + Scroll (pin/scrub), Pointer (magnetic/tilt), Transition (route), Particles (light, ≤P3) | High — hero + key sections choreographed | Pins, scrubs, ≤2 pinned sections | Projection-only (Canvas2D-style, S6 class) | One managed canvas OK |
| **K4** | Immersive | + Particles (P4 WebGL), Spatial (depth scenes), Ambient (layered) | High — environment reacts | Full scroll choreography | WebGL scenes | Dedicated GPU context, downgrade chain mandatory (`14`) |
| **K5** | Experimental | Anything incl. WebGPU, generative systems | Unbounded | Unbounded | Unbounded | Unbounded — research mode, explicit user opt-in |

## Per-level contracts

Each level specifies (task §12):

- **Performance expectations** (`15`): K0–K2 zero extra GPU contexts; K3 ≤1
  canvas ≤ P3; K4 budgeted P4 with measured FPS floor; K5 no budget, logged.
- **Mobile fallback** (`14`): K0–K1 identical; K2→K1 simplification;
  K3→K2 (drop pins/scrub→reveal); K4→K2 (drop GPU→CSS equivalent); K5→K3.
- **Accessibility behavior** (`16`): all levels honor reduced motion; K3+
  require pause controls or auto-pause on interaction absence; K4+ require
  visible alternative content paths.
- **Appropriate surfaces** (`10`):
  - K0–K1: all surfaces (default for Monitor/Operate/Configure).
  - K2: all surfaces with restraint; default ceiling for Configure.
  - K3: Decide/Learn, Explore; never Monitor/Operate/Configure core views.
  - K4–K5: Decide/Learn hero zones, Explore showcases; never operational UI.

## Budget semantics

1. **Ceiling, not quota.** A K3 page may contain K1 sections — and usually
   should (protagonist + quiet support, `03` P1).
2. **Simultaneity rule.** Budget applies to *simultaneously active* effects,
   not total effects on the page.
3. **Functional motion is exempt from expressive budget** but never from
   performance budget (`03` P2).
4. **Downgrade preserves intent.** Runtime capability detection may lower the
   *effective* level; the visual intention must survive (`14`).
5. **Level changes are plan-level decisions** recorded in the KineticJob and
   subject to approval (`04` stage 7).

## Relation to Aether levels

Aether level (visual language richness) × K-level (experience intensity) are
independent axes — A3+K1 and A1+K3 are both legal combinations. Contract: `19`.
