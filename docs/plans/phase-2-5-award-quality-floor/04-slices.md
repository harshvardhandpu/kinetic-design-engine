# Gate 4 Slice Plan: Phase 2.5 Award-Quality Floor Calibration

> Gate 4 planning only. This document does not authorize implementation, dependency installation, Wanaka execution, Phase 3, cron, deployment, or promotion.

## 0. Frozen Gate-3 baseline

### Planning checkpoint

- Planning baseline commit: `016b8a9` (`docs: checkpoint phase 2.5 gate 3 planning`).
- Parent Phase-2 baseline: `4e226a6705aa9fc8e5e80c7099356079c0fc14f6` (`record first human taste rejection`).
- Branch at freeze: `main`.
- Gate-3 state: **APPROVED 2026-08-22**.
- The planning checkpoint contains Gate 1–3 documents, the review mockup, source ledger, Source Registry `0.1.2`, and the two Gate-2 source-governance schemas. It contains no Gate-4 implementation.

### Freeze verification

| Check | Result |
|---|---|
| `git diff --exit-code HEAD --` on protected Phase-2 run, taste, negative-knowledge, test-evidence, and Test-9 paths | PASS |
| Existing `engine/tests/test-taste-reject-all.mjs` | PASS |
| Existing `engine/tests/test-review-package-links.mjs` | PASS — 4 links, 0 failures |
| Gate-3 planning status and approval record | PASS |
| Source Registry JSON parse | PASS |
| Source Registry version | PASS — `0.1.2` |
| Source Registry count and uniqueness | PASS — 27 records, 27 unique IDs, 27 unique canonical URLs |
| Core rights fields present on all records | PASS |
| Wanaka content or filename under `gym/` | ABSENT |
| `package.json` / `package-lock.json` at repository root | ABSENT |
| `playwright-chromium` Node import | UNAVAILABLE |
| Gate-3-planned runtime modules/contracts/tests | ABSENT |
| Gate-4 implementation | NOT STARTED |

The two Markdown hard-break spaces in the generated Gate-2 matrix were removed before the checkpoint so `git diff --cached --check` could pass. No source-policy value or historical evidence changed.

### Immutable implementation boundary

Gate-4 implementation uses synthetic fixtures, test-only DesignCases created under project-local test temp, and existing immutable Phase-2 evidence. It must never use Wanaka as an implementation fixture. Before Gate 4 can pass, there must still be no Wanaka V0, FidelityReport, capture, V1, V2, review package, run directory, or run checkpoint.

The selected calibration reference remains planning metadata only:

```text
case-ee9eaf0dc9
Wanaka Studio
```

---

## 1. Slice rules

Every accepted slice:

1. has one coherent responsibility;
2. begins with a focused failing test or, for data-only schema foundations, a failing structural contract check;
3. reaches a green independently reviewable checkpoint;
4. touches only the files listed for that slice;
5. passes its required regression level;
6. runs `git diff --check` before commit;
7. contains no unrelated modification;
8. is committed only when green;
9. is revertible through its named rollback boundary without touching Phase-2 evidence;
10. preserves lifecycle state, `technically_qualified`, `design_qualified`, and `acceptable_for_further_taste_learning` as separate concepts.

A RED test may exist temporarily in the worktree during TDD. It is not a checkpoint and is not committed. Shared files are changed in slice-specific commits; after dependent slices land, rollback proceeds in reverse dependency order.

---

## 2. Complete slice list

| Slice | Name | Primary output | Direct prerequisites | Required regression level |
|---|---|---|---|---|
| S01 | Schema and version foundations | Additive Phase-2.5 contracts, no runtime use | frozen baseline | A |
| S02 | Fail-closed schema-subset validator | Node-stdlib validator and conformance suite | S01 | A, B |
| S03 | Source Registry correction and rights resolver | Validated immutable registry view and deny-first authorization | S02 | A, B |
| S04 | Durable runner lifecycle substrate | additive state machine, atomic store, legacy adapter | S02 | A–D |
| S05 | VariantBrief persistence and enforcement | persisted/hash-bound brief barrier | S04 | A–D |
| S06 | Rights-filtered retrieval provenance | deterministic receipt from permitted view | S03, S04, S05 | A–D |
| S07 | Optional Obsidian read adapter and staged mirror | bounded read-side memory with repo authority | S03, S06 | A, B |
| S08 | Pre-build design review | deterministic weak-plan rejection and build barrier | S06, S07 | A–D |
| S09 | FidelityReport and V0 human boundary | V0-only initialization and human-approved original creation | S08 | A–D |
| S10 | Execution telemetry | nullable evidence-backed timings/counters | S04 | A–D |
| S11 | Playwright Chromium dependency boundary | pinned Chromium, local cache/temp, smoke receipt | S02 | A, B |
| S12 | Capture manifest contracts and completeness | pure manifest/hash/completeness behavior | S04, S11 | A–C |
| S13 | Deterministic visual capture pipeline | local fixture capture, recovery, pHash and rights preflight | S03, S10, S12 | A–C |
| S14 | Vision critic identity boundary | provider-independent request/receipt and human fallback | S12 | A, B |
| S15 | Design-quality rubric integration | evidence-bound rubric without qualification promotion | S04, S13, S14 | A–D |
| S16 | Motion-token enforcement | token catalog, bounded source scan, exact exceptions | S05, S04 | A–D |
| S17 | Human design-quality update flow | append-only explicit human outcomes | S09, S15 | A–D |
| S18 | SourceToOutputLossReport integration | evidence-bound case-level loss diagnosis | S06, S09, S13, S15 | A–C |
| S19 | Neutral production review workbench | fixture-derived comparison and unselected decision export | S17, S18 | A–D |
| S20 | Cross-system idempotency and kill/resume | end-to-end resume without duplicate side effects | S06–S19 | A–D |
| S21 | Full fixture-based Gate-4 regression | all checks, protected hashes, readiness evidence | S01–S20 | A–E |

### Ordering deviations from `03-program-design.md`

Gate 3 grouped validator, registry-wrapper alignment, and schema foundations as A0/A1. This plan separates them without changing architecture:

1. S01 adds parseable, inactive schema/version contracts and inventories their keywords.
2. S02 makes those contracts executable with the approved validator.
3. S03 corrects and executes the Source Registry wrapper and rights policy.

No S01 contract is consumed by production code before S02 passes. Rights still precede retrieval exactly:

```text
S02 schema validation
  -> S03 Source Registry validation
  -> S03 rights-policy resolver
  -> S03 permitted retrieval view
  -> S06 retrieval engine
```

Capture manifest structure is separated from browser automation (S12 before S13), and vision identity is separated from rubric semantics (S14 before S15), because each boundary is independently testable and revertible. Telemetry lands before browser/model operations so those operations use one existing receipt/timing boundary.

---

## 3. Dependency graph

```text
Frozen Gate-3 baseline 016b8a9
  |
  v
S01 Schemas/versions
  |
  v
S02 Validator ------------------------------+
  |                                         |
  +-> S03 Registry + rights ----+            +-> S11 Playwright boundary
  |                             |                    |
  +-> S04 State + store --------+--------+           v
        |                       |        |          S12 Capture manifest
        +-> S05 VariantBrief    |        |            |
        |      |                |        +-> S10 -----+---> S13 Capture pipeline
        |      v                |                           |          |
        |    S06 Retrieval <----+                           +-> S14 --+-> S15 Rubric
        |      |                                                         |
        |      +-> S07 Obsidian -> S08 Prebuild -> S09 Fidelity ----------+-> S17 Human flow
        |      |                                |                         |
        |      |                                +--------------------+    |
        |      +---------------------------------------------------> S18 Loss report
        |
        +-> S16 Motion tokens

S17 + S18 -> S19 Review workbench
S06..S19 -> S20 Idempotency / kill-resume integration
S01..S20 -> S21 Full Gate-4 regression
```

S07 is optional at runtime but required as an implemented and tested Gate-4 capability. Its absence/unavailability must not block repository-only retrieval.

---

## 4. Regression ladder

### LEVEL A — slice-local

Focused tests for the exact behavior changed by the slice. Run the owning test file or named test IDs only. RED must fail for the expected missing behavior; GREEN must pass.

### LEVEL B — affected subsystem

Run all tests for the changed subsystem:

- contracts/schema/rights/retrieval;
- capture/Playwright;
- review/taste;
- runner/store/resume.

### LEVEL C — runner and receipt integration

Exercise CLI composition, adjacent transitions, artifact hashes, receipts, fixture run directories, and cleanup. Test-only runs live under project-local test temp and are deleted.

### LEVEL D — Phase-2 compatibility

Run existing Phase-2 tests and protected-path hash/diff checks:

