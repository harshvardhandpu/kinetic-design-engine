# 02 — Source Analysis

Evidence-backed analysis per source. Tags: `[SD]` SOURCE-DERIVED, `[EI]`
ENGINE-INFERENCE, `[ER]` ENGINE-RECOMMENDATION. Inspection quality per
`01-source-inventory.md`. No visual inspection was possible this session (Gap G1);
implementation claims below rest on DOM/script/style probes, which are direct
evidence — stronger than appearance for technology questions.

---

## S1 — DesignLab playbook (Notion) · DIRECTLY-INSPECTED

**What it is:** a personal "AI website playbook" — tool index, anti-slop
diagnostics, one premium prompt, and a Claude-skill-based workflow (UI/UX Pro Max).

Findings:

1. `[SD]` **Curated tool index, explicitly anti-dump.** Five tools, each with a
   stated niche: reactbits.dev (animated components/backgrounds), refero.design
   (real-product references), ui.aceternity.com (premium animated sections),
   21st.dev (community React sections), componentry.dev (animated shadcn-ready).
   Stated rule: *"tools are free, taste isn't… pick one thing per page and commit."*
2. `[SD]` **Five "why AI websites look cheap" tells:** (01) space has no
   hierarchy, (02) motion has no reason, (03) the grid is doing structure's job,
   (04) the glow is doing hierarchy's job, (05) dark mode isn't a decision.
   Meta-pattern stated: *"the model defaults to decoration when nobody made an
   actual decision."*
3. `[SD]` **The "$10K site prompt"** — a complete agentic build workflow:
   - Signature-first: pick ONE signature technique (GPU fluid, scroll-driven 3D,
     variable-font kinetics, generative growth, WebGL distortion, particle
     choreography) and build it standalone before layout. *"One technique executed
     deep beats five executed shallow."* Fallback rule: if the fanciest fails
     twice, drop to simpler and execute perfectly.
   - Brand fiction before styling (real names, prices, scarcity constraints;
     banned: lorem ipsum, "crafted with passion", "elevate your brand").
   - Authored system as explicit comment block: 4–6 NAMED hex values, never pure
     #000/#FFF, BANNED Tailwind default palette + purple-on-dark SaaS gradients;
     three type roles (characterful display 10rem+ clamp→4rem, quiet text face,
     mono for labels; BANNED display: Inter/Roboto/Arial/system-ui); one spacing
     scale (8…128px), section padding ≥96px desktop / 56px mobile, body 60–75ch,
     line-height ≥1.5; section numbering must encode something TRUE (decorative
     01/02/03 banned).
   - Static build, CDN libs only (Three.js import-map, GSAP+ScrollTrigger, Lenis);
     6–8 sections; signature wired into everything (hovers feed it, cursor stirs
     it, moves on its own); `prefers-reduced-motion` static fallback; **never let
     JS failure blank the page** (no CSS-hidden content only JS reveals).
   - **Hostile-critic verification loop:** real browser (headless OK), walk
     390/768/1440 top-to-bottom, zero console errors, no horizontal overflow,
     click every link/button, hover every card, watch pinned sections enter AND
     leave (*"transitions out are where builds look cheap"*), "where does the eye
     die?", minimum two full passes.
   - Ship with receipts: `guide.html` documenting concept, palette, type, and an
     **honest iteration log** of what critic passes caught.
4. `[SD]` **Skill-as-design-standard:** UI/UX Pro Max used as persistent
   expertise enforcing a standard "from the first message", section-by-section
   building, iteration pass mandatory. Common mistakes list: skipping setup,
   treating skill like a prompt, building everything at once, no iteration pass,
   ignoring the design system (drift).
5. `[SD]` The skill itself (K1) is installed locally: searchable CSV knowledge
   base + `--design-system` reasoning with anti-patterns + `--persist`
   master/overrides retrieval pattern + motion/variance/density dials.

`[EI]` DesignLab is a **knowledge-layer** artifact, not a registry: it encodes
decision rules and taste heuristics, not installable code. It validates KINETIC's
knowledge/registry split (`00`, `29`-concept) and supplies concrete slop
diagnostics for the evaluator (`13`). Its hostile-critic loop is the manual
ancestor of KINETIC's automated evaluator stage.

---

## S4 — elated-convention (Framer "Bento card stack") · DIRECTLY-INSPECTED

Observed (DOM/computed styles):

