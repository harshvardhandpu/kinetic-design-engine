# 00 — Vision

## What KINETIC is

> A source-grounded, agent-operable web experience engine that allows Hermes to
> inspect an existing application, understand its design system, select reusable
> design/motion capabilities, implement them safely, visually evaluate the result,
> receive precise visual feedback, map that feedback back to source code, repair
> the implementation, and retain proven design patterns for future work.

## What KINETIC is not

| Anti-goal | Why |
|---|---|
| Component dump | Value is in the loop, not the inventory |
| Animation library | Motion is one capability among six layers |
| Framer clone | KINETIC operates on real project source, not a canvas |
| Award-site effect collection | Effects are means; principles are the asset |
| Monolithic React/Svelte package | Installed code must be project-owned (→ `06`) |
| Website template | KINETIC transforms existing products, never replaces them |
| Prompt collection | Prompts are inputs; schemas and contracts are the substrate |

## The fundamental loop

```
UNDERSTAND → DESIGN → IMPLEMENT → RENDER → INSPECT → ANNOTATE/EVALUATE
    → MAP TO SOURCE → REPAIR → VERIFY → LEARN
```

Full stage contracts: `04-hermes-closed-loop.md`.

## Six layers

1. **Design Intelligence** — scan project before touching it; classify surfaces;
   separate PRODUCT CORE / DESIGN SYSTEM / EXPERIENCE LAYER (`10`, `03`, `18`).
2. **Experience Registry** — source-owned installable capabilities with
   machine-readable manifests (`06`, `05`, `07`).
3. **Transformation Planner** — KineticJob schema, K-level budgets, three-option
   exploration, knowledge-vs-registry queries (`04`, `09`, `20`).
4. **Implementation Adapters** — stack-neutral; capability → simplest suitable
   technology (`17`, `23`).
5. **Visual Feedback / Inspection** — dev-only identifiers, structured feedback
   protocol, motion inspector (`11`, `12`, `14`-identifiers).
6. **Evaluation + Repair Loop** — automated evaluator, slop diagnostic, quality
   gates, regression contract (`13`, `18`, `04`).

## Separation of concerns

- **KNOWLEDGE** (why/when): principles, source research, surface compatibility.
  Queried to decide WHAT. → `knowledge/`, `03`.
- **REGISTRY** (how): actual installable code + manifests. Queried to decide
  HOW. → `registry/`, `06`.
- **AETHER** (visual language) vs **KINETIC** (runtime experience): separate
  projects, token-level contract. → `19`.
- **PRODUCT CORE** vs **EXPERIENCE LAYER**: hard protection boundary. → `18`.

## Prime directive

> **Hermes should need less guessing after every iteration.**

Every subsystem is judged by whether it improves the quality of context
available to the next design decision: better scan → better plan → better
install → better feedback → better patch → retained learning.

## Quality principles (ranked)

1. Source grounding — every claim traceable to evidence (`01`, `02`)
2. Visual-to-source traceability — feedback resolves to file:range (`11`)
3. Purposeful motion — functional > expressive > decorative (`03`)
4. Product-core safety — prettier UI with broken functionality is a failed run (`18`)
5. Agent readability — manifests, feedback, and reports are machine-parseable
6. Minimal dependency bloat — copy-source over runtime dependency (`06`)
7. Performance + accessibility as first-class budgets, not patches (`15`, `16`)
8. Human control — approval gates; no silent behavior changes (`04`, `20`)
9. Repeatability — same job + same project state → predictable outcome
10. Original design — extract principles, never clone sites (`03`)
