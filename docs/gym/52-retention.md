# 52 — Retention Classes

Durations are CONFIG (`gym/retention.json`); these are the classes and defaults.

| Class | Contents | Default retention |
|---|---|---|
| WINNER | selected variant: source, brief, eval, decision, receipts | permanent |
| HIGH-VALUE RUNNER-UP | runner-up + close candidates; V0 fidelity reports + key captures | 2 years, reviewable |
| USEFUL EXPERIMENT | ExperimentRecord + minimal source to reproduce | metadata permanent; build artifacts 1 year |
| FAILED LEARNING | negative-knowledge entries + compact evidence (1–2 captures, diagnosis) | metadata permanent; captures 180 days |
| CASE CORE | DesignCase JSON + study captures + pairs | permanent (the corpus) |
| BUILD CACHE | node_modules, build output, intermediate captures, full trace dumps | 14 days or until sweep |

## Rules

1. **Metadata outlives blobs.** Sweeps delete heavy artifacts, keep the record
   pointing at their former sha256 (`artifact: swept`). Knowledge survives
   storage pressure.
2. **Sweeps are a job** (part of weekly maintenance), never inline deletes;
   they respect locks and never touch WINNER/CASE CORE.
3. **Promotion upgrades retention:** anything referenced by an
   EngineEvolutionRecord becomes permanent automatically.
4. **Legal floor:** proprietary reference assets are never stored beyond study
   necessity (32, 36); sweeps prioritize deleting them first.
5. **Deletion is logged** (what, when, why, freed bytes) — retention is
   auditable like promotion.
