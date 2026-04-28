# Next Phase 구현 계획

설계 결정은 `next-phase-design-decisions.md`에 기록되어 있다.
이 문서는 코드 변경만 다룬다.

작성일: 2026-04-07

---

## Phase 1: Canvas → Network 리네이밍 + CanvasType 삭제

동작 변경 없음. 기계적 변환 + 삭제.

### WP-1A: shared 패키지

#### types/index.ts — 리네이밍

| 라인 | Before | After |
|------|--------|-------|
| 55~91 | `Canvas`, `CanvasCreate`, `CanvasUpdate` | `Network`, `NetworkCreate`, `NetworkUpdate` |
| 58 | `canvas_type_id: string \| null` | (필드 삭제) |
| 61 | `concept_id: string \| null` | (유지 — Phase 2에서 제거) |
| 78 | `canvas_type_id?: string` | (필드 삭제) |
| 83 | `canvas_type_id?: string \| null` | (필드 삭제) |
| 136~169 | `CanvasNode`, `CanvasNodeCreate`, `CanvasNodeUpdate` | `NetworkNode`, `NetworkNodeCreate`, `NetworkNodeUpdate` |
| 140 | `canvas_id: string` | `network_id: string` |
| 152 | `canvas_id: string` | `network_id: string` |
| 175 | `canvas_id: string` | `network_id: string` |
| 188 | `canvas_id: string` | `network_id: string` |
| 446~460 | `CanvasTreeNode`, `CanvasBreadcrumbItem` | `NetworkTreeNode`, `NetworkBreadcrumbItem` |
| 447 | `canvas: Canvas` | `network: Network` |
| 457 | `canvasId: string` | `networkId: string` |
| 458 | `canvasName: string` | `networkName: string` |

#### types/index.ts — CanvasType 삭제

| 라인 | 삭제 대상 |
|------|-----------|
| 406~440 | `CanvasType`, `CanvasTypeCreate`, `CanvasTypeUpdate`, `CanvasTypeAllowedRelation` 인터페이스 전체 |

#### types/index.ts — EditorTabType

```
// Before (L467)
export type EditorTabType = 'concept' | 'file' | 'schema' | 'terminal' | 'edge' | 'relationType' | 'canvasType' | 'canvas' | 'narre' | 'fileMetadata';

// After
export type EditorTabType = 'concept' | 'file' | 'schema' | 'terminal' | 'edge' | 'relationType' | 'network' | 'narre' | 'fileMetadata';
```

#### types/index.ts — NarreMention.type

```
// Before (L577)
type: 'concept' | 'canvas' | 'edge' | 'schema' | 'relationType' | 'canvasType' | 'module' | 'file';

// After
type: 'concept' | 'network' | 'edge' | 'schema' | 'relationType' | 'module' | 'file';
```

#### types/index.ts — NetiorChangeEvent.type

```
// Before (L677)
type: 'schemas' | 'concepts' | 'relationTypes' | 'canvasTypes' | 'canvases' | 'edges';

// After
type: 'schemas' | 'concepts' | 'relationTypes' | 'networks' | 'edges';
```

#### types/index.ts — EditorTab 필드

| 라인 | Before | After |
|------|--------|-------|
| 521 | `canvasId?: string` | `networkId?: string` |
| 526 | `canvasId?: string` | `networkId?: string` |

#### constants/index.ts — IPC_CHANNELS

```typescript
// 리네이밍 (L40~53)
CANVAS_CREATE → NETWORK_CREATE         // 'canvas:create' → 'network:create'
CANVAS_LIST → NETWORK_LIST             // 'canvas:list' → 'network:list'
CANVAS_UPDATE → NETWORK_UPDATE         // 'canvas:update' → 'network:update'
CANVAS_DELETE → NETWORK_DELETE         // 'canvas:delete' → 'network:delete'
CANVAS_GET_FULL → NETWORK_GET_FULL     // 'canvas:getFull' → 'network:getFull'
CANVAS_GET_BY_CONCEPT → NETWORK_GET_BY_CONCEPT  // 'canvas:getByConcept' → 'network:getByConcept'
                                       // ↑ Phase 2에서 삭제
CANVAS_GET_TREE → NETWORK_GET_TREE     // 'canvas:getTree' → 'network:getTree'
CANVAS_GET_ANCESTORS → NETWORK_GET_ANCESTORS  // 'canvas:getAncestors' → 'network:getAncestors'

CANVAS_NODE_ADD → NETWORK_NODE_ADD     // 'canvasNode:add' → 'networkNode:add'
CANVAS_NODE_UPDATE → NETWORK_NODE_UPDATE  // 'canvasNode:update' → 'networkNode:update'
CANVAS_NODE_REMOVE → NETWORK_NODE_REMOVE  // 'canvasNode:remove' → 'networkNode:remove'

// 삭제 (L102~110) — CanvasType 채널 8개 전부
CANVAS_TYPE_CREATE, CANVAS_TYPE_LIST, CANVAS_TYPE_GET,
CANVAS_TYPE_UPDATE, CANVAS_TYPE_DELETE,
CANVAS_TYPE_ADD_RELATION, CANVAS_TYPE_REMOVE_RELATION, CANVAS_TYPE_LIST_RELATIONS
```

