# KINETIC Phase 2 — Completion Report

**Date:** 2026-08-22 · **Runtime:** `qwen/qwen3.8-max-free` via `tokenrouter` · **KINETIC version:** 0.2.0-phase2
**Final commit:** `e9f9486` · **Canonical workspace:** `/home/harshdev/HermesWorkspaces/kinetic-design-engine`
**Phase goal:** Prove that the KINETIC application loop and learning loop execute correctly end-to-end on a deliberately tiny corpus.

---

## 1. Implementation inventory

| Component | Location | Status |
|---|---|---|
| 8 primitives | `engine/core/primitives/` | reveal-stagger, marquee, scroll-progress (+slide-x mode), hover-lift, scramble-text, page-transition, cursor-glow, grid-reveal |
| 3 recipes | `engine/recipes/` | hero-cinematic, deck-bento, statement-scroll |
| Installer + receipts | `engine/cli/install.mjs` | copy-source model, `.kinetic/installed.json` receipts (manifest-path bug fixed) |
| Scanner | `engine/cli/scan.mjs` | ProjectDesignProfile |
| Resolver | `engine/cli/resolve.mjs` | element→kinetic-id→receipt→component→source (recipe→primitive traversal fixed) |
| Evaluator gates | `engine/evaluator/gates.browser.js` | technical/responsive/a11y/performance + clip-aware escaping + interaction_blockers rule |
| Originality | `engine/evaluator/originality.browser.js` + `originality-compare.mjs` | fingerprint + 7-dimension comparator |
| Runner | `engine/runner/run.mjs` | checkpointed, idempotent, advisory-locked state machine + Amendment-F receipts |
| Inspector | `engine/inspector/inspect.browser.js` | defect detection (Test 3) |
| SKILL.md | `hermes/SKILL.md` | Phase-2 validated, local-only (not globally installed) |

## 2. Tests and exact results

| Test | Name | Result | Evidence |
|---|---|---|---|
| 1 | Install | PASS | 2 recipes → playground, receipt written |
| 2 | Traceability | PASS | element→kinetic id→receipt→component→source, high confidence |
| 3 | Feedback repair | PASS | injected threshold defect → 4 invisible-stuck → inspector → resolver → patch → 0 issues |
| 4 | Regression safety | PASS | counter/echo/flag/theme functional post-install |
| 5 | Reduced motion | PASS | 4/4 primitives → done-reduced-motion, content visible |
| 6 | Learning case | PASS | IZANAMI: study→V0→V1-V3→qualification→comparison package→AWAITING_HUMAN_VISUAL_DECISION |
| 7 | Negative learning | PASS | interaction-blocking veil REJECTED; gates false-negative proven; prevention rule added + verified bidirectionally |
| 8 | Experiment | PASS | Gravity Well (cursor-glow as discovery mechanic), ExperimentRecord, NOT promoted |
| 9 | Kill/resume | PASS | correct-stage resume, dead-lock reclaim w/ logged takeover, idempotency, receipt hash unchanged |
| 10 | Promotion dry-run | PASS | schema-valid PromotionCandidate (evaluator-rule), status=proposed, no acceptance/merge/core mutation |
| 11 | CONTROL vs KINETIC | PASS (partial uplift) | identical gates both arms; KINETIC adds reduced-motion + traceability; aesthetic NOT proven |
| 12 | Held-out generalization | PASS (technical) | KINETIC transfers to unseen product-launch domain; originality 0.14 vs Radian; isolation 4/4 |

**Final regression:** playground 8/8 kinetic elements, baseline intact, updated gates green, no false positives.

## 3. Three learning DesignCases

| Case | Reference | K-level | Stack | File |
|---|---|---|---|---|
| case-fe653973ef | IZANAMI (izanami-official.com) | K4 | GSAP+ScrollTrigger+Lenis+Three (bundle-verified) | `gym/corpus/cases/case-fe653973ef.json` |
| case-6f67d60006 | PP Neue Montreal (neuemontreal.com) | K3 | Framer+Lottie | `gym/corpus/cases/case-6f67d60006.json` |
| case-77a4f7b7b5 | MONOLOG (bymonolog.com) | K3 | Webflow+GSAP+SplitText+Three+Lenis | `gym/corpus/cases/case-77a4f7b7b5.json` |

Holdout: case-98d4bd4196 (Radian) — sealed until Test 12, then released (`BENCHMARKED_RELEASED`).

## 4. Variant inventory

10 learning builds (cap 15, no filler):

