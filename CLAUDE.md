# CLAUDE.md

## What is MoC

MoC (Map of Concepts)는 캔버스 기반 개념 정리 데스크탑 앱이다. 캔버스 위에 개념(Concept)을 노드로 배치하고, 노드 간 연결로 관계를 표현한다. 인스턴스 데이터는 파일(.md, .pdf 등)로 관리한다.

Culturium의 후속 프로젝트. 오픈소스화를 막던 세 가지 문제(백엔드 종속, SQLite 데이터 격리, culture.json 복잡도)를 해결한 구조.

## Commands

```bash
# Development
pnpm dev:desktop          # Electron 앱 실행 (electron-vite dev)

# Build
pnpm build                # 전체 빌드 (turbo)
pnpm --filter @moc/shared build    # shared만 빌드 (tsup)

# Test
pnpm test                 # 전체 테스트 (turbo → vitest)
pnpm --filter @moc/shared test
pnpm --filter @moc/desktop-app test

# Typecheck
pnpm typecheck
```

## Architecture

### Monorepo (pnpm workspaces + turbo)

- **`packages/shared`** (`@moc/shared`) — 타입, 상수, i18n. tsup (ESM+CJS). Sub-path: `/types`, `/constants`, `/i18n`.
- **`packages/desktop-app`** (`@moc/desktop-app`) — Electron 앱. electron-vite. Output: `out/`.

`packages/agent-server`는 향후 MCP 서버용 (MVP 이후).

### Desktop App Layers

```
main process          →  preload bridge       →  renderer (React)
─────────────────     ─────────────────────    ────────────────────
db/connection.ts      preload/index.ts         services/*.ts
db/repositories/*.ts  (contextBridge exposes   stores/*.ts (Zustand)
db/migrations/*.ts     window.electron API)    components/**/*.tsx
ipc/*.ts                                       hooks/
```

**Data flow**: Renderer services → `window.electron.*` → preload `ipcRenderer.invoke` → main IPC handlers → repositories → better-sqlite3.

**IPC pattern**: 모든 응답은 `IpcResult<T>` (`{ success: true, data } | { success: false, error }`). 채널 상수: `@moc/shared/constants` (`IPC_CHANNELS`).

### Two Storage Layers

| Layer | Location | Contents |
|-------|----------|----------|
| Metadata | `%APPDATA%/moc/data/moc.db` (SQLite) | projects, concepts, canvases, nodes, edges, concept_files, relation_types, canvas_types 등 |
| Instance Data | User's project directory | .md, .pdf, .png 등 실제 파일 |

앱은 프로젝트 디렉토리에 메타데이터를 쓰지 않는다. 캔버스가 구조를 담당하고, 파일시스템은 순수 저장소.

### Data Model

- **Project** — 사용자 디렉토리 참조 (name, root_dir)
- **Concept** — 프로젝트 종속. title, color, icon, archetype_id
- **Canvas** — Concept:Canvas = 1:N. concept_id(nullable), canvas_type_id(nullable), viewport 상태 저장
- **CanvasNode** — 캔버스 위 배치. concept_id | file_path | dir_path 중 하나 (polymorphic)
- **Edge** — 캔버스 종속 연결. relation_type_id, description, color/line_style/directed (개별 override 가능)
- **ConceptFile** — 개념 ↔ 파일 연결. file_path는 프로젝트 root_dir 기준 상대경로

### Type System (프로젝트 레벨)

- **Archetype** — Concept의 클래스 (name, icon, color, node_shape, file_template, fields)
- **RelationType** — Edge의 클래스 (name, description, color, line_style, directed)
- **CanvasType** — Canvas의 클래스 (name, description, icon, color, allowed_relation_types via junction table)

새 타입 추가 시 7-layer 패턴: migration → types → constants → repository → IPC → preload → renderer (service, store, UI).

### Canvas Engine

외부 캔버스 라이브러리 없음. CSS transform + SVG로 직접 구현.
- Pan/Zoom: ConceptWorkspace에서 직접 처리 (wheel → zoom-toward-cursor, drag → pan)
- Ctrl+wheel: 캔버스 계층 이동 (up=drillInto, down=navigateBack)
- Node rendering: NodeCardDefault + shape layouts (8종)
- Edge rendering: EdgeLayer + EdgeLine (SVG). color, line_style(solid/dashed/dotted), directed(arrow) 지원
- Background: dot grid (SVG pattern)
- Interaction modes: browse (default) / edit (노드 연결 생성, 엣지 삭제 등)

