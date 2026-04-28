# Desktop App Renderer Components

## 1. Component Tree

```
App
 +-- ProjectHome                         # 프로젝트 미선택 시
 |    +-- ProjectCard
 |    +-- ProjectCreateDialog
 |
 +-- WorkspaceShell                      # 프로젝트 열림 시
      +-- ActivityBar                    # 좌측 40px 아이콘 바
      +-- Sidebar                        # 토글 가능한 사이드바
      |    +-- CanvasList                # canvases 뷰
      |    +-- FileTree + ModuleSelector # files 뷰
      |    +-- SchemaList             # schemas 뷰
      |    +-- RelationTypeList
      |    +-- CanvasTypeList
      |
      +-- ConceptWorkspace              # 캔버스 영역
      |    +-- CanvasControls (workspace)
      |    +-- Background / plugin.BackgroundComponent
      |    +-- EdgeLayer
      |    |    +-- EdgeLine (per edge)
      |    +-- NodeLayer
      |    |    +-- NodeCardDefault (per node)
      |    |         +-- ShapeLayout (per shape)
      |    +-- plugin.OverlayComponent (optional, e.g. TimelineOverlay)
      |    +-- NodeContextMenu
      |    +-- CanvasContextMenu
      |    +-- EdgeContextMenu
      |    +-- FileNodeAddModal
      |    +-- CanvasBreadcrumb
      |    +-- SelectionBox
      |
      +-- Side Editor (side 모드)
      |    +-- SplitPaneRenderer
      |         +-- EditorTabStrip
      |         +-- EditorContent
      |         +-- DropZoneOverlay
      |
      +-- FullModeEditor (full 모드)
      |    +-- SplitPaneRenderer
      |         +-- EditorTabStrip
      |         +-- EditorContent
      |         +-- DropZoneOverlay
      |
      +-- FloatWindowLayer
      |    +-- FloatWindow (per float tab)
      |         +-- EditorContent
      |
      +-- EditorDockBar (최소화된 탭)
      +-- CloseConfirmDialog
      +-- SettingsModal

EditorContent (라우터)
 +-- ConceptEditor
 |    +-- ConceptBodyEditor -> ContentEditableEditor
 |    +-- ConceptPropertiesPanel -> FieldInput
 |    +-- ConceptAgentView
 +-- FileEditor
 |    +-- MarkdownEditor -> CodeMirror + MarkdownToc
 |    +-- CodeEditor -> Monaco
 |    +-- ImageViewer
 |    +-- PdfViewer
 |    +-- UnsupportedFallback
 +-- SchemaEditor -> SchemaFieldRow
 +-- RelationTypeEditor
 +-- CanvasTypeEditor
 +-- EdgeEditor
 +-- CanvasEditor
 +-- TerminalEditor -> TerminalSearchBar
 +-- NarreEditor
      +-- NarreSessionList
      +-- NarreChat
           +-- NarreMessageBubble
           |    +-- NarreMarkdown
           |    +-- NarreToolLog
           |    +-- NarreCardRenderer
           |         +-- ProposalCard
           |         +-- PermissionCard
           |         +-- InterviewCard
           |         +-- SummaryCard
           +-- NarreMentionInput
                +-- NarreMentionPicker
                +-- NarreSlashPicker
```

---

## 2. Canvas Components

`packages/desktop-app/src/renderer/components/canvas/`

### Canvas.tsx

범용 캔버스 컴포넌트 (previous). `ConceptWorkspace`가 실제 사용하는 메인 캔버스이며, 이 파일은 하위 호환용.

- **역할**: Background + EdgeLayer + NodeLayer + SelectionBox + CanvasControls를 조합
- **주요 props**: `nodes`, `edges`, `layoutNodes`, `zoom`, `panOffset`, `mode`, `selectedIds` 등
- **상호작용**: `useInteraction` 훅으로 pan/node-drag/selection-box/wheel 제스처 처리
- **줌 동작**: wheel → zoom-toward-cursor (커서 위치를 기준으로 줌)

### CanvasControls.tsx (canvas/)

캔버스 상단 우측 컨트롤 바.

- **역할**: 모드 토글(browse/edit), 뒤로/앞으로 네비게이션, Undo/Redo, 줌 In/Out/Fit, BackToOverview
- **구분**: browse 모드에서는 네비게이션 버튼, edit 모드에서는 Undo/Redo 버튼 표시
- **스토어**: 직접 읽지 않음 (props로 전달)

### ContextMenu.tsx (canvas/)

범용 컨텍스트 메뉴 컴포넌트.

- **역할**: Portal로 document.body에 렌더링. items 배열 → 메뉴 아이템
- **props**: `x`, `y`, `items: ContextMenuItem[]`, `onClose`
- **닫기**: 외부 클릭 또는 Escape

### EdgeLine.tsx

SVG 엣지 렌더링 컴포넌트.

- **역할**: 두 노드 간 직선 엣지. hover시 라벨 표시, directed시 화살표
- **props**: `sourceX/Y`, `targetX/Y`, `directed`, `label`, `color`, `lineStyle`
- **히트 영역**: 투명 12px 넓이 선으로 클릭 영역 확보
- **line_style**: solid/dashed/dotted → strokeDasharray 변환

### SearchBar.tsx

캔버스 내 노드 검색 바.

- **역할**: 텍스트 검색 + semantic type 필터
- **props**: `query`, `filterSemanticType`, `semanticTypes`, `onQueryChange`, `onFilterChange`, `onClose`

### SelectionBox.tsx