#### constants/index.ts — DEFAULTS

```typescript
// Before (L168~173)
CANVAS_ZOOM: 1.0, CANVAS_PAN_X: 0, CANVAS_PAN_Y: 0

// After
NETWORK_ZOOM: 1.0, NETWORK_PAN_X: 0, NETWORK_PAN_Y: 0
```

#### i18n — ko.json, en.json

| 변경 | 상세 |
|------|------|
| `canvas.*` 네임스페이스 (19키) | → `network.*` (키명, 값 모두 변경) |
| `canvasType.*` 네임스페이스 (8키) | → 삭제 |
| `sidebar.canvases` | → `sidebar.networks` |
| `narre.mentionCanvas` | → `narre.mentionNetwork` |
| `narre.mentionCanvasType` | → 삭제 |
| `narre.mentionPlaceholder` | 텍스트 내 "canvases" → "networks" |
| `fileMetadata.canvasContext` | → `fileMetadata.networkContext` |
| `fileMetadata.nodeDescriptionPlaceholder` | 텍스트 내 "canvas" → "network" |
| `shortcuts.sections.canvas` | → `shortcuts.sections.network` |
| `shortcuts.items.canvas.*` (5키) | → `shortcuts.items.network.*` |

빌드: `pnpm --filter @netior/shared build`

---

### WP-1B: core 패키지

#### Migration 010-canvas-to-network.ts

```sql
-- 테이블 리네이밍
ALTER TABLE canvases RENAME TO networks;
ALTER TABLE canvas_nodes RENAME TO network_nodes;

-- CanvasType 삭제
DROP TABLE IF EXISTS canvas_type_allowed_relations;
DROP TABLE IF EXISTS canvas_types;

-- FK 컬럼 리네이밍 (SQLite 3.45.3 → ALTER COLUMN RENAME 지원)
ALTER TABLE edges RENAME COLUMN canvas_id TO network_id;
ALTER TABLE network_nodes RENAME COLUMN canvas_id TO network_id;

-- canvas_type_id 제거 (SQLite 3.45.3 → DROP COLUMN 지원)
ALTER TABLE networks DROP COLUMN canvas_type_id;

-- 인덱스 재생성 (기존 인덱스명이 canvas 포함이면)
-- 기존: idx_canvas_nodes_concept → idx_network_nodes_concept
DROP INDEX IF EXISTS idx_canvas_nodes_concept;
CREATE UNIQUE INDEX idx_network_nodes_concept
  ON network_nodes(network_id, concept_id) WHERE concept_id IS NOT NULL;
```

connection.ts — migration 배열에 `010` 등록

#### repositories/canvas.ts → repositories/network.ts

파일명 변경 + 내부 전체 치환:

| Before | After |
|--------|-------|
| `CanvasRow` (interface) | `NetworkRow` |
| `CanvasNodeRow` (interface) | `NetworkNodeRow` |
| `toCanvas(row)` | `toNetwork(row)` |
| `toCanvasNode(row)` | `toNetworkNode(row)` |
| `createCanvas(data)` | `createNetwork(data)` |
| `listCanvases(projectId, rootOnly?)` | `listNetworks(projectId, rootOnly?)` |
| `updateCanvas(id, data)` | `updateNetwork(id, data)` |
| `deleteCanvas(id)` | `deleteNetwork(id)` |
| `getCanvasFull(canvasId)` | `getNetworkFull(networkId)` |
| `getCanvasesByConceptId(conceptId)` | `getNetworksByConceptId(conceptId)` |
| `getCanvasTree(projectId)` | `getNetworkTree(projectId)` |
| `getCanvasAncestors(canvasId)` | `getNetworkAncestors(networkId)` |
| `CanvasFullData` (interface) | `NetworkFullData` |
| `CanvasTreeNode` (interface, 로컬) | `NetworkTreeNode` |
| `addCanvasNode(data)` | `addNetworkNode(data)` |
| `updateCanvasNode(id, data)` | `updateNetworkNode(id, data)` |
| `removeCanvasNode(id)` | `removeNetworkNode(id)` |
| SQL 내 `canvases` | `networks` |
| SQL 내 `canvas_id` | `network_id` |
| SQL 내 `canvas_nodes` | `network_nodes` |
| SQL 내 `canvas_type_id` | (참조 제거) |

`createEdge`, `getEdge`, `updateEdge`, `deleteEdge`는 함수명 유지, SQL 내 `canvas_id` → `network_id`만 변경.

#### repositories/canvas-type.ts — 삭제

파일 전체 삭제. 함수 7개:
`createCanvasType`, `listCanvasTypes`, `getCanvasType`, `updateCanvasType`, `deleteCanvasType`, `addAllowedRelation`, `removeAllowedRelation`, `removeAllowedRelationByPair`, `listAllowedRelations`

#### index.ts — export 변경

```typescript
// Before
export * from './repositories/canvas.js';
export * from './repositories/canvas-type.js';

// After
export * from './repositories/network.js';
// canvas-type export 삭제
```

#### 테스트 — repositories.test.ts

