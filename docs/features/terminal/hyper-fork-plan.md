# Terminal Hyper Fork Plan

Date: 2026-04-12
Worktree: `terminal-hyper-fork`
Status: active

## 1. Goal

This worktree exists to replace the remaining VS Code terminal runtime path with a Hyper-style terminal surface fork.

Primary objective:

- eliminate the cursor, textarea, selection, focus, and input ownership bugs seen in the VS Code terminal path
- keep Netior-specific terminal features intact
- treat Hyper fork as the primary strategy, not as a fallback

In scope:

- renderer-side terminal surface ownership
- focus and textarea behavior
- search behavior
- link handling strategy
- terminal session attachment to Netior PTY IPC
- preserving Netior overlays, shortcuts, pane-open behavior, todo UI, and agent/session integration

Out of scope:

- Hyper plugin system
- Hyper Redux app shell
- Hyper menu, updater, window shell, and settings model
- replacing Netior main/preload/PTTY/session lifecycle unless a terminal bug forces a narrow change

## 2. Problem Statement

The current Netior terminal is no longer mounted through the VS Code engine by default, but it is not yet a true Hyper fork. A direct `xterm` baseline exists, while the old VS Code terminal runtime still remains in the codebase and still shapes behavior around the editor.

That is not sufficient for the stated goal. The goal is not "use xterm somewhere". The goal is to make Netior own the terminal surface the way Hyper does, because Hyper behaves correctly in the PowerShell, Codex, and Claude Code cases where the VS Code path did not.

Update on 2026-04-12:

- the old VS Code terminal runtime path has now been removed from this worktree
- the current remaining work is parity validation and follow-up cleanup, not the initial architectural split

## 3. Current Netior State

### 3.1 What is already in place

- `packages/desktop-app/src/renderer/lib/terminal/engine/index.ts`
  - default engine is `getHyperTerminalEngine()`
- `packages/desktop-app/src/renderer/lib/terminal/engine/hyper-terminal-engine.ts`
  - direct `@xterm/xterm` engine exists
  - uses `FitAddon` and `SearchAddon`
  - talks directly to `window.electron.terminal`

This is a useful baseline, but it is not yet the final architecture.

### 3.2 What has already been removed in this worktree

- `packages/desktop-app/src/renderer/lib/terminal/terminal-services.ts`
  - deleted
- `packages/desktop-app/src/renderer/lib/terminal/terminal-backend.ts`
  - deleted
- `packages/desktop-app/src/renderer/lib/terminal/engine/vscode-terminal-engine.ts`
  - deleted
- `packages/desktop-app/package.json`
  - terminal-specific `@codingame/monaco-vscode-*` dependencies removed
- `packages/desktop-app/src/renderer/components/editor/EditorContent.tsx`
  - no longer depends on `.xterm-helper-textarea`
  - now focuses the active terminal through the Hyper-style term registry and a Netior-owned terminal input marker

### 3.3 Netior terminal features that must survive the fork

These are not optional extras. They are parity requirements.

- link overlay and file-link detection in `TerminalEditor.tsx`
- pane-aware file open actions
- Netior-managed keyboard shortcuts
- terminal search bar
- copy and paste behavior
- font size controls
- page scroll shortcuts
- todo panel integration
- title updates and agent/session metadata

## 4. Hyper Research Summary

The following points are source-backed from official Hyper repositories and release notes.

### 4.1 Hyper is a direct xterm terminal surface

Official Hyper canary `package.json` lists a direct xterm addon stack including:

- `xterm`
- `xterm-addon-fit`
- `xterm-addon-search`
- `xterm-addon-web-links`
- `xterm-addon-canvas`
- `xterm-addon-webgl`

This matters because it confirms the renderer terminal surface is directly owned by Hyper rather than by a VS Code terminal service layer.

Source:

- https://github.com/vercel/hyper/blob/canary/package.json

### 4.2 Hyper still uses node-pty, but owns the surface itself

Official Hyper `app/package.json` shows `node-pty` in the app layer. That means the reason Hyper feels better is not "no pty" or "no xterm". The difference is ownership of the terminal surface and interaction model.

Source:

- https://github.com/vercel/hyper/blob/canary/app/package.json

### 4.3 Hyper keeps imperative access to mounted terms

