# 44 — Quality Floor

No candidate reaches human review unfinished. The floor extends the Phase-1
evaluator (`docs/13-evaluator.md`) with Gym-specific gates and a strict order.

## Gate sequence (per candidate)

```
GENERATED
 → TECHNICAL PASS      builds; renders; no console errors; no dead interactions
 → RESPONSIVE PASS     3 breakpoints (mobile/tablet/desktop): no overflow,
                       no broken layout, nav usable, content reachable
 → A11Y PASS           keyboard operable; focus visible; contrast thresholds;
                       reduced-motion variant present where motion exists
 → PERFORMANCE PASS    budget by K-level (Phase-1 P-classes): load, CWV,
                       animation frame budget; no continuous hidden loops
 → DESIGN EVALUATION   hierarchy, typography, spacing, composition, motion
                       purpose, surface appropriateness, originality
 → QUALIFIED | REJECTED
```

First four gates are **objective/heuristic** (scriptable checks — Phase-1
evaluator catalog). Design evaluation is **AI critic judgment**, explicitly
labeled as such, and for V1–V7 it can REJECT (below floor) but for V8/V9
experiments it only scores (37).

## Producer separation (hard)

```
objective checks     → pass/fail, deterministic, versioned rules
heuristic checks     → pass/warn with thresholds
AI critic judgments  → scores + rationale, NEVER presented as deterministic
human judgments      → TasteDecisions, final authority
```

Reports always show which producer produced which number. Subjective aesthetic
evaluation is never pretended to be objective.

## Reject → repair loop

```
REJECTED(diagnosis) → repair attempt (targeted patch from diagnosis)
                    → re-run from failed gate only (not full sequence)
                    → max 2 repair attempts per candidate (configurable)
                    → still failing → REJECTED-FINAL → negative knowledge (43)
```

Regeneration (fresh candidate, new brief emphasis) is a batch-level decision
costing a new slot attempt; repair is the cheap path and is tried first.

## Floor calibration

Gate thresholds are versioned config (`gym/quality-floor.json`). The V0
fidelity corpus calibrates them: if V0 studies of known-good award sites fail
a gate, the gate is suspect → investigate before tightening.