드래그 선택 영역 표시.

- **역할**: Shift+드래그 시 나타나는 파란색 점선 사각형
- **props**: `startX/Y`, `currentX/Y`

---

## 3. Node Shape System

### NodeShape 타입

8종: `circle`, `gear`, `stadium`, `pormodel`, `dashed`, `wide`, `rectangle`, `square`

### NodeCardDefault.tsx

모든 노드의 기본 렌더링 컴포넌트.

- **역할**: 외형(outline) + 내부 레이아웃(ShapeLayout) 분리
- **외형 결정**: `getShapeOutline(shape)` — circle/stadium → `rounded-full`, gear → clip-path, dashed → 점선 테두리, 나머지 → `rounded-lg`
- **내부 레이아웃**: `getShapeLayout(shape)` → 해당 Layout 컴포넌트
- **상태 표시**: selected → accent border + shadow, highlighted → warning border
- **Span 리사이즈**: edit 모드 + spanInfo 존재 시 좌/우 핸들 표시

### 7개 Layout 컴포넌트 (`layouts/`)

| Layout | Shape | 구조 | 용도 |
|--------|-------|------|------|
| `IconOnlyLayout` | circle, gear | 아이콘만 중앙 배치 | 아이콘 전용 노드 |
| `RectangleLayout` | rectangle | 아이콘 + label + semanticTypeLabel (가로) | config/event/기본 노드. config일 때 타입 라벨 숨김 |
| `StadiumLayout` | stadium | 아이콘 + label + semanticTypeLabel (가로 컴팩트) | entity 노드 |
| `PormodelLayout` | pormodel | 아이콘 + label + semanticTypeLabel + updatedAt (세로) | 콘텐츠 노드 |
| `DashedLayout` | dashed | 아이콘 + label + semanticTypeLabel + field count | 템플릿 노드 |
| `WideLayout` | wide | 아이콘(24px) + label + semanticTypeLabel (가로, 넓은 패딩) | container/span 노드 |
| `SquareLayout` | square | 아이콘 + label (세로, 정사각형) | 에셋 노드 |

### registry.ts

노드 컴포넌트 레지스트리. 3단계 확장 구조 (Level 1: default, Level 2: app, Level 3: culture).

- `registerNodeComponent(key, component)`: 컴포넌트 등록
- `getNodeComponent(key)`: 키로 조회, 없으면 default 반환
- 현재 `default` = `NodeCardDefault`만 등록

### layouts/index.ts

Shape → Layout 매핑.

```
circle, gear     → IconOnlyLayout
stadium          → StadiumLayout
pormodel         → PormodelLayout
dashed           → DashedLayout
wide             → WideLayout
rectangle        → RectangleLayout
square           → SquareLayout
```

---

## 4. Canvas Layout Algorithms

`packages/desktop-app/src/renderer/components/canvas/layout/`

이 디렉토리의 레이아웃은 previous 시스템. 현재는 `workspace/layout-plugins/`가 실제 사용됨.

### types.ts

- `LayoutNode`: id, x?, y?, systemType?, semanticType?, metadata?
- `LayoutEdge`: source, target, directed
- `LayoutResult`: nodeId → {x, y}
- `LayoutContext`: mode(overview/focus), focusNodeId, parentNodeIds, primaryParentId
- `LayoutOptions`: width, height, padding, context

### focus-layout.ts

포커스 노드 중심 배치.

- **알고리즘**: 포커스 노드를 중앙 상단에 배치, 부모 노드를 위에, 연결 노드를 아래 반원형으로 배치
- **부모 배치**: primary parent → 수직 위, 나머지 → 좌우 교대 대각선
- **연결 노드**: 30도~150도 반원에 균등 분포 (SPREAD_RADIUS=200)
- **미연결 노드**: 하단에 배치

### graph-layout.ts

Force-directed 알고리즘.

- **반발력**: 모든 노드 쌍 간 REPULSION=5000/(dist^2)
- **인력**: 연결된 노드 간 ATTRACTION=0.01
- **감쇠**: DAMPING=0.9, 50 iteration
- **경계 제한**: bounds 또는 캔버스 전체
- **이미 위치 있는 노드**: fixed=true로 고정

### grid-layout.ts

행/열 그리드 배치.

- **알고리즘**: 가용 너비에서 열 수 계산 → 순서대로 채워넣기
- NODE_WIDTH=160, NODE_HEIGHT=60, GAP=40

### overview-layout.ts

영역 기반 배치. 3종류 노드를 구분.

1. **config 노드**: 상단 수평 중앙 정렬
2. **container 노드**: 트리 구조로 배치 (부모→자식, directed edge 기반)
3. **나머지 노드**: force-directed로 오른쪽 영역에 배치

### tree-layout.ts

계층 트리 배치. directed edge의 source→target 방향으로 위→아래 정렬.

- **루트 결정**: 부모가 없는 노드 (순환 시 첫 번째 노드)
- **BFS로 레벨 할당** → 레벨별 수평 중앙 정렬
- LEVEL_GAP=100, SIBLING_GAP=40

---

## 5. Editor Components

`packages/desktop-app/src/renderer/components/editor/`

### EditorContent.tsx

에디터 라우터. `tab.type`에 따라 적절한 에디터 컴포넌트로 분기.

- concept → ConceptEditor
- file → FileEditor
- schema → SchemaEditor
- terminal → TerminalEditor
- relationType → RelationTypeEditor
- canvasType → CanvasTypeEditor
- edge → EdgeEditor
- canvas → CanvasEditor
- narre → NarreEditor