| Before | After |
|--------|-------|
| `describe('Canvas', ...)` | `describe('Network', ...)` |
| `describe('Hierarchical Canvas', ...)` | `describe('Hierarchical Network', ...)` |
| `createCanvas`, `listCanvases` 등 호출 | `createNetwork`, `listNetworks` 등 |
| `canvas_id`, `canvasId` 변수명 | `network_id`, `networkId` |
| CanvasType 관련 테스트 블록 | 삭제 |

검증: `pnpm --filter @netior/core build && pnpm --filter @netior/core test`

---

### WP-1C: desktop-app/main (IPC)

#### ipc/canvas-ipc.ts → ipc/network-ipc.ts

파일명 변경 + 내부:

| Before | After |
|--------|-------|
| `registerCanvasIpc()` | `registerNetworkIpc()` |
| 채널 `'canvas:create'` | `'network:create'` |
| 채널 `'canvas:list'` | `'network:list'` |
| 채널 `'canvas:update'` | `'network:update'` |
| 채널 `'canvas:delete'` | `'network:delete'` |
| 채널 `'canvas:getFull'` | `'network:getFull'` |
| 채널 `'canvas:getByConcept'` | `'network:getByConcept'` |
| 채널 `'canvas:getTree'` | `'network:getTree'` |
| 채널 `'canvas:getAncestors'` | `'network:getAncestors'` |
| 채널 `'canvasNode:add'` | `'networkNode:add'` |
| 채널 `'canvasNode:update'` | `'networkNode:update'` |
| 채널 `'canvasNode:remove'` | `'networkNode:remove'` |
| core import: `createCanvas` 등 | `createNetwork` 등 |
| `broadcastChange({ type: 'canvases' })` | `broadcastChange({ type: 'networks' })` |

#### ipc/canvas-type-ipc.ts — 삭제

파일 전체 삭제. `registerCanvasTypeIpc()` 제거.

#### ipc/index.ts

```typescript
// Before (L33)
import { registerCanvasIpc } from './canvas-ipc';
import { registerCanvasTypeIpc } from './canvas-type-ipc';
// register 호출: registerCanvasIpc(db); registerCanvasTypeIpc(db);

// After
import { registerNetworkIpc } from './network-ipc';
// registerCanvasTypeIpc 삭제
// register 호출: registerNetworkIpc(db);
```

---

### WP-1D: desktop-app/preload

#### preload/index.ts

| Before | After |
|--------|-------|
| `canvas:` 네임스페이스 (8 메서드) | `network:` (채널 문자열 + 네임스페이스명 변경) |
| `canvasNode:` 네임스페이스 (3 메서드) | `networkNode:` |
| `canvasType:` 네임스페이스 (8 메서드) | 삭제 |
| `electronAPI` 내 `canvas` 객체 | `network` 객체 |
| `electronAPI` 내 `canvasNode` 객체 | `networkNode` 객체 |
| `electronAPI` 내 `canvasType` 객체 | 삭제 |
| `ElectronAPI` 타입에서 동일 변경 | |

---

### WP-1E: desktop-app/renderer (services + stores)

#### services/canvas-service.ts → services/network-service.ts

파일명 변경 + 내부:

| Before | After |
|--------|-------|
| `CanvasFullData` (interface) | `NetworkFullData` |
| `createCanvas(data)` | `createNetwork(data)` |
| `listCanvases(projectId, rootOnly?)` | `listNetworks(projectId, rootOnly?)` |
| `updateCanvas(id, data)` | `updateNetwork(id, data)` |
| `deleteCanvas(id)` | `deleteNetwork(id)` |
| `getCanvasFull(canvasId)` | `getNetworkFull(networkId)` |
| `getCanvasesByConcept(conceptId)` | `getNetworksByConcept(conceptId)` |
| `getCanvasAncestors(canvasId)` | `getNetworkAncestors(networkId)` |
| `getCanvasTree(projectId)` | `getNetworkTree(projectId)` |
| `addCanvasNode(data)` | `addNetworkNode(data)` |
| `updateCanvasNode(id, data)` | `updateNetworkNode(id, data)` |
| `removeCanvasNode(id)` | `removeNetworkNode(id)` |
| `window.electron.canvas.*` | `window.electron.network.*` |
| `window.electron.canvasNode.*` | `window.electron.networkNode.*` |

#### services/canvas-type-service.ts — 삭제

파일 전체 삭제.

#### services/index.ts

```
canvasService export → networkService export
canvasTypeService export → 삭제
```

#### stores/canvas-store.ts → stores/network-store.ts

파일명 변경 + 내부:

| Before | After |
|--------|-------|
| `CanvasNodeWithConcept` (type) | `NetworkNodeWithConcept` |
| `EdgeWithRelationType` (type) | `EdgeWithRelationType` (변경 없음) |
| `CanvasStore` (interface) | `NetworkStore` |
| State: `canvases` | `networks` |
| State: `currentCanvasId` | `currentNetworkId` |
| State: `currentCanvasData` | `currentNetworkData` |
| State: `canvasTree` | `networkTree` |
| State: `breadcrumb` | `breadcrumb` (변경 없음) |
| Actions: `loadCanvases()` | `loadNetworks()` |
| Actions: `openCanvas(id)` | `openNetwork(id)` |
| Actions: `navigateBack()` | (변경 없음) |
| Actions: `navigateForward()` | (변경 없음) |
| `useCanvasStore` | `useNetworkStore` |
| 내부에서 `canvasService.*` 호출 | `networkService.*` 호출 |

