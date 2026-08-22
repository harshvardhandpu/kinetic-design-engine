# 38 — Figma Learning Loop

Applies ONLY when a Figma design is publicly available or explicitly authorized.
Never bypass permissions; never seek private files.

## Access classes

```
PUBLIC       community files, publicly shared links → inspectable
AUTHORIZED   user provides file + access via legitimate tooling → inspectable
PRIVATE      everything else → NOT accessed, ever
```

Authorization state is recorded on the DesignCase (`figma.authorization`).

## Tooling

Use structured design access (Figma MCP / official API with user-provided token)
when available — see ToolKnowledge entries (`docs/gym/46`). No scraping of the
Figma web app, no reverse-engineering of file formats.

## What to capture (structured, not pixels)

frames + hierarchy · components + variants · variables/tokens (color, type,
spacing, radii) · auto-layout rules · constraints · component relationships ·
naming conventions · asset inventory (metadata only; assets fetched only when
license allows)

## The core lesson: STATIC → LIVE

Figma is static intent; the shipped site is behavior. When a case has BOTH a
legal Figma file and a live implementation, record a `StaticToExperiencePair`
(`docs/gym/39`) for each meaningful delta:

```
what the static file specifies  →  what the live site actually does
(auto-layout stack)             →  (entrance stagger + hover lift)
(fixed frame)                   →  (responsive reflow rules)
(component variant A/B)         →  (animated state transition A→B)
```

These pairs are the Gym's most direct training signal for "how visual intent
becomes interactive behavior" — the exact gap image-only mode suffers from
(`docs/gym/40`).

## Confidence rule

Where the live behavior is observable, it is evidence. Where only the static
file exists, any behavior claim is tagged INFERRED and must say so. Never infer
exact hidden motion from a static frame and record it as observed.