```bash
node engine/tests/test-taste-reject-all.mjs
node engine/tests/test-review-package-links.mjs
# existing Phase-2 job/runner/kill-resume commands identified in S04/S20
# protected Phase-2 path hash comparison
```

Any Phase-2 mutation or behavior change is a slice blocker.

### LEVEL E — full Gate-4 regression

Run every S01–S20 test, T1–T48, validator conformance, browser smoke/capture, Phase-2 compatibility, protected hashes, registry invariants, Wanaka-absence check, diff hygiene, and side-effect-off assertions.

### Required levels by slice

| Slice | Levels before acceptance |
|---|---|
| S01 | A |
| S02 | A, B |
| S03 | A, B |
| S04 | A, B, C, D |
| S05 | A, B, C, D |
| S06 | A, B, C, D |
| S07 | A, B |
| S08 | A, B, C, D |
| S09 | A, B, C, D |
| S10 | A, B, C, D |
| S11 | A, B |
| S12 | A, B, C |
| S13 | A, B, C |
| S14 | A, B |
| S15 | A, B, C, D |
| S16 | A, B, C, D |
| S17 | A, B, C, D |
| S18 | A, B, C |
| S19 | A, B, C, D |
| S20 | A, B, C, D |
| S21 | A, B, C, D, E |

The whole suite is intentionally not required after every data-only or isolated boundary. S21 is the only mandatory full-suite slice.

---

## 5. Custom schema-validator boundary

### Purpose

`engine/core/schema-validate.mjs` validates only the schema vocabulary used by existing KINETIC and approved Phase-2.5 contracts. It is not a general JSON Schema implementation. An encountered keyword outside the allowlist is a schema error, never ignored.

### Supported annotation and identity keywords

These are recognized and structurally checked but do not add validation behavior:

```text
$schema        string; approved value is JSON Schema draft 2020-12 URI
$id            string
title          string
description    string
default        any JSON value; annotation only
examples       array; annotation only
```

### Supported validation keywords

```text
type
  string form or a unique array of: null, boolean, object, array,
  number, integer, string

required
properties
additionalProperties
  boolean or one schema

enum
const

pattern
minLength
maxLength

minimum
maximum

items
  one schema for every array item; tuple validation is not supported
minItems
maxItems
uniqueItems

$defs
$ref
  local JSON Pointer or relative schema-file reference only
allOf
if
then

format
  date
  date-time
  uri
```

Required semantics:

- `integer` rejects non-integral numbers.
- `uniqueItems` compares JSON values structurally, not by object identity.
- `additionalProperties:false` rejects unknown instance keys.
- schema-valued `additionalProperties` validates every unmatched instance value.
- `format` applies only to strings; `null` remains valid when `type` permits null.
- `date` and `date-time` require calendar-valid values, not regex-only approximations.
- `uri` requires an absolute URI.
- local `$ref` resolves JSON Pointer escapes.
- relative external `$ref` resolves only beneath the repository `schemas/` root.
- network, absolute-path, and path-traversal references fail closed.
- unresolved and cyclic references fail with explicit codes.
- `if` must be paired with `then`; `then` without `if` and `if` without `then` are malformed schemas; Phase-2.5 schemas use each pair inside `allOf`.

### Unsupported keywords

The validator must reject a schema containing any unlisted keyword in schema position. Representative prohibited features include:

```text
oneOf
anyOf
not
else
contains
minContains
maxContains
prefixItems
additionalItems
unevaluatedItems
unevaluatedProperties
patternProperties
propertyNames
minProperties
maxProperties
dependentRequired
dependentSchemas
dependencies
exclusiveMinimum
exclusiveMaximum
multipleOf
$anchor
$dynamicAnchor
$dynamicRef
$recursiveAnchor
$recursiveRef
contentEncoding
contentMediaType
contentSchema
readOnly
writeOnly
deprecated
```

Instance property names inside `properties` and definition names inside `$defs` are not mistaken for schema keywords.

If any approved Phase-2.5 contract genuinely requires one of these features, implementation stops at S01 or S02 and raises a dependency decision. The subset is not silently expanded.

### Fail-closed error classes

```text
KINETIC_SCHEMA_JSON_INVALID
KINETIC_INSTANCE_JSON_INVALID
KINETIC_SCHEMA_MALFORMED
KINETIC_SCHEMA_KEYWORD_UNSUPPORTED
KINETIC_SCHEMA_REF_FORBIDDEN
KINETIC_SCHEMA_REF_UNRESOLVED
KINETIC_SCHEMA_REF_CYCLE
KINETIC_SCHEMA_INVALID
```

Errors include schema path, instance path, keyword, and a short deterministic message; they never include secrets.

### Conformance tests owned by S02

| ID | Conformance assertion |
|---|---|
| CV01 | `$schema`, `$id`, title, description, default and examples are accepted only with valid annotation types. |
| CV02 | every scalar `type` and union type passes/fails correctly; integer rejects fractions. |
| CV03 | required/properties/additionalProperties boolean and schema forms work on nested objects. |
| CV04 | enum and const use structural JSON equality. |
| CV05 | pattern, minLength and maxLength work. |
| CV06 | minimum and maximum include boundaries. |
| CV07 | items, minItems, maxItems and uniqueItems work on nested arrays/objects. |
| CV08 | local `$defs`/`$ref` and JSON Pointer escapes resolve. |
| CV09 | relative external `$ref` resolves beneath `schemas/`. |
| CV10 | network, absolute and traversal refs fail closed. |
| CV11 | allOf combines constraints. |
| CV12 | if/then applies only when the condition validates. |
| CV13 | calendar-valid date/date-time and absolute URI formats pass; malformed values fail. |
| CV14 | oneOf, anyOf, not, else, contains, prefixItems, unevaluatedProperties and patternProperties each produce unsupported-keyword errors. |
| CV15 | malformed schema JSON produces `KINETIC_SCHEMA_JSON_INVALID`. |
| CV16 | malformed instance JSON produces `KINETIC_INSTANCE_JSON_INVALID`. |
| CV17 | invalid keyword values, unresolved refs, and cyclic refs fail closed. |
| CV18 | nested Phase-2.5 VariantBrief, registry audit, case-run and TasteDecision fixtures validate; targeted nested corruption fails at the correct path. |

---

## 6. Slice specifications

## S01 — Schema and version foundations

**slice_id:** `S01`

**name:** Schema and version foundations

**objective:** Add the inactive, additive Phase-2.5 contract shapes and the `@0.1`/`@0.2` version boundary without changing runtime behavior.

**prerequisites:** Frozen planning commit `016b8a9`; approved `03-program-design.md`.

**exact files added:**

- `schemas/gym/case-run.schema.json`
- `schemas/gym/variant-brief.schema.json`
- `schemas/gym/retrieval-receipt.schema.json`
- `schemas/gym/prebuild-review.schema.json`
- `schemas/gym/fidelity-report.schema.json`
- `schemas/gym/capture-manifest.schema.json`
- `schemas/gym/design-quality-evaluation.schema.json`
- `schemas/gym/source-to-output-loss-report.schema.json`
- `schemas/gym/execution-telemetry.schema.json`
- `schemas/motion-tokens.schema.json`
- `engine/tests/test-phase2-5-contracts.mjs`

**exact files modified:**

- `schemas/gym/variant-run.schema.json`
- `schemas/gym/taste-decision.schema.json`

**schemas/contracts involved:** `case-run@0.2`, `variant-run@0.2`, `variant-brief@0.1`, retrieval, prebuild, fidelity, capture, design-quality, loss, telemetry, motion tokens, and additive `taste-decision@0.2`. Legacy `@0.1` branches remain unchanged.

**runner states affected:** None at runtime. Schemas enumerate the approved Phase-2.5 lifecycle but `run.mjs` is untouched.

**tests introduced/activated:** Structural JSON parse, schema-keyword inventory, ID/version uniqueness, and fixtures declared for later S02 validation. No T1–T48 primary ownership.

**acceptance criteria:**

- every added/modified schema parses as JSON;
- every validation keyword is inside the S02 allowlist;
- no `oneOf`, `anyOf`, `not`, `else`, or other unsupported feature is needed;
- `variant-run@0.1` and `taste-decision@0.1` definitions remain semantically present;
- lifecycle and three qualification fields are distinct in contracts;
- no runtime module imports or consumes the new schemas yet.

**rollback boundary:** Revert the S01 schema/test commit. No data migration exists and no run artifact can reference `@0.2` yet.

**known risks:** Conditional outcome semantics may tempt unsupported schema vocabulary. Use `allOf` + `if/then` and owning-module semantic checks; stop if that is insufficient.

**forbidden side effects:** Runtime edits, package/dependency files, generated runs, registry policy changes, Phase-2 artifact writes, Wanaka artifacts.

