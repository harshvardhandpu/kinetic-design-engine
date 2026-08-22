# 18 — Product Core Protection & Design Regression Contract

## The law

# PRODUCT CORE ≠ EXPERIENCE LAYER

KINETIC may transform: layout, visual hierarchy, style, motion, interaction,
transitions, 3D, microinteractions, presentation.

KINETIC protects (read-only, always): backend, database, authentication,
authorization, API contracts, business rules, payments, application state,
analytics contracts, security logic, form *behavior* (validation/submission
logic — not its visual styling).

## Enforcement mechanics

1. **Zone map from scanner** (`10`): every path classified; unclassifiable →
   PRODUCT CORE (fail safe).
2. **Diff gate** (`04` stage 11): computed diff of every KINETIC run is checked
   against the zone map. Any product-core hunk → run halts, re-classified as a
   product decision, escalated to approval gate. No silent behavior changes,
   ever.
3. **If a design change requires behavior change** (e.g. a new nav structure
   needs a new route handler): it is documented as a *product delta* in the
   KineticJob, approved separately, and implemented as a distinct change — not
   smuggled inside a styling diff.
4. **Forms:** styling free; validation rules, submission endpoints, error
   semantics untouched. Evaluator regression suite exercises form behavior
   before/after.

## Design Regression Contract (task §28)

Before modifying an existing project, Hermes identifies critical behavior
(from scanner + a quick interaction census). After implementation, ALL must
verify green:

| Area | Verification |
|---|---|
| Navigation | every route reachable; active states correct |
| Forms | submit paths, validation messages, success/error states |
| Buttons/actions | click → expected state change (scripted sweep, `[SD: $10K "click every link and button"]`) |
| Auth surfaces | login/logout flows untouched and passing |
| API-connected UI | data rendering unchanged (network assertions or snapshot of rendered data) |
| Responsive layouts | 390/768/1440 no overflow/clipping (`13`) |
| Keyboard navigation | tab order + focus visibility intact (`16`) |
| Important app state | state transitions unaffected (route guards, persistence) |

> **A prettier UI with broken functionality is a failed KINETIC run.**

The regression suite is captured BEFORE the first change (baseline) and re-run
at every quality gate (`04`, `13`). Baseline artifacts live in `.kinetic/baseline/`.

## Failure handling

- Regression failure at a gate → automatic revert of the offending patch is the
  default proposal; Hermes may instead fix forward if the fix stays inside the
  experience layer and passes the gate on retry (bounded, `04`).
- Repeated failure on the same item → escalate to human with evidence trail.
