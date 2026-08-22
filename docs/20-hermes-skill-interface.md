# 20 — Hermes Skill Interface

DRAFT ONLY. Nothing here is installed into live Hermes during Phase 1. Future
home: `~/.hermes/skills/kinetic-design-engine` (see `hermes/SKILL-DRAFT.md`).

## Intent translation

The skill translates natural language into a structured **KineticJob**
(`schemas/kinetic-job.schema.json`) and then drives the closed loop (`04`).

Example mappings:

| User says | Job fields set |
|---|---|
| "Use KINETIC on this repository" | scan-only job: `scope: audit`, no implementation |
| "Upgrade the landing page to K3" | `target: route:/`, `surface: decide-learn` (confirmed by scanner), `kinetic_level: K3`, options mode on |
| "Keep application logic untouched" | `protected_areas: [product-core]` (already default; made explicit) |
| "Use the DesignLab references" | `references: [S1 principles]` → knowledge query bias |
| "Make this interaction feel more tactile" | `goals: [tactile-feedback]`, scope narrowed to the indicated element (inspector feedback or selector), K-level unchanged |
| "Inspect the running page and fix visual problems" | `scope: inspect-repair`: run evaluator → repair loop, no new installs |
| "Apply K2 to the dashboard, but only functional motion" | `kinetic_level: K2`, `motion_purpose_filter: functional` |
| "Show me three hero directions" | `options_mode: three`, `implementation_mode: none` (plan only) |
| "Use the particle-sphere concept but keep mobile lightweight" | `references: [S6]`, primitive hint `particle-sphere`, `mobile_policy: simplify-or-static` |

## KineticJob schema (summary — full JSON Schema in `schemas/`)

```jsonc
{
  "schema": "kinetic/job@0.1",
  "id": "…", "created": "…",
  "target": { "repo": "/path", "routes": ["/"], "elements": ["[data-kinetic-id=…]"] },
  "scope": "audit | plan | implement | inspect-repair | full-loop",
  "surface": { "declared": "decide-learn", "detected": "decide-learn", "confidence": "high" },
  "aether_level": "A3 | null",          // context only (doc 19)
  "kinetic_level": "K3",                 // ceiling (doc 09)
  "goals": ["…"],                        // free text, planner-interpreted
  "references": ["S1", "S6", "url:…"],   // knowledge bias, never clone permission
  "protected_areas": ["product-core", "src/billing/**"],
  "performance_budget": { "fps_floor": 50, "max_p4": 0 },
  "accessibility_policy": { "reduced_motion": "first-class", "wcag": "AA" },
  "implementation_mode": "registry-install | inline-edit | none",
  "approval_mode": "strict | permissive",  // strict = gate every install/dep/level change
  "options_mode": "none | three",
  "iteration_cap": 3
}
```

## Skill behavior contract

1. **Scan before speak.** Any job starts with Stage 1–3 (`04`); the skill never
   proposes effects for an unscanned project.
2. **Options before commitment** for meaningful redesigns (`04` stage 6).
3. **Approval gates are conversational** — the skill presents the KineticJob
   summary + diffs at each gate in plain language.
4. **Evidence on request** — every recommendation can show its source tag
   (`01` classification) and the evaluator findings behind it.
5. **Stop discipline** — the skill reports blocked/degraded states honestly
   (missing stack adapter, inaccessible dev server, gate failures) rather than
   guessing forward.

## Out of scope for Phase 1

Production SKILL.md installation, MCP tooling, webhook delivery. Phase 2 may
add a *draft* skill file inside the KINETIC repo for testing against a
playground project only — still not installed into live Hermes.
