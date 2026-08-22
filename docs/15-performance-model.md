# 15 — Performance Model

Performance classes assigned to every primitive and recipe (`06` manifest,
`07` recipe aggregate), plus the safeguard catalog.

## Classes

| Class | Definition | Typical tech | Budget guidance |
|---|---|---|---|
| **P0** | Negligible — compositor-only, no JS per frame | CSS transitions on transform/opacity | Always allowed |
| **P1** | Low — occasional JS, no continuous loop | WAAPI one-shots, IntersectionObserver reveals | Free at K1+ |
| **P2** | Moderate — bounded per-frame work or many DOM nodes | DOM-grid effects (S7 class: 350 nodes), light canvas | Counted against K2+ budget |
| **P3** | High — continuous JS/canvas render loop, bounded | Canvas2D particle systems (S6 class), marquee tracks | K3+, one instance, FPS floor 50 |
| **P4** | GPU-intensive — WebGL/WebGPU scenes, shaders, large particle counts | WebGL point clouds, fluid sims | K4+ only, downgrade chain mandatory (`14`), FPS floor 45 |

Classification evidence: S4 deck = P0 (transform transitions only, `[SD]`);
S5 letter split = P1 (one-shot transitions on 19 nodes, `[SD]`); S7 pixel grid =
P2 (350 animated DOM nodes, `[SD]`); S6 sphere = P3 (continuous Canvas2D loop,
`[SD]` context probe); S8 full page = aggregate P3 with 221 GSAP-managed nodes
(`[SD]`) — proof that "many small P1s" can sum to P3: **classification must
consider simultaneity** (`09` rule 2).

## Safeguard catalog

| Hazard | Safeguard | Enforcement |
|---|---|---|
| Layout thrashing | primitives must not read layout in animation loops; batch reads (ResizeObserver) | manifest declares `layout_reads: none|batched|per-frame` — per-frame = lint error |
| Large canvases | canvas sized ≤ viewport × DPR cap (2); offscreen portions not rendered | adapter enforces; evaluator measures |
| Excessive particles | count caps per class (P3 ≤ ~2k 2D points; P4 declares count) | manifest `limits`; evaluator census |
| Continuous render loops | every loop has a stop condition (idle → halt; visibility → pause) | motion handle contract (`12`); evaluator detects always-on rAF |
| Off-screen animation | IntersectionObserver gating mandatory for scroll effects | adapter default; evaluator check |
| Hidden-tab animation | pause on `visibilitychange` | adapter default |
| Shader complexity | P4 shaders declare pass count; no unbounded loops | manifest; Phase-2 manual review |
| Memory | no retained frame buffers beyond declared; texture sizes capped | manifest `limits` |
| Long tasks | init work chunked (< 50ms tasks); no sync work in reveal callbacks | evaluator long-task observer |
| Mobile battery | decorative loops auto-stop after N seconds idle; coarse-pointer policy (`14`) | adapter policy |
| CWV regression | LCP/CLS/INP deltas vs baseline at gates | evaluator (`13`) + regression contract (`18`) |
| `will-change` abuse | declared per-element only while animating (S7 puts it on 350 cells — flagged pattern) | evaluator check `will-change-census` |

## Budgets per K-level (simultaneous)

| K-level | Max simultaneous P2 | P3 instances | P4 instances |
|---|---|---|---|
| K0–K1 | 0 | 0 | 0 |
| K2 | 2 | 0 | 0 |
| K3 | 3 | 1 | 0 |
| K4 | 3 | 1 | 1 |
| K5 | unbounded (logged) | | |

`[ER]` Numbers are initial defaults; Phase-2 measurements on real devices may
revise them — they are tokens of policy, not laws of physics.

## Measurement protocol (evaluator, `13`)

Scripted pass: load → idle 2s → scroll full page at constant speed → interact
with each kinetic element → idle 2s. Sample: rAF FPS, long tasks, CLS, canvas
count/size, active motion handles. Report min/median FPS + peaks. Baseline =
pre-change run on same machine; gates compare deltas, not absolutes, where
hardware varies.
