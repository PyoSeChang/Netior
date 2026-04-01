# CLAUDE.md

## What is Netior

Netior (Map of Concepts)는 캔버스 기반 개념 정리 데스크탑 앱이다. 캔버스 위에 개념(Concept)을 노드로 배치하고, 노드 간 연결로 관계를 표현한다. 인스턴스 데이터는 파일(.md, .pdf 등)로 관리한다.

Culturium의 후속 프로젝트. 오픈소스화를 막던 세 가지 문제(백엔드 종속, SQLite 데이터 격리, culture.json 복잡도)를 해결한 구조.

## Commands

```bash
# Development
pnpm dev:desktop          # Electron 앱 실행 (electron-vite dev)

# Build
pnpm build                # 전체 빌드 (turbo)
pnpm --filter @netior/shared build    # shared만 빌드 (tsup)
pnpm --filter @netior/core build      # core만 빌드 (tsup)
pnpm --filter @netior/mcp build       # netior-mcp만 빌드 (tsup)
pnpm --filter @netior/agent-server build  # agent-server만 빌드 (tsup)

# Test
pnpm test                 # 전체 테스트 (turbo → vitest)
pnpm --filter @netior/shared test
pnpm --filter @netior/core test        # repository 테스트 (64개)
pnpm --filter @netior/desktop-app test

# Typecheck
pnpm typecheck
```

## Architecture

### Monorepo (pnpm workspaces + turbo)

- **`packages/shared`** (`@netior/shared`) — 타입, 상수, i18n. tsup (ESM+CJS). Sub-path: `/types`, `/constants`, `/i18n`.
- **`packages/netior-core`** (`@netior/core`) — DB 로직 (connection, repositories, migrations). tsup (ESM+CJS). desktop-app과 netior-mcp가 공유.
- **`packages/netior-mcp`** (`@netior/mcp`) — MCP 서버. moc-core를 17개 도구로 래핑. stdio transport (Claude Code 등록 가능).
- **`packages/agent-server`** (`@netior/agent-server`) — Narre AI 에이전트. Claude Agent SDK + Express. SSE 스트리밍. 세션 관리. DB 직접 접근 없음 (netior-mcp 경유).
- **`packages/desktop-app`** (`@netior/desktop-app`) — Electron 앱. electron-vite. Output: `out/`.

### Desktop App Layers

```
main process          →  preload bridge       →  renderer (React)
─────────────────     ─────────────────────    ────────────────────
@netior/core (DB)        preload/index.ts         services/*.ts
ipc/*.ts              (contextBridge exposes   stores/*.ts (Zustand)
process/*.ts           window.electron API)    components/**/*.tsx
                                               hooks/
```

**Data flow**: Renderer services → `window.electron.*` → preload `ipcRenderer.invoke` → main IPC handlers → `@netior/core` repositories → better-sqlite3.

**IPC pattern**: 모든 응답은 `IpcResult<T>` (`{ success: true, data } | { success: false, error }`). 채널 상수: `@netior/shared/constants` (`IPC_CHANNELS`).

### Two Storage Layers

| Layer | Location | Contents |
|-------|----------|----------|
| Metadata | `%APPDATA%/netior/data/netior.db` (SQLite) | projects, concepts, canvases, nodes, edges, concept_files, relation_types, canvas_types 등 |
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

EditorTabType: `'concept' | 'file' | 'archetype' | 'terminal' | 'edge' | 'relationType' | 'canvasType' | 'canvas' | 'narre'`

확장자 기반 에디터 자동 선택:
- `.md` → MarkdownEditor
- `.txt`, `.json`, `.yaml` 등 → PlainTextEditor
- `.png`, `.jpg` 등 → ImageViewer
- `.pdf` → PdfViewer
- 기타 → UnsupportedFallback ("외부 앱으로 열기")

### Narre (AI Assistant)

