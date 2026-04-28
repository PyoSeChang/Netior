# Desktop App Renderer Logic Reference

렌더러 프로세스의 로직 계층(services, stores, hooks, lib, utils, entry) 전체 레퍼런스.

---

## 1. Service Layer

모든 서비스는 `window.electron.*` IPC 브릿지를 호출하고, `unwrapIpc()`로 `IpcResult<T>`를 언래핑한다.

### 1.1 ipc.ts

| 함수 | 설명 |
|------|------|
| `unwrapIpc<T>(result: IpcResult<T>): T` | `IpcResult`에서 success이면 data 반환, 실패면 `Error` throw |

### 1.2 schema-service.ts

export: `schemaService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.schema.create` | `SchemaCreate` | `Promise<Schema>` |
| `list(projectId)` | `window.electron.schema.list` | `string` | `Promise<Schema[]>` |
| `get(id)` | `window.electron.schema.get` | `string` | `Promise<Schema \| undefined>` |
| `update(id, data)` | `window.electron.schema.update` | `string, SchemaUpdate` | `Promise<Schema>` |
| `delete(id)` | `window.electron.schema.delete` | `string` | `Promise<boolean>` |
| `field.create(data)` | `window.electron.schema.createField` | `SchemaFieldCreate` | `Promise<SchemaField>` |
| `field.list(schemaId)` | `window.electron.schema.listFields` | `string` | `Promise<SchemaField[]>` |
| `field.update(id, data)` | `window.electron.schema.updateField` | `string, SchemaFieldUpdate` | `Promise<SchemaField>` |
| `field.delete(id)` | `window.electron.schema.deleteField` | `string` | `Promise<boolean>` |
| `field.reorder(schemaId, orderedIds)` | `window.electron.schema.reorderFields` | `string, string[]` | `Promise<boolean>` |

### 1.3 canvas-service.ts

export: `canvasService` 객체, `CanvasFullData` 인터페이스

**CanvasFullData 타입:**
```ts
interface CanvasFullData {
  canvas: Canvas;
  nodes: (CanvasNode & { concept?: Concept; canvas_count: number })[];
  edges: (Edge & { relation_type?: RelationType })[];
}
```

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.canvas.create` | `CanvasCreate` | `Promise<Canvas>` |
| `list(projectId, rootOnly?)` | `window.electron.canvas.list` | `string, boolean?` | `Promise<Canvas[]>` |
| `update(id, data)` | `window.electron.canvas.update` | `string, CanvasUpdate` | `Promise<Canvas>` |
| `delete(id)` | `window.electron.canvas.delete` | `string` | `Promise<boolean>` |
| `getFull(canvasId)` | `window.electron.canvas.getFull` | `string` | `Promise<CanvasFullData \| undefined>` |
| `getCanvasesByConcept(conceptId)` | `window.electron.canvas.getByConcept` | `string` | `Promise<Canvas[]>` |
| `getAncestors(canvasId)` | `window.electron.canvas.getAncestors` | `string` | `Promise<CanvasBreadcrumbItem[]>` |
| `getTree(projectId)` | `window.electron.canvas.getTree` | `string` | `Promise<CanvasTreeNode[]>` |
| `node.add(data)` | `window.electron.canvasNode.add` | `CanvasNodeCreate` | `Promise<CanvasNode>` |
| `node.update(id, data)` | `window.electron.canvasNode.update` | `string, CanvasNodeUpdate` | `Promise<CanvasNode>` |
| `node.remove(id)` | `window.electron.canvasNode.remove` | `string` | `Promise<boolean>` |
| `edge.create(data)` | `window.electron.edge.create` | `EdgeCreate` | `Promise<Edge>` |
| `edge.get(id)` | `window.electron.edge.get` | `string` | `Promise<Edge \| undefined>` |
| `edge.update(id, data)` | `window.electron.edge.update` | `string, EdgeUpdate` | `Promise<Edge>` |
| `edge.delete(id)` | `window.electron.edge.delete` | `string` | `Promise<boolean>` |

### 1.4 canvas-type-service.ts

export: `canvasTypeService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.canvasType.create` | `CanvasTypeCreate` | `Promise<CanvasType>` |
| `list(projectId)` | `window.electron.canvasType.list` | `string` | `Promise<CanvasType[]>` |
| `get(id)` | `window.electron.canvasType.get` | `string` | `Promise<CanvasType \| undefined>` |
| `update(id, data)` | `window.electron.canvasType.update` | `string, CanvasTypeUpdate` | `Promise<CanvasType>` |
| `delete(id)` | `window.electron.canvasType.delete` | `string` | `Promise<boolean>` |
| `relation.add(canvasTypeId, relationTypeId)` | `window.electron.canvasType.addRelation` | `string, string` | `Promise<CanvasTypeAllowedRelation>` |
| `relation.remove(canvasTypeId, relationTypeId)` | `window.electron.canvasType.removeRelation` | `string, string` | `Promise<boolean>` |
| `relation.list(canvasTypeId)` | `window.electron.canvasType.listRelations` | `string` | `Promise<RelationType[]>` |

### 1.5 concept-service.ts

export: `conceptService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.concept.create` | `ConceptCreate` | `Promise<Concept>` |
| `getByProject(projectId)` | `window.electron.concept.getByProject` | `string` | `Promise<Concept[]>` |
| `update(id, data)` | `window.electron.concept.update` | `string, ConceptUpdate` | `Promise<Concept>` |
| `delete(id)` | `window.electron.concept.delete` | `string` | `Promise<boolean>` |

### 1.6 concept-content-service.ts

export: `conceptContentService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `syncToAgent(conceptId)` | `window.electron.conceptContent.syncToAgent` | `string` | `Promise<Concept>` |
| `syncFromAgent(conceptId, agentContent)` | `window.electron.conceptContent.syncFromAgent` | `string, string` | `Promise<Concept>` |

### 1.7 concept-file-service.ts

export: `conceptFileService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.conceptFile.create` | `ConceptFileCreate` | `Promise<ConceptFile>` |
| `getByConcept(conceptId)` | `window.electron.conceptFile.getByConcept` | `string` | `Promise<ConceptFile[]>` |
| `delete(id)` | `window.electron.conceptFile.delete` | `string` | `Promise<boolean>` |

### 1.8 concept-property-service.ts

