# Terminal Replacement Status

## Current State

MoC terminal replacement work has moved past the initial migration step and now includes a first real VS Code service-override integration in the renderer.

Implemented so far:

- The backend boundary was expanded from a simple `PTY` bridge to a session-based terminal model.
- The main process now has a terminal backend service centered on terminal sessions.
- Preload now exposes terminal APIs such as `terminal:createInstance`, `terminal:attach`, `terminal:getSession`, and `terminal:shutdown`.
- Shared terminal session types and terminal IPC channels were added.
- The renderer now uses [`TerminalEditor.tsx`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx) as the terminal editor entry point.
- [`EditorContent.tsx`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/renderer/components/editor/EditorContent.tsx) now routes terminal tabs directly to the new editor path.
- Terminal close/kill flow now uses `shutdown`.
- Terminal liveness tracking now uses state events instead of only exit events.
- The old `pty:*` compatibility path was removed from source-level terminal IPC usage.
- The leftover terminal shim file was physically removed.
- The old local xterm host wrapper was removed.
- The renderer now initializes VS Code service overrides for terminal, configuration, theme, and keybindings.
- A renderer-side VS Code terminal backend adapter now bridges the VS Code terminal process abstraction to `window.electron.terminal.*`.
- `TerminalEditor.tsx` now attaches real terminal instances from the VS Code-backed service path instead of directly instantiating xterm.

## What Is Already Done

These cleanup tasks are complete:

- Legacy [`TerminalEditor.tsx`](/C:/PyoSeChang/projects/moc/packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx) is no longer part of the codebase.
- Temporary `tsconfig` exclusion for the legacy terminal file was removed.
- Renderer/main/preload terminal code now uses `terminal:*` APIs instead of `pty:*` APIs.
- Shared constants no longer define `PTY_*` channels in source.

## What Is Not Done Yet

This is still not a fully validated VS Code OSS terminal replacement.

Remaining gaps:

- The renderer path now uses VS Code terminal service overrides, but runtime validation is still pending.
- The backend is adapted into the VS Code terminal process model, but persistence/reconnect/features are still minimal.
- Real runtime validation in the app is still pending for the target CLI cases.
- Full desktop-app typecheck is still red because of unrelated pre-existing canvas, i18n, and Narre errors.

## Verified Status

- `@moc/shared` build succeeds.
- `@moc/desktop-app` typecheck still fails.

Current typecheck failures are not caused by the new terminal migration path.
They are coming from existing issues in canvas, i18n, and Narre-related files.

Terminal-specific typecheck failures introduced during this phase were resolved.

## Remaining Work

### 1. Runtime Validation

- Validate `codex` input and cursor behavior.
- Validate `claude code` input and cursor behavior.
- Validate Ctrl+C, Ctrl+V, selection, paste, and shell integration behavior.
- Validate resize, split resize, and detach/reattach behavior.
- Validate IME behavior.

### 2. Session and State Integration

- Tighten title/state/pid/cwd synchronization.
- Verify detached editor attach/detach lifecycle under the real service path.
- Verify close, process exit, and reopen behavior for a single session.
- Decide whether to expose more process properties to match VS Code expectations more closely.

### 3. Overall Stabilization

- Re-run desktop-app validation once unrelated type errors are handled.
- Separate terminal verification from unrelated workspace failures.
- Add terminal-focused tests if needed.

## Current Assessment

The project is now past the legacy-cleanup phase.

In practice that means:

- The old terminal code path has been removed.
- The old `pty:*` compatibility surface has been removed from the active implementation.
- The old local xterm host wrapper has been removed.
- The renderer now boots through VS Code terminal service overrides and a preload-backed backend adapter.
- The next phase is runtime hardening and behavior validation, not another structural rewrite.

## Handoff

For a fuller implementation handoff targeted at another coding agent, see:

- `CLAUDE-CODE-HANDOFF-terminal.md`
