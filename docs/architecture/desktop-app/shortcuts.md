# Desktop App Shortcut System

Netior desktop app shortcut support is split into two parts:

- a central registry that defines shortcut metadata
- layered runtime handlers that execute shortcuts in the right place

This keeps the shortcut map easy to inspect while letting stateful UI handle its own keys.

---

## 1. Design Summary

The shortcut system follows this precedence:

1. local widget
2. active context
3. global app

Examples:

- Narre mention picker handles `ArrowUp`, `ArrowDown`, `Enter`, `Escape` before chat input logic.
- File tree handles `F2`, `Delete`, `Ctrl/Cmd+C`, `Ctrl/Cmd+X`, `Ctrl/Cmd+V` only when the tree is focused.
- Global app shortcuts such as `Ctrl/Cmd+S` or `Ctrl/Cmd+W` run when no higher-priority handler consumes the event.

The goal is:

- one place to audit shortcut definitions
- runtime behavior that stays close to the state it manipulates

---

## 2. Source Files

### 2.1 Central Registry

- `packages/desktop-app/src/renderer/shortcuts/shortcut-types.ts`
  - shared types for shortcut id, scope, owner, and priority
- `packages/desktop-app/src/renderer/shortcuts/shortcut-registry.ts`
  - source of truth for shortcut definitions
- `packages/desktop-app/src/renderer/shortcuts/shortcut-utils.ts`
  - helper logic such as editable-target detection and shortcut logging

### 2.2 Global Runtime

- `packages/desktop-app/src/renderer/shortcuts/useGlobalShortcuts.ts`
  - installs the app-level keydown handler
- `packages/desktop-app/src/renderer/App.tsx`
  - mounts the global shortcut hook
  - renders the shortcut overlay

### 2.3 Context and Local Runtime

- `packages/desktop-app/src/renderer/components/workspace/useCanvasShortcuts.ts`
  - canvas-scoped shortcuts
- `packages/desktop-app/src/renderer/components/sidebar/FileTree.tsx`
  - file-tree-scoped shortcuts and selection model
- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
  - terminal-local shortcuts
- `packages/desktop-app/src/renderer/components/editor/narre/NarreMentionInput.tsx`
  - Narre chat send/newline behavior
- `packages/desktop-app/src/renderer/components/editor/narre/NarreMentionPicker.tsx`
  - mention picker local shortcuts
- `packages/desktop-app/src/renderer/components/editor/narre/NarreSlashPicker.tsx`
  - slash picker local shortcuts

### 2.4 Overlay

- `packages/desktop-app/src/renderer/components/shortcuts/ShortcutOverlay.tsx`
  - registry-backed overlay for inspecting the current shortcut map
- `packages/desktop-app/src/renderer/stores/ui-store.ts`
  - overlay open/close state

---

## 3. Registry Model

Each shortcut definition includes:

- `id`
- `description`
- `keybinding`
- `scope`
- `owner`
- `priority`
- `implemented`
- optional `when`

### Scope

Current scopes:

- `global`
- `canvas`
- `fileTree`
- `terminal`
- `narreChat`
- `narreMentionPicker`
- `narreSlashPicker`
- `settings`
- `modal`

### Owner

Owner identifies the module that actually executes the shortcut. The registry is the definition source, not the only runtime dispatcher.

### Priority

- `local`
  - widget-specific transient UI
- `context`
  - active screen or focused work area
- `global`
  - app-wide behavior

---

## 4. Implemented Shortcut Map

### 4.1 Global

- `Ctrl/Cmd+S`
  - save active tab
- `Ctrl/Cmd+W`
  - close active tab
- `Ctrl/Cmd+,`
  - open settings
- `Ctrl/Cmd+/`
  - open keyboard shortcut overlay
- `Ctrl/Cmd+B`
  - toggle sidebar
- `Ctrl/Cmd+Shift+N`
  - open a new terminal tab
- `Ctrl/Cmd+Alt+N`
  - open Narre for the current project
