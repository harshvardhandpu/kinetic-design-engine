# Gate 2 Amendment — Source Audit Matrix

**As of:** 2026-08-22
**Authority:** generated from `gym/knowledge/sources/registry.json`
**Scope:** all 26 user-supplied URLs plus one separately registered audit discovery (the MIT UI Layouts repository). These are knowledge sources, not additional Phase-2.5 DesignCases.

A permissive status applies only to the exact code/artifact covered by the cited license. It never silently covers demo media, trademarks, logos, fonts, third-party icon sets, gallery screenshots, paid tiers, or linked sources.

## 1. Verified vs unverified licensing

| Source / primary evidence | License class | Terms review | Reuse-license review | Effective rights | AI training |
|---|---|---|---|---|---|
| [CUVII Labs Motion](https://labs.cuvii.dev/volume/motion) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `VERIFY_REQUIRED` | NO |
| [60fps.design](https://60fps.design/terms) | `VERIFIED_PROPRIETARY` | `VERIFIED` | `UNVERIFIED` | `LICENSE_GATED` | NO |
| [Transitions.dev](https://transitions.dev/terms.html) | `MIXED_FREE_AND_LICENSED` | `UNVERIFIED` | `UNVERIFIED` | `VERIFY_REQUIRED` | NO |
| [Motion Primitives](https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [Motion Primitives — Dock](https://raw.githubusercontent.com/ibelick/motion-primitives/main/LICENCE.md) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [NumberFlow](https://raw.githubusercontent.com/barvian/number-flow/main/LICENSE.md) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [NumberFlow — Examples](https://raw.githubusercontent.com/barvian/number-flow/main/LICENSE.md) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [Morphicons](https://raw.githubusercontent.com/guillermolg00/morphicons/main/LICENSE) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [Seesaw](https://www.seesaw.website/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [Inspora](https://www.inspora.design/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [WebInspoo](https://webinspoo.com/terms) | `VERIFIED_PROPRIETARY` | `VERIFIED` | `UNVERIFIED` | `REFERENCE_ONLY` | UNSPECIFIED/N/A |
| [Footer Design](https://www.footer.design/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [Unsection](https://www.unsection.com/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [Navbar Gallery](https://www.navbar.gallery/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [LogoInspo](https://www.logoinspo.com/terms-of-service) | `VERIFIED_PROPRIETARY` | `VERIFIED` | `VERIFIED` | `REFERENCE_ONLY` | UNSPECIFIED/N/A |
| [ASOInspo](https://www.asoinspo.com/terms) | `VERIFIED_PROPRIETARY` | `VERIFIED` | `UNVERIFIED` | `REFERENCE_ONLY` | NO |
| [Inspotype Discovery](https://inspotype.com/discovery) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [Aceternity UI Components](https://ui.aceternity.com/licence) | `MIXED_FREE_AND_LICENSED` | `VERIFIED` | `VERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [React Bits](https://raw.githubusercontent.com/DavidHDev/react-bits/main/LICENSE.md) | `MIXED_FREE_AND_LICENSED` | `UNVERIFIED` | `VERIFIED` | `ALLOW_ABSTRACT_PATTERN` | UNSPECIFIED/N/A |
| [Fancy Components](https://raw.githubusercontent.com/danielpetho/fancy/main/LICENSE) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [Fancy Components — Installation](https://raw.githubusercontent.com/danielpetho/fancy/main/LICENSE) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [Fancy Components — Components](https://raw.githubusercontent.com/danielpetho/fancy/main/LICENSE) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |
| [UI Layouts Pro](https://pro.ui-layouts.com/blocks) | `VERIFIED_PROPRIETARY` | `UNVERIFIED` | `UNVERIFIED` | `LICENSE_GATED` | UNSPECIFIED/N/A |
| [Originkit](https://www.originkit.dev/) | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | `VERIFY_REQUIRED` | NO |
| [Toolfolio](https://toolfolio.com/) | `NOT_APPLICABLE` | `UNVERIFIED` | `UNVERIFIED` | `TOOL_DISCOVERY_ONLY` | UNSPECIFIED/N/A |
| [Design Minis](https://www.designminis.com/) | `NOT_APPLICABLE` | `UNVERIFIED` | `UNVERIFIED` | `TOOL_DISCOVERY_ONLY` | UNSPECIFIED/N/A |
| [UI Layouts — Free Repository](https://raw.githubusercontent.com/ui-layouts/uilayouts/main/LICENSE) | `VERIFIED_OPEN_SOURCE` | `UNVERIFIED` | `VERIFIED` | `ALLOW_CODE_INGEST` | UNSPECIFIED/N/A |

`License class` describes the source's observed ownership/tier posture; it is not itself a reuse grant. `Reuse-license review=UNVERIFIED` means metadata and abstract/manual reference may remain useful, but raw assets and code are blocked unless another exact-use policy permits them. `MIXED_FREE_AND_LICENSED` requires tier/item selection before use.

## 2. Automated-access restrictions

| Source | Registry status | Effective KINETIC policy | Relevant modes |
|---|---|---|---|
| [CUVII Labs Motion](https://labs.cuvii.dev/volume/motion) | `PROHIBITED` | NO AUTOMATED INGEST | `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [60fps.design](https://60fps.design/) | `PROHIBITED` | NO AUTOMATED INGEST | `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST` |
| [Transitions.dev](https://transitions.dev/) | `PROHIBITED` | NO AUTOMATED INGEST | `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [Motion Primitives](https://motion-primitives.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Motion Primitives — Dock](https://motion-primitives.com/docs/dock) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [NumberFlow](https://number-flow.barvian.me/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [NumberFlow — Examples](https://number-flow.barvian.me/examples) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Morphicons](https://www.morphicons.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Seesaw](https://www.seesaw.website/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [Inspora](https://www.inspora.design/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [WebInspoo](https://webinspoo.com/) | `PROHIBITED` | NO AUTOMATED INGEST | `NO_AUTOMATED_INGEST` |
| [Footer Design](https://www.footer.design/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [Unsection](https://www.unsection.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [Navbar Gallery](https://www.navbar.gallery/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [LogoInspo](https://www.logoinspo.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [ASOInspo](https://www.asoinspo.com/) | `PROHIBITED` | NO AUTOMATED INGEST | `NO_AUTOMATED_INGEST` |
| [Inspotype Discovery](https://inspotype.com/discovery) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `VERIFY_REQUIRED` |
| [Aceternity UI Components](https://ui.aceternity.com/components) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `LICENSE_GATED_RUNTIME` |
| [React Bits](https://reactbits.dev/get-started/index) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Fancy Components](https://www.fancycomponents.dev/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Fancy Components — Installation](https://www.fancycomponents.dev/docs/installation) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [Fancy Components — Components](https://www.fancycomponents.dev/components) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |
| [UI Layouts Pro](https://pro.ui-layouts.com/blocks) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST` |
| [Originkit](https://www.originkit.dev/) | `PROHIBITED` | NO AUTOMATED INGEST | `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [Toolfolio](https://toolfolio.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `NO_AUTOMATED_INGEST` |
| [Design Minis](https://www.designminis.com/) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | `NO_AUTOMATED_INGEST` |
| [UI Layouts — Free Repository](https://github.com/ui-layouts/uilayouts) | `UNKNOWN` | MANUAL REFERENCE ONLY UNTIL VERIFIED | — |

`UNKNOWN` is not permission. Playwright must refuse automated source capture when the effective policy is manual-only, regardless of technical accessibility. A licensed API/MCP exception is scoped to its own terms and receipt; it does not authorize website crawling.

## 3. Code-ingestion eligibility

| Source | Code status | Eligibility | Permitted modes |
|---|---|---|---|
| [CUVII Labs Motion](https://labs.cuvii.dev/volume/motion) | `UNKNOWN` | BLOCKED UNTIL VERIFIED | `REFERENCE_ABSTRACTION`, `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [60fps.design](https://60fps.design/) | `LICENSE_GATED` | LICENSED BUILD-TIME/RUNTIME ONLY; NOT REUSABLE CORPUS | `REFERENCE_ABSTRACTION`, `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST` |
| [Transitions.dev](https://transitions.dev/) | `PER_ITEM` | BLOCKED PER ITEM/TIER UNTIL VERIFIED | `REFERENCE_ABSTRACTION`, `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [Motion Primitives](https://motion-primitives.com/) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [Motion Primitives — Dock](https://motion-primitives.com/docs/dock) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [NumberFlow](https://number-flow.barvian.me/) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [NumberFlow — Examples](https://number-flow.barvian.me/examples) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [Morphicons](https://www.morphicons.com/) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [Seesaw](https://www.seesaw.website/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [Inspora](https://www.inspora.design/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [WebInspoo](https://webinspoo.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `NO_AUTOMATED_INGEST` |
| [Footer Design](https://www.footer.design/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [Unsection](https://www.unsection.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [Navbar Gallery](https://www.navbar.gallery/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [LogoInspo](https://www.logoinspo.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [ASOInspo](https://www.asoinspo.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `NO_AUTOMATED_INGEST` |
| [Inspotype Discovery](https://inspotype.com/discovery) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `VERIFY_REQUIRED` |
| [Aceternity UI Components](https://ui.aceternity.com/components) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `BUILD_TIME_LIBRARY`, `LICENSE_GATED_RUNTIME` |
| [React Bits](https://reactbits.dev/get-started/index) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `REFERENCE_ABSTRACTION`, `BUILD_TIME_LIBRARY` |
| [Fancy Components](https://www.fancycomponents.dev/) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [Fancy Components — Installation](https://www.fancycomponents.dev/docs/installation) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [Fancy Components — Components](https://www.fancycomponents.dev/components) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |
| [UI Layouts Pro](https://pro.ui-layouts.com/blocks) | `LICENSE_GATED` | LICENSED BUILD-TIME/RUNTIME ONLY; NOT REUSABLE CORPUS | `BUILD_TIME_LIBRARY`, `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST` |
| [Originkit](https://www.originkit.dev/) | `UNKNOWN` | BLOCKED UNTIL VERIFIED | `REFERENCE_ABSTRACTION`, `BUILD_TIME_LIBRARY`, `LICENSE_GATED_RUNTIME`, `NO_AUTOMATED_INGEST`, `VERIFY_REQUIRED` |
| [Toolfolio](https://toolfolio.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `TOOL_DISCOVERY_ONLY`, `NO_AUTOMATED_INGEST` |
| [Design Minis](https://www.designminis.com/) | `PROHIBITED` | INELIGIBLE AS REUSABLE CODE CORPUS | `TOOL_DISCOVERY_ONLY`, `NO_AUTOMATED_INGEST` |
| [UI Layouts — Free Repository](https://github.com/ui-layouts/uilayouts) | `ALLOWED` | ELIGIBLE — canonical code only; pin version/commit and retain license | `REFERENCE_ABSTRACTION`, `CODE_RECIPE_INGEST` |

No eligible entry has been ingested in Gate 2. `CODE_RECIPE_INGEST` remains a future gated operation with a pinned source version/commit, license and attribution receipt, extracted technique, and KINETIC recipe/primitive relationship.

## 4. Contradictions and blockers

1. **60fps terminology conflict — BLOCKED FOR TRAINING/EVALUATION.** Official terms permit licensed reference/MCP use but prohibit using 60fps content to train, fine-tune, test, benchmark, or evaluate an ML model, and prohibit systematic copying/mirroring. KINETIC must never interpret its broader internal “training” label as permission here. Keep 60fps as manual/licensed live reference only; no evaluator-calibration or reusable corpus content.
2. **React Bits is not plain MIT — BUILD-TIME ONLY.** The canonical license is MIT + Commons Clause and prohibits selling, sublicensing, or redistributing components alone, bundled, or ported. KINETIC may learn abstract patterns and use it inside licensed applications; it must not clone, port, vendor, or publish a React Bits-derived component library.
3. **CUVII provenance gap — VERIFY REQUIRED.** The page invites copying its code but acknowledges recreated work and sometimes unknown sources; robots declare `ai-train=no` and disallow major AI/browser-rendering crawlers. Do not ingest code or automate capture until provenance and terms are verified.
4. **Public copy/paste is not a reusable-library grant.** Transitions.dev and Originkit advertise copy/use workflows, but the audit did not verify rights broad enough for a reusable KINETIC code corpus. Aceternity's official item license permits end-product use while prohibiting source redistribution and marketplace/template resale; it is build-time only. Free/Pro/item policies stay separate.
5. **WebInspoo automation prohibition — HARD BLOCK.** Current official terms expressly prohibit automated scraping/harvesting and copying/distribution/derivative works without permission. Only lawful manual reference abstraction is allowed.
6. **Third-party gallery rights remain separate.** 60fps, ASOInspo, LogoInspo, Footer Design, Unsection, Navbar Gallery, Inspotype, and similar catalogues do not convey ownership of showcased app/site/logo/font assets.
7. **Open-source code does not license demo assets.** Motion Primitives, NumberFlow, Morphicons, Fancy Components, and the separately registered UI Layouts repository have verified MIT code licenses; third-party icons, fonts, images, trademarks, demo media, and UI Layouts Pro remain separate.
8. **UI Layouts free/Pro split is explicit.** The supplied Pro URL remains proprietary/license-gated. `https://github.com/ui-layouts/uilayouts` is a separate MIT source record; its rights never flow to Pro blocks/templates.
9. **Originkit MCP rights remain unverified.** The official integrations page verifies a bearer-key MCP endpoint and two tools, while robots publish `ai-train=no`; component-source license, redistribution rights, MCP terms, pricing, and limits remain unverified.
10. **Tool directories are not tool licenses.** Toolfolio and Design Minis may only discover original tools; each discovered tool requires its own source record and audit.
11. **Obsidian write is blocked at Gate 2.** The canonical vault is read-only in this runtime and the architecture requires explicit staged host apply plus validation. No mirror notes have been written.
12. **Vision critic remains unverified.** Provider, exact model, route, cost class, and limits are not exposed. `HUMAN_VISUAL_GATE` is mandatory; anonymous automated scores cannot calibrate the evaluator.

## 5. Gate boundary

- Calibration remains `case-ee9eaf0dc9` — Wanaka Studio.
- Candidate cap remains V0 fidelity study + V1/V2 originals; optional V3 remains out.
- No source here was promoted to a DesignCase.
- No bulk crawler, daily training, cron, or weight-training corpus is authorized.
- Wanaka V0/V1/V2 implementation has **not** started.
- Gate 3 has **not** started.