### ConceptEditor.tsx

개념(Concept) 편집기. 가장 복잡한 에디터.

- **상태 관리**: `useEditorSession` 훅으로 load/save/dirty 관리
- **드래프트 지원**: `draft-` 접두어 탭 → 새 개념 생성 모드. 저장 시 createConcept → 캔버스에 노드 추가 → 실제 탭으로 전환
- **뷰 모드**: Human / Agent 토글 (기존 개념만)
- **Schema 선택**: 변경 시 아이콘/색상 기본값 적용, 필드 동적 로드
- **Properties**: `ConceptPropertiesPanel` → `FieldInput`으로 16종 필드 타입 지원
- **Body**: `ConceptBodyEditor` → `ContentEditableEditor` (contentEditable div, 300ms 디바운스)
- **첨부 파일**: ConceptFile 목록 표시, 클릭 시 파일 에디터 열기
- **스토어**: conceptStore, schemaStore, editorStore, projectStore, canvasStore

### ConceptPropertiesPanel.tsx + FieldInput

Schema의 필드 스키마에 따라 동적 입력 폼 생성.

지원 필드 타입 (16종):
text, textarea, number, boolean, date, datetime, select, multi-select, radio, relation, file, url, color, rating, tags + default fallback

각 타입이 대응하는 UI 컴포넌트: Input, TextArea, NumberInput, Toggle, DatePicker, Select, MultiSelect, RadioGroup, RelationPicker, FilePicker, LinkInput, ColorPicker, Rating, TagInput

### ConceptAgentView.tsx

Agent 뷰 (AI가 보는 개념 콘텐츠).

- contentEditable가 아닌 `<textarea>` 사용
- 500ms 디바운스로 `updateAgentContent` 호출

### FileEditor.tsx

파일 에디터 라우터. 확장자 기반 자동 선택.

- `.md` → MarkdownEditor
- `.txt`, `.json`, `.ts` 등 → CodeEditor (Monaco)
- `.png`, `.jpg` 등 → ImageViewer
- `.pdf` → PdfViewer
- 기타 → UnsupportedFallback

### CodeEditor.tsx

Monaco Editor 래퍼.

- netior-dark/netior-light 테마 정의 (배경색을 CSS 변수에서 읽어 hex 변환)
- minimap 비활성화, wordWrap, bracketPairColorization

### MarkdownEditor.tsx

CodeMirror 6 기반 마크다운 에디터.

- **live-preview**: Obsidian 스타일. 커서가 없는 줄은 마크다운 문법 숨김 (bold/italic/link/heading/checkbox/table/frontmatter)
- **위젯**: BulletWidget, CheckboxWidget, HrWidget, FrontmatterWidget, TableWidget
- **체크박스 토글**: capture phase mousedown으로 CM6보다 먼저 처리
- **테마**: CSS 변수 기반 동적 테마
- **TOC**: `MarkdownToc` — 여백 충분하면 좌측 고정, 부족하면 호버 오버레이

### MarkdownToc.tsx

목차 컴포넌트.

- `extractHeadings(content)`: `#` 기반 헤딩 추출 (코드 블록 내 제외)
- 여백 >= 180px: 좌측 자연 배치
- 여백 < 180px: 좌측 사다리꼴 힌트 + 호버 시 오버레이 패널 (150ms 딜레이, 500ms 숨김)
- 클릭 시 smooth scroll (easeInOutQuad)

### ImageViewer.tsx

이미지 뷰어. pan/zoom 지원.

- wheel → 줌 (0.1~10배), 드래그 → 패닝
- scale > 2 → pixelated 렌더링
- 하단 상태바: 파일명, 원본 크기, 줌 컨트롤

### PdfViewer.tsx

react-pdf 기반 PDF 뷰어.

