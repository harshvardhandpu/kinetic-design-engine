# 48 — Model-Agnostic Design Intelligence

KINETIC must run on whatever Hermes routes — including free models. No
proprietary model may be structurally required.

## Principle

Intelligence is EXTERNALIZED into retrievable artifacts, so the model's job is
bounded assembly, not open-ended taste:

```
DesignCases · TasteProfile · negative knowledge · recipes · primitives ·
ToolKnowledge · schemas · evaluator rules · constraints · structured briefs
```

A weak model + rich context ≈ a strong model cold. The Gym's job is to keep
raising the context quality.

## Design consequences

1. **Every generation starts from a fully-assembled brief** (35): direction,
   constraints, retrieved cases, pairs, negative entries, taste cells. The
   model never starts from "make something nice".
2. **Every stage has a schema'd output.** Free-form prose is an intermediate
   at most; durable state is always structured. This makes outputs checkable
   and resumable by a different (possibly stronger) model.
3. **Judgment separation:** generation (any model) vs evaluation (rules +
   critic) vs selection (human). A weak generator is survivable; a weak
   EVALUATOR is not — evaluator checks stay scriptable/objective wherever
   possible (44).
4. **Capability declaration per job stage:** `min_model_class: any|vision|high-reasoning`.
   Stages needing vision (screenshot QA) or strong reasoning declare it; the
   router/failover picks an available model that satisfies the class. If none
   is available, the stage QUEUES, it does not silently downgrade to a blind run.
5. **Cost classes:** each stage declares expected token class; the daily budget
   (51) allocates strong-model quota to the stages where it measurably moves
   first-shot preference (tracked in metrics, 54).

## Anti-pattern

Prompting harder is not the answer to a weak model. If a stage fails on a
weaker model, the fix is: better brief, better retrieval, tighter schema, or
stage split — then re-measure. Model-swap is the LAST lever, recorded in the
job record when used.
