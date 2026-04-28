# Narre Logging Guidelines

## Goal

Use logging to answer one concrete question first:

- Where does a single Narre request stop?

In this repo, dev logging should also answer:

- Which worktree produced this runtime log?

Do not start with a generic logging framework when the real gap is missing lifecycle visibility.

## Why Lifecycle-First Logging

The right order is:

1. Add micro-level observability on the failing request path.
2. Use it to diagnose real failures.
3. Generalize only the fields and formats that repeatedly prove useful.

This matches the prior design discussion:

- observability comes before abstraction
- micro logging accumulates into stable shared patterns
- generic logging too early creates lots of output without branch diagnosis value

## What To Log

Prefer metadata over raw payloads.

Required fields for Narre request tracing:

- `traceId`: correlate one request across main, server, runtime, and provider logs
- `stage`: stable lifecycle label
- `sessionId`
- `projectId`
- `provider`
- `seq`: event order within a stream
- `elapsedMs`
- `chars`: text chunk size or aggregate text size
- `tool`
- `error`

Good Narre-specific stages:

- `request.start`
- `request.metadata.ready`
- `request.sent`
- `response.headers`
- `sse.recv`
- `sse.send`
- `stream.end`
- `stream.close`
- `request.accept`
- `request.completed`
- `request.error`
- `run.start`
- `run.completed`
- `mcp.config`
- `mcp.missing`

## What Not To Log

- Full user prompts
- Full assistant responses
- API keys, tokens, auth headers
- Entire tool arguments when they may contain large or sensitive payloads

For streamed text, log the chunk size, not the text body.

## Current Instrumentation

Current Narre tracing is intentionally narrow and vertical.

### desktop-app main

File:

- `packages/desktop-app/src/main/ipc/narre-ipc.ts`

What it logs:

- request start
- metadata ready
- request sent
- HTTP response headers
- each SSE event received
- SSE parse errors
- stream end / close
- request or stream errors

Prefix:

- `narre:bridge`

### narre-server route

File:

- `packages/narre-server/src/index.ts`

What it logs:

- request accepted
- each SSE event sent
- request completed
- client closed before completion
- route error
- response end

Prefix:

- `narre:server`

### runtime

File:

- `packages/narre-server/src/runtime/narre-runtime.ts`

What it logs:

- runtime start
- MCP config used
- missing MCP server
- runtime completed

Prefix:

- `narre:runtime`

### providers

Files:

- `packages/narre-server/src/providers/openai-family/openai-transport.ts`
- `packages/narre-server/src/providers/openai-family/codex-transport.ts`

What they log:

- provider run start / completion / failure
- tool start / tool end
- Codex MCP startup and elicitation events

## How To Diagnose

Read `narre-server.log` and `desktop-main.log` together by `traceId`.

Interpretation rules:

- No `narre:server ... stage=request.accept`
  Main IPC or HTTP bridge never reached narre-server.

- `request.accept` exists but no `narre:runtime ... stage=run.start`
  Server accepted the request but runtime preparation failed early.

- `run.start` exists but no provider completion
  Provider, MCP, approval, or tool execution is blocking or failing.

- `narre:server ... stage=sse.send` exists but `narre:bridge ... stage=sse.recv` does not
  SSE bridge or HTTP stream handling in desktop main is broken.

- `narre:bridge ... stage=sse.recv` exists but UI still shows no answer
  Renderer state handling is the next place to inspect.

- `stream.close` or `client.closed` before `done`
  The stream terminated unexpectedly.

## Quick Commands

Use the bundled script first:

- `powershell -ExecutionPolicy Bypass -File .agents/skills/narre-observability/scripts/show_narre_logs.ps1`
- `powershell -ExecutionPolicy Bypass -File .agents/skills/narre-observability/scripts/show_narre_logs.ps1 -ListScopes`
- `powershell -ExecutionPolicy Bypass -File .agents/skills/narre-observability/scripts/show_narre_logs.ps1 -Worktree main`
- `powershell -ExecutionPolicy Bypass -File .agents/skills/narre-observability/scripts/show_narre_logs.ps1 -Worktree narre-debug -Target narre`

Use live follow when needed:

- `Get-Content <desktop-main.log> -Tail 120 -Wait`
- `Get-Content <narre-server.log> -Tail 120 -Wait`

## Worktree-Aware Runtime Scopes

Dev runtime logs are already stored under worktree-specific scope directories:

- main repo example: `runtime/dev-main-<hash>/data/logs`
- worktree example: `runtime/dev-desktop-debug-<hash>/data/logs`

That means the primary isolation mechanism is the directory path, not post-hoc log parsing.

The log viewer script should therefore select by:

1. exact runtime scope when known
2. worktree label when investigating a named worktree
3. newest runtime scope only as a fallback

## When To Generalize

Generalize only after these have stabilized across several debugging passes:

- the field set
- stage names
- the places where logging is inserted
- the privacy rules for payload reduction

That is the point where a shared logger helper is justified.
