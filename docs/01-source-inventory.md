# 01 — Source Inventory

Access status and inspection quality for every Phase-1 source. Analysis lives in
`02-source-analysis.md`; classification rules in `00-vision.md` §Evidence discipline.

## Inspection-quality legend

| Tag | Meaning |
|---|---|
| DIRECTLY-INSPECTED | DOM, scripts, computed styles, docs, or repo metadata read first-hand |
| VISUALLY-INSPECTED | Screenshot-level observation (NOT available this session — active model is text-only; see Gap G1) |
| TEXT-ONLY | Text extraction only (no DOM/interaction probe) |
| METADATA-ONLY | Titles/descriptions/repo listings only |
| SECONDARY-SOURCE | Known via another inspected source |
| INACCESSIBLE | Could not retrieve |

## Primary sources

| # | Source | Status | Quality | Notes |
|---|--------|--------|---------|-------|
| S1 | DesignLab Notion playbook (`app.notion.com/p/DesignLab-…`) | ACCESSED | DIRECTLY-INSPECTED | Full page text incl. collapsed callouts + the complete "$10K site prompt" captured via browser. Initial `web_extract` failed; browser succeeded. |
| S2 | Google Doc "6 Websites Animation" | ACCESSED | TEXT-ONLY | Provided as attachment context: list of 6 URLs (S4–S9). No additional content. |
| S3 | X post @Sikandar_Bhide/status/2090106334201225285 | PARTIAL | TEXT-ONLY (post text + links) · media INACCESSIBLE | Post text, timestamp (Aug 19 2026), ~513.8K views, and 7 linked project URLs captured. Embedded video/media NOT retrievable. **X POST content is kept strictly separate from RELATED AUTHOR PROJECTS below.** |
| S4 | elated-convention-516854.framer.app ("Bento card stack") | ACCESSED | DIRECTLY-INSPECTED | DOM + computed styles + bundle inventory probed. |
| S5 | thoughtful-focus-537972.framer.app ("Beyond the Ordinary" hero) | ACCESSED | DIRECTLY-INSPECTED | DOM probe: per-character split, timing, easing captured. |
| S6 | 3dparticlesphere.framer.website ("Shape Morpher") | ACCESSED | DIRECTLY-INSPECTED | Canvas context probe: **Canvas 2D confirmed, WebGL/Three.js NOT present.** |
| S7 | gracious-routine-029598.framer.app/swisspixelreveal | ACCESSED | DIRECTLY-INSPECTED | 25×14 DOM grid, cell styles, masks probed. |
| S8 | fullstack-studio.webflow.io | ACCESSED | DIRECTLY-INSPECTED | Script inventory (GSAP+ScrollTrigger+SplitText+ScrambleText), SplitText output classes, marquee/cursor classes, page metrics probed. |
| S9 | fancy-toggle-753251.framer.app | PARTIAL | TEXT-ONLY (first render) + partial DOM | First load exposed card content ("High volatility", "+$12,840", "Risk alert"); on re-visit the component did not render into DOM within probe window. Morph mechanism NOT confirmed. |

## Sikandar ecosystem — RELATED AUTHOR PROJECTS (GitHub: SikandarJODD)

These are public projects *associated with* the author of S3. They are NOT assumed
to equal the S3 post's media content.

