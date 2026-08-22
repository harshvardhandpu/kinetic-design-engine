---
name: kinetic-design-engine
description: "Source-grounded web experience engine: scan project, plan motion/design upgrades, install registry primitives, inspect visually, repair from structured feedback. Phase-2 loop proven end-to-end."
version: 0.2.0-phase2
---

# KINETIC Design Engine — Hermes Skill

> **STATUS: Phase-2 validated.** Application loop + learning loop proven end-to-end
> on a tiny corpus (Tests 1–12 PASS). Local/test integration only — NOT installed
> globally into `~/.hermes/skills/` yet (Phase 2.5 decision).

# When to use

Use when the user asks to improve, upgrade, or repair the **visual experience**
(layout, motion, interaction, transitions) of an existing web project — e.g.:

- "Use KINETIC on this repository."
- "Upgrade the landing page to K3."
- "Make this interaction feel more tactile."
- "Inspect the running page and fix visual problems."
- "Show me three hero directions."

Do NOT use for backend/API/data changes — KINETIC never touches product core
(docs/18-product-core-protection.md).

# Operating loop (mandatory order)

1. **Scan** the target repo (read-only) → ProjectDesignProfile.
   `node engine/cli/scan.mjs --target <dir>`
2. **Query knowledge** (knowledge/, docs/03-design-principles.md) for posture + anti-patterns; then
   **query registry** (registry/) for eligible items filtered by framework,
   surface, K-level, performance class.
3. **Plan**: produce a KineticJob. For meaningful redesigns produce THREE
   directions (CONSERVATIVE / STRONG-FIT / DIVERGENT) differing in composition
   or interaction philosophy — never three recolors.
4. **Approval gate** before any write: show job summary, files to touch, deps.
5. **Implement** via registry install (copy source, map tokens, write receipt).
   `node engine/cli/install.mjs --target <dir> --items kinetic.<id>[,...] --tokens k=v[,...]`
   Receipt lands at `<dir>/.kinetic/installed.json`. Experience layer only.
6. **Run + inspect**: dev server; collect VisualFeedback from human inspector
   and/or the deterministic gate suite.
7. **Resolve to source** (kinetic-id → receipt → file:range; confidence ≥ 0.7
   or probe again — never patch on a guess).
   `node engine/cli/resolve.mjs --target <dir> --id kinetic.<id>`
8. **Patch → re-render → quality gates** (regression contract + evaluator).
   Max 3 repair cycles per item, then escalate.
9. **Report** with receipts; optionally capture lessons (docs/21-memory-learning-loop.md).

# Deterministic gates (evaluator)

Inject `engine/evaluator/gates.browser.js` into the rendered page. It returns
technical / responsive / a11y / performance gates plus:
- `interaction_blockers` — flags undismissed full-screen overlays (Test-7 rule).
- `design` is ALWAYS `pending-vision-or-human` — the evaluator never produces
  aesthetic judgment (Amendment G). Design qualification requires vision-capable
  or human review.

# Originality gate (V1+ originals)

Capture a candidate fingerprint with `engine/evaluator/originality.browser.js`,
then compare against the reference fingerprint:
`node engine/evaluator/originality-compare.mjs --ref <ref.json> --candidate <cand.json>`
Verdict `PASS-distinct` required before an original variant is promotable.
V0 fidelity studies are exempt but `deployable:false` and never published.

# Learning loop (runner)

`node engine/runner/run.mjs <init-job|init-case|next|record|gate|receipt|status>`
- Checkpointed, idempotent, advisory-locked state machine under `gym/runs/`.
- `next` returns the correct resume point after any interruption (Test 9).
- `receipt` writes the Amendment-F reproducibility receipt per variant.
- Terminal states (QUALIFIED/REJECTED/EMPTY) are append-only no-ops on re-record.

# Hard rules

- Product core is read-only. Ambiguous path = product core.
- K-level is a ceiling, not a quota; surface type gates eligibility.
- Motion must be functional/expressive/decorative-classified; decorative gets
  lowest budget and drops first.
- Reduced motion is a first-class variant on everything installed (primitives
  carry the contract — verified Test 5 + Test 11).
- No raw animation constants — kinetic.* tokens only.
- Every claim about a reference source carries its evidence tag
  (knowledge/sources/source-index.json).
- Report blocked/degraded states honestly; never fabricate results.
- Never claim aesthetic PASS without vision/human evidence.
- Held-out references stay sealed until their benchmark runs (Amendment B).

# Key files

- docs/04-hermes-closed-loop.md — stage contracts
- docs/06-registry-design.md — install semantics
- docs/11-visual-feedback-protocol.md — feedback + resolution
- docs/13-evaluator.md — automated checks + slop diagnostic
- docs/gym/53-promotion-gate.md — promotion evidence thresholds
- engine/cli/{scan,install,resolve,gen-manifests}.mjs — working CLI
- engine/evaluator/{gates.browser.js,originality-compare.mjs} — gates + originality
- engine/runner/run.mjs — checkpointed learning-loop state machine
- schemas/ — all machine contracts
