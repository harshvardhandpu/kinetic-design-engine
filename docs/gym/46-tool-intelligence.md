# 46 — Tool Intelligence Loop

A separate knowledge subsystem for UI/design TOOLING (distinct from design
knowledge: Phase-1 §29 knowledge/registry split applies — tools are "how",
not "what looks right").

## ToolKnowledge entry (schema: `schemas/gym/tool-knowledge.schema.json`)

One entry per tool × version-checked-date. `kind: tool | mcp` — MCP servers are
tools with a transport; a separate MCPKnowledge schema was considered and
rejected as duplication (decision recorded here; the `kind` discriminator +
`mcp` field group covers it).

```yaml
tool: <name>
kind: tool|mcp
version_checked: <version + date>
status: active|changed|deprecated|blocked
capabilities: [...]          # observed/verified, each with evidence ref
limitations: [...]           # observed failure modes included
license: <spdx or custom summary>
pricing: {free_tier, paid_notes}
mcp: {endpoint, transport, auth, tools[], rate_limits}   # when kind=mcp
skill: {hermes_skill_available, path}
framework_support: [...]
best_uses: [...]
bad_uses: [...]              # negative knowledge for tools
integration_status: not-connected|sandboxed|approved
```

## Study protocol (per tool)

```
read official docs (public)
→ inspect tool schemas (MCP: list tools; lib: API surface)
→ run ONE safe sandbox experiment (no external side effects, no secrets)
→ document capability with evidence
→ document failure modes (the valuable part)
→ write/update ToolKnowledge entry
```

## Initial watchlist (from Phase-1 research + this phase's validation)

Figma (MCP/API) · Framer · shadcn registry · 21st.dev · Motion · GSAP ·
Three.js/R3F · Webflow · Spline · Rive · Lottie · browser animation APIs
(WAAPI, View Transitions, scroll-driven animations) · shader/WebGPU tooling ·
component registries (jsrepo-class) · **Siteinspire MCP (validated public,
`docs/gym/32`)**

## Rules

1. Public docs/source only. No scraping behind logins.
2. Never silently connect an external service: MCP integration requires the
   user's explicit setup step (Hermes MCP consent flow) — ToolKnowledge records
   `integration_status` honestly.
3. Secrets/auth stay in the user's env; the Gym never stores them.
4. Entries are dated; stale entries (>180d unchecked) get `status: stale` and
   drop in router priority (47).
