# 47 — MCP / Tool Router

Knowing every connected capability ≠ invoking every one. The router selects
tools per task; it is a policy layer, not a framework.

## Decision flow

```
task (from job or application loop)
 → capability requirement   (what must be done: fetch design index, render,
                             screenshot, inspect DOM, deploy preview, …)
 → inventory                (ToolKnowledge entries with integration_status
                             approved|sandboxed + Hermes toolset)
 → selection                (filter: capability match, status, license ok,
                             cost class, privacy class)
 → execution                (single tool; fallback chain only if declared)
 → result + receipt         (tool, version, duration, outcome → job record)
```

## Selection rules

1. **Prefer the boring path.** Native Hermes tools (browser, terminal, file)
   before MCPs; MCPs before new dependencies. (Ponytail ladder applied to
   tooling.)
2. **One tool per capability per task** unless a fallback chain is declared in
   ToolKnowledge (`fallback_for: <tool>`).
3. **Never invoke unapproved integrations.** `integration_status: not-connected`
   entries are informational; the router reports them as suggestions, not
   actions.
4. **Cost/privacy classes on every entry:** `cost: free|metered|paid`,
   `privacy: local|public-api|third-party`. Third-party + user content
   requires explicit job-level opt-in.
5. **Receipts are mandatory** — every external tool call in a Gym job lands in
   the job record (resumability + audit, `docs/gym/50`).

## Example routing

| Task | Router choice | Why |
|---|---|---|
| discover award sites | Siteinspire MCP (`list_websites`) | authorized structured access (32) |
| study live site | Hermes browser tools + DOM probes | Phase-1 method, no new deps |
| screenshot capture | browser screenshot → content-addressed artifact | local, free |
| Figma inspect | Figma MCP IF authorized on the case | 38 access classes gate it |
| deploy preview | Vercel CLI via terminal, explicit approval | 45 deployment gate |

## Learning

Router outcomes feed ToolKnowledge: repeated failures downgrade a tool's
status; a tool that unblocks a previously failing capability gets a
`best_uses` entry. This is the tool side of the learning loop.