**required regression:** Level A.

---

## S02 — Fail-closed schema-subset validator

**slice_id:** `S02`

**name:** Fail-closed schema-subset validator

**objective:** Implement only the approved Node-stdlib validation subset and prove every supported and representative unsupported keyword.

**prerequisites:** S01.

**exact files added:**

- `engine/core/schema-validate.mjs`

**exact files modified:**

- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** All S01 schemas plus existing SourceAuditRecord and Source Registry schemas as nested/external-ref conformance fixtures.

**runner states affected:** None.

**tests introduced/activated:** CV01–CV18.

**acceptance criteria:**

- all supported-keyword conformance checks pass;
- each representative unsupported keyword fails with `KINETIC_SCHEMA_KEYWORD_UNSUPPORTED`;
- malformed schema/instance, unresolved/cyclic/forbidden refs fail clearly;
- every S01 contract validates a good nested fixture and rejects a targeted bad fixture;
- no network access and no dependency are used;
- validator source remains bounded to the documented subset.

**rollback boundary:** Revert validator and CV tests. S01 contracts remain inert data.

**known risks:** Homemade validators can grow silently. Keyword allowlisting and CV14 make growth an explicit reviewed decision.

**forbidden side effects:** Runtime runner wiring, source retrieval, registry mutation, npm install, browser use, schema-vocabulary expansion.

**required regression:** Levels A and B.

---

## S03 — Source Registry wrapper correction and executable rights resolver

**slice_id:** `S03`

**name:** Source Registry wrapper correction and executable rights resolver

**objective:** Make registry `0.1.2` schema-valid and expose a read-only, deny-first permitted view before any retrieval exists.

**prerequisites:** S02.

**exact files added:**

- `engine/knowledge/source-registry.mjs`

**exact files modified:**

- `schemas/gym/source-registry.schema.json`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** Source Registry, inline SourceAuditRecord, rights decision/provenance rows.

**runner states affected:** None. The resolver is pure/read-only in this slice.

**tests introduced/activated:** Primary owner of T4, T5, T6, T7, T39, and T40. T6’s browser-call integration is deferred to S13; T40’s cross-system rerun is deferred to S20/S21, but the defining assertions and ownership remain here.

**acceptance criteria:**

- wrapper keys match accepted registry data: `$schema`, `registry_version`, `updated_at`, `authority`, `training_definition`, `sources`;
- registry version is exactly `0.1.2` with 27 unique IDs and canonical URLs;
- a before/after normalized policy snapshot proves every accepted rights value is unchanged;
- `VERIFY_REQUIRED`, prohibited automation, entitlement, metadata-only, abstract-only, code-ingest, tool-discovery, no-ingest, and build-time target boundaries are enforced;
- resolver returns obligations/warnings/evidence or stable denial codes;
- permitted retrieval view excludes prohibited raw/code/asset entries before downstream selection;
- no rights write/export API exists;
- pre/post registry SHA remains identical in tests.

**rollback boundary:** Revert the wrapper correction, resolver, and owned tests together. No retrieval module depends on it until S06; if later slices exist, revert their descendants first. Registry data itself is not edited.

**known risks:** Route/tier rights may accidentally inherit across URLs. Exact `source_id` lookup and minimal URL canonicalization prevent merging.

**forbidden side effects:** Source crawling, browser launch, credentials, registry rights changes, rights upgrades from notes/subagent output, raw source ingestion.

**required regression:** Levels A and B.

---

## S04 — Durable runner lifecycle substrate

**slice_id:** `S04`

**name:** Durable runner lifecycle substrate

**objective:** Add the pure Phase-2.5 transition table and Node-stdlib atomic store while preserving every legacy Phase-2 command and on-disk artifact.

**prerequisites:** S02.

**exact files added:**

- `engine/runner/state-machine.mjs`
- `engine/runner/store.mjs`
- `engine/tests/test-phase2-5-resume.mjs`

**exact files modified:**

- `engine/runner/run.mjs`
- `schemas/gym/variant-run.schema.json`
- `engine/tests/test-phase2-5-contracts.mjs`
- `docs/gym/35-variant-protocol.md`

**schemas/contracts involved:** `case-run@0.2`, `variant-run@0.2`, legacy `variant-run@0.1`, transition/history/artifact receipts, lock owner record.

**runner states affected:** All approved lifecycle names are recognized. Only generic adjacent transitions without later artifact-specific guards are wired. Retry terminals/conditions are represented; later slices add owning guards.

**tests introduced/activated:** Primary owner of T32, T37, and T38.

**acceptance criteria:**

- `mkdir` lock, nonce, heartbeat, TTL, atomic stale rename, sibling temp write, file fsync, rename, and directory fsync work in project-local temp;
- adjacent/skipped/backward/terminal transition behavior matches Gate 3;
- lifecycle never infers `technically_qualified`, `design_qualified`, or learning acceptance;
- legacy reads normalize in memory only and old CLI commands behave unchanged;
- legacy file hashes remain unchanged;
- no arbitrary Phase-2.5 `record --state` path exists.

**rollback boundary:** Revert runner/store/state/test/docs commit. Since no S05+ artifact has been created, there is no `@0.2` data migration. After descendants, revert descendants first.

**known risks:** This is the largest foundational slice. Review state rules separately from filesystem behavior inside the same commit diff; do not add later domain guards here.

**forbidden side effects:** Historical writes, automatic schema migration, Wanaka initialization, source retrieval, browser/model calls, daemon/queue/service.

**required regression:** Levels A–D.

---

## S05 — VariantBrief persistence and enforcement

**slice_id:** `S05`

**name:** VariantBrief persistence and enforcement

**objective:** Persist, validate, hash, and guard one complete VariantBrief before any Phase-2.5 candidate can advance beyond planning.

**prerequisites:** S04.

**exact files added:** None.

**exact files modified:**

- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** VariantBrief, slot brief pointer/hash, signature-move and source-provenance structures.

**runner states affected:** `PLANNED -> BRIEF_VALIDATED`; `PREBUILD_APPROVED -> BUILDING` now requires unchanged brief hash, while retrieval/prebuild refs remain synthetic fixtures until their slices.

**tests introduced/activated:** Primary owner of T1 and T2.

**acceptance criteria:**

- absent/invalid brief cannot advance and state is unchanged;
- a good synthetic brief persists at the approved path and records SHA/schema receipt;
- all required nested planning/source-attribution fields validate;
- V1/V2 signature move is substantive and V0 remains originality-exempt;
- changed brief hash invalidates downstream advance;
- no general planning exception can bypass rights, DesignCase provenance, brief, or prebuild approval.

**rollback boundary:** Revert brief CLI/guard/tests. Generic S04 lifecycle/store remains. Delete only test-temp fixture output.

**known risks:** Brief schema may become a prose dump. Keep structural checks to approved fields; qualitative weakness belongs to S08.

**forbidden side effects:** Real candidate build, Wanaka brief, retrieval implementation, rights bypass, model review.

**required regression:** Levels A–D.

---

## S06 — Rights-filtered retrieval provenance

**slice_id:** `S06`

**name:** Rights-filtered retrieval provenance

**objective:** Produce deterministic, reproducible retrieval receipts only from the S03 permitted view and cross-check influential selections against VariantBrief provenance.

**prerequisites:** S03, S04, S05.

**exact files added:**

- `engine/knowledge/retrieval.mjs`

**exact files modified:**

- `engine/knowledge/source-registry.mjs`
- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** RetrievalReceipt, VariantBrief source provenance, registry decision rows, DesignCase references.

**runner states affected:** `BRIEF_VALIDATED -> RETRIEVAL_PROVEN`.

**tests introduced/activated:** Primary owner of T3.

**acceptance criteria:**

- order is registry validate → rights resolve → permitted view → deterministic retrieve;
- prohibited material is absent from candidates and downstream receipt content, not merely rejected after selection;
- stable tokenization/ranking/tie-break and index hashes reproduce the receipt;
- selected/rejected candidates have reasons;
- empty DesignCase selection for a normal original yields `KINETIC_EMPTY_RETRIEVAL` and no transition;
- brief influential source set exactly matches authorized receipt selections;
- registry version/hash are recorded;
- no random rank and no source fetch occurs.

**rollback boundary:** Revert retrieval module/integration/tests. Brief persistence and rights resolver remain useful and unchanged; remove only synthetic test-temp receipts.

**known risks:** Repository indexes may not exist uniformly. Use existing files directly and stable lexical IDs; do not invent an indexing service.

**forbidden side effects:** Retrieval before rights, raw protected content in receipt, network crawling, rights mutation, Obsidian requirement, Wanaka run.

**required regression:** Levels A–D.

---

