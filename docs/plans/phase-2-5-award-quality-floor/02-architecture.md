# Architecture: Phase 2.5 Award-Quality Floor Calibration

## 1. Calibration reference

**Decision:** add exactly one primary case, `case-ee9eaf0dc9`, for `https://www.wanaka.studio`.

Wanaka is an Awwwards Honorable Mention with public evidence for an interactive hero, project transitions, custom typography, interactive portraits, WebGL icons, desktop, and mobile states.[1] The live page exposes a layered hero, custom graphic/type assets, portfolio structure, and enough content to study layout and narrative without depending on hidden source.[2] This is materially different from IZANAMI's dark editorial/music direction.

**Policy:** one-off observe-only study. Wanaka's robots policy allows public content while disallowing administration, PHP, feeds, comments, and query URLs.[3] Its legal notice states that site text, images, graphics, logos, icons, and software are protected; therefore KINETIC stores only metadata, our analysis, and internal screenshots, and V0/V1/V2 use no Wanaka assets or copy.[4]

**Selection boundary:** Form&Fun was shortlisted but rejected because its interactive runtime timed out and its robots/terms could not be verified. Locomotive was rejected because the browser reached a Cloudflare human-verification gate. No bypass was attempted.

## 2. System boundary

```text
Hermes orchestrator
  |
  +-- web/browser tools (one-off reference study; read-only)
  +-- independent vision critic (structured JSON only; cannot write)
  +-- human reviewer (final design authority)
  |
  v
existing engine/runner/run.mjs                 existing browser evaluators
  |                                             |
  +-- DesignCase                                +-- technical/responsive/a11y/perf
  +-- VariantBrief + retrieval provenance       +-- originality fingerprint/compare
  +-- pre-build decision
  +-- V0 FidelityReport
  +-- slot state + receipts + telemetry
  +-- design evaluation pointer
  |
  v
file-backed gym/runs/<case>/
  +-- variants/{v0,v1,v2}/
  +-- captures/<subject>/<viewport>/<state>.webp
  +-- visual-benchmark.json
  +-- fidelity-report-v0.json
  +-- design-evaluations/*.json
  +-- source-to-output-loss.json
  +-- review-package.html
```

No service, database, daemon, queue, cron, deployment path, or generalized plugin system is added. The existing file-backed Gym remains the composition root.

## 3. Contract decisions

### VariantBrief

Add one explicit JSON Schema and persist each brief as a real file plus a pointer/snapshot on the runner slot. It includes the user-required composition, typography, art direction, motion storyboard, reference transfer, originality, quality hypothesis, retrieval provenance, asset mode, depth decision, and signature move.

The existing `GENERATING` transition is the build-entry state; no duplicate `BUILDING` state is added. The runner refuses `GENERATING` or `BUILT` when:

- the brief is absent or invalid;
- retrieval provenance is empty;
- any retrieval entry lacks rationale and evidence classification;
- pre-build review did not pass;
- an original slot starts before V0 has a persisted FidelityReport.

### Retrieval provenance

The brief owns detailed retrieval entries. Receipts derive `design_cases_retrieved` and the detailed provenance from the accepted brief instead of accepting a second hand-entered source list. Empty retrieval is a hard planning stop, not an empty receipt.

### FidelityReport

Persist V0's report separately and link it from the V0 slot. It covers all twelve requested fidelity dimensions and distinguishes captured, missed, non-reproducible, licensed/proprietary, and approximated aspects. V0 remains `deployable:false`, internal, and originality-exempt.

### Design evaluation

Add one structured design-quality evaluation contract containing rubric dimension scores, evidence refs, producer, limitations, rationale, recommendation, and `design_qualified:false` by default. An AI/vision critic may evaluate but cannot qualify a candidate in this phase. Human acceptance is the only path to `design_qualified:true`.

The second batch supports `WINNER_SELECTED`, `PARTIAL_ACCEPTANCE`, and `REJECT_ALL`; no default selection and no forced winner.

### SourceToOutputLossReport

Persist one case-level report comparing reference → V0 → V1/V2 across analysis, planning, assets, implementation, motion, typography, layout, interaction, and evaluation. Claims carry `SOURCE-DERIVED`, `ENGINE-INFERENCE`, or `ENGINE-RECOMMENDATION`.

## 4. Visual benchmark architecture

Use a single local Playwright capture CLI and its Chromium runtime. This is the only proposed dependency.

Why it exists: Hermes browser screenshots are usable for immediate vision inspection but their transient host paths are not durable project artifacts. Playwright can capture deterministic desktop/mobile states directly into `gym/runs/<case>/captures/`, enforce viewport/state names, and produce portable review links. A browser dependency is therefore required by the explicit durable-capture contract, not added for convenience.

Capture plan per subject where practical:

