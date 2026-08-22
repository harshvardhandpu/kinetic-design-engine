# 11 — Visual Feedback Protocol

The Visual Feedback Bridge: how a running KINETIC-enabled dev project produces
machine-readable feedback that resolves to source. Research basis: agentation /
sv-agentation (`02` §E1/E2) — existence proof; KINETIC extends it with kinetic
identity, motion state, machine-first schema, and an automated second producer.

## Capabilities (dev-only inspector)

Human can: hover element · click element · select text · multi-select
(shift+ctrl/cmd+click, `[SD: sv-agentation gesture]`) · select arbitrary region
· pause animations · leave a note · capture element context/styles/route/
viewport/source mapping · export structured feedback. Plus KINETIC additions:
scrub/restart a specific animation (via motion inspector, `12`), tag feedback
with severity/category, send directly to Hermes (file drop / MCP / webhook —
delivery channel is a Phase-2 decision).

## Kinetic identifiers (task §14 evaluation)

Optional, dev-first, production-safe attributes emitted by installed
primitives/recipes:

```html
<section data-kinetic-id="homepage-hero"
         data-kinetic-recipe="kinetic-typography-hero"
         data-kinetic-primitive="split-characters">
```

**Verdict: ADOPT, with guards.** `[ER]`

| Requirement | Mechanism |
|---|---|
| Not harm production | Attributes are inert data; no CSS/JS depends on them |
| Not required for rendering | Components render identically without them; they are additive |
| Stable when useful | Ids assigned by the installer from manifest + slot name (e.g. `homepage-hero`), recorded in `.kinetic/installed.json`; stable across re-renders because they are static attributes, not runtime-generated |
| Removable/minifiable | Build-time strip option (adapter plugin removes `data-kinetic-*` in prod builds); or keep — cost is ~bytes, zero behavior |
| Collision-safe | Installer namespaces: `data-kinetic-id` must be unique per page; installer validates against receipt |

Why they matter: selector-only targeting (`button.bg-blue-500`) is brittle
(class churn, duplicates). Kinetic ids give the resolver a **semantic anchor**
that survives restyling — this is the single biggest lever on "Hermes needs
less guessing" (`00`).

## Feedback schema (task §15 → `schemas/visual-feedback.schema.json`)

```jsonc
{
  "schema": "kinetic/visual-feedback@0.1",
  "session": { "id": "…", "project": "…", "timestamp": "…" },
  "route": "/",
  "viewport": { "name": "desktop", "width": 1440, "height": 900, "dpr": 2 },
  "producer": "human | evaluator | motion-inspector",
  "target": {
    "selector": "[data-kinetic-id='hero-primary-cta']",   // most stable first
    "fallback_selectors": ["section.hero button.primary"],
    "kinetic_id": "hero-primary-cta",
    "kinetic_recipe": "kinetic-typography-hero",
    "kinetic_primitive": "magnetic-button",
    "component": "HeroCTA",                                // framework component if known
    "text_excerpt": "Start now"                            // for text-range feedback
  },
  "visual_state": { "hover": false, "focus": false, "animation_progress": 0.42,
                    "reduced_motion": false },
  "feedback": {
    "severity": "low | medium | high | blocker",
    "category": "layout | typography | spacing | color | motion | interaction | hierarchy | content | responsive | accessibility | performance | bug",
    "instruction": "Reduce visual weight. Button dominates headline.",
    "expected_vs_actual": { "expected": "secondary emphasis", "actual": "primary emphasis" }
  },
  "context": {
    "computed_styles": { "width": "…", "height": "…", "font_size": "…", "padding": "…" },
    "bounding_box": { "x": 0, "y": 0, "w": 0, "h": 0 },
    "nearby_elements": [{ "selector": "…", "kinetic_id": "…", "relation": "sibling-above" }],
    "screenshot_ref": ".kinetic/captures/<session>/<n>.png"   // optional
  },
  "resolution": {            // filled by the resolver, not the collector
    "source_file": "src/components/home/HeroCTA.tsx",
    "source_range": { "start_line": 12, "end_line": 30 },
    "confidence": 0.93,
    "method": "kinetic-id | component-map | selector-grep"
  }
}
```

Design decisions vs the agentation baseline:
- `producer` field: humans and the automated evaluator (`13`) emit the SAME
  schema — the repair stage doesn't care who complained.
- `expected_vs_actual` encouraged (agentation best practice: "mention what you
  expected vs what you see" `[SD: E2]`).
- One issue per record (`[SD: E2 best practice]`); batches are arrays.
- Markdown export remains available for human pasting (`[SD: E1/E2]` copy
  modes), but Hermes consumes JSON.

## Source resolution ladder

1. **kinetic-id → receipt:** `data-kinetic-id` → `.kinetic/installed.json` →
   manifest `install_files` → file (+ symbol anchors if the primitive records
   them). Confidence: high.
2. **Component map:** framework devtools/source-map data (React component
   names; Svelte component paths via dev-mode source hints; `[SD: sv-agentation
   workspaceRoot + open-in-editor]` proves the mapping is obtainable).
3. **Selector grep:** selector → AST/grep search restricted to experience-layer
   files from the profile (`10`). Confidence: medium; ambiguous matches →
   return candidates, never pick silently.
4. **Region fallback:** bounding box → DOM ancestry → nearest experience-layer
   file. Confidence: low → requires confirmation probe.

Resolution output always carries `confidence`; below threshold (default 0.7)
the loop asks or probes again (`04` source-resolution stage).

## Delivery to Hermes

Phase-1 spec, Phase-2 choice:
- **File:** inspector writes `.kinetic/feedback/<session>.json` — Hermes polls/
  reads. Simplest, works everywhere. (Recommended for Phase 2.)
- **MCP:** two-way channel (`[SD: agentation MCP]` — list/clarify/resolve/clear
  annotations conversationally). Right long-term shape.
- **Webhook:** push to a local endpoint (`[SD: agentation webhooks]`).

## Inspector distribution

The inspector itself is a **registry item** (`06`), installed dev-only per
stack adapter (`17`): mounted only in dev + browser (`[SD: sv-agentation
mount policy]`), zero production footprint, removable by uninstalling the item.
