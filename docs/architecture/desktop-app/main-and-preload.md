# desktop-app Main Process & Preload 레퍼런스

`packages/desktop-app` v0.1.6 — Electron 28 기반 데스크탑 앱의 메인 프로세스, 프리로드 브릿지, 프로세스 관리 전체 문서.

---

## 1. App Lifecycle

**파일**: `src/main/index.ts`

### 초기화 순서

```
app.whenReady()
├── 1. electronApp.setAppUserModelId('com.netior.app')
├── 2. Menu.setApplicationMenu(null)           // 기본 메뉴 제거
├── 3. initDatabase(dbPath, nativeBinding?)     // better-sqlite3 DB 초기화
│      └── DB 경로: %APPDATA%/netior/data/netior.db (prod) | netior-dev.db (dev)
├── 4. registerAllIpc()                         // 모든 IPC 핸들러 등록
├── 5. startNarreServer({ apiKey, dbPath, dataDir })  // Narre AI 에이전트 서버 spawn
├── 6. window:minimize/maximize/close IPC 등록   // 윈도우 컨트롤
├── 7. editor:detach/reattach IPC 등록           // 분리 에디터 윈도우
├── 8. createWindow()                           // BrowserWindow 생성
├── 9. ptyManager.init(mainWindow)              // 터미널 매니저 초기화
└── 10. hookServer.init() → start() → setupHookScript() → setupClaudeSettings()
```

### 윈도우 설정

| 속성 | 값 |
|------|-----|
| 기본 크기 | 1200 x 800 |
| 최소 크기 | 800 x 600 |
| frame | `false` (커스텀 타이틀바) |
| titleBarStyle | `hidden` |
| sandbox | `false` |
| contextIsolation | `true` |
| nodeIntegration | `false` |

- 윈도우 위치/크기는 DB `settings` 테이블에 JSON으로 저장 (`windowBounds` 키). 최대화 상태도 저장.
- 최대화 시 normal bounds를 `_lastNormalBounds`에 캐싱하여 복원 정확도 보장.
- 외부 링크는 `shell.openExternal`로 시스템 브라우저에서 열림.
- `Ctrl+=/- /0` 키 입력을 `before-input-event`에서 가로채 `terminal:font-size` 이벤트로 렌더러에 전달.

### 분리 에디터 윈도우

`editor:detach` 핸들러가 별도 `BrowserWindow`를 생성. URL 해시 `#/detached/{tabId}/{title}`로 라우팅. `detachedWindows` Map으로 관리. 닫히면 `editor:detached-closed` 이벤트를 메인 윈도우에 전송.

### 종료 순서

```
window-all-closed
├── ptyManager.killAll()
├── hookServer.stop()
├── stopNarreServer()
├── closeDatabase()
└── app.quit() (non-darwin)
```

### Native Binding 해결

`better-sqlite3.node` 파일을 두 경로에서 탐색:
1. `node_modules/better-sqlite3/build/Release/` (개발)
2. `resources/app.asar.unpacked/node_modules/...` (패키징)

---

## 2. IPC Channel Map

모든 핸들러는 `IpcResult<T>` (`{ success: true, data } | { success: false, error }`) 형식으로 응답.

### 2.1 Project (`project-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `project:create` | `data: { name, root_dir }` | `createProject(data)` | 프로젝트 생성 |
| `project:list` | — | `listProjects()` | 전체 프로젝트 목록 |
| `project:delete` | `id: string` | `deleteProject(id)` | 프로젝트 삭제 |
| `project:updateRootDir` | `id: string, rootDir: string` | `updateProjectRootDir(id, rootDir)` | 루트 디렉토리 변경 |

### 2.2 Concept (`concept-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `concept:create` | `data` | `createConcept(data)` | 개념 생성 |
| `concept:getByProject` | `projectId: string` | `getConceptsByProject(projectId)` | 프로젝트별 개념 목록 |
| `concept:update` | `id: string, data` | `updateConcept(id, data)` | 개념 수정 |
| `concept:delete` | `id: string` | `deleteConcept(id)` | 개념 삭제 |
| `concept:search` | `projectId: string, query: string` | `searchConcepts(projectId, query)` | 개념 검색 |

