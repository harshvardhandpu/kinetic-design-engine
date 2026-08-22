# KINETIC × Hermes — Integration Spec (Phase-1 draft)

How KINETIC eventually plugs into Hermes without touching Hermes core.

## Integration surface (future, post-Phase-2)

1. **Skill** — `~/.hermes/skills/kinetic-design-engine` (SKILL-DRAFT.md).
   Natural language → KineticJob → loop orchestration. Hermes' existing
   terminal/file/browser tools do the actual work; KINETIC supplies contracts.
2. **Kanban** — large KINETIC jobs decompose into board tasks (scan → plan →
   implement → verify) using Hermes' native kanban workflow; each stage's
   artifact (profile, job, feedback, evaluation) is the handoff payload.
3. **Memory/learning** — accepted lessons sync via a persistence adapter
   (docs/21) into Hermes' canonical knowledge store; KINETIC core stays
   backend-neutral.
4. **Computer-use / browser tools** — Hermes' browser tooling drives the
   run/inspect stages (dev server navigation, DOM probes, evaluator scripts);
   the inspector's file-drop export needs nothing beyond file reads.

## What KINETIC requires from Hermes (none of it core changes)

- Terminal access to target repo + dev server lifecycle.
- File read/write inside target repo (experience layer) and KINETIC repo.
- Browser automation for render/inspect (any Hermes browser surface).
- Approval-gate conversation turns (existing clarify/human-in-loop behavior).

## What Phase 1 deliberately did NOT do

- No files created/modified under `~/.hermes/` (live skills, config, core).
- No MCP server registered.
- No cron jobs, no kanban automation wired.

## Phase-2 integration experiments (proposed, need approval)

- Run the SKILL-DRAFT against the playground from a scratch Hermes profile.
- Validate feedback file → patch → gate cycle with Hermes doing the patching.
- Measure "guessing reduction": count of resolution probes per feedback item
  across iterations (the prime directive's metric, docs/00).