export: `conceptPropertyService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `upsert(data)` | `window.electron.conceptProp.upsert` | `ConceptPropertyUpsert` | `Promise<ConceptProperty>` |
| `getByConcept(conceptId)` | `window.electron.conceptProp.getByConcept` | `string` | `Promise<ConceptProperty[]>` |
| `delete(id)` | `window.electron.conceptProp.delete` | `string` | `Promise<boolean>` |

### 1.9 editor-prefs-service.ts

export: `editorPrefsService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `get(conceptId)` | `window.electron.editorPrefs.get` | `string` | `Promise<ConceptEditorPrefs \| undefined>` |
| `upsert(conceptId, data)` | `window.electron.editorPrefs.upsert` | `string, ConceptEditorPrefsUpdate` | `Promise<ConceptEditorPrefs>` |

### 1.10 fs-service.ts

export: `fsService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `readDir(dirPath)` | `window.electron.fs.readDir` | `string` | `Promise<FileTreeNode[]>` |
| `readDirShallow(dirPath, depth?)` | `window.electron.fs.readDirShallow` | `string, number?` | `Promise<FileTreeNode[]>` |
| `readFile(filePath)` | `window.electron.fs.readFile` | `string` | `Promise<string>` |
| `readBinaryFile(filePath)` | `window.electron.fs.readBinaryFile` | `string` | `Promise<ArrayBuffer>` |
| `writeFile(filePath, content)` | `window.electron.fs.writeFile` | `string, string` | `Promise<boolean>` |
| `openFolderDialog()` | `window.electron.fs.openDialog` | `{ properties: ['openDirectory'] }` | `Promise<string \| null>` |
| `openFileDialog(filters?)` | `window.electron.fs.openDialog` | `{ properties: ['openFile'], filters? }` | `Promise<string \| null>` |
| `renameItem(oldPath, newPath)` | `window.electron.fs.rename` | `string, string` | `Promise<boolean>` |
| `deleteItem(targetPath)` | `window.electron.fs.delete` | `string` | `Promise<boolean>` |
| `stashDeleteItem(targetPath)` | `window.electron.fs.stashDelete` | `string` | `Promise<{ originalPath, stashPath, isDirectory }>` |
| `restoreDeletedItem(stashPath, originalPath)` | `window.electron.fs.restoreDeleted` | `string, string` | `Promise<boolean>` |
| `createFile(filePath)` | `window.electron.fs.createFile` | `string` | `Promise<boolean>` |
| `createDir(dirPath)` | `window.electron.fs.createDir` | `string` | `Promise<boolean>` |
| `copyItem(src, dest)` | `window.electron.fs.copy` | `string, string` | `Promise<boolean>` |
| `moveItem(src, dest)` | `window.electron.fs.move` | `string, string` | `Promise<boolean>` |
| `showInExplorer(targetPath)` | `window.electron.fs.showInExplorer` | `string` | `Promise<boolean>` |
| `existsItem(targetPath)` | `window.electron.fs.exists` | `string` | `Promise<boolean>` |
| `hasClipboardFiles()` | `window.electron.fs.hasClipboardFiles` | - | `Promise<boolean>` |
| `hasClipboardImage()` | `window.electron.fs.hasClipboardImage` | - | `Promise<boolean>` |
| `readClipboardFiles()` | `window.electron.fs.readClipboardFiles` | - | `Promise<string[]>` |
| `saveClipboardImage(filePath)` | `window.electron.fs.saveClipboardImage` | `string` | `Promise<boolean>` |

### 1.11 module-service.ts

export: `moduleService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.module.create` | `ModuleCreate` | `Promise<Module>` |
| `list(projectId)` | `window.electron.module.list` | `string` | `Promise<Module[]>` |
| `update(id, data)` | `window.electron.module.update` | `string, ModuleUpdate` | `Promise<Module>` |
| `delete(id)` | `window.electron.module.delete` | `string` | `Promise<boolean>` |
| `dir.add(data)` | `window.electron.moduleDir.add` | `ModuleDirectoryCreate` | `Promise<ModuleDirectory>` |
| `dir.list(moduleId)` | `window.electron.moduleDir.list` | `string` | `Promise<ModuleDirectory[]>` |
| `dir.remove(id)` | `window.electron.moduleDir.remove` | `string` | `Promise<boolean>` |
| `dir.updatePath(id, dirPath)` | `window.electron.moduleDir.updatePath` | `string, string` | `Promise<ModuleDirectory>` |

### 1.12 narre-service.ts

export: `narreService` 객체, `MentionResult` 인터페이스

**MentionResult 타입:**
```ts
interface MentionResult {
  type: string;
  id: string;
  display: string;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  meta?: Record<string, unknown>;
}
```

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `listSessions(projectId)` | `window.electron.narre.listSessions` | `string` | `Promise<NarreSession[]>` |
| `createSession(projectId)` | `window.electron.narre.createSession` | `string` | `Promise<NarreSession>` |
| `getSession(sessionId)` | `window.electron.narre.getSession` | `string` | `Promise<NarreSession>` |
| `deleteSession(sessionId)` | `window.electron.narre.deleteSession` | `string` | `Promise<boolean>` |
| `getApiKeyStatus()` | `window.electron.narre.getApiKeyStatus` | - | `Promise<boolean>` |
| `setApiKey(key)` | `window.electron.narre.setApiKey` | `string` | `Promise<boolean>` |
| `searchMentions(projectId, query)` | `window.electron.narre.searchMentions` | `string, string` | `Promise<MentionResult[]>` |
| `sendMessage(data)` | `window.electron.narre.sendMessage` | `{ sessionId?, projectId, message, mentions? }` | `Promise<void>` (fire-and-forget, SSE로 이벤트 수신) |
| `onStreamEvent(callback)` | `window.electron.narre.onStreamEvent` | `(event: unknown) => void` | `() => void` (cleanup 함수 반환) |
| `respondToCard(sessionId, toolCallId, response)` | `window.electron.narre.respondToCard` | `string, string, unknown` | `Promise<void>` |
| `executeCommand(projectId, command, args?)` | `window.electron.narre.executeCommand` | `string, string, Record<string, string>?` | `Promise<void>` |

### 1.13 project-service.ts

export: `projectService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.project.create` | `ProjectCreate` | `Promise<Project>` |
| `list()` | `window.electron.project.list` | - | `Promise<Project[]>` |
| `delete(id)` | `window.electron.project.delete` | `string` | `Promise<boolean>` |
| `updateRootDir(id, rootDir)` | `window.electron.project.updateRootDir` | `string, string` | `Promise<Project>` |

### 1.14 relation-type-service.ts

export: `relationTypeService` 객체

| 함수 | IPC 채널 | 파라미터 | 반환 |
|------|----------|----------|------|
| `create(data)` | `window.electron.relationType.create` | `RelationTypeCreate` | `Promise<RelationType>` |
| `list(projectId)` | `window.electron.relationType.list` | `string` | `Promise<RelationType[]>` |
| `get(id)` | `window.electron.relationType.get` | `string` | `Promise<RelationType \| undefined>` |
| `update(id, data)` | `window.electron.relationType.update` | `string, RelationTypeUpdate` | `Promise<RelationType>` |
| `delete(id)` | `window.electron.relationType.delete` | `string` | `Promise<boolean>` |

### 1.15 index.ts (재export)

`projectService`, `conceptService`, `canvasService`, `conceptFileService`, `fsService`, `moduleService`, `editorPrefsService`, `schemaService`, `conceptPropertyService`, `conceptContentService`, `narreService`, `unwrapIpc`를 재export.

> `relationTypeService`와 `canvasTypeService`는 index.ts에서 재export되지 않음 -- 스토어에서 직접 import.

---

## 2. Store Layer

모든 스토어는 Zustand `create()`로 생성. 컴포넌트에서 `useXxxStore()` 훅으로 사용.

### 2.1 schema-store.ts

**export:** `useSchemaStore`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `schemas` | `Schema[]` | 프로젝트의 schema 목록 |
| `fields` | `Record<string, SchemaField[]>` | schemaId별 필드 목록 |
| `loading` | `boolean` | 로딩 상태 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadByProject(projectId)` | `schemaService.list` | 프로젝트의 schema 전체 로드 |
| `createSchema(data)` | `schemaService.create` | schema 생성, 로컬 배열에 추가, 생성된 객체 반환 |
| `updateSchema(id, data)` | `schemaService.update` | schema 수정, 로컬 배열 교체 |
| `deleteSchema(id)` | `schemaService.delete` | schema 삭제, 로컬 배열과 해당 fields 제거 |
| `loadFields(schemaId)` | `schemaService.field.list` | 특정 schema의 필드 로드 |
| `createField(data)` | `schemaService.field.create` | 필드 생성, 해당 schema의 fields에 추가, 생성된 객체 반환 |
| `updateField(id, schemaId, data)` | `schemaService.field.update` | 필드 수정, 로컬 교체 |
| `deleteField(id, schemaId)` | `schemaService.field.delete` | 필드 삭제, 로컬 제거 |
| `reorderFields(schemaId, orderedIds)` | `schemaService.field.reorder` | 필드 순서 변경, 로컬 sort_order 업데이트 |
| `clear()` | - | schemas, fields 초기화 |