### 2.3 Concept Content (`concept-content-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `concept:syncToAgent` | `conceptId: string` | `serializeToAgent(data)` → `updateConcept()` | 개념 데이터를 agent_content로 직렬화 |
| `concept:syncFromAgent` | `conceptId: string, agentContent: string` | `parseFromAgent()` → `upsertProperty()` → `updateConcept()` | agent_content를 파싱하여 속성/콘텐츠/제목 업데이트 |

`loadConceptData()` 헬퍼: concept + schema + fields + properties를 직접 SQL로 조회하여 하나의 구조체로 반환.

### 2.4 Concept Property (`concept-property-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `conceptProp:upsert` | `data` | `upsertProperty(data)` | 속성 upsert |
| `conceptProp:getByConcept` | `conceptId: string` | `getByConceptId(conceptId)` | 개념별 속성 목록 |
| `conceptProp:delete` | `id: string` | `deleteProperty(id)` | 속성 삭제 |

### 2.5 Concept File (`concept-file-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `conceptFile:create` | `data` | `createConceptFile(data)` | 개념-파일 연결 생성 |
| `conceptFile:getByConcept` | `conceptId: string` | `getConceptFilesByConcept(conceptId)` | 개념별 연결된 파일 목록 |
| `conceptFile:delete` | `id: string` | `deleteConceptFile(id)` | 연결 삭제 |

### 2.6 Canvas (`canvas-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `canvas:create` | `data` | `createCanvas(data)` | 캔버스 생성 |
| `canvas:list` | `projectId: string, rootOnly?: boolean` | `listCanvases(projectId, rootOnly)` | 캔버스 목록 |
| `canvas:update` | `id: string, data` | `updateCanvas(id, data)` | 캔버스 수정 |
| `canvas:delete` | `id: string` | `deleteCanvas(id)` | 캔버스 삭제 |
| `canvas:getFull` | `canvasId: string` | `getCanvasFull(canvasId)` | 노드+엣지 포함 전체 캔버스 데이터 |
| `canvas:getByConcept` | `conceptId: string` | `getCanvasesByConceptId(conceptId)` | 개념별 캔버스 목록 |
| `canvas:getAncestors` | `canvasId: string` | `getCanvasAncestors(canvasId)` | 캔버스 조상 계층 |
| `canvas:getTree` | `projectId: string` | `getCanvasTree(projectId)` | 프로젝트 전체 캔버스 트리 |

### 2.7 Canvas Node (`canvas-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `canvasNode:add` | `data` | `addCanvasNode(data)` | 노드 추가 |
| `canvasNode:update` | `id: string, data` | `updateCanvasNode(id, data)` | 노드 수정 |
| `canvasNode:remove` | `id: string` | `removeCanvasNode(id)` | 노드 제거 |

### 2.8 Edge (`canvas-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `edge:create` | `data` | `createEdge(data)` | 엣지 생성 |
| `edge:get` | `id: string` | `getEdge(id)` | 엣지 조회 |
| `edge:update` | `id: string, data` | `updateEdge(id, data)` | 엣지 수정 |
| `edge:delete` | `id: string` | `deleteEdge(id)` | 엣지 삭제 |

### 2.9 Schema (`schema-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `schema:create` | `data` | `createSchema(data)` | schema 생성 |
| `schema:list` | `projectId: string` | `listSchemas(projectId)` | schema 목록 |
| `schema:get` | `id: string` | `getSchema(id)` | schema 조회 |
| `schema:update` | `id: string, data` | `updateSchema(id, data)` | schema 수정 |
| `schema:delete` | `id: string` | `deleteSchema(id)` | schema 삭제 |

### 2.10 Schema Field (`schema-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `schemaField:create` | `data` | `createField(data)` | 필드 생성 |
| `schemaField:list` | `schemaId: string` | `listFields(schemaId)` | 필드 목록 |
| `schemaField:update` | `id: string, data` | `updateField(id, data)` | 필드 수정 |
| `schemaField:delete` | `id: string` | `deleteField(id)` | 필드 삭제 |
| `schemaField:reorder` | `schemaId: string, orderedIds: string[]` | `reorderFields(schemaId, orderedIds)` | 필드 순서 변경 |

