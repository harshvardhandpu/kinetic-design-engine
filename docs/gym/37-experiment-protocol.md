# 37 — Experiment Protocol (V8/V9 and beyond)

Experiments test something NEW against the Gym's current knowledge. Slots: V8/V9
of any VariantRun, plus standalone experiments in ToolResearch/PatternClustering
jobs. Schema: `schemas/gym/experiment-record.schema.json`.

## Mandatory record fields

```yaml
id: exp-<date>-<seq>
hypothesis:        # one falsifiable sentence
source:            # where the idea came from (case id, tool, paper, human)
novelty:           # what is new vs current KINETIC knowledge
implementation:    # what was built/changed (files, deps, config)
expected_benefit:  # measurable if possible
risk:              # perf, a11y, compat, legal
result:            # filled after run
evaluation:        # evaluator output refs + metrics delta
human_feedback:    # TasteDecision refs if reviewed
promotion_candidate: true|false   # never auto-true
```

## Allowed experiment subjects

new UI technique · new animation primitive · new browser capability · new MCP/tool ·
new registry component · new shader · new motion pattern · new navigation grammar ·
new Figma workflow · new typography treatment · new spatial technique

## Rules

1. **One hypothesis per experiment.** Compound experiments are split.
2. **Bounded blast radius.** Experiments run in the Gym build sandbox only;
   they may add dependencies THERE but never modify KINETIC core or the
   target application of an application-loop job.
3. **Gates still apply** (technical/responsive/a11y/performance). A crashing
   experiment produces a failure record — that is a result, not a waste.
4. **Negative results are kept.** `result: negative` entries feed negative
   knowledge (43) and prevent re-running the same dead end (experiments are
   deduped by hypothesis hash before scheduling).
5. **No auto-promotion.** `promotion_candidate: true` requires: the experiment's
   own gates passed + evaluator improvement measured + explicit human acceptance
   at review. Promotion itself needs repeated cross-case evidence (`docs/gym/53`).

## Experiment backlog

A durable queue (`gym/experiments/backlog.json`): ideas from study sessions,
tool research, human suggestions. The sampler's "free" daily slot (33) and V8/V9
pull from it, prioritized by expected information gain, not recency.