`lib/terms.ts` is a tiny registry where mounted term components register themselves for imperative access. That is a strong signal about Hyper's architecture: it optimizes around direct terminal ownership and low-friction imperative control.

Source:

- https://github.com/vercel/hyper/blob/canary/lib/terms.ts

### 4.4 Hyper term component directly wires focus, textarea, addons, and rendering

Hyper's `lib/components/term.tsx` directly:

- creates the xterm instance
- loads fit/search/web-links addons
- opens xterm into a managed host element
- listens to `term.textarea` focus
- calls `term.focus()` when the terminal becomes active

That is directly relevant to the bug class we are trying to eliminate.

Source:

- https://github.com/vercel/hyper/blob/canary/lib/components/term.tsx

### 4.5 Hyper has terminal interaction fixes we care about

Official Hyper releases show terminal-surface changes such as:

- `Focus term when clicked on padding`
- `search box overhaul`
- `Upgrade to xterm v5`
- `fallback to canvas renderer on webgl context loss`

These are useful signals because they match the kinds of UX failures we want to avoid.

Source:

- https://github.com/vercel/hyper/releases

### 4.6 Hyper plugin architecture exists, but we do not want it

Hyper has a documented plugin flow and dev-mode plugin directory. That is explicit scope we do not want to carry into Netior.

Source:

- https://github.com/vercel/hyper/blob/canary/PLUGINS.md

## 5. Fork Boundary

This section is an engineering decision based on the Hyper sources above and Netior's current architecture. It is an inference from source comparison, not a verbatim upstream rule.

### 5.1 What we will fork or adapt from Hyper

- terminal surface ownership patterns
- direct xterm lifecycle patterns
- focus and textarea handling patterns
- term registry / imperative access pattern
- addon composition patterns
- search integration patterns
- rendering fallback ideas when WebGL is unstable

### 5.2 What we will keep from Netior

- Electron main and preload bridges
- `window.electron.terminal` IPC contract
- PTY lifecycle and replay
- session identity and launch config model
- link overlay and pane-open behavior
- todo panel and agent integrations
- Netior editor/tab model

### 5.3 What we will explicitly not fork

- plugin loading
- Redux app shell and Hyper UI chrome
- Hyper config model
- Hyper menus, updater, notifications, and installer flow
- Hyper's full main-process architecture

## 6. Target Architecture

### 6.1 Desired renderer split

- `hyper-fork/`
  - imported or adapted terminal surface primitives
  - term registry
  - focus / textarea ownership
  - addon setup
  - search controller
- `terminal/engine/`
  - Netior engine facade over the Hyper forked surface
- `TerminalEditor.tsx`
  - Netior feature adapter layer only
  - overlay, pane actions, search UI, todo panel, shortcuts

### 6.2 Desired data path

Netior should keep this runtime shape:

`renderer terminal surface -> window.electron.terminal -> main PTY manager -> node-pty`

The change is in who owns the terminal surface and DOM behavior, not in who owns PTY state.

## 7. Remaining Gaps

1. Manual smoke validation is still required in real PowerShell, Codex, and Claude Code sessions.
2. `TerminalEditor.tsx` still owns a large amount of buffer-coordinate and overlay DOM math.
3. Renderer fallback strategy such as WebGL-to-canvas is still only a research target, not implemented behavior.

## 8. Execution Plan

### Milestone 0: Upstream inventory

- inspect Hyper term-related upstream files in detail
- identify the minimum set worth adapting into Netior
- map which behaviors are renderer-only and which are tightly coupled to Hyper app state

Deliverable:

- a small import/adaptation target list under `hyper-fork/`

### Milestone 1: Separate Netior appearance from VS Code services

- extract terminal appearance and theme snapshot logic out of `terminal-services.ts`
- make the Hyper path depend only on Netior appearance utilities
- leave no runtime requirement for Monaco VS Code terminal services when mounting the active terminal

Deliverable:

- `hyper-terminal-engine.ts` no longer imports a VS Code service bootstrap file

### Milestone 2: Create a real Hyper-fork renderer layer

- add a dedicated `hyper-fork` folder
- port or adapt the term registry pattern
- port or adapt focus and textarea handling strategy
- port or adapt addon ownership strategy
- re-check search handling against Hyper term behavior

Deliverable:

