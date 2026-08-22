# IZANAMI Batch 1 — Human Quality-Floor Diagnosis

**Case:** `case-fe653973ef` · **Decision:** `td-20260822-izanami1` · **Outcome:** `REJECT_ALL / NO_ACCEPTABLE_WINNER`

## Evidence labels and limit

- **HUMAN-FEEDBACK** — direct visual judgment supplied by the user.
- **SOURCE-DERIVED** — facts recorded from the live reference in `gym/corpus/cases/case-fe653973ef.json` or normative Phase-1/1.5 docs.
- **ENGINE-INFERENCE** — likely quality gap inferred from candidate HTML/CSS/JS versus those sources. These are diagnostic hypotheses, not visual facts or personal-taste claims.

The active diagnostic did not perform a vision-based aesthetic evaluation. Only the human verdict establishes actual design quality.

## Human decision

**HUMAN-FEEDBACK:** “None of them is particularly good. V2 and V3 are okay. None of them can be compared to any award-winning website.”

Two signals are preserved separately:

1. **Relative preference (weak, unordered):** V2 and V3 are more acceptable than the batch overall. Neither outranks the other.
2. **Absolute quality floor (controlling):** all V0–V3 fail; no winner is accepted; human-perceived award-quality gap is **substantial**.

No attribute-level taste claim is justified from this batch.

## Source quality target

- **SOURCE-DERIVED:** IZANAMI is a K4 single-page narrative spanning about 11 viewports, with 113 grid and 60 flex usages, 14 fixed elements, numbered chapters, bilingual navigation, and dual-city clocks (`DesignCase: analysis.layout`, lines 25–37).
- **SOURCE-DERIVED:** Its type system combines Cinzel/Playfair display, Shippori Mincho Japanese, and Satoshi/Helvetica UI roles; character is ceremonial high-contrast serif with generous tracking (`DesignCase: analysis.typography`, lines 39–46).
- **SOURCE-DERIVED:** Motion uses GSAP + ScrollTrigger + Lenis, page in/out transitions, cloud ambience, scroll fades, CTA reveals, 103 active transforms, and pinned chapters (`DesignCase: analysis.motion`, lines 56–66).
- **SOURCE-DERIVED:** Depth comes from restrained two-color art direction, imagery, and an ambient cloud layer—not additional palette (`DesignCase: principles`, lines 83–88).
- **SOURCE-DERIVED:** Phase-1 requires one deeply executed signature move, hierarchy before decoration, non-default typography, purposeful motion, and scrutiny of section exits (`docs/03-design-principles.md`, P1–P9).

## Process-level causes found before candidate-level diagnosis

1. **ENGINE-INFERENCE:** The runner persisted `brief: null` for V0–V3, despite the Variant Protocol requiring a direction and varied dimensions (`docs/gym/35-variant-protocol.md`, lines 58–73). Direction comments exist inside HTML, but the generation contract was not durable or machine-checkable.
2. **ENGINE-INFERENCE:** V0 has no persisted `fidelity_report`, although the Fidelity Study Policy requires scored layout, typography, color, motion, interaction, and hierarchy evidence before V1–V9 (`docs/gym/36-fidelity-study-policy.md`, lines 27–35).
3. **ENGINE-INFERENCE:** V0–V3 receipts contain `design_cases_retrieved: []`. The candidates reference the case conceptually, but the required source-grounded retrieval was not proven in their reproducibility receipts.
4. **ENGINE-INFERENCE:** The design gate remained `pending-vision-or-human` until this review. Therefore the pipeline let deterministic technical qualification reach review without an operating design-quality floor.
5. **ENGINE-INFERENCE:** Originality comparisons measured distance from the reference, not excellence. `PASS-distinct` cannot prove composition, art direction, choreography, or cohesion.
6. **ENGINE-INFERENCE:** Candidate scripts contain raw motion constants (for example V0 lines 182–197, V1 lines 150–158, V2 lines 105–115, V3 lines 75–80), despite the motion-token contract forbidding unregistered arbitrary values (`docs/08-motion-tokens.md`, lines 41–43).

## Candidate gaps by required dimension

Every cell below is **ENGINE-INFERENCE** unless explicitly marked otherwise.

