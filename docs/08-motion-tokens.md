# 08 — Motion Tokens

Design tokens for motion, so no generated code contains arbitrary animation
constants. Observed values from the corpus seed the default scale — every
default below is traceable to a measurement or marked inferred.

## Token namespaces

```
kinetic.duration.*     ms
kinetic.delay.*        ms
kinetic.stagger.*      ms per step
kinetic.easing.*       cubic-bezier / named curve
kinetic.distance.*     px / %  (travel distances)
kinetic.scale.*        unitless
kinetic.rotate.*       deg
kinetic.blur.*         px
kinetic.spring.*       { mass, stiffness, damping } (or velocity/friction form)
kinetic.intensity.*    0..1 multiplier for expressive amplitude
kinetic.depth.*        z / parallax factors
```

## Default scale (seeded from evidence)

| Token | Default | Origin |
|---|---|---|
| `duration.fast` | 150ms | `[EI]` microinteraction norm (ui-ux-pro-max K1: 150–300ms micro-interactions) |
| `duration.normal` | 300ms | `[EI]` K1 norm upper bound |
| `duration.slow` | 450ms | `[SD: S4]` card deck transition measured 0.45s |
| `duration.cinematic` | 1200ms | `[SD: S5]` hero letter reveal measured 1.2s |
| `stagger.tight` | 30ms | `[EI]` word-level stagger norm |
| `stagger.normal` | 60ms | `[EI]` |
| `stagger.wide` | 120ms | `[SD: S5]` per-letter stagger measured 120ms |
| `easing.out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | `[SD: S5]` exact curve measured |
| `easing.out-quint` | cubic-bezier(0.22, 1, 0.36, 1) | `[EI]` common premium curve; unmeasured in corpus |
| `easing.snap` | cubic-bezier(0.2, 0, 0, 1) | `[SD: S9 first-render]` measured on fancy-toggle transform |
| `easing.standard` | cubic-bezier(0.4, 0, 0.2, 1) | `[EI]` material-style default |
| `distance.reveal-y` | 24px | `[EI]` typical translateY reveal; S5 end-state 0px, start offset not captured post-animation |
| `spring.tactile` | { mass: 1, stiffness: 300, damping: 24 } | `[EI]` placeholder — Phase 2 must measure, not ship guesses |

`[ER]` Rule: any value not in the token table must be added to the table
(with evidence tag) before use. The evaluator flags raw numeric
durations/easings in experience-layer code (`13` check `token-discipline`).

## Semantic presets

Combinations, not new values:

| Preset | Composition | Use |
|---|---|---|
| `enter.standard` | duration.normal + easing.out-expo + distance.reveal-y | default entrance |
| `exit.standard` | duration.fast + easing.standard | exits faster than enters (`[EI]` K1 guidance: exit-faster-than-enter) |
| `enter.luxury` | duration.cinematic + easing.out-expo + stagger.wide | hero choreography (S5 profile) |
| `micro.snappy` | duration.fast + easing.snap | control feedback (S9 profile) |
| `micro.elastic` | spring.tactile | tactile playfulness |
| `ambient.slow` | duration.cinematic ×4 loop + intensity.low | decorative loops, lowest priority |

## Emission

- CSS custom properties (`--kinetic-duration-normal`, …) for CSS/WAAPI paths;
- typed token object exported per framework adapter (`17`) for JS paths;
- installer maps primitive token references → project values (`06` step 4).
- `[SD: ui-ux-pro-max --density dial]` spacing/density overrides show the
  pattern: tokens are the only sanctioned override surface — KINETIC follows it
  for motion.

## Governance

- Token additions require evidence tag (`[SD]` measurement or `[EI]` argument).
- Recipes may override tokens only within their declared K-level envelope (`09`).
- Reduced-motion overrides are token-level too: `kinetic.rm.*` collapse
  durations to 0/1ms and disable stagger, preserving end-states (`16`).
