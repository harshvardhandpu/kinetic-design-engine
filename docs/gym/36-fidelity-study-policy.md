# 36 — Fidelity Study Policy (V0)

V0 has exactly one purpose:

> Determine whether KINETIC/Hermes correctly understood the reference design
> and experience.

## Rules

```yaml
mode: fidelity-study
deployable: false          # hard flag; deployment gate refuses V0 always
original_work: false       # never counted as original output anywhere
```

1. **Concept, not content.** Reconstruct layout grammar, motion choreography,
   interaction model, hierarchy, and spatial behavior. Replace ALL proprietary
   assets: branding, logos, artwork, photography, video, illustration, copy text,
   fonts without license → placeholders (generated/CC0/open-licensed) that
   preserve the DESIGN role (same aspect ratios, weight classes, color roles).
2. **Observe, don't exfiltrate.** Study public runtime behavior (DOM, computed
   styles, network-visible bundle characteristics, canvas probes). Never download,
   decompile, or reconstruct hidden proprietary source code. Never seek private
   Figma/source files without authorization.
3. **No access-control bypass.** Paywalls, logins, bot-gates = skip the case or
   use an archived public snapshot (`docs/gym/32`).
4. **Fidelity is scored, not assumed.** V0 gets a `fidelity_report`:
   - per-aspect match grades (layout / typography-roles / color-roles / motion /
     interaction / hierarchy) with evidence (side-by-side artifact refs)
   - `understood: true|false|partial` verdict
   - explicit list of what could NOT be reproduced and why (e.g. proprietary
     shader effect observed but implementation unknown → marked, not faked)
5. **A failed V0 is valuable.** If V0 scores low, the case's STUDIED analysis is
   suspect → re-study before generating V1–V9. V0 failure is a curriculum signal,
   not waste.

## What V0 is NOT

- not a clone to ship, not a template to sell, not training data
- not proof of originality (the opposite — it is declared reconstruction)
- not allowed to carry the reference's real brand into any review UI beyond
  "this is a study of <case_id>"

## Retention

V0 builds are BUILD-CACHE class except their fidelity_report and key screenshots,
which are HIGH-VALUE (they calibrate the evaluator and future studies).
(`docs/gym/52`)

## Phase 2.5 human boundary

Phase 2.5 initializes **V0 only**. V1 and V2 do not exist until V0 reaches
`DESIGN_EVALUATED` with a schema-valid `fidelity-report@0.1` containing paired
reference/V0 visual evidence for every required dimension and an explicit
`approval: APPROVED` from `approval_producer: human` with `approved_at`.
Automated or AI output cannot supply that authority. At most V1 and V2 may then
enter `PLANNED`; V0 remains internal, undeployable, non-original, and exempt
from originality qualification.