| Dimension | V0 fidelity study | V1 Light Archive | V2 Horizontal Procession | V3 Whispering Statement |
|---|---|---|---|---|
| Composition sophistication | Repeated centered max-width chapters and uniform media blocks approximate the source skeleton but not its 113-grid/60-flex complexity (V0 lines 45–76, 103–145). | One 240px index plus one content column; coherent but structurally simple (V1 lines 28–73). | Intro → one sticky horizontal track → outro is the clearest single compositional move (V2 lines 29–50, 60–98), but only three uniform plates. | Single centered stack with cards and footer band; intentionally minimal, but too little composition to approach a K4 narrative (V3 lines 29–45, 49–67). |
| Typography | Uses source-like type roles, but no recorded visual fidelity scoring; hierarchy is mostly standard clamps and repeated styles (V0 lines 20–25, 45–75). | Oversized Helvetica Neue hero plus mono labels; introduces a default grotesque as display, contrary to P5’s non-default display intent (V1 lines 20–21, 43–49). | Georgia numerals/headlines plus Helvetica/Arial body are familiar defaults rather than a distinctive system (V2 lines 21–22, 30–44). | Helvetica Neue bold display plus mono labels resembles a generic editorial/product pattern (V3 lines 21–22, 29–45). |
| Art direction | Bone-on-black and fog preserve source roles, but four radial-gradient placeholders cannot carry the reference imagery’s art direction (V0 lines 57–61, 108–136). | Bone paper, rust accent, and one abstract gradient plate form a restrained catalog, but media art direction is effectively absent (V1 lines 15–21, 61–67). | Near-black + gold + giant Roman numerals is legible but a common luxury trope; no supporting media system (V2 lines 16–23, 40–44). | Paper/teal/coral, rounded cards, and marquee read as a familiar modern landing-page vocabulary rather than source-caliber identity (V3 lines 16–22, 38–45). |
| Visual hierarchy | Source chapter labels and content exist, but repeated chapter templates flatten differences between philosophy/projects/company. | Strong hero/entry distinction, then three near-identical rows; hierarchy depth stops quickly. | Strong intro and numeral hierarchy; secondary text/rules repeat without additional levels. | Headline dominates, followed by three equal cards and one band; hierarchy is shallow. |
| Spatial rhythm | Uniform `16vh` chapter padding and repeated `62vh` media blocks create predictable cadence rather than varied ceremonial pacing (V0 lines 51–66). | Repeated row padding and one plate create regular editorial rhythm with little tension/release (V1 lines 51–73). | `320vh` sticky progression creates deliberate pacing (V2 lines 36–44), but each plate has the same spatial treatment. | Fixed one-screen layout and constant `2.2rem` stage gap compress the narrative into one beat (V3 lines 25–39). |
| Motion choreography | Several independent effects—char reveal, section reveal, parallax, grid reveal, fog—are mounted, but no persisted choreography/timeline connects them (V0 lines 181–244). | Reveal-stagger plus one parallax plate; motion vocabulary is too narrow for the K4 source (V1 lines 145–159). | Reveal + scroll-driven horizontal movement is one coherent move and may help explain its relative acceptability, but **HUMAN-FEEDBACK did not state that reason**, so this remains a hypothesis. | Scramble, marquee, and hover-lift are separate motifs without a shared narrative transition (V3 lines 69–82). |
| Scroll choreography | Long normal scroll with parallax; lacks the source’s recorded pinned chapter choreography, scroll fades, and nested smooth-scroll behavior. | Standard document scroll; no designed section exits or pinned sequences. | One pinned horizontal sequence is the closest structural analogue to authored scroll choreography, but has no layered entrances/exits between plates. | No scroll by design; therefore cannot deliver the source’s long-form ceremonial progression. |
| Transitions | No page/menu transition implementation; section exits are not authored. | Anchor jumps and reveals only; no navigation or page transition system. | Sticky sequence enters/leaves, but no explicit plate-to-plate or page transitions. | No scene/page transitions; initial scramble is an entrance effect, not a transition system. |
| Interaction depth | Clocks and ambience are live, but the menu button has no behavior and several CTAs are placeholder `#` links (V0 lines 90–107, 118–167). | Sticky anchor index is functional but interaction depth is limited to anchors and hover/focus styling. | Scroll is the only meaningful interaction. | Hover-lift cards are non-actionable `div`s; scramble/marquee are passive (V3 lines 60–80). |
| Visual storytelling | Reproduces the source chapter order, but placeholder blocks cannot carry story-specific imagery or emotional progression. | Archive metaphor is coherent but mostly text; one plate cannot sustain a rich narrative arc. | Procession metaphor gives beginning/making/returning a temporal sequence; supporting scenes/assets are absent. | “Room/whisper” metaphor is compressed into headline, three labels, and marquee; little progression occurs. |
| Content density | Closest to source density, but much content is repeated template structure and placeholders. | Moderate textual density, very low media density. | Low density: intro, three short plates, outro. | Very low density: one statement, paragraph, three micro-cards, marquee. |
| Asset quality | Independent fog canvas plus CSS gradients; no high-quality photography, illustration, video, or comparable shader result. | No image/video/canvas assets; one CSS gradient plate. | No image/video/canvas assets. | No image/video/canvas assets. |
| Depth / layering | Fixed fog beneath DOM and parallax placeholders provide some layering, but the source’s inferred WebGL/DOM composition is only cheaply approximated. | One parallax gradient; otherwise flat grid. | Flat typographic plates translated horizontally. | Flat centered stack; card lift is six pixels and does not create scene depth. |
| Distinctive visual identity | Fidelity study retains reference motifs but is not original and still omits much of their execution quality. | Museum-catalog language is internally consistent but common. | Procession + Roman numerals is more singular than V1 but still relies on familiar luxury-editorial conventions. | Scramble + marquee + rounded cards combines recognizable primitives without a distinctive authored system. |
| Overall cohesion | Source roles are present, but placeholder media and independently mounted effects weaken unity. | Strongest consistency is editorial styling; concept, media, and motion remain thin. | Concept, scroll axis, numerals, and copy align reasonably; **HUMAN-FEEDBACK:** only “okay,” not accepted. | Palette and single-room concept are consistent, but scramble/marquee/cards compete as separate signatures; **HUMAN-FEEDBACK:** only “okay,” not accepted. |

