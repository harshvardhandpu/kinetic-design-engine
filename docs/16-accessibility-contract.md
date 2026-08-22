# 16 — Accessibility Contract

Reduced motion is a **first-class variant, not a patch** (`03` P8). Every
primitive manifest must eventually declare all fields below; a primitive
without them cannot pass the publish gate (`06` governance).

## Per-primitive declarations

| Field | Contract |
|---|---|
| `reducedMotionVariant` | Required. One of: `static-end-state` (content shown, effect absent — default), `simplified` (single fade replaces choreography), `unchanged` (justified: e.g. progress indicator under 1s). Must be *designed*, i.e. the static composition is intentional, not a broken mid-state. |
| `keyboardBehavior` | Every interactive primitive reachable + operable by keyboard; deck/card stacks need arrow-key navigation or equivalent; no pointer-only affordances without alternatives. |
| `focusBehavior` | Visible focus ring preserved through all transforms; focus never trapped by animation; focus order = DOM order (no z-index/transform reordering of tab order). |
| `screenReaderImpact` | Animated decorative nodes `aria-hidden`; split text must expose the whole string to AT (spans are presentation, text content intact — S5's 19 spans keep text readable `[SD]`); live regions for state-change feedback only. |
| `contrastImpact` | Primitive may not reduce text contrast below 4.5:1 body / 3:1 large at any animation frame (incl. mid-fade — opacity floors for text-bearing elements). |
| `motionSensitivity` | Classify: none / mild / vestibular-trigger (large field motion, parallax, zoom). Vestibular-trigger class → disabled under reduced motion unconditionally, plus auto-disable option. |
| `flashingRisk` | No content flashes > 3×/second; strobe patterns (sv-matrix-class loaders) must declare rate and are capped. |
| `touchAlternative` | Hover-driven effects provide tap/press equivalents on coarse pointers (`14`). |

## System-level rules

1. `prefers-reduced-motion` is authoritative and token-level (`kinetic.rm.*`,
   `08`): durations → 0/1ms, stagger off, loops static. No primitive may bypass
   the tokens.
2. Inspector offers reduced-motion preview (`12`); evaluator verifies the
   variant in a forced-reduced-motion run (`13`).
3. Pause control: any autoplaying expressive/decorative animation on screen
   longer than ~5s must be pausable (K3+ requirement, `09`).
4. Keyboard: evaluator tab-sweep must reach every kinetic interactive element;
   focus visibility checked at rest AND mid-animation.
5. `[SD: $10K prompt]` JS failure must not blank content — a11y and resilience
   share the same rule (`03` P7): initial content visible without JS.

## Evidence notes

- `[SD: S4]` deck uses `role="list"` + `tabindex="0"` + aria-label — semantic
  structure survives the effect: the reference pattern to require.
- `[SD: S6]` sphere stage uses `role="application"` + aria-label + canvases
  `aria-hidden` — canvas content needs a text alternative; KINETIC requires
  `aria-label` describing the visual for decorative canvases.
- `[SD: S5]` per-character spans preserve text content for AT — split-text
  primitives must keep this property (no per-char `aria-label` noise).
- `[EI]` The corpus sites are marketing demos with minimal a11y demands;
  operational surfaces (Monitor/Operate) hold KINETIC to the stricter K1/a11y
  defaults regardless of reference behavior.
