# 45 — Human Review & Deployment Gate

SPECIFIED, not built. The review surface is a future local UI (likely a static
report page generated per batch — no server required).

## Review queue contract

For each reference in a batch, the reviewer sees:

```
reference (case summary + link + study screenshots)
V0 (fidelity study, clearly labeled, with fidelity_report)
V1–V9 qualified candidates (empty slots shown with diagnosis)
per candidate: desktop+mobile captures, interaction/motion replay,
               evaluation summary (by producer), experiment badges,
               performance + a11y summaries
```

## Review actions

- side-by-side comparison (2–4 candidates)
- pairwise mode (A vs B with reason tags) → TasteDecision rows (42)
- winner selection / runner-up / reject-with-reasons → TasteDecision (41)
- "none qualify" → recorded, triggers batch-level diagnosis
- pin candidate for deployment consideration

## Efficiency rules

- review is OPTIONAL per batch; unreviewed batches age out to
  `not_reviewed` (41) — the pipeline never blocks on humans
- queue ordered by expected information gain (close taste-profile cells first)
- a batch review should cost minutes, not hours: defaults pre-filled from
  evaluator ranking; human adjusts, not transcribes

## Deployment gate (hard sequence)

```
generate → evaluate → human review → USER SELECTS
→ Hermes prepares deployment (build checks, env check)
→ deployment checks (Phase-1 regression contract, docs/18)
→ Vercel preview (preview URL only, human inspects)
→ EXPLICIT production approval → deploy
```

- nothing deploys without the explicit final approval
- **V0 is never deployable** (36) — the gate refuses it structurally
- deploying a V1–V9 variant as production work requires the case's
  asset-replacement proof: no proprietary assets from the reference remain
  (checked against the case's asset inventory)
- deployment is an APPLICATION-LOOP action; the Gym only hands over a
  qualified, approved candidate + its receipts
