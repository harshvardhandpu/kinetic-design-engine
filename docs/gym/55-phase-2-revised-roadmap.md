# 55 — Phase 2 (REVISED): Proving Both Loops at Small Scale

Supersedes `docs/24-v0.1-roadmap.md` Phase-2 scope. Phase 2 now proves BOTH:

- **KINETIC APPLICATION LOOP** (Phase-1 scope: install → render → feedback →
  source-map → patch → gates)
- **KINETIC LEARNING LOOP** (Phase-1.5 scope: study → variants → evaluate →
  taste → negative knowledge → promotion simulation)

## Scale rule

Do NOT jump to 100 builds/day. Prove the loops at 3 references first; scaling
is a later phase gated on these results.

## Scope (fixed-size; additions require equal removals)

### Application-loop proof (from original Phase 2)
1. playground app (2 routes, 2 surface types)
2. 5–8 evidence-anchored primitives + 2–3 recipes (registry items)
3. registry installer with receipts (`installed.json`)
4. ONE framework adapter + vanilla core
5. scanner (detect/tokens/surfaces/zones)
6. dev-only inspector + structured feedback export (kinetic-ids)
7. minimal motion inspector (handle contract: pause/seek/state)
8. evaluator: 7 objective checks + 3 slop detectors
9. showcase hero built through the full loop with a real feedback→patch cycle

### Learning-loop proof (NEW)
10. **3 reference websites** (from validated sources, `docs/gym/32`):
    one motion-heavy landing, one editorial/content, one product/interactive
11. deep study → 3 full DesignCases (evidence-tagged, schema-valid)
12. per case: **V0 fidelity study + 3–4 original variants** (not 10 — the
    ten-variant contract is capacity, the proof uses fewer slots with the same
    quality floor)
13. quality floor run on every candidate (gates 1–5 of `docs/gym/44`)
14. human review of qualified candidates → **TasteDecisions recorded**
15. **one experiment candidate** (V8 slot on one case, full ExperimentRecord)
16. **promotion simulation:** take one recurring pattern observed across the 3
    cases through the full promotion lifecycle as a DRY RUN — write the
    PromotionCandidate + EngineEvolutionRecord, merge nothing into core
17. negative knowledge: ≥1 rejection per case captured with diagnosis

### Shared infrastructure for both
18. job records + checkpoints + locks exercised manually (jobs run by hand,
    NO cron activation)
19. content-addressed artifact store + retention classes configured
20. metrics collector producing the first baseline report (54), including the
    first `first_shot_preference_rate` data points (n will be tiny — that's fine)

## Explicitly out of Phase 2

cron activation · >3 references · 10-variant batches · deployment of any Gym
output · Figma loop (needs a legally-available file; if one appears it becomes
an experiment) · image-only mode (benchmark designed, execution later) ·
review UI beyond a generated static report page · second framework adapter.

## Success criteria (all must hold)

1. application loop completes once end-to-end (Phase-1 criterion, unchanged)
2. learning loop completes once end-to-end: case → V0 verdict → qualified
   variants → TasteDecision → negative entry → promotion dry-run artifacts
3. every durable artifact validates against its schema
4. a killed-and-resumed job run loses no work (tested deliberately once)
5. first baseline metric report exists with honest small-n numbers

## Gate to scaling

Only after Phase-2 sign-off: scale references 3 → 10, slots toward the full
ten-variant contract, then consider cron activation — each step a separate
user approval.
