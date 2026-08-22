# 12 — Motion Inspector

Spec-only in Phase 1 (task §17). Normal annotation (`11`) captures static
state; motion debugging needs time-domain data. The motion inspector is a
subsystem of the dev inspector, specialized for KINETIC primitives.

## What it must identify (per animation instance)

| Field | Source of truth |
|---|---|
| animation name | primitive instance id (from manifest + receipt) |
| trigger | viewport-enter / hover / click / scroll-progress / mount / manual |
| duration, delay, easing | token-resolved values (not raw — show BOTH token name and resolved ms/curve, `08`) |
| spring properties | mass/stiffness/damping when spring-driven |
| timeline progress | 0..1 current, with scrub handle |
| scroll trigger | start/end positions, scrub mapping, pin state |
| affected properties | transform/opacity/clip-path/custom |
| current primitive | `data-kinetic-primitive` (`11` identifiers) |
| recipe membership | `data-kinetic-recipe` |
| implementation rung | css / waapi / framework-motion / gsap / canvas / webgl (`23`) |

## Controls

pause · resume · restart · **scrub** (drag timeline) · slow motion (0.1×/0.25×)
· reduced-motion preview (force `kinetic.rm.*` tokens, `08`/`16`) ·
breakpoint switching (reuses evaluator viewport presets, `13`).

`[SD: agentation]` animation-pause already exists as an inspector feature —
KINETIC generalizes it from global pause to per-instance time control.
`[SD: sv-agentation pauseAnimations prop]` confirms pause is a first-class
inspector concern in the reference implementation.

## Instrumentation contract

For the inspector to report, every KINETIC primitive must expose a minimal
**motion handle** in dev mode:

```ts
interface KineticMotionHandle {
  id: string;                    // instance id
  primitive: string;             // manifest id
  recipe?: string;
  trigger: TriggerKind;
  tokens: Record<string, string>;   // token names used
  progress(): number;
  pause(): void; resume(): void; restart(): void;
  seek(t: number): void;         // required for scrub
  state(): MotionStateSnapshot;  // resolved values for the table above
}
```

`[ER]` Adapters (`17`) implement the handle per rung: CSS/WAAPI →
Animation.currentTime; GSAP → tween.progress(); canvas/WebGL → the primitive's
own clock. Primitives that cannot expose `seek()` declare
`scrubbable: false` in their manifest and the inspector degrades to
pause/restart for them.

## Output

Motion inspection results attach to `VisualFeedback` records:
`visual_state.animation_progress` + a `motion` context block (the table above).
Feedback category `motion` routes repair through token changes first (`08`),
code changes second.

## Phase-2 minimal version

pause/resume/restart + progress readout + token-resolved values for the 5–8
proof primitives. Scrub/slow-motion/breakpoint-switch are v1 targets.
