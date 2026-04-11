# Runtime Architecture

## Current split

- `packages/desktop-app`
  - Electron shell, preload bridge, renderer UI
  - sidecar orchestration for `netior-service` and `narre-server`
  - does not directly own DB repository logic at runtime
- `packages/netior-service`
  - single runtime owner of `@netior/core`
  - single runtime owner of `better-sqlite3`
  - HTTP facade for project, graph, file, module, config, and eval queries
- `packages/netior-mcp`
  - MCP facade over `netior-service`
  - no direct `@netior/core` access
- `packages/narre-server`
  - agent runtime and provider adapters
  - talks to `netior-mcp` and `netior-service`
  - no direct DB ownership

## Native module ownership

- `better-sqlite3` is intentionally owned by `netior-service` only.
- `desktop-app` packages the native module because the packaged app ships `netior-service` as a bundled sidecar dependency.
- In development, the native binding must be rebuilt for the active Node runtime with:

```bash
pnpm run rebuild:native
```

## Sidecar policy

- `netior-service` runs on Node 22 sidecar only.
- `narre-server` prefers Node 22 sidecar for `openai` and `codex`.
- Electron fallback is still available only where runtime requirements allow it.

## Data flow

```text
renderer -> preload -> main IPC -> netior-service HTTP -> @netior/core -> SQLite
renderer -> preload -> main IPC -> narre-server HTTP/SSE -> netior-mcp -> netior-service
```

## Why this split exists

- avoid Electron/Node ABI conflicts around `better-sqlite3`
- keep desktop main thin enough to support more clients later
- isolate agent/provider runtime concerns from DB ownership
- make MCP and eval use the same service contract as the app