### 2.2 canvas-store.ts

**export:** `useCanvasStore`, `CanvasNodeWithConcept`, `EdgeWithRelationType`

**추가 타입:**
```ts
interface CanvasNodeWithConcept extends CanvasNode {
  concept?: Concept;
  canvas_count: number;
}
type EdgeWithRelationType = Edge & { relation_type?: RelationType };
```

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `canvases` | `Canvas[]` | 프로젝트의 캔버스 목록 |
| `currentCanvas` | `Canvas \| null` | 현재 열린 캔버스 |
| `nodes` | `CanvasNodeWithConcept[]` | 현재 캔버스의 노드들 |
| `edges` | `EdgeWithRelationType[]` | 현재 캔버스의 엣지들 |
| `loading` | `boolean` | 로딩 상태 |
| `breadcrumbs` | `CanvasBreadcrumbItem[]` | 캔버스 계층 경로 |
| `canvasHistory` | `string[]` | 네비게이션 히스토리 (canvas ID 스택) |
| `canvasTree` | `CanvasTreeNode[]` | 사이드바용 트리 구조 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadCanvases(projectId, rootOnly?)` | `canvasService.list` | 캔버스 목록 로드 |
| `loadCanvasTree(projectId)` | `canvasService.getTree` | 사이드바 트리 로드 |
| `createCanvas(data)` | `canvasService.create` | 캔버스 생성. concept_id가 없는 루트 캔버스만 로컬 목록에 추가 |
| `openCanvas(canvasId)` | `canvasService.getFull`, `canvasService.getAncestors` | 캔버스 전체 데이터(노드, 엣지) + 브레드크럼 로드 |
| `updateCanvas(id, data)` | `canvasService.update` | 캔버스 수정. canvases 배열과 currentCanvas 모두 업데이트 |
| `deleteCanvas(id)` | `canvasService.delete` | 캔버스 삭제. 현재 캔버스면 nodes/edges도 초기화 |
| `drillInto(conceptId)` | `canvasService.getCanvasesByConcept` | 개념의 하위 캔버스로 이동. history에 현재 캔버스 push |
| `navigateBack()` | - | history에서 pop하여 이전 캔버스로 복귀 |
| `navigateToBreadcrumb(canvasId)` | - | 브레드크럼의 특정 위치로 이동. history 잘라냄 |
| `addNode(data)` | `canvasService.node.add` | 노드 추가 후 전체 캔버스 재로드 (concept 데이터 필요) |
| `updateNode(id, data)` | `canvasService.node.update` | **낙관적 업데이트**: position/size를 즉시 반영한 후 IPC 호출 |
| `removeNode(id)` | `canvasService.node.remove` | 노드 삭제, 관련 엣지도 로컬에서 제거 |
| `addEdge(data)` | `canvasService.edge.create` | 엣지 생성, 로컬 배열에 추가 |
| `removeEdge(id)` | `canvasService.edge.delete` | 엣지 삭제, 로컬 제거 |
| `saveViewport(viewport)` | `canvasService.update` (via `updateCanvas`) | 현재 캔버스의 viewport 상태 저장 |
| `clear()` | - | 모든 상태 초기화 |

### 2.3 canvas-type-store.ts

**export:** `useCanvasTypeStore`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `canvasTypes` | `CanvasType[]` | 캔버스 타입 목록 |
| `allowedRelations` | `Record<string, RelationType[]>` | canvasTypeId별 허용된 관계 타입 |
| `loading` | `boolean` | 로딩 상태 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadByProject(projectId)` | `canvasTypeService.list` | 프로젝트의 캔버스 타입 로드 |
| `createCanvasType(data)` | `canvasTypeService.create` | 생성, 로컬 추가, 생성된 객체 반환 |
| `updateCanvasType(id, data)` | `canvasTypeService.update` | 수정, 로컬 교체 |
| `deleteCanvasType(id)` | `canvasTypeService.delete` | 삭제, allowedRelations 엔트리도 제거 |
| `loadAllowedRelations(canvasTypeId)` | `canvasTypeService.relation.list` | 허용된 관계 타입 로드 |
| `addAllowedRelation(canvasTypeId, relationTypeId)` | `canvasTypeService.relation.add` | 관계 추가 후 `loadAllowedRelations` 재호출 |
| `removeAllowedRelation(canvasTypeId, relationTypeId)` | `canvasTypeService.relation.remove` | 관계 제거 후 `loadAllowedRelations` 재호출 |
| `clear()` | - | 초기화 |