### 2.11 Relation Type (`relation-type-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `relationType:create` | `data` | `createRelationType(data)` | 관계 타입 생성 |
| `relationType:list` | `projectId: string` | `listRelationTypes(projectId)` | 관계 타입 목록 |
| `relationType:get` | `id: string` | `getRelationType(id)` | 관계 타입 조회 |
| `relationType:update` | `id: string, data` | `updateRelationType(id, data)` | 관계 타입 수정 |
| `relationType:delete` | `id: string` | `deleteRelationType(id)` | 관계 타입 삭제 |

### 2.12 Canvas Type (`canvas-type-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `canvasType:create` | `data` | `createCanvasType(data)` | 캔버스 타입 생성 |
| `canvasType:list` | `projectId: string` | `listCanvasTypes(projectId)` | 캔버스 타입 목록 |
| `canvasType:get` | `id: string` | `getCanvasType(id)` | 캔버스 타입 조회 |
| `canvasType:update` | `id: string, data` | `updateCanvasType(id, data)` | 캔버스 타입 수정 |
| `canvasType:delete` | `id: string` | `deleteCanvasType(id)` | 캔버스 타입 삭제 |
| `canvasType:addRelation` | `canvasTypeId: string, relationTypeId: string` | `addAllowedRelation(canvasTypeId, relationTypeId)` | 허용 관계 추가 |
| `canvasType:removeRelation` | `canvasTypeId: string, relationTypeId: string` | `removeAllowedRelationByPair(canvasTypeId, relationTypeId)` | 허용 관계 제거 |
| `canvasType:listRelations` | `canvasTypeId: string` | `listAllowedRelations(canvasTypeId)` | 허용 관계 목록 |

### 2.13 Module (`module-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `module:create` | `data` | `createModule(data)` | 모듈 생성 |
| `module:list` | `projectId: string` | `listModules(projectId)` | 모듈 목록 |
| `module:update` | `id: string, data` | `updateModule(id, data)` | 모듈 수정 |
| `module:delete` | `id: string` | `deleteModule(id)` | 모듈 삭제 |

### 2.14 Module Directory (`module-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `moduleDir:add` | `data` | `addModuleDirectory(data)` | 디렉토리 추가 |
| `moduleDir:list` | `moduleId: string` | `listModuleDirectories(moduleId)` | 디렉토리 목록 |
| `moduleDir:remove` | `id: string` | `removeModuleDirectory(id)` | 디렉토리 제거 |
| `moduleDir:updatePath` | `id: string, dirPath: string` | `updateModuleDirectoryPath(id, dirPath)` | 디렉토리 경로 변경 |

### 2.15 Editor Prefs (`editor-prefs-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `editorPrefs:get` | `conceptId: string` | `getEditorPrefs(conceptId)` | 에디터 설정 조회 |
| `editorPrefs:upsert` | `conceptId: string, data` | `upsertEditorPrefs(conceptId, data)` | 에디터 설정 upsert |

### 2.16 Config (`config-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `config:get` | `key: string` | `getSetting(key)` | 설정값 조회 |
| `config:set` | `key: string, value: unknown` | `setSetting(key, ...)` | 설정값 저장 |

### 2.17 File System (`fs-ipc.ts`)

