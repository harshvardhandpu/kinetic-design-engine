# 13 — Automated Visual Evaluator

Second feedback producer (`11`): machine checks Hermes can run without a human.
Output: `EvaluationResult` (schema `schemas/evaluation-result.schema.json`),
converted 1:1 into `VisualFeedback` items with `producer: "evaluator"`.

## Check catalog

| Group | Check | Means | Evidence basis |
|---|---|---|---|
| Layout | overflow (horizontal scroll at 390/768/1440) | headless browser metrics | `[SD: $10K prompt §5]` |
| Layout | alignment & spacing consistency (off-grid elements, inconsistent gaps) | box-model sampling vs token scale (`08`/`10`) | `[SD: DesignLab tell #01]` |
| Layout | layout shift (CLS during load + during animations) | PerformanceObserver | `[EI]` |
| Typography | unreadable text (contrast < 4.5:1 body / 3:1 large; font size floors) | computed styles + WCAG math | `[SD: K1 contrast rules]` |
| Typography | measure violations (line length outside ~45–90ch body) | computed width/ch | `[SD: $10K prompt 60–75ch]` |
| Color | contrast pairs per theme; dark-mode parity | computed styles both themes | `[SD: K1 light/dark rules]` |
| Interaction | focus states present & visible on all interactive elements | focus sweep + style diff | `[SD: K1]` |
| Interaction | broken interactions (dead links/buttons: click → no navigation/state/error) | scripted click sweep | `[SD: $10K prompt "click every link and button"]` |
| Console | console errors/warnings zero-tolerance | console capture | `[SD: $10K prompt]` |
| Motion | motion misuse: decorative motion on Monitor/Operate surfaces; motion without trigger; exit animations missing | primitive receipt × surface map × motion handles (`12`) | `[SD: DesignLab tell #02]`, `[SD: $10K "transitions out"]` |
| Motion | excessive animation: simultaneously active effects > K-level budget | motion handle census | `09` budget semantics |
| Motion | token discipline: raw duration/easing literals in experience-layer code | static scan | `08` governance |
| Performance | FPS floor during scripted scroll; long tasks; canvas size; particle counts | rAF sampling + PerformanceObserver | `15` |
| Performance | Core Web Vitals regression (LCP/CLS/INP deltas vs pre-change baseline) | Lighthouse-style metrics | `18` regression |
| Responsive | breakage per breakpoint (overlap, clipping, tap-target < 44px) | per-viewport sweep | `[SD: $10K 390/768/1440]`, `[SD: K1 touch targets]` |
| A11y | reduced-motion variant intact; keyboard reachability; aria sanity | forced `prefers-reduced-motion` run + tab sweep | `16` |
| Regression | product-core behavior contract | `18` regression suite | `18` |

## AI-design-slop diagnostic

`[SD: DesignLab "5 tells" + $10K prompt banned list]` — detectors, each
returning a finding with evidence, not a veto:

| Detector | Signal | Origin |
|---|---|---|
| `generic-hero-3-cards` | hero + N equal-weight feature cards with icons | task §19 example; DesignLab tell #03 |
| `default-purple-gradient` | purple-on-dark SaaS gradient as unexamined default | `[SD: $10K BANNED]` |
| `tailwind-default-palette` | colors matching default TW values verbatim | `[SD: $10K BANNED]` |
| `unearned-glassmorphism` | blur/glass surfaces without hierarchy purpose | DesignLab tell #04 |
| `everything-centered` | uniform center alignment across sections | task §19 |
| `equal-weight-grid` | feature grid with no primary/secondary distinction | DesignLab tell #01/#03 |
| `decorative-icons-everywhere` | icon density without informational role | task §19 |
| `random-oversized-stats` | large numbers with no data source | task §19 + `03` P6 |
| `purposeless-motion` | animations classified decorative on functional surfaces, or no trigger | DesignLab tell #02 |
| `banned-display-fonts` | Inter/Roboto/Arial/system-ui as display face | `[SD: $10K BANNED]` |
| `decorative-numbering` | 01/02/03 section labels encoding nothing true | `[SD: $10K]` |
| `fake-copy` | lorem ipsum / "crafted with passion" / "elevate your brand" | `[SD: $10K banned copy]` |

**Anti-taste-hardcoding rule** (task §19): findings are always contextualized by
(project context, surface type, existing design language from the profile,
user-selected direction from the KineticJob). A detector reports *"this pattern
is present and conflicts with <stated context>"* — never *"this is ugly"*.
Severity is computed from conflict strength, not from aesthetic opinion.
`[ER]`

## EvaluationResult shape

```jsonc
{
  "schema": "kinetic/evaluation-result@0.1",
  "job_id": "…", "run": 3, "timestamp": "…",
  "viewport": "desktop-1440",
  "baseline_ref": "run-1",              // deltas vs pre-change baseline
  "checks": [
    { "id": "overflow-x", "group": "layout", "status": "pass|fail|warn|skip",
      "evidence": {…}, "elements": ["[data-kinetic-id=…]"] }
  ],
  "slop_findings": [
    { "detector": "default-purple-gradient", "severity": "medium",
      "context_conflict": "project palette is warm-neutral (profile §tokens)",
      "elements": ["…"] }
  ],
  "metrics": { "fps_min": 58, "cls": 0.02, "long_tasks": 1, "active_effects_peak": 4 },
  "gate": { "passed": false, "blocking": ["overflow-x", "console-errors"] }
}
```

## Quality gates (exit conditions for the repair loop, `04`)

A run passes gates iff: regression suite green AND zero `blocker`/`fail` in
layout/console/responsive groups AND performance metrics within the job's
budget AND reduced-motion run intact. Slop findings are `warn` by default —
they inform iteration and the human decision, they do not auto-block
(`[ER]`, anti-hardcoding rule).

## Phase-2 minimal evaluator

overflow-x, console errors, contrast (body text), focus-state presence,
reduced-motion static check, token-discipline scan, and 3 slop detectors
(generic-hero-3-cards, default-purple-gradient, purposeless-motion). Full
catalog is v1.