#### stores/canvas-type-store.ts — 삭제

파일 전체 삭제. `useCanvasTypeStore` 제거.

#### stores/editor-store.ts

| Before | After |
|--------|-------|
| `tab.type === 'canvas'` 분기 | `tab.type === 'network'` |
| `tab.type === 'canvasType'` 분기 | 삭제 |
| `tab.canvasId` 참조 | `tab.networkId` |
| `draftData.canvasId` | `draftData.networkId` |

#### stores/project-state-cache.ts

```
import { useCanvasStore } from './canvas-store'     → import { useNetworkStore } from './network-store'
import { useCanvasTypeStore } from './canvas-type-store'  → 삭제
CanvasNodeWithConcept import                        → NetworkNodeWithConcept
EdgeWithRelationType import 경로 변경
canvasTypeStore 관련 cache/restore 로직             → 삭제
canvasStore 관련 참조                               → networkStore
```

#### 17개 consumer 파일 import 변경

`useCanvasStore` → `useNetworkStore` (17파일):
```
App.tsx
hooks/useNetiorSync.ts
lib/editor-state-bridge.ts
stores/project-state-cache.ts
components/editor/CanvasEditor.tsx
components/editor/ConceptEditor.tsx
components/editor/EdgeEditor.tsx
components/editor/FileMetadataEditor.tsx
components/editor/narre/NarreChat.tsx
components/workspace/ConceptWorkspace.tsx
components/workspace/CanvasContextMenu.tsx
components/workspace/CanvasBreadcrumb.tsx
components/workspace/NodeContextMenu.tsx
components/workspace/NodeCanvasOverlay.tsx
components/workspace/EdgeContextMenu.tsx
components/sidebar/CanvasList.tsx
components/sidebar/Sidebar.tsx
```

`useCanvasTypeStore` → 삭제 (9파일):
```
hooks/useNetiorSync.ts          — canvasType 변경 감지 로직 삭제
lib/editor-state-bridge.ts      — canvasType 상태 복원 로직 삭제
stores/project-state-cache.ts   — canvasType cache 삭제
components/editor/CanvasEditor.tsx    — canvasType 드롭다운 삭제
components/editor/CanvasTypeEditor.tsx — 파일 삭제
components/editor/narre/NarreChat.tsx — canvasType 멘션 로직 삭제
components/sidebar/CanvasList.tsx     — canvasType 선택 로직 삭제
components/sidebar/CanvasTypeList.tsx — 파일 삭제
components/sidebar/Sidebar.tsx       — canvasType 탭/섹션 삭제
```

---

### WP-1F: desktop-app/renderer (components)

#### 파일 리네이밍

| Before | After |
|--------|-------|
| `workspace/ConceptWorkspace.tsx` | `workspace/NetworkWorkspace.tsx` |
| `workspace/CanvasControls.tsx` | `workspace/NetworkControls.tsx` |
| `workspace/CanvasBreadcrumb.tsx` | `workspace/NetworkBreadcrumb.tsx` |
| `workspace/CanvasContextMenu.tsx` | `workspace/NetworkContextMenu.tsx` |
| `workspace/NodeCanvasOverlay.tsx` | `workspace/NodeNetworkOverlay.tsx` |
| `workspace/useCanvasShortcuts.ts` | `workspace/useNetworkShortcuts.ts` |
| `sidebar/CanvasList.tsx` | `sidebar/NetworkList.tsx` |
| `editor/CanvasEditor.tsx` | `editor/NetworkEditor.tsx` |

#### 파일 삭제

| 삭제 대상 |
|-----------|
| `sidebar/CanvasTypeList.tsx` (101줄) |
| `editor/CanvasTypeEditor.tsx` (153줄) |
| `canvas/CanvasControls.tsx` (147줄, 레거시) |
| `canvas/Canvas.tsx` (233줄, 레거시) |

#### EditorContent.tsx (85줄)

```typescript
// Before — switch case
case 'canvasType': return <CanvasTypeEditor tab={tab} />;
case 'canvas': return <CanvasEditor tab={tab} />;

// After
case 'network': return <NetworkEditor tab={tab} />;
// canvasType case 삭제
```

import 변경: `CanvasTypeEditor` 삭제, `CanvasEditor` → `NetworkEditor`

#### 컴포넌트 내부 변경 (주요)

**NetworkWorkspace.tsx** (구 ConceptWorkspace, 820줄):
- `useCanvasStore` → `useNetworkStore`
- `currentCanvasData` → `currentNetworkData`
- `currentCanvasId` → `currentNetworkId`
- `openCanvas` → `openNetwork`
- `CanvasFullData` → `NetworkFullData`
- `CanvasNodeWithConcept` → `NetworkNodeWithConcept`
- `CanvasControls` → `NetworkControls`
- `CanvasBreadcrumb` → `NetworkBreadcrumb`
- `CanvasContextMenu` → `NetworkContextMenu`