1. `[SD]` Semantic structure: `role="list"` container, `aria-label="Bento card
   stack"`, `tabindex="0"`; five `role="listitem"` cards. Framer names: "Bento
   cards", "Backdrop", "Content", "Logo", "Text", "Bottom", "Border".
2. `[SD]` Layout: absolutely positioned stacked cards, 320×200px inside a
   400×320 frame; vertical offset cascade (top: 60/64/68/72/76px) with z-index
   0–4 — a physical "deck" metaphor.
3. `[SD]` Motion: `transition: transform 0.45s cubic-bezier(…)` on each card;
   initial state `rotate(0deg) scale(1)`, `box-shadow 0 4px 24px rgba(0,0,0,.10)`,
   radius 18px. Interaction reorders/rotates the deck (hover/click → transform).
4. `[SD]` Stack: React + **motion** (Motion One/Framer Motion bundle, ~49.6KB) +
   Framer runtime; no canvas; no WebGL.
5. `[SD]` Content pattern: each card = gradient thumbnail image + title +
   one-line description (Overview/Analytics/Tasks/Team/Settings) — a dashboard
   navigation metaphor rendered as a marketing object.

`[EI]` Principles: (a) stacked-deck spatial metaphor communicates "collection"
without a grid; (b) one transition property (transform) + one easing = cheap and
smooth; (c) semantic list + tabindex keeps the gimmick accessible; (d) the effect
IS the navigation — motion carries information (order, depth), so it is
**functional**, not decorative.
`[ER]` KINETIC primitive hypothesis: `StackDeck` (LayoutMotion family) with
token-driven offset cascade and transform-only transitions; surface fit:
Decide/Learn + Explore, K2.

---

## S5 — thoughtful-focus (Framer hero) · DIRECTLY-INSPECTED

1. `[SD]` Single-viewport hero (body height == viewport height; no scroll
   content). H1 "BEYOND THE ORDINARY" split into **19 per-character
   `display:inline-block` spans**.
2. `[SD]` Reveal mechanics: per-letter `opacity 0→1` + `translateY(→0px)`,
   duration **1.2s**, easing **cubic-bezier(0.16, 1, 0.3, 1)** (expo-out),
   **stagger 120ms/letter** via `transition-delay` (0, 120, 240, …).
3. `[SD]` Framer appear-animation attribute present (`data-framer-appear-animation`),
   stack React + motion bundle; no canvas.
