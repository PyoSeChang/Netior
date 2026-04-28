# Narre MCP Coverage

## 목적

이 문서는 `Netior 제품 전체 기능 리스트`의 기능 ID를 기준으로, 현재 Narre가 MCP를 통해 직접 다룰 수 있는 범위를 정리한 문서다.

## 판정 기준

- `강함`: 생성/조회/수정/삭제를 대부분 MCP로 수행 가능
- `부분`: 일부 조회/변경만 가능하거나, skill 전용 profile로만 가능
- `없음`: 현재 MCP tool surface에 직접 노출되지 않음
- `간접`: MCP는 하위 도구만 제공하고, 실제 orchestration은 Narre skill/runtime이 담당

## 기능별 MCP 커버리지

| ID | 기능 영역 | MCP 커버리지 | 관련 MCP 도구 | 메모 |
|---|---|---|---|---|
| F01 | 프로젝트 라이프사이클 | 부분 | `get_project_summary` | 프로젝트 요약 조회는 가능하지만 프로젝트 생성/삭제/열기 자체는 MCP에 없다 |
| F02 | 모듈 및 파일 시스템 등록 | 부분 | `list_modules`, `list_directory`, `read_file`, `glob_files`, `grep_files` | module 조회와 파일 읽기는 가능하지만 module/moduleDir 생성·수정·삭제는 MCP에 없다 |
| F03 | 사이드바 및 탐색 패널 | 부분 | `list_networks`, `get_network_tree`, `get_universe_network`, `get_project_ontology_network`, 파일 browse 계열 | 탐색에 필요한 Universe/Ontology 데이터는 일부 있으나 사이드바 상태/UX는 MCP 바깥. 기존 root network 도구명은 deprecated alias |
| F04 | 네트워크 워크스페이스 | 강함 | `list_networks`, `create_network`, `update_network`, `delete_network`, `get_network_full`, `get_network_tree`, `get_network_ancestors` | 네트워크 구조 자체는 MCP로 다룰 수 있다 |
| F05 | 그래프 편집 | 강함 | `create_network_node`, `update_network_node`, `delete_network_node`, `create_edge`, `get_edge`, `update_edge`, `delete_edge`, `get_object`, `get_object_by_ref` | node/edge 조작은 강하지만 UI gesture는 물론 MCP 범위 밖 |
| F06 | 레이아웃 저장 | 없음 | 없음 | layout, layout node position, layout edge visual을 다루는 MCP tool이 없다 |
| F07 | 개념 및 속성 | 강함 | `list_concepts`, `create_concept`, `update_concept`, `delete_concept`, `get_concept_properties`, `upsert_concept_property`, `delete_concept_property`, `get_field_candidates` | concept와 property 계층은 상당히 잘 열려 있다 |
| F08 | 타입 시스템 | 강함 | `list_schemas`, `create_schema`, `update_schema`, `delete_schema`, field definition 계열, model 계열, schema meaning 계열, `list_type_groups`, `create_type_group`, `update_type_group`, `delete_type_group` | schema, field, model CRUD, schema meaning, field meaning bindings, type group이 MCP에 노출되어 있다 |
| F09 | relation type 및 edge 의미 | 강함 | `list_relation_types`, `create_relation_type`, `update_relation_type`, `delete_relation_type`, edge 계열 | relation type과 edge 모두 가능 |
| F10 | 컨텍스트 | 없음 | 없음 | context 및 context member 관리 도구가 MCP에 없다 |
| F11 | 파일 엔터티 및 PDF 메타데이터 | 부분 | `get_file_metadata`, `read_pdf_pages`, `read_pdf_pages_vision`, `update_file_pdf_toc` | file entity 일반 CRUD는 없고 PDF/metadata 일부만 열린 상태 |
| F12 | 에디터 워크벤치 | 없음 | 없음 | tab/split/detached/editor routing은 desktop-app 전용 |
| F13 | 파일 편집기 | 없음 | 없음 | Markdown/PDF/Image editor는 UI 기능 |
| F14 | 터미널 및 에이전트 런타임 | 없음 | 없음 | terminal/PTY/agent runtime은 MCP 범위 밖 |
| F15 | 설정 및 단축키 | 없음 | 없음 | app 설정, theme, typography, shortcut은 MCP 범위 밖 |
| F16 | Narre 기본 채팅 | 간접 | 전체 MCP surface가 하위 도구로 사용됨 | 채팅/session/orchestration은 narre-server 책임 |
| F17 | Narre `/bootstrap` | 간접 | `ask/propose/confirm` + core graph/type tools + `bootstrap-skill` file tools | bootstrap은 skill이 주도하고 MCP는 하위 조작/조회 도구를 제공 |
| F18 | Narre `/index` | 간접 | `read_pdf_pages`, `read_pdf_pages_vision`, `get_file_metadata`, `update_file_pdf_toc` | index skill이 orchestration을 담당하고 MCP는 PDF/file 메타데이터 조작을 담당 |