**NetworkEditor.tsx** (구 CanvasEditor, 298줄):
- `useCanvasStore` → `useNetworkStore`
- `useCanvasTypeStore` → 삭제
- canvas type 드롭다운 → 삭제
- `canvas_type_id` 필드 → 삭제

**NetworkList.tsx** (구 CanvasList, 315줄):
- `useCanvasStore` → `useNetworkStore`
- `useCanvasTypeStore` → 삭제
- canvas type 선택 UI → 삭제
- `CanvasTreeNode` → `NetworkTreeNode`

**Sidebar.tsx**:
- `CanvasList` → `NetworkList`
- `CanvasTypeList` import/렌더링 → 삭제

#### 테스트 — stores.test.ts

- `canvasMode` 참조 → `networkMode` (또는 해당 state명에 맞게)
- `canvas`/`canvasNode` mock 데이터 변수명 변경

검증: `pnpm typecheck`

---

### WP-1G: MCP + Narre

#### netior-mcp

| 파일 | 변경 |
|------|------|
| `tools/canvas-type-tools.ts` | 파일 삭제 |
| `tools/index.ts` | `registerCanvasTypeTools` import/호출 삭제 |
| `tools/project-tools.ts` | `listCanvasTypes` 호출 → 삭제, `listCanvases` → `listNetworks`, 응답 내 canvas 관련 항목 → network |
| `tools/schema-tools.ts` | `node_shape` 설명 "canvas rendering" → "network rendering" |

#### narre-server

| 파일 | 변경 |
|------|------|
| `index.ts` | `buildMentionTag`: `'canvas'` → `'network'`, `'canvasType'` case → 삭제. `projectMetadata.canvasTypes` → 삭제 |
| `system-prompt.ts` | `SystemPromptParams.canvasTypes` → 삭제. `buildSystemPrompt()` 내 "Canvas Types" 섹션 → 삭제 |
| `prompts/onboarding.ts` | `canvasTypes` 참조 → 삭제. Stage 3 (Canvas Types 제안) → 삭제. `create_canvas_type` 도구 참조 → 삭제 |
| `ui-tools.ts` | `propose` 도구 설명 내 "canvas types" → 삭제 |

#### desktop-app/main narre 연동

narre-ipc.ts 또는 narre 관련 IPC에서 `projectMetadata.canvasTypes` 전달 부분 → 삭제

검증: `pnpm --filter @netior/mcp build && pnpm --filter @netior/narre-server build`

---

### Phase 1 실행 순서

```
WP-1A (shared)
  ↓ pnpm --filter @netior/shared build
WP-1B (core)
  ↓ pnpm --filter @netior/core build && test
WP-1C (IPC) + WP-1G (MCP/Narre)  ← 병렬
  ↓
WP-1D (preload)
  ↓
WP-1E (services/stores)
  ↓
WP-1F (components)
  ↓ pnpm typecheck && pnpm dev:desktop
```

---

## Phase 2: Network 구조 확장 + Layout 분리

### WP-2A: Migration 011 — networks 구조 + layouts 도입

```sql
-- networks 구조 확장
ALTER TABLE networks ADD COLUMN scope TEXT NOT NULL DEFAULT 'project';
ALTER TABLE networks ADD COLUMN parent_network_id TEXT REFERENCES networks(id) ON DELETE CASCADE;
ALTER TABLE networks DROP COLUMN concept_id;

-- networks에서 배치 정보 제거
ALTER TABLE networks DROP COLUMN viewport_x;
ALTER TABLE networks DROP COLUMN viewport_y;
ALTER TABLE networks DROP COLUMN viewport_zoom;
ALTER TABLE networks DROP COLUMN layout;
ALTER TABLE networks DROP COLUMN layout_config;

-- layouts 레이어 도입
CREATE TABLE layouts (
  id                TEXT PRIMARY KEY,
  layout_type       TEXT NOT NULL DEFAULT 'freeform',
  layout_config_json TEXT,
  viewport_json     TEXT,
  network_id        TEXT UNIQUE,
  context_id        TEXT UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
  CHECK ((network_id IS NOT NULL AND context_id IS NULL) OR (network_id IS NULL AND context_id IS NOT NULL))
);

CREATE TABLE layout_nodes (
  id            TEXT PRIMARY KEY,
  layout_id     TEXT NOT NULL,
  node_id       TEXT NOT NULL,
  position_json TEXT NOT NULL,
  FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES network_nodes(id) ON DELETE CASCADE,
  UNIQUE(layout_id, node_id)
);

CREATE TABLE layout_edges (
  id          TEXT PRIMARY KEY,
  layout_id   TEXT NOT NULL,
  edge_id     TEXT NOT NULL,
  visual_json TEXT NOT NULL,
  FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
  FOREIGN KEY (edge_id) REFERENCES edges(id) ON DELETE CASCADE,
  UNIQUE(layout_id, edge_id)
);

-- edges에서 시각 정보 제거
ALTER TABLE edges DROP COLUMN color;
ALTER TABLE edges DROP COLUMN line_style;
ALTER TABLE edges DROP COLUMN directed;
```