- desktop: initial, mid-scroll, signature/interaction, final;
- mobile: initial, important content;
- motion: ordered frame checkpoints with trigger/progress metadata.

Captures become SHA-256-addressed WebP artifacts under the case run. The manifest records URL, viewport, trigger/action, scroll position, reduced-motion state, timestamp, hash, and failure. A screenshot never claims animation quality; motion evaluation cites state sequences.

The reference capture step must fail honestly if the browser cannot load Wanaka. Award-hosted evidence may supplement but not be mislabeled as a live capture.

## 5. Vision critic status

**Status: `VISION_CRITIC_AVAILABLE_UNVERIFIED`.**

Live `browser_vision` calls succeeded during Gate 1 and reference selection, establishing that image-level criticism is callable. The tool result did not disclose provider, exact model, provider route, monetary class, or request limits. Therefore no automated visual score may enter evaluator calibration in Phase 2.5; the active fallback is `HUMAN_VISUAL_GATE`.

Execution contract:

1. before use, a receipt must identify provider, exact model, image capability, provider route, known free/paid status, exposed limits, capture hash, prompt/rubric version, and response;
2. orchestrator supplies only persisted capture refs and rubric;
3. critic returns structured evaluation only;
4. orchestrator validates and persists the response;
5. critic never edits candidates or runner state;
6. missing identity/capability evidence or any vision failure yields `HUMAN_VISUAL_GATE`, not a synthetic score;
7. human review remains final.

Builder choice is recorded per receipt and is not coupled to critic choice. A model name containing `free` is not proof of zero cost; cost remains unknown unless provider evidence establishes it.

## 6. Stage and qualification flow

```text
REFERENCE STUDY
  DesignCase -> V0 brief -> pre-build pass -> V0 build
  -> Stage A technical -> visual captures -> FidelityReport

ORIGINALS (maximum V1 + V2)
  retrieve knowledge -> persist brief -> pre-build pass
  -> build (max 2 parallel) -> Stage A technical
  -> originality -> visual captures -> read-only vision evaluation
  -> DESIGN_EVALUATED (not QUALIFIED)

BATCH
  SourceToOutputLossReport -> validated review package -> REVIEW_READY
  -> STOP FOR HUMAN
  -> human decision later sets design qualification
```

`REVIEW_READY` means the comparison evidence is complete, not that any candidate passed the design floor. Before human review, originals remain `DESIGN_EVALUATED` with `design_qualified:false/pending-human`.

## 7. Motion-token enforcement

Reuse the existing `.kinetic/tokens.json` mechanism and Phase-1 namespaces. Add one candidate-source check to the existing evaluator/test path; do not build a new token framework.

The check flags raw duration, delay, stagger, easing, distance, opacity, scale, or spring values in candidate experience code when a token should be used. A brief may list a narrowly justified exception with the raw value, location, reason, and evidence tag. Reduced-motion behavior remains mandatory.

## 8. Telemetry

Extend existing slot receipts rather than adding an event service. Derive available durations from runner timestamps and store nullable counters for:

- wall clock, planning, build, evaluation, asset preparation;
- model/provider, model calls, tokens when exposed;
- tool calls, vision calls, repair count, attempts;
- human review state.

Unavailable data stays `null` with an availability note. Monetary cost may be zero only when provider evidence says so.

## 9. Files and dependencies

Expected new implementation files are limited to:

- four build/evaluation schemas: VariantBrief, FidelityReport, DesignQualityEvaluation, SourceToOutputLossReport;
- two source-governance schemas: Source Registry and SourceAuditRecord;
- one authoritative `gym/knowledge/sources/registry.json` with an inline audit per registered URL;
- one capture CLI;
- one Phase-2.5 contract/regression test;
- one `package.json` + lock with exact `playwright-chromium@1.62.1` pin;
- one calibration case/run artifact tree;
- one completion report.

Expected shared edits:

- `engine/runner/run.mjs` — persistence and transition guards;
- `engine/evaluator/gates.browser.js` or a sibling source check — motion-token result;
- `engine/cli/gen-review-package.mjs` — visual benchmark and decision surface;
- `schemas/gym/variant-run.schema.json` and taste schema — pointers/states and `PARTIAL_ACCEPTANCE`;
- existing docs/status only where the implemented behavior supersedes them.

No Phase-2 evidence, prior variants, TasteDecision, TasteProfile, negative knowledge, held-out evidence, or originality evidence is modified.

## 10. Resource and safety limits

- calibration DesignCase corpus: existing + Wanaka only; the 26 supplied URLs plus the separately audited UI Layouts free repository are knowledge sources, not DesignCases;
- originals: V1/V2 only; no V3 in first round;
- builders: at most 2;
- repair attempts: at most 3;
- cron, auto-promotion, deployment, large curriculum: off;
- all writes remain under `/workspace/kinetic-design-engine`;
- no reference assets, source code, branding, or copy are reused;
- stop after the review package is ready.

