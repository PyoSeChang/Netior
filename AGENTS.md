# AGENTS.md

## Codex Operational Notes

- When a command is blocked by the Codex sandbox, describe it as "requesting approval to run outside the sandbox". Do not call it "elevated permissions" or "admin privileges" unless Windows UAC/admin is actually involved.
- Before editing with `apply_patch`, read the exact nearby block first. Prefer small patches tied to current file text. If a patch fails, re-read the target block before retrying.
- Treat Korean docs as encoding-sensitive. Do not rewrite whole Korean documents, and do not write Korean docs with PowerShell `Set-Content` or shell redirection. Prefer minimal `apply_patch` edits and re-read the changed area afterward.
- On Windows, avoid shell-generated text file rewrites for docs. For code edits, use `apply_patch`; for formatting or generated build artifacts, use the repo's normal tools.
- When staging or committing in a dirty worktree, stage explicit paths only and report which tracked files were included.

## What Is Netior

Netior (Map of Concepts) is a canvas-based desktop app for organizing concepts. Concepts are placed as nodes on a canvas and relationships are represented as edges between nodes. Instance data lives in files such as `.md` and `.pdf`.

It is the successor to Culturium. The structure was redesigned to remove three blockers to open-sourcing: backend coupling, SQLite metadata isolation, and `culture.json` complexity.

## Commands

```bash
# Development
pnpm dev:desktop

# Build
pnpm build
pnpm --filter @netior/shared build
pnpm --filter @netior/core build
pnpm --filter @netior/mcp build
pnpm --filter @netior/narre-server build

# Test
pnpm test
pnpm --filter @netior/shared test
pnpm --filter @netior/core test
pnpm --filter @netior/desktop-app test

# Typecheck
pnpm typecheck
```

## Architecture

### Monorepo

- **`packages/shared`** (`@netior/shared`) — shared types, constants, and i18n. Built with tsup as ESM and CJS. Subpaths: `/types`, `/constants`, `/i18n`.
- **`packages/netior-core`** (`@netior/core`) — DB logic library: connection, repositories, migrations. The runtime owner is `netior-service`.
- **`packages/netior-service`** (`@netior/service`) — DB/native owner process. Wraps `@netior/core` behind HTTP and is the only runtime that should directly own `better-sqlite3`.
- **`packages/netior-mcp`** (`@netior/mcp`) — MCP server. Exposes Netior tools through `netior-service`.
- **`packages/narre-server`** (`@netior/narre-server`) — Narre AI service. Provider adapters plus Express plus SSE. DB access goes through `netior-service`.
- **`packages/desktop-app`** (`@netior/desktop-app`) — Electron app built with electron-vite. Output goes to `out/`.

### Desktop App Layers

```text
main process          -> preload bridge        -> renderer (React)
------------------------------------------------------------------
sidecar clients          preload/index.ts         services/*.ts
ipc/*.ts                 contextBridge API        stores/*.ts (Zustand)
process/*.ts                                       components/**/*.tsx
                                                   hooks/
```

**Data flow**: renderer services -> `window.electron.*` -> preload `ipcRenderer.invoke` -> main IPC handlers -> `netior-service` HTTP -> `@netior/core` -> `better-sqlite3`.

**IPC pattern**: every response uses `IpcResult<T>` (`{ success: true, data } | { success: false, error }`). Channel constants live in `@netior/shared/constants` as `IPC_CHANNELS`.

### Production Packaging

- The packaged desktop app includes a bundled Node runtime under `resources/node-runtime`.
- Production sidecars are embedded under `resources/sidecars`.
- The sidecar set is:
  - `netior-service`
  - `netior-mcp`
  - `narre-server`
- The installer upgrade path is customized in `packages/desktop-app/build/installer.nsh`.
- Upgrade behavior:
  - If `Netior.exe` is not actually running, the installer pre-cleans the previous install directory and uninstall registry entries before relying on an older uninstaller.
  - If an older uninstaller still fails later in the flow, the installer falls back to manual cleanup instead of aborting immediately.

### Two Storage Layers

| Layer | Location | Contents |
|---|---|---|
| Metadata | `%APPDATA%/netior/data/netior.db` | projects, concepts, canvases, nodes, edges, concept_files, relation_types, canvas_types, and related metadata |
| Instance Data | User project directory | `.md`, `.pdf`, `.png`, and other real files |

The app does not write metadata into the project directory. Canvas and SQLite handle structure; the filesystem is pure instance storage.

### Data Model

- **Project** — references a user directory (`name`, `root_dir`)
- **Concept** — belongs to a project; has `title`, `color`, `icon`, `schema_id`
- **Canvas** — `Concept:Canvas = 1:N`; stores `concept_id` or `canvas_type_id` plus viewport state
- **CanvasNode** — placed on a canvas; one of `concept_id`, `file_path`, or `dir_path`
- **Edge** — belongs to a canvas; has `relation_type_id`, `description`, and visual override fields such as `color`, `line_style`, and `directed`
- **ConceptFile** — links a concept to a file path relative to project `root_dir`

### Type System

Project-level types:

- **Schema** — a concept class
- **RelationType** — an edge class
- **CanvasType** — a canvas class with allowed relation types via a junction table

When adding a new type, follow the seven-layer pattern:

`migration -> types -> constants -> repository -> IPC -> preload -> renderer`

### Canvas Engine

