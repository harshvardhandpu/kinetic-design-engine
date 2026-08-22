# 33 — Curriculum Sampling

How the daily batch of references is chosen. Goal: diverse, weakness-targeted,
non-redundant study — never "ten identical portfolio sites".

## Sampling axes (all available from validated sources)

| Axis | From | Notes |
|---|---|---|
| year | award date | 2020–2026 historical + rolling new |
| award body/level | provenance | SOTD vs SOTY vs honors = different bars |
| category | Awwwards/Siteinspire taxonomy | e-commerce, portfolio, experimental… |
| surface type | KINETIC classification (Phase 1 §5) | classified at study time, not ingest |
| technology | Awwwards tech tags | GSAP / Three.js / WebGL / Svelte / no-code |
| motion complexity | study-time assessment | K0–K5 estimate (Phase 1 `docs/09`) |
| studio | profile data | avoid single-studio overload |
| geography | Awwwards country tag | where metadata exists |
| visual style | Siteinspire style taxonomy | brutalist, minimal, colorful… |

## Sampler modes (composable; the daily batch is a mix)

1. **unseen** — default: uniform over un-studied cases, stratified by year ×
   category so no stratum starves.
2. **stratified** — explicit quotas per stratum (e.g. "this week: 3 immersive
   WebGL, 3 editorial, 2 e-commerce, 2 dashboard-grade").
3. **weak-area** — driven by metrics (`docs/gym/54`): strata where qualification
   rate or first-shot preference rate is lowest get extra slots.
4. **spaced-repetition** — re-study important old cases after N days to test
   retention of their lessons (cases whose principles were promoted get retested
   when the engine version changes).
5. **frontier** — new winners + new-technology cases (WebGPU, new browser APIs)
   get a standing slot so the corpus doesn't age.
6. **new-tool** — when ToolKnowledge adds a tool (e.g. a new MCP), schedule cases
   that exercise it.

## Batch composition (default daily = 10 references)

```
5 × unseen-stratified
2 × weak-area
1 × spaced-repetition
1 × frontier/new-winner
1 × free (experiment-driven or user-pinned)
```

Configurable in the CurriculumJob input; the sampler writes the chosen batch +
rationale into the job record (auditable).

## Anti-monotony rules

- max 3 cases/day from one studio; max 4/day from one category;
- if yesterday's batch was >50% one visual style, today's unseen slot excludes it;
- user can pin/force specific URLs (overrides sampler, recorded).

## Curriculum lifecycle

```
HISTORICAL (2020–2026, target 1000+)
    → once exhausted per stratum, steady state:
CONTINUOUS  new winners (weekly check of SOTD feeds via MCP/index pages)
          + re-studies (spaced repetition, engine-version triggers)
          + weakness-targeted batches (metric-driven)
          + new-tool batches (ToolKnowledge-driven)
```

The 1000+ figure is a DIVERSITY target, not a race: ingestion stops being
valuable when strata saturate, and the sampler then shifts weight to continuous
+ weak-area modes. Corpus size is reported, never optimized.