## 도구 표면 관찰 메모

### 1. 강한 영역

현재 MCP가 강하게 열려 있는 영역은 다음 두 축이다.

- 그래프/스키마 데이터
  - network
  - network node
  - edge
  - concept
  - schema
  - schema field
  - relation type
  - type group
- project digest / object lookup
  - project summary
  - object inspection
  - Universe / Ontology / network tree

즉 Narre가 “도메인 모델을 조작하는 일”은 꽤 많이 할 수 있다.

### 2. 부분 커버 영역

부분 커버는 두 종류로 나뉜다.

- `기능 일부만 열려 있는 경우`
  - project: 요약만 가능
  - module: list만 가능
  - file entity: metadata/PDF 일부만 가능
- `profile에 따라 보이는 경우`
  - discovery profile
  - bootstrap-skill profile
  - index-skill profile

즉 모든 tool이 기본 surface에 항상 보이는 구조는 아니다.

### 3. 아예 비어 있는 영역

현재 MCP가 직접 다루지 못하는 제품 기능은 뚜렷하다.

- layout
- context
- editor/workbench
- settings
- terminal/agent runtime

이 영역은 Narre가 직접 다루려면 새 MCP surface가 필요하다.

## 기능별 상세 판단

### F02. 모듈 및 파일 시스템 등록

MCP는 `list_modules`와 파일 read/search 계열은 있지만,

- module 생성/수정/삭제
- module directory 추가/삭제/경로 변경

은 없다.  
즉 Narre는 등록된 루트 안에서 읽고 찾는 일은 가능하지만, 파일 시스템 연결 구조 자체를 세우는 능력은 아직 제한적이다.

### F06. 레이아웃 저장

desktop-app IPC에는 `layout:getByNetwork`, `layout:update`, `layoutNode:setPosition`, `layoutEdge:setVisual` 등이 있지만 MCP에는 대응 도구가 없다.  
따라서 Narre는 현재 레이아웃을 reasoning에 참고할 수 있어도, layout 층을 직접 편집하는 능력은 없다.

### F08. 타입 시스템

이 영역은 MCP가 가장 잘 열린 영역 중 하나다.

- schema CRUD
- field definition CRUD/reorder
- model CRUD와 model recipe
- schema meaning과 field meaning bindings
- type group CRUD

즉 “스키마 조작기”로서의 Narre는 꽤 강하다.

### F10. 컨텍스트

desktop-app에는 context create/list/update/delete, member add/remove/get 이 다 있는데 MCP에는 아무것도 없다.  
이건 제품 기능 대비 Narre 자동화 공백이 큰 영역이다.

### F11. 파일 엔터티 및 PDF 메타데이터

현재 MCP는 사실상 `/index` 지원에 맞춰져 있다.

- PDF text read
- PDF vision read
- file metadata 조회
- PDF TOC metadata update

반면,

- file entity 생성
- file entity 수정
- file entity 삭제

는 MCP에 없다.

## 결론

현재 MCP는 **Netior의 도메인 데이터 계층**은 꽤 잘 커버하지만, **워크벤치/레이아웃/컨텍스트/파일 연결 구조**는 아직 약하다.

특히 지금 Narre가 잘할 수 있는 일은:

- schema / field / relation type / network / concept 조작
- project/network/schema digest 조회
- PDF TOC indexing 보조

반대로 아직 약한 일은:

- layout 다루기
- context 다루기
- module/file registration 구조 다루기
- desktop editor/workbench 계층 조작

즉 현재 MCP surface는 “Netior 전체”가 아니라 **Netior의 schema/graph core + 일부 file/PDF skill support**에 가깝다.