## 11. Risks and explicit ceilings

- Wanaka live capture is not yet proven in a fresh local Playwright runtime; failure stops the case rather than silently replacing evidence.
- Vision provider/model/route/cost/limits are unavailable; automated vision scoring is disabled and the human gate is mandatory.
- The first structured rubric calibrates workflow, not an objective universal aesthetic score.
- Regex-based motion-token detection is intentionally narrow; upgrade to AST parsing only after measured false positives.

## 12. Training definition and hard rights gate

In this architecture, **training** means retrieval knowledge, DesignCases, abstract design-pattern learning, primitives/recipes, tool intelligence, evaluator knowledge, negative knowledge, source-to-output lessons, and Taste Memory. It does **not** mean foundation-model weight training or fine-tuning. No source registered here may enter a future weight-training dataset without a separate rights and provenance review.

Before any reusable ingestion, the source must have a schema-valid `SourceAuditRecord`. Rights uncertainty downgrades ingestion; it does not upgrade public material into reusable content. Unknown rights still permit canonical URL, title, attribution, metadata, manually derived taxonomy, abstract observations, and KINETIC-authored principles. They prohibit raw-media mirroring, bulk screenshot corpora, copied proprietary code, logos, commercial fonts, paid component reconstruction, and any assumption that public means trainable.

The exact-use gate is evaluated independently for assets, code, automated access, AI training, credentials, attribution, and license retention. A permissive code license does not license third-party icons, demo imagery, fonts, trademarks, or gallery content.

## 13. Source Registry and ingestion modes

The authoritative machine state is `gym/knowledge/sources/registry.json`, validated by:

- `schemas/gym/source-registry.schema.json`;
- `schemas/gym/source-audit-record.schema.json`.

The registry contains one complete record for every user-supplied URL. Related routes remain separate entries so free, Pro, documentation, and example surfaces cannot silently share rights. A source discovered while auditing a supplied URL is added only when needed to preserve a rights boundary; the separately registered MIT UI Layouts repository is the current example and does not alter UI Layouts Pro rights.

IngestionMode semantics:

| Mode | Permitted storage/use |
|---|---|
| `REFERENCE_ABSTRACTION` | URL, provenance, taxonomy, evidence-linked observations, and KINETIC-authored principles; no protected raw assets by default. |
| `CODE_RECIPE_INGEST` | License-permitted code only, pinned to source/version with attribution and license retention; extract technique and map to KINETIC recipes/primitives. |
| `BUILD_TIME_LIBRARY` | Use the upstream library in a licensed product; do not vendor or rebrand it as KINETIC's redistributable library. |
| `TOOL_DISCOVERY_ONLY` | Use a directory to find original tools, then audit each original source independently. |
| `LICENSE_GATED_RUNTIME` | Use only when the user has the required subscription, API key, MCP credential, or license; secrets never enter registry records. |
| `NO_AUTOMATED_INGEST` | Human/manual reference only; excluded from crawlers and automated capture. |
| `VERIFY_REQUIRED` | Metadata/reference may remain, but raw/code ingestion is blocked pending official terms/license evidence. |

The verified/unverified licensing, automated-access, and code-eligibility matrices live in `docs/plans/phase-2-5-award-quality-floor/02-source-audit-matrix.md`. They are generated from the registry, not maintained as a second policy authority.

## 14. Retrieval hierarchy and VariantBrief provenance

Candidate planning must retrieve in this order:

1. product/brand goal;
2. high-quality DesignCase/reference;
3. art direction, composition, and typography;
4. motion/interaction concept;
5. implementation techniques/libraries.

Component libraries serve the concept. They cannot create the concept by accumulation. Retrieval should be source-diverse when useful and must not pull many components from one catalogue merely because it ranked highly.

Each `VariantBrief` adds categorized source lists:

- `design_reference_sources`;
- `motion_reference_sources`;
- `typography_sources`;
- `implementation_sources`;
- `tool_sources`.

Every influential entry records `source_id`, `retrieval_reason`, `knowledge_used`, and `usage_mode`, where `usage_mode` is one of `PRINCIPLE`, `PATTERN`, `RECIPE`, `PRIMITIVE`, `TOOL`, `BUILD_DEPENDENCY`, or `COMPARISON_REFERENCE`. The brief also records `reference_transfer.prohibited_copying`, including source imagery, copy, logo, fonts/assets, and exact section geometry where applicable. The runner later resolves each `source_id` against the registry and rejects an ingestion/use mode that exceeds its rights policy.

Gate-3 schema work must preserve this exact fragment:

