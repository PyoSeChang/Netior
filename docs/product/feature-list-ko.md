# Netior 제품 전체 기능 리스트

## 목적

이 문서는 현재 코드베이스 기준으로 Netior 제품이 실제로 제공하는 기능을 기능 축별로 정리한 참조 문서다.  
`Narre 책임 표면`, `Narre MCP Coverage`, `시나리오 인덱스` 문서는 이 문서를 상위 제품 기능 원천으로 참조한다.

## 관련 문서

- [Netior Narre 책임 표면 인벤토리](../narre/architecture/responsibility-surface-ko.md)
- [Narre MCP Coverage By Responsibility Surface](../narre/architecture/mcp-coverage-by-surface-ko.md)
- [Narre Eval 시나리오 인덱스 By Responsibility Surface](../narre/eval/scenario-index-by-surface-ko.md)

## 조사 범위

다음 패키지와 표면을 기준으로 전수 조사했다.

- `packages/desktop-app`
  - `src/main/ipc/*`
  - `src/renderer/components/home/*`
  - `src/renderer/components/sidebar/*`
  - `src/renderer/components/workspace/*`
  - `src/renderer/components/editor/*`
  - `src/renderer/components/settings/*`
  - `src/main/agent-runtime/*`
- `packages/shared`
  - `src/types/index.ts`
  - `src/constants/index.ts`
  - `src/constants/netior-mcp-tools.ts`
- `packages/netior-mcp`
  - `src/tools/*`
- `packages/narre-server`
  - `src/system-prompt.ts`
  - `src/prompts/bootstrap.ts`
  - `src/prompts/index-toc.ts`
  - `src/prompt-skills/*`
- `packages/narre-eval`
  - `scenarios/*`

## 기능 축

| ID | 기능 영역 | 사용자 관점 기능 | 주요 구현 표면 | 비고 |
|---|---|---|---|---|
| F01 | 프로젝트 라이프사이클 | 프로젝트 생성, 열기, 삭제, 누락 경로 재지정 | `home/ProjectHome.tsx`, `project-ipc.ts` | 앱 진입점 기능 |
| F02 | 모듈 및 파일 시스템 등록 | 프로젝트 루트 기반 모듈 생성, 모듈 디렉터리 등록, 파일 트리 로딩/감시 | `module-ipc.ts`, `fs-ipc.ts`, `sidebar/ModuleSelector.tsx`, `sidebar/FileTree.tsx` | 실제 파일 시스템과 제품 메타데이터를 연결 |
| F03 | 사이드바 및 탐색 패널 | 네트워크 목록, 파일 트리, 객체 패널, 타입/컨텍스트/모듈 탐색 | `sidebar/*`, `Sidebar.tsx` | 탐색 UX 계층 |
| F04 | 네트워크 워크스페이스 | 네트워크 열기, 브레드크럼, 줌/팬, 네트워크 생성/삭제/이동 | `workspace/NetworkWorkspace.tsx`, `network-ipc.ts` | 캔버스 기반 작업 공간 |
| F05 | 그래프 편집 | 노드 생성/배치, 파일/객체 추가, 엣지 생성/편집/삭제, 컨텍스트 메뉴 | `workspace/*`, `network-ipc.ts`, `object-ipc.ts` | 실제 그래프 조작 기능 |
| F06 | 레이아웃 저장 | 레이아웃별 노드 위치, 엣지 시각 설정, viewport/정렬 상태 저장 | `layout-ipc.ts` | 네트워크 내용과 별도인 보기 상태 |
| F07 | 개념 및 속성 | 개념 생성/수정/삭제, schema 연결, concept property 값 저장 | `concept-ipc.ts`, `concept-property-ipc.ts`, `editor/ConceptEditor.tsx`, `ConceptPropertiesPanel.tsx` | 인스턴스 데이터 핵심 |
| F08 | 타입 시스템 | schema 생성/수정/삭제, field definition, model, meaning slot, type group | `schema-ipc.ts`, `type-group-ipc.ts`, `editor/SchemaEditor.tsx` | Netior 스키마 계층 핵심 |
| F09 | relation type 및 edge 의미 | relation type 생성/수정/삭제, edge relation 지정, edge 설명/시각 제어 | `relation-type-ipc.ts`, `editor/RelationTypeEditor.tsx`, `editor/EdgeEditor.tsx` | 그래프 관계 의미 계층 |
| F10 | 컨텍스트 | context 생성/수정/삭제, object/edge 멤버 관리 | `context-ipc.ts`, `editor/ContextEditor.tsx` | 네트워크 안의 묶음/초점 기능 |
| F11 | 파일 엔터티 및 PDF 메타데이터 | file entity 등록/조회/수정/삭제, PDF TOC 메타데이터 | `file-ipc.ts`, `editor/FileMetadataEditor.tsx`, `PdfViewer.tsx` | 파일을 객체로 다루는 계층 |
| F12 | 에디터 워크벤치 | 탭, 분할, detached window, 파일/네트워크/타입/프로젝트/컨텍스트/Narre 편집기 | `editor/EditorContent.tsx`, `editor/*` | 제품의 주 작업 표면 |
| F13 | Markdown/코드/이미지/PDF 편집기 | Markdown, plain text/code, image viewer, PDF viewer, unsupported fallback | `editor/markdown/*`, `CodeEditor.tsx`, `ImageViewer.tsx`, `PdfViewer.tsx` | 파일 확장자별 라우팅 |
| F14 | 터미널 및 에이전트 런타임 | 내장 터미널, 검색, TODO 패널, 링크 오버레이, Codex/Claude 연결된 agent terminal | `pty-ipc.ts`, `TerminalEditor.tsx`, `main/agent-runtime/*` | 제품 내부 실행 표면 |
| F15 | 설정 및 단축키 | 테마, 폰트, 터미널 appearance, Narre behavior, Codex 설정, 단축키 | `SettingsModal.tsx`, `config-ipc.ts`, `editor-prefs-ipc.ts`, `shortcuts/*` | 앱 전역 설정 |
| F16 | Narre 기본 채팅 | Narre 탭, 세션 관리, mention 입력, tool log, SSE 기반 응답 | `editor/narre/*`, `narre-ipc.ts`, `narre-server` | AI 조작 표면 |
| F17 | Narre `/bootstrap` | 도메인 설명을 ontology로 읽고 workspace 구조로 부트스트랩 | `narre-server/src/prompts/bootstrap.ts`, `prompt-skills/bootstrap-skill.ts` | 현재 동적 skill |
| F18 | Narre `/index` | PDF TOC 추출 및 file metadata 저장 | `narre-server/src/prompts/index-toc.ts`, `prompt-skills/index-skill.ts` | PDF 인덱싱 전용 skill |