- IPC로 파일 읽어 Blob URL 생성 (file:// 차단 우회)
- 페이지 네비게이션 + 줌 컨트롤
- pdf-polyfill.ts: URL.parse 폴리필 (Chromium <126)

### SchemaEditor.tsx

Schema(개념 클래스) 편집기.

- **편집 항목**: name, description, icon(IconSelector), color(ColorPicker), node_shape(Select), file_template(TextArea)
- **필드 스키마**: SchemaFieldRow 목록. 즉시 저장 (세션과 별도)
- **스토어**: schemaStore (schemas, fields, loadFields, createField, updateField, deleteField)

### SchemaFieldRow.tsx

아키타입 필드 편집 행.

- name(Input) + type(TypeSelector) + required(Toggle) + delete(Trash2 아이콘)
- select/multi-select/radio 타입일 때 options 입력 행 추가 (콤마 구분)

### RelationTypeEditor.tsx

관계 타입 편집기.

- **편집 항목**: name, description, color(ColorPicker), line_style(solid/dashed/dotted), directed(Toggle)

### CanvasTypeEditor.tsx

캔버스 타입 편집기.

- **편집 항목**: name, description, icon, color
- **허용 관계 타입**: 체크박스 리스트 (즉시 저장)

### EdgeEditor.tsx

엣지 편집기.

- source/target 노드 라벨 표시 (읽기 전용)
- relation_type(Select), description, visual override: color, line_style, directed
- null이면 RelationType 기본값 사용, 개별 override 가능
- 삭제 버튼

### CanvasEditor.tsx

캔버스 설정 편집기.

- **편집 항목**: name, canvas_type(Select), layout(Select, plugin registry에서 로드)
- **레이아웃 설정**: plugin.configSchema에 따라 동적 폼 (number/enum/string)
- **Field Mappings**: plugin.requiredFields에 따라 schema별 필드 매핑 설정 (timeline용)
- 삭제 버튼

### TerminalEditor.tsx

내장 터미널 에디터. Monaco VSCode Terminal API 사용.

- `getOrCreateTerminalInstance(sessionId, cwd, title)`: 세션별 터미널 인스턴스 관리
- **단축키**: Ctrl+C(복사), Ctrl+V(붙여넣기), Ctrl+F(검색), Ctrl+=/-(폰트 크기), Shift+PgUp/Down(페이지 스크롤)
- **Ctrl+클릭**: 터미널 출력에서 파일 경로 감지 → 파일 에디터 열기
- **스크롤바 패치**: xterm 스크롤바를 8px 라운드로 커스텀

### TerminalSearchBar.tsx

터미널 검색 바 (Ctrl+F).

- xterm의 findNext/findPrevious 사용
- 매치 인덱스/카운트 표시, 결과 없으면 에러 색상
- Escape로 닫기 + 검색 데코레이션 제거

### EditorTabStrip.tsx

에디터 탭 스트립.

- 탭 아이콘: 타입별 (Terminal, Box, Shapes, Link, Layout, Sparkles, FileIcon)
- Claude 터미널 감지: 특수 아이콘 + pulse 애니메이션
- 드래그 앤 드롭: `setTabDragData`로 탭 이동
- 컨텍스트 메뉴: `buildTabContextMenu` (닫기, 다른 탭 닫기, 뷰 모드 전환, 파일 경로 복사 등)
- 인라인 이름 변경: 더블클릭 → input 전환
- 휠 → 가로 스크롤

### EditorViewModeSwitch.tsx

에디터 뷰 모드 전환 버튼 그룹.

- 4 모드: float, full, side, detached
- 각 모드별 아이콘 + Tooltip

### EditorDockBar.tsx

최소화된 탭을 하단에 표시하는 독 바.

- `tabs.filter(isMinimized)` → 클릭 시 `toggleMinimize`

### CloseConfirmDialog.tsx

탭 닫기 확인 다이얼로그.

- 미저장 변경 / 실행 중 터미널 프로세스 구분
- Save & Close / Close Without Saving / Kill & Close

### SplitPaneRenderer.tsx

재귀적 분할 패널 렌더러.

- `SplitNode` 트리 → horizontal/vertical 분할
- `ResizeHandle`로 비율 조정 (마우스 드래그)
- 리프 노드에서 `renderLeaf` 콜백으로 실제 에디터 렌더링

### DropZoneOverlay.tsx

탭 드래그 시 드롭 영역 오버레이.

- 5 영역: top/bottom/left/right/center
- 25% 영역 기준 감지
- centerOnly 모드: 전체 영역이 center

### FloatWindow.tsx

플로팅 윈도우 에디터.

- 제목 바 드래그로 이동
- 우하단 드래그로 리사이즈 (최소 300x200)
- GripVertical 핸들로 탭 드래그 (float→side/full 전환)
- 최소화, 뷰 모드 전환, 닫기

### FloatWindowLayer.tsx

float 뷰 모드 탭들의 레이어.

- `pointer-events-none` 컨테이너에 개별 FloatWindow는 `pointer-events-auto`

### FullModeEditor.tsx

전체 화면 에디터 모드.

- SplitPaneRenderer로 분할 패널 지원
- 탭 드래그 앤 드롭으로 패널 분할/이동

### DetachedEditorShell.tsx

분리된 윈도우용 에디터 셸.

- 별도 Electron 윈도우에서 렌더링
- WebkitAppRegion: drag로 타이틀 바 드래그
- reattach 시 원래 윈도우로 복귀

### editor-utils.ts

에디터 유틸리티.

- `getEditorType(filePath)`: 확장자 → EditorType 매핑
- `getAvailableEditors(filePath)`: 1:N 매핑 (md → markdown + code)
- `getMonacoLanguage(filePath)`: 확장자 → Monaco 언어 ID
- `getCssColorAsHex(property, fallback)`: CSS 변수 → hex 변환

### tab-context-menu.ts

탭 컨텍스트 메뉴 빌더.

- 공통: 닫기, 다른 탭 닫기, 오른쪽 탭 닫기, 모든 탭 닫기
- 뷰 모드: Side/Full/Float 전환
- 타입별: concept(파일 경로 복사), file(에디터 타입 전환), terminal(이름 변경, Kill)
- 빈 영역 우클릭: 모든 탭 닫기, 새 터미널

---

## 6. Narre Components

`packages/desktop-app/src/renderer/components/editor/narre/`

### NarreEditor.tsx

Narre AI 에이전트 에디터. 세션 목록 ↔ 채팅 뷰 전환.

- **상태**: `view` (sessionList | chat), `activeSessionId`

### NarreSessionList.tsx

채팅 세션 목록.

- `narreService.listSessions(projectId)` 호출
- 세션 카드: 제목 + 상대 시간 + 메시지 수
- 빈 상태: Sparkles 아이콘 + 안내 메시지

### NarreChat.tsx

채팅 인터페이스. SSE 스트리밍 처리의 핵심.

- **세션 관리**: 없으면 `createSession` 자동 생성
- **SSE 이벤트 처리**: `narreService.onStreamEvent` 구독
  - `text`: 스트리밍 텍스트 누적
  - `tool_start/end`: 도구 실행 상태 추적
  - `card`: UI 카드 (proposal/permission/interview/summary)
  - `done`: 최종 메시지 확정 + 스트리밍 상태 클리어
- **DB 동기화**: mutation 도구 실행 후 `refreshStores(projectId)` → 모든 Zustand 스토어 refetch
- **자동 스크롤**: 하단 50px 이내면 자동 스크롤, 사용자가 위로 스크롤하면 비활성화
- **스토어**: schemaStore, conceptStore, relationTypeStore, canvasTypeStore, canvasStore (refresh용)

### NarreMessageBubble.tsx

메시지 버블.

- **사용자 메시지**: whitespace-pre-wrap, mention bracket → 칩 변환
- **어시스턴트 메시지**: NarreMarkdown 렌더링, mention bracket → bold 변환
- **카드 렌더링**: NarreCardRenderer로 위임
- **도구 로그**: NarreToolLog 표시

### NarreMarkdown.tsx

react-markdown + remark-gfm 기반 마크다운 렌더러.

- 커스텀 컴포넌트: table, code(인라인/블록 구분), a(새 탭), blockquote 등
- 시맨틱 토큰 기반 스타일링

### NarreMentionInput.tsx

ContentEditable 기반 멘션 입력.

- **`@` 트리거**: 커서 위치에서 `@` 감지 → NarreMentionPicker 표시
- **`/` 트리거**: 입력 시작이 `/`이면 → NarreSlashPicker 표시
- **멘션 칩**: contentEditable=false span, 배경색 accent/15
- **직렬화**: `serializeContentEditable` → mention bracket 형식 `[type:id=xxx, title="display"]`
- **Enter**: 전송 (Shift+Enter: 줄바꿈)
- **Backspace**: 칩 삭제 처리

### NarreMentionPicker.tsx

멘션 검색 피커 (Portal, fixed 위치).

- **3-pane 레이아웃**: 좌측 카테고리(all/concept/canvas/schema/relationType/canvasType) + 중앙 리스트 + 우측 프리뷰
- **키보드**: ArrowUp/Down(선택), Tab(카테고리 전환), Enter(선택), Escape(닫기)
- **검색**: 150ms 디바운스, `narreService.searchMentions` 호출
- **프리뷰**: 아이콘, 색상, 설명, 타입별 메타(schema shape, relationType directed 등)

### NarreSlashPicker.tsx

슬래시 커맨드 피커.

- `SLASH_COMMANDS` 상수에서 필터링
- 키보드 네비게이션 (capture phase)
- 커맨드 선택 시: conversation 타입 → 메시지로 전송, 그 외 → onCommand 콜백

### NarreToolLog.tsx

도구 실행 로그 (접기/펼치기).

- 상태 아이콘: pending(Circle), running(Spinner), success(Check), error(X)
- 완료 수/전체 수 표시
- 결과/에러 메시지 truncate

### cards/NarreCardRenderer.tsx

카드 타입 라우터.

- proposal → ProposalCard
- permission → PermissionCard
- interview → InterviewCard
- summary → SummaryCard

### cards/ProposalCard.tsx

편집 가능한 테이블 제안 카드.

- **구조**: 컬럼 정의(label, cellType) + 행 데이터(values)
- **CellEditor**: boolean(Toggle), enum(Select), color(색상 미리보기+Input), readonly, text/icon(Input)
- **행 추가/삭제** 가능
- Confirm/Retry 버튼

### cards/PermissionCard.tsx

권한 요청 카드.

- AlertTriangle 아이콘 + 메시지
- 액션 버튼 목록 (danger 변형 지원)

### cards/InterviewCard.tsx

선택지 질문 카드.

- 단일 선택: 라디오 스타일 버튼
- 다중 선택: Checkbox
- Submit 버튼

### cards/SummaryCard.tsx

결과 요약 카드.

- 아이템 목록: success(Check) / error(X) 상태 아이콘

---

## 7. Workspace Components

`packages/desktop-app/src/renderer/components/workspace/`

### ConceptWorkspace.tsx

메인 캔버스 영역. 앱의 핵심 컴포넌트.

- **데이터 변환**: `toRenderNodes` (CanvasNodeWithConcept → RenderNode), `toRenderEdges` (EdgeWithRelationType → RenderEdge)
- **레이아웃 플러그인**: `getLayout(currentCanvas?.layout)` → `computeLayout`, `classifyNodes`
- **Field Mapping**: schema별 필드 매핑 → concept_properties 조회 → 메타데이터 빌드 (timeline date → epochDays 변환)
- **Pan/Zoom**: wheel 이벤트로 처리. freeform: zoom-toward-cursor. timeline: Ctrl+wheel=줌, wheel=가로 스크롤, Shift+wheel=세로 스크롤
- **Ctrl+Wheel (freeform)**: 위=drillInto(커서 아래 concept), 아래=navigateBack
- **엣지 링킹**: edit 모드 → 노드 우클릭 "연결 추가" → linkingState 설정 → 타겟 노드 클릭 → addEdge + EdgeEditor 열기
- **드래그 앤 드롭**: `application/netior-node` 데이터 → 파일/디렉토리 노드 추가
- **키보드**: Delete(선택 노드 삭제), Ctrl+A(전체 선택), Escape(링킹 취소)
- **뷰포트 저장**: 500ms 디바운스로 `saveViewport`
- **스토어**: canvasStore, conceptStore, uiStore, editorStore, schemaStore

### WorkspaceShell.tsx

전체 워크스페이스 셸.

- **레이아웃**: ActivityBar | Sidebar | (Canvas + Side Editor) or FullModeEditor
- **에디터 뷰 모드 관리**:
  - full: FullModeEditor (캔버스 숨김)
  - side: Canvas + ResizeHandle + SplitPaneRenderer
  - float: FloatWindowLayer (캔버스 위에 오버레이)
  - detached: 별도 Electron 윈도우
- **리사이즈**: 사이드바 폭, 캔버스↔에디터 비율 드래그 조정
- **탭 드래그**: 캔버스 영역 드롭 → float 모드, 우측 힌트 드롭 → side 모드
- **분리 윈도우**: `onDetachedClosed`, `onReattachToMode` IPC 이벤트 처리
- **스토어**: editorStore, uiStore

### types.ts

- `RenderNode`: 렌더링용 노드 (id, x, y, label, icon, shape, semanticType, width/height, conceptId, canvasCount, nodeType, filePath, dirPath)
- `RenderEdge`: 렌더링용 엣지 (id, sourceId, targetId, directed, label, color, lineStyle)
- `LayoutNode`, `LayoutEdge`: 레이아웃 계산 입력

### Background.tsx

도트 그리드 배경. SVG pattern으로 구현.

- GRID_SIZE=20, 줌/팬에 따라 오프셋 계산
- 0.5r 원 → `var(--border-subtle)` 색상

### EdgeLayer.tsx

엣지 레이어 (SVG).

- 뷰포트 transform 적용: `translate(panX, panY) scale(zoom)`
- 노드 드래그 중 오프셋 반영하여 엣지 끝점 갱신
- EdgeLine 컴포넌트에 위임

### NodeLayer.tsx

노드 레이어.

- **freeform**: CSS transform으로 뷰포트 변환 (`translate + scale`)
- **timeline**: 개별 노드 좌표를 screen coords로 변환 (X는 zoom 적용, Y는 직접)
- NodeCardDefault 컴포넌트에 위임

### InteractionLayer.tsx (`useInteraction` 훅)

마우스 제스처 처리 훅.

- **Pan**: 좌클릭 + 드래그
- **Node drag**: edit 모드 좌클릭 + 노드 위 드래그 (browse 모드에서는 pan으로 폴백)
- **Span resize**: edit 모드 + span 핸들 드래그
- **Selection box**: Shift + 좌클릭 + 드래그
- **Wheel**: onWheel 콜백
- **InteractionConstraints**: panAxis(x/y/null), nodeDragAxis(x/y/null), enableSpanResize
- 드래그 중 `nodeDragOffset` 상태로 실시간 피드백, mouseup 시 최종 위치 계산

### CanvasContextMenu.tsx

캔버스 빈 영역 우클릭 메뉴.

- 개념 생성 → draft 탭 열기
- 파일 노드 추가 → FileNodeAddModal
- 같은 concept의 다른 캔버스로 전환

### NodeContextMenu.tsx

노드 우클릭 메뉴.

- concept의 캔버스 목록 (네비게이션)
- 캔버스 생성
- 연결 추가 (edit 모드)
- 삭제

### EdgeContextMenu.tsx

엣지 우클릭 메뉴.

- 삭제 (에디터 탭도 함께 닫기)

### CanvasBreadcrumb.tsx

캔버스 계층 경로 표시.

- `breadcrumbs` 배열 → ChevronRight 구분자 + 클릭 가능 경로
- 뒤로가기 버튼

### CanvasControls.tsx (workspace/)

캔버스 컨트롤 바 (ConceptWorkspace용, 드래그 이동 지원).

- **GripHorizontal 핸들**: 드래그로 위치 이동 가능 (-1 = 기본 위치, 이후 fixed)
- **Mode 토글**: browse/edit
- **Navigation**: browse 모드에서 뒤로/앞으로
- **Zoom**: +/-/fit
- **hiddenControls**: 플러그인이 특정 컨트롤 숨김 가능
- **extraItems**: 플러그인 추가 버튼 (예: "오늘로 이동")

### FileNodeAddModal.tsx

파일/디렉토리 노드 추가 모달.

### NodeCanvasOverlay.tsx

노드 위 캔버스 카운트 오버레이.

---

## 8. Layout Plugin System

`packages/desktop-app/src/renderer/components/workspace/layout-plugins/`

### types.ts — CanvasLayoutPlugin 인터페이스

```typescript
interface CanvasLayoutPlugin {
  key: string;
  displayName: string;
  requiredFields: FieldRequirement[];     // 필요한 concept property 필드
  configSchema: ConfigField[];             // 사용자 설정 옵션
  getDefaultConfig(): Record<string, unknown>;
  interactionConstraints: InteractionConstraints;
  computeLayout(input: LayoutComputeInput): LayoutComputeResult;
  classifyNodes(nodes): { cardNodes, overlayNodes };
  BackgroundComponent: React.ComponentType<LayoutLayerProps>;
  OverlayComponent?: React.ComponentType<LayoutLayerProps>;
  onNodeDrop?(context: NodeDropContext): NodeDropResult;
  hiddenControls?: Array<'zoom' | 'fit' | 'nav' | 'mode'>;
  controlItems?: Array<{...}>;
}
```

- **FieldRequirement**: `key`, `type`(number/string/enum), `label`, `required`, `default`, `options`
- **ConfigField**: `key`, `type`(string/number/enum), `label`, `default`, `options`
- **InteractionConstraints**: `panAxis`, `nodeDragAxis`, `enableSpanResize`
- **LayoutRenderNode**: RenderNode + `metadata` + `schemaId`
- **LayoutLayerProps**: width/height/zoom/panX/panY/nodes/edges/config/nodeDragOffset + 이벤트 콜백

### registry.ts

플러그인 레지스트리.

- `registerLayout(plugin)`: Map에 등록
- `getLayout(key)`: 키로 조회, 없으면 freeform 반환
- `listLayouts()`: 모든 플러그인 목록
- 등록된 플러그인: `freeform`, `timeline`, `calendar`, `gantt`
- previous key `horizontal-timeline`은 호환성 때문에 내부적으로 `gantt`로 매핑

### freeform/index.ts

자유 배치 플러그인.

- `computeLayout`: 노드 위치 그대로 반환 (pass-through)
- `classifyNodes`: 모든 노드 → cardNodes
- `BackgroundComponent`: FreeformBackground (도트 그리드)
- 제약 없음 (자유 pan, 자유 drag)

### timeline

연속 시간축 기반 플러그인.

- `timeline`은 `gantt`와 별도 family로 취급
- 핵심은 연속 시간축 탐색과 배치 밀도 제어
- 카드 중심 렌더링, event/span을 같은 시간축 위에서 읽음
- 기본 인터랙션은 가로 pan/zoom + 가로 drag writeback
- `start_at` / `end_at` / `all_day` 같은 temporal slot을 공통 파이프라인으로 소비

### gantt

작업 기간 바 중심 플러그인.

- 기존 `horizontal-timeline` 구현을 `gantt` family로 정리
- 기간 항목은 overlay band로 렌더링
- span resize 허용
- previous 저장값은 `horizontal-timeline` → `gantt` alias로 호환

---

## 9. Sidebar Components

`packages/desktop-app/src/renderer/components/sidebar/`

### ActivityBar.tsx

좌측 40px 아이콘 네비게이션 바.

- **상단 탭**: Canvases(Layout), Files(FolderTree), Schemas(Shapes)
- **하단 버튼**: Narre(Sparkles), Terminal, Settings
- **토글 동작**: 같은 탭 클릭 → 사이드바 닫기, 다른 탭 → 전환, 닫힌 상태 → 열기
- **스토어**: uiStore (sidebarView, sidebarOpen, toggleSidebar), editorStore (openTab), projectStore (currentProject)

### Sidebar.tsx

사이드바 컨테이너.

- 뷰에 따라 내용 전환:
  - `canvases` → CanvasList
  - `files` → ModuleSelector + FileTree
  - `schemas` → SchemaList + RelationTypeList + CanvasTypeList (Divider 구분)
- 마운트 시 모든 데이터 로드 (canvases, modules, concepts, schemas, relationTypes, canvasTypes, fileTree)
- **스토어**: canvasStore, fileStore, moduleStore, conceptStore, schemaStore, relationTypeStore, canvasTypeStore, editorStore, uiStore

### CanvasList.tsx

캔버스 트리 사이드바.

- `canvasTree` API 기반 계층 트리 표시
- 우클릭 → 에디터에서 열기 / 삭제
- 새 캔버스 생성 버튼

### FileTree.tsx

파일 시스템 트리.

- `FileTreeNode[]` → 재귀적 트리 렌더링
- 파일 클릭 → 에디터 열기
- 다중 선택: `Ctrl/Cmd+Click`, `Shift+Click`, `Ctrl/Cmd+A`
- 컨텍스트 메뉴: 파일/폴더 생성, 이름 변경, 복사/잘라내기/붙여넣기, 삭제, 탐색기에서 보기
- 인라인 이름 변경/생성 입력 + Windows 파일명 검증
- 붙여넣기 이름 충돌 시 `(1)`, `(2)` suffix 자동 처리
- 시스템 클립보드 파일/이미지 붙여넣기 지원
- 잘라내기 항목 시각 표시, 선택 항목 자동 스크롤 포커스 유지
- 드래그 앤 드롭 이동/복사 지원
- `Ctrl+Z`로 붙여넣기, 이동, 삭제 undo 지원

### FileIcon.tsx

파일 확장자 기반 아이콘.

### ModuleSelector.tsx

모듈(디렉토리 그룹) 선택기.

### ModuleManager.tsx

모듈 관리 (디렉토리 추가/제거).

### SchemaList.tsx

아키타입 목록. Plus 버튼으로 생성, 클릭 시 에디터 열기.

### RelationTypeList.tsx

관계 타입 목록. 동일 패턴.

### CanvasTypeList.tsx

캔버스 타입 목록. 동일 패턴.

### ConceptSearch.tsx

개념 검색. (사이드바 내부에서 사용)

---

## 10. Home + Settings

### ProjectHome.tsx

프로젝트 선택 화면 (앱 시작 시).

- 프로젝트 카드 목록 + 생성 버튼
- `restoreLastProject()`: 마지막 프로젝트 자동 열기 시도
- 프로젝트 생성: createProject + createModule + addDirectory
- 삭제 확인: ConfirmDialog
- 경로 누락 처리: 새 경로 선택 다이얼로그

### ProjectCard.tsx

프로젝트 카드. 이름 + root_dir 경로 + 열기/삭제 버튼.

### ProjectCreateDialog.tsx

프로젝트 생성 다이얼로그. 이름 입력 + 폴더 선택.

### SettingsModal.tsx

설정 모달 (Portal로 렌더링).

- **레이아웃**: 좌측 카테고리 사이드바 + 우측 설정 콘텐츠
- **카테고리**:
  - Appearance: Mode(dark/light), Theme(12종 concept theme 그리드)
  - Language: ko/en
- **검색**: 실시간 필터링
- **스토어**: settingsStore (themeConcept, themeMode, locale)

---

## 11. UI Components

`packages/desktop-app/src/renderer/components/ui/`

30개 컴포넌트 export (index.ts):

### 기본 입력

| 컴포넌트 | 설명 |
|----------|------|
| **Button** | variant: primary/secondary/ghost/danger. size: sm/md/lg |
| **IconButton** | Tooltip 래핑된 아이콘 전용 버튼 |
| **Input** | `<input>` 래퍼. inputSize: sm/default. border: input→strong→accent |
| **NumberInput** | 숫자 전용 Input. min/max/step |
| **TextArea** | `<textarea>` 래퍼. rows, auto-resize 옵션 |
| **Select** | `<div role="combobox">` 트리거 패턴. options, selectSize: sm/default |
| **Checkbox** | 커스텀 체크박스. label 옵션 |
| **Toggle** | 토글 스위치. label 옵션 |
| **RadioGroup** | 라디오 버튼 그룹. options: {value, label}[] |

### 선택기

| 컴포넌트 | 설명 |
|----------|------|
| **ColorPicker** | 색상 선택. 프리셋 팔레트 + hex 입력 |
| **DatePicker** | 날짜 선택. includeTime 옵션 |
| **IconSelector** | 아이콘 선택 모달. 좌측 카테고리 + 우측 그리드 + 검색 (대량 항목) |
| **TypeSelector** | 타입 선택 드롭다운. 좌측 카테고리 + 우측 리스트 + 검색 (소량 항목) |
| **MultiSelect** | 다중 선택 드롭다운. 칩으로 선택 표시 |
| **TagInput** | 태그 입력. Enter/콤마로 추가, Backspace로 삭제 |
| **Rating** | 별점 (1~5) |
| **LinkInput** | URL 입력 + 미리보기 링크 |
| **RelationPicker** | 개념 관계 선택 |
| **FilePicker** | 파일 경로 선택 (IPC 다이얼로그) |

### 오버레이/피드백

| 컴포넌트 | 설명 |
|----------|------|
| **Modal** | 모달 다이얼로그. open, title, footer, children |
| **ConfirmDialog** | 확인 다이얼로그. variant: primary/danger. title, message, confirmLabel |
| **Toast** / **ToastContainer** | 토스트 알림. `showToast(message, type)` 함수형 API |
| **Tooltip** | 툴팁. position: top/bottom/left/right. 항상 이 컴포넌트 사용 (HTML title 금지) |
| **ContextMenu** | 컨텍스트 메뉴. Portal 렌더링. ContextMenuEntry: item + divider |

### 레이아웃/유틸리티

| 컴포넌트 | 설명 |
|----------|------|
| **Badge** | 배지 라벨 |
| **Divider** | 수평 구분선 |
| **Spinner** | 로딩 스피너. size: sm/md/lg |
| **ScrollArea** | 커스텀 스크롤바 영역 |
| **ResizeHandle** | 리사이즈 핸들. direction: horizontal/vertical |

### 유틸리티 파일

| 파일 | 설명 |
|------|------|
| **icon-categories.ts** | Lucide 아이콘 카테고리 분류 (IconSelector용) |
| **lucide-utils.ts** | `getIconComponent(name)`: 문자열 → Lucide 컴포넌트 동적 조회 |

---

## 12. Theme System

### 3-Tier 구조

```
data-concept (12종)  →  data-mode (dark/light)  →  Tailwind semantic tokens
```

### CSS 구조 (`styles/theme/`)

```
index.css
 +-- tokens/spacing.css      # --space-xs ~ --space-xl
 +-- tokens/typography.css    # --font-sans, --font-mono, --text-xs ~ --text-xl
 +-- tokens/radius.css        # --radius-sm ~ --radius-xl
 +-- tokens/shadow.css        # --shadow-primary-sm/md/lg
 +-- tokens/transition.css    # --duration-fast/normal/slow
 +-- tokens/z-index.css       # --z-dropdown ~ --z-toast
 +-- themes/index.css
 |    +-- concepts/*.css      # 12종 concept theme (forest, neon, graphite...)
 |    +-- modes/*.css          # dark.css, light.css
 +-- reset.css                # button { border: none } 포함
 +-- base.css                 # 글로벌 기본 스타일
```

### Concept Themes (12종)

각 concept theme는 `[data-concept="xxx"]` 선택자로 accent, status 등의 색상 변수 정의.

### Mode Themes (2종)

`[data-mode="dark"]`, `[data-mode="light"]` 선택자로 surface, text, border 색상 변수 정의.

### Tailwind Config (tailwind.config.js)

CSS 변수를 Tailwind 유틸리티로 매핑:

- **Surface**: `bg-surface-base/panel/card/hover/modal`
- **Text**: `text-default/secondary/muted/on-accent`
- **Border**: `border-subtle/default/strong/input`
- **Accent**: `accent/accent-hover/accent-muted`
- **Status**: `status-success/warning/error/info`
- **Shadow**: `shadow-primary-sm/md/lg`
- **Transition**: `duration-fast(150ms)/normal(250ms)/slow(350ms)`
- **Font**: `font-sans/mono` (CSS 변수 참조)

### 사용 규칙

- 하드코딩 색상 클래스 금지 → 반드시 semantic token 사용
- 새 컴포넌트: `bg-surface-card`, `text-default`, `border-subtle` 등
- 테마 변경: `settingsStore.setThemeConcept(name)` / `setThemeMode(mode)` → `<html>` 속성 업데이트