```json
{
  "design_reference_sources": [
    {
      "source_id": "src-...",
      "retrieval_reason": "...",
      "knowledge_used": ["..."],
      "usage_mode": "PRINCIPLE"
    }
  ],
  "motion_reference_sources": [],
  "typography_sources": [],
  "implementation_sources": [],
  "tool_sources": [],
  "reference_transfer": {
    "retained_principles": ["..."],
    "prohibited_copying": [
      "source imagery",
      "source copy",
      "source logo",
      "source fonts/assets",
      "exact section geometry"
    ]
  }
}
```

Source-diversity gates:

- every brief has at least one `DESIGN_REFERENCE`/DesignCase influence; component libraries and tool directories do not satisfy it;
- retrieval must establish product goal and conceptual reference layers before any implementation source is admitted;
- implementation/library influences are capped at two per variant, and no more than one component catalogue may supply a `BUILD_DEPENDENCY`;
- a motion source is required when motion is a defining concept; a typography source is required when source-derived type selection is claimed;
- tool-directory entries may discover tools but may not appear as design evidence;
- empty retrieval or any source/usage-mode rights mismatch halts planning before `BUILDING`.

## 15. Obsidian synthesis architecture

The repository remains authoritative for schemas, source rights, audits, ingestion receipts, DesignCases, VariantRuns, tests, and build provenance. HermesVault is the durable human-readable synthesis layer; it does not become a second policy database.

The existing KMS taxonomy is authoritative, so the proposed mirror maps as follows instead of creating a conflicting top-level `KINETIC/` tree:

| Knowledge | KMS location |
|---|---|
| Project context and a registry index/link | `01-Projects/KINETIC/` |
| Cross-source composition/motion/type/navigation/section/interaction/art-direction synthesis | `02-Research/Design/` (a genuinely distinct new category, only after separate vault-write approval) |
| Reusable mature patterns | `03-Concepts/` after promotion gates |
| One external source note | `04-Sources/` |
| Accepted KINETIC decisions | `05-Decisions/` |
| Tools/MCP comparisons | research notes linked to their `04-Sources` records; credentials remain outside the vault |

Each future source note contains `kinetic_source_id`, canonical URL, source type, rights summary, inspection status, useful patterns, allowed learning, prohibited copying, related DesignCases/tools/recipes, and last-verified date. It stores links plus abstract notes by default; protected screenshots, code, fonts, and assets require explicit registry permission for that exact storage.

Two-way flow:

```text
WEB/SOURCE -> SOURCE AUDIT -> REPO SOURCE REGISTRY
                               |          |
                               |          +-> recipe/tool knowledge
                               +-> reference knowledge
                               +-> proposed Obsidian source/research synthesis
                                           |
                            registry + repo + approved vault synthesis
                                           v
                                       RETRIEVAL
                                           v
                                    VariantBrief -> Build
                                           v
                                  Evaluation/Learning
                                           v
                         repo lessons + proposed vault synthesis update
```

Vault writes follow search-first, duplicate prevention, immutable Source-note, conflict/supersession, approval, and validator rules from the canonical KMS. The Docker vault is read-only; any later approved change must be staged with an explicit host apply script and must not be reported as applied until the host write succeeds. No vault files are changed in Gate 2.

## 16. Playwright pin, storage, and access policy

`playwright-chromium@1.62.1` is the exact proposed pin. Gate 2 does not install it. A later approved slice installs Chromium only, records the package version and `browser.version()` in receipts, and uses a project-local ignored browser cache such as `.cache/ms-playwright` via `PLAYWRIGHT_BROWSERS_PATH`.

The observed `/tmp` is a 512 MiB tmpfs, while `/workspace` has approximately 77 GiB available. Browser downloads, profiles, and temporary capture files therefore live under a run-scoped project-local directory, not `/tmp`; the capture command removes that directory in a deterministic `finally` path. Captures remain project-local run artifacts. The browser is a visual-evidence tool, not permission to automate a prohibited source. Registry `automated_access=PROHIBITED` or mode `NO_AUTOMATED_INGEST` blocks Playwright against that source.

## Sources

[1] https://www.awwwards.com/sites/wanaka-studio — Wanaka Studio - Awwwards Honorable Mention
[2] https://www.wanaka.studio — Wanaka Studio
[3] https://www.wanaka.studio/robots.txt — Wanaka robots.txt
[4] https://www.wanaka.studio/mentions-legales — Wanaka legal notice
[5] https://www.npmjs.com/package/playwright-chromium — proposed exact dependency version evidence
[6] https://playwright.dev/docs/browsers — official single-browser and browser-cache policy
[7] `gym/knowledge/sources/registry.json` — authoritative per-URL audit evidence and rights state
[8] `/knowledge/HermesVault/03-Concepts/Knowledge-Management-System.md` — canonical vault taxonomy and authority contract
[9] `/knowledge/HermesVault/03-Concepts/Hermes-Knowledge-Workflow.md` — search-first, review, and validation workflow
