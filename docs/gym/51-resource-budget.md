# 51 — Resource Budget

100 candidates/day is only sane with strict storage/compute discipline.

## No-duplication rules

- **One shared package store** (pnpm store / npm cache) for ALL candidate
  builds; candidates install from it, never per-candidate registries.
- **One build toolchain** version per framework adapter; candidates don't pin
  private toolchains unless an experiment declares it (blast radius, 37).
- **Template skeletons, not cloned projects:** a candidate = skeleton +
  source diff. Where git is used, candidates are branches/worktrees off a
  per-case base, sharing object storage.
- **Content-addressed artifacts:** screenshots/traces named by sha256 under
  `gym/artifacts/`; identical captures dedupe automatically. Screenshots
  compressed (WebP, capped resolution per purpose: review 1440w, eval 1280w).

## Per-day budget envelope (defaults, configurable)

```
candidates:      ≤ 100 builds
repair attempts: ≤ 2 per candidate (44)
wall clock:      ≤ N hours (config; jobs pause, not fail, on expiry — 50)
token classes:   per-stage allocation (48); strong-model quota capped
storage growth:  ≤ X GB/day soft cap → retention sweep (52) before overflow
browser:         one shared browser profile; per-candidate isolated context;
                 crash of one context never kills the batch
```

## Compute order-of-magnitude planning (for future activation)

Generation dominates cost; evaluation is mostly scripted (cheap). Therefore:
- gate order is cheap→expensive (technical before design eval, 44) so doomed
  candidates die early
- V0 fidelity + V8/V9 experiments are the only "full effort" slots by default;
  V1–V7 use the shared skeleton + focused diffs
- batch parallelism = candidates in flight (config, default 2–4), NOT
  unbounded fan-out

## Backpressure

If the review queue exceeds K unreviewed batches, generation throttles to
ingest+study only (producing review-ready backlog is worthless if review is
the bottleneck). Metric-driven, logged.
