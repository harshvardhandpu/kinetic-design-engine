# 03 — Design Principles

Normative rules for every KINETIC transformation. Sources: DesignLab tells
(`02` §S1), the $10K prompt's guardrails (`02` §S1.3), observed reference
behavior (`02` §S4–S8). Each rule carries its origin tag.

## P1 — One decision per page, committed

`[SD: DesignLab]` "Pick one thing per page and commit." A signature technique
executed deep beats five executed shallow. KINETIC planner must select ONE
primary experience move per surface and subordinate all other motion to it.

## P2 — Motion must have a reason

`[SD: DesignLab tell #02]` "Motion has no reason" is a top-5 cheapness tell.
KINETIC classifies every motion instance:

| Class | Purpose | Budget priority |
|---|---|---|
| **Functional** | state communication, loading, navigation continuity, feedback, focus, selection | Highest — always allowed if earned |
| **Expressive** | brand personality, storytelling, hero choreography, product presentation | Medium — budgeted by K-level + surface |
| **Decorative** | non-essential ambience, particles, background movement | Lowest budget — first to degrade/drop |

Never use motion to hide weak hierarchy (`[SD: DesignLab tells #01/#04]` — glow
doing hierarchy's job; space without hierarchy).

## P3 — Hierarchy before decoration

`[SD: DesignLab tells #01, #03, #04]` Space must encode hierarchy; the grid must
not substitute for structure; glow must not substitute for hierarchy. Evaluator
checks in `13` operationalize this.

## P4 — Dark mode and theme are decisions, not defaults

`[SD: DesignLab tell #05]` Theme choices must be explicit in the plan
(KineticJob records them). `[SD: $10K prompt]` Never pure #000/#FFF; banned:
Tailwind default palette values, purple-on-dark SaaS gradients as unexamined
defaults.

## P5 — No default typography

`[SD: $10K prompt]` Three type roles (display / text / mono-label); banned as
display: Inter, Roboto, Arial, system-ui. `[EI]` KINETIC scanner reads the
project's existing type system first; the ban applies to KINETIC *introducing*
fonts, not to respecting a project's existing Inter body face.

## P6 — Content truth before styling

`[SD: $10K prompt]` Copy with real names/prices/constraints before CSS; section
numbering must encode something true (decorative 01/02/03 banned). `[EI]`
KINETIC never invents fake stats/testimonials to fill a layout; placeholder
content is flagged by the evaluator.

## P7 — Resilient rendering

`[SD: $10K prompt]` Never let JS failure blank the page: no CSS-hidden content
that only JS reveals; initial states set from JS. `[ER]` Every KINETIC primitive
must define a **no-JS/failed-hydration state** (content visible, effect absent).

## P8 — Reduced motion is a first-class variant

`[SD: $10K prompt requires prefers-reduced-motion static fallback]` See `16`:
reduced motion is designed, not patched.

## P9 — Verify like a hostile critic

`[SD: $10K prompt §5]` Real-browser verification at 390/768/1440; zero console
errors; no horizontal overflow; click every link/button; hover every card; watch
pinned sections enter AND leave ("transitions out are where builds look cheap");
"where does the eye die?"; minimum two passes. `[EI]` This manual loop becomes
KINETIC's evaluator + quality gates (`13`, `04` stage 9).

## P10 — Ship with receipts

`[SD: $10K prompt §6]` Document concept, system choices, and an honest iteration
log of what verification caught. `[EI]` KINETIC run reports (`04` stage 10) are
the automated version: every run leaves an auditable trail.

## P11 — Extract principles, never clone

`[ER]` Source analysis (`02`) extracts layout/motion/interaction principles.
Copying a reference site's assets, branding, or composition wholesale is
prohibited; registry entries record `source_inspiration` for provenance, not
provenance-as-permission-to-clone. `[SD: sv-efferd credit pattern]` Where work
is adapted, credit the original — the ecosystem already models this.

## P12 — Surface determines vocabulary

`[EI from task §5 + 02 evidence]` Cinematic landing behavior on a dashboard is a
category error. Surface classification (`10` §Surface taxonomy) gates which
recipes/primitives are even eligible. Monitor/Operate surfaces default to
functional motion only; Decide/Learn may earn expressive hero motion; Explore
may earn spatial play.

## P13 — Technology follows capability

`[EI; reinforced by S6 evidence: a "3D" sphere running Canvas 2D]` Choose the
simplest implementation that delivers the capability (CSS → WAAPI → framework
motion → GSAP → Canvas/WebGL). Full router: `23`. No technology is mandatory
because KINETIC supports it.

## P14 — Project owns the result

`[SD: shadcn/jsrepo model]` Installed source is copied into the project:
inspectable, modifiable, dependency-light, token-adaptable (`06`). KINETIC adds
no required runtime package.

## P15 — Product core is untouchable

`[EI; task §27]` PRODUCT CORE ≠ EXPERIENCE LAYER. Full contract: `18`.

## P16 — Names must be true

`[SD: sv-particles contains no particles]` Registry ids, primitive names, and
recipe names are semantically validated at publish time; misleading names are a
registry lint error.