### WP-2B: App Root / Project Root 자동 생성

connection.ts 또는 별도 init 로직:
- DB 초기화 시 `networks`에 App Root 존재 여부 확인 → 없으면 생성 (`scope='app'`, `project_id=NULL`, `parent_network_id=NULL`)
- 프로젝트 생성 시(`createProject` 또는 project IPC) Project Root Network 자동 생성 (`scope='project'`, `parent_network_id=AppRoot.id`)
- Network 생성 시 자동으로 해당 network의 layout도 생성 (기본 layout_type='freeform')

### WP-2C: repository 변경

#### network.ts

| 기존 | 변경/추가 |
|------|-----------|
| `createNetwork(data)` | `data`에 `scope`, `parent_network_id` 추가. viewport/layout 필드 제거. 생성 시 layouts 레코드 자동 생성. |
| `listNetworks(projectId, rootOnly?)` | `rootOnly` 로직 변경: `concept_id IS NULL` → `parent_network_id = ProjectRoot.id` |
| `getNetworksByConceptId(conceptId)` | 삭제 |
| `getNetworkTree(projectId)` | 재작성: concept 기반 → `parent_network_id` 재귀 CTE |
| `getNetworkAncestors(networkId)` | 재작성: `parent_network_id` 체인 추적 |
| `getNetworkFull(networkId)` | `canvas_count` 제거. layout 정보를 layouts/layout_nodes/layout_edges JOIN으로 가져오기. |
| `updateNetwork(id, data)` | viewport/layout 관련 필드 제거 (layout repository로 이동) |
| 신규 | `getAppRootNetwork()` |
| 신규 | `getProjectRootNetwork(projectId)` |

#### layout.ts (신규)

```typescript
createLayout(networkId?, contextId?, layoutType?)
getLayoutByNetwork(networkId)
getLayoutByContext(contextId)
updateLayout(id, { layout_type?, layout_config_json?, viewport_json? })
deleteLayout(id)

// layout_nodes
setNodePosition(layoutId, nodeId, positionJson)
getNodePositions(layoutId) → { nodeId, positionJson }[]
removeNodePosition(layoutId, nodeId)

// layout_edges
setEdgeVisual(layoutId, edgeId, visualJson)
getEdgeVisuals(layoutId) → { edgeId, visualJson }[]
removeEdgeVisual(layoutId, edgeId)
```

#### edge 함수 변경

- `createEdge`: color, line_style, directed 파라미터 제거
- `updateEdge`: color, line_style, directed 제거
- `getEdge`: 시각 정보 없이 반환
- `getNetworkFull`에서 edge 시각 정보: layout_edges JOIN으로 가져오기

### WP-2D: IPC 변경

| 채널 | 변경 |
|------|------|
| `network:getByConcept` | 삭제 |
| `network:create` | `scope`, `parent_network_id` 파라미터 추가 |

### WP-2E: preload/service/store 변경

- `window.electron.network.getByConcept` → 삭제
- `networkService.getNetworksByConcept` → 삭제
- `useNetworkStore` state에서 `canvas_count` 기반 portal affordance 로직 → 삭제
- `openNetwork()` 내 `concept_id` 기반 자식 canvas 탐색 → 삭제
- viewport 저장/복원: `updateNetwork(id, { viewport_x, ... })` → `layoutService.updateLayout(layoutId, { viewport_json })`
- node 위치 저장: `updateNetworkNode(id, { position_x, ... })` → `layoutService.setNodePosition(layoutId, nodeId, positionJson)`
- edge 시각 편집: `updateEdge(id, { color, ... })` → `layoutService.setEdgeVisual(layoutId, edgeId, visualJson)`
- Layout IPC 채널 추가: `layout:get`, `layout:update`, `layout:setNodePosition`, `layout:setEdgeVisual` 등

### WP-2F: UI 변경

- `NetworkWorkspace.tsx`:
  - Ctrl+Wheel drillInto(conceptId) → 삭제 또는 변경 (Phase 5에서 Portal로 대체)
  - viewport 저장: network.viewport_x/y/zoom → layout.viewport_json 읽기/쓰기
  - node 렌더링: node.position_x/y → layout_nodes에서 position_json 읽기
  - edge 렌더링: edge.color/line_style/directed → layout_edges에서 visual_json 읽기
  - layout plugin 연동: layout_type에 따라 plugin 선택, position_json 스키마는 plugin이 결정
- `NetworkList.tsx`: concept group 기반 트리 → `parent_network_id` 기반 트리
- `NetworkBreadcrumb.tsx`: `conceptTitle` 참조 → 삭제, `parent_network_id` 체인 기반
- `NodeNetworkOverlay.tsx`: concept의 하위 canvas 목록 → 삭제 또는 빈 상태
- `NetworkContextMenu.tsx`: "sibling canvas" 로직 → 삭제 또는 변경
- `EdgeEditor.tsx`: color/line_style/directed → layout_edges visual_json 편집으로 변경
- `NetworkEditor.tsx`: layout/layout_config → layoutService 경유로 변경

### WP-2G: 테스트

