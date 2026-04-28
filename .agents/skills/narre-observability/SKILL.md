---
name: narre-observability
description: >
  Investigate why Narre responses are missing, delayed, truncated, or stuck in development or packaged Netior runs.
  Use when Narre chat requests need lifecycle tracing across desktop-app main IPC, narre-server SSE, provider runtimes, or log files.
  Covers what to log, where logs live, how to interpret traceId-based events, and how to inspect the latest Narre logs quickly.
---

# Narre Observability

Use this skill to inspect one Narre request end to end before proposing broader logging changes.

## Workflow

1. Start with the two runtime log files for the active scope.
2. Follow one request by `traceId`, not by loose timestamps alone.
3. Determine the failing stage before changing code.
4. Add or adjust lifecycle logs only on the missing edge.
5. Generalize repeated fields later; do not design a repo-wide logging abstraction first.

## Log Locations

- Dev runtime logs: `%APPDATA%/netior/runtime/<scope>/data/logs/desktop-main.log`
- Dev runtime logs: `%APPDATA%/netior/runtime/<scope>/data/logs/narre-server.log`
- Packaged logs: `%APPDATA%/netior/data/logs/desktop-main.log`
- Packaged logs: `%APPDATA%/netior/data/logs/narre-server.log`

In dev mode, `<scope>` is already worktree-aware:

- main repo example: `dev-main-<hash>`
- worktree example: `dev-narre-debug-<hash>`

Use [references/logging-guidelines.md](references/logging-guidelines.md) for:

- what to log
- what is already instrumented
- how to diagnose by stage
- why lifecycle-first logging comes before generic logging

## Quick Use

- Run `powershell -ExecutionPolicy Bypass -File .agents/skills/narre-observability/scripts/show_narre_logs.ps1`
- The script defaults to the newest `runtime` scope because this repo is usually debugged in dev mode
- Use `-ListScopes` to see every detected runtime scope and its worktree label
- Use `-Worktree <label>` to select one worktree's runtime logs directly
- Use `-RuntimeScope <scope>` when you already know the exact runtime scope name
- Use `-Scope packaged` when checking an installed build
- Narrow to one side with `-Target main` or `-Target narre`
- Increase context with `-Tail 200`

## Current Trace Model

Current Narre request tracing uses these stages:

- `narre:bridge` in `packages/desktop-app/src/main/ipc/narre-ipc.ts`
- `narre:server` in `packages/narre-server/src/index.ts`
- `narre:runtime` in `packages/narre-server/src/runtime/narre-runtime.ts`
- provider logs in `packages/narre-server/src/providers/openai-family/openai-transport.ts`
- provider logs in `packages/narre-server/src/providers/openai-family/codex-transport.ts`

## Rules

- Prefer one-request lifecycle tracing over volume logging.
- Log metadata, counts, ids, and elapsed times; do not dump full prompts or full assistant text.
- Keep logs useful for branch diagnosis: request accepted, provider started, SSE sent, SSE received, done, error.
- If a stage is silent, instrument that edge next instead of adding a generic logger layer.
