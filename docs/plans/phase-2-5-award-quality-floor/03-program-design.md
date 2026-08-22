# Program Design: Phase 2.5 Award-Quality Floor Calibration

> Gate 3 is planning only. This document defines implementation; it does not authorize it.

## 0. Decision summary

- Phase 2.5 uses a new, additive `case-run@0.2` path. Existing Phase-2 files remain immutable and continue through a legacy read adapter.
- Candidate lifecycle uses the explicit Phase-2.5 states requested here. Qualification remains three separate fields, never inferred from state.
- V1/V2 slots do not exist until V0 has a schema-valid, human-approved FidelityReport. This enforces “V0 before originals” rather than merely documenting it.
- `engine/runner/run.mjs` remains the CLI composition root. State rules move to one pure module and durability/locking moves to one store module; no service, daemon, queue, database, or plugin framework is added.
- Rights policy is resolved from the canonical repository registry before any source selection, automated access, code use, or build dependency. The rights module is read-only; Gate 4 adds no rights-mutation API.
- Obsidian is an optional bounded read adapter and generated staging export. It cannot override repository rights or become necessary to run KINETIC.
- Playwright Chromium is the only new dependency: exact pin `playwright-chromium@1.62.1`.
- Automated vision remains advisory and unavailable for authoritative use until provider/model/route/capability identity is verified. Human review is final.
- Gate 4 is **ENGINE IMPLEMENTATION READY**, proven on fixtures and legacy Phase-2 data before any Wanaka artifact is generated.

Gate-3 state naming intentionally supersedes the earlier Gate-2 sentence that proposed reusing `GENERATING`: Phase 2.5 uses the explicit `BUILDING` state requested for this gate. Legacy Phase-2 states remain readable.

---

## 1. Exact files and modules

### 1.1 Files to modify during Gate-4 implementation

| Path | Exact change | Why this existing seam is reused |
|---|---|---|
| `.gitignore` | Ignore `.cache/`, `.tmp/`, run-scoped browser profiles, and generated `gym/exports/obsidian/`; do not ignore manifests/reports. | Prevent the 512 MiB `/tmp` failure and accidental cache commits. |
| `engine/runner/run.mjs` | Preserve legacy commands; add Phase-2.5 `init-case`, `retrieve`, `add-slot`, `advance`, `retry`, `batch-review-ready`, and `record-human-review` command paths that call the shared state/store modules. Remove direct arbitrary Phase-2.5 state assignment. | Existing CLI is the file-backed Gym composition root. |
| `engine/evaluator/originality-compare.mjs` | Add input hashes, rules version, brief reference, and capture perceptual-hash similarity; retain all current structural dimensions and V0 exemption. | Preserves the proven Phase-2 originality comparator. |
| `engine/cli/gen-review-package.mjs` | Generate the production comparison workbench from manifests/reports and existing artifact paths; add unbiased review controls and baseline/reference/V0/V1/V2 columns. | Keeps the root-cause fix that derives links instead of hand-writing them. |
| `schemas/gym/source-registry.schema.json` | Align only the registry wrapper with the accepted file keys `$schema`, `registry_version`, `updated_at`, `authority`, `training_definition`, `sources`. Do not change any of the 27 source policy decisions. | The accepted registry currently uses these keys while the draft schema still expects `schema`/`updated`; executable validation requires alignment. |
| `schemas/gym/variant-run.schema.json` | Add the `@0.2` per-slot contract, Phase-2.5 states, artifact pointers, attempts, and three independent qualification fields while retaining the `@0.1` legacy branch. | Keeps one candidate schema and preserves old artifacts. |
| `schemas/gym/taste-decision.schema.json` | Accept legacy `@0.1` unchanged and add `@0.2` with `PARTIAL_ACCEPTANCE`, explicit relative preference, per-original absolute floor and learning-acceptance values. | Existing TasteDecision is append-only and already carries the first human rejection. |
| `engine/tests/test-taste-reject-all.mjs` | Keep every current assertion and address the legacy schema branch explicitly; add no mutation of IZANAMI evidence. | Proves the old `REJECT_ALL` decision remains semantically identical. |
| `engine/tests/test-review-package-links.mjs` | Check manifest-derived capture/report links in addition to existing variant links and assert no review control is preselected. | Extends the existing review-link regression at the shared generator. |
| `docs/08-motion-tokens.md` | After implementation passes, document the machine token file and explicit exception format; retain evidence tags. | Keeps human and executable motion contracts aligned. |
| `docs/gym/35-variant-protocol.md` | Add a Phase-2.5 subsection; do not rewrite the Phase-2 state history. | Documents additive run-version behavior. |
| `docs/gym/36-fidelity-study-policy.md` | Link the full FidelityReport dimensions and human approval barrier. | Existing V0 policy remains authoritative. |
| `docs/gym/41-taste-memory.md` | Document `PARTIAL_ACCEPTANCE` and independent per-candidate floor/learning decisions. | Extends the existing append-only taste model. |
| `docs/gym/44-quality-floor.md` | Separate lifecycle, technical qualification, design rubric, and human design qualification. | Fixes the current overloaded `QUALIFIED` concept for Phase 2.5. |
| `docs/gym/50-resumability.md` | Add attempt-scoped artifacts, adjacent transitions, capture/model idempotency, and atomic stale-lock recovery. | Preserves the proven kill/resume contract. |
| `docs/gym/51-resource-budget.md` | Record project-local Playwright cache/profile/temp paths and Chromium-only limit. | Makes the earlier `/tmp` failure impossible by policy. |

### 1.2 Files to add during Gate-4 implementation

| Path | Single responsibility |
|---|---|
| `package.json` | Node scripts and the sole dependency pin: `"playwright-chromium": "1.62.1"`. |
| `package-lock.json` | Exact npm dependency/browser package resolution. |
| `engine/core/schema-validate.mjs` | Small fail-closed validator for the JSON-Schema subset KINETIC uses: types, required/properties/additionalProperties, enum/const, pattern/ranges, arrays/uniqueItems, local/external `$ref`, `$defs`, `allOf`, `if/then`, and date/date-time/URI formats. Unsupported validation keywords are errors, not ignored. This avoids adding Ajv; Ajv and Python `jsonschema` are absent. |
| `engine/runner/state-machine.mjs` | Pure state transition table, precondition guards, retry rules, terminal states, and qualification invariants. No filesystem or model calls. |
| `engine/runner/store.mjs` | Atomic JSON writes, artifact hashing, append-only receipts/history, case locks, heartbeat, stale takeover, legacy read normalization, and idempotency lookup. |
| `engine/knowledge/source-registry.mjs` | Load/validate registry `0.1.2`, read inline SourceAuditRecords, resolve requested usage/access against rights, export provenance, and read DesignCase access policies. No write/export for changing rights. |
| `engine/knowledge/retrieval.mjs` | Reproducible lexical/filter retrieval over DesignCases, source registry, engine recipe/primitive manifests, tool/MCP records, negative knowledge, and optional Obsidian results; write one retrieval receipt. |
| `engine/knowledge/obsidian-adapter.mjs` | Optional, allowlisted, bounded read-only HermesVault lexical retrieval with note provenance and trust labels. |
| `engine/planning/prebuild-review.mjs` | Deterministic weak-plan and rights checks plus optional structured advisory observations; emits APPROVED/REVISE/REJECTED. |
| `engine/tokens/motion-tokens.json` | Canonical machine-readable token names, values, units, evidence tags, aliases consumed by existing primitives, and reduced-motion values. |
| `engine/evaluator/motion-token-validate.mjs` | Narrow source validator for candidate-authored CSS/JS/HTML, explicit exceptions, and reduced-motion contract checks. |
| `engine/cli/capture.mjs` | Chromium lifecycle, readiness, state actions/checkpoints, PNG-to-WebP conversion in Chromium, perceptual hash, SHA-256 artifact write, and capture-manifest update. |
| `engine/evaluator/vision-critic.mjs` | Provider-independent request/response boundary and identity receipt checks. It accepts structured observations only and performs no provider call or file modification itself. |
| `engine/cli/gen-obsidian-mirror.mjs` | Generate a disposable staging mirror and `APPLY_TO_VAULT.sh` under `gym/exports/obsidian/` from canonical repository data. It never writes the vault. |
| `schemas/gym/case-run.schema.json` | `kinetic/gym/case-run@0.2` container for case metadata, slots, case-level reports, review state, and history. |
| `schemas/gym/variant-brief.schema.json` | Full VariantBrief contract. |
| `schemas/gym/retrieval-receipt.schema.json` | Reproducible query, candidates, selections/rejections, provenance and registry version. |
| `schemas/gym/prebuild-review.schema.json` | Rule/advisory findings and APPROVED/REVISE/REJECTED decision. |
| `schemas/gym/fidelity-report.schema.json` | V0 fidelity dimensions, evidence, limitations, overall understanding, and human approval. |
| `schemas/gym/capture-manifest.schema.json` | Capture specs, entries, browser/version data, hashes, readiness and failures. |
| `schemas/gym/design-quality-evaluation.schema.json` | Shared structured design-rubric output for ai-critic and human producers, including optional verified vision receipt. |
| `schemas/gym/source-to-output-loss-report.schema.json` | Reference→V0→V1/V2 stage-loss findings and remediation. |
| `schemas/gym/execution-telemetry.schema.json` | Stage timing, calls/metrics, attempts, availability labels and human wait time. |
| `schemas/motion-tokens.schema.json` | Executable contract for `engine/tokens/motion-tokens.json`. |
| `engine/tests/test-phase2-5-contracts.mjs` | T1–T16, T21–T28, T30–T32, T37, T39–T43, T46–T48 using inline fixtures and project-local test temp. |
| `engine/tests/test-phase2-5-resume.mjs` | T20, T33–T35, T38, T47 with real temp files/locks and no historical writes. |
| `engine/tests/test-phase2-5-capture.mjs` | T17–T20, T42, T45 and reproducibility against one local fixture. |
| `engine/tests/fixtures/capture-fixture.html` | One deterministic page with fonts/images, scroll, hover, signature checkpoint, random seed and reduced-motion behavior. |