## S07 — Optional Obsidian read adapter and staged mirror

**slice_id:** `S07`

**name:** Optional Obsidian read adapter and staged mirror

**objective:** Add bounded read-only design-memory retrieval and reversible project-local export without making HermesVault available, authoritative, or writable.

**prerequisites:** S03, S06.

**exact files added:**

- `engine/knowledge/obsidian-adapter.mjs`
- `engine/cli/gen-obsidian-mirror.mjs`

**exact files modified:**

- `engine/knowledge/retrieval.mjs`
- `.gitignore`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** Obsidian result rows embedded in RetrievalReceipt; generated mirror manifest.

**runner states affected:** None. Retrieval receives optional note results; repository-only path remains identical.

**tests introduced/activated:** Primary owner of T8, T9, and T10.

**acceptance criteria:**

- missing/unreadable vault returns `availability=unavailable` and repo-only retrieval succeeds;
- allowlisted roots, top-5 limit, 1,200-character excerpt limit, stable ranking and note hashes work on a synthetic vault fixture;
- note provenance/trust is persisted;
- unknown or broader note rights cannot upgrade repository rights;
- generated mirror is marked derived, contains source hashes, and writes only to project-local ignored output/test temp;
- host apply script is generated but never executed by tests or sandbox implementation;
- no secret is copied.

**rollback boundary:** Revert adapter/mirror/retrieval hook/tests and remove generated `gym/exports/obsidian/` or test-temp output. No host rollback is required because host application never occurred.

**known risks:** Prompt bloat and stale notes. Hard limits and repository authority contain both.

**forbidden side effects:** Direct `/knowledge/HermesVault` write, host script execution, rights upgrade, runtime requirement on Obsidian, second policy database.

**required regression:** Levels A and B.

---

## S08 — Pre-build design review

**slice_id:** `S08`

**name:** Pre-build design review

**objective:** Reject structurally weak, derivative, rights-invalid, or component-soup briefs before `BUILDING` through inspectable rules.

**prerequisites:** S06, S07.

**exact files added:**

- `engine/planning/prebuild-review.mjs`

**exact files modified:**

- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** PreBuildReview, VariantBrief, RetrievalReceipt, optional advisory observations.

**runner states affected:** `RETRIEVAL_PROVEN -> PREBUILD_APPROVED`; `PREBUILD_APPROVED -> BUILDING` requires `decision=APPROVED` and unchanged hashes.

**tests introduced/activated:** Primary owner of T12, T13, and T41.

**acceptance criteria:**

- PB01–PB15 produce rule ID, pass/fail, evidence path, and reason;
- required weak synthetic brief returns REVISE or REJECTED and never reaches BUILDING;
- good synthetic brief reaches BUILDING only through adjacent validated states;
- optional model observations cannot waive any hard rule;
- V0 originality exemption and V1/V2 originality requirement remain distinct;
- component influence caps and concept-before-implementation ordering are enforced.

**rollback boundary:** Revert prebuild module/runner guards/tests. Retrieval remains reproducible; no candidate artifact exists.

**known risks:** Naive heuristics can false-positive. Keep rules deterministic and narrowly tied to approved required fields; observations remain advisory.

**forbidden side effects:** Opaque aggregate score, model-only approval, build invocation, rights waiver, Wanaka planning.

**required regression:** Levels A–D.

---

## S09 — FidelityReport and V0 human boundary

**slice_id:** `S09`

**name:** FidelityReport and V0 human boundary

**objective:** Make Phase-2.5 initialization V0-only and prevent V1/V2 from entering `PLANNED` until a complete visual-evidence-backed V0 FidelityReport is explicitly approved by a human.

**prerequisites:** S08.

**exact files added:** None.

**exact files modified:**

- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `schemas/gym/variant-run.schema.json`
- `engine/tests/test-phase2-5-contracts.mjs`
- `docs/gym/36-fidelity-study-policy.md`

**schemas/contracts involved:** FidelityReport, case-run slot creation, V0 identity/deployability fields, capture references.

**runner states affected:** initial V0 `PLANNED`; V1/V2 absent → `PLANNED`; V0 report guard at design evaluation/original creation.

**tests introduced/activated:** Primary owner of T11 and T46.

**acceptance criteria:**

- fixture case initialization creates V0 only;
- V1/V2 creation fails when V0, report, required reference/V0 visual evidence, human producer, approval, or approved timestamp is absent/invalid;
- automated/AI producer cannot approve fidelity;
- V0 is internal, undeployable, non-original and originality-exempt;
- after complete synthetic human approval, V1 then V2 may enter PLANNED; a third original is denied;
- no actual human is simulated as authority for Wanaka—only contract semantics are fixture-tested.

**rollback boundary:** Revert V0/original guards/schema/docs/tests. Delete synthetic test-temp case only. No Wanaka or historical file exists to roll back.

**known risks:** Test fixtures could accidentally normalize automated fidelity approval. Fixture producer must be explicitly `human`; real Wanaka approval remains a later external stop.

**forbidden side effects:** Wanaka V0/report/capture, automatic fidelity approval, original slot pre-creation, deployable V0.

**required regression:** Levels A–D.

---

## S10 — Execution telemetry

**slice_id:** `S10`

**name:** Execution telemetry

**objective:** Record evidence-backed stage timing and exposed counters at the shared store/runner boundary without estimating unavailable values or adding an event service.

**prerequisites:** S04.

**exact files added:** None.

**exact files modified:**

- `engine/runner/store.mjs`
- `engine/runner/run.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** ExecutionTelemetry, transition receipts.

**runner states affected:** No transition meaning changes. Starts/ends/retries append stage telemetry around existing transitions.

**tests introduced/activated:** Primary owner of T31.

**acceptance criteria:**

- durations derive only from stored timestamps;
- unknown model/token/tool/cost values remain null/unknown with notes;
- monetary cost zero requires `VERIFIED_FREE` evidence;
- retry/build counters are exact;
- telemetry write is atomic and idempotent;
- no transition or qualification value is inferred from telemetry.

**rollback boundary:** Revert telemetry hooks/tests. Existing receipts/state remain; fixture telemetry can be deleted.

**known risks:** Instrumentation can spread. Keep it at runner/store boundaries and let later slices supply exposed metrics.

**forbidden side effects:** External telemetry service, estimated tokens/cost, state promotion, secret capture.

**required regression:** Levels A–D.

---

## S11 — Playwright Chromium dependency boundary

**slice_id:** `S11`

**name:** Playwright Chromium dependency boundary

**objective:** Install and prove the sole approved runtime dependency with Chromium-only, project-local cache/temp policy and deterministic recovery.

**prerequisites:** S02 and explicit approval to begin Gate-4 implementation. Writing this plan does not satisfy that approval.

**exact files added:**

- `package.json`
- `package-lock.json`
- `engine/tests/test-phase2-5-capture.mjs`
- `engine/tests/fixtures/capture-fixture.html`

**exact files modified:**

- `.gitignore`
- `docs/gym/51-resource-budget.md`

**schemas/contracts involved:** Browser/version smoke receipt fields from CaptureManifest; no durable capture manifest yet.

**runner states affected:** None.

**tests introduced/activated:** Primary owner of T45 plus Playwright install/smoke/failure-recovery checks.

**acceptance criteria:**

- exact dependency is `playwright-chromium@1.62.1` in package and lock;
- install uses `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, project-local npm cache, then project-local `PLAYWRIGHT_BROWSERS_PATH` for Chromium only;
- `TMPDIR` and run profiles are project-local; no configured path points to `/tmp`;
- free-disk preflight occurs before browser download;
- no automatic `--with-deps` or system-package mutation;
- smoke fixture launches one Chromium, records package and `browser.version()`, loads, then closes;
- injected launch failure leaves no profile/temp process/artifact;
- deterministic cleanup runs in `finally`;
- existing Phase-2 behavior remains untouched.

**rollback boundary:** Revert package/lock/test/fixture/gitignore/docs commit, remove `.cache/ms-playwright`, `.cache/npm`, `.tmp/playwright`, and any test-local profiles. No application artifact cleanup is needed.

**known risks:** Chromium download or host libraries may fail; 512 MiB `/tmp` exhaustion is a mandatory regression check. A failure blocks S11 and Gate 4 rather than authorizing an alternative dependency.

**forbidden side effects:** Firefox/WebKit install, global npm install, uncontrolled `/tmp`, `--with-deps`, host package changes, Wanaka navigation/capture.

**required regression:** Levels A and B.

---

## S12 — Capture manifest contracts and completeness

**slice_id:** `S12`

**name:** Capture manifest contracts and completeness

**objective:** Implement pure capture-spec IDs, manifest append/validation, artifact hash verification, and required-set completeness before browser automation.

