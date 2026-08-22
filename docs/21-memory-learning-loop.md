# 21 — Memory / Learning Loop

Spec-only (task §30). How verified KINETIC work becomes reusable knowledge —
without auto-canonicalizing every output and without coupling KINETIC to a
specific memory backend.

## Promotion pipeline

```
project → transformation (KineticJob + diffs)
       → feedback (VisualFeedback[], human + evaluator)
       → final ACCEPTED result (gates green, human accepted)
       → lessons (structured extraction)
       → candidate promotions:
           a) knowledge note   (principles/patterns — WHY/WHEN)
           b) registry improvement (primitive/recipe param defaults, new
              variant, fallback fix — HOW)
```

## Gates on promotion (nothing auto-canonical)

1. **Quality-gate pass is necessary** — only runs that exited the repair loop
   through green gates are eligible (`04`).
2. **Human acceptance required by default** for knowledge promotion; registry
   changes additionally require the publish gate (`06` governance).
3. **N-of-1 caution:** a single successful run produces a *candidate* note
   tagged `observed-once`; repetition across projects upgrades confidence.
4. **Supersession:** new lessons reference and can supersede old ones with
   dates + provenance (same epistemic discipline as Hermes' vault workflow).

## Lesson record shape

```jsonc
{
  "schema": "kinetic/lesson@0.1",
  "origin": { "job_id": "…", "project_type": "sveltekit-marketing",
              "surface": "decide-learn", "date": "…" },
  "claim": "120ms letter stagger reads cinematic on single-viewport heroes but drags on content-dense pages",
  "evidence": ["run report ref", "feedback ids"],
  "confidence": "observed-once | repeated | validated",
  "target": "knowledge | registry",
  "status": "candidate | accepted | superseded"
}
```

## Backend-neutral persistence interface

KINETIC core writes lesson records to `.kinetic/lessons/` (plain JSON in the
project). A **persistence adapter** (not part of core) may sync accepted
lessons outward — e.g. into Hermes memory/vault systems. Interface:

```
LessonStore.put(lesson) / .query(filter) / .supersede(id, replacement)
```

`[EI]` For Hermes specifically, the natural future target is the user's
canonical vault knowledge workflow (with its acceptance/labeling discipline),
but KINETIC must never import vault assumptions into core — the adapter is the
whole coupling surface. This keeps KINETIC independently testable (task §0).

## What is NOT learning

- Raw run logs (kept as receipts, not promoted).
- Aesthetic opinions not tied to evidence.
- Anything from a failed/blocked run, except explicit *anti-lessons*
  ("X broke Y because Z") which follow the same gates with `target: knowledge`
  and negative framing.
