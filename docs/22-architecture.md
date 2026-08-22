# 22 — Repository Architecture

Final Phase-1 structure (refined from the task §33 hypothesis; deltas explained
below).

```
kinetic-design-engine/
├── README.md
├── docs/                          # 00–24 (this set)
├── knowledge/
│   ├── sources/                   # per-source findings (02 excerpts as data)
│   │   └── source-index.json      # S1–S9, E1–E9, R1–R2, K1 registry w/ access tags
│   ├── patterns/                  # extracted reusable patterns (EI-tagged)
│   └── principles/                # 03 as data (machine-readable rules)
├── schemas/
│   ├── primitive-manifest.schema.json
│   ├── recipe-manifest.schema.json
│   ├── kinetic-job.schema.json
│   ├── visual-feedback.schema.json
│   ├── evaluation-result.schema.json
│   └── project-design-profile.schema.json
├── registry/                      # EMPTY in Phase 1 except registry.json stub
│   ├── registry.json
│   └── primitives|components|blocks|recipes|shaders|adapters/  (Phase 2+)
├── core/                          # SPEC-ONLY in Phase 1 (interfaces in docs)
│   ├── scanner/  planner/  resolver/  capability/  policy/
├── inspector/                     # SPEC-ONLY (docs 11, 12)
│   ├── visual/  motion/  source-map/
├── evaluator/                     # SPEC-ONLY (doc 13)
│   ├── visual/  responsive/  accessibility/  performance/  regression/
├── adapters/                      # SPEC-ONLY (doc 17)
│   ├── react/  next/  svelte/  sveltekit/  vanilla/
├── playground/                    # Phase 2
├── examples/                      # Phase 2
├── hermes/
│   ├── SKILL-DRAFT.md             # draft only, NOT installed in live Hermes
│   └── integration-spec.md
└── tests/                         # Phase 2 (schema validation first)
```

## Deltas vs the task hypothesis

1. **`knowledge/sources/source-index.json` added** — the evidence registry
   (`01`) as data, so planner queries can cite sources programmatically.
2. **`core/policy/` kept and defined** — holds surface gates, K-level budgets,
   product-core rules: the *enforcement* logic docs 09/10/18 describe.
3. **`core/resolver/`** = source resolution (`11` ladder) — separated from
   inspector because the automated evaluator uses it too.
4. **`registry/` ships as an empty stub** with root `registry.json` only —
   proves the shape without inventing primitives (task §37: no dozens of
   primitives).
5. **No `cli/` directory** — Phase 1 forbids implementation creep; installer
   design lives in `06`.
6. **`hermes/` is explicitly draft-only**, mirroring the live-integration
   prohibition.

## Build/test stance (Phase 1)

No package.json, no build system, no runtime deps — the repo is documents +
JSON Schemas. Schema validity is the only machine check Phase 1 performs
(`tests/` placeholder; validated via Python `json` load in this run).