**prerequisites:** S04, S11.

**exact files added:**

- `engine/cli/capture.mjs`

**exact files modified:**

- `engine/tests/test-phase2-5-capture.mjs`

**schemas/contracts involved:** CaptureManifest, capture spec/entry/failure, content-addressed artifact reference.

**runner states affected:** `TECHNICAL_EVALUATED -> VISUAL_CAPTURED` guard is defined against manifest completeness but is exercised with synthetic files only.

**tests introduced/activated:** Primary owner of T17, T18, and T19.

**acceptance criteria:**

- deterministic capture IDs include subject, attempt, viewport, state, action, reduced motion and build hash;
- manifest validates fixture entries and records package/browser versions separately;
- every artifact path resolves beneath the case/test root and SHA recomputes;
- missing/mismatched artifacts fail;
- desktop four-state and mobile two-state sets pass only when complete;
- manifest append is atomic and cannot trust filenames as evidence;
- no browser launch is required in this slice.

**rollback boundary:** Revert pure capture module/tests and remove synthetic test-temp manifests/artifacts.

**known risks:** Manifest code may absorb browser concerns. Keep S12 exports pure and defer readiness/actions/conversion to S13.

**forbidden side effects:** Browser launch, source network access, Wanaka capture, durable non-test artifacts.

**required regression:** Levels A–C.

---

## S13 — Deterministic visual capture pipeline

**slice_id:** `S13`

**name:** Deterministic visual capture pipeline

**objective:** Complete Chromium capture against one local fixture with rights preflight, readiness, static/motion/reduced-motion states, WebP, hashes, pHash, retry and cleanup.

**prerequisites:** S03, S10, S12.

**exact files added:** None.

**exact files modified:**

- `engine/cli/capture.mjs`
- `engine/knowledge/source-registry.mjs`
- `engine/evaluator/originality-compare.mjs`
- `engine/tests/test-phase2-5-capture.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`
- `docs/gym/51-resource-budget.md`

**schemas/contracts involved:** CaptureManifest, rights decision, telemetry, originality report visual fingerprint field.

**runner states affected:** `TECHNICALLY_EVALUATED(true) -> VISUAL_CAPTURED`; false qualification remains blocked.

**tests introduced/activated:** Primary owner of T20, T42, and T48. T6, T18, T19, T40, and T45 run as dependent subsystem assertions.

**acceptance criteria:**

- rights/access decision is validated before `chromium.launch()`;
- local fixture captures exact desktop/mobile/static/motion/reduced-motion specs;
- readiness waits are bounded and recorded;
- PNG→WebP and 16×16 luminance pHash are proven in installed Chromium;
- content-addressed WebP hash resolves;
- matching rerun reuses entry; partial crash retries only missing specs;
- divergent same-spec captures are retained and third mismatch blocks;
- transient launch/navigation retry is bounded to three; deterministic selector failure does not blind-retry;
- process/context/profile/temp cleanup is deterministic;
- originality stores visual similarity separately from design quality;
- capture telemetry is evidence-backed;
- all fixture output is project-local and removed after tests.

**rollback boundary:** Revert capture pipeline, rights preflight hook, pHash comparator, tests/docs. Remove fixture capture temp and content-addressed test artifacts; preserve any unrelated historical capture evidence.

**known risks:** Browser canvas WebP/pHash or host rendering may vary. If fixture reproducibility fails, Gate 4 blocks; no image dependency is added without returning to architecture approval.

**forbidden side effects:** Wanaka navigation, prohibited-source launch, anonymous external source capture, design qualification, external upload.

**required regression:** Levels A–C.

---

## S14 — Vision critic identity boundary

**slice_id:** `S14`

**name:** Vision critic identity boundary

**objective:** Add a provider-independent request/response receipt boundary that defaults unverified identity/capability to `HUMAN_VISUAL_GATE` without making any model call.

**prerequisites:** S12.

**exact files added:**

- `engine/evaluator/vision-critic.mjs`

**exact files modified:**

- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** Vision request, provider receipt fields embedded in DesignQualityEvaluation.

**runner states affected:** None in this slice. It returns accepted advisory evidence or `KINETIC_VISION_UNVERIFIED`/human fallback.

**tests introduced/activated:** Primary owner of T21.

**acceptance criteria:**

- request includes capture hashes, brief, rubric and prompt versions;
- accepted receipt requires provider, exact model, route, image capability, cost status, capture hashes, rubric/prompt version, response hash, timestamp;
- unidentified/anonymous/tool-label-only input cannot be authoritative;
- unknown identity returns `HUMAN_VISUAL_GATE` without synthesizing score or metadata;
- module cannot write files, transition state, call a provider, or set qualification.

**rollback boundary:** Revert standalone interface/tests. Capture artifacts remain unaffected and human-only evaluation remains possible.

**known risks:** Provider-specific behavior may leak into interface. Keep provider calls outside this module until separately identified and approved.

**forbidden side effects:** Real model call, guessed provider/model/cost, file edit, state transition, rights/human override.

**required regression:** Levels A and B.

---

## S15 — Design-quality rubric integration

**slice_id:** `S15`

**name:** Design-quality rubric integration

**objective:** Validate evidence-bound structured design observations and advance to `DESIGN_EVALUATED` without converting technical pass or advisory recommendation into design qualification.

**prerequisites:** S04, S13, S14.

**exact files added:** None.

**exact files modified:**

- `engine/evaluator/vision-critic.mjs`
- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `schemas/gym/design-quality-evaluation.schema.json`
- `engine/tests/test-phase2-5-contracts.mjs`
- `docs/gym/44-quality-floor.md`

**schemas/contracts involved:** DesignQualityEvaluation, verified vision receipt or explicit HUMAN_VISUAL_GATE, ten rubric dimensions.

**runner states affected:** `VISUAL_CAPTURED -> DESIGN_EVALUATED`.

**tests introduced/activated:** Primary owner of T22, T23, and T24.

**acceptance criteria:**

- all required dimensions and cited capture IDs validate;
- collapsed score-only output fails;
- unsupported visual claims fail semantic validation;
- verified critic remains advisory;
- human fallback can satisfy evaluation readiness without fabricated model fields;
- `technically_qualified=true` leaves `design_qualified=null` and learning acceptance null;
- automated output attempting to set design qualification is rejected.

**rollback boundary:** Revert rubric integration/schema/tests/docs while retaining S14 identity boundary and capture evidence.

**known risks:** Rubric status may be mistaken for qualification. State-machine invariant and T24 prevent this.

**forbidden side effects:** Aggregate qualification score, automatic design pass, real model call, TasteProfile update.

**required regression:** Levels A–D.

---

## S16 — Motion-token enforcement

**slice_id:** `S16`

**name:** Motion-token enforcement

**objective:** Reuse existing motion token names, add one machine catalog, and fail technical evaluation on unapproved raw motion values or missing reduced-motion behavior.

**prerequisites:** S04, S05.

**exact files added:**

- `engine/tokens/motion-tokens.json`
- `engine/evaluator/motion-token-validate.mjs`

**exact files modified:**

- `engine/evaluator/gates.browser.js`
- `engine/runner/run.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`
- `docs/08-motion-tokens.md`

**schemas/contracts involved:** Motion token catalog/schema, VariantBrief token exceptions, technical gate report.

**runner states affected:** `BUILT -> TECHNICAL_EVALUATED`; technical qualification can be false when motion checks fail. No design state changes.

**tests introduced/activated:** Primary owner of T14, T15, and T16.

**acceptance criteria:**

- current primitive-consumed token names and evidence tags remain valid;
- compliant CSS/JS and reduced-motion branch pass;
- narrow raw duration/delay/stagger/easing/distance/scale/opacity/spring detections report file/line/property/value;
- intrinsic endpoints and excluded vendor/core/minified files do not false-positive;
- exact location/property/value/evidence exception passes and is reported;
- wildcard/vague exception and missing reduced motion fail;
- technical pass never sets design qualification.

**rollback boundary:** Revert token catalog/validator/evaluator hook/tests/docs. Historical `.kinetic/tokens.json` files remain untouched.

**known risks:** Regex false positives. Keep approved narrow scope; an AST dependency requires a future measured architecture decision.

**forbidden side effects:** Historical token edits, AST dependency, automatic token rewriting, design qualification.

**required regression:** Levels A–D.

---

## S17 — Human design-quality state and update flow

**slice_id:** `S17`

**name:** Human design-quality state and update flow

**objective:** Record explicit, append-only human relative preference, absolute floor, and taste-learning acceptance without deriving one from another.

**prerequisites:** S09, S15.

**exact files added:** None.

**exact files modified:**