### 2.4 concept-store.ts

**export:** `useConceptStore`

**모듈 레벨 함수:**
- `debouncedSyncToAgent(conceptId)`: 300ms 디바운스로 `conceptContentService.syncToAgent` 호출, 결과로 concepts 배열 업데이트

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `concepts` | `Concept[]` | 프로젝트의 개념 목록 |
| `loading` | `boolean` | 로딩 상태 |
| `properties` | `Record<string, ConceptProperty[]>` | conceptId별 프로퍼티 목록 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadByProject(projectId)` | `conceptService.getByProject` | 개념 목록 로드 |
| `createConcept(data)` | `conceptService.create` | 개념 생성, 로컬 추가, 반환 |
| `updateConcept(id, data)` | `conceptService.update` | 개념 수정, 로컬 교체 |
| `deleteConcept(id)` | `conceptService.delete` | 개념 삭제, 로컬 제거 |
| `updateContent(id, content)` | `conceptService.update` | 콘텐츠 업데이트 후 `debouncedSyncToAgent` 호출 |
| `updateAgentContent(id, agentContent)` | `conceptContentService.syncFromAgent` | 에이전트에서 받은 콘텐츠로 동기화 |
| `loadProperties(conceptId)` | `conceptPropertyService.getByConcept` | 프로퍼티 로드 |
| `upsertProperty(data)` | `conceptPropertyService.upsert` | 프로퍼티 upsert, 로컬 교체/추가, `debouncedSyncToAgent` 호출 |
| `deleteProperty(id, conceptId)` | `conceptPropertyService.delete` | 프로퍼티 삭제, 로컬 제거 |
| `clear()` | - | syncTimer 정리 후 초기화 |

### 2.5 editor-store.ts

**export:** `useEditorStore`, `containsTab()`, `getActiveTabFromLayout()`

가장 복잡한 스토어. 에디터 탭 관리 + 스플릿 레이아웃 트리 관리.

**모듈 레벨 유틸:**
- `makeTabId(type, targetId)`: `"${type}:${targetId}"` 형태의 탭 ID 생성
- `debouncedSavePrefs(targetId, data)`: 300ms 디바운스로 `editorPrefsService.upsert` 호출
- `containsTab(node, tabId)`: 트리에 탭 존재 여부
- `getActiveTabFromLayout(layout, globalActiveTabId)`: 레이아웃에서 활성 탭 ID 반환
- 트리 조작 헬퍼: `findLeafWithTab`, `getFirstLeaf`, `setActiveInLeaf`, `removeTabFromTree`, `addTabToLeaf`, `splitLeafContaining`, `updateRatioAtPath` 등

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `tabs` | `EditorTab[]` | 열린 탭 전체 목록 |
| `activeTabId` | `string \| null` | 현재 활성 탭 ID |
| `sideLayout` | `SplitNode \| null` | side 모드 스플릿 트리 |
| `fullLayout` | `SplitNode \| null` | full 모드 스플릿 트리 |
| `pendingCloseTabId` | `string \| null` | 닫기 확인 대기 중인 탭 ID |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `openTab({ type, targetId, title, viewMode?, draftData? })` | `editorPrefsService.get` (concept 탭만) | 탭 열기. 기존 탭이면 활성화. 새 탭이면 viewMode 결정(prefs, 현재 상태 기반), 레이아웃 트리에 추가 |
| `closeTab(tabId)` | `editorPrefsService.upsert` (concept 탭), `window.electron.terminal.shutdown` (terminal 탭) | 탭 닫기. 프리퍼런스 저장, draftCache 정리, 레이아웃 트리에서 제거 |
| `closeOtherTabs(tabId)` | - | 지정 탭 외 모두 닫기 |
| `closeTabsToRight(tabId)` | - | 우측 탭 모두 닫기 |
| `closeAllTabs()` | - | 전체 탭 닫기 |
| `setActiveTab(tabId)` | - | 활성 탭 변경, 레이아웃 트리 내 활성화 |
| `setViewMode(tabId, mode)` | `editorPrefsService.upsert` (concept 탭) | 뷰 모드 변경. **detached**: `window.electron.editor.detach` 호출. **float**: 레이아웃에서 제거. **side/full 그룹 전환**: 동일 mode의 모든 탭을 함께 이동, 레이아웃 트리 교환 |
| `toggleMinimize(tabId)` | - | 최소화 토글. side/full이면 같은 mode의 모든 탭 함께 토글 |
| `updateFloatRect(tabId, rect)` | `editorPrefsService.upsert` (concept 탭) | float 위치/크기 업데이트. 디바운스 저장 |
| `updateSideSplitRatio(tabId, ratio)` | `editorPrefsService.upsert` (concept 탭) | side 분할 비율 업데이트 (0.2~0.8 clamped). 디바운스 저장 |
| `updateTitle(tabId, title, isManualRename?)` | - | 탭 제목 업데이트. 수동 리네임 시 이후 자동 업데이트 방지 |
| `setActiveFile(tabId, filePath)` | - | 탭의 활성 파일 경로 설정 |
| `setDirty(tabId, dirty)` | - | 탭의 dirty 상태 설정 |
| `setEditorType(tabId, editorType)` | - | 탭의 에디터 타입 설정 |
| `requestCloseTab(tabId)` | - | 닫기 요청. 터미널이 살아있거나 미저장 변경 있으면 `pendingCloseTabId` 설정 |
| `confirmCloseTab()` | - | 닫기 확인. `pendingCloseTabId` 탭 닫기 |
| `cancelCloseTab()` | - | 닫기 취소 |
| `saveAndCloseTab()` | `EditorSessionHandle.save` (registry에서) | 저장 후 닫기 |
| `splitTab(targetTabId, newTabId, direction, position)` | - | 레이아웃 트리에서 타겟 리프를 분할, 새 탭을 새 리프에 배치 |
| `moveTabToPane(tabId, targetPaneTabId, mode)` | - | 탭을 다른 pane으로 이동 |
| `updateSplitRatio(mode, path, ratio)` | - | 스플릿 비율 업데이트 (0.15~0.85 clamped) |
| `clear()` | - | 타이머 정리, 전체 초기화 |

### 2.6 file-store.ts

**export:** `useFileStore`, `OpenFile`, `EditorType`, `ClipboardAction`

**추가 타입:**
```ts
interface OpenFile {
  filePath: string;        // 상대 경로
  absolutePath: string;    // 절대 경로
  editorType: EditorType;  // 'markdown' | 'code' | 'image' | 'pdf' | 'unsupported'
  content: string;
  isDirty: boolean;
}
type ClipboardAction = 'copy' | 'cut';
```

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `fileTree` | `FileTreeNode[]` | 파일 트리 구조 |
| `openFiles` | `OpenFile[]` | 열린 파일 목록 |
| `activeFilePath` | `string \| null` | 현재 활성 파일의 상대 경로 |
| `loading` | `boolean` | 트리 로딩 상태 |
| `loadingPaths` | `Set<string>` | 자식 로딩 중인 디렉토리 경로들 |
| `clipboard` | `{ paths: string[]; action: ClipboardAction } \| null` | 파일 클립보드 상태 |
| `rootDirs` | `string[]` | 루트 디렉토리 목록 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadFileTree(rootDirs)` | `fsService.readDirShallow` | 파일 트리 로드. 단일 디렉토리면 직접 배열, 복수면 디렉토리별 래퍼 노드 생성 |
| `loadChildren(dirPath)` | `fsService.readDirShallow` | 디렉토리 자식 lazy 로드, 기존 트리에 재귀적 병합 |
| `refreshFileTree()` | - | rootDirs로 `loadFileTree` 재호출 |
| `openFile(relativePath, rootDir)` | `fsService.readFile` | 파일 열기. 이미 열려있으면 활성화만. code/markdown이면 내용 읽기 |
| `closeFile(filePath)` | - | 파일 닫기, activeFilePath 조정 |
| `setActiveFile(filePath)` | - | 활성 파일 설정 |
| `updateContent(filePath, content)` | - | 로컬 콘텐츠 업데이트, isDirty=true |
| `saveFile(filePath)` | `fsService.writeFile` | 파일 저장, isDirty=false |
| `setClipboard(paths, action)` | - | 클립보드 설정. 다중 선택 copy/cut 지원 |
| `clearClipboard()` | - | 클립보드 초기화 |
| `clear()` | - | 전체 초기화 |

