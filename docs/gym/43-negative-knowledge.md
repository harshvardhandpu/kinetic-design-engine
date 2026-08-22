# 43 — Negative Knowledge

Rejected designs are training signal. A winners-only corpus teaches what to
copy; negative knowledge teaches what to avoid — and avoidance is most of taste.

## Storage

`gym/negative/` — one JSON entry per rejection event, linked from the
VariantRun/DesignCase that produced it.

```yaml
id:
source: {variant_run_id | case_id | experiment_id}
context: {surface, k_level, goal}
failure_class: [generic-layout, weak-hierarchy, animation-overload,
                poor-typography, derivative-concept, unnecessary-3d,
                bad-responsive, poor-accessibility, bad-performance,
                visual-imbalance, broken-interaction, surface-mismatch]
evidence: [evaluator check ids, screenshot refs, human reason tags]
diagnosis: <one paragraph: WHY it failed, mechanism not just label>
avoidance_rule: <retrievable one-liner for future briefs>
confidence: auto|human-confirmed
```

## Sources of negative entries

1. quality-floor rejections with diagnosis (44) — `confidence: auto`
2. human rejections with reason tags (41) — `confidence: human-confirmed`
3. failed experiments (37) — mechanism-rich, highest value per byte
4. case anti-patterns observed in references (34) — real-world negatives

## Retrieval use

Generation briefs pull top-k negative entries matching (surface, dimensions
being varied): "on Monitor surfaces, animation-overload failed 4× — keep
functional motion only." This is the direct counterweight to slop: the slop
detector (Phase-1 `docs/13`) flags generic output; negative knowledge prevents
regenerating the same failure.

## Hygiene

- dedupe by (failure_class × context × mechanism hash) — repeated identical
  failures increment a counter instead of piling entries
- human-confirmed entries outrank auto ones at retrieval
- entries are never deleted, only superseded (a rule that stopped applying gets
  `superseded_by` + reason — taste evolves)
