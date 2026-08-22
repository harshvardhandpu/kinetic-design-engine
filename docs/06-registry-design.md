# 06 — Registry Design

Registry = machine-readable catalog of source-owned installables. Research
basis: shadcn registry spec + jsrepo (`02` §R1/R2). KINETIC adopts their
proven mechanics and extends them with governance metadata. Not coupled to
shadcn — shape-compatible so existing tooling (jsrepo CLI, shadcn MCP) can
serve KINETIC items.

## Core decisions

| Decision | Choice | Why (evidence) |
|---|---|---|
| Distribution unit | **Source files copied into target project** | `[SD: shadcn/jsrepo]` project owns code → inspectable, modifiable, no bloat; task §7 requirement |
| Manifest format | JSON, shadcn `registry-item.json` superset | `[SD]` field-proven; agent-parseable; tooling exists |
| Extension mechanism | Namespaced `kinetic` object inside manifest | `[SD: shadcn `meta` field]` official extension point; keeps base interop |
| Hosting | Static files in repo (`registry/`) + optional HTTP serving later | Phase 1 = local repo; `[SD]` GitHub repos can be registries directly |
| Versioning | Item `version` (semver) + git tag/SHA pinning for item refs | `[SD: shadcn refs pinning guidance]` |
| Composition | `registryDependencies` graph (primitives ← recipes ← blocks) | `[SD]` graph model proven |
| Install tooling | Phase 2: thin installer script; NOT a required runtime package | task §7; `03` P14 |

## Directory layout

```
registry/
├── registry.json              # root: name, homepage, include[]
├── primitives/<id>/
│   ├── manifest.json          # registry-item superset
│   ├── src/<framework>/...    # one dir per supported framework
│   ├── demo/                  # runnable demo (jsrepo-style role:example)
│   └── tokens.json            # semantic tokens this primitive consumes
├── components/<id>/           # composed UI with behavior
├── blocks/<id>/               # page-level sections
├── recipes/<id>/              # composition plans (doc + manifest, doc 07)
├── shaders/<id>/              # GLSL/WGSL with metadata (P4 items)
└── adapters/<stack>/          # stack glue (doc 17)
```

`include[]` composes root registry.json from per-category files (`[SD]` shadcn
include mechanics; item names unique across includes; build flattens).

## Manifest = registry-item.json + kinetic extension

Base fields (all `[SD: shadcn spec]`): `name`, `type` (registry:ui/block/
component/hook/lib/page/file), `title`, `description`, `author`, `version`,
`dependencies` (npm `name@version`), `devDependencies`, `registryDependencies`
(bare | `@ns/item` | `owner/repo/item#ref` | URL | path; **each dep pinned —
refs are not inherited**), `files[]` (`path`, `type`, optional `target`),
`cssVars` (theme/light/dark), `tailwind`, `css`, `docs`, `categories`, `meta`.

KINETIC extension (in `meta.kinetic` — schema: `schemas/primitive-manifest.schema.json`):

```jsonc
"meta": {
  "kinetic": {
    "kind": "primitive | component | block | recipe | shader | adapter",
    "family": "reveal | typography | scroll | pointer | microinteraction | transition | spatial | particles | ambient | navigation | layout-motion | feedback",
    "surface_types": ["decide-learn", "explore"],        // doc 10
    "kinetic_levels": ["K2", "K3"],                      // doc 09
    "performance_class": "P2",                           // doc 15
    "motion_intensity": "moderate",                      // subtle|moderate|strong
    "motion_purpose": "expressive",                      // functional|expressive|decorative (doc 03 P2)
    "mobile_policy": "simplify",                         // full|simplify|static-fallback
    "reduced_motion_policy": "static-end-state",         // doc 16
    "no_js_state": "content-visible-effect-absent",      // doc 03 P7
    "implementation_ladder": ["css", "canvas2d"],        // doc 23
    "inputs": [{ "name": "staggerMs", "type": "number", "token": "kinetic.stagger.normal", "default": 120 }],
    "variants": ["pixel-reveal-dom", "pixel-reveal-canvas"],
    "conflicts": ["fullpage-pin"],                       // known incompatibilities
    "source_inspiration": [{ "ref": "S7", "url": "https://gracious-routine-029598.framer.app/swisspixelreveal", "evidence": "DIRECTLY-INSPECTED", "claim": "25x14 DOM grid, scale reveal" }],
    "verification": { "demo_route": "/demo/pixel-reveal", "checks": ["no-overflow", "reduced-motion-static", "console-clean"] },
    "install_strategy": "copy",                          // copy | copy+config | config-only
    "kinetic_ids": "auto"                                // data-kinetic-id emission (doc 11 §identifiers)
  }
}
```

## Install semantics

1. **Resolve:** fetch manifest → expand `registryDependencies` (cycle check,
   pin check) → compute file set + npm deps + cssVars.
2. **Conflict check:** against ProjectDesignProfile (existing deps, existing
   primitives, protected paths).
3. **Copy:** files → target paths (`files[].target` or convention
   `src/components/kinetic/<id>/`). `[ER]` Never overwrite existing files;
   collision → rename + report.
4. **Token adaptation:** map manifest `tokens.json` → project tokens; missing
   project token → add to `kinetic.tokens` file, never inline constants.
5. **Config edits:** cssVars/tailwind applied as declared (shadcn mechanics).
6. **npm deps:** only declared ones; subject to approval gate (`04` stage 7).
7. **Receipt:** write `.kinetic/installed.json` (item, version, files, token
   map, date) — this is what makes installed code traceable back to the
   registry for feedback resolution (`11`) and updates.
8. **Update:** `[SD: jsrepo interactive diffs]` Phase-2 installer should show
   diffs on update, never blind overwrite — project may have customized.

## Agent-inspection requirements (task §7 questions, answered)

- *Inspect before install:* manifest is self-describing JSON; demos ship with
  items (`files[].role: example` `[SD: jsrepo]`); Hermes can read source from
  the registry before copying — no install-to-evaluate needed.
- *Versioning:* semver per item; recipes pin primitive versions.
- *Project ownership:* post-install, code is ordinary project source; receipt
  keeps provenance; uninstall = remove receipt-listed files (+ receipt).

## Governance

- Publish gate: manifest validates against schema; evidence field non-empty for
  any capability claim; reduced-motion + no-JS policies present; demo passes
  evaluator baseline (`13`). `[ER]`
- Lint: semantic id check (`03` P16), dependency pin check, surface/K-level
  plausibility check.
- No telemetry, no network requirement at install time (local repo path is a
  valid registry address).
