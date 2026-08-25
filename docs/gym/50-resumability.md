# 50 — Resumability & Job Contracts

A 100-candidate/day pipeline WILL hit quota exhaustion, provider failure,
browser crashes, container restarts. Every job is designed to be killed at any
point and resumed without loss or duplication.

## Universal job record (schema: `schemas/gym/curriculum-job.schema.json`)

```yaml
job_id: <type>-<date>-<seq>
type: CorpusIngest|ReferenceStudy|VariantGeneration|Evaluation|ExperimentLog|
      HumanReviewPrep|TasteConsolidation|ToolResearch|PatternClustering|
      FailureAnalysis|RecipeCandidate|EnginePromotionReview
status: pending|running|paused|done|failed|blocked
schedule_ref: <future cron id; NOT activated in Phase 1.5>
input: {...}                  # immutable after start
checkpoint: {...}             # last durable progress point
work_items: [{id, state, attempts, last_error, receipt_ref}]
lock: {holder, acquired_at, heartbeat_at, ttl}
budget: {tokens_class, max_candidates, wall_clock}
provider_notes: []            # failover events, model swaps (48)
```

## Checkpointing rules

1. **Work-item granularity.** State is tracked per item (case, candidate,
   gate), never per job-blob. Resume = re-enqueue items not in a terminal state.
2. **Terminal states are durable before acknowledgment.** A candidate is
   `QUALIFIED` only after the record + artifacts are fsync'd. Crash between
   build and record → rebuild (idempotent), never phantom-qualified.
3. **Idempotency keys:** ingest keyed by canonical URL hash; generation by
   (case_id, slot, attempt); evaluation by (run_id, gate, rules_version).
   Re-running a completed key is a no-op returning the stored receipt.
   Changed content under the same key yields `KINETIC_ARTIFACT_MISMATCH`.
4. **Locks:** file locks per job type + per case (`gym/jobs/locks/`), TTL +
   heartbeat; stale locks (dead holder) are reclaimable with a logged takeover.
   Two sessions never write one case simultaneously.
5. **Retry policy per error class:**
   - transient (network, browser crash): retry ≤3, backoff
   - quota/provider: failover via Hermes routing; if no provider left →
     `paused` (NOT failed), auto-resume next window
   - deterministic (bad input, schema violation): `blocked` + diagnosis for
     human; never retry-loop
6. **Artifact receipts:** every produced file lands content-addressed with a
   receipt (sha256, producer, job_id) — resume verifies receipts instead of
   trusting directory listings.

## Phase-2.5 resume map (`run.mjs next` / `resumePlan`)

| Durable state | Next unmet guard | Notes |
|---|---|---|
| `PLANNED` | `BRIEF_VALIDATED` / validate brief | |
| `BRIEF_VALIDATED` | `RETRIEVAL_PROVEN` / retrieve | reuse brief hash |
| `RETRIEVAL_PROVEN` | `PREBUILD_APPROVED` / prebuild | no repeated source fetch |
| `PREBUILD_APPROVED` | `BUILDING` / build | upstream fixed by hash |
| `BUILDING` | `BUILT` / complete build | never claim BUILT from files alone |
| `BUILT` | `TECHNICAL_EVALUATED` / technical eval | |
| `TECHNICAL_EVALUATED` (qualified) | `VISUAL_CAPTURED` / capture missing specs | |
| `TECHNICAL_EVALUATED` (failed) | wait / repair_or_reject | `retry --from TECHNICAL_EVALUATED` |
| `VISUAL_CAPTURED` | `DESIGN_EVALUATED` / design eval | reuse capture hashes; no vision re-call if receipt valid |
| `DESIGN_EVALUATED` | `REVIEW_READY` / loss + package | |
| `REVIEW_READY` | **wait** / `human_review_wait` | never recapture, never model, never decision regen |
| `HUMAN_REVIEWED` | terminal | import only via `record-human-review` |

`advance` never transitions to `HUMAN_REVIEWED`. Human outcomes stay create-exclusive
(`writeTasteDecisionExclusive`); corrections require `supersedes`.

Capture resume (S13/T20): only missing specs run; matching spec+hash reuses the entry.
Registry and protected IZANAMI evidence hashes must remain unchanged across resume.

## Schedule (SPECIFIED, NOT ACTIVATED)

```
daily:   CorpusIngest → ReferenceStudy → VariantGeneration → Evaluation
         → ExperimentLog → HumanReviewPrep
weekly:  TasteConsolidation · ToolResearch · PatternClustering ·
         FailureAnalysis · RecipeCandidate
per-cycle: EnginePromotionReview (human-triggered or monthly)
```

Activation is a Phase-2+ decision with explicit user approval; Phase 1.5
delivers only the contracts above. Jobs must also run ONCE manually (the
Phase-2 proof runs them by hand, `docs/gym/55`).