### 2.7 module-store.ts

**export:** `useModuleStore`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `modules` | `Module[]` | 프로젝트의 모듈 목록 |
| `activeModuleId` | `string \| null` | 현재 활성 모듈 ID |
| `directories` | `ModuleDirectory[]` | 활성 모듈의 디렉토리 목록 |
| `loading` | `boolean` | 로딩 상태 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadModules(projectId)` | `moduleService.list` | 모듈 로드. activeModuleId가 없으면 첫 모듈 자동 활성화 |
| `createModule(data)` | `moduleService.create` | 모듈 생성, 로컬 추가, 반환 |
| `updateModule(id, data)` | `moduleService.update` | 모듈 수정, 로컬 교체 |
| `deleteModule(id)` | `moduleService.delete` | 모듈 삭제. 활성 모듈이면 다음 모듈로 전환 또는 null |
| `setActiveModule(moduleId)` | `moduleService.dir.list` | 활성 모듈 변경. **FileStore.clear()** 호출 후 디렉토리 로드 |
| `addDirectory(data)` | `moduleService.dir.add` | 디렉토리 추가, 로컬 추가, 반환 |
| `removeDirectory(id)` | `moduleService.dir.remove` | 디렉토리 제거, 로컬 제거 |
| `clear()` | - | 초기화 |

### 2.8 project-store.ts

**export:** `useProjectStore`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `projects` | `Project[]` | 프로젝트 목록 |
| `currentProject` | `Project \| null` | 현재 열린 프로젝트 |
| `loading` | `boolean` | 로딩 상태 |
| `missingPathProject` | `Project \| null` | root_dir이 존재하지 않는 프로젝트 (경로 재설정 다이얼로그용) |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadProjects()` | `projectService.list` | 전체 프로젝트 목록 로드 |
| `restoreLastProject()` | `window.electron.config.get('lastProjectId')` | 마지막 프로젝트 자동 복원 |
| `createProject(name, rootDir)` | `projectService.create` | 프로젝트 생성, 목록 앞에 추가, 반환 |
| `openProject(project)` | `window.electron.fs.exists`, `window.electron.config.set` | 프로젝트 열기. root_dir 존재 확인 -> 없으면 `missingPathProject` 설정. 이전 프로젝트 상태 캐시, 새 프로젝트 상태 복원 시도 |
| `resolveMissingPath()` | `window.electron.fs.openDialog`, `projectService.updateRootDir`, `moduleService.list/dir.list/dir.updatePath` | 누락 경로 해결. 폴더 선택 다이얼로그 -> root_dir 업데이트 -> 모듈 디렉토리도 함께 갱신 |
| `dismissMissingPath()` | - | 경로 해결 취소 |
| `closeProject()` | `window.electron.config.set` | 프로젝트 닫기. 상태 캐시 후 모든 스토어 초기화 |
| `deleteProject(id)` | `projectService.delete`, `window.electron.config.get/set` | 프로젝트 삭제. lastProjectId 정리, 캐시 삭제, 현재 프로젝트면 스토어 초기화 |

### 2.9 relation-type-store.ts