| 채널 | 파라미터 | 호출 함수 | 설명 |
|------|----------|-----------|------|
| `fs:readDir` | `dirPath: string` | `buildFileTree(dirPath)` | 전체 재귀 파일 트리 |
| `fs:readDirShallow` | `dirPath: string, depth?: number` | `buildShallowTree(dirPath, depth meaning binding 2)` | 깊이 제한 트리 (기본 2) |
| `fs:readFile` | `filePath: string` | `readFile(filePath, 'utf-8')` | 텍스트 파일 읽기 |
| `fs:readBinaryFile` | `filePath: string` | `readFile(filePath)` → `Uint8Array` | 바이너리 파일 읽기 |
| `fs:writeFile` | `filePath: string, content: string` | `writeFile(filePath, content, 'utf-8')` | 파일 쓰기 |
| `fs:openDialog` | `options?: { properties, title, filters }` | `dialog.showOpenDialog(...)` | 네이티브 파일/폴더 선택 대화상자 |
| `fs:rename` | `oldPath: string, newPath: string` | `rename(oldPath, newPath)` | 이름 변경 (대상 존재 시 실패) |
| `fs:delete` | `targetPath: string` | `shell.trashItem(targetPath)` | 휴지통으로 이동 |
| `fs:stashDelete` | `targetPath: string` | app userData의 undo stash로 `rename()` | File Tree undo용 삭제 스테이징 |
| `fs:restoreDeleted` | `stashPath: string, originalPath: string` | stash → 원래 경로 `rename()` | stashed 삭제 복원 |
| `fs:createFile` | `filePath: string` | `mkdir` + `writeFile('')` | 빈 파일 생성 (이미 존재 시 실패) |
| `fs:createDir` | `dirPath: string` | `mkdir(dirPath, { recursive: true })` | 디렉토리 생성 |
| `fs:copy` | `src: string, dest: string` | `cp/copyFile` | 파일/디렉토리 복사. 동일 경로/대상 중복/자기 하위 폴더 복사 차단 |
| `fs:move` | `src: string, dest: string` | `rename(src, dest)` | 파일/디렉토리 이동. 동일 경로/대상 중복/자기 하위 폴더 이동 차단 |
| `fs:showInExplorer` | `targetPath: string` | `shell.showItemInFolder(targetPath)` | 탐색기에서 보기 |
| `fs:exists` | `targetPath: string` | `existsSync(targetPath)` | 존재 여부 확인 |
| `fs:hasClipboardFiles` | - | Windows `FileNameW` clipboard 검사 | 시스템 파일 붙여넣기 가능 여부 |
| `fs:hasClipboardImage` | - | `clipboard.readImage()` | 시스템 이미지 붙여넣기 가능 여부 |
| `fs:readClipboardFiles` | - | Windows `FileNameW` decode | 시스템 클립보드 파일 목록 읽기 |
| `fs:saveClipboardImage` | `filePath: string` | `clipboard.readImage().toPNG()` | 클립보드 이미지를 PNG 파일로 저장 |

### 2.18 Terminal / PTY (`pty-ipc.ts`)

| 채널 | 방식 | 파라미터 | 호출 함수 | 설명 |
|------|------|----------|-----------|------|
| `terminal:createInstance` | handle | `sessionId, launchConfig` | `createInstance(sessionId, launchConfig)` | PTY 세션 생성 |
| `terminal:getSession` | handle | `sessionId` | `getSession(sessionId)` | 세션 정보 조회 |
| `terminal:attach` | handle | `sessionId` | `attach(sessionId)` | PTY 프로세스 spawn & 연결 |
| `terminal:input` | on (fire-and-forget) | `sessionId, data` | `input(sessionId, data)` | 키 입력 전달 |
| `terminal:resize` | on (fire-and-forget) | `sessionId, cols, rows` | `resize(sessionId, cols, rows)` | 터미널 크기 변경 |
| `terminal:shutdown` | handle | `sessionId` | `shutdown(sessionId)` | 세션 종료 |

### 2.19 Narre AI (`narre-ipc.ts`)