- `schemas/gym/taste-decision.schema.json`
- `engine/runner/state-machine.mjs`
- `engine/runner/store.mjs`
- `engine/runner/run.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`
- `engine/tests/test-phase2-5-resume.mjs`
- `engine/tests/test-taste-reject-all.mjs`
- `docs/gym/41-taste-memory.md`

**schemas/contracts involved:** `taste-decision@0.2`, legacy `@0.1`, append-only supersession, case decision pointer.

**runner states affected:** Batch `REVIEW_READY -> HUMAN_REVIEWED`; terminal immutability.

**tests introduced/activated:** Primary owner of T25, T26, T27, T28, and T47.

**acceptance criteria:**

- WINNER_SELECTED, PARTIAL_ACCEPTANCE and REJECT_ALL consistency rules pass;
- per-original floor and learning acceptance remain separate explicit booleans;
- relative preference never implies absolute acceptance;
- only V1/V2 can be winner/learning candidates;
- decision write is create-exclusive and append-only;
- corrections require a new decision with `supersedes`;
- HUMAN_REVIEWED cannot be overwritten;
- legacy IZANAMI REJECT_ALL semantics and file remain unchanged;
- TasteProfile is not auto-updated.

**rollback boundary:** Revert taste/state/store/CLI/tests/docs commit. Delete only synthetic `@0.2` test decisions; legacy decisions remain.

**known risks:** Schema-only conditions cannot express all cross-array identity rules. Keep those deterministic semantic checks in `applyHumanReview`; do not expand validator vocabulary.

**forbidden side effects:** Inferred acceptance, preselected winner, legacy decision edit, automatic TasteProfile/negative-knowledge promotion.

**required regression:** Levels A–D.

---

## S18 — SourceToOutputLossReport integration

**slice_id:** `S18`

**name:** SourceToOutputLossReport integration

**objective:** Validate a case-level reference→V0→V1/V2 loss diagnosis whose claims are explicitly sourced and whose remediations remain recommendations.

**prerequisites:** S06, S09, S13, S15.

**exact files added:** None.

**exact files modified:**

- `schemas/gym/source-to-output-loss-report.schema.json`
- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** SourceToOutputLossReport, source/capture/report/human evidence references.

**runner states affected:** `DESIGN_EVALUATED -> REVIEW_READY` package guard requires a valid loss report; S19 completes the workbench part.

**tests introduced/activated:** Primary owner of T30 and T43.

**acceptance criteria:**

- required stages, labels, responsibility, avoidability, evidence and remediation fields validate;
- SOURCE-DERIVED claims require source refs;
- visual claims require capture or human refs;
- unsupported claim fails;
- remediation is labeled ENGINE-RECOMMENDATION and cannot mutate/promote knowledge;
- report does not set qualification.

**rollback boundary:** Revert loss schema/runner guard/tests and delete synthetic test report.

**known risks:** A report can become ungrounded narrative. Semantic evidence rules and T43 are merge blockers.

**forbidden side effects:** Automatic remediation, knowledge promotion, fabricated visual evidence, state/qualification inference.

**required regression:** Levels A–C.

---

## S19 — Neutral production review workbench

**slice_id:** `S19`

**name:** Neutral production review workbench

**objective:** Extend the existing manifest-derived generator into a static fixture workbench with rejected IZANAMI baseline, reference/V0 context, V1/V2-only controls, no defaults, and local JSON export.

**prerequisites:** S17, S18.

**exact files added:** None.

**exact files modified:**

- `engine/cli/gen-review-package.mjs`
- `engine/runner/run.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-review-package-links.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`

**schemas/contracts involved:** review package manifest/links, TasteDecision export, CaptureManifest, design evaluations, loss report.

**runner states affected:** Atomic batch `DESIGN_EVALUATED -> REVIEW_READY` after package and loss checks.

**tests introduced/activated:** Primary owner of T29 and T44.

**acceptance criteria:**

- fixture package links/hashes resolve;
- historical IZANAMI rejected baseline is visible and immutable;
- reference and V0 are context-only and never selectable;
- only V1/V2 appear in outcome controls;
- no `checked`, selected option, default JS outcome, or inferred winner exists;
- export stays disabled until every required independent field is answered;
- exported JSON validates as TasteDecision `@0.2` but does not write the repo;
- originals remain `design_qualified:null` before human import.

**rollback boundary:** Revert generator/runner/tests. Generated fixture workbench can be deleted; existing Phase-2 packages remain.

**known risks:** Existing generator serves Phase 2. New behavior must be version/manifest-dispatched and preserve legacy output.

**forbidden side effects:** Preselection, direct decision write, mutable historical links, Wanaka review package, server/API/deployment.

**required regression:** Levels A–D.

---

## S20 — Cross-system idempotency and kill/resume integration

**slice_id:** `S20`

**name:** Cross-system idempotency and kill/resume integration

**objective:** Prove the complete synthetic Phase-2.5 lifecycle resumes from every durable state without duplicate captures, receipts, model responses, decisions, or historical writes.

**prerequisites:** S06 through S19.

**exact files added:** None.

**exact files modified:**

- `engine/runner/run.mjs`
- `engine/runner/store.mjs`
- `engine/runner/state-machine.mjs`
- `engine/tests/test-phase2-5-resume.mjs`
- `engine/tests/test-phase2-5-contracts.mjs`
- `engine/tests/test-phase2-5-capture.mjs`
- `docs/gym/50-resumability.md`

**schemas/contracts involved:** all transition/artifact/idempotency receipts, telemetry, capture, vision, human decision.

**runner states affected:** Every durable Phase-2.5 state and declared retry path; no new states.

**tests introduced/activated:** Primary owner of T33, T34, and T35. Re-runs dependent T20, T38, T40, and T47 end to end without changing their primary ownership.

**acceptance criteria:**

- kill/resume from every approved state chooses the next unmet guard;
- matching idempotency keys reuse receipts/artifacts;
- changed content under a key yields `KINETIC_ARTIFACT_MISMATCH`;
- capture resumes only missing specs;
- stored valid vision response is not recalled;
- REVIEW_READY waits without recapture/model call;
- human decision is never duplicated/overwritten;
- lock takeover is logged;
- existing Phase-2 Test-9 kill/resume remains green;
- protected hashes and registry hash remain unchanged.

**rollback boundary:** Revert integration/resume/docs commit. Slice-local behavior remains; delete only synthetic test-temp lifecycle trees.

**known risks:** End-to-end tests can become slow/flaky. Use local deterministic fixtures, explicit injected kill points, no external network/model/human dependency.

**forbidden side effects:** Wanaka fixture, external model/network, automatic retries of deterministic contract errors, historical mutation.

**required regression:** Levels A–D.

---

## S21 — Full fixture-based Gate-4 regression

**slice_id:** `S21`

**name:** Full fixture-based Gate-4 regression and readiness evidence

**objective:** Run the complete contract/capture/runner/compatibility ladder, prove all safety invariants, and stop at ENGINE IMPLEMENTATION READY without generating Wanaka artifacts.

**prerequisites:** S01–S20 accepted.

**exact files added:** None.

**exact files modified:**

- `package.json`
- `engine/tests/test-phase2-5-contracts.mjs`
- `engine/tests/test-phase2-5-resume.mjs`
- `engine/tests/test-phase2-5-capture.mjs`
- `docs/plans/phase-2-5-award-quality-floor/00-status.md`
- relevant already-owned behavior docs only if actual green behavior differs from wording: `docs/gym/35-variant-protocol.md`, `docs/gym/36-fidelity-study-policy.md`, `docs/gym/41-taste-memory.md`, `docs/gym/44-quality-floor.md`, `docs/gym/50-resumability.md`, `docs/gym/51-resource-budget.md`

**schemas/contracts involved:** all approved Phase-2.5 and legacy contracts.

**runner states affected:** None newly. This slice proves the frozen state table.

**tests introduced/activated:** Primary owner of T36. Activates CV01–CV18 and all T1–T48.

**acceptance criteria:**

- every regression level A–E passes;
- all T1–T48 pass with no omitted test;
- all validator conformance tests pass;
- protected Phase-2 hashes and semantics remain valid;
- registry `0.1.2`, 27/27 and accepted rights values remain unchanged;
- Playwright/browser receipts and local cleanup pass;
- no Wanaka artifact exists under `gym/` or test fixtures;
- no cron, deployment, auto-promotion, Phase 3 or vault host write is enabled;
- worktree contains only reviewed implementation/docs changes;
- `git diff --check` passes;
- status moves only to `Gate 4 — ENGINE IMPLEMENTATION READY: READY FOR APPROVAL` and implementation stops.

**rollback boundary:** Revert S21 test-script/status/doc alignment commit. It adds no production capability. To remove Gate 4 implementation entirely, revert S20→S01 in reverse dependency order and remove Playwright caches per S11; Phase-2 evidence needs no rollback.

