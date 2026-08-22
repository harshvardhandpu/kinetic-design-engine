# 31 — Design Gym Architecture

The Gym is a set of durable data stores + job contracts + gates, operated by
Hermes. It is NOT a service, NOT a daemon, NOT a web app in Phase 1.5. Every
subsystem is a schema'd artifact on disk that any Hermes session (any model) can
read and continue.

## Layout (adds to Phase-1 repo, `docs/22-architecture.md`)

```
kinetic-design-engine/
├── gym/
│   ├── corpus/
│   │   ├── source-policies.json      # per-source access policy (validated)
│   │   ├── cases/                    # one DesignCase JSON per reference
│   │   └── index.json                # case registry: id, url-hash, status, tags
│   ├── runs/
│   │   └── <case_id>/                # VariantRun records + build receipts
│   ├── experiments/                  # ExperimentRecord JSONs
│   ├── taste/
│   │   ├── decisions/                # TasteDecision JSONs (append-only)
│   │   └── profile.json              # current TasteProfile (versioned)
│   ├── negative/                     # negative-knowledge entries
│   ├── tools/                        # ToolKnowledge entries
│   ├── jobs/                         # CurriculumJob checkpoints + locks
│   └── artifacts/                    # content-addressed (sha256) screenshots/traces
├── schemas/gym/                      # Phase-1.5 schemas
└── docs/gym/                         # this document set
```

DesignCases are **index + pointers**, never giant blobs; heavy artifacts live
content-addressed under `gym/artifacts/` (`docs/gym/51-resource-budget.md`).

## Subsystems and their contracts

| Subsystem | Input | Output | Schema | Doc |
|---|---|---|---|---|
| Corpus ingestion | award sources | DesignCase (metadata stage) | DesignCase, source-policies | 32, 33 |
| Reference study | DesignCase + live site | DesignCase (analysis stage) | DesignCase | 34 |
| Variant generation | DesignCase + brief | VariantRun (V0–V9) | VariantRun | 35, 36 |
| Experiment slot | hypothesis | ExperimentRecord | ExperimentRecord | 37 |
| Quality floor | candidate build | QUALIFIED / REJECTED+diagnosis | EvaluationResult (Phase 1) | 44 |
| Human review | qualified candidates | TasteDecision | TasteDecision | 45 |
| Taste consolidation | TasteDecisions | TasteProfile v(n+1) | TasteProfile | 41, 42 |
| Negative knowledge | rejections/failures | negative entries | (in DesignCase/VariantRun) | 43 |
| Tool intelligence | docs/MCP probes | ToolKnowledge | ToolKnowledge | 46, 47 |
| Promotion | experiment + evidence | PromotionCandidate → EngineEvolutionRecord | both | 53 |

## Core vs Lab separation (hard boundary)

```
KINETIC CORE (stable)              KINETIC DESIGN GYM (lab)
versioned registry items            anything experimental
tested, reproducible                may fail, may try new deps/tools
backwards-compatible                writes only to gym/
        ▲                                   │
        └── promotion gate (53) ────────────┘
```

The Gym may read the core freely. The core never reads the Gym except through a
completed promotion. A promotion is the ONLY write path from lab to core.

## Stage pipeline for one reference

```
INGESTED → STUDIED → BRIEFED → GENERATING → EVALUATING
→ QUALIFIED (≥1 candidate) → REVIEW_READY → REVIEWED (TasteDecision)
→ (optional) EXPERIMENT_LOGGED → (optional) PROMOTION_CANDIDATE
```

Every transition is a durable state change on the DesignCase/VariantRun record,
so any job can resume after any failure (`docs/gym/50-resumability.md`).

## What the Gym never does

- deploy anything automatically (`docs/gym/45-human-review.md` deployment gate)
- treat V0 fidelity studies as original work (36)
- convert speculation into observed fact (evidence tags, Phase 1 §2 convention)
- scrape against a source's stated policy (32)
- promote on a single success (53)
