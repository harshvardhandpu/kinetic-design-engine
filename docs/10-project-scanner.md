# 10 — Project Design Scanner (Design Intelligence Layer)

KINETIC understands the project BEFORE altering it. Scanner output is the
`ProjectDesignProfile` (schema: `schemas/project-design-profile.schema.json`) —
the input to every planning decision (`04` stages 1–3).

## Discovery targets

| Category | Signals | Detection means |
|---|---|---|
| Framework | react/next/svelte/sveltekit/vue/astro/vanilla | package.json deps, file extensions, config files (next.config, svelte.config, astro.config) |
| Routing | file-based vs config-based; route list | app/ or pages/ dir shape, route manifests |
| Component architecture | component dirs, naming, colocation | dir scan + sampling |
| CSS strategy | tailwind / css-modules / vanilla-extract / styled-* / plain css | config files, import patterns |
| Tailwind configuration | theme extend, tokens, plugins, v3 vs v4 | tailwind.config.*, @theme blocks |
| Design tokens | colors, spacing, radii, shadows, fonts | CSS vars, tailwind theme, token files |
| Fonts | families, roles, loading strategy | font-face, next/font, css vars |
| Existing animations | keyframes, transition usage, motion libs in deps, GSAP config | css scan + deps + usage grep |
| Existing dependencies | full dep tree + versions | package.json/lockfile |
| Reusable components | buttons, cards, inputs already present | component dir inventory + exports |
| Page hierarchy | route → page → section tree | route files + heading/section structure |
| **Surface type per route** | classification below | heuristics + LLM confirmation |
| Interactive states | hover/focus/disabled patterns | component sampling |
| Responsive behavior | breakpoints in use, container queries | css/config scan |
| Accessibility patterns | focus styles, aria usage, reduced-motion media queries | css + markup sampling |

## Three-zone map (mandatory output)

Every scanned path is classified into exactly one zone:

| Zone | Contents | KINETIC rights |
|---|---|---|
| **PRODUCT CORE** | backend, db, auth, authz, API contracts, business rules, payments, app state, analytics contracts, security logic, form behavior | READ ONLY — never modify (`18`) |
| **DESIGN SYSTEM** | tokens, theme files, base styles, shared component primitives | MODIFY WITH CARE — token additions OK; semantic changes need approval |
| **EXPERIENCE LAYER** | page composition, section markup, styles on top of system, motion, interaction, transitions | KINETIC's working area |

Ambiguity rule: unclassifiable path → PRODUCT CORE (fail safe).

## Surface taxonomy

| Surface | Intent | Default K ceiling | Motion default |
|---|---|---|---|
| **Monitor** | watch status/data over time (dashboards, feeds) | K1 | functional only |
| **Operate** | perform actions reliably (admin, tools, editors) | K1 | functional only |
| **Compare** | weigh options side by side (pricing, diffs, listings) | K2 | functional + subtle emphasis |
| **Configure** | set preferences/parameters (settings, forms) | K2 | functional only |
| **Decide / Learn** | persuade or inform (landing, marketing, docs intros) | K3–K4 | expressive allowed, one protagonist |
| **Explore** | browse/discover content (galleries, portfolios, catalogs) | K3 | expressive + spatial allowed |
| **Command / Inspect** | drill into detail (detail views, inspectors, consoles) | K2 | functional + transition continuity |

Classification inputs: route path patterns, page structure (hero presence,
form density, table density, nav role), copy verbs. Heuristics propose; the
planner LLM confirms; user can override in the KineticJob. Classification is
recorded per route in the profile and re-checked when routes change.

**Anti-indiscrimination rule** (`[ER]`, task §5): cinematic landing behavior on
Monitor/Operate/Configure surfaces is a planning error, rejected by the planner
before implementation, not fixed after.

## Scanner invariants

1. Read-only; no network; no execution of project code (static analysis +
   safe config parsing only).
2. Confidence per field (`high|medium|low`); low-confidence fields surface as
   explicit gaps in the profile — planner asks instead of guessing (`04` stage 1
   failure mode).
3. Incremental: re-scan after changes produces a diff (what changed in the
   experience layer) for regression checks.
4. Stack-neutral: unknown stack → minimal profile + gaps, never a crash.

## Phase-2 scope note

Phase 2 proves the scanner on 2 stacks (target: SvelteKit + Next.js or plain
Vite React — final pick in `24`) with: framework detection, token extraction,
surface classification of ≤5 routes, three-zone map. Full breadth above is the
v1 target, not the proof target.
