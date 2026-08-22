# 32 — Award Corpus: Sources, Access Policy, Provenance

Target: 1000+ DesignCases from 2020–2026 award-winning work, then continuous.
This document records what was ACTUALLY validated about each candidate source on
2026-08-21 (DIRECTLY-INSPECTED unless noted), and the access policy that follows.

## Validated sources

### Awwwards — PRIMARY discovery index
- **Observed:** public SOTD/SOTM/SOTY/Developer/Honorable/Nominee listings with
  pagination (`?page=N` → HTTP 200 verified); rich public taxonomy: ~26 categories,
  ~50 style/feature tags, ~100 technology tags (GSAP, Three.js, WebGL, Svelte,
  Next.js, Lottie, Canvas API…), ~70 countries, font tags. Jury criteria published:
  Design, Creativity, Usability, Content.
- **robots.txt:** allows `/websites/` listing pages; disallows search/feed/vote/
  preview endpoints. Sitemap declared (declared URL 404'd at probe time — resolve
  at implementation).
- **Terms (read 2026-08-21):** "All material contained on this website is the
  property of Awwwards… unauthorized use or reproduction is strictly prohibited.
  Our content may not be used for commercial purposes unless expressly authorized.
  Websites featured on our site remain the intellectual property of their creators."
- **Policy for KINETIC:**
  - USE as a discovery index: browse listings, record public award metadata
    (title, studio, award type, date, category, tags, URL). This is normal
    readership of public pages at low rate.
  - DO NOT bulk-mirror Awwwards content (text/images) into the corpus.
  - DO NOT use Awwwards content commercially or republish it.
  - The *studied site itself* is accessed directly at its own URL and is governed
    by its OWN robots/terms — the case's `access_policy` records that separately.
  - Rate-limit: human-paced browsing (≤ ~1 listing page/min), no parallel crawlers.
- **Award signals captured:** award_type, award_level (SOTD<SOTM<SOTY),
  developer_award (bool), category, tags, date, jury_score (only if publicly shown).

### Siteinspire — PRIMARY structured access (MCP)
- **Observed:** official public MCP server at `https://www.siteinspire.com/api/mcp`
  (streamable-http) with tools: `all_categories`, `search_sites`, `list_websites`,
  `popular_websites`, `get_website`, `list_profiles`, `get_profile`. Results are
  public-only, published sites with enabled screenshot assets. robots.txt explicitly
  allows AI assistants and `/api/mcp`.
- **Policy:** preferred ingestion path — structured, authorized, agent-native.
  Use the MCP tools (via Hermes MCP integration) instead of scraping. Record
  Siteinspire categories/styles as case tags. Screenshots served by Siteinspire may
  be cached into `gym/artifacts/` with provenance (they are published for
  inspiration reference); do not redistribute.

### CSS Design Awards — DEFERRED (access-blocked)
- **Observed:** homepage AND robots.txt both return an `sg-captcha` challenge
  (HTTP 202, `x-robots-tag: noindex`). Effectively bot-gated.
- **Policy:** no automated ingestion. Manual human browsing only, or defer until a
  legitimate API/access path exists. Mark cases sourced from CSSDA as
  `provenance: manual-entry`.

### Godly — USABLE WITH RESTRICTIONS
- **Observed:** robots.txt carries machine-readable Content-Signals:
  `search=yes, ai-train=no, use=reference` plus blanket Disallow for training
  crawlers (CCBot, GPTBot, ClaudeBot, Google-Extended…). Explicit EU DSM
  Article 4 rights reservation.
- **Policy:** browse/reference use is signaled-allowed; **ai-train=no is binding**:
  Godly content must never enter model training data. For KINETIC this is fine —
  the corpus is retrieval context, not training data — and this document records
  that distinction as a hard rule. Human-paced browsing only.

### FWA (fwa.com) — USABLE, low priority
- **Observed:** robots.txt allows public paths (only CMS internals disallowed).
- **Policy:** usable as supplementary source for experimental/immersive work
  (FWA skews WebGL/immersive — good frontier coverage). Same metadata-only rule.

### Others (candidate, unvalidated)
Regional indexes and other award bodies (D&AD digital, Webby honorees, national
design awards) remain CANDIDATE sources: validate robots/terms before any use.
Never add a source to the ingestion plan without a validated policy row.

## Provenance contract (every DesignCase)

```yaml
provenance:
  discovered_via: awwwards | siteinspire-mcp | fwa | godly | manual-entry
  source_url: <index page where discovered>
  site_url: <canonical site URL>
  award: {body, type, level, year, category, jury_scores_if_public}
  fetched: <ISO date>
  access_policy: <per-source policy id from source-policies.json>
  site_robots_checked: true|false
  availability: live | archived | dead
  archive_url: <if dead, Wayback snapshot used for study>
```

## Deduplication

Canonical key = normalized site URL (lowercase host, strip `www.`, strip tracking
params, https-normalized) → sha1 prefix. One case per canonical URL; multiple award
bodies append to `award[]`. Index enforces uniqueness at ingest.

## Dead-site handling

Award sites die. Study order: live site → Wayback snapshot (record snapshot URL +
date, mark `availability: archived`, note which observations may be degraded) →
skip with `status: unavailable`. Archived cases get reduced confidence on
performance/technology claims (no live runtime to probe).

## Legal/ethical floor (applies to ALL sources)

1. Observe public behavior; never bypass paywalls, logins, or access controls.
2. Never download or reconstruct hidden proprietary source code.
3. Metadata + our own analysis only; no mirroring of copyrighted assets.
4. Respect robots.txt, Content-Signals, and ToS of BOTH the index and the site.
5. V0 fidelity studies are internal benchmarks, never deployed (`docs/gym/36`).