**export:** `useRelationTypeStore`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `relationTypes` | `RelationType[]` | 관계 타입 목록 |
| `loading` | `boolean` | 로딩 상태 |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `loadByProject(projectId)` | `relationTypeService.list` | 관계 타입 로드 |
| `createRelationType(data)` | `relationTypeService.create` | 생성, 로컬 추가, 반환 |
| `updateRelationType(id, data)` | `relationTypeService.update` | 수정, 로컬 교체 |
| `deleteRelationType(id)` | `relationTypeService.delete` | 삭제, 로컬 제거 |
| `clear()` | - | 초기화 |

### 2.10 settings-store.ts

**export:** `useSettingsStore`, `AVAILABLE_CONCEPTS`

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `themeConcept` | `ThemeConcept` (`'forest' \| 'neon' \| 'slate'`) | 현재 테마 컨셉. 기본값: `'forest'` |
| `themeMode` | `ThemeMode` (`'dark' \| 'light'`) | 현재 테마 모드. 기본값: `'dark'` |
| `locale` | `Locale` | 현재 언어. 기본값: `'ko'` |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `setThemeConcept(concept)` | - | 테마 컨셉 변경. `document.documentElement`에 `data-concept` 속성 설정 |
| `setThemeMode(mode)` | - | 테마 모드 변경. `document.documentElement`에 `data-mode` 속성 설정 |
| `setLocale(locale)` | - | 언어 변경 |

### 2.11 ui-store.ts

**export:** `useUIStore`, `CanvasMode`, `RenderingMode`

**타입:**
```ts
type CanvasMode = 'browse' | 'edit';
type RenderingMode = 'canvas';
type SidebarView = 'canvases' | 'files' | 'schemas';
```

**State:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `canvasMode` | `CanvasMode` | 캔버스 인터랙션 모드. 기본값: `'browse'` |
| `sidebarView` | `SidebarView` | 사이드바 탭 선택. 기본값: `'canvases'` |
| `sidebarOpen` | `boolean` | 사이드바 표시 여부. 기본값: `true` |
| `sidebarWidth` | `number` | 사이드바 너비 (180~400). 기본값: `224` |
| `showSettings` | `boolean` | 설정 모달 표시 여부. 기본값: `false` |

**Actions:**

| 메서드 | 호출 서비스 | 설명 |
|--------|-----------|------|
| `setCanvasMode(mode)` | - | 캔버스 모드 변경 |
| `setSidebarView(view)` | - | 사이드바 뷰 변경 |
| `toggleSidebar()` | - | 사이드바 토글 |
| `setSidebarWidth(width)` | - | 사이드바 너비 설정 (180~400 clamped) |
| `setShowSettings(show)` | - | 설정 모달 표시/숨김 |

### 2.12 project-state-cache.ts

**export:** `saveProjectState`, `restoreProjectState`, `deleteProjectState`, `clearAllProjectStores`

프로젝트 전환 시 상태를 메모리에 캐시/복원하는 유틸리티. Zustand 스토어가 아닌 일반 모듈.

**ProjectSnapshot 구조:**
- `canvas`: canvases, currentCanvas, nodes, edges, breadcrumbs, canvasHistory, canvasTree
- `editor`: tabs, activeTabId, sideLayout, fullLayout
- `module`: modules, activeModuleId, directories
- `concept`: concepts, properties
- `schema`: schemas, fields
- `relationType`: relationTypes
- `canvasType`: canvasTypes, allowedRelations
- `file`: fileTree, openFiles, activeFilePath, clipboard, rootDirs

**함수:**

| 함수 | 설명 |
|------|------|
| `saveProjectState(projectId)` | 8개 스토어 상태를 캡처하여 메모리 Map에 저장 |
| `restoreProjectState(projectId)` | 캐시된 스냅샷을 8개 스토어에 복원. 반환: `boolean` (복원 여부) |
| `deleteProjectState(projectId)` | 캐시에서 삭제 |
| `clearAllProjectStores()` | 8개 스토어 모두 `clear()` 호출 |

---

## 3. Service <-> Store 매핑

| Store | 사용 Service | 비고 |
|-------|-------------|------|
| `useSchemaStore` | `schemaService` | |
| `useCanvasStore` | `canvasService` | |
| `useCanvasTypeStore` | `canvasTypeService` | |
| `useConceptStore` | `conceptService`, `conceptPropertyService`, `conceptContentService` | content 변경 시 agent 동기화 |
| `useEditorStore` | `editorPrefsService` | 탭 열기/닫기/뷰모드 시 prefs 저장, `window.electron.terminal.shutdown`, `window.electron.editor.detach` 직접 호출 |
| `useFileStore` | `fsService` | |
| `useModuleStore` | `moduleService` | `setActiveModule`에서 `useFileStore.clear()` 호출 |
| `useProjectStore` | `projectService`, `moduleService` | `window.electron.config.get/set`, `window.electron.fs.exists/openDialog` 직접 호출 |
| `useRelationTypeStore` | `relationTypeService` | |
| `useSettingsStore` | - (DOM 직접 조작) | |
| `useUIStore` | - (순수 UI 상태) | |

**스토어 간 의존:**
- `project-state-cache` -> `useCanvasStore`, `useEditorStore`, `useModuleStore`, `useConceptStore`, `useSchemaStore`, `useRelationTypeStore`, `useCanvasTypeStore`, `useFileStore` (8개 전부)
- `useProjectStore` -> `project-state-cache` (save/restore/clear/delete)
- `useModuleStore` -> `useFileStore.clear()` (모듈 전환 시)

---

## 4. Hooks

### 4.1 useEditorSession

**파일:** `hooks/useEditorSession.ts`

**목적:** 에디터 탭의 로드/수정/저장/되돌리기 생명주기를 관리하는 제네릭 훅. 컴포넌트 언마운트 후에도 드래프트가 유지됨.