| # | Project | Status | Quality | What it is |
|---|---------|--------|---------|-----------|
| E1 | sv-agentation (sv-agentation.com, v0.3.0) | ACCESSED | DIRECTLY-INSPECTED | Dev-only visual annotation inspector → structured context for AI agents. Svelte. The single most KINETIC-relevant source. |
| E2 | agentation.com (original by Benji/dip.org) | ACCESSED | DIRECTLY-INSPECTED | The concept sv-agentation ports: annotate → markdown → agent; MCP two-way sync; annotation schema; webhooks; API. SECONDARY-SOURCE for sv-agentation's lineage. |
| E3 | sv-animations.vercel.app (repo `animations`) | ACCESSED | DIRECTLY-INSPECTED (landing) | 50+ animated components; Svelte 5 + TS + Tailwind + Motion SV; Magic UI / Spell UI / Fancy sections; CLI support. |
| E4 | sv-blocks.vercel.app (repo `cnblocks`) | ACCESSED | DIRECTLY-INSPECTED (landing) | 150+ UI & marketing blocks; Svelte 5 + Tailwind v4 + shadcn-svelte; **jsrepo CLI**; **MCP server integration** for Cursor/Windsurf. |
| E5 | sv-matrix.vercel.app (repo `sv-matrix`) | ACCESSED | DIRECTLY-INSPECTED (landing) | 50+ dot-matrix loaders in 4 shape families (hex/triangle/square/circle × 20). |
| E6 | sv-efferd.pages.dev (repo `sv-efferd`) | ACCESSED | DIRECTLY-INSPECTED (landing) | 60+ marketing blocks; shadcn-svelte CLI install; ported from another designer's original (credit preserved). |
| E7 | sv-particles.vercel.app (repo `sv-particles`) | ACCESSED | DIRECTLY-INSPECTED (landing) | Misleading name: actually "Svelte QBlocks" — shadcn-svelte production blocks incl. data-table. NOT a particle library. |
| E8 | GitHub profile repo listing | ACCESSED | METADATA-ONLY | sv-table, sv-resources, sv-globe, sv-ai-chat, ai-elements, sv-prompt-kit, reicon, docs-kit, sv-animate, craft, Pixel-Perfect, shadcn-svelte, awesome-svelte, svelte-ai-cookbook, form-builder, flow-diagram, ex-tables, raycast-extensions. Descriptions only. |
| E9 | sv-router.dev | NOT INSPECTED | SECONDARY-SOURCE | Mentioned in S3 replies; belongs to @colinlienard, not Sikandar. Type-safe Svelte SPA routing. Not pursued. |

## Registry-model sources

| # | Source | Status | Quality | Notes |
|---|--------|--------|---------|-------|
| R1 | shadcn/ui registry docs (`ui.shadcn.com/docs/registry*`) | ACCESSED | DIRECTLY-INSPECTED | registry.json + registry-item.json field-by-field; GitHub registries; "works with any framework" statement; MCP server exists. |
| R2 | jsrepo.dev | ACCESSED | DIRECTLY-INSPECTED (landing) | Registry toolchain: config-as-code, transforms/plugins, shadcn-compatible, interactive update diffs, **"Built for LLMs"** (demos+docs alongside items, file `role: 'example'`, auto dependency detection incl. dynamic imports). |

## Locally installed design-knowledge source

| # | Source | Status | Quality | Notes |
|---|--------|--------|---------|-------|
| K1 | `ui-ux-pro-max` Hermes skill (referenced by DesignLab S1) | INSTALLED locally | DIRECTLY-INSPECTED | Searchable CSV knowledge base: 67 styles, 161 palettes, 57 font pairings, 99 UX guidelines, 25 chart types, 22 stacks; `--design-system` with reasoning + anti-patterns; `--persist` master/overrides pattern; variance/motion/density dials. Lives at `~/.hermes/skills/creative/ui-ux-pro-max`. |

## Gaps (honest register)

- **G1 — No visual inspection this session.** The active model checkpoint is
  text-only; `browser_vision` returned a 400 ("text-only; must be a text part").
  All "visual" claims about S4–S9 therefore rest on DOM/style/script evidence,
  which is *stronger* than screenshots for implementation questions but weaker
  for aesthetic questions. Aesthetic judgments in `02` are marked ENGINE-INFERENCE.
- **G2 — S3 media inaccessible.** The X post's video(s) could not be retrieved.
  Nothing in this corpus is claimed as "from the post video".
- **G3 — S9 partial.** fancy-toggle's morph mechanism unconfirmed (see above).
- **G4 — reactbits.dev / aceternity / 21st.dev / componentry / refero** (linked
  from DesignLab S1) were NOT inspected in Phase 1 — they are DesignLab's own
  tool index, recorded as SECONDARY-SOURCE leads for Phase 2 knowledge work.
- **G5 — Canonical host workspace not mountable** (infra, not research):
  `/home/harshdev/HermesWorkspaces/kinetic-design-engine` absent from sandbox
  mounts; `workspace_attach` disabled by config. See README §Infrastructure note.
