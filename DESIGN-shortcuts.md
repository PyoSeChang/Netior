# DESIGN: Shortcut System

## Goal

Netior shortcut support should satisfy two constraints at the same time:

1. A developer must be able to see the full shortcut map in one place.
2. Runtime handling must stay close to the state that a shortcut actually manipulates.

That means the system is not "everything handled globally" and not "everything scattered in components".
It is a layered system:

- central registry for definition and discoverability
- hierarchical runtime handling for correctness

## Why This Design

The app already has three different shortcut shapes:

- truly global actions, such as save
- context actions, such as canvas delete/select-all
- local widget actions, such as Narre mention picker navigation

Those behave differently and should not be forced into one flat mechanism.

Examples:

- `Ctrl/Cmd+S` should mean save almost everywhere.
- `Enter` inside Narre mention picker should select a mention, not send a message.
- `Escape` inside an inline rename input should cancel rename first, not close the whole screen.

So the system must be explicit about scope and precedence.

## User Use Cases

### Use Case 1: Canvas-heavy editing

The user is moving between canvases, opening concepts, creating edges, and switching browse/edit mode.
They expect:

- app-wide shortcuts to keep working
- canvas-only actions to trigger only when canvas is the active context
- local overlays such as context menus or pickers to intercept keys before canvas logic

### Use Case 2: File and editor workflow

The user opens files from the sidebar, renames files, copies paths, opens terminals, and closes tabs quickly.
They expect:

- file-tree shortcuts to work only when file tree is focused or owns selection
- tab shortcuts to work from anywhere reasonable
- text inputs to keep normal text-editing behavior

### Use Case 3: Narre conversation workflow

The user opens Narre, types messages, uses `@` mentions and `/` commands, and navigates pickers by keyboard.
They expect:

- picker navigation to override chat-level behavior
- chat send behavior to override global behavior only when the input is active
- global app shortcuts like close tab or open settings to still work when not conflicting

### Use Case 4: Settings and modal flow

The user opens a modal and expects `Escape` to close or cancel the innermost modal state first.

## Screen-Level Structure

Shortcut handling is divided into four layers:

1. Local widget layer
2. Context layer
3. Global app layer
4. Registry/documentation layer

The registry is not above the others in runtime priority. It is the source of truth for definition.

## Layer 1: Local Widget Layer

This layer owns shortcuts for components that already own transient UI state.

Examples:

- modal open/close
- mention picker selected index
- slash picker selected index
- inline rename confirm/cancel
- terminal search bar close

These handlers stay inside the component because:

- the state is local
- the behavior is highly specific
- routing through a global dispatcher would add coupling without benefit

This layer usually listens only while the widget is mounted or active.

## Layer 2: Context Layer

This layer owns shortcuts that belong to the currently active work area.

Examples:

- canvas shortcuts when canvas is active
- terminal shortcuts when terminal tab is active
- file-tree shortcuts when file tree has focus/selection
- Narre chat shortcuts when chat input is active

This layer should be implemented as context-specific handlers or hooks, not directly inside random leaf components if the behavior spans multiple child components.

Examples of context objects:

- `canvas`
- `terminal`
- `fileTree`
- `narreChat`
- `settings`

## Layer 3: Global App Layer

This layer owns shortcuts whose meaning is consistent across the whole app.

Examples:

- save active tab
- close active tab
- toggle sidebar
- open settings
- switch sidebar view
- open Narre
- create terminal tab

This layer should be a single dispatcher hook mounted near the app shell.

## Layer 4: Registry Layer

This layer does not have to execute every shortcut directly.
Its job is:

- define shortcuts in one place
- declare intended scope
- declare owning handler
- support inspection and future shortcut help UI
- support collision checks

This layer is the discoverability layer, not necessarily the runtime owner.

## Runtime Precedence

Shortcut precedence must be strict:

1. focused local widget
2. active context handler
3. global app handler

Practical examples:

- if Narre mention picker is open, `Enter` selects mention
- if file rename input is active, `Escape` cancels rename
- if no local widget consumes the key and canvas is active, `Delete` removes selected nodes
- if no local widget or context handler consumes the key, global handler may process `Ctrl/Cmd+W`

## Consumption Rule

Each handler must return whether it consumed the event.

If consumed:

- call `preventDefault()` when browser/default behavior would conflict
- stop propagation within the shortcut layer
- do not allow lower-priority layers to run

If not consumed:

- let the next layer evaluate the event

## Special Rule for Text Inputs

Text entry must not be broken by global shortcuts.

Global and context handlers should skip execution when:

- the focused element is a text input
- the focused element is a textarea
- the focused element is contentEditable

Exceptions are explicit editor shortcuts that are expected inside editing contexts:

- `Ctrl/Cmd+S`
- `Ctrl/Cmd+W`
- `Escape` for an owned modal/input flow

Those exceptions should be opt-in, not implicit.

## Registry Shape

Registry entries should be metadata-first.
They should describe the shortcut even if the actual execution is delegated elsewhere.

Each entry needs:

- `id`
- `keybinding`
- `description`
- `scope`
- `owner`
- `when`
- `priority`

Suggested shape:

```ts
type ShortcutScope =
  | 'global'
  | 'canvas'
  | 'terminal'
  | 'fileTree'
  | 'narreChat'
  | 'narreMentionPicker'
  | 'narreSlashPicker'
  | 'settings'
  | 'modal';

type ShortcutOwner =
  | 'globalDispatcher'
  | 'canvasContext'
  | 'terminalEditor'
  | 'fileTree'
  | 'narreChat'
  | 'narreMentionPicker'
  | 'narreSlashPicker'
  | 'settingsModal';
```

The runtime system does not need to call handlers from registry entries directly on day one.
It is enough that the registry is the single source of definition and each runtime handler maps back to an entry id.

## Shortcut Categories

### Global App

- save active tab
- close active tab
- open settings
- toggle sidebar
- switch sidebar view
- open Narre
- open terminal
- cycle tabs

### Canvas

- select all nodes
- delete selected nodes
- cancel edge linking
- toggle browse/edit mode
- fit to screen
- zoom controls
- open selected node
- navigate canvas history

### File Tree

- rename selection
- copy
- cut
- paste
- delete
- open selection
- create file
- create directory

### Terminal

- search
- copy selection / interrupt behavior
- paste
- font size controls
- page scroll

### Narre

- send message
- newline
- mention picker navigation
- slash picker navigation
- back to session list

### Settings / Modals

- close modal
- focus search
- move between categories

## Initial Shortcut Map

This is the first-pass target map for the system definition.
It does not mean every shortcut must be implemented immediately.

### Global

- `Ctrl/Cmd+S` save active tab
- `Ctrl/Cmd+W` close active tab
- `Ctrl/Cmd+,` open settings
- `Ctrl/Cmd+B` toggle sidebar
- `Ctrl/Cmd+1` show canvas sidebar
- `Ctrl/Cmd+2` show file sidebar
- `Ctrl/Cmd+3` show archetype sidebar
- `Ctrl/Cmd+Shift+N` open terminal tab
- `Ctrl/Cmd+Alt+N` open Narre tab
- `Ctrl/Cmd+Tab` next tab
- `Ctrl/Cmd+Shift+Tab` previous tab

### Canvas

- `Delete` delete selected nodes
- `Ctrl/Cmd+A` select all nodes
- `Escape` cancel edge linking
- `E` toggle canvas mode
- `F` fit to screen
- `Alt+Left` navigate back

### File Tree

- `F2` rename selected item
- `Delete` delete selected item
- `Ctrl/Cmd+C` copy selected item
- `Ctrl/Cmd+X` cut selected item
- `Ctrl/Cmd+V` paste into selected directory

### Terminal

- `Ctrl/Cmd+F` open search
- `Ctrl/Cmd+V` paste
- `Ctrl/Cmd+=` font size up
- `Ctrl/Cmd+-` font size down
- `Ctrl/Cmd+0` font size reset
- `Shift+PageUp` page up
- `Shift+PageDown` page down