**파라미터:** `EditorSessionConfig<T>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `tabId` | `string` | 에디터 탭 ID |
| `load` | `() => Promise<T> \| T` | 초기/저장된 상태 로드 함수 |
| `save` | `(state: T) => Promise<void>` | 상태 저장 함수 |
| `isEqual?` | `(a: T, b: T) => boolean` | 커스텀 동등 비교 (기본: JSON.stringify) |
| `deps?` | `unknown[]` | 재로드 트리거 의존성 |

**반환:** `EditorSession<T>`

| 필드 | 타입 | 설명 |
|------|------|------|
| `state` | `T` | 현재 에디터 상태 |
| `setState` | `(updater: T \| ((prev: T) => T)) => void` | 상태 업데이트. draftCache도 동기화 |
| `isDirty` | `boolean` | 변경 여부 |
| `save` | `() => Promise<void>` | 저장. snapshot 갱신, dirty=false |
| `revert` | `() => void` | 마지막 저장 상태로 되돌리기 |
| `isLoading` | `boolean` | 로딩 중 여부 |
| `reload` | `() => Promise<void>` | 데이터 재로드 |

**사용 스토어/라이브러리:**
- `useEditorStore.setDirty()` -- dirty 상태 동기화
- `editor-session-registry` -- `registerSession`/`unregisterSession` (전역 save/dirty 확인용)

**핵심 메커니즘:**
- `draftCache` (모듈 레벨 Map): 컴포넌트 언마운트 후에도 수정 중인 상태 유지. 탭 닫을 때 `clearDraftCache(tabId)` 호출.
- `queueMicrotask`로 dirty 동기화를 지연해 setState-during-render 방지

**추가 export:**
- `clearDraftCache(tabId)`: 드래프트 캐시 삭제

### 4.2 useGlobalSave

**파일:** `hooks/useGlobalSave.ts`

**목적:** Ctrl+S / Cmd+S 전역 단축키로 현재 활성 탭 저장.

**파라미터:** 없음  
**반환:** `void`

**사용 스토어/라이브러리:**
- `useEditorStore.activeTabId` -- 활성 탭 확인
- `editor-session-registry.getSession()` -- save 호출

**동작:** `keydown` 이벤트 리스너 등록 (capture phase). Ctrl/Meta + 's' 감지 시 `getSession(activeTabId)?.save()` 호출.

### 4.3 useI18n

**파일:** `hooks/useI18n.ts`

**목적:** 다국어 번역 함수 제공.

**파라미터:** 없음  
**반환:** `{ t, locale }`

| 필드 | 타입 | 설명 |
|------|------|------|
| `t` | `(key: TranslationKey, params?) => string` | 번역 함수. `@netior/shared/i18n`의 `translate` 래퍼 |
| `locale` | `Locale` | 현재 로케일 |

**사용 스토어:**
- `useSettingsStore.locale` -- 현재 로케일 구독

### 4.4 useNetiorSync

**파일:** `hooks/useNetiorSync.ts`

**목적:** MCP 서버 등 외부에서 DB가 변경되었을 때 렌더러 스토어를 자동 동기화.

**파라미터:** `projectId: string | null`  
**반환:** `void`

**사용 스토어:**
- `useSchemaStore.loadByProject`
- `useConceptStore.loadByProject`
- `useRelationTypeStore.loadByProject`
- `useCanvasTypeStore.loadByProject`
- `useCanvasStore.loadCanvases`, `useCanvasStore.openCanvas`

**동작:** `window.electron.mocSync.onChangeEvent` 리스너 등록. `NetiorChangeEvent.type`에 따라 해당 스토어 리로드:
- `'schemas'` -> schemaStore
- `'concepts'` -> conceptStore
- `'relationTypes'` -> relationTypeStore
- `'canvasTypes'` -> canvasTypeStore
- `'canvases'` -> canvasStore (목록 리로드)
- `'edges'` -> canvasStore (현재 캔버스 재오픈)

### 4.5 useTabDrag

**파일:** `hooks/useTabDrag.ts`

**목적:** 에디터 탭의 드래그 앤 드롭을 위한 유틸리티 함수 모음.

**export (함수):**

| 함수 | 설명 |
|------|------|
| `TAB_DRAG_TYPE` | MIME 타입 상수: `'application/x-netior-tab'` |
| `setTabDragData(e, tabId)` | DragEvent에 탭 ID 설정, effectAllowed='move' |
| `getTabDragData(e)` | DragEvent에서 탭 ID 추출 |
| `isTabDrag(e)` | DragEvent가 탭 드래그인지 확인 |

---

## 5. Lib

### 5.1 editor-session-registry.ts

**목적:** 에디터 세션(save/dirty/revert 핸들)을 전역 레지스트리에 등록/조회. `useEditorSession` 훅이 등록하고, `useGlobalSave`와 `editor-store`가 조회.

**EditorSessionHandle 인터페이스:**
```ts
interface EditorSessionHandle {
  save: () => Promise<void>;
  isDirty: () => boolean;
  revert: () => void;
}
```

**함수:**

| 함수 | 설명 |
|------|------|
| `registerSession(tabId, handle)` | 세션 핸들 등록 |
| `unregisterSession(tabId)` | 세션 핸들 제거 |
| `getSession(tabId)` | 세션 핸들 조회 |
| `hasUnsavedChanges(tabId)` | dirty 여부 확인 (미등록이면 false) |

### 5.2 terminal-tracker.ts

**목적:** PTY 세션의 생존 상태를 추적. 터미널 탭 닫기 시 확인 다이얼로그 표시 여부 결정에 사용.

**함수:**

| 함수 | 설명 |
|------|------|
| `initTerminalTracker()` | `window.electron.terminal.onStateChanged` 리스너 등록. 한 번만 초기화 |
| `isTerminalAlive(sessionId)` | 세션이 exited가 아닌지 확인 |
| `clearTerminalSession(sessionId)` | exited 목록에서 제거 |

**동작:** `running`/`starting`/`created` 상태면 alive, `exited` 상태면 dead로 추적.

### 5.3 claude-terminal-tracker.ts

**목적:** Claude Code 세션(터미널에서 실행되는 Claude Code CLI)의 상태를 추적.

**ClaudeTerminalState:**
```ts
interface ClaudeTerminalState {
  ptySessionId: string;
  claudeSessionId: string;
  status: ClaudeCodeStatus;
  sessionName: string | null;
}
```

**함수:**

| 함수 | 설명 |
|------|------|
| `initClaudeTerminalTracker()` | 3개 이벤트 리스너 등록: `onSessionEvent`(start/stop), `onStatusEvent`(status 변경), `onNameChanged`(이름 변경). 한 번만 초기화 |
| `getClaudeTerminalState(ptySessionId)` | 특정 세션의 Claude 상태 조회 |
| `getClaudeTrackerVersion()` | 상태 변경 카운터 반환 (useSyncExternalStore용) |
| `isClaudeTerminal(ptySessionId)` | Claude Code가 실행 중인 터미널인지 확인 |
| `subscribeClaudeTracker(callback)` | 상태 변경 구독. cleanup 함수 반환 |

**아키텍처:** 불변(immutable) Map 패턴 사용. 변경 시 새 Map 생성 + listener 알림. `useSyncExternalStore`와 호환되는 구조 (version + subscribe 패턴).

### 5.4 Terminal System (lib/terminal/)

세 파일로 구성된 터미널 시스템.

#### terminal-backend.ts

**목적:** Monaco 터미널 서비스의 백엔드 구현. PTY 프로세스를 IPC로 main 프로세스에 위임.

**주요 클래스:**

- **`NetiorTerminalProcess`** (implements `ITerminalChildProcess`): 개별 터미널 프로세스.
  - IPC 이벤트 리스너: `terminal.onData`, `terminal.onExit`, `terminal.onReady`, `terminal.onTitleChanged`
  - `start()`: `terminal.createInstance` + `terminal.attach` IPC 호출
  - `shutdown()`: `terminal.shutdown` IPC 호출
  - `input(data)`: `terminal.input` IPC 호출
  - `resize(cols, rows)`: `terminal.resize` IPC 호출
  - `sendSignal(signal)`: SIGINT -> Ctrl+C 입력, SIGTERM/SIGKILL -> shutdown

- **`NetiorTerminalBackend`** (extends `SimpleTerminalBackend`): 터미널 팩토리.
  - `getDefaultSystemShell()`: Windows -> PowerShell, 기타 -> /bin/bash
  - `createProcess(...)`: `NetiorTerminalProcess` 인스턴스 생성

**export:**
- `getTerminalBackend()`: 싱글턴 백엔드 인스턴스
- `SESSION_ENV_KEY`: `'MOC_TERMINAL_SESSION_ID'` -- 세션 ID를 환경변수로 전달

#### terminal-services.ts

**목적:** Monaco VSCode 서비스 초기화 + 터미널 인스턴스 관리 + 테마 동기화.

**주요 함수:**

| 함수 | 설명 |
|------|------|
| `ensureTerminalServices()` | Monaco 서비스 초기화 (한 번만). DOM 루트 생성, `initUserConfiguration`, `initialize`(configuration + theme + terminal overrides) 호출. 테마 변경 MutationObserver 설정 |
| `getTerminalService()` | 초기화 후 `ITerminalService` 반환 |
| `getOrCreateTerminalInstance(sessionId, cwd, title)` | 터미널 인스턴스 생성/재사용. `terminalInstances` Map으로 관리. dispose/exit 시 자동 제거 |
| `adjustTerminalFontSize(delta)` | 터미널 폰트 크기 조절 (8~28). Monaco user config 업데이트 |
| `resetTerminalFontSize()` | 폰트 크기 초기값(13)으로 리셋 |

**테마 동기화:** `buildTerminalUserConfiguration()`이 CSS 커스텀 프로퍼티에서 색상을 읽어 Monaco 터미널 테마로 변환. `MutationObserver`가 `data-mode`, `data-concept` 변경 감지 시 자동 업데이트.

#### terminal-link-parser.ts

**목적:** 터미널 출력에서 파일 경로 링크를 파싱.

**지원 패턴:**
- Windows 절대 경로: `C:\Users\foo\bar.ts`, `C:\...\bar.ts:42:10`, `C:\...\bar.ts(42,10)`
- Unix 절대 경로: `/home/user/bar.ts:42:10`
- 상대 경로: `./src/bar.ts:42`, `src/bar.ts:42`

**함수:**

| 함수 | 설명 |
|------|------|
| `extractFileLinks(text)` | 텍스트에서 모든 파일 링크 추출. `Array<FileLink & { start, end }>` 반환 |
| `extractFileLink(text, col)` | 특정 컬럼 위치의 파일 링크 반환 |

**FileLink 타입:**
```ts
interface FileLink {
  path: string;
  line?: number;
  col?: number;
}
```

---

## 6. Utils

### icon-resolver.tsx

**목적:** 문자열 아이콘 이름을 Lucide React 컴포넌트 또는 이모지로 렌더링.

**함수:**

| 함수 | 설명 |
|------|------|
| `resolveIcon(icon: string, size?: number)` | kebab-case 아이콘 이름 -> Lucide 컴포넌트. 매칭 실패 시 원본 문자열(이모지) 렌더링 |

**내부:** `toPascalCase`로 kebab->Pascal 변환, `ALIASES` 맵으로 예외 처리 (`'wand'` -> `'Wand2'`).

---

## 7. App Entry

### main.tsx

**엔트리 포인트.** `window.location.hash` 기반 라우팅:

- `#/detached/{tabId}/{title}` -> `DetachedEditorShell` (분리 에디터 윈도우)
- 그 외 -> `App` (메인 앱)