No candidate scaffold, Wanaka case JSON, Wanaka capture plan, or Wanaka run directory is created during Gate 4 engine work.

---

## 2. Requirement-to-code implementation map

| Requirement | Existing module changed | New module/schema | Runner transition / CLI | Artifacts | Tests | Compatibility and failure behavior |
|---|---|---|---|---|---|---|
| VariantBrief | `run.mjs`, `variant-run.schema.json` | `variant-brief.schema.json` | `advance --to BRIEF_VALIDATED --artifact <brief>` | `planning/<slot>/variant-brief.json`, hash in slot receipt | T1,T2,T12,T13,T46 | Legacy slots may keep `brief:null`; Phase-2.5 missing/invalid brief returns `KINETIC_SCHEMA_INVALID`, state unchanged. |
| DesignCase retrieval provenance | `run.mjs` | `retrieval.mjs`, `retrieval-receipt.schema.json` | `retrieve`; then `advance --to RETRIEVAL_PROVEN` | `planning/<slot>/retrieval-receipt.json` | T3,T39,T46 | Empty normal-original DesignCase selection returns `KINETIC_EMPTY_RETRIEVAL`; no transition. |
| Source Registry retrieval | source-registry schema wrapper only | `source-registry.mjs` | `retrieve --query ...` | selected/rejected source rows in retrieval receipt | T4–T7,T39,T40,T42 | Registry remains 27/27 and read-only; malformed registry is a deterministic block. |
| Rights enforcement | none | `source-registry.mjs` | all retrieval/capture/build-dependency paths call `authorize()` before use | denial in case history and retrieval receipt | T4–T7,T10,T39,T40,T42 | Deny closed with stable error code; accepted rights fields are not rewritten. |
| Obsidian adapter/mirror | none | `obsidian-adapter.mjs`, `gen-obsidian-mirror.mjs` | optional flags on `retrieve`; separate staging CLI | note provenance in receipt; generated staged mirror | T8–T10,T45 | Missing/read-only vault is nonfatal; repo retrieval continues. Vault cannot authorize anything. |
| FidelityReport | current shallow optional block in variant schema | `fidelity-report.schema.json` | `advance V0 --to DESIGN_EVALUATED --artifact <report>`; `add-slot` checks human approval | `reports/fidelity-v0.json` | T11,T46 | Invalid/incomplete report blocks originals; V0 stays internal/undeployable. |
| Pre-build design review | none | `prebuild-review.mjs`, schema | `advance --to PREBUILD_APPROVED --artifact <review>` | `planning/<slot>/prebuild-review.json` | T12,T13,T39,T41 | REVISE/REJECTED never permits BUILDING; reasons persist. |
| Visual capture pipeline | transient Hermes screenshots only | `capture.mjs` | external capture command; then `advance --to VISUAL_CAPTURED --artifact <manifest>` | content-addressed WebP plus manifest | T17–T20,T42,T45,T48 | Partial sets fail completeness; existing matching capture is reused. |
| Capture manifest | none | `capture-manifest.schema.json` | capture CLI appends idempotently | `captures/manifest.json`, `captures/artifacts/<sha>.webp` | T17–T20,T29,T48 | Filename is never evidence; unresolved/hash-mismatched artifacts block transition. |
| Vision critic interface | browser vision available but identity unknown | `vision-critic.mjs`, design-evaluation schema | `advance --to DESIGN_EVALUATED` accepts verified advisory receipt or HUMAN_VISUAL_GATE record | `reports/design-evaluation-<slot>.json` | T21,T22,T23 | Unknown identity prevents authoritative use and never fabricates model/provider. |
| Design-quality rubric | design gate currently pending/fail only | design-evaluation schema | `advance --to DESIGN_EVALUATED` | dimensioned evaluation report | T22–T24,T43 | Does not set `design_qualified`; missing capture evidence invalidates visual claims. |
| Human design-quality gate | `taste-decision.schema.json`, rejection test | TasteDecision `@0.2` branch | `record-human-review --decision <file>` | append-only `gym/taste/decisions/*.json`; slot flags | T24–T28,T47 | Human values are explicit, not inferred; corrections supersede instead of overwrite. |
| Motion-token enforcement | `docs/08`, existing primitive manifests and candidate tokens | token JSON/schema, validator | technical evaluation invokes validator before `TECHNICAL_EVALUATED=true` | `reports/motion-token-<slot>.json` | T14–T16 plus reduced-motion fixture | Narrow scan; explicit exceptions allowed. Vendor/core/minified files excluded. |
| Telemetry | slot timestamps and receipt fields | telemetry schema | state store records every start/end/retry; commands may add exposed metrics | `telemetry.json` | T31,T34,T35,T45 | Unknown stays null/`unknown`; no estimate; cost zero requires verified evidence. |
| SourceToOutputLossReport | none | loss-report schema | `batch-review-ready` requires report | `reports/source-to-output-loss.json` | T30,T43 | Unsupported visual claims without evidence are rejected. |
| Review workbench | `gen-review-package.mjs`, link test | no second UI module | `gen-review-package`; `batch-review-ready` validates output | `review-package.html`, package manifest | T25–T29,T44 | No defaults; missing baseline/reference/capture/report link blocks REVIEW_READY. |
| TasteDecision integration | existing append-only decision/profile evidence | taste schema `@0.2` | `record-human-review` | immutable decision and case pointer | T24–T28,T32,T47 | IZANAMI `@0.1` remains byte-unchanged and semantically valid. |
| Phase-2 compatibility | `run.mjs`, legacy tests | `store.mjs` legacy normalization | old `record/gate/receipt/next/status` commands retained | no migration artifacts | T32,T33,T36,T39 | Old files are read but never upgraded on disk; `--run-version phase2.5` selects new path. |

---

## 3. Shared runner state machine

### 3.1 New candidate lifecycle

```text
PLANNED
  -> BRIEF_VALIDATED
  -> RETRIEVAL_PROVEN
  -> PREBUILD_APPROVED
  -> BUILDING
  -> BUILT
  -> TECHNICAL_EVALUATED
  -> VISUAL_CAPTURED
  -> DESIGN_EVALUATED
  -> REVIEW_READY
  -> HUMAN_REVIEWED
```

Stored separately on every Phase-2.5 slot:

```js
{
  technically_qualified: false,             // boolean after TECHNICAL_EVALUATED
  design_qualified: null,                   // boolean only after human review
  acceptable_for_further_taste_learning: null // boolean only from explicit human input
}
```

State is progress, not merit. `DESIGN_EVALUATED` means a schema-valid rubric exists. `REVIEW_READY` means complete comparison evidence exists. Neither means design-qualified.

### 3.2 Allowed forward transitions and guards

| From → To | Required durable evidence |
|---|---|
| absent → `PLANNED` | V0: Phase-2.5 case initialized. V1/V2: V0 FidelityReport is schema-valid and human `APPROVED`; originals count remains ≤2. |
| `PLANNED` → `BRIEF_VALIDATED` | VariantBrief exists, schema passes, IDs match slot/case, originality/signature rules applicable to slot pass structurally. |
| `BRIEF_VALIDATED` → `RETRIEVAL_PROVEN` | RetrievalReceipt exists; selected IDs resolve; receipt registry version is `0.1.2`; every selected source use is rights-authorized; normal original has ≥1 DesignCase. Brief source influence set equals selected influential receipt set. |
| `RETRIEVAL_PROVEN` → `PREBUILD_APPROVED` | PreBuildReview decision exactly `APPROVED`; all hard checks pass; no unresolved rights denial. V1/V2 still require approved V0 report. |
| `PREBUILD_APPROVED` → `BUILDING` | Same brief/retrieval/review hashes; lock held; build attempt ≤3; no concurrent holder. |
| `BUILDING` → `BUILT` | Build exits successfully; artifact exists; artifact hash/receipt fsynced before state write. |
| `BUILT` → `TECHNICAL_EVALUATED` | Technical/responsive/a11y/performance/originality (originals only)/motion-token reports exist. `technically_qualified` is explicitly written true/false. |
| `TECHNICAL_EVALUATED` → `VISUAL_CAPTURED` | `technically_qualified=true`; required desktop/mobile/state capture set complete; manifest/schema/hashes pass. |
| `VISUAL_CAPTURED` → `DESIGN_EVALUATED` | Structured rubric exists for all required dimensions. Verified critic receipt or explicit `HUMAN_VISUAL_GATE`; V0 also requires FidelityReport. `design_qualified` remains null. |
| `DESIGN_EVALUATED` → `REVIEW_READY` | Case-level loss report and production workbench are valid; all local links resolve; no review input defaults; batch comparison set is complete. |
| `REVIEW_READY` → `HUMAN_REVIEWED` | Append-only TasteDecision `@0.2` validates and explicitly supplies relative preference, per-original floor, per-original learning acceptance, and overall outcome. |