- the mounted terminal path clearly lives under a Hyper-derived renderer surface, not in an ad hoc engine wrapper

### Milestone 3: Move Netior-specific features onto the new surface

- keep `TerminalEditor.tsx` as a Netior feature adapter, not as the place that defines terminal runtime ownership
- reconnect:
  - link overlay
  - file-link parsing
  - pane-open actions
  - search bar
  - todo panel
  - title updates
  - Netior shortcuts

Deliverable:

- Netior terminal features run against the Hyper-fork surface with no VS Code terminal instance

### Milestone 4: Delete the old VS Code path

- remove `vscode-terminal-engine.ts`
- remove `terminal-backend.ts`
- remove terminal-service bootstrap that only exists for VS Code terminal
- drop `@codingame/monaco-vscode-terminal-service-override`
- remove any leftover code that depends on `ITerminalInstance`

Deliverable:

- no active terminal runtime path depends on the Monaco VS Code terminal service layer

### Milestone 5: Hard parity verification

Run the same scenarios that originally motivated the fork:

- PowerShell prompt editing
- Codex interactive flow
- Claude Code interactive flow
- selection and copy
- paste and bracketed paste behavior
- Ctrl/Cmd+F search
- Ctrl/Cmd+C/V and font shortcuts
- click and modifier-click around links
- file links with spaces and line numbers
- pane-aware open actions
- detached window behavior

Deliverable:

- documented pass/fail matrix with regressions listed explicitly

## 9. Verification Matrix

### 9.1 Input and caret ownership

- cursor stays visually correct while typing in PowerShell
- textarea focus does not disappear after tab switch
- click on padding still activates the terminal
- IME and composition do not regress

### 9.2 Selection and copy

- mouse selection works in PowerShell, Codex, and Claude Code
- selected text overlay still appears when expected
- Ctrl/Cmd+C sends copy when text is selected
- Ctrl+C still reaches the shell when no UI copy should happen

### 9.3 Search

- search bar opens and closes correctly
- next and previous match navigation works
- active match and overview highlighting are visible

### 9.4 Links and overlay actions

- URL hover and modifier-click behavior work
- file links with spaces or quotes resolve correctly
- overlay actions open in current tab, split, or target pane correctly

### 9.5 Session lifecycle

- create instance
- attach to existing session
- replay scrollback
- resize on mount and layout change
- exit and cleanup

## 10. Suggested Upstream Reference Set

These are the first Hyper files worth reading before code porting starts:

- `lib/components/term.tsx`
- `lib/terms.ts`
- Hyper canary `package.json`
- Hyper app `package.json`
- `PLUGINS.md` only to define what we are excluding
- release notes around `v4.0.0-canary.1` through `v4.0.0-canary.5`

## 11. Immediate Next Steps

1. Run Electron smoke tests in this worktree with PowerShell, Codex, and Claude Code.
2. Verify cursor, textarea, selection, search, link overlay, and pane-open behavior against the original bug cases.
3. If any remaining focus bug exists, compare directly against Hyper `lib/components/term.tsx` and tighten the surface behavior instead of patching `TerminalEditor.tsx`.
4. After manual parity is confirmed, stage and commit the Hyper-fork removal of the VS Code terminal path.

## 12. Sources

Official Hyper sources:

- https://github.com/vercel/hyper/blob/canary/package.json
- https://github.com/vercel/hyper/blob/canary/app/package.json
- https://github.com/vercel/hyper/blob/canary/lib/terms.ts
- https://github.com/vercel/hyper/blob/canary/lib/components/term.tsx
- https://github.com/vercel/hyper/blob/canary/PLUGINS.md
- https://github.com/vercel/hyper/releases

Netior local references:

- `packages/desktop-app/src/renderer/lib/terminal/engine/index.ts`
- `packages/desktop-app/src/renderer/lib/terminal/engine/hyper-terminal-engine.ts`
- `packages/desktop-app/src/renderer/lib/terminal/hyper-fork/hyper-terminal-surface.ts`
- `packages/desktop-app/src/renderer/lib/terminal/hyper-fork/term-registry.ts`
- `packages/desktop-app/src/renderer/lib/terminal/hyper-fork/terminal-appearance.ts`
- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/EditorContent.tsx`
- `packages/desktop-app/package.json`