**known risks:** A green aggregate can hide skipped tests. Package scripts enumerate all test commands; S21 asserts expected T/CV counts and rejects skipped/missing IDs.

**forbidden side effects:** Wanaka initialization/capture/build/review, Gate-4 self-approval, push, cron, deployment, auto-promotion, Phase 3.

**required regression:** Levels A–E.

---

## 7. T1–T48 primary ownership map

Every Gate-3 test has exactly one primary owner. Dependent slices may rerun a test but cannot redefine or remove its owning assertion.

| Test | Primary slice | First required before slice acceptance | Deferred integration rerun |
|---|---|---|---|
| T1 | S05 | yes | S08, S20, S21 |
| T2 | S05 | yes | S08, S20, S21 |
| T3 | S06 | yes | S20, S21 |
| T4 | S03 | yes | S06, S20, S21 |
| T5 | S03 | yes | S06, S20, S21 |
| T6 | S03 | rights unit assertion | S13 capture prelaunch, S21 |
| T7 | S03 | yes | S06, S20, S21 |
| T8 | S07 | yes | S20, S21 |
| T9 | S07 | yes | S20, S21 |
| T10 | S07 | yes | S20, S21 |
| T11 | S09 | yes | S17, S20, S21 |
| T12 | S08 | yes | S20, S21 |
| T13 | S08 | yes | S09, S20, S21 |
| T14 | S16 | yes | S20, S21 |
| T15 | S16 | yes | S20, S21 |
| T16 | S16 | yes | S20, S21 |
| T17 | S12 | yes | S13, S20, S21 |
| T18 | S12 | pure file/hash assertion | S13 real capture, S21 |
| T19 | S12 | synthetic manifest assertion | S13 real fixture, S21 |
| T20 | S13 | yes | S20, S21 |
| T21 | S14 | yes | S15, S20, S21 |
| T22 | S15 | yes | S20, S21 |
| T23 | S15 | yes | S20, S21 |
| T24 | S15 | yes | S17, S20, S21 |
| T25 | S17 | yes | S19, S20, S21 |
| T26 | S17 | yes | S19, S20, S21 |
| T27 | S17 | yes | S19, S20, S21 |
| T28 | S17 | yes | S19, S20, S21 |
| T29 | S19 | yes | S20, S21 |
| T30 | S18 | yes | S19, S20, S21 |
| T31 | S10 | yes | S13, S20, S21 |
| T32 | S04 | yes | every Level-D slice, S21 |
| T33 | S20 | yes | S21 |
| T34 | S20 | yes | S21 |
| T35 | S20 | yes | S21 |
| T36 | S21 | yes | none |
| T37 | S04 | yes | S20, S21 |
| T38 | S04 | yes | S20, S21 |
| T39 | S03 | yes | S06, S20, S21 |
| T40 | S03 | registry/resolver unit assertion | S06, S13, S20, S21 |
| T41 | S08 | yes | S13, S20, S21 |
| T42 | S13 | yes | S20, S21 |
| T43 | S18 | yes | S19, S20, S21 |
| T44 | S19 | yes | S20, S21 |
| T45 | S11 | install/smoke paths and cleanup | S13 full pipeline, S21 |
| T46 | S09 | yes | S17, S20, S21 |
| T47 | S17 | append-only unit/resume assertion | S20, S21 |
| T48 | S13 | yes | S20, S21 |

Ownership count is exactly 48: no duplicate owner and no missing test. No T1–T48 test requires real Wanaka, external network, an actual vision provider, or genuine human judgment. Contract semantics use synthetic human-authored fixture records; real Wanaka human approval remains a later execution gate. Therefore no Gate-4 test is planned as impossible or skipped.

---

## 8. Checkpoint and commit strategy

### Existing planning checkpoints

| Checkpoint | Commit | Contents |
|---|---|---|
| P0 | `016b8a9` | Gate 1–3 plans, approved source registry/governance, no implementation |
| P1 | created after this document passes checks | `04-slices.md` only; no implementation |

### Implementation checkpoints after Gate-4 plan approval

- Prefer one green commit per accepted slice: `feat(phase2.5): SNN <name>`.
- S11 may use one commit containing package, lock, fixture, test and policy because package/lock without its smoke proof is not a valid checkpoint.
- S21 is a test/status/docs evidence commit, not a feature bundle.
- A slice may use two commits only when the first is independently green and useful; RED-only commits are prohibited.
- Do not push.

Before every checkpoint:

```text
1. git status --short — inspect scope
2. run required regression levels
3. run git diff --check
4. inspect git diff --name-status and confirm every path is listed by the slice
5. confirm protected Phase-2 paths unchanged when Level D applies
6. confirm no Wanaka generated artifact
7. commit only the slice
```

After commit, record commit ID and actual test output in the slice handoff/status. Do not claim success from expected output.

---

## 9. Rollback strategy

### Global rule

Each slice is a coherent commit or small green commit set. Before a dependent slice exists, revert the slice directly. After descendants exist, revert descendants first according to the dependency graph. Use `git revert`; do not manually rewrite historical evidence.

### Critical rollback boundaries

| Area | Revert action | Durable cleanup | Historical impact |
|---|---|---|---|
| Schema/version S01 | revert S01 after descendants | delete no data; no auto-migration exists | none |
| Validator S02 | revert S02 and descendants that import it | none | legacy files untouched |
| Rights S03 | revert retrieval/capture descendants first, then S03 | registry data remains at approved baseline; no writes to undo | none |
| Runner S04 | revert S20→S05 descendants, then S04 | delete only synthetic `@0.2` temp runs/locks | legacy reads/artifacts unchanged |
| Obsidian S07 | revert adapter/mirror hook | delete project-local ignored export/temp; host was never written | none |
| Playwright S11 | revert S13/S12 descendants, then package/lock/policy | remove `.cache/ms-playwright`, `.cache/npm`, `.tmp/playwright`, test profiles | none |
| Capture S12/S13 | revert S13 then S12 | remove synthetic capture temp/content-addressed fixture artifacts only | preserve existing Phase-2 evidence |
| Vision/rubric S14/S15 | revert rubric then interface | no provider-side action and no real calls to undo | none |
| Human flow S17 | revert review descendants then S17 | remove synthetic `@0.2` test decisions only | immutable `@0.1` decisions remain |
| Workbench S19 | revert generator/runner integration | delete fixture package only | existing Phase-2 package remains |
| S20/S21 | revert integration/evidence commits | delete synthetic temp output | none |

No rollback path requires changing IZANAMI V0–V3, its TasteDecision, TasteProfile, negative knowledge, held-out evidence, originality evidence, or Test-9 artifacts.

---

## 10. Rights-layer ordering and invariant

Implementation order is non-negotiable:

```text
schema-subset validator
  -> Source Registry wrapper validates exactly 0.1.2 / 27 records
  -> rights-policy resolver computes effective permission
  -> permitted retrieval view excludes prohibited material
  -> retrieval ranks/selects only that view
  -> VariantBrief can cite only selected authorized entries
  -> prebuild cross-checks receipt/brief/rights hashes
```

Prohibited material must never reach downstream planning data and then be “filtered later.” T4–T7/T39/T40 own this boundary; T6/T40 rerun through capture/retrieval integration.

There is no rights-mutation API. Rights changes remain an external reviewed repository edit under the permanent invariant:

```text
SUBAGENT DISCOVERY
-> CANDIDATE EVIDENCE
-> PARENT REPRODUCTION / VERIFICATION
-> RIGHTS STATUS CHANGE
```

Obsidian notes, tool directories, public access, robots permission, model output, subagent output, package/repository licenses, and adjacent route/tier records cannot widen an exact source record’s rights.

---

## 11. Obsidian sandbox/host boundary

```text
HermesVault (optional read-only input)
  -> bounded S07 adapter
  -> advisory note rows with provenance/trust
  -> S03 repository rights remain authoritative

KINETIC repository canonical data
  -> S07 generated project-local mirror payload
  -> explicit APPLY_TO_VAULT.sh (generated, not executed)
  -> separate human-approved host action
  -> separately verified/reversible host write
```

Gate 4 proves unavailable fallback, bounded read behavior, rights non-override, and local export generation. It performs no host vault mutation. Removing S07 leaves KINETIC fully operational from repository data.

---

## 12. Playwright implementation boundary

Approved dependency only:

```text
playwright-chromium@1.62.1
Chromium only
```