## 기능별 상세 메모

### F01. 프로젝트 라이프사이클

- 홈 화면에서 프로젝트 생성/열기/삭제가 가능하다.
- 프로젝트 경로가 사라진 경우 새 경로를 다시 지정할 수 있다.
- 프로젝트 생성 시 기본 module도 함께 만들어 초기 작업 루트를 잡는다.

### F02. 모듈 및 파일 시스템 등록

- 프로젝트는 module과 module directory를 통해 실제 파일 시스템 경로를 참조한다.
- 파일 트리는 등록된 모듈 디렉터리를 기준으로 로딩된다.
- 파일 시스템 watcher를 통해 트리를 자동 갱신한다.

### F03. 사이드바 및 탐색 패널

- 네트워크 탐색
- 파일 트리 탐색
- 객체 패널
- 타입/관계/컨텍스트/모듈 관련 패널

즉 Netior는 단일 캔버스만이 아니라, 여러 탐색 패널을 가진 workbench다.

### F04. 네트워크 워크스페이스

- Universe / Ontology / 일반 network tree 구조
- Universe는 앱 전체 project portal network이고, Ontology는 프로젝트 schema/type network다.
- 네트워크 브레드크럼
- 네트워크 생성, 삭제, 부모 변경
- 줌/팬과 네트워크 계층 이동

### F05. 그래프 편집

- concept / file / folder / portal 계열 object를 네트워크에 node로 배치
- object picker, file node add modal, concept create modal
- edge 생성, 편집, 삭제
- 노드/엣지/네트워크 우클릭 컨텍스트 메뉴

### F06. 레이아웃 저장

- 레이아웃 자체와 노드 위치를 분리해서 저장한다.
- 엣지별 시각 override도 레이아웃 층에서 관리한다.
- 즉 네트워크 내용과 “어떻게 보느냐”를 별도로 다룬다.

### F07. 개념 및 속성

- concept는 schema을 가질 수 있다.
- concept property는 schema field definition와 연결된다.
- concept body/content 편집과 property 편집이 분리되어 있다.

### F08. 타입 시스템

- schema
- schema field
- model
- meaning slot
- type group

이 다섯 축이 스키마 계층의 핵심이다.

### F09. relation type 및 edge 의미

- relation type은 edge 기본 의미와 시각 기본값을 제공한다.
- edge는 relation type을 따르되 description과 visual override를 둘 수 있다.

### F10. 컨텍스트

- context는 네트워크 안에서 object/edge를 묶는 별도 객체 계층이다.
- context member는 object 또는 edge를 가리킨다.

### F11. 파일 엔터티 및 PDF 메타데이터

- file entity는 파일을 Netior object로 끌어올리는 계층이다.
- PDF TOC는 file metadata의 한 필드로 저장된다.

### F12. 에디터 워크벤치

- 탭 기반
- split pane
- detached window
- 프로젝트/네트워크/타입/컨텍스트/파일/Narre/터미널 편집기

### F13. 파일 편집기

- Markdown
- plain text / code
- image viewer
- PDF viewer
- unsupported fallback

### F14. 터미널 및 에이전트 런타임

- 내장 PTY 기반 터미널
- 검색 바
- TODO 패널
- 파일 링크/오버레이
- Codex/Claude 연계 agent runtime 상태 추적

### F15. 설정 및 단축키

- theme mode
- primary palette
- typography
- terminal appearance
- Narre behavior
- Narre Codex settings
- 전역/분리창 단축키

### F16. Narre 기본 채팅

- 프로젝트별 Narre tab
- session list
- mention input
- tool log
- SSE 기반 streaming

### F17. Narre `/bootstrap`

- 사용자가 Netior 구조를 몰라도, 도메인 설명에서 ontology를 추론하고 초기 workspace를 세우는 기능이 목표다.
- 현재는 prompt-skill 기반으로 동적 로드된다.

### F18. Narre `/index`

- PDF를 읽고 TOC를 추출한 뒤 file metadata에 저장한다.
- file/PDF 계층과 Narre가 만나는 대표 skill이다.

## 조사 결과 요약

- 제품의 핵심은 `프로젝트 -> 네트워크/그래프 -> 타입 시스템 -> 파일/PDF -> 에디터 워크벤치 -> Narre` 구조다.
- MCP가 직접 덮을 수 있는 것은 이 중 **도메인 데이터 계층** 중심이고,
- 데스크톱 UX 계층, 에디터 계층, 설정/워크벤치 계층은 MCP 밖에 있다.
- 현재 시나리오 커버리지는 스키마/아키타입 쪽에 치우쳐 있고, 레이아웃/컨텍스트/파일/PDF/index skill 쪽은 현저히 약하다.