`ReactDOM.createRoot`로 `<React.StrictMode>` 래핑하여 마운트.

### App.tsx

**메인 앱 컴포넌트.** 모듈 레벨에서 트래커 초기화:
- `initTerminalTracker()` -- PTY 세션 상태 추적 시작
- `initClaudeTerminalTracker()` -- Claude Code 세션 상태 추적 시작

**컴포넌트 구조:**

```
App
├── TitleBar (커스텀 타이틀바)
│   ├── NetiorTitleMark (SVG 로고)
│   ├── 프로젝트 이름
│   ├── TitleBarBreadcrumb (캔버스 계층 네비게이션)
│   │   ├── 뒤로 가기 버튼 (canvasHistory 기반)
│   │   └── 브레드크럼 아이템들
│   ├── Close Project 버튼
│   └── 윈도우 컨트롤 (최소화/최대화/닫기)
├── 메인 콘텐츠 (flex-1)
│   ├── currentProject ? WorkspaceShell : ProjectHome
├── SettingsModal
└── ToastContainer
```

**사용 스토어:**
- `useProjectStore`: currentProject, closeProject
- `useCanvasStore`: breadcrumbs, canvasHistory, navigateToBreadcrumb, navigateBack
- `useUIStore`: showSettings, setShowSettings

**윈도우 컨트롤:** `window.electron.window.minimize/maximize/close` IPC 호출.

**TitleBar 특이사항:**
- `WebkitAppRegion: 'drag'` -- 프레임리스 윈도우의 드래그 영역
- `WebkitAppRegion: 'no-drag'` -- 클릭 가능한 버튼들은 드래그 제외
- DEV 환경에서 빨간 DEV 뱃지 표시