| 채널 | 파라미터 | 호출 함수/로직 | 설명 |
|------|----------|---------------|------|
| `narre:listSessions` | `projectId: string` | 파일 기반 세션 인덱스 조회 | 세션 목록 (최신순) |
| `narre:createSession` | `projectId: string` | `randomUUID()` → 파일 생성 | 새 세션 생성 |
| `narre:getSession` | `sessionId: string` | 전체 프로젝트 디렉토리 스캔 | 세션 상세 조회 |
| `narre:deleteSession` | `sessionId: string` | 인덱스 + 파일 삭제 | 세션 삭제 |
| `narre:getApiKeyStatus` | — | `getSetting('anthropic_api_key')` | API 키 설정 여부 |
| `narre:setApiKey` | `key: string` | `setSetting()` + `startNarreServer()` | API 키 저장 & 서버 시작 |
| `narre:searchMentions` | `projectId: string, query: string` | concept/schema/relationType/canvasType/canvas 검색 | 멘션 자동완성 (최대 30개) |
| `narre:sendMessage` | `{ sessionId, projectId, message, mentions }` | HTTP POST `localhost:3100/chat` → SSE 스트리밍 | 메시지 전송 |
| `narre:respondCard` | `{ toolCallId, response }` | HTTP POST `localhost:3100/chat/respond` | UI 카드 응답 전송 |
| `narre:executeCommand` | `{ projectId, command, args }` | HTTP POST `localhost:3100/command` → SSE 스트리밍 | 슬래시 커맨드 실행 |

**Narre SSE 중계 패턴**: `narre:sendMessage`와 `narre:executeCommand`는 즉시 `{ success: true, data: null }`을 반환. narre-server로부터 SSE 이벤트를 수신하면 `narre:streamEvent` 채널로 렌더러에 forward.

**프로젝트 메타데이터 주입**: `narre:sendMessage`에서 schema/relationType/canvasType 목록을 DB에서 조회하여 `projectMetadata`로 narre-server `/chat` body에 포함. narre-server는 DB에 직접 접근하지 않으므로 이 방식이 필수.

### 2.20 Window Control (`index.ts` 인라인)

| 채널 | 방식 | 설명 |
|------|------|------|
| `window:minimize` | on | 윈도우 최소화 |
| `window:maximize` | on | 최대화 토글 |
| `window:close` | on | 윈도우 닫기 |

### 2.21 Editor Window (`index.ts` 인라인)

| 채널 | 방식 | 설명 |
|------|------|------|
| `editor:detach` | handle | 분리 에디터 윈도우 생성 |
| `editor:reattach` | on | 분리 윈도우를 메인으로 복귀 |

### 2.22 Main → Renderer 이벤트 (단방향)

| 채널 | 발신자 | 설명 |
|------|--------|------|
| `terminal:data` | pty-manager | PTY 출력 데이터 |
| `terminal:ready` | pty-manager | PTY 프로세스 시작 완료 |
| `terminal:exit` | pty-manager | PTY 프로세스 종료 |
| `terminal:titleChanged` | pty-manager | 터미널 제목 변경 |
| `terminal:stateChanged` | pty-manager | 세션 상태 변경 (created/starting/running/exited) |
| `terminal:font-size` | index.ts (before-input-event) | Ctrl+=/- 키 이벤트 |
| `narre:streamEvent` | narre-ipc | Narre SSE 이벤트 중계 |
| `claude:sessionEvent` | hook-server | Claude Code 세션 시작/종료 |
| `claude:statusEvent` | hook-server | Claude Code 상태 (idle/working) |
| `claude:nameChanged` | hook-server | Claude Code 세션 이름 변경 |
| `editor:detached-closed` | index.ts | 분리 에디터 윈도우 닫힘 |
| `editor:reattach-to-mode` | index.ts | 분리 에디터 복귀 명령 |
| `netior:change` | (placeholder) | MCP 변경 이벤트 (미구현) |

---

## 3. Preload Bridge

**파일**: `src/preload/index.ts`

`contextBridge.exposeInMainWorld('electron', electronAPI)`로 노출. 타입: `ElectronAPI`.

### 네임스페이스 구조