There is no external canvas library. The canvas is implemented directly with CSS transforms and SVG.

- Pan/zoom is handled in `ConceptWorkspace`
- `Ctrl + wheel` navigates canvas hierarchy
- Nodes are rendered by `NodeCardDefault` plus shape layouts
- Edges are rendered by `EdgeLayer` and `EdgeLine`
- Background uses an SVG dot grid
- Interaction modes: `browse` and `edit`

### Edge Interaction

- **Create** — edit mode -> right-click a node -> add connection -> click target node -> open `EdgeEditor`
- **Edit** — double-click an edge -> open `EdgeEditor`
- **Delete** — edit mode -> right-click an edge -> `EdgeContextMenu` -> delete
- **Visual override** — per-edge `color`, `line_style`, and `directed`; `null` falls back to the `RelationType` default

### Editor System

`EditorTabType`:

`'concept' | 'file' | 'schema' | 'terminal' | 'edge' | 'relationType' | 'canvasType' | 'canvas' | 'narre'`

Extension-based editor routing:

- `.md` -> `MarkdownEditor`
- `.txt`, `.json`, `.yaml`, and similar -> `PlainTextEditor`
- `.png`, `.jpg`, and similar -> `ImageViewer`
- `.pdf` -> `PdfViewer`
- anything else -> `UnsupportedFallback`

### Narre

Narre uses `EditorTabType 'narre'`. The Sparkles icon in the activity bar opens it. There is one Narre tab per project.

Architecture:

```text
desktop-app (renderer) -> desktop-app (main) -> narre-server (sidecar)
NarreChat.tsx             narre-ipc.ts          Express + SSE + provider adapters
SSE UI events         <-  IPC forwarder      <- provider runtime
                                                |
                                                +-> netior-service / netior-mcp
```

Key pieces:

- `NarreEditor`
- `NarreSessionList`
- `NarreChat`
- `NarreMentionInput`
- `NarreToolLog`

Session storage:

- `%APPDATA%/netior/data/narre/{projectId}/sessions.json`
- `%APPDATA%/netior/data/narre/{projectId}/session_{uuid}.json`

Process management:

- `narre-server-manager.ts` launches the packaged or dev Narre sidecar
- `desktop-app` forwards SSE output into renderer state

### Canvas Sidebar

The sidebar displays a hierarchy tree. `getCanvasTree` is computed server-side from `canvas_nodes`.

- Root canvas (`concept_id = null`)
- Concept group headers
- Recursive hierarchy support
- Context actions such as open in editor and delete

### Path Aliases

- `@main` -> `src/main`
- `@renderer` -> `src/renderer`
- `@shared` -> `src/shared`
- `@netior/core` -> `../netior-core/src`
- `@netior/shared` -> `../shared/src`

### netior-mcp

Example Codex registration:

```jsonc
{
  "mcpServers": {
    "moc": {
      "command": "node",
      "args": ["packages/netior-mcp/dist/index.cjs"],
      "env": {
        "NETIOR_SERVICE_URL": "http://127.0.0.1:3201"
      }
    }
  }
}
```

## Key Constraints

- **better-sqlite3 ownership** — the native binding belongs to `netior-service`. In development you may need `pnpm run rebuild:native` for the current Node runtime.
- **Build order** — `@netior/shared` -> `@netior/core` -> `@netior/service`, `@netior/mcp`, `@netior/narre-server`, `@netior/desktop-app`.
- **DB concurrency** — SQLite runs in WAL mode with `busy_timeout(5000)`. `desktop-app` does not open the DB directly.
- **Desktop packaging** — production should prefer bundled sidecars instead of deep workspace or pnpm-linked runtime trees.
- **Installer upgrades** — keep `packages/desktop-app/build/installer.nsh` aligned with packaging changes; if payload layout changes, verify upgrade and uninstall behavior explicitly.
- **UI components stay in desktop-app** — `shared` should stay limited to pure types, constants, and i18n.
- **Context menu pattern** — prefer `onMouseDown={e => e.stopPropagation()}` over document-level close listeners when appropriate.
- **Migration rule** — never edit an already-applied migration in place; add a new migration file.

## Testing

Vitest v2 with Vite 5 compatibility.

Typical test split:

- `shared`
  - constants
  - i18n
- `netior-core`
  - repositories
  - migrations
  - cascade and constraint behavior
- `desktop-app`
  - renderer stores and UI behavior

`netior-core` tests use in-memory SQLite via `test-db.ts`, with `getDatabase()` mocked where appropriate.

## UI Development

### Semantic Tokens Only

Do not hardcode color utility classes. Use semantic tokens:

- Surface: `surface-base`, `surface-panel`, `surface-card`, `surface-hover`, `surface-modal`
- Text: `text-default`, `text-secondary`, `text-muted`, `text-on-accent`
- Border: `border-subtle`, `border-default`, `border-strong`
- Accent: `accent`, `accent-hover`, `accent-muted`

### Available UI Components

Under `src/renderer/components/ui/`:

- Button
- IconButton
- Input
- NumberInput
- TextArea
- Select
- Checkbox
- Toggle
- Modal
- ConfirmDialog
- Toast
- Tooltip
- Badge
- Divider
- Spinner
- ScrollArea

### Theme System

Three-tier theme system:

- `data-concept`
- `data-mode`
- Tailwind semantic tokens