| Case | V0 | V1 | V2 | V3 | V4 |
|---|---|---|---|---|---|
| IZANAMI | BUILT (fidelity) | TECHNICAL_PASS (0.093) | TECHNICAL_PASS (0.161) | TECHNICAL_PASS (0.078) | SKIPPED (no distinct hypothesis) |
| Neue Montreal | BUILT (fidelity) | TECHNICAL_PASS (0.028) | SKIPPED | SKIPPED | — |
| MONOLOG | BUILT (fidelity) | TECHNICAL_PASS (0.044) | SKIPPED | SKIPPED | — |

Plus non-count fixtures: v-neg (Test 7 rejected), v-exp (Test 8 experiment), test11 control+treatment, test12 holdout-variant.
All V1+ originals: originality PASS-distinct, copy=0, asset_reuse=0. All design gates: `pending-vision-or-human`.

## 5. Human TasteDecisions

**0 decided.** 1 batch prepared and awaiting human review:
- `gym/runs/case-fe653973ef/taste-decision-batch1.json` — status `AWAITING_HUMAN_VISUAL_DECISION`
- Review package: `gym/runs/case-fe653973ef/review-package.html` (V1/V2/V3 with links + originality table)
- No winner/runner-up/design_quality/human_preference fabricated (human-review rule honored).

## 6. Negative knowledge created

1 record: `gym/knowledge/negative/nk-test7-interaction-veil.json`
- **Failure class:** interaction-blocking-overlay (undismissed full-screen veil)
- **Key finding:** all 4 deterministic gates PASS on a completely unusable page → structural gates have a proven false-negative class for behavioral defects (validates Amendment G)
- **Prevention rule:** `rule-interaction-blocker-gate` implemented in evaluator; verified FAILs defective candidate, no false positives on clean variants

## 7. Experiment record

`gym/knowledge/experiments/exp-test8-gravity-well.json`
- **Hypothesis:** cursor-glow can be a discovery mechanic (spotlight reveals hidden text), not just decoration
- **Novelty:** first non-decorative use of cursor-glow in the corpus
- **Result:** 4/4 gates pass; design pending-vision-or-human; known limitations (no touch/keyboard path)
- **promotion_candidate:** false (AUTO_PROMOTION=OFF)

## 8. Kill/resume evidence

`gym/knowledge/test-evidence/test9-killresume.json` — 5/5 checks PASS:
correct resume stage (BUILT→TECHNICAL_PASS) · dead-lock reclaim · idempotency (no duplicate artifacts, attempt stays 1, receipt preserved) · receipt hash unchanged · takeover_of logged.

## 9. Promotion dry-run evidence

`gym/knowledge/test-evidence/test10-promotion-dryrun.json` + `gym/knowledge/promotions/promo-20260822-interactionblockers.json`
- Schema-valid PromotionCandidate (kind=evaluator-rule), status=`proposed`
- Thresholds: zero-regression evidence YES; explicit human acceptance NO (correctly blocks advancement)
- Stable core NOT modified; nothing promoted; nothing merged

## 10. Control-vs-KINETIC results

`gym/experiments/test11/comparison.json` (brief: KŌAN tea-ceremony studio; same model/provider/brief/gates):

| Dimension | CONTROL | TREATMENT | Delta |
|---|---|---|---|
| Deterministic gates | 4/4 pass | 4/4 pass | none |
| Reduced-motion compliance | ABSENT | PRESENT (primitive contract) | **KINETIC win** |
| Traceability/receipts | none | full | **KINETIC win** |
| will_change | 1 | 0 | KINETIC win |
| Build steps | 1 | 3 | control cheaper |
| Design quality | pending-vision-or-human | pending-vision-or-human | NOT MEASURABLE |

Both arms carry Amendment-F receipts (`control/receipt.json`, `treatment/receipt.json`).

## 11. Held-out benchmark result

`gym/knowledge/test-evidence/test12-holdout-generalization.json`
- **Pre-unseal isolation:** 4/4 PASS (sealed file, never retrieved, absent from recipes/principles/knowledge, no runs/taste decisions)
- **Task:** original product-launch page in Radian's domain using ONLY learning-corpus knowledge → VELA M-1 (fictional electric outboard)
- **Result:** 4/4 gates pass; originality vs Radian = 0.14 PASS-distinct (copy=0, assets=0, section_order=0)
- **Verdict:** PASS (technical) — KINETIC generalizes to an unseen domain. Design generalization not proven (text-only).
- Holdout released per Amendment B; full Radian DesignCase deferred to Phase 2.5.

## 12. Resource/cost measurements