### Narre

- `Enter` send message
- `Shift+Enter` newline
- `ArrowUp/Down` picker navigation
- `Enter` picker confirm
- `Escape` picker close

## Data Flow

### Definition Flow

1. Shortcut metadata is declared in a central registry module.
2. Each runtime owner references registry ids it implements.
3. Future shortcut-help UI reads from the registry only.

### Runtime Flow

1. A keyboard event occurs.
2. Active local widget gets first chance to consume it.
3. If not consumed, active context handler evaluates it.
4. If still not consumed, global dispatcher evaluates it.
5. If consumed, the event stops there.

### Debugging Flow

To make debugging realistic, every consumed shortcut should log a stable id in development mode.

Example:

- `shortcut.global.save`
- `shortcut.canvas.deleteSelection`
- `shortcut.narreMentionPicker.selectNext`

## Edge Cases

### Same key, different meaning by scope

`Enter` means different things in:

- Narre chat input
- Narre mention picker
- inline rename input

This is expected and solved by precedence.

### Same key, same scope, different state

`Ctrl/Cmd+C` in terminal should copy selection if present.
If not, terminal may treat it as interrupt behavior.
That is a terminal-owned decision, not a global one.

### Browser-default conflicts

Some keys like `Ctrl/Cmd+S`, `Ctrl/Cmd+W`, `Ctrl/Cmd+F` have browser meaning in Electron renderer.
The owning handler must explicitly suppress default behavior when consuming.

### Focus ambiguity

File-tree shortcuts depend on selection/focus, but the current file tree does not yet have a formal keyboard-selection model.
That means definition can be finalized first, but runtime implementation for file-tree shortcuts should add:

- focused item tracking
- selected item tracking
- destination resolution for paste

### Help UI mismatch

Some shortcuts may be defined before implemented.
Registry entries should include an `implemented` flag or equivalent marker so the app does not claim support too early.

## Proposed File Boundaries

### New files

- `packages/desktop-app/src/renderer/shortcuts/shortcut-registry.ts`
- `packages/desktop-app/src/renderer/shortcuts/shortcut-types.ts`
- `packages/desktop-app/src/renderer/shortcuts/useGlobalShortcuts.ts`
- `packages/desktop-app/src/renderer/shortcuts/shortcut-utils.ts`

### Existing files to integrate

- `packages/desktop-app/src/renderer/components/workspace/ConceptWorkspace.tsx`
- `packages/desktop-app/src/renderer/components/editor/TerminalEditor.tsx`
- `packages/desktop-app/src/renderer/components/sidebar/FileTree.tsx`
- `packages/desktop-app/src/renderer/components/editor/narre/NarreMentionPicker.tsx`
- `packages/desktop-app/src/renderer/components/editor/narre/NarreSlashPicker.tsx`
- `packages/desktop-app/src/renderer/components/settings/SettingsModal.tsx`
- `packages/desktop-app/src/renderer/components/workspace/WorkspaceShell.tsx`

## Implementation Plan

### Phase 1

- create shortcut types and registry
- move current global save definition into the registry model
- add a global dispatcher hook for true global shortcuts only

### Phase 2

- formalize context shortcuts for canvas and terminal
- keep local widget shortcuts where they are, but register them centrally

### Phase 3

- add file-tree keyboard selection model
- wire file-tree clipboard and rename/delete shortcuts

### Phase 4

- add a shortcut help modal or settings section driven by the registry

## Decisions Locked By This Design

- shortcut definitions are centralized
- runtime handling is hierarchical
- local widget handlers remain local when they own local state
- global dispatch is reserved for app-wide actions
- context handlers are responsible for context-specific shortcuts
- precedence is local > context > global

## Open Questions

- exact binding for opening Narre: `Ctrl/Cmd+Alt+N` vs another combo
- whether tab cycling is included in phase 1 or later
- whether canvas mode toggle should use `E`, `Space`, or another key
- whether shortcut help UI ships in the first implementation or later
