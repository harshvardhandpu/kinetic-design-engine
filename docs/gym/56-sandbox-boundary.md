# Sandbox Boundary — Phase 2 (Amendment A compliance)

Recorded: 2026-08-22. Verified with `findmnt -T` inside the sandbox.

## Mounts (verified)

| Target | Bind source (host) | Mode |
|---|---|---|
| `/workspace` | `/home/harshdev/HermesWorkspaces` | rw |
| `/root` | `/home/harshdev/.hermes/sandboxes/docker/default/home` | rw |
| `/root/.hermes/{attachments,images,cache/*}` | host subpaths | ro |
| `/root/.hermes/skills` | tmpfs | ro |

## Writable surface (complete list)

1. `/workspace/kinetic-design-engine` — KINETIC canonical sandbox workspace,
   mapped from host `/home/harshdev/HermesWorkspaces/kinetic-design-engine`
   (intended RW target). The former duplicated sandbox path
   `/workspace/home/harshdev/HermesWorkspaces/kinetic-design-engine` is gone.
2. `/workspace/aether-site` — pre-existing Website-Factory project, writable by
   mount inheritance. **Phase-2 rule: no writes there.** (Website Factory owns
   it; KINETIC must not touch it.)
3. `/root` — sandbox home (session state, tool caches).
4. `/tmp` — scratch.

## NOT exposed (contrary to earlier assumption)

The full host btrfs root is NOT mounted. The earlier "entire host root rw"
reading was wrong: `findmnt` shows the bind source is the `HermesWorkspaces`
subpath. Host paths outside it (`~/.hermes`, `~/Obsidian`, system dirs) are
invisible from this sandbox.

## Enforcement

- Container runs unprivileged (uid 1000 `pn`, CapEff=0): no mount/remount
  possible from inside; boundary is set by host docker_volumes config.
- KINETIC Phase-2 writes ONLY to item 1 above. Any other write target requires
  explicit user approval (Amendment A).
- No git push, no deploy, no cron (Amendments H/M).

## Residual risk

`/workspace/aether-site` remains writable by mount inheritance. Mitigation is
procedural (this document + report) since in-sandbox mount changes are
impossible; host-side narrowing (separate ro bind for aether-site) is the
user's option if they want it enforced structurally.