- **free_model_completion:** 1.0 — 100% of Phase 2 on `qwen/qwen3.8-max-free`
- **cost_per_qualified_candidate:** NOT_MEASURABLE_THIS_RUN (no token/cost metering exposed by tokenrouter)
- **time_per_qualified_candidate:** NOT_MEASURABLE_THIS_RUN (no per-variant duration instrumentation)
- **Caps enforced:** MAX_PARALLEL_AGENTS=2 (used 1), MAX_REPAIR_ATTEMPTS=3 (max reached 1), CRON=OFF, AUTO_PROMOTION=OFF, PRODUCTION_DEPLOYMENT=OFF
- **Builds:** 10/15 cap. **Infra incident:** /tmp (512MB tmpfs) filled by npm cache → server death; cleared, moved to port 8795.

## 13. Visual/source-resolution accuracy

- Resolver: high-confidence element→source resolution in Test 2 + all variant receipts; zero guess-patches.
- Full accuracy % NOT_MEASURABLE_THIS_RUN — requires a vision-driven defect-localization benchmark; text-only runtime cannot produce visual defects to localize.
- Vision status: active model is text-only; `browser_vision` unavailable for aesthetic evaluation. All design gates correctly `pending-vision-or-human`.

## 14. Failures and lessons

1. **/tmp exhaustion** — npm cache filled the 512MB tmpfs, silently killing HTTP servers. Lesson: check `/tmp` before browser tests; prefer persistent cache locations.
2. **Evaluator false positives** — horizontal-scroll tracks flagged as "escaping" (15 on V2). Lesson: clip-aware escaping check added (root cause fixed in shared evaluator).
3. **Gates false negative** — unusable page passed all structural gates (Test 7). Lesson: behavioral defects need dedicated heuristics (interaction_blockers) + human/vision review; gates alone ≠ usable.
4. **Installer manifest path** — registry manifests live under `registry/`, not `engine/`. Fixed once, shared.
5. **Receipt metadata** — initially guessed primitive versions (0.1.0); actual install receipt said 1.0.0. Lesson: read the receipt, never guess (Amendment F).
6. **Browser console flakiness** — async/network evals and occasional backend errors; recovered via navigation reset + synchronous inline expressions.

## 15. Architecture changes from Phase 1/1.5

- `scroll-progress` gained `slide-x` mode (horizontal scroll-driven translation).
- Evaluator gained clip-aware escaping + `interaction_blockers` check (from negative knowledge).
- Runner proven as the durable learning-loop backbone (kill/resume, locks, receipts) — no schema changes needed.
- SKILL.md promoted from DRAFT to Phase-2 validated (local-only).
- No changes to Phase-1.5 schemas, gym docs, or the promotion-gate model. Stable KINETIC core untouched (promotion dry-run stayed a simulation).

## 16. Recommended Phase 2.5 scope

1. **Human visual review pass** — decide the pending IZANAMI batch (first real TasteDecision), unblocking `first_shot_preference_rate` and DESIGN_QUALIFIED states.
2. **Vision-capable evaluator** — attach a vision model or human loop so design qualification stops being the universal blocker.
3. **Cost/time instrumentation** — meter tokens and wall-clock per candidate to fill the two NOT_MEASURABLE metrics.
4. **Radian DesignCase** — now released; analyze and add to corpus.
5. **Host-side mount reduction** (Amendment A) — still requires host config; sandbox cannot self-narrow.
6. **Promotion decision** — human acceptance/rejection of `promo-20260822-interactionblockers`.
7. **Controlled global skill install** — after human review confirms the loop's value.

---

## The uplift question

> **Did KINETIC demonstrably improve the output of the same model compared with the no-KINETIC baseline?**

**PARTIALLY YES — proven on process dimensions; NOT YET DETERMINED on aesthetics.**

- **Proven (evidence-backed):** With the same model, provider, brief, and gates, KINETIC delivered reduced-motion accessibility compliance the control lacked, full traceability + reproducibility receipts the control lacked, and cleaner compositing (0 vs 1 will_change) — without degrading any deterministic gate. Held-out generalization (Test 12) further shows KINETIC's knowledge transfers to an unseen domain.
- **Pending (cannot be proven here):** Whether KINETIC produces a *better-looking* result. This runtime is text-only; no vision or human has judged either arm. Per Amendment G, no aesthetic claim is made. The pending IZANAMI TasteDecision batch is the path to answering this.

**STOPPED after Phase 2.** Phase 2.5 not started. No cron, no deployment, no push, no auto-promotion.