`batch-review-ready` advances all included slots atomically only after package-level checks pass.

### 3.3 Blocked/skipped transitions

- Any non-adjacent forward transition is `KINETIC_TRANSITION_DENIED`.
- Arbitrary `record --state` is legacy-only and refuses `case-run@0.2`.
- Any transition out of `HUMAN_REVIEWED`, `REJECTED_FINAL`, or `CANCELLED` is blocked.
- V1/V2 creation before human V0 fidelity approval is blocked.
- `TECHNICAL_EVALUATED(false) -> VISUAL_CAPTURED` is blocked.
- A missing/changed upstream hash invalidates downstream advance and requires an explicit retry attempt; downstream evidence is never silently reused across changed inputs.
- V0 cannot set `deployable:true`, `design_qualified:true`, or `acceptable_for_further_taste_learning`.

### 3.4 Retry transitions and terminal failures

The record retains every attempt and its artifact hashes. Retry never overwrites an earlier attempt.

| Situation | Retry path |
|---|---|
| transient build failure | `BUILDING -> PREBUILD_APPROVED`, append failure receipt, increment build attempt, retry ≤3 |
| technical failure with repair diagnosis | `TECHNICAL_EVALUATED(false) -> BUILDING`, new attempt, retry from build; ≤3 total repairs |
| capture crash before complete manifest | state remains `TECHNICAL_EVALUATED`; capture retries only missing specs |
| design evaluation requests repair | `DESIGN_EVALUATED -> BUILDING` only via explicit `retry --from DESIGN_EVALUATED --diagnosis`; new attempt; ≤3 |
| transient vision failure | state remains `VISUAL_CAPTURED`; reuse request only if response receipt absent; otherwise reuse stored response |
| contract/schema/rights violation | state remains prior durable state and records `BLOCKED` condition; no automatic retry loop |

Terminal outcomes:

- `REJECTED_FINAL`: repair budget exhausted or explicit rejection with diagnosis.
- `CANCELLED`: explicit human/operator cancellation.
- `HUMAN_REVIEWED`: immutable completed review state.

`BLOCKED` is a condition attached to the current state, not a replacement lifecycle state; correcting the deterministic input clears it under lock. This avoids losing the resume point.

### 3.5 Lock, atomicity, stale recovery and resume

`store.mjs` uses only Node stdlib:

1. Atomic lock acquisition uses `mkdir(gym/jobs/locks/<case>.lock)`; directory creation is the mutual-exclusion primitive.
2. `owner.json` records PID, nonce, acquired/heartbeat timestamps, TTL=300 seconds and current operation.
3. Long operations heartbeat every 15 seconds. Short CLI operations release in `finally`.
4. A holder is stale only when PID is dead **or** heartbeat exceeds TTL. Reclaimer atomically renames the lock directory to `<case>.lock.stale-<timestamp>-<nonce>`, acquires a fresh lock, records `takeover_of`, then removes the stale directory.
5. JSON writes use a sibling temp file, file fsync, rename, then parent-directory fsync. No temp file is placed under `/tmp`.
6. `next` derives the first unmet adjacent state guard. It never guesses from directory contents.
7. Legacy Phase-2 read normalization is in memory only. Opening a legacy run never writes it.

Idempotency keys:

- transition: `(run_id, attempt, from_state, to_state, input_artifact_hash)`;
- retrieval: hash of `(query, filters, registry_version, selected repository index hashes)`;
- build: `(case_id, slot, attempt, brief_hash)`;
- technical gate: `(run_id, attempt, gate, rules_version, build_hash)`;
- capture spec: hash of `(run_id, attempt, viewport, state, action, reduced_motion, build_hash)`;
- vision call: hash of `(capture_hashes, rubric_version, prompt_version, provider, model, route)`;
- human review: `decision_id` plus decision file hash.

A completed matching key returns the stored receipt. Different content under the same key is `KINETIC_ARTIFACT_MISMATCH`, never overwrite.

---

## 4. Contract signatures (interfaces only)

```js
// engine/core/schema-validate.mjs
validateFile({ artifactPath, schemaPath }) -> { valid, errors[] }
validateValue({ value, schema, schemaPath }) -> { valid, errors[] }

// engine/runner/state-machine.mjs
nextState(slot, caseRun) -> State | null
assertTransition({ caseRun, slot, toState, artifactRefs }) -> void
applyTransition({ caseRun, slot, toState, artifactRefs, now }) -> CaseRun
prepareRetry({ caseRun, slot, fromState, diagnosisRef }) -> CaseRun
assertBatchReviewReady({ caseRun, packageManifest, lossReport }) -> void
applyHumanReview({ caseRun, tasteDecision }) -> CaseRun

// engine/runner/store.mjs
withCaseLock(caseId, operation, fn) -> Promise<unknown>
readCase(caseId) -> Promise<{ runVersion, record, legacy }>
writeCaseAtomic(caseId, record) -> Promise<void>
appendArtifactReceipt(caseId, receipt) -> Promise<Receipt>
hashFile(path) -> Promise<string>
findIdempotentReceipt(caseId, key) -> Promise<Receipt | null>

// engine/knowledge/source-registry.mjs
loadSourceRegistry() -> Promise<SourceRegistry>
lookupSource(sourceId) -> SourceRecord
readSourceAudit(sourceId) -> SourceAuditRecord
authorizeSourceUse({ sourceId, usageMode, operation, targetPath, entitlementRefs }) -> RightsDecision
assertAutomatedAccess({ sourceId, url, operation }) -> void
exportSourceProvenance(sourceIds) -> ProvenanceRow[]

// engine/knowledge/retrieval.mjs
retrieveKnowledge({ caseId, slot, query, filters, obsidian, now }) -> RetrievalReceipt

// engine/knowledge/obsidian-adapter.mjs
searchVault({ query, allowedRoots, limit = 5, excerptChars = 1200 }) -> ObsidianResult

// engine/planning/prebuild-review.mjs
reviewBrief({ brief, retrievalReceipt, fidelityReport, sourceRegistry, advisoryObservations }) -> PreBuildReview

// engine/evaluator/motion-token-validate.mjs
validateMotionTokens({ variantDir, brief, tokenCatalog }) -> MotionTokenReport

// engine/evaluator/vision-critic.mjs
prepareVisionRequest({ captures, brief, rubricVersion, provenance, fidelityReport }) -> VisionRequest
acceptVisionResponse({ request, response, providerReceipt }) -> DesignQualityEvaluation

// engine/cli/capture.mjs internal boundary
capturePlan({ caseId, subjectId, url, specs, accessDecision }) -> CaptureManifest
```

---

## 5. VariantBrief implementation

### 5.1 Path, writer, reader and enforcement

- Schema: `schemas/gym/variant-brief.schema.json` (`kinetic/gym/variant-brief@0.1`).
- Persisted path: `gym/runs/<case>/planning/<slot-lower>/variant-brief.json`.
- Writer: planning agent/orchestrator after reproducible retrieval has produced candidate selections.
- Reader: prebuild reviewer, builder prompt assembly, receipt generator, originality evaluator, capture planner, design evaluator and loss reporter.
- Validation point: `advance -> BRIEF_VALIDATED`; revalidated by hash before `BUILDING`.
- Receipt: slot stores `brief_ref`, `brief_sha256`, schema version and validation receipt.

### 5.2 Exact shape

Required top-level fields:

```text
variant_id
case_id
design_case_ids_used       nonempty for normal Phase-2.5 originals
surface
goal
direction_name
core_concept
composition_plan
typography_plan
art_direction
motion_plan
reference_transfer
source_provenance
originality_plan
quality_hypothesis
```

Required nested fields match the Gate-3 request exactly:

- `composition_plan`: `sections`, `spatial_system`, `visual_hierarchy`, `pacing`, `density`, `focal_points`.
- `typography_plan`: `display_role`, `body_role`, `scale_strategy`, `contrast_strategy`, `rhythm`, `responsive_behavior`.
- `art_direction`: `imagery_strategy`, `asset_strategy`, `texture`, `material`, `depth`, `layering`, `color_logic`.
- `motion_plan`: `signature_move`, `scroll_storyboard`, `transitions`, `interaction_states`, `reduced_motion_behavior`, `token_exceptions`.
- `reference_transfer`: `retained_principles`, `deliberately_rejected_principles`, `prohibited_copying`.
- `source_provenance`: the five categorized lists: design, motion, typography, implementation, tool.

Each influential source entry preserves the accepted Gate-2 shape and adds indexed attribution without changing `knowledge_used` into a different type:

```json
{
  "source_id": "src-example",
  "retrieval_reason": "why this source was selected",
  "knowledge_used": ["abstract statement used in the plan"],
  "usage_mode": "PRINCIPLE",
  "attribution": [
    {
      "knowledge_index": 0,
      "classification": "SOURCE-DERIVED",
      "evidence_refs": ["retrieval-receipt.json#/selected_sources/0"]
    }
  ]
}
```

Allowed `usage_mode` values:
`PRINCIPLE`, `PATTERN`, `RECIPE`, `PRIMITIVE`, `TOOL`, `BUILD_DEPENDENCY`, `COMPARISON_REFERENCE`.

Allowed attribution classes:
`SOURCE-DERIVED`, `ENGINE-INFERENCE`, `ENGINE-RECOMMENDATION`.

### 5.3 Signature move

`motion_plan.signature_move` is required for V1/V2 and contains:

```text
name
central_idea
trigger
visual_transformation
purpose
content_relationship
reduced_motion_alternative
capture_checkpoint
```

