# 23 — Technology Decisions

Rule: **capability → simplest suitable implementation** (task §8/§26, `03` P13).
No technology is mandatory because KINETIC supports it. Decisions below are
compared, not arbitrarily chosen; each carries evidence.

## The implementation router

| Capability | First choice | Escalate when |
|---|---|---|
| Basic hover/focus/state | **CSS transitions** | never needed for this class |
| Simple element transition | **WAAPI / native framework transitions** | choreography exceeds declarative reach |
| Component state motion | **Framework motion library** (Motion for React `[SD: S4–S7 bundles]`; svelte/transition + Motion SV for Svelte `[SD: E3]`) | cross-component timelines |
| Complex choreography (pins, scrubs, synced timelines) | **GSAP** where justified | — (top of JS rung) |
| 3D | **Three.js / R3F** when stack-appropriate AND capability genuinely 3D | S6 reminder: "3D-looking" may be Canvas2D projection — prove the need |
| Custom graphical effect | **Canvas 2D / WebGL** | particle counts/throughput beyond 2D |
| Advanced experimental GPU | **WebGPU** | only when justified (K5 research) |

## Specific decisions

### D1 — No required runtime dependency
KINETIC ships source, not a package. `[SD: shadcn/jsrepo model]` + task §7.
Consequence: every primitive must be implementable with its declared deps only.

### D2 — GSAP: optional rung, licensing flagged
`[SD: S8]` fullstack-studio uses GSAP + ScrollTrigger + **SplitText +
ScrambleTextPlugin — the latter two are Club (paid) plugins**. Decision: GSAP
core/ScrollTrigger allowed as an optional rung; KINETIC registry provides
**non-GSAP implementations** of split-text/scramble (DOM + WAAPI) as the
default so recipes are licensable and light. GSAP selected only when
choreography complexity justifies it, declared in manifest `dependencies`.

### D3 — Motion (Framer Motion) / Motion SV: ecosystem defaults, not KINETIC defaults
`[SD: S4–S7]` all Framer references bundle React + motion; `[SD: E3]` Svelte
animation ecosystem standardizes on Motion SV. Decision: adapters may use them
as the framework-motion rung; primitives that can be CSS/WAAPI stay there.
KINETIC itself depends on neither.

### D4 — Canvas 2D before WebGL for particle systems
`[SD: S6]` a full-viewport interactive particle sphere ran on Canvas 2D with no
WebGL/Three.js. Decision: `particle-*` primitives default to the Canvas2D rung
(P3); WebGL (P4) is an explicit ladder rung with count/throughput justification
in the manifest. This is the reference case for the router's credibility.

### D5 — Framework neutrality; Phase-2 primary adapter TBD
Compared (doc `17`): Svelte/SvelteKit (corpus-aligned ecosystem, runes,
natural transition hosts) vs React/Next (largest reference surface, agentation
is React) vs Vanilla (cheapest, enables static builds per `[SD: S1]` $10K
prompt class). **Decision deferred to Phase 2 kickoff** with criteria:
(a) one adapter must prove the FULL loop end-to-end; (b) vanilla CSS/WAAPI
primitives get built regardless (they are framework-free and de-risk
everything); (c) pick whichever of Svelte/React the Phase-2 playground stack
uses — do not build two framework adapters in the proof. `[ER]`

### D6 — Inspector: custom, agentation-shaped, framework-ported
`[SD: E1/E2]` prove the concept and the payload shape. Decision: KINETIC specs
the payload (`11`) once; collector ports per adapter. Build vs adopt (fork
agentation's approach) is a Phase-2 implementation choice; Phase 1 records that
sv-agentation is MIT-licensed Svelte `[SD: GitHub repo LICENSE file present]`
should adoption be considered — with credit obligation (`03` P11).

### D7 — Registry format: shadcn-compatible superset
`[SD: R1/R2]` — interop with jsrepo CLI and shadcn MCP gives KINETIC items
existing distribution rails; the `meta.kinetic` extension carries governance.
Decision: compatibility is a constraint on the schema, not a dependency.

### D8 — Schemas: JSON Schema (draft 2020-12)
Machine validation with zero runtime deps (Python/Node validators both free).
YAML used only in docs for readability; normative artifacts are JSON.

### D9 — Delivery channels for feedback: file-first, MCP later
`[SD: E2]` MCP two-way + webhooks exist in the reference. Decision: Phase 2
uses file drop (`.kinetic/feedback/*.json`) — zero infrastructure; MCP is the
v1 upgrade path.

## Explicitly NOT decided (kept open by design)

- React vs Svelte as primary adapter (D5 criteria set, choice at Phase 2).
- WebGPU anything (no corpus evidence; K5-only by policy).
- Lenis/smooth-scroll libraries (absent from corpus except a mention in the
  $10K prompt CDN list `[SD: S1]`; evaluate if scroll recipes demand it).
- Any state management, styling framework beyond what the target project uses.
