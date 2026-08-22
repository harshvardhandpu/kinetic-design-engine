# 14 — Adaptive Experience Scaling

Runtime capability detection + downgrade chains, so visual intention survives
weaker devices. K-level sets the ceiling (`09`); this doc governs what happens
when the device can't afford the ceiling.

## Capability detection inputs

| Signal | API / means | Reliability |
|---|---|---|
| viewport size / DPR | matchMedia, resize | high |
| pointer type (coarse/fine) | `pointer: coarse` media query | high |
| `prefers-reduced-motion` | matchMedia | high — authoritative (`16`) |
| `prefers-contrast`, `prefers-color-scheme` | matchMedia | high |
| WebGL availability + tier | context probe + renderer string | medium |
| WebGPU availability | `navigator.gpu` probe | high (presence only) |
| CPU cores / memory | `navigator.hardwareConcurrency`, `deviceMemory` | coarse proxies |
| Battery | Battery Status API (where granted) | low availability — optional input only |
| Frame rate | rAF sampling over first seconds | measured, high |
| Visibility | `document.visibilityState`, IntersectionObserver | high |
| Save-Data | `navigator.connection.saveData` | high where present |

`[SD: S6 evidence]` capability ≠ appearance: the "3D" sphere ran Canvas 2D —
detection must probe real capabilities, and downgrades must be designed, not
assumed.

## Downgrade chains

Every primitive manifest declares its ladder (`06` `implementation_ladder`);
recipes compose them. Canonical chain (task §22 example):

```
K4 WebGL particle environment
  → simplified WebGL (fewer particles, no post-effects)
  → Canvas2D equivalent (S6-class projection, `02` §S6)
  → static composition (designed end-state, not a blank canvas)
```

Rules:

1. **Intention survives.** Each rung preserves the composition's meaning
   (sphere still reads as sphere; reveal still ends at full content). The last
   rung is always a *designed static state* (`03` P7, P8).
2. **Downgrade is one-way per session** (no flapping between rungs); re-evaluate
   on navigation only.
3. **Functional motion never downgrades to absent** — it downgrades to simpler
   (instant or 1-frame state change), never to missing feedback.
4. **Decorative motion is first to drop** (`03` P2 budget priority).
5. **Effective level is reported.** Inspector/evaluator show the rung actually
   in use; feedback records carry it (`11` `visual_state`).

## Decision table (default policy)

| Condition | Action |
|---|---|
| `prefers-reduced-motion: reduce` | `kinetic.rm.*` tokens; static end-states; functional motion → minimal (`16`) |
| coarse pointer + small viewport | drop hover-only interactions → tap/press equivalents; particles → density ÷ 4 or static |
| saveData or low memory (<4GB class) | decorative ambient off; media-heavy rungs skipped |
| no WebGL | WebGL rungs skipped; canvas/CSS rung selected |
| measured FPS < 45 for > 2s | step down one rung; log event for the run report |
| hidden tab / off-screen | all KINETIC animations paused (rAF + IntersectionObserver gating) |

## Phase-2 scope

Implement detection for: viewport, pointer, reduced-motion, WebGL presence,
FPS sampling. One demonstrated downgrade chain on the showcase recipe
(particle or pixel-reveal). Full table = v1.