| 네임스페이스 | 메서드 | IPC 방식 |
|-------------|--------|----------|
| **window** | `minimize()`, `maximize()`, `close()`, `isMaximized()` | `send` / `invoke` |
| **project** | `create(data)`, `list()`, `delete(id)`, `updateRootDir(id, rootDir)` | `invoke` |
| **concept** | `create(data)`, `getByProject(projectId)`, `update(id, data)`, `delete(id)` | `invoke` |
| **canvas** | `create(data)`, `list(projectId, rootOnly?)`, `update(id, data)`, `delete(id)`, `getFull(canvasId)`, `getByConcept(conceptId)`, `getAncestors(canvasId)`, `getTree(projectId)` | `invoke` |
| **canvasNode** | `add(data)`, `update(id, data)`, `remove(id)` | `invoke` |
| **edge** | `create(data)`, `get(id)`, `update(id, data)`, `delete(id)` | `invoke` |
| **conceptFile** | `create(data)`, `getByConcept(conceptId)`, `delete(id)` | `invoke` |
| **module** | `create(data)`, `list(projectId)`, `update(id, data)`, `delete(id)` | `invoke` |
| **moduleDir** | `add(data)`, `list(moduleId)`, `remove(id)`, `updatePath(id, dirPath)` | `invoke` |
| **schema** | `create(data)`, `list(projectId)`, `get(id)`, `update(id, data)`, `delete(id)`, `createField(data)`, `listFields(schemaId)`, `updateField(id, data)`, `deleteField(id)`, `reorderFields(schemaId, orderedIds)` | `invoke` |
| **canvasType** | `create(data)`, `list(projectId)`, `get(id)`, `update(id, data)`, `delete(id)`, `addRelation(canvasTypeId, relationTypeId)`, `removeRelation(canvasTypeId, relationTypeId)`, `listRelations(canvasTypeId)` | `invoke` |
| **relationType** | `create(data)`, `list(projectId)`, `get(id)`, `update(id, data)`, `delete(id)` | `invoke` |
| **conceptProp** | `upsert(data)`, `getByConcept(conceptId)`, `delete(id)` | `invoke` |
| **conceptContent** | `syncToAgent(conceptId)`, `syncFromAgent(conceptId, agentContent)` | `invoke` |
| **editorPrefs** | `get(conceptId)`, `upsert(conceptId, data)` | `invoke` |
| **fs** | `readDir(dirPath)`, `readDirShallow(dirPath, depth?)`, `readFile(filePath)`, `readBinaryFile(filePath)`, `writeFile(filePath, content)`, `openDialog(options?)`, `rename(oldPath, newPath)`, `delete(targetPath)`, `stashDelete(targetPath)`, `restoreDeleted(stashPath, originalPath)`, `createFile(filePath)`, `createDir(dirPath)`, `copy(src, dest)`, `move(src, dest)`, `showInExplorer(targetPath)`, `exists(targetPath)`, `hasClipboardFiles()`, `hasClipboardImage()`, `readClipboardFiles()`, `saveClipboardImage(filePath)` | `invoke` |
| **config** | `get(key)`, `set(key, value)` | `invoke` |
| **terminal** | `createInstance(sessionId, launchConfig)`, `getSession(sessionId)`, `attach(sessionId)`, `shutdown(sessionId)`, `input(sessionId, data)`, `resize(sessionId, cols, rows)`, `getWindowsBuildNumber()` | `invoke` / `send` |
| **terminal** (이벤트) | `onExit(cb)`, `onReady(cb)`, `onData(cb)`, `onTitleChanged(cb)`, `onStateChanged(cb)`, `onFontSizeKey(cb)` | `on` (리스너 등록, 해제 함수 반환) |
| **claude** (이벤트) | `onSessionEvent(cb)`, `onStatusEvent(cb)`, `onNameChanged(cb)` | `on` |
| **narre** | `listSessions(projectId)`, `createSession(projectId)`, `getSession(sessionId)`, `deleteSession(sessionId)`, `getApiKeyStatus()`, `setApiKey(key)`, `searchMentions(projectId, query)`, `sendMessage(data)`, `respondToCard(data)`, `executeCommand(data)` | `invoke` |
| **narre** (이벤트) | `onStreamEvent(cb)` | `on` |
| **mocSync** (이벤트) | `onChangeEvent(cb)` | `on` |
| **editor** | `detach(tabId, title)`, `reattach(tabId, mode)` | `invoke` / `send` |
| **editor** (이벤트) | `onDetachedClosed(cb)`, `onReattachToMode(cb)` | `on` |

**이벤트 리스너 패턴**: 모든 `on*` 메서드는 cleanup 함수를 반환. `ipcRenderer.on`으로 등록하고 반환된 함수 호출 시 `removeListener`로 해제.