EditorTabType `'narre'`. ActivityBar의 Sparkles 아이콘으로 열기. 프로젝트당 하나의 탭.

**아키텍처:**
```
desktop-app (Renderer)     desktop-app (Main)      agent-server (별도 프로세스)
NarreChat.tsx         →IPC→ narre-ipc.ts      →HTTP→ Express :3100
  SSE stream events   ←IPC← (forward SSE)     ←SSE←  Claude Agent SDK query()
                                                         │
                                                    netior-mcp (stdio MCP 서버)
                                                         │
                                                    @netior/core → netior.db
```

**데이터 흐름:**
- agent-server는 DB에 직접 접근하지 않음. 모든 DB 작업은 netior-mcp 경유.
- 시스템 프롬프트용 메타데이터(아크타입, 릴레이션타입 등)는 desktop-app Main이 DB에서 조회 → `/chat` body로 전달.
- better-sqlite3 네이티브 모듈은 Electron(desktop-app)과 Node.js(netior-mcp)가 별도 프로세스로 사용. agent-server는 네이티브 모듈 없음.

**핵심 컴포넌트:**
- `NarreEditor` → `NarreSessionList` / `NarreChat` 전환
- `NarreChat` — 메시지 렌더링, SSE 스트리밍, 도구 실행 로그
- `NarreMentionInput` — ContentEditable, `@` 트리거 멘션 피커
- `NarreToolLog` — 접을 수 있는 도구 실행 상태 표시

**세션 저장:** `%APPDATA%/netior/data/narre/{projectId}/sessions.json` + `session_{uuid}.json`

**프로세스 관리:** `agent-server-manager.ts`가 앱 시작 시 agent-server를 child process로 spawn. API 키가 설정 되어 있을 때만.

**DB 동기화:** 도구 실행(create/update/delete) 후 `refreshStores()` 호출 → Zustand 스토어 refetch. 향후 netior-mcp SSE로 전환 예정.

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
- `@netior/core` → `../moc-core/src` (번들에 포함, externalize 제외)
- `@netior/shared` → `../shared/src`

### netior-mcp (MCP Server)

Claude Code 등록:
```jsonc
// .claude/settings.json
{ "mcpServers": { "moc": { "command": "node", "args": ["packages/netior-mcp/dist/index.js"], "env": { "MOC_DB_PATH": "%APPDATA%/netior/data/netior.db" } } } }
```

17개 도구: archetype(4) + relationType(4) + canvasType(4) + concept(4) + project_summary(1).

## Key Constraints

- **better-sqlite3 requires electron-rebuild** — Electron 버전 변경 시 필수. 테스트(Node.js)와 앱(Electron)에서 서로 다른 네이티브 빌드 필요. moc-core 테스트도 pretest에서 rebuild.
- **Build order**: `@netior/shared` → `@netior/core` → `@netior/mcp`, `@netior/agent-server`, `@netior/desktop-app` (turbo `dependsOn: ["^build"]`).
- **DB 동시 접근**: WAL 모드 + `busy_timeout(5000)`. desktop-app은 moc-core를 in-process로, netior-mcp/agent-server는 별도 프로세스로 같은 DB 파일 접근.
- **UI 컴포넌트는 desktop-app 내부** — shared는 순수 타입/상수만.
- **Context menu 패턴**: document mousedown listener 대신 `onMouseDown={e => e.stopPropagation()}` 사용. 부모의 mousedown에서 메뉴 닫기.
- **Migration 주의**: 이미 적용된 migration 파일 수정 시 새 migration 파일 추가 필요 (기존 DB에 반영 안 됨).

## Testing

Vitest v2 (Vite 5 호환).

```
pnpm test → 85 tests

shared (13)
├── constants: IPC 채널, 기본값
└── i18n: translate 함수, 키 검증

moc-core (64)
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

moc-core 테스트는 인메모리 SQLite 사용 (`test-db.ts`). `getDatabase()`를 mock.

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