A hover-only or unrelated animation fails unless `central_idea`, content relationship and section/composition effect prove it structures the experience. V0 may describe the reference’s defining move but does not claim originality.

### 5.4 Hard build barrier

No Phase-2.5 candidate reaches `BUILDING` when any of these is true:

- brief absent, invalid, or hash changed;
- retrieval receipt absent/invalid;
- required DesignCase selection empty;
- an influential source lacks reason/knowledge/use/attribution;
- rights authorization missing or denied;
- prebuild decision is not APPROVED;
- original slot lacks human-approved V0 FidelityReport.

There is no general exception. The only narrow exception field is `planning_exception`, allowed for an inaccessible optional knowledge source—not for missing DesignCase provenance, rights, brief, or prebuild approval. It requires human approver, reason, scope and expiry and cannot authorize code/assets/access.

---

## 6. Reproducible retrieval architecture

### 6.1 Call stack

```text
run.mjs retrieve
  -> retrieval.retrieveKnowledge
      -> load DesignCases from gym/corpus/cases/*.json
      -> load source registry 0.1.2 and resolve rights
      -> load engine/registry/registry.json + item manifests
      -> load gym tool/MCP/negative records when present
      -> optionally query obsidian-adapter
      -> rank deterministically
      -> retain candidates + rejections
      -> write retrieval receipt under case lock
  -> state remains PLANNED until brief is written and validated
```

The brief is written from the selected receipt. `BRIEF_VALIDATED` then checks its shape; `RETRIEVAL_PROVEN` cross-checks receipt and brief selections.

### 6.2 Deterministic query and ranking

Receipt records:

- query string and normalized tokens;
- filters: surface, knowledge domains, source kinds, rights-allowed usage modes, case status, K-level if applicable;
- candidate IDs in stable lexical ID order before scoring;
- deterministic score components: exact title/tag match, surface match, domain match, accepted-decision trust;
- selected IDs and explicit rejection reason per non-selected candidate;
- retrieval timestamp;
- registry version `0.1.2` and registry SHA-256;
- repository index/file hashes used;
- knowledge used and attribution classes.

Ties resolve by stable ID. No random retrieval ranking exists in Phase 2.5.

### 6.3 Candidate receipt fields

```text
design_cases_retrieved
sources_retrieved
obsidian_notes_used
recipes_selected
primitives_selected
tools_selected
```

Each list contains selected and rejected candidates or references a corresponding receipt section; selections always include reason and knowledge used. `design_cases_retrieved: []` is a hard stop for normal originals. V0 must retrieve its own DesignCase.

### 6.4 Knowledge stores

| Store | Authority/use |
|---|---|
| `gym/corpus/cases/` | Canonical DesignCases and evidence. |
| `gym/knowledge/sources/registry.json` | Canonical source rights and abstract source metadata. |
| `engine/registry/registry.json` + manifests | Canonical KINETIC recipes/primitives/tools available to builds. |
| `gym/knowledge/negative/` | Canonical negative lessons. |
| tool/MCP records under existing Gym paths | Tool knowledge only; not design authority. |
| optional HermesVault notes | Bounded synthesis/advisory context only. |

---

## 7. Executable rights enforcement

### 7.1 Resolution inputs and output

`authorizeSourceUse()` evaluates all of:

```text
rights_status
ingestion_modes
code_ingest
asset_copy
automated_access
credential_required
license_status
attribution_required
license_retention_required
last_verified_at
inline SourceAuditRecord
requested usage_mode
requested operation
requested target path
non-secret entitlement reference, if any
```

It returns `{allowed, effective_mode, obligations[], warnings[], evidence_urls[], registry_version}` or throws a stable denial.

### 7.2 Exact policy behavior

| Registry condition | Executable effect |
|---|---|
| `REFERENCE_ONLY` | Allow manually authored abstract principles/comparison metadata. Deny raw code/assets and automated ingestion unless a separate access policy explicitly permits reference capture. |
| `ALLOW_ABSTRACT_PATTERN` | Allow `PRINCIPLE`, `PATTERN`, `COMPARISON_REFERENCE`; deny code/assets. |
| `ALLOW_METADATA_ONLY` | Allow identity/URL/taxonomy only; it cannot satisfy substantive design grounding by itself. |
| `ALLOW_CODE_INGEST` + `CODE_RECIPE_INGEST` + compatible `code_ingest` | Allow exact licensed recipe/primitive extraction with source/version, attribution and license retention. Per-item rights require exact item evidence. |
| `BUILD_TIME_LIBRARY` | Allow `BUILD_DEPENDENCY` only inside `gym/runs/<case>/variants/<slot>/`; deny vendoring/promotion into `engine/core`, `engine/registry`, or redistributable KINETIC storage. Aceternity remains this class. |
| `NO_AUTOMATED_INGEST` or `automated_access=PROHIBITED` | Deny browser/web/crawler/capture automation. Manually supplied abstract notes may remain reference-only. |
| `VERIFY_REQUIRED` | Allow metadata and manual abstract reference only; deny code ingest, assets, automated fetch and build dependency. Originkit remains here. |
| `LICENSE_GATED` / `LICENSE_GATED_RUNTIME` | Deny until a non-secret entitlement reference is supplied; never persist the credential. |
| `TOOL_DISCOVERY_ONLY` | Allow tool metadata and outbound discovery; cannot count as design evidence or authorize the discovered tool. |
| `NO_INGEST` | Deny all ingestion; retain minimal registry metadata and evidence. |

A verified repository license covers only that repository/package. It never flows to a Pro route, third-party icon geometry, logo, font, image, showcase or preview asset.

### 7.3 Stable errors and logging

```text
KINETIC_SOURCE_NOT_FOUND
KINETIC_REGISTRY_INVALID
KINETIC_RIGHTS_DENIED
KINETIC_AUTOMATION_DENIED
KINETIC_ENTITLEMENT_REQUIRED
KINETIC_RIGHTS_STALE
KINETIC_TARGET_FORBIDDEN
```

Denials append a structured case-history event and retrieval rejection with source ID, requested operation, effective decision and evidence URLs. Secrets and raw protected material are never logged.

The permanent verification invariant is enforced by absence of a runtime rights-write path:

```text
SUBAGENT DISCOVERY
-> candidate evidence outside registry
-> parent reproduction/verification
-> separately reviewed registry edit
-> rights status change
```

Gate 4 implements registry loading/resolution only. T40 proves retrieval/capture cannot mutate the registry hash.

---

## 8. Source Registry integration

- Loader: `engine/knowledge/source-registry.mjs`.
- Schema: `schemas/gym/source-registry.schema.json` plus inline external reference to `source-audit-record.schema.json`.
- Accepted machine version: exact stored value `registry_version: "0.1.2"`; UI/docs may display `v0.1.2`.
- Validation occurs once per runner command and its hash/version enter every retrieval/rights receipt.
- Source lookup is exact by `source_id`; URL lookup canonicalizes only trailing slash/default-port differences and never merges distinct routes.
- Filtering accepts requested knowledge domain/source kind/usage mode, then applies rights as a deny/downgrade layer.
- Provenance export copies only IDs, canonical URLs, rights decision, evidence URLs, verification date and selected abstract knowledge—not raw assets/code.
- Future expansion is append-only and manually reviewed; no crawler or bulk ingest is part of Phase 2.5.

Gate-4 implementation begins by reconciling the wrapper schema mismatch. It must prove the accepted 27 source records and each rights field are byte-identical before and after that schema-only correction.

---

## 9. Obsidian adapter and generated mirror

### 9.1 Runtime-independent read adapter

Default root: `KINETIC_OBSIDIAN_ROOT` if set, otherwise `/knowledge/HermesVault`. Missing/unreadable root produces:

```json
{"availability":"unavailable","notes":[],"reason":"..."}
```

and retrieval continues from repository data.

Allowlisted roots only:

- `01-Projects/KINETIC/`
- `02-Research/Design/`
- `03-Concepts/`
- `04-Sources/`
- `05-Decisions/`

The adapter performs lexical matching over path/title/frontmatter/body but returns at most 5 notes and at most 1,200 characters of relevant excerpt per note. It does not inject whole files or the whole vault. Stable ranking prefers exact `kinetic_source_id`, accepted decision, title/path match, then body match.

Every used note records:

```text
note_path
kinetic_source_id | null
reason_retrieved
knowledge_used
trust_level
content_sha256
```

Trust levels: `ACCEPTED_DECISION`, `CANONICAL_CONCEPT`, `VERIFIED_SOURCE_SYNTHESIS`, `UNVERIFIED_NOTE`. Trust affects ranking only. It never changes rights.

### 9.2 Authority and rights rules

- Repository wins for schemas, registry/rights, receipts, DesignCases, runs, tests and build provenance.
- A note whose `kinetic_source_id` resolves to a repo source inherits the repo’s effective restrictions.
- A missing/unknown source ID is advisory only.
- A note that claims broader rights than the repo is recorded as a contradiction and ignored for authorization.
- Obsidian unavailability is never a build failure if repository retrieval is sufficient.

### 9.3 Generated mirror

`gen-obsidian-mirror.mjs` reads canonical repo data and writes only to ignored `gym/exports/obsidian/`:

```text
manifest.json             source file hashes + generated note hashes
01-Projects/KINETIC/...
02-Research/Design/...
04-Sources/...
05-Decisions/...
APPLY_TO_VAULT.sh         explicit host-side copy with preflight/hash checks
```

