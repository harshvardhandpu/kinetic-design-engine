# KINETIC Design Engine — Hermes Skill (DRAFT)

> **STATUS: DRAFT ONLY.** Not installed into live Hermes during Phase 1.
> Future home: `~/.hermes/skills/kinetic-design-engine`.
> Do not copy this file into `~/.hermes/skills/` until Phase 2 approval.

---
name: kinetic-design-engine
description: "Source-grounded web experience engine: scan project, plan motion/design upgrades, install registry primitives, inspect visually, repair from structured feedback."
version: 0.0.1-draft
---

# When to use

Use when the user asks to improve, upgrade, or repair the **visual experience**
(layout, motion, interaction, transitions) of an existing web project — e.g.:

- "Use KINETIC on this repository."
- "Upgrade the landing page to K3."
- "Make this interaction feel more tactile."
- "Inspect the running page and fix visual problems."
- "Apply K2 to the dashboard, but only functional motion."
- "Show me three hero directions."

Do NOT use for backend/API/data changes — KINETIC never touches product core
(docs/18-product-core-protection.md).

# Operating loop (mandatory order)

1. **Scan** the target repo (read-only) → ProjectDesignProfile
   (schemas/project-design-profile.schema.json). Classify surfaces; build the
   three-zone map (product core / design system / experience layer).
2. **Query knowledge** (knowledge/, docs/03) for posture + anti-patterns; then
   **query registry** (registry/) for eligible items filtered by framework,
   surface, K-level, performance class.
3. **Plan**: produce a KineticJob (schemas/kinetic-job.schema.json). For
   meaningful redesigns produce THREE directions (CONSERVATIVE / STRONG-FIT /
   DIVERGENT) differing in composition or interaction philosophy — never three
   recolors.
4. **Approval gate** before any write: show job summary, files to touch, deps
   to add.
5. **Implement** via registry install (copy source, map tokens, write receipt
   `.kinetic/installed.json`). Experience layer only.
6. **Run + inspect**: dev server; collect VisualFeedback
   (schemas/visual-feedback.schema.json) from human inspector and/or evaluator.
7. **Resolve to source** (kinetic-id → receipt → file:range; confidence ≥ 0.7
   or probe again — never patch on a guess).
8. **Patch → re-render → quality gates** (regression contract + evaluator).
   Max 3 repair cycles per item, then escalate.
9. **Report** with receipts; optionally capture lessons (docs/21).

# Hard rules

- Product core is read-only. Ambiguous path = product core.
- K-level is a ceiling, not a quota; surface type gates eligibility.
- Motion must be functional/expressive/decorative-classified; decorative gets
  lowest budget and drops first.
- Reduced motion is a first-class variant on everything installed.
- No raw animation constants — kinetic.* tokens only.
- Every claim about a reference source carries its evidence tag
  (knowledge/sources/source-index.json).
- Report blocked/degraded states honestly; never fabricate results.

# Key files

- docs/04-hermes-closed-loop.md — stage contracts
- docs/06-registry-design.md — install semantics
- docs/11-visual-feedback-protocol.md — feedback + resolution
- docs/13-evaluator.md — automated checks + slop diagnostic
- schemas/ — all machine contracts