- `describe('Hierarchical Network')` 전체 재작성: concept_id 기반 → parent_network_id 기반
- `getNetworksByConceptId` 테스트 → 삭제
- App Root / Project Root 자동 생성 테스트 추가

검증: `pnpm --filter @netior/core test && pnpm typecheck && pnpm dev:desktop`

---

## Phase 3: Objects 테이블 + Entity Node 일반화

### WP-3A: Migration 012 — objects 테이블

```sql
CREATE TABLE objects (
  id          TEXT PRIMARY KEY,
  object_type TEXT NOT NULL,
  scope       TEXT NOT NULL,
  project_id  TEXT,
  ref_id      TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_objects_ref ON objects(object_type, ref_id);
```

object_type enum (코드 레벨):
```typescript
export type NetworkObjectType =
  | 'concept' | 'network' | 'project' | 'schema'
  | 'relation_type' | 'agent' | 'context'
  | 'file' | 'module' | 'folder';
```

### WP-3B: 기존 엔티티 → objects 등록 연동

각 repository의 create 함수에 objects insert 추가 (트랜잭션):
- `createConcept` → objects에 `(id, 'concept', 'project', projectId, concept.id)` 추가
- `createNetwork` → objects에 등록
- `createProject` → objects에 `scope='app'`로 등록
- `createSchema`, `createRelationType`, `createFile`, `createModule` → 동일

delete 시 objects에서도 CASCADE 또는 명시 삭제.

### WP-3C: Migration 013 — network_nodes 구조 변경 (pure membership)

```sql
-- network_nodes 재생성 — 위치 정보 없음 (layout_nodes가 담당)
CREATE TABLE network_nodes_new (
  id             TEXT PRIMARY KEY,
  network_id     TEXT NOT NULL,
  object_id      TEXT NOT NULL,
  node_type      TEXT NOT NULL DEFAULT 'basic',
  parent_node_id TEXT,
  metadata       TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_node_id) REFERENCES network_nodes_new(id) ON DELETE SET NULL
);

DROP TABLE network_nodes;
ALTER TABLE network_nodes_new RENAME TO network_nodes;
CREATE UNIQUE INDEX idx_network_nodes_object ON network_nodes(network_id, object_id);
```

노드 추가 시: network_nodes에 membership 생성 + layout_nodes에 초기 position 생성 (트랜잭션).

node_type enum (코드 레벨):
```typescript
export type NodeType = 'basic' | 'portal' | 'box';
```

### WP-3D: shared/types 변경

```typescript
// NetworkNode — pure membership, 위치 정보 없음
export interface NetworkNode {
  id: string;
  network_id: string;
  object_id: string;
  node_type: NodeType;
  parent_node_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

export interface NetworkNodeCreate {
  network_id: string;
  object_id: string;
  node_type?: NodeType;
  parent_node_id?: string;
}

// Layout 타입 추가
export interface Layout {
  id: string;
  layout_type: string;
  layout_config_json: string | null;
  viewport_json: string | null;
  network_id: string | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutNodePosition {
  id: string;
  layout_id: string;
  node_id: string;
  position_json: string;  // 레이아웃별 스키마: freeform {x,y,w,h}, timeline {timestamp,lane}, ...
}

export interface LayoutEdgeVisual {
  id: string;
  layout_id: string;
  edge_id: string;
  visual_json: string;  // {color, line_style, directed, ...}
}

// Edge — pure structure, 시각 정보 없음
export interface Edge {
  id: string;
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id: string | null;
  description: string | null;
  created_at: string;
}

export interface EdgeCreate {
  network_id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type_id?: string;
  description?: string;
}

export interface EdgeUpdate {
  relation_type_id?: string | null;
  description?: string | null;
}
```

### WP-3E: network.ts repository 변경

- `addNetworkNode`: `concept_id`/`file_id` → `object_id`, `node_type`
- `getNetworkFull`: JOIN 변경 — `concept_id JOIN concepts` → `object_id JOIN objects`
  - objects에서 `object_type`, `ref_id`를 가져오고, `ref_id`로 해당 테이블(concepts, files 등) 추가 JOIN
- `NetworkFullData.nodes` 타입 변경: `(NetworkNode & { concept?: Concept; file?: FileEntity; canvas_count: number })[]` → `(NetworkNode & { object: ObjectInfo })[]`
  - `ObjectInfo`: `{ object_type, ref_id, title/name, icon?, color? }` (object_type별 표시 데이터)

### WP-3F: 전 레이어 전파

IPC, preload, service, store 모두 새 타입에 맞게 변경.

store에서:
- `NetworkNodeWithConcept` 타입 → `NetworkNodeWithObject` 등으로 변경
- 노드 추가 시 object 선택 UI 필요 (concept 외에 다른 object도 배치 가능)

### WP-3G: Node 렌더링

`NetworkWorkspace.tsx`:
- 기존: `concept_id` 존재 여부로 ConceptNode/FileNode 분기
- 변경: `node_type` + `object.object_type` 조합으로 렌더링

```tsx
function renderNode(node: NetworkNodeWithObject) {
  switch (node.node_type) {
    case 'basic':
      return <BasicNode node={node} />;
    case 'portal':
      return <PortalNode node={node} />;  // network/project만
    case 'box':
      return <BoxNode node={node} />;
  }
}
```