- `Ctrl/Cmd+Tab`
  - activate next tab
- `Ctrl/Cmd+Shift+Tab`
  - activate previous tab
- `Ctrl/Cmd+1..9`
  - activate tab by index
  - `9` opens the last tab

### 4.2 Canvas

- `Ctrl/Cmd+A`
  - select all canvas nodes
- `Delete`
  - delete selected nodes
- `Escape`
  - cancel edge linking
- `E`
  - toggle canvas browse/edit mode
- `F`
  - fit canvas content to the viewport

### 4.3 File Tree

- `ArrowUp`
  - move selection up
- `ArrowDown`
  - move selection down
- `ArrowLeft`
  - collapse selected directory
- `ArrowRight`
  - expand selected directory
- `Enter`
  - open selected file or toggle selected directory
- `F2`
  - rename selected item
- `Delete`
  - delete selected item or selected range
- `Ctrl/Cmd+C`
  - copy selected item or multi-selection
- `Ctrl/Cmd+X`
  - cut selected item or multi-selection
- `Ctrl/Cmd+V`
  - paste into selected directory or file parent directory
- `Ctrl/Cmd+A`
  - select all visible file tree items
- `Ctrl/Cmd+Z`
  - undo the last file tree paste, move, or delete action

Additional file tree selection behavior:

- `Ctrl/Cmd+Click`
  - toggle an item in the current selection
- `Shift+Click`
  - extend selection as a contiguous visible range

### 4.4 Terminal

- `Ctrl/Cmd+F`
  - open terminal search
- `Ctrl/Cmd+C`
  - copy terminal selection
  - if no selection exists, terminal keeps its own behavior
- `Ctrl/Cmd+V`
  - paste into terminal
- `Ctrl/Cmd+=`
  - increase terminal font size
- `Ctrl/Cmd+-`
  - decrease terminal font size
- `Ctrl/Cmd+0`
  - reset terminal font size
- `Shift+PageUp`
  - scroll terminal one page up
- `Shift+PageDown`
  - scroll terminal one page down

### 4.5 Narre

- `Enter`
  - send message
- `Shift+Enter`
  - insert newline

Mention picker:

- `ArrowDown`
  - next item
- `ArrowUp`
  - previous item
- `Enter`
  - confirm selected mention
- `Escape`
  - close picker

Slash picker:

- `ArrowDown`
  - next item
- `ArrowUp`
  - previous item
- `Enter`
  - confirm selected command
- `Escape`
  - close picker

---

## 5. Overlay Behavior

The shortcut overlay is opened by `Ctrl/Cmd+/`.

Behavior:

- uses the central registry as its data source
- groups shortcuts by scope
- shows only implemented shortcuts
- closes on `Escape`
- closes on backdrop click

This is a read-only help overlay for now. Shortcut remapping is not implemented yet.

---

## 6. Input Safety Rules

Global handlers should not aggressively steal keyboard input from editable controls.

Current rules:

- if a local widget consumes the event first, global handlers do nothing
- global handler checks `event.defaultPrevented`
- editable targets are respected before non-essential global navigation shortcuts run

This is especially important for:

- Narre content-editable input
- inline rename fields
- settings search input
- terminal-local controls

---

## 7. Extension Guidelines

When adding a new shortcut:

1. add a definition to `shortcut-registry.ts`
2. decide its correct scope and owner
3. implement handling at the lowest correct runtime layer
4. verify it does not break editable input behavior
5. check the overlay to confirm discoverability

Use these rules:

- keep global only for app-wide meaning
- keep local widget logic near local state
- prefer context handlers for workspace-specific actions
- do not move transient widget behavior into the global dispatcher just to centralize execution

---

## 8. Current Gaps

The current system is intentionally not fully customizable yet.

Not implemented yet:

- user-configurable key remapping
- conflict-resolution UI
- dedicated keyboard settings screen
- full registry coverage for every modal and settings-specific key

The existing design keeps those additions possible without rewriting the runtime structure.
