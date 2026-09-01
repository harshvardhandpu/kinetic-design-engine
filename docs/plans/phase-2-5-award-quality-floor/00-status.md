# Status: Phase 2.5 Award-Quality Floor Calibration

- Gate 1 — Product: APPROVED WITH AMENDMENTS 2026-08-22
- Gate 2 — Base Architecture: APPROVED WITH AMENDMENTS 2026-08-22
- Gate 2 — Source-Intelligence / Source-Governance Amendment: APPROVED 2026-08-22
- Gate 3 — Program Design: APPROVED 2026-08-22
- Gate 4 — Slice Plan: APPROVED 2026-08-27
- Gate 4 — ENGINE IMPLEMENTATION READY: HUMAN APPROVED 2026-08-27
- Engine implementation: COMPLETE (S01–S21)
- Real calibration: REVIEW_READY — `case-ee9eaf0dc9` / V0 protected; V1/V2 original candidates awaiting final human comparison
- V0 lifecycle: PLANNED → … → DESIGN_EVALUATED (2026-08-30) — evidence complete, human fidelity gate approved
- V1/V2 lifecycle: PLANNED → … → REVIEW_READY (2026-09-01) — objective evidence complete, human taste/floor gate pending
- Human V0 fidelity gate: APPROVED 2026-09-01 — V0 may unlock bounded original V1/V2 slots
- Final human design/taste review: PENDING

## Slices
- [x] S01–S21 — Gate-4 engine implementation and regression proof
- [ ] Real calibration — `case-ee9eaf0dc9` / Wanaka Studio / V0 approved; V1/V2 at REVIEW_READY pending final human comparison

## Notes for a fresh session
- Baseline commit: `4e226a6705aa9fc8e5e80c7099356079c0fc14f6`.
- Canonical sandbox: `/workspace/kinetic-design-engine`.
- Preserve all Phase-2 evidence, the first immutable `REJECT_ALL` decision, its negative knowledge, and very-low-confidence TasteProfile.
- Old IZANAMI V0–V3 are immutable.
- Phase 2.5 targets the general human design-quality floor before personal taste learning.
- First calibration adds one DesignCase, one internal V0 study, and at most two original candidates; optional V3 is out of scope unless separately justified and approved.
- Human authority remains final. Cron, auto-promotion, deployment, Phase 3, broad curriculum, and global install remain off.
- Gate 2 Source-Intelligence / Source-Governance Amendment is approved at registry `0.1.2` with 27/27 unique records and hard-rights invariants passing.
- `03-program-design.md` and `04-slices.md` are the approved Gate-3/Gate-4 implementation contracts; S01–S21 are complete at `2ffc9ce771de46805c756a30cf897436cd8d4c09`.
- Gate 4 is human-approved. Real calibration initialized `case-ee9eaf0dc9` with V0; explicit HUMAN V0 FIDELITY GATE approval unlocked the bounded V1/V2 originals, now awaiting the final human taste/floor gate.
- The registry contains all 26 supplied inspiration URLs plus one separately audited UI Layouts free-repository record; none is an additional DesignCase and no raw/code/media ingestion occurred.
- Permanent rights-change invariant: subagent discovery → candidate evidence → parent reproduction/verification → rights status change. No rights are loosened from subagent self-report.
- Vision state is `VISION_CRITIC_AVAILABLE_UNVERIFIED`; `HUMAN_VISUAL_GATE` is mandatory until provider/model/route/cost/limits are proven.
- HermesVault remains read-only and unchanged; its future mirror is derived synthesis, never competing machine authority.
- Wanaka V1/V2 remain non-promoted and human-gated at REVIEW_READY; Phase 3, cron, deployment, auto-promotion, and broad Gym activation remain off pending their explicit later gates.
