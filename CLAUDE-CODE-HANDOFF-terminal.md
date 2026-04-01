# Claude Code Handoff: Terminal Replacement

## Goal

Replace Netior's current terminal implementation with a VS Code OSS-aligned terminal stack because the current terminal has cursor/input issues with CLI/TUI tools such as `codex` and `claude code`.

This handoff is for the terminal replacement track only.

## Current Status

The project has completed the legacy cleanup and backend/session refactor phase.

What is done:

- Legacy `TerminalEditor.tsx` has been removed from the codebase.
- Terminal renderer entry now goes through `TerminalEditor.tsx`.
- Source-level `pty:*` compatibility usage has been removed from the active terminal path.
- Main/preload/shared layers now expose a session-based `terminal:*` API.
- VS Code service-override packages have been added to `@netior/desktop-app`.
- The renderer now boots VS Code service overrides and creates real VS Code terminal instances.
- A renderer-side backend adapter now bridges VS Code terminal child-process expectations to preload `terminal:*` APIs.

What is not done:

- Real runtime validation for `codex` and `claude code` has not been completed.
- Full desktop-app typecheck is still red because of unrelated pre-existing errors outside the terminal work.

## Files Changed So Far

### Shared

- `packages/shared/src/types/index.ts`
  - Added terminal session types such as session state and launch config.
- `packages/shared/src/constants/index.ts`
  - Added `TERMINAL_*` IPC channel constants.
  - Removed `PTY_*` constants from the active source path.

### Main Process

- `packages/desktop-app/src/main/pty/pty-manager.ts`
  - Refactored from a simple PTY bridge into a session-based terminal backend service.
  - Supports `createInstance`, `attach`, `getSession`, `input`, `resize`, `shutdown`, and `killAll`.
  - Emits `terminal:data`, `terminal:ready`, `terminal:exit`, `terminal:titleChanged`, and `terminal:stateChanged`.
  - Still uses `node-pty` and ConPTY on Windows.
- `packages/desktop-app/src/main/ipc/pty-ipc.ts`
  - Despite the filename, this now registers only `terminal:*` IPC handlers.

### Preload

- `packages/desktop-app/src/preload/index.ts`
  - Exposes `window.electron.terminal`.
  - Includes `createInstance`, `getSession`, `attach`, `shutdown`, `input`, `resize`, `getWindowsBuildNumber`.
  - Event subscriptions include `onData`, `onReady`, `onExit`, `onTitleChanged`, `onStateChanged`.

### Renderer

- `packages/desktop-app/src/renderer/components/editor/EditorContent.tsx`
  - Routes terminal tabs to `TerminalEditor`.
- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
  - Current terminal entry point.
  - Attaches/detaches a real VS Code terminal instance to the React container.
- `packages/desktop-app/src/renderer/lib/terminal/terminal-services.ts`
  - Bootstraps VS Code service overrides once.
  - Creates and caches terminal instances by Netior terminal session id.
- `packages/desktop-app/src/renderer/lib/terminal/terminal-backend.ts`
  - Implements a preload-backed VS Code terminal backend/process bridge.
- `packages/desktop-app/src/renderer/stores/editor-store.ts`
  - Terminal close path uses `window.electron.terminal.shutdown`.
- `packages/desktop-app/src/renderer/components/editor/tab-context-menu.ts`
  - Terminal kill/close path updated to `shutdown`.
- `packages/desktop-app/src/renderer/lib/terminal-tracker.ts`
  - Uses terminal state events to track liveness.

### Docs

- `DESIGN-vscode-terminal-replacement.md`
  - High-level design intent and migration direction.
- `TERMINAL-REPLACEMENT-STATUS.md`
  - Rolling status summary.

## Dependencies Already Added

In `packages/desktop-app/package.json`, these packages were installed:

- `@codingame/monaco-vscode-api`
- `@codingame/monaco-vscode-terminal-service-override`
- `@codingame/monaco-vscode-theme-service-override`
- `@codingame/monaco-vscode-configuration-service-override`
- `@codingame/monaco-vscode-keybindings-service-override`

The lockfile was updated accordingly.

## Important Architectural State

The codebase is now in a transitional state:

- Backend/session model has already been pushed toward a VS Code-compatible shape.
- Renderer is not yet truly VS Code OSS-backed.
- Current `TerminalEditor.tsx` is the active terminal editor entry.

That means the next work should focus on runtime hardening and validation, not reworking the renderer host path from scratch again.

## What Was Investigated For The Next Step

Installed package inspection already confirmed:

- `@codingame/monaco-vscode-api/services` exports `initialize(...)` and `getService(...)`.
- `@codingame/monaco-vscode-terminal-service-override` exports:
  - `getServiceOverride`
  - `SimpleTerminalBackend`
  - `SimpleTerminalProcess`
- The override package exposes VS Code terminal service contracts such as terminal backend and child process abstractions.

This suggests the next implementation step should use the service override path instead of reintroducing a local terminal wrapper.

## Recommended Next Implementation Plan

### 1. Keep session identity aligned with Netior tab identity

Current Netior terminal tab lifecycle assumes `tab.targetId` is the session id used by the backend. Preserve that unless there is a strong reason to change it.

The current implementation does this via `MOC_TERMINAL_SESSION_ID` in the shell launch config environment. Preserve that linkage unless you intentionally redesign the identity model.

### 2. Runtime validation and hardening

Must verify in the actual app:

- opening a terminal tab
- switching tabs
- detached editor mount/unmount
- resize propagation
- tab close while process is running
- process exit and title updates
- `codex` input/cursor behavior
- `claude code` input/cursor behavior
- IME behavior

## Known Verification Status

Completed:

- `pnpm --filter @netior/shared build`
  - succeeded

Checked:

- `pnpm --filter @netior/desktop-app typecheck`
  - terminal-related type errors from the VS Code service integration were resolved
  - command still fails due to unrelated existing errors outside the terminal slice

Known unrelated typecheck failures include:

- canvas rendering mode typing
- i18n key typing in several editor files
- Narre mention picker/message typing issues

Do not treat current full typecheck failure as evidence that the terminal refactor is broken.

## Known Dirty Worktree Caveat

This repo is not clean. There are unrelated modified files in:

- Narre-related renderer/main files
- agent-server
- theme reset
- locale files
- other local documents and workspace artifacts

Do not revert unrelated changes while continuing terminal work.

## Practical Notes For The Next Agent

- `packages/desktop-app/src/main/ipc/pty-ipc.ts` still has a legacy filename even though it now handles `terminal:*`.
  - Renaming can wait; functionality matters more.
- `packages/desktop-app/src/main/pty/pty-manager.ts` still exports an alias shape compatible with existing imports.
  - Avoid unnecessary churn there unless the backend contract needs to grow.
- The old DOM/CSS hack path is intentionally gone.
  - Do not reintroduce helper textarea styling, paste interception, or manual caret patching.
- The local xterm wrapper file has already been removed.
- The target is not "make xterm look like VS Code."
  - The target is "use a VS Code OSS-aligned terminal service path and validate actual CLI behavior."

## Handoff Summary

If continuing from here, the right next move is:

1. validate the new runtime path against `codex` and `claude code`
2. tighten any missing process property/state sync that shows up during real use
3. verify detached editor and resize behavior under load
4. only then consider cleanup/renames like `pty-ipc.ts`

The structural migration is far enough along that the highest-value work is now behavior verification.
