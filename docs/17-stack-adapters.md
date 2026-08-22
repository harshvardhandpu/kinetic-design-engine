# 17 — Stack Adapters

KINETIC never forces a framework. Adapters are the boundary between
stack-neutral contracts (manifests, tokens, motion handles, feedback) and
concrete projects. `[SD: shadcn registry]` "works with any project type and any
framework" — proven model. `[SD: agentation (React) vs sv-agentation (Svelte)]`
same concept ports across frameworks — the payload contract is the stable part.

## Non-negotiables

- Do not rewrite a Svelte project into React, or vice versa (task §25).
- Scanner (`10`) detects the stack; planner only selects items whose
  `supported_frameworks` include it.
- No KINETIC runtime package: adapters are thin glue + conventions, installed
  as source too.

## Adapter responsibilities (per stack)

| Responsibility | Contract served |
|---|---|
| File placement conventions (where primitives/components live) | registry install (`06` step 3) |
| Token emission (CSS vars + typed object) | `08` |
| `data-kinetic-*` emission + prod strip | `11` identifiers |
| Motion handle implementation per rung | `12` instrumentation |
| Inspector mount (dev-only) | `11` distribution |
| Framework component → source mapping for resolution | `11` resolution ladder rung 2 |
| SSR/hydration safety (no-JS state, initial states from JS) | `03` P7 |

## Adapter matrix (Phase-1 spec)

| Stack | Priority | Notes |
|---|---|---|
| **Svelte / SvelteKit** | Phase-2 candidate | Strongest ecosystem alignment with research corpus (sv-* ecosystem `[SD]`); runes-based state; transitions/actions are natural primitive hosts; dev-mode component source hints aid resolution |
| **React / Next.js** | Phase-2 candidate | Largest reference surface (Framer sites are React+motion `[SD: S4–S7 bundles]`); agentation is React `[SD]`; App Router SSR constraints must be handled |
| **Vanilla DOM/CSS** | Phase-2 (cheap, high value) | CSS/WAAPI primitives need no framework; enables static sites + the $10K-prompt class of builds `[SD: S1]`; simplest resolution (selector → file) |
| Vue / Nuxt | Later | Contract-ready; no corpus evidence |
| Astro | Later | Islands model fits KINETIC well (partial hydration) but unproven here |

Phase 2 picks ONE primary adapter for the proof (`24`); the others stay
spec-only. Decision criteria in `23`.

## Rung support per adapter

Each adapter declares which implementation rungs (`23`) it supports and how:

| Rung | Svelte | React | Vanilla |
|---|---|---|---|
| CSS | native | native | native |
| WAAPI | actions/`animate()` | refs + `animate()` | direct |
| Framework motion | svelte/transition + Motion SV (`[SD: E3]` ecosystem standard) | Motion (Framer Motion) (`[SD: S4–S7]` ecosystem standard) | — |
| GSAP | optional | optional | optional (`[SD: S8]` — licensing note, `23`) |
| Canvas/WebGL | shared TS module | shared TS module | shared TS module |

The shared TS core (canvas, math, pattern functions) is framework-free —
framework adapters wrap it. This keeps the registry DRY across stacks
(`[EI]` — the sv-* ecosystem instead maintains parallel ports; KINETIC can do
better by factoring the framework-free core out).