`BasicNode`: object_type에 따라 아이콘/색상/제목 다르게 렌더링
`PortalNode`: 더블클릭 → `openNetwork(object.ref_id)` (Phase 5에서 완성)
`BoxNode`: 내부 child 노드 렌더링, drag-drop, edge 노출

검증: `pnpm --filter @netior/core test && pnpm typecheck && pnpm dev:desktop`

---

## Phase 4: Context 도입

### WP-4A: Migration 014

```sql
CREATE TABLE contexts (
  id          TEXT PRIMARY KEY,
  network_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE
);

CREATE TABLE context_members (
  id          TEXT PRIMARY KEY,
  context_id  TEXT NOT NULL,
  member_type TEXT NOT NULL,
  member_id   TEXT NOT NULL,
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_context_members ON context_members(context_id, member_type, member_id);
```

### WP-4B: Repository — context.ts (신규)

```typescript
createContext(networkId, name, description?)
listContexts(networkId)
getContext(id)
updateContext(id, data)
deleteContext(id)
addContextMember(contextId, memberType: 'object' | 'edge', memberId)
removeContextMember(contextId, memberType, memberId)
getContextMembers(contextId) → { objects: Object[], edges: Edge[] }
```

### WP-4C: 7-layer 전파

- shared/types: `Context`, `ContextCreate`, `ContextUpdate`, `ContextMember` 타입 추가
- shared/constants: `CONTEXT_*` IPC 채널 추가
- IPC: `context-ipc.ts` (신규)
- preload: `electronAPI.context` 네임스페이스 추가
- service: `context-service.ts` (신규)
- store: `context-store.ts` (신규) — `useContextStore`
- EditorTabType에 `'context'` 추가
- EditorContent.tsx에 `case 'context': <ContextEditor />` 추가

### WP-4D: UI

- `ContextEditor.tsx` (신규): name, description, member 목록 편집
- Context 활성화 UI: network workspace에서 context 선택 → 비멤버 노드/edge dimming or hiding
- `NetworkWorkspace.tsx`에 activeContextId state 추가
- 필터링 로직: `activeContextId`가 있으면 context_members에 포함된 object/edge만 full opacity
- Context에 layout이 있으면: 해당 layout의 position/visual로 렌더링
- Context에 layout이 없으면: network의 layout을 기반으로 멤버만 필터링하여 렌더링

---

## Phase 5: Portal 전환

Phase 2 + Phase 3 완료 후. Phase 4와 병렬 가능.

### 변경 사항

- `NetworkWorkspace.tsx`의 Ctrl+Wheel: `drillInto(conceptId)` → `navigateToNetwork(node.object.ref_id)` (node_type='portal'인 경우만)
- Portal node 더블클릭 핸들러 구현
- node_type='portal' 시각적 표시 (아이콘, border 등으로 entry 가능함을 표현)
- `NetworkBreadcrumb.tsx`: `parent_network_id` 체인 기반 (Phase 2에서 이미 변경)

---

## Phase 6: User Type 확장

Phase 3 완료 후. Phase 4, 5와 병렬 가능.

### WP-6A: Schema 참조 필드

- shared/types: `FieldType`에 `'schema_ref'` 추가
- `SchemaField`에 `ref_schema_id?: string` 필드 추가
- core: schema field create/update 시 순환 검사 로직
  - A → B → C → A 탐지: field chain을 BFS/DFS로 탐색
- UI: field type 선택에 'schema_ref' 추가 → schema 선택 picker 표시

### WP-6B: 타입 폴더

Migration:
```sql
CREATE TABLE type_groups (
  id              TEXT PRIMARY KEY,
  scope           TEXT NOT NULL,
  project_id      TEXT,
  kind            TEXT NOT NULL,
  name            TEXT NOT NULL,
  parent_group_id TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_group_id) REFERENCES type_groups(id) ON DELETE CASCADE
);

ALTER TABLE schemas ADD COLUMN group_id TEXT REFERENCES type_groups(id) ON DELETE SET NULL;
ALTER TABLE relation_types ADD COLUMN group_id TEXT REFERENCES type_groups(id) ON DELETE SET NULL;
```

7-layer 전파 + Sidebar 폴더 트리 UI.

---

## 전체 의존 그래프

```
Phase 1 (리네이밍 + CanvasType 삭제)
    ↓
Phase 2 (scope, parent_network_id, concept_id 제거)
    ↓
Phase 3 (objects 테이블 + entity node)
    ↓──────────────────────────────────────
    ↓                ↓                    ↓
Phase 4 (Context)  Phase 5 (Portal)  Phase 6 (User Type)
    ← Phase 4, 5 병렬 가능 →
                     ← Phase 5, 6 병렬 가능 →
```

## 검증 체크리스트 (매 Phase)

```bash
pnpm --filter @netior/shared build
pnpm --filter @netior/core build && pnpm --filter @netior/core test
pnpm --filter @netior/mcp build
pnpm --filter @netior/narre-server build
pnpm typecheck
pnpm dev:desktop  # 수동 확인
```