**유틸리티**: `terminal.getWindowsBuildNumber()` — Windows 빌드 번호 반환 (ConPTY 호환성 확인용). `os.release()` 파싱.

---

## 4. Process Management — Narre Server

**파일**: `src/main/process/narre-server-manager.ts`

### 모듈 경로 탐색

`resolveNarreServerPath()`가 4개 후보 경로를 순서대로 확인:
1. `__dirname/../../../../narre-server/dist/index.js`
2. `__dirname/../../../narre-server/dist/index.js`
3. `cwd()/packages/narre-server/dist/index.js`
4. `require.resolve('@netior/narre-server/dist/index.js')` (fallback)

### Spawn

```typescript
spawn('node', [modulePath], {
  env: {
    ...process.env,
    ANTHROPIC_API_KEY: config.apiKey,
    MOC_DB_PATH: config.dbPath,
    MOC_DATA_DIR: config.dataDir,
    PORT: '3100',  // 기본 포트
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});
```

### 생명주기

- **시작 조건**: `apiKey`가 비어 있어도 시작 (OAuth fallback). 이미 실행 중이면 무시.
- **재시작**: `narre:setApiKey`에서 API 키 설정 시 `isNarreServerRunning()`이 false면 자동 시작.
- **종료**: `stopNarreServer()` — `process.kill()` 호출. 앱 종료 시 `window-all-closed`에서 호출.
- **크래시 처리**: `exit` 이벤트에서 `narreProcess = null` 설정. 자동 재시작 로직 없음.
- **로깅**: stdout/stderr를 `[narre-server:stdout/stderr]` 프리픽스로 콘솔 출력.

---

## 5. PTY Manager

**파일**: `src/main/pty/pty-manager.ts`

### 셸 해결 (resolveShell)

1. `launchConfig.shell`이 지정되면 해당 셸 사용
2. `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe` 존재 시 PowerShell
3. `process.env.COMSPEC` 또는 `cmd.exe` fallback

### 세션 생명주기

| 상태 | 설명 |
|------|------|
| `created` | `createInstance()` 호출. IPty 프로세스 미생성. 메타데이터만 존재. |
| `starting` | `attach()` 호출. `pty.spawn()` 직후. |
| `running` | PTY 프로세스 정상 실행 중. `terminal:ready` 이벤트 전송. |
| `exited` | PTY 프로세스 종료. `terminal:exit` 이벤트 전송. |

### 주요 동작

- **createInstance**: 세션 ID로 `TerminalSessionInfo` 생성. 이미 존재하면 기존 정보 반환.
- **attach**: `pty.spawn()` 실행. 환경변수에 `NETIOR_PTY_ID=sessionId` 주입 (Hook Server 연동용). `useConpty: true`.
- **input/resize**: fire-and-forget (`ipcMain.on`). 실행 중인 PTY 프로세스에 직접 전달.
- **shutdown**: `process.kill()` + 세션 Map에서 삭제.
- **killAll**: 앱 종료 시 모든 세션 종료.

### 이벤트 발행

`TerminalBackendService.send()`가 `mainWindow.webContents.send()`로 렌더러에 이벤트 전달. 윈도우가 파괴되었으면 무시.

---

## 6. MCP Subscriber

**파일**: `src/main/sync/netior-mcp-subscriber.ts`

**현재 상태**: 플레이스홀더. `startMocMcpSubscriber()`와 `stopMocMcpSubscriber()` 함수가 정의되어 있으나 실제 구현 없음.

**계획**: netior-mcp의 `/events` SSE 엔드포인트가 HTTP transport로 구현되면 연결 예정. 현재는 Narre의 도구 실행 후 `refreshStores()` 호출로 Zustand 스토어를 직접 refetch하는 방식.

---

## 7. Hook Server

**파일**: `src/main/hook-server/hook-server.ts`, `hook-setup.ts`

### 목적

Netior 내장 터미널에서 실행되는 Claude Code의 세션 이벤트를 캡처하여 렌더러에 전달. 터미널 탭에서 Claude Code 세션 상태(idle/working)와 세션 이름을 실시간 표시.