Required environment/path policy:

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
NPM_CONFIG_CACHE="$PWD/.cache/npm"
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
TMPDIR="$PWD/.tmp/playwright"
```

Per-run profiles/temp live beneath the test/case root, never uncontrolled `/tmp`. S11 records package and actual browser versions, preflights disk, performs direct local-fixture smoke/failure cleanup, and does not use `--with-deps`. S13 owns capture behavior. A package/browser/install/host-library failure blocks Gate 4; no alternative browser dependency is silently substituted.

The prior 512 MiB `/tmp` exhaustion is an explicit T45 regression. S21 fails if configured cache/profile/temp paths resolve beneath `/tmp`.

---

## 13. Qualification separation invariant

At every slice boundary:

```text
lifecycle state
technically_qualified: boolean after technical evaluation
design_qualified: null until explicit human review, then boolean
acceptable_for_further_taste_learning: null until explicit human review, then boolean
```

Forbidden conversions:

```text
TECHNICAL PASS -> DESIGN PASS
DESIGN_EVALUATED -> DESIGN PASS
AI RECOMMENDATION -> DESIGN PASS
RELATIVE PREFERENCE -> ABSOLUTE QUALITY ACCEPTANCE
WINNER -> TASTE-LEARNING ACCEPTANCE
```

T24, T25–T28, and T47 are merge blockers for this invariant.

---

## 14. Exact Gate-4 acceptance checklist

Gate 4 means **ENGINE IMPLEMENTATION READY**, not calibration success and not authorization to create originals.

### Contracts and validator

- [ ] All approved Phase-2.5 contracts are implemented.
- [ ] Legacy `@0.1` contracts remain valid and immutable.
- [ ] CV01–CV18 are green.
- [ ] Unsupported schema features fail closed.
- [ ] No contract required an unapproved schema capability.

### Source governance and retrieval

- [ ] Source Registry validates at exactly `0.1.2`.
- [ ] Registry remains 27/27 unique.
- [ ] All accepted rights decisions are unchanged.
- [ ] Rights resolver is functioning and deny-first.
- [ ] Prohibited material cannot enter the permitted retrieval view.
- [ ] No rights-mutation API exists.
- [ ] Permanent subagent→parent verification invariant is preserved.
- [ ] VariantBrief persistence and hash enforcement work.
- [ ] Empty DesignCase retrieval is a hard stop.
- [ ] Retrieval provenance and brief cross-linking work.

### Optional knowledge boundary

- [ ] HermesVault-unavailable fallback is green.
- [ ] Bounded note retrieval and provenance are green.
- [ ] Obsidian notes cannot upgrade rights.
- [ ] Generated mirror/export remains project-local.
- [ ] No sandbox/host vault write occurred.
- [ ] Host application remains explicit, separate, reversible, and unexecuted.

### Runner, planning and fidelity

- [ ] Additive Phase-2.5 state machine works.
- [ ] Adjacent/blocked/retry/terminal rules work.
- [ ] Atomic writes, locks, heartbeat and stale recovery work.
- [ ] Qualification fields remain separate from lifecycle state.
- [ ] Pre-build weak-plan rejection works.
- [ ] Phase-2.5 fixture initialization creates V0 only.
- [ ] FidelityReport contract works on fixtures.
- [ ] V1/V2 cannot enter PLANNED without V0 visual evidence and explicit human fidelity approval.
- [ ] V0 remains internal, undeployable and originality-exempt.
- [ ] Original count cap is two and repair cap is three.

### Telemetry, dependency and capture

- [ ] Telemetry records only evidence-backed values.
- [ ] Unknown metrics remain null/unknown.
- [ ] `playwright-chromium@1.62.1` is exactly pinned.
- [ ] Chromium only is installed project-locally.
- [ ] Package and actual browser version receipts exist.
- [ ] Browser/cache/profile/temp paths are project-local.
- [ ] No uncontrolled `/tmp` use occurs.
- [ ] Smoke failure/recovery cleanup is green.
- [ ] Capture manifest, artifact hashes and completeness work.
- [ ] Desktop/mobile/static/motion/reduced-motion fixture capture works.
- [ ] Capture rights preflight occurs before browser launch.
- [ ] Capture idempotency and partial recovery work.
- [ ] Perceptual hash exists and remains separate from design score.

### Evaluation, human state and review

- [ ] `VISION_CRITIC_AVAILABLE_UNVERIFIED` remains the default status.
- [ ] Vision critic provider-independent interface works.
- [ ] Unidentified vision input cannot become authoritative.
- [ ] Missing identity/capability produces `HUMAN_VISUAL_GATE`.
- [ ] No anonymous real model call is made.
- [ ] Design-quality rubric validates all dimensions and evidence.
- [ ] Technical pass cannot produce design pass.
- [ ] Motion-token validation and exact exceptions work.
- [ ] Human WINNER_SELECTED, PARTIAL_ACCEPTANCE and REJECT_ALL semantics work.
- [ ] Relative preference, absolute floor and learning acceptance remain independent.
- [ ] Human decisions are append-only and corrections supersede.
- [ ] SourceToOutputLossReport validates evidence-bound claims.
- [ ] Review workbench works on fixtures.
- [ ] Review controls are unselected and only V1/V2 are candidates.

### Regression and safety

- [ ] CV01–CV18 are green.
- [ ] T1–T48 are green with exactly one primary owner each.
- [ ] No T test is skipped or missing.
- [ ] Regression Levels A–E are green.
- [ ] Existing Phase-2 kill/resume remains green.
- [ ] Existing IZANAMI REJECT_ALL and review-link tests remain green.
- [ ] Protected Phase-2 artifacts remain valid and unchanged.
- [ ] Registry hash is unchanged by runtime operations.
- [ ] No Wanaka V0, FidelityReport, capture, V1, V2, review package, run directory, or checkpoint exists.
- [ ] Cron is OFF.
- [ ] Deployment is OFF.
- [ ] Auto-promotion is OFF.
- [ ] Phase 3 is NOT STARTED.
- [ ] No push occurred.
- [ ] `git diff --check` passes.
- [ ] Gate-4 implementation stops at READY FOR APPROVAL.

---

## 15. Risks and contradictions discovered

| Item | Resolution | Blocks this plan? |
|---|---|---|
| Gate 3 grouped validator/registry before the rest of schemas, while the requested slice order starts with schema foundations. | S01 schemas are inactive parseable data; S02 is required before runtime consumption; S03 rights follows. Architecture and fail-closed behavior are preserved. | No |
| Gate 2 said reuse `GENERATING`; Gate 3 explicitly superseded it with `BUILDING`. | Preserve Gate-3 lifecycle. Legacy `GENERATING` remains readable only for Phase 2. | No |
| The committed Source Registry schema wrapper intentionally does not match accepted registry keys. | S03 corrects wrapper only and proves all 27 rights decisions unchanged. | No; S03 acceptance blocker |
| Gate-3 validator wording said “ranges” without enumerating them. | This plan freezes ranges to min/max string length, numeric minimum/maximum, and array min/max items. Other range features are unsupported. | No |
| Cross-field human semantics exceed comfortable schema-only expression. | Use supported schema structure plus deterministic semantic checks in state machine; do not grow validator vocabulary. | No |
| V0 original-creation boundary now explicitly includes required visual evidence as well as FidelityReport and human approval. | S09 uses capture refs in the approved FidelityReport contract; this strengthens, not weakens, Gate 3. | No |
| S04 combines pure lifecycle and atomic store. | They form one durable runner substrate already paired by Gate 3; domain guards remain in later slices. Review tests separate state and filesystem assertions. | No |
| Playwright install/browser/host libraries are unproven and `/tmp` is constrained. | S11 is an explicit blocker with project-local paths and no alternative dependency. | Potential Gate-4 blocker, not planning blocker |
| PNG→WebP/pHash inside Chromium is unproven. | S13 fixture must prove it; failure returns to architecture rather than adding an image dependency. | Potential Gate-4 blocker |
| Vision provider/model identity remains unavailable. | Interface and human fallback are sufficient; no automated authority is required for Gate 4. | No |
| Real Wanaka dynamic/WebGL readiness remains unproven. | Wanaka is forbidden during Gate 4; later V0 execution may block honestly. | No |
| `HERMES_KANBAN_TASK` is unset in this session. | Work is proceeding in the explicit canonical workspace and cannot record a Kanban lifecycle transition. | No |

No contradiction requires changing the approved Gate-3 architecture. No blocker prevents a reviewable Gate-4 implementation plan.

---

## 16. Stop point

**GATE 4 IMPLEMENTATION PLAN: READY**

Approval requested to begin Gate-4 implementation at **S01 only**, using fixture-first RED→GREEN checks and the commit/regression boundaries above.

Until that approval:

- do not implement S01;
- do not install Playwright;
- do not generate Wanaka artifacts;
- do not begin Phase 3;
- do not enable cron, deployment, or auto-promotion;
- do not push.