The generated headers say `DERIVED — REGENERATE FROM KINETIC REPOSITORY`. The apply script refuses a nonmatching destination root and never carries credentials. Gate 4 proves staging generation; it does not apply to the read-only vault.

---

## 10. FidelityReport

Schema: `kinetic/gym/fidelity-report@0.1`.
Path: `gym/runs/<case>/reports/fidelity-v0.json`.

Hard identity fields:

```text
case_id
variant_id = V0
classification = INTERNAL_REFERENCE_STUDY
deployable = false
original_work = false
reference_design_case_id
created_at
producer
```

Required dimensions:

```text
layout
typography
color
spacing
asset_treatment
depth
hierarchy
motion
scroll_choreography
interaction
transition_behavior
narrative_pacing
```

Each dimension records:

```text
status:
  CAPTURED_WELL
  PARTIALLY_CAPTURED
  NOT_CAPTURED
  NOT_REPRODUCIBLE
  LICENSED_OR_PROPRIETARY_DEPENDENCY
  APPROXIMATED_BEHAVIOR
observation
evidence_source
inspection_quality
capture_refs[]
source_refs[]
engine_inference | null
limitations[]
```

Overall fields:

```text
understood: true | false | partial
coverage_summary
unresolved_dimensions[]
approval: APPROVED | REVISE | REJECTED
approval_producer: human
approval_reason
approved_at
```

Static DOM inspection alone may support layout facts but cannot mark motion/interaction/scroll/transition as `CAPTURED_WELL`. Those require motion-state capture IDs or explicit human evidence. V1/V2 `add-slot` refuses until `approval=APPROVED` by human.

---

## 11. Pre-build design review

### 11.1 Hybrid but non-opaque

The gate is hybrid:

1. deterministic hard rules in `prebuild-review.mjs`;
2. optional model-assisted structured observations, labeled `ai-critic`, never a hidden score;
3. explicit decision assembled from rule results plus cited observations.

An opaque aggregate model score cannot approve. Every hard rule must pass. A model can recommend REVISE/REJECTED but cannot waive schema, rights, retrieval, V0, originality or signature requirements.

### 11.2 Required weak-plan checks

Stable rule IDs:

```text
PB01_GENERIC_HERO_CARDS
PB02_DEFAULT_TYPOGRAPHY
PB03_NO_ASSET_STRATEGY
PB04_NO_SIGNATURE_MOVE
PB05_DECORATIVE_ONLY_MOTION
PB06_NO_TRANSITION_STORYBOARD
PB07_NO_DEPTH_DECISION
PB08_WEAK_NARRATIVE
PB09_INSUFFICIENT_SOURCE_GROUNDING
PB10_DERIVATIVE_COMPOSITION
PB11_COMPONENT_SOUP
PB12_RIGHTS_MISMATCH
PB13_WEAK_QUALITY_HYPOTHESIS
PB14_SOURCE_ORDER_VIOLATION
PB15_ORIGINALS_BEFORE_V0
```

Rule examples are structural and inspectable: a section plan containing only hero/cards/footer plus no authored focal/spatial/signature concept triggers PB01; empty/generic typography roles trigger PB02; more than two implementation influences or more than one component-catalogue build dependency triggers PB11.

Output:

```text
decision: APPROVED | REVISE | REJECTED
rule_results[]: rule_id, pass/fail, evidence_path, reason
advisory_observations[]: producer, observation, severity, confidence
blocking_reasons[]
reviewer
created_at
```

The test suite includes one intentionally weak synthetic brief exhibiting generic hero/cards, default typography, no assets/depth/signature and component soup; it must return REVISE or REJECTED and never reach BUILDING.

---

## 12. Motion-token validator

### 12.1 Approved source

`engine/tokens/motion-tokens.json` is the machine source. It includes the current manifest-consumed names (`duration-fast`, `duration-med`, `duration-slow`, `duration-page`, `stagger-base`, `marquee-speed`, `parallax-depth`) plus documented duration/delay/stagger/easing/distance/opacity/scale/spring values and evidence tags. Candidate `.kinetic/tokens.json` may select/override only declared keys with brief-linked evidence.

Historical candidate token files remain untouched.

### 12.2 Scan scope

Scan candidate-authored `.html`, `.css`, `.js`, `.mjs` under the variant directory. Exclude:

- `node_modules/`;
- installed `kinetic/core/` and vendored library files already covered by their own manifests;
- `.kinetic/` contract files;
- minified/generated files;
- binary/assets.

Narrow detections:

- CSS transition/animation duration and delay raw `ms`/`s`;
- raw cubic-bezier/named easing where a CSS variable/token is required;
- nonzero translate/distance and non-identity scale/rotation in animated rules;
- intermediate opacity/scale animation values (intrinsic endpoints opacity 0/1 and scale 1 are exempt);
- JS animation option keys: duration, delay, stagger, easing, distance, opacity, scale and spring members;
- reduced-motion branch or stylesheet when motion exists.

This is intentionally not perfect static analysis. It reports file/line/property/value. AST tooling is deferred until measured regex false positives justify another dependency.

### 12.3 Exceptions

`motion_plan.token_exceptions[]` requires:

```text
file
line_or_symbol
property
raw_value
reason
evidence_ref
scope
```

The validator matches exact location/property/value. Wildcard exceptions and “because design” fail. Report includes `approved_exception` rows. Reduced-motion absence cannot be excepted.

---

## 13. Playwright pin, configuration and resources

### 13.1 Dependency and install

Exact package verified from npm registry on 2026-08-22:

```json
"playwright-chromium": "1.62.1"
```

Gate-4 install commands, not run in Gate 3:

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
NPM_CONFIG_CACHE="$PWD/.cache/npm" \
npm ci

PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" \
TMPDIR="$PWD/.tmp/playwright" \
npx playwright install chromium
```

Do not use `--with-deps` automatically. Missing host libraries are a surfaced Gate-4 blocker, not an unapproved system mutation.

### 13.2 Paths and lifecycle

- package/config root: repository root; no separate Playwright test runner/config is needed because capture is a direct library CLI.
- browser cache: `.cache/ms-playwright/`.
- npm cache: `.cache/npm/`.
- general temp: `.tmp/playwright/`.
- per-run profile/temp: `gym/runs/<case>/.tmp/capture-<nonce>/`.
- durable captures: `gym/runs/<case>/captures/`.
- browser: one Chromium process per capture invocation, one isolated context per subject/viewport, closed in `finally`.
- partial temp files are removed in `finally`; durable artifacts are written only after successful hash verification.

### 13.3 Viewports

```text
desktop: 1440 × 900, deviceScaleFactor 1, isMobile false, hasTouch false
mobile:   390 × 844, deviceScaleFactor 1, isMobile true,  hasTouch true
```

`reducedMotion` is explicit per spec: `no-preference` for primary visual evidence and `reduce` for required reduced-motion verification. The manifest records both package version and `browser.version()`; it never assumes a Chromium version from package version.

### 13.4 Assumptions

Initial support is local Linux/Node ≥20 only. Chromium-only. CI is not required for Phase 2.5, but the fixture test must run in the current sandbox. Browser install size and free disk are checked before download; `/tmp` is not used for npm/browser/profile data.

---

## 14. Durable visual capture pipeline

### 14.1 Minimum capture set

For reference, V0, V1 and V2 where available:

Desktop:

- initial viewport;
- representative mid-scroll;
- signature state;
- final/end state.

Mobile:

- initial viewport;
- representative content state.

Relevant interaction specs include action, target selector, pre-state, post-state and checkpoint timing/progress. A signature move must have at least pre and post/checkpoint evidence.

### 14.2 Capture plan and actions

Capture specs are supplied as validated JSON inside the manifest request. Supported actions are deliberately small:

```text
goto
scroll_to_px | scroll_to_selector
hover
focus
click
wait_for_selector
wait_ms (bounded)
kinetic_seek(handle_id, progress) when page exposes window.__KINETIC_CAPTURE__
```

No arbitrary JavaScript from source registry entries is executed. A candidate may expose the optional dev-only `window.__KINETIC_CAPTURE__` hook for deterministic handle seeking; generic DOM action capture remains the fallback.

### 14.3 Capture manifest entry

Every entry contains at minimum:

```text
capture_id
case_id
subject_id (reference or variant ID)
variant_or_reference
attempt
viewport
width
height
device_scale
capture_mode: STATIC_CAPTURE_STABLE | MOTION_STATE_CAPTURE
state
url
trigger_action
target_selector | null
checkpoint_ms | null
checkpoint_progress | null
timestamp
playwright_version
browser_version
artifact_path
sha256
visual_phash
reduced_motion
readiness
notes
```

Motion sequences add `sequence_id`, `sequence_index`, and checkpoint metadata. A static filename is never the manifest key.

### 14.4 Artifacts and conversion

Playwright captures PNG bytes in memory. A blank Chromium page decodes the PNG into `ImageBitmap`, draws it to canvas, emits WebP, and computes a 16×16 luminance perceptual hash. Node writes WebP once to:

```text
gym/runs/<case>/captures/artifacts/<sha256>.webp
```

This uses the existing browser dependency and Node crypto—no image library. If Chromium cannot produce WebP, the command fails rather than changing format silently.

---

## 15. Capture reproducibility

### 15.1 Readiness sequence

1. set seed/init script before page code (`window.__KINETIC_SEED__`);
2. create exact context viewport/DPR/reduced-motion;
3. navigate with bounded DOMContentLoaded timeout;
4. wait for `document.fonts.ready` with timeout and record loaded/timeout;
5. await visible image `decode()` results; broken required images fail;
6. bounded network-idle wait; open sockets do not wait forever;
7. require configured ready selector or optional `window.__KINETIC_CAPTURE__.ready()`;
8. set scroll/cursor/focus state;
9. perform action/checkpoint;
10. settle for bounded two animation frames or explicit hook;
11. capture and hash.

Time-dependent content receives a fixed clock only when the page supports it. Random particles/layouts receive a fixed seed. Canvas/WebGL requires a ready hook or a stable pixel probe; absence is a capture limitation/failure, not guessed readiness.

### 15.2 Static versus motion

- `STATIC_CAPTURE_STABLE`: after the desired state is reached, caret/cursor noise and unrelated looping animations may be paused. The capture records that stabilization occurred.
- `MOTION_STATE_CAPTURE`: animations are not globally disabled. The system captures an explicit trigger and checkpoint time/progress; KINETIC handles are sought where available.

Reduced-motion is a separate capture context. It must preserve content/end state, not freeze an empty pre-animation state.

### 15.3 Retry policy

- transient navigation/browser crash: retry missing capture ≤3 with backoff;
- deterministic selector/readiness failure: no blind retry; write failure entry and block completeness;
- same capture spec + matching artifact hash: reuse entry;
- same spec + different hash: retain both attempt entries and mark nondeterminism; third mismatch blocks for diagnosis;
- no manifest entry is written until durable artifact hash resolves.

---

## 16. Vision critic interface

### 16.1 Request

```text
reference_capture_ids
candidate_capture_ids
variant_brief_ref
rubric_version
relevant_provenance_refs
optional_fidelity_report_ref
capture_hashes
prompt_version
```

### 16.2 Response

The critic returns only structured observations using the design-quality schema:

```text
dimension
observation
kind: STRENGTH | FAILURE
severity
confidence
evidence_capture_ids
```

Required dimensions:
`composition`, `typography`, `art_direction`, `depth`, `motion`, `interaction`, `scroll_story`, `originality`, `cohesion`, `surface_fit`.

### 16.3 Identity receipt and authority

Before a call can be accepted, receipt records:

```text
provider
exact_model
route
vision_image_capability
cost_status: VERIFIED_FREE | VERIFIED_PAID | UNKNOWN
limits | null
capture_hashes
prompt_version
rubric_version
response_sha256
called_at
```

If provider/model/route/image capability cannot be verified, the module returns `KINETIC_VISION_UNVERIFIED`; no authoritative automated score is persisted and evaluation uses `HUMAN_VISUAL_GATE`.

Even a verified critic is advisory in Phase 2.5: it cannot write files, transition state, set `design_qualified`, override rights, or override human review. Model/provider identity is never inferred from a tool label.

---

## 17. Design-quality rubric

Schema: `kinetic/gym/design-quality-evaluation@0.1`.

No aggregate number is required or used for qualification. Each required dimension stores:

```text
status: NOT_EVALUATED | STRENGTH | ACCEPTABLE | WEAK | FAILURE
observations[]
strengths[]
failures[]
severity: none | low | medium | high | blocker
confidence: 0..1 | null
evidence_capture_ids[]
producer: ai-critic | human
```

Report-level fields:

```text
case_id
variant_id
rubric_version
producer
capture_manifest_ref
brief_ref
provenance_refs[]
vision_receipt | null
limitations[]
advisory_recommendation: ADVANCE_TO_HUMAN | REVISE | REJECT | HUMAN_VISUAL_GATE
created_at
```

Technical gates live in technical reports and `technically_qualified`. The rubric cannot set technical status. The runner explicitly rejects any automated evaluation that attempts to set `design_qualified`.

---

## 18. Human design-quality gate and TasteDecision update flow

### 18.1 Review inputs

The workbench collects, with no defaults:

- relative preference: `V1`, `V2`, `tie`, `neither`;
- V1 absolute quality floor: yes/no;
- V2 absolute quality floor: yes/no;
- V1 acceptable for further taste learning: true/false;
- V2 acceptable for further taste learning: true/false;
- overall outcome: `WINNER_SELECTED`, `PARTIAL_ACCEPTANCE`, `REJECT_ALL`;
- reasons/tags/freeform.

These are stored independently. The CLI does not derive one from another.

### 18.2 Consistency rules

- `WINNER_SELECTED`: relative preference must be V1 or V2 and the explicitly named winner must have quality-floor `true`; no automatic field fill occurs.
- `PARTIAL_ACCEPTANCE`: at least one explicit per-candidate floor or learning-acceptance value is true, but a unique accepted winner is not required.
- `REJECT_ALL`: both floor values and both learning-acceptance values are false; relative preference may still express weak V1/V2/tie evidence.
- V0/reference/baseline cannot be winner or learning candidates.

### 18.3 Exact update flow

1. Workbench exports a complete TasteDecision JSON; it does not write the repo.
2. `record-human-review --decision <path>` validates schema and all referenced captures/candidates.
3. Under case lock, write a new immutable file under `gym/taste/decisions/` using create-exclusive semantics.
4. Append its ID/path/hash to the Phase-2.5 case run.
5. Set each original’s explicit `design_qualified` to its human floor value and `acceptable_for_further_taste_learning` to the separately supplied human value.
6. Advance batch slots from REVIEW_READY to HUMAN_REVIEWED atomically.
7. Never update TasteProfile automatically in Phase 2.5; any later consolidation remains separately approved.
8. A correction is a new decision with `supersedes`; the old file and human state history remain.

---

## 19. Production review workbench

`gen-review-package.mjs` reads only durable manifests/reports and derives links with `path.relative()` plus existence/hash checks.

Visible columns/groups:

1. **PHASE-2 IZANAMI — REJECTED BASELINE**: immutable V0–V3 comparison evidence and exact human rejection summary; clearly labeled historical and rejected.
2. **WANAKA REFERENCE**: reference captures/evidence only.
3. **WANAKA V0 — FIDELITY STUDY**: internal, undeployable, FidelityReport and limitations.
4. **WANAKA V1 — ORIGINAL**.
5. **WANAKA V2 — ORIGINAL**.

Each subject exposes desktop/mobile and important state tabs from the capture manifest. It shows technical qualification and design-evaluation status separately. Reference/V0 are visually distinguished from originals and never appear in winner controls.

Controls use unselected radio groups and explicit yes/no fields. HTML contains no `checked`, selected option, default JS state, or inferred winner. Submit/export stays disabled until every required field is answered. The static page exports JSON locally; it has no server/API and cannot mutate evidence.

`batch-review-ready` requires:

- all manifest/report/local links resolve and hashes match;
- baseline comparison evidence exists;
- no default control state;
- only V1/V2 are selectable candidates;
- loss report exists;
- originals remain `design_qualified:null` before review.

---

## 20. SourceToOutputLossReport

Schema: `kinetic/gym/source-to-output-loss@0.1`.
Path: `gym/runs/<case>/reports/source-to-output-loss.json`.

Comparison chain:

```text
WANAKA REFERENCE -> V0 -> V1 / V2
```

Required stages:

```text
source_inspection
retrieval
analysis
planning
typography
assets
composition
depth
motion
interaction
implementation
evaluation
```

Each finding records:

```text
finding_id
stage
subject_from
subject_to
label: SOURCE-DERIVED | ENGINE-INFERENCE | HUMAN-FEEDBACK
observation
quality_loss
why
avoidable: true | false | unknown
responsible_subsystem
source_refs[]
capture_refs[]
report_refs[]
human_feedback_refs[]
possible_remediation
remediation_label: ENGINE-RECOMMENDATION
confidence
```

Visual claims require capture or human-feedback references. SOURCE-DERIVED claims require source evidence. Missing evidence fails schema/semantic validation; the report never fabricates a visual fact. The report diagnoses the engine; it does not auto-promote a remediation.

---

## 21. Execution telemetry

Schema: `kinetic/gym/execution-telemetry@0.1`.
Path: `gym/runs/<case>/telemetry.json`.

Stage objects for:

```text
planning
retrieval
prebuild_review
build
capture
technical_evaluation
design_evaluation
repair
review_package_generation
human_review_waiting
```

Each has `started_at`, `ended_at`, `duration_ms`, `status`, `attempt`, and optional receipt refs. Runner derives durations only from recorded timestamps.

Metrics where exposed:

```text
model
provider
model_calls
tokens_input
tokens_output
tool_calls
vision_calls
repair_attempts
build_attempts
asset_preparation_ms
monetary_cost
monetary_cost_status
availability_notes[]
```

Unknown values are null with an availability note or explicit `unknown` enum. Never estimate. `monetary_cost=0` requires `monetary_cost_status=VERIFIED_FREE`; otherwise cost is null even when a model name contains “free”.

---

## 22. Originality integration

### Before build

VariantBrief states:

- prohibited copying;
- retained/rejected principles;
- major composition/layout/type/motion differences from Wanaka;
- asset non-reuse strategy;
- signature move originality hypothesis.

Prebuild rules reject derivative section order, exact geometry, copied copy/assets and component-soup substitution.

### After build

Existing comparator continues:

- copy similarity;
- asset host/reuse;
- layout similarity;
- section-order similarity;
- typography/color/interaction overlap;
- weighted structural fingerprint similarity.

Capture manifests add perceptual hashes. `originality-compare.mjs` compares matched reference/candidate viewport/state pHashes and reports `visual_fingerprint_similarity` separately. It is an originality warning signal, not a design-quality score. V0 remains explicitly exempt; V1/V2 must pass or receive a separate explicit human originality waiver. No waiver can legalize copied assets/code.

Originality and excellence remain independent: low similarity cannot qualify weak design; high quality cannot excuse copying.

---

## 23. Backward compatibility

### 23.1 Version boundary

- Historical `case.json` files with top-level `kinetic/gym/variant-run@0.1` remain byte-immutable.
- New runs use top-level `kinetic/gym/case-run@0.2` and per-slot `kinetic/gym/variant-run@0.2`.
- `store.readCase()` detects legacy shape and returns an in-memory adapter sufficient for old `next/status/record/gate/receipt` commands.
- Phase-2.5 commands require `case-run@0.2` and never auto-upgrade a legacy file.

### 23.2 Taste and other schemas

`taste-decision.schema.json` accepts both versions. Existing `@0.1` required fields/semantics remain. New `@0.2` adds fields; old decisions are not rewritten. Existing DesignCases are unchanged; a Wanaka DesignCase is created only after Gate 4 approval and when V0 execution begins.

### 23.3 Regression boundary

The following are immutable fixtures:

- all `gym/runs/case-fe653973ef/variants/v0..v3/` artifacts;
- first IZANAMI TasteDecision and batch pointer;
- negative knowledge and TasteProfile confidence;
- Phase-2 test evidence and fingerprints.

Tests hash protected files before/after Phase-2.5 engine tests and fail on mutation.

---

## 24. Kill/resume by Phase-2.5 state

| Durable state on crash | Resume behavior |
|---|---|
| `BRIEF_VALIDATED` | Reuse brief hash; if receipt exists and matches, prove retrieval; otherwise run/reuse retrieval receipt. |
| `RETRIEVAL_PROVEN` | Reuse receipt and run prebuild review; no repeated source fetch. |
| `PREBUILD_APPROVED` | Start/restart build attempt only; upstream artifacts fixed by hash. |
| `BUILDING` | If no complete build receipt, mark transient failure and return to PREBUILD_APPROVED with incremented attempt; never claim BUILT from files alone. |
| `BUILT` | Reuse build artifact hash and run missing technical reports. |
| `TECHNICAL_EVALUATED` | If qualified, capture only missing specs; if false, await explicit repair/reject. |
| `VISUAL_CAPTURED` | Reuse manifest and hashes; run/reuse design evaluation. |
| `DESIGN_EVALUATED` | Reuse rubric; generate missing loss/package artifacts or explicit repair. |
| `REVIEW_READY` | Wait. Never regenerate decision, recapture, or call model. Human review state is untouched. |

No duplicate captures where capture spec and artifact hash match. No duplicate receipts with the same idempotency key. No repeated model call if a valid response receipt exists. A stale lock takeover is logged. `record-human-review` is create-exclusive and never overwrites a decision.

---

## 25. Exact test matrix

| ID | Concrete test and assertion | Test file |
|---|---|---|
| T1 | Phase-2.5 `PREBUILD_APPROVED/BUILDING` rejects absent VariantBrief; state unchanged. | contracts |
| T2 | Required VariantBrief field/type/source-attribution violation fails schema. | contracts |
| T3 | Normal original with empty DesignCase selection returns `KINETIC_EMPTY_RETRIEVAL`. | contracts |
| T4 | Rights matrix blocks every usage mode that exceeds each rights status. | contracts |
| T5 | `VERIFY_REQUIRED` source cannot authorize RECIPE/PRIMITIVE/code ingest. | contracts |
| T6 | `NO_AUTOMATED_INGEST`/prohibited access blocks fetch and capture. | contracts/capture |
| T7 | BUILD_TIME_LIBRARY target under `engine/core` or `engine/registry` is denied; candidate-local target allowed. | contracts |
| T8 | Missing HermesVault yields `availability=unavailable` and repo-only retrieval succeeds. | contracts |
| T9 | Selected Obsidian result persists path/source ID/reason/knowledge/trust/hash. | contracts |
| T10 | Broader rights claimed by note cannot change resolver decision. | contracts |
| T11 | `add-slot V1/V2` rejects absent/invalid/unapproved FidelityReport. | contracts |
| T12 | Intentionally weak hero/cards/default-type/no-assets/no-signature brief returns REVISE/REJECTED. | contracts |
| T13 | Valid brief+receipt+approved review reaches BUILDING through adjacent transitions only. | contracts |
| T14 | Token-compliant CSS/JS plus reduced-motion branch passes. | contracts |
| T15 | Raw unapproved timing/easing/distance/scale/spring values fail with file/line evidence. | contracts |
| T16 | Exact justified exception passes and appears in report; wildcard exception fails. | contracts |
| T17 | Capture manifest generated by fixture validates. | capture |
| T18 | Every capture SHA resolves and recomputes; missing/mismatch blocks. | capture |
| T19 | Desktop 4-state + mobile 2-state completeness passes; each missing state fails. | capture |
| T20 | Re-run same spec/hash reuses entry; partial crash retries only missing specs. | capture/resume |
| T21 | Critic response without verified provider/model/route/image capability is rejected for authoritative use and yields HUMAN_VISUAL_GATE. | contracts |
| T22 | Structured critic output validates all dimensions and cited capture IDs. | contracts |
| T23 | Design-quality schema rejects collapsed score-only output. | contracts |
| T24 | `technically_qualified=true` leaves `design_qualified=null`; no implicit promotion. | contracts |
| T25 | WINNER_SELECTED requires explicit unique relative winner and explicit human floor true. | contracts |
| T26 | PARTIAL_ACCEPTANCE supports explicit useful/accepted signal without forced winner. | contracts |
| T27 | REJECT_ALL requires both originals floor=false and learning=false while permitting weak relative preference. | contracts + existing rejection test |
| T28 | learning acceptance is stored only from its own field, not copied from winner/floor. | contracts |
| T29 | Review-package links and capture/report links resolve; only V1/V2 are controls. | review link test |
| T30 | Loss report validates required stages, labels and remediation fields. | contracts |
| T31 | Null/unknown token and cost metrics validate; zero cost without verified-free fails. | contracts |
| T32 | Existing Phase-2 schemas/artifacts and IZANAMI decision continue to validate/behave. | contracts + rejection test |
| T33 | Existing Phase-2 kill/resume regression still passes. | resume |
| T34 | Kill/resume from every new durable state resumes at next unmet guard. | resume |
| T35 | Transition, artifact and receipt hashes are stable across idempotent reruns. | resume |
| T36 | Full Phase-2 regression commands remain green and protected hashes unchanged. | package test script |
| T37 | Every skipped/non-adjacent/backward transition is denied except declared retry paths. | contracts |
| T38 | Concurrent lock acquisition admits one holder; dead/TTL-stale holder takeover is atomic and logged. | resume |
| T39 | Registry wrapper validates, exact version=0.1.2, 27 unique IDs/URLs and accepted source policy fields unchanged. | contracts |
| T40 | Retrieval/capture exports cannot mutate registry; pre/post registry SHA is identical. | contracts |
| T41 | V0 originality exemption is retained; V1/V2 require originality report. | contracts |
| T42 | Capture CLI consults DesignCase/source access decision before browser launch. | contracts/capture |
| T43 | Visual rubric/loss finding without capture or human evidence is invalid. | contracts |
| T44 | Workbench contains IZANAMI rejected baseline and has no checked/selected/default outcome. | review link test |
| T45 | Browser/npm/profile/temp paths are project-local; fixture leaves no run temp and uses no `/tmp` path. | capture |
| T46 | Phase-2.5 init creates V0 only; V1/V2 become PLANNED only after human V0 approval; third original denied. | contracts |
| T47 | Human decision write is append-only/create-exclusive; correction requires `supersedes`; HUMAN_REVIEWED cannot be overwritten. | contracts/resume |
| T48 | Perceptual hash exists; originality stores visual similarity separately from design score. | contracts/capture |

### Commands to prove the gate

Exact package scripts are defined during Gate 4, targeting:

```bash
npm run test:phase2
npm run test:phase2.5:contracts
npm run test:phase2.5:resume
npm run test:phase2.5:capture
npm test
node engine/tests/test-review-package-links.mjs
node engine/tests/test-taste-reject-all.mjs
```

Every new nontrivial behavior follows RED → observed expected failure → minimal GREEN → full regression. No generated Wanaka artifact is used as a test fixture.

---

## 26. Dependency-aware implementation order

This order adjusts the proposed list only where a real dependency requires it.

1. **A0 — contract validator and registry wrapper alignment.** RED tests first; implement the JSON-Schema subset validator; align source-registry wrapper; prove 27 policy records unchanged. Required before trusting any new schema.
2. **A1 — schemas/version boundary.** Add case-run, VariantBrief, retrieval, prebuild, FidelityReport, capture, design rubric, loss, telemetry and motion-token schemas; add backward-compatible variant/taste versions.
3. **B — executable rights layer.** Implement read-only registry/audit loader and authorization matrix; no source crawling or rights writes.
4. **C — durable store and state machine.** Atomic lock/write/idempotency plus additive Phase-2.5 states; preserve legacy CLI behavior.
5. **D/E — retrieval + VariantBrief path.** Implement deterministic retrieval receipt, then brief validation/cross-linking. Retrieval precedes brief authoring operationally; lifecycle proof follows brief validation as specified.
6. **F — optional Obsidian adapter and staged mirror.** Prove fallback and rights non-override before allowing note results into receipts.
7. **G — prebuild review and signature-move checks.** Land weak synthetic brief rejection before a valid brief can reach BUILDING.
8. **H — FidelityReport and V0-original barrier.** Implement V0 report/human approval guard and V0-only initialization.
9. **I — telemetry.** Instrument the now-stable transition/store boundaries; no event service.
10. **J — package/cache setup and Playwright Chromium install.** Only after Gate-3 approval and within Gate-4 implementation. Verify disk and project-local paths.
11. **K — capture manifest and capture pipeline.** Fixture-first, deterministic static/motion/reduced-motion evidence and hashing.
12. **L/M — vision boundary + design rubric.** Shared observation schema; identity verification; human fallback; no qualification.
13. **N — motion-token catalogue and validator.** Implement narrow source scan and exceptions; wire into technical evaluation. It is ordered after schemas/state but before any real build.
14. **O — human state/TasteDecision `@0.2`.** Implement explicit independent outcomes and append-only update.
15. **P — SourceToOutputLossReport semantic validation.** Require evidence refs.
16. **Q — production review workbench.** Extend existing link-derived generator and no-default controls.
17. **R — full Phase-2 + Phase-2.5 regression and protected hash audit.** Remove no evidence; no Wanaka artifacts exist.
18. **S — request Gate-4 ENGINE IMPLEMENTATION READY approval.** Stop.
19. **T — only after Gate-4 approval: create Wanaka DesignCase and V0 slot/brief; build V0.**
20. **U — capture/evaluate V0 and obtain genuine human FidelityReport approval.** Stop if REVISE/REJECTED.
21. **V — only after V0 approval: create, plan and build at most V1/V2.**

Why telemetry precedes Playwright: capture and model durations need the final event boundary. Why motion validation lands after capture modules: it is independent, but both must be green before Gate 4; this order keeps earlier vertical state slices executable and avoids changing the existing browser evaluator prematurely.

---

## 27. Proposed Gate 4: ENGINE IMPLEMENTATION READY

After Gate-3 approval, write and request approval of `04-slices.md` before code. Gate-4 implementation then proceeds slice-by-slice. Gate 4 is not approved until all acceptance criteria below are proven.

### Gate-4 acceptance criteria

- all listed contracts implemented and validated by the in-repo validator;
- registry schema wrapper aligned; exact registry version 0.1.2 and 27/27 accepted policy records unchanged;
- permanent subagent→parent rights invariant preserved; no runtime rights-write path;
- rights resolver tests pass, including VERIFY_REQUIRED, automation, entitlement and build-time-core boundary;
- state machine and atomic store pass adjacent transition, lock, stale recovery, idempotency and resume tests;
- VariantBrief, retrieval provenance, prebuild weak-plan rejection and V0 barrier functional;
- Obsidian unavailable fallback and rights non-override functional; staged mirror generated but not host-applied;
- Playwright Chromium 1.62.1 installed project-locally and exact browser version recorded;
- fixture captures desktop/mobile/static/motion/reduced-motion; manifests/hashes/links validate;
- vision interface rejects unverified identity and produces HUMAN_VISUAL_GATE; verified fixture response validates structurally;
- design rubric, motion validator, telemetry, loss report, human outcomes and review workbench pass tests;
- Phase-2 tests and kill/resume regression green; protected IZANAMI evidence hashes unchanged;
- parallel builders ≤2, repairs ≤3, originals cap=2 encoded;
- cron, auto-promotion, deployment, global promotion, 1000-case curriculum and 10×10 Gym remain off;
- **no Wanaka DesignCase/run/candidate/capture exists yet**.

Gate-4 approval authorizes Wanaka V0 only, not V1/V2. V1/V2 require a separate V0 fidelity approval.

---

## 28. Resource budget

```text
parallel builders:                 <= 2
candidate repair attempts:         <= 3
Wanaka originals:                  <= 2 (V1, V2)
Playwright browsers:               Chromium only
browser process per capture CLI:   1
Obsidian notes per retrieval:       <= 5
Obsidian excerpt per note:          <= 1,200 chars
capture retries per transient spec: <= 3
Cron:                              OFF
Auto-promotion:                    OFF
Deployment:                        OFF
Global skill promotion:            OFF
1000-case curriculum:               OFF
10x10 Design Gym:                  OFF
```

No bulk source fetch/corpus expansion occurs. Registry maintenance is manual and evidence-gated.

---

## 29. Risks and blockers

| Risk | Likelihood | Impact | Mitigation | Blocking now? |
|---|---|---:|---|---|
| Playwright package/browser footprint | medium | high | Exact Chromium-only pin; preflight disk; project cache; no multi-browser install. | No for Gate 3; Gate-4 install failure blocks Gate 4. |
| 512 MiB `/tmp` exhaustion | high if defaults used | high | Force npm/browser/profile/temp under repository; test path use; cleanup in `finally`. | No; encoded plan. |
| Dynamic-site capture instability | high | high | Bounded readiness, explicit selectors/hooks, seeded state, preserve divergent retries, fail incomplete sets. | Potential V0 blocker, not engine-plan blocker. |
| WebGL/canvas readiness | medium/high | high | Require ready hook or stable pixel probe; report limitation; never infer successful motion from static DOM. | Potential Wanaka V0 blocker. |
| Vision provider identity uncertainty | high | medium | No authoritative critic use; HUMAN_VISUAL_GATE. | Not blocking engine or review; human required. |
| Rights-status drift / stale terms | medium | high | Record registry version/hash/verified date in receipts; conservative deny/downgrade; re-audit before broader rights use. No runtime upgrades. | No for accepted current registry; future affected use may block. |
| Source Registry wrapper/schema mismatch | certain | high | First Gate-4 slice aligns wrapper only and proves all 27 rights records unchanged. | Not a Gate-3 blocker; must pass before Gate 4 approval. |
| Obsidian unavailable/read-only | high in sandbox | low | Optional adapter, repo fallback, staged generated mirror only. | No. |
| Obsidian prompt bloat | medium | medium | Allowlisted roots, deterministic top 5, 1,200-char excerpts, provenance. | No. |
| Source overfitting to Wanaka | medium | high | Explicit retained/rejected principles, originality plan, structural+pHash comparison, prohibited copying, only two originals. | No; enforced pre/post build. |
| Component-library overuse | medium | high | Max two implementation influences; max one catalogue build dependency; PB11; concept-before-component ordering. | No. |
| Weak/licensed asset availability | high | high | Asset strategy required; placeholders/open/generated only; FidelityReport marks proprietary losses; do not copy. | May block V0 fidelity or force honest approximation. |
| Free-model planning limitations | medium/high | high | Strong structured brief/retrieval, deterministic prebuild rules, human review; metrics honest. | No; may produce REVISE/REJECTED. |
| Human review bottleneck | high | high | Backpressure by stopping at V0 approval and final review; no generation backlog. | Intentional blocker at V0 and final review. |
| Schema complexity | medium | medium/high | One fail-closed subset validator, few shared structures, no Ajv dependency, semantic checks in owning modules. | No; unsupported keyword must fail tests. |
| Runner backward compatibility | medium | high | Additive case-run@0.2, legacy in-memory adapter, old commands retained, protected hashes/regression. | No; any legacy regression blocks Gate 4. |
| Atomic lock races / PID reuse | low/medium | high | Atomic mkdir, nonce, heartbeat TTL, rename takeover, real contention test. | No. |
| PNG→WebP conversion inside Chromium | medium | medium | Fixture test exact bytes/hash; fail instead of silent format fallback. | Gate-4 capture blocker if unsupported. |
| Perceptual hash false confidence | medium | medium | Use only as originality warning; keep structural dimensions and human design judgment separate. | No. |
| Static regex motion scan false positives | medium | medium | Narrow scope, exact exceptions, line evidence; AST deferred until measured. | No unless fixture shows unacceptable behavior. |

### Least-confident decisions to challenge before implementation

1. Requiring human V0 fidelity approval before even creating V1/V2 is deliberately strict and creates an earlier review stop, but it is the only direct enforcement of “V0 before originals.”
2. A small in-repo JSON-Schema subset validator avoids a second dependency but must fail on unsupported keywords; adding Ajv would be simpler only if the “Playwright is the sole dependency” constraint changes.
3. Browser-based PNG→WebP/pHash avoids an image dependency but must be proven in the exact installed Chromium before Gate 4 can pass.
4. Static motion-token scanning is intentionally bounded; it cannot promise perfect source analysis.
5. The 5-note/1,200-character Obsidian ceiling is a conservative prompt-bloat control and can be raised only after retrieval evidence shows loss.

---

## 30. Gate status and stop point

### Confirmed not performed in Gate 3

- no Gate-3-planned engine module, new runtime contract schema, or dependency implementation; only the already accepted Gate-2 source-governance schemas/registry exist;
- no Playwright/npm installation;
- no Wanaka DesignCase file;
- no Wanaka V0, V1 or V2 brief/build/capture;
- no historical Phase-2 mutation;
- no Phase 3, cron, deployment, promotion or broad Gym activation;
- no Obsidian vault write.

**GATE 3 IMPLEMENTATION READINESS: APPROVED 2026-08-22**

The execution plan maps every accepted concept to an exact file, contract, transition, artifact, test and failure behavior. Known implementation risks have bounded Gate-4 proofs and no unresolved planning dependency.

**Approval record:** Gate 3 was approved on 2026-08-22. The next authorized action is planning-only: write `04-slices.md` and request approval before any Gate-4 implementation. No Wanaka candidate work begins.
