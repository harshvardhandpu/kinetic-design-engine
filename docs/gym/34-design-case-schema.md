# 34 — DesignCase Schema (document)

Schema file: `schemas/gym/design-case.schema.json`. A DesignCase is the durable
record of one studied reference site. It grows through stages; fields are filled
when evidence exists, never fabricated.

## Lifecycle stages

```
INGESTED   → metadata + provenance only (from index/MCP)
STUDIED    → analysis sections filled (observation evidence)
BRIEFED    → variant brief derived (what V0 must reproduce, what V1–V9 may vary)
(then VariantRuns reference it; the case itself is append-only after STUDIED,
 except promotion_history and re-study annotations)
```

## Section map (field groups → evidence rules)

| Group | Contents | Evidence rule |
|---|---|---|
| `identity` | case_id, canonical_url, title, studio, year | metadata from source |
| `provenance` | per `docs/gym/32` contract | recorded at ingest |
| `availability` | live/archived/dead, archive_url, last_checked | probed |
| `surface` | surface_types[], k_level_estimate | Phase-1 classifier output, tagged ENGINE-INFERENCE |
| `layout` | grid, hierarchy, spacing, composition notes | DIRECTLY-INSPECTED (DOM probes) or VISUALLY-INSPECTED (screenshots) |
| `typography` | families, roles, scale observations | observed; font names only when verifiable (CSS/font files), else "unidentified display serif" |
| `color` | palette extraction, contrast observations | observed values; extraction method recorded |
| `motion` | scroll, transitions, hover, ambient, 3D/spatial | observed behavior + probes; `technology.inferred` kept separate |
| `technology` | observed[], inferred[] + confidence | Phase-1 rule: never claim a library from appearance alone |
| `performance` | load observations, CWV if measurable | measured or marked `not_measured` |
| `accessibility` | keyboard, focus, reduced-motion behavior | probed where possible |
| `principles` | source-derived principles[] | each tagged SOURCE-DERIVED + evidence pointer |
| `inferences` | engine inferences[] | tagged ENGINE-INFERENCE |
| `anti_patterns` | observed weaknesses | evidence required; this is negative knowledge input (43) |
| `figma` | optional, only if legally available (38) | authorization recorded |
| `variants` | VariantRun ids | links, not embedded |
| `scores` | automated + external award signals | separated by producer (44) |
| `human_selections` | TasteDecision ids | links |
| `promotion_history` | promoted lessons → EngineEvolutionRecord ids | append-only |
| `re_studies` | dated re-study annotations | spaced repetition (33) |

## Hard rules

1. **Evidence quality tags are mandatory** on every analysis field:
   DIRECTLY-INSPECTED / VISUALLY-INSPECTED / TEXT-ONLY / METADATA-ONLY /
   INFERRED (with confidence 0–1). (Phase-1 convention, extended.)
2. **No speculation laundering.** An inference never migrates into an
   `observed` array. Technology claims need probe evidence (bundle strings,
   runtime objects, canvas contexts) — the Phase-1 particle-sphere lesson.
3. **Award scores are weak priors** (`docs/gym/32`): stored under
   `scores.external`, never mixed into `scores.automated`.
4. **One case per canonical URL**; re-studies append, never overwrite.
5. **Copyright floor:** no mirrored proprietary assets; screenshots for internal
   study only, content-addressed, retention-classed (`docs/gym/52`).

## Size discipline

A DesignCase JSON targets < 50 KB. Screenshots, traces, DOM dumps live in
`gym/artifacts/` referenced by sha256. The case is what Hermes loads into
context; artifacts are fetched on demand.