### 아키텍처

```
Claude Code (Netior PTY 내부)
  → hooks 실행 (SessionStart/SessionEnd/UserPromptSubmit/Stop)
    → node netior-session-hook.mjs [start|stop|prompt|response-stop]
      → HTTP POST localhost:{random-port}/hook/*
        → HookServer
          → mainWindow.webContents.send('claude:*')
            → Renderer
```

### HTTP 엔드포인트

| 경로 | Payload | 동작 |
|------|---------|------|
| `/hook/session-start` | `{ netior_pty_id, session_id }` | PTY-Claude 세션 매핑 저장, `claude:sessionEvent` 전송, 세션 파일 감시 시작 |
| `/hook/session-stop` | `{ netior_pty_id }` | 감시자 정리, 매핑 삭제, `claude:sessionEvent` 전송 |
| `/hook/prompt-submit` | `{ netior_pty_id }` | `claude:statusEvent` (working) 전송 |
| `/hook/stop` | `{ netior_pty_id }` | `claude:statusEvent` (idle) 전송 |

### 세션 파일 감시

`watchSessionFile()`이 `~/.claude/sessions/` 디렉토리를 `fs.watch()`로 감시. JSON 파일에서 `sessionId` 일치하는 항목의 `name` 필드 변경을 감지하여 `claude:nameChanged` 이벤트 전송.

### Hook Script 생성 (`hook-setup.ts`)

`setupHookScript(port)` — `%APPDATA%/netior/data/hooks/netior-session-hook.mjs` (또는 dev 환경에서 `netior-dev-session-hook.mjs`) 파일을 자동 생성. 스크립트는:
- `NETIOR_PTY_ID` 환경변수가 없으면 즉시 종료 (Netior PTY 외부에서는 무동작)
- stdin에서 Claude Code가 전달하는 JSON 읽기
- 2초 타임아웃으로 HookServer에 HTTP POST

### Claude Settings 등록 (`setupClaudeSettings`)

`~/.claude/settings.json`의 `hooks` 섹션에 4개 이벤트 등록:
- `SessionStart` → `node "{hookPath}" start`
- `SessionEnd` → `node "{hookPath}" stop`
- `UserPromptSubmit` → `node "{hookPath}" prompt`
- `Stop` → `node "{hookPath}" response-stop`

기존 등록이 있으면 경로만 업데이트 (stale path 감지). 파일이 없거나 손상되면 새로 생성.

---

## 8. Build Config

**파일**: `electron.vite.config.ts`

### Main Process

| 설정 | 값 |
|------|-----|
| `externalizeDepsPlugin` | `@netior/shared`, `@netior/core` 제외 (번들에 포함) |
| `@main` | `src/main` |
| `@shared` | `src/shared` |
| `@netior/shared` | `../shared/src` |
| `@netior/core` | `../netior-core/src` |

### Preload

- `externalizeDepsPlugin()` 기본 설정 (모든 의존성 외부화)

### Renderer

| 설정 | 값 |
|------|-----|
| `@renderer` | `src/renderer` |
| `@shared` | `src/shared` |
| `@netior/shared` | `../shared/src` |
| Monaco CSS 경로 | `@codingame/monaco-vscode-api/.../cssValue` → 실제 JS 파일 경로 |
| Plugin | `@vitejs/plugin-react` |

### 패키징 (package.json `build`)

- **appId**: `com.netior.app`
- **Output**: `release/`
- **asarUnpack**: `better-sqlite3`, `bindings`, `file-uri-to-path`, `node-pty` (네이티브 모듈)
- **Windows**: NSIS 인스톨러, 설치 경로 변경 가능, 앱데이터 삭제 안 함

### 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `better-sqlite3` | SQLite DB |
| `node-pty` | 터미널 PTY |
| `@xterm/xterm` (beta) | 터미널 UI |
| `zustand` | 상태 관리 |
| `react-pdf` | PDF 뷰어 |
| `@codemirror/*` / `@codingame/monaco-*` | 에디터 |
| `electron` 28 | 런타임 |
| `electron-vite` 2 | 빌드 도구 |