### Edge Interaction

- **생성**: edit mode → 노드 우클릭 → "연결 추가" → linking mode → 타겟 노드 클릭 → EdgeEditor 탭 열림
- **편집**: 엣지 더블클릭 → EdgeEditor (relation type, description, visual override)
- **삭제**: edit mode → 엣지 우클릭 → EdgeContextMenu → 삭제
- **Visual override**: Edge 개별 color/line_style/directed 설정 가능. null이면 RelationType 기본값 사용

### Editor System

EditorTabType: `'concept' | 'file' | 'archetype' | 'terminal' | 'edge' | 'relationType' | 'canvasType' | 'canvas'`

확장자 기반 에디터 자동 선택:
- `.md` → MarkdownEditor
- `.txt`, `.json`, `.yaml` 등 → PlainTextEditor
- `.png`, `.jpg` 등 → ImageViewer
- `.pdf` → PdfViewer (미구현)
- 기타 → UnsupportedFallback ("외부 앱으로 열기")

### Canvas Sidebar

계층 트리 표시. `getCanvasTree` API가 canvas_nodes 데이터 기반으로 서버사이드 계산.
- 루트 캔버스 (concept_id null)
- Concept 그룹 헤더 (해당 concept의 하위 캔버스 묶음)
- 재귀적 계층 지원
- 우클릭 → "에디터에서 열기" / "삭제"

### Path Aliases (electron-vite)

- `@main` → `src/main`
- `@renderer` → `src/renderer`
- `@shared` → `src/shared`

## Key Constraints

- **better-sqlite3 requires electron-rebuild** — Electron 버전 변경 시 필수. 테스트(Node.js)와 앱(Electron)에서 서로 다른 네이티브 빌드 필요.
- **Build order**: `@moc/shared`가 `@moc/desktop-app`보다 먼저 빌드 (turbo `dependsOn: ["^build"]`).
- **UI 컴포넌트는 desktop-app 내부** — shared는 순수 타입/상수만.
- **Context menu 패턴**: document mousedown listener 대신 `onMouseDown={e => e.stopPropagation()}` 사용. 부모의 mousedown에서 메뉴 닫기.
- **Migration 주의**: 이미 적용된 migration 파일 수정 시 새 migration 파일 추가 필요 (기존 DB에 반영 안 됨).

## Testing

Vitest v2 (Vite 5 호환).

```
pnpm test → 72 tests

shared (13)
├── constants: IPC 채널, 기본값
└── i18n: translate 함수, 키 검증

desktop-app main (51)
├── Project: CRUD, unique, cascade
├── Concept: CRUD, search, cascade
├── Canvas: CRUD, viewport, nodes, edges, 1:N, canvas_count, ancestors
├── ConceptFile: CRUD, unique, cascade
├── Module: CRUD, directories, cascade
├── EditorPrefs: upsert, cascade
├── RelationType: CRUD, cascade, boolean conversion, defaults
├── CanvasType: CRUD, junction (allowed relations), cascade
├── CanvasNode expansion: file_path, dir_path, validation
└── Edge expansion: relation_type_id, get, update, SET NULL cascade

desktop-app renderer (8)
├── ProjectStore: load, create, open/close
├── ConceptStore: load
└── UIStore: mode, sidebar, editor dock
```

main process 테스트는 인메모리 SQLite 사용 (`test-db.ts`). `getDatabase()`를 mock.

## UI Development

### Semantic Tokens Only

하드코딩 색상 클래스 금지. semantic token만 사용:
- Surface: `surface-base`, `surface-panel`, `surface-card`, `surface-hover`, `surface-modal`
- Text: `text-default`, `text-secondary`, `text-muted`, `text-on-accent`
- Border: `border-subtle`, `border-default`, `border-strong`
- Accent: `accent`, `accent-hover`, `accent-muted`

### Available UI Components (16)

`src/renderer/components/ui/`: Button, IconButton, Input, NumberInput, TextArea, Select, Checkbox, Toggle, Modal, ConfirmDialog, Toast, Tooltip, Badge, Divider, Spinner, ScrollArea.

### Theme System

3-tier: `data-concept` (12종: forest, neon, graphite...) → `data-mode` (dark/light) → Tailwind semantic tokens.