4. `[SD]` Copy structure: eyebrow-style H1, one-line sub ("Crafting moments worth
   remembering."), H2 positioning statement, paragraph, two CTAs ("View Selected
   Work" / "Start A Collaboration").
5. `[SD]` Note: the attached text extraction showed the hero content 3× — that is
   an extraction artifact; DOM contains exactly one H1/H2. `[EI]` Text-extraction
   duplication is a known hazard for agent analysis; DOM probing is required for
   ground truth (this is exactly why KINETIC needs an inspector, not screenshots
   alone).

`[EI]` Principles: (a) character-split + long expo-out + wide stagger reads as
"cinematic" at ~zero runtime cost (pure CSS transitions on inline-block spans);
(b) total choreography time ≈ 1.2s + 18×120ms ≈ 3.4s — long for a hero; works
because nothing else competes (single-viewport, no scroll). Stagger budget must
scale with content density.
`[ER]` Primitive hypotheses: `SplitCharacters` + `StaggerReveal` (Typography
family) with tokenized duration/stagger/easing; recipe "Kinetic Typography Hero".

---

## S6 — 3dparticlesphere ("Shape Morpher") · DIRECTLY-INSPECTED

1. `[SD]` Full-viewport black stage; `role="application"`, `aria-label="Shape
   Morpher"`, `touch-action:none`; instruction text "Scroll & Drag".
2. `[SD]` **Two `<canvas>` elements** at 2560×1384 (viewport-sized, DPR 1 in this
   environment), both `aria-hidden`, both with **2D contexts** (`getContext('2d')`
   succeeds). **No WebGL context, no `window.THREE`, no WebGL/shader strings in
   the site bundle.** Bundle: React + motion + Framer runtime only.
3. `[SD]` Interaction model declared by UI: scroll + drag drive shape morphing.

`[EI]` **Key correction to the obvious assumption:** a "3D particle sphere" demo
need not be WebGL/Three.js — a sphere point cloud (e.g. fibonacci distribution)
with manual rotation/projection renders fine on Canvas 2D for moderate particle
counts. Technology inference must come from context probes, never from looks.
`[EI]` Two stacked canvases suggest layering (e.g. particles + glow/trails) or
double-buffering.
`[ER]` Primitive hypothesis: `ParticleSphere` with **implementation ladder**:
Canvas2D (default, P2) → WebGL points (P4) only when count/throughput demands;
inputs: count, distribution, rotation, pointer gravity; mandatory static fallback.
This is the canonical test case for the technology router (`23`).

---

## S7 — swisspixelreveal (Framer) · DIRECTLY-INSPECTED

1. `[SD]` Effect built as a **25×14 CSS grid = 350 DOM cells** (`repeat(25,1fr)`
   × `repeat(14,1fr)`), each cell `background rgb(230,230,230)` + 1px outline,
   `will-change: transform, opacity`, animated via `transform: scale(0→1)` —
   Motion-driven (motion bundle present), **no canvas**.
2. `[SD]` Additional layer: `mask: linear-gradient(180deg, transparent 65%, black
   100%)` over part of the composition; SVG data-URI masks on text elements.
3. `[SD]` Typography: Inter Variable, H1 40px/400 — deliberately quiet; the grid
   is the protagonist. Copy: "PIXEL REVEAL / MADE SIMPLE" + one explanatory line.
4. `[SD]` Page claims "generate multiple patterns for the reveal" — pattern
   generation (order/direction of cell activation) is the configurable axis.

`[EI]` Principles: (a) DOM-grid reveal is inspectable, styleable, and
reduced-motion-trivial (show final state), at the cost of N animated nodes —
350 is fine; thousands are not; (b) `will-change` on every cell is a memory
trade-off worth flagging in an evaluator; (c) reveal pattern = data (an order
array), cleanly separable from the renderer — good primitive shape.
`[ER]` Primitive hypothesis: `PixelReveal` (Reveal family) parameterized by
grid size + pattern function (row/column/diagonal/random/radial), with a DOM-cell
and a canvas implementation under one contract; performance class P2 (DOM) / P3
(canvas for large areas).

---

## S8 — fullstack-studio.webflow.io · DIRECTLY-INSPECTED

1. `[SD]` Stack: Webflow + jQuery 3.5.1 + **GSAP core + ScrollTrigger + SplitText
   + ScrambleTextPlugin** (all loaded as separate scripts; `window.gsap` present).
   No Lenis detected.
2. `[SD]` SplitText output in DOM: `.gsap_split_word` / `.gsap_split_letter`
   classes; 221 elements carry inline transform/translate styles (GSAP-managed).
3. `[SD]` Marquee structures: `.hero_marquee`, `.arc-marquee_wrap/_track/_item/_image`
   (arc = curved logo carousel); only one CSS `@keyframes` (`spin`) — motion is
   JS-driven, not CSS-keyframe-driven.
4. `[SD]` Custom cursor: `.works_cursor` + `.works_cursor-item` on the works list
   ("View Work" hover cursor).
5. `[SD]` Page: 14,811px body height at 2560×1384 viewport (~10.7 viewports);
   sections: hero marquee → logo cloud → team → awards (x03/x07/x12/x05/x26
   counters) → selected works (4 projects) → inline-image paragraph → CTA →
   pricing (2 plans) → FAQ → footer. No `pin-spacer` elements at probe time
   (pins may be created lazily on scroll).
6. `[SD]` Imagery: bold, art-directed, non-generic photography/illustration;
   inline image inside a paragraph as a visual interruptor.

`[EI]` Principles: (a) this is the "full GSAP choreography" end of the spectrum —
plugin-heavy (SplitText/ScrambleText are paid Club plugins — licensing matters
for a registry, see `23`); (b) marquee + custom cursor + split text + counters is
a coherent award-site vocabulary, but every element is **functional marketing**
(logo cloud = trust, awards = proof, works = product); (c) 221 GSAP-managed
inline styles is the cost of admission — an evaluator must budget this.
`[ER]` Recipe hypothesis: "Editorial Studio Landing" (marquee hero + split-text
headlines + custom cursor gallery + counter awards). KINETIC must offer
**non-GSAP equivalents** (CSS/WAAPI marquee, DOM split text) so the recipe is
licensable and light — GSAP only when choreography complexity justifies it.

---

## S9 — fancy-toggle (Framer) · PARTIAL (TEXT-ONLY first render + partial DOM)

1. `[SD]` First render exposed a finance-themed card cluster: "High volatility /
   Rebalance exposure", "Captured opportunity +$12,840 / View insight",
   "Risk alert — High volatility detected in emerging markets".
2. `[SD]` Framer stack (React + motion bundle); no canvas. One `<button>` found
   on re-probe was Framer's own editor-bar button, not the demo control.
3. `[SD]` On re-visit the demo content was not present in DOM within the probe
   window (likely interaction-gated or hydration-timed). **Morph mechanism
   unconfirmed — Gap G3.**

`[EI]` From content alone: a toggle that switches between *states of a data
story* (risk ↔ opportunity) is a **ToggleMorph / state-narrative** pattern —
the microinteraction carries meaning (financial state change), which makes it
functional motion for Monitor/Decide surfaces.
`[ER]` Primitive hypothesis: `ToggleMorph` (Microinteraction family) — but do NOT
ship it on S9 evidence alone; Phase 2 should re-inspect or design from principle.

---

## S3 — X post (kept separate) · TEXT-ONLY, media INACCESSIBLE

`[SD]` Post text: "wtf this is Crazyyy" + 7 links (sv-animations, sv-table,
sv-blocks, sv-efferd, sv-matrix, sv-particles, sv-agentation), Aug 19 2026,
~513.8K views. Replies add sv-router.dev (different author) and "head of svelte".
**Nothing else is claimed about the post's media content (Gap G2).**

---

## E1/E2 — Agentation + sv-agentation · DIRECTLY-INSPECTED (the feedback-bridge sources)

`[SD]` **agentation.com** (original): click any element → note → copy formatted
markdown → paste into agent. Agents receive: **CSS selectors to grep, source file
paths, React component tree, computed styles, feedback with intent and priority.**
Explicit value statement: replaces "the blue button in the sidebar" guessing with
`.sidebar > button.primary`. MCP integration makes it two-way ("what annotations
do I have?", "fixed the padding" → resolve). Also: webhooks, public API,
annotation format schema, animation-pause demo, text-range selection, best
practices (one issue per annotation; be specific; pause animations to annotate a
frame).

`[SD]` **sv-agentation v0.3.0** (Svelte port by Sikandar Bhide): dev-only mount
(`browser && dev`); keyboard shortcuts (i inspect, c copy, r reset, o open
source, d delete, esc, enter; all overridable via `keyBindings`);
**shift+ctrl/cmd+click group selection**; **shadow-DOM piercing**; route-scoped
sessions automatic; hover a saved marker to preview the exact area; output modes
**compact / standard / detailed / forensic**; props: `workspaceRoot` (source
lookup + editor links), `selector` scoping, `openSourceOnClick`,
`includeComponentContext`, `includeComputedStyles`, `pauseAnimations`,
`clearOnCopy`; lifecycle callbacks `onAnnotationAdd/Update/Delete`,
`onAnnotationsClear`, `onCopy(markdown, payload)` for forwarding into local
tooling.

`[EI]` This is the **existence proof for KINETIC's Visual Feedback Bridge**
(`11`): element → selector + source path + component context + computed styles +
note, exported as structured payload. Deltas KINETIC needs on top: (a) kinetic
identifiers (recipe/primitive membership) in the payload, (b) motion state
(animation progress, trigger, easing) — agentation has pause but no motion
metadata, (c) machine-first schema (YAML/JSON) alongside the human markdown,
(d) automated evaluator as a second feedback producer, (e) framework-neutral
core (agentation is React, sv-agentation Svelte — same concept, two ports →
KINETIC should spec the payload once and port the collector).
`[ER]` KINETIC's inspector should be installable as a dev-only registry item
(copy-source model), not a runtime SaaS dependency; MCP/webhook delivery channels
are the right integration shape for Hermes.

---

## E3–E7 — Sikandar component/block sites · DIRECTLY-INSPECTED (landings)

`[SD]` Common architecture across sv-animations / sv-blocks / sv-matrix /
sv-efferd / sv-particles:
- Svelte 5 + TypeScript + Tailwind CSS (+ shadcn-svelte for blocks);
- **CLI installation** (jsrepo for sv-blocks; shadcn-svelte CLI for sv-efferd);
- **MCP server integration** advertised for AI editors (sv-blocks);
- large flat inventories (50+ animations, 150+ blocks, 50+ loaders, 60+ marketing
  blocks) with systematic naming (sv-matrix: 4 shape families × 20 numbered
  variants);
- free/MIT, light+dark mode parity, responsive claims;
- ports with explicit credit to original designers (sv-efferd credits Shaban;
  sv-particles "inspired from COSS UI"; ai-elements ports Vercel AI Elements).

`[EI]` Principles: (a) **source-installable registries with CLI + MCP are already
the de-facto distribution model** for agent-era component libraries — KINETIC's
registry design (`06`) should interoperate with this ecosystem (jsrepo/shadcn
manifest shapes) rather than invent an incompatible one; (b) numbered variant
families (square-1…square-20) are a cheap, agent-legible taxonomy; (c) the
ecosystem's weakness is exactly what KINETIC adds: no surface-type guidance, no
performance classes, no motion budgets, no feedback loop — components are
published, not governed.
`[SD]` Naming caution: sv-particles contains no particles (it's data-table
blocks). `[EI]` Registry item ids must be semantically validated; names lie.

---

## R1/R2 — shadcn registry + jsrepo · DIRECTLY-INSPECTED

`[SD]` **shadcn registry model:**
- `registry.json` (name, homepage, items[], `include[]` for multi-file
  composition; item names unique across includes; output flattened at build).
- `registry-item.json`: name, type (`registry:ui|block|component|hook|lib|page|
  file|style|theme|font|item|base`), title, description, author,
  `dependencies` (npm, `name@version`), `devDependencies`, `registryDependencies`
  (bare name | `@namespace/item` | `owner/repo/item#tag-or-SHA` | URL | local
  path; **refs not inherited — pin each dep for reproducibility**), `files[]`
  (path, type, optional `target` — required for page/file types), `tailwind`,
  `cssVars` (theme/light/dark), `css`, `envVars` (dev-only, never overwrite
  existing), `font`, `docs` (install-time message), `categories`, `meta`.
- GitHub repos can BE registries (root registry.json + includes); CLI installs
  files from the repo; **explicitly "works with any project type and any
  framework, not limited to React"**; MCP server exists for the registry.

`[SD]` **jsrepo:** config-as-code (`defineConfig`), transform plugins
(javascript, prettier), shadcn-compatible add/update with **interactive diffs**
on update, hosts anywhere (public/private), auto dependency detection including
dynamic imports, and explicit LLM orientation: demos+docs shipped alongside
items, file `role: 'example'`.

`[EI]` Answers to the Phase-1 registry questions (task §7):
- *How does a registry describe files?* path + type + optional target; content
  resolved from repo/URL at install time.
- *Dependencies?* two kinds — npm packages vs registry items — with pinnable,
  namespaced, URL-addressable item refs.
- *Source installation?* CLI copies files into project, applies cssVars/tailwind
  config edits, installs npm deps; project owns the result.
- *Versioning?* item-level version + git tag/SHA pinning of item refs.
- *Composition?* registryDependencies graph + include-based registry assembly.
- *Agent inspection before install?* manifest JSON is fetchable and
  self-describing; jsrepo ships demos/docs with items; MCP exposes both.
- *Project ownership?* by design — copied source, no runtime package.

`[ER]` KINETIC registry contract (`06`) = shadcn-shaped manifest **plus**
KINETIC-specific metadata (surface types, K-level, performance class, motion
intensity, reduced-motion policy, verification hooks, source inspiration) in a
namespaced extension field, so KINETIC items can still be served/consumed by
shadcn-compatible tooling (jsrepo CLI) while carrying governance data.

---

## K1 — ui-ux-pro-max skill · DIRECTLY-INSPECTED (installed locally)

`[SD]` CSV-backed knowledge: 67 styles, 161 palettes, 57 font pairings, 99 UX
guidelines, 25 chart types, 22 stacks; `--design-system` applies reasoning rules
and returns pattern/style/colors/typography/effects **with anti-patterns**;
`--persist` writes `design-system/MASTER.md` + `pages/<page>.md` overrides with a
documented retrieval order (page override → master); dials: variance
(centered↔bold), motion (subtle↔complex, attaches GSAP snippet by tier), density
(spacious↔dashboard, overrides spacing tokens).

`[EI]` This is a working template for KINETIC's **knowledge layer**: queryable,
reasoned, persistable, with master/overrides retrieval — the same shape KINETIC
needs for surface-type → design-posture mapping. KINETIC should integrate with
(or at least not duplicate) this installed knowledge rather than rebuild it.
