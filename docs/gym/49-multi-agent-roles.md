# 49 — Multi-Agent Roles (optional specialization)

Roles are JOB STAGES with a model class, not standing agents. Hermes routes
each stage to an available model; no role is required on every job.

| Role | Stage(s) | min_model_class | Notes |
|---|---|---|---|
| Researcher | corpus ingest, tool research | any | structured extraction |
| Design Analyst | reference study → DesignCase | vision or DOM-probe path | evidence tagging discipline |
| Art Director | variant briefs, direction diversity check | high-reasoning | brief quality drives everything |
| Layout Explorer | V1–V7 layout-grammar variants | any + rich brief | |
| Motion Designer | motion-heavy variants, pairs | any + pairs retrieval | |
| Spatial Designer | 3D/spatial variants | any + registry recipes | |
| Builder | candidate implementation | any | Phase-1 adapters |
| Visual Critic | design evaluation | high-reasoning or vision | labeled as AI judgment (44) |
| Performance Critic | perf gate | any (scripted checks) | mostly deterministic |
| Accessibility Critic | a11y gate | any (scripted + heuristics) | |
| Originality Critic | diversity/slop checks | high-reasoning | compares vs corpus + negatives |
| Resolver/Repair | diagnosis → targeted patch | high-reasoning | Phase-1 repair stage |

## Rules

1. **Single-model default.** One Hermes session can play all roles sequentially;
   role split is an optimization for parallelism/model-fit, never a requirement.
2. **Routing via Hermes provider failover** — roles declare `min_model_class`,
   Hermes routing satisfies it; the Gym never names providers (48, 50).
3. **Handoffs are artifacts.** Between roles, only schema'd records move
   (brief, run, evaluation). No implicit conversational state.
4. **Parallelism is per-candidate, not per-stage:** candidates of a batch are
   independent; stages within a candidate are sequential (dependency order).