## Why technical PASS did not become high design quality

- Technical gates answered: does it render, avoid overflow, satisfy basic accessibility/performance checks, and remain original?
- They did **not** answer: is the composition sophisticated, typography authored, asset direction strong, movement choreographed, story compelling, or result award-caliber?
- The mandatory design-evaluation stage described in `docs/gym/44-quality-floor.md` was not operational for the text-only run. Human review is the first actual design-floor evaluation and it failed all four candidates.
- Placeholder assets may preserve layout roles for a fidelity study, but they do not preserve production-level emotional or visual impact.
- Primitive installation proves reusable mechanics, not a coherent art-directed experience.

Therefore:

```text
TECHNICALLY_QUALIFIED != DESIGN_QUALIFIED
ORIGINAL != EXCELLENT
MORE_ACCEPTABLE_THAN_PEERS != ACCEPTABLE
```

## Design qualification after human review

| Candidate | Technical state retained | Human design gate | DESIGN_QUALIFIED |
|---|---|---|---|
| V0 | BUILT fidelity study; deterministic gates pass; non-deployable | FAIL | false |
| V1 | TECHNICAL_PASS | FAIL | false |
| V2 | TECHNICAL_PASS; weak unordered relative-positive signal | FAIL | false |
| V3 | TECHNICAL_PASS; weak unordered relative-positive signal | FAIL | false |

## Required Phase-2.5 amendments (proposal only)

Do not optimize personal taste yet. Raise the general quality floor first:

1. **Establish stronger visual benchmark evaluation.** Require desktop/mobile captures, reference side-by-sides, motion replay, and a completed V0 fidelity report before originals proceed.
2. **Diagnose source-to-plan loss.** Require non-null persisted variant briefs and non-empty DesignCase retrieval evidence; stop the run if source principles are absent from receipts.
3. **Improve composition/motion/typography planning.** Before build, require a composition map, typography-role plan, art/asset direction, depth/layering plan, scroll/transition storyboard, and one committed signature move. Enforce motion-token discipline.
4. **Use vision-capable or human visual evaluation.** Add an explicit design-floor verdict before `REVIEW_READY`; deterministic gates remain separate and cannot promote design quality.
5. **Generate one more tiny controlled batch only after diagnostic approval.** Keep the batch small, compare against the same reference with identical evidence, and allow `REJECT_ALL` again.
6. **Measure personal taste only after candidates clear the baseline floor.** One rejected batch remains very-low-confidence; no preference cell is created.

Guardrails remain: no curriculum scaling, no cron, no large variant generation, no auto-promotion, no deployment.
