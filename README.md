# KINETIC — Design Engine for Hermes Agent

**Phase 1 status: RESEARCH + ARCHITECTURE COMPLETE.**
**Phase 1.5 status: DESIGN GYM SPECIFICATION COMPLETE (docs/gym/ 30–55, schemas/gym/).**
**No production implementation. No cron jobs. No deployments.**

Canonical location: `/home/harshdev/HermesWorkspaces/kinetic-design-engine`
(sandbox path: `/workspace/home/harshdev/HermesWorkspaces/kinetic-design-engine`).

KINETIC is a source-grounded, agent-operable web experience engine. It lets Hermes
inspect an existing application, understand its design system, select reusable
design/motion capabilities, implement them safely, visually evaluate the result,
map feedback back to source code, repair the implementation, and retain proven
patterns.

> KINETIC is NOT: a component dump, an animation library, a Framer clone, a template,
> a monolithic framework package, or a prompt collection. See `docs/00-vision.md`.

## The loop

```
UNDERSTAND → DESIGN → IMPLEMENT → RENDER → INSPECT → ANNOTATE/EVALUATE
    → MAP TO SOURCE → REPAIR → VERIFY → LEARN
```

## Six layers

| # | Layer | Spec |
|---|-------|------|
| 1 | Design Intelligence (scanner, surface classification) | `docs/10-project-scanner.md` |
| 2 | Experience Registry (source-owned installables) | `docs/06-registry-design.md` |
| 3 | Transformation Planner (jobs, options, K-levels) | `docs/04-hermes-closed-loop.md`, `docs/09-experience-levels.md` |
| 4 | Implementation Adapters (stack-neutral) | `docs/17-stack-adapters.md` |
| 5 | Visual Feedback / Inspection | `docs/11-visual-feedback-protocol.md`, `docs/12-motion-inspector.md` |
| 6 | Evaluation + Repair Loop | `docs/13-evaluator.md`, `docs/04-hermes-closed-loop.md` |

## Repository map (Phase 1 = specs only)

```
docs/       00–24 architecture documents
schemas/    PrimitiveManifest, RecipeManifest, KineticJob, VisualFeedback,
            EvaluationResult, ProjectDesignProfile (JSON Schema drafts)
knowledge/  source-derived findings (see docs/01, docs/02)
hermes/     SKILL-DRAFT.md + integration-spec.md (DRAFT ONLY — not installed
            into live Hermes; future home: ~/.hermes/skills/kinetic-design-engine)
```

## Evidence discipline

Every material claim is tagged:

- **Classification:** `SOURCE-DERIVED` (observed) · `ENGINE-INFERENCE`
  (abstraction from observations) · `ENGINE-RECOMMENDATION` (KINETIC should
  support it, not directly demonstrated)
- **Inspection quality:** `DIRECTLY-INSPECTED` (DOM/code/docs read) ·
  `VISUALLY-INSPECTED` (screenshot-level) · `TEXT-ONLY` · `METADATA-ONLY` ·
  `SECONDARY-SOURCE` · `INACCESSIBLE`

Source inventory and access status: `docs/01-source-inventory.md`.
Per-source analysis: `docs/02-source-analysis.md`.

## Phase 1 execution rules honored

Research, inspection, architecture, schemas, protocols only. Not built: engine
runtime, registry CLI, primitive library, inspector, evaluator, Hermes core
changes, GitHub pushes. See `docs/24-v0.1-roadmap.md` for the recommended
Phase-2 proof scope.

## Infrastructure note (2026-08-21)

Canonical host location `/home/harshdev/HermesWorkspaces/kinetic-design-engine`
was NOT mountable from the Docker sandbox during Phase 1
(`terminal.docker_mount_cwd_to_workspace` disabled; no `docker_volumes` entry).
Phase-1 artifacts were staged at `/root/kinetic-design-engine` inside the
sandbox (host-backed persistent bind mount, same class as the proven-persistent
aether-site mount). **Action required before Phase 2:** add the host workspace
to `terminal.docker_volumes` and move this tree into it. See final report §Risks.
