# Narre Eval 시나리오 인덱스 By Responsibility Surface

## 목적

이 문서는 [Netior Narre 책임 표면 인벤토리](../architecture/responsibility-surface-ko.md)의 `NR01~NR25` 기준으로, 현재 eval 시나리오가 Narre 책임 표면을 얼마나 검증하는지 정리한다.

## 관련 문서

- [Netior 제품 전체 기능 리스트](../../product/feature-list-ko.md)
- [Netior Narre 책임 표면 인벤토리](../architecture/responsibility-surface-ko.md)
- [Narre MCP Coverage By Responsibility Surface](../architecture/mcp-coverage-by-surface-ko.md)

## 현재 활성 시나리오

manifest 기준 활성 시나리오:

- `fantasy-world-bootstrap`
- `think-data-structure-pdf-index`

비활성:

- 없음

## 시나리오별 핵심 성격

| Scenario ID | 타입 | 핵심 검증 초점 |
|---|---|---|
| `fantasy-world-bootstrap` | `single-turn + dynamic tester interaction` | `/bootstrap` skill, fantasy domain ontology, two-round interview, network split, model/meaning/ORM/starter graph 시도 |
| `think-data-structure-pdf-index` | `single-turn + approval card` | `/index` skill, PDF TOC extraction, file metadata `pdf_toc` 저장, approval-before-save |

## 표면별 커버리지

판정 기준:

- `강함`: 핵심 행위를 직접 검증
- `부분`: 일부만 검증
- `없음`: 현재 시나리오 없음

| ID | 책임 표면 | 시나리오 | 커버리지 | 메모 |
|---|---|---|---|---|
| NR01 | 현재 project와 Universe/Ontology 이해 | `fantasy-world-bootstrap` | 부분 | project metadata는 거치지만 Universe project portal, Ontology schema projection dedicated 검증은 없음 |
| NR02 | 일반 network object CRUD | `fantasy-world-bootstrap` | 부분 | network split/create 의도는 보지만 update/delete/tree와 system network 보호 검증은 약함 |
| NR03 | object record 조회와 ref 해석 | `fantasy-world-bootstrap` | 부분 | object placement 과정에서 간접적으로만 확인 |
| NR04 | network node CRUD와 object placement | `fantasy-world-bootstrap` | 부분 | starter node 생성은 보지만 existing object placement dedicated 검증은 없음 |
| NR05 | node occurrence role과 metadata | 없음 | 없음 | node role, parent, metadata, node config 전용 시나리오 없음 |
| NR06 | layout-aware placement | 없음 | 없음 | 위치/크기/edge visual 검증 없음 |
| NR07 | concept CRUD | `fantasy-world-bootstrap` | 부분 | starter concept 생성은 보지만 concept content/update/delete는 없음 |
| NR08 | concept property CRUD | `fantasy-world-bootstrap` | 부분 | property/field value를 기대하지만 field type별 dedicated 검증은 없음 |
| NR09 | recurrence와 virtual occurrence | 없음 | 없음 | recurrence를 여러 field/meaning binding으로 모델링하거나 occurrence materialization하는 시나리오 없음 |
| NR10 | file/folder entity와 network placement | `think-data-structure-pdf-index` | 부분 | file entity를 seed하고 target PDF로 사용하지만 network placement는 없음 |
| NR11 | file metadata와 PDF TOC | `think-data-structure-pdf-index` | 강함 | `get_file_metadata`, `update_file_pdf_toc`, `pdf_toc.entries/pageCount/sourceMethod` 저장을 검증 |
| NR12 | edge CRUD | `fantasy-world-bootstrap` | 부분 | starter edge 생성은 볼 수 있으나 update/delete는 없음 |
| NR13 | edge semantics와 visual override | `fantasy-world-bootstrap` | 부분 | relation type/description 기대는 있으나 edge visual override는 없음 |
| NR14 | portal/subnetwork/navigation | `fantasy-world-bootstrap` | 부분 | network split 의도만 있고 portal/subnetwork interaction 검증은 약함 |
| NR15 | group/hierarchy/containment semantics | 없음 | 없음 | group/hierarchy/contains/hierarchy_parent 전용 검증 없음 |
| NR16 | schema CRUD | `fantasy-world-bootstrap` | 부분 | schema 생성은 보지만 update/delete는 없음 |
| NR17 | schema field definition CRUD | `fantasy-world-bootstrap` | 부분 | field definition 생성은 보지만 reorder/update/delete는 없음 |
| NR18 | model / meaning / binding | `fantasy-world-bootstrap` | 부분 | model 사용은 보려 하지만 model CRUD, schema meaning, field meaning bindings, meaning slot binding 전용 검증은 없음 |
| NR19 | ORM형 schema 관계와 property 모델링 | `fantasy-world-bootstrap` | 부분 | ORM형 관계 기대는 있으나 cycle/candidate/field-vs-edge 판단 검증은 약함 |
| NR20 | relation type CRUD | `fantasy-world-bootstrap` | 부분 | relation type 생성은 보지만 update/delete/visual default는 약함 |
| NR21 | type group CRUD | `fantasy-world-bootstrap` | 부분 | type group 생성 정도만 걸릴 수 있음. Ontology network 자동 투영 검증은 없음 |
| NR22 | discovery/search/candidate resolution | `fantasy-world-bootstrap` | 부분 | project summary와 중복 방지 여부를 강하게 검증하지 않음 |
| NR23 | `/bootstrap` domain interview와 실행 | `fantasy-world-bootstrap` | 강함 | target skill을 명시하고 `ask, ask, propose, create_type_group` 순서를 검증한다 |
| NR24 | `/index` artifact indexing | `think-data-structure-pdf-index` | 강함 | 실제 루트 PDF `Think Data Structure.pdf`의 목차 페이지를 읽고 저장하는 흐름 검증 |
| NR25 | Narre interaction과 safety | 모든 시나리오 | 부분 | Narre flow는 거치지만 approval card/transcript/tool log 품질 검증은 약함 |

## 현재 평가 세트의 실제 상태

현재 eval은 **bootstrap domain modeling**과 **PDF indexing**을 각각 하나씩 가진다.

볼 수 있는 것은 다음 정도다.

- fantasy domain에서 ontology-first bootstrap을 시도하는가
- 캐릭터, 세계관, 플롯, 스토리 같은 network split을 떠올리는가
- schema, model, meaning, field definition, relation type을 쓰려고 하는가
- starter graph를 만들려고 하는가
- PDF 목차 페이지를 읽고 승인 후 `pdf_toc` metadata를 저장하는가

아직 충분히 보지 못하는 것은 다음이다.

- 여러 도메인에서의 multi-turn interview 일반화
- 사용자가 Netior 구조를 모르는 상태에서 Narre가 먼저 model/meaning/ORM/network 설계를 제안하는지
- network object CRUD 전체
- Universe/Ontology system network 이해
- node occurrence와 node config
- portal/subnetwork/hierarchy/containment
- file/folder artifact placement 전반
- layout-aware graph projection
- destructive confirmation과 transcript 품질

## 우선 보강해야 할 신규 시나리오

### 1. `bootstrap-multiturn-domain-networking`

필수 표면:

- NR02
- NR04
- NR05
- NR07
- NR08
- NR16
- NR17
- NR18
- NR19
- NR20
- NR22
- NR23
- NR25

핵심:

- 사용자는 fantasy novel 도메인만 설명한다.
- tester는 Netior network, model, schema, ORM 개념을 모른다.
- Narre가 artifact 종류, workflow, 핵심 entity, 관계, containment, lifecycle을 인터뷰한다.
- Narre가 proposal을 만들고 승인 후 실제 network object CRUD를 수행한다.
- type group/schema/relation type이 Ontology network에 투영되는지 확인한다.

### 2. `network-object-crud-placement`

필수 표면:

- NR02
- NR03
- NR04
- NR05
- NR06
- NR14

핵심:

- 기존 concept/network/schema/relation type/file object를 조회한다.
- object record를 찾고 network node로 배치한다.
- node role과 metadata를 바꾼다.
- node 삭제와 object 삭제를 구분한다.

### 3. `portal-hierarchy-containment`

필수 표면:

- NR12
- NR13
- NR14
- NR15

핵심:

- concept 기반 subnetwork 생성/연결
- entry portal edge 생성
- group/hierarchy node 구성
- `structure.contains`와 `structure.parent` 구분

### 4. `schema-model-orm-contract`

필수 표면:

- NR16
- NR17
- NR18
- NR19
- NR20
- NR21
- NR22

핵심:

- fantasy domain에서 schema 설계
- model CRUD와 model 추론
- schema meaning과 field meaning bindings 생성
- 하나의 field가 여러 meaning binding을 갖거나 하나의 meaning이 여러 field로 표현되는 경우
- schema_ref/relation field 판단
- relation type과 field의 역할 분리
- type group 정리

### 5. `concept-property-values`

필수 표면:

- NR07
- NR08
- NR09
- NR17
- NR18
- NR22

핵심:

- field type별 property 값 입력
- choice/candidate lookup 사용
- recurrence slot property 입력
- concept visual/content 변경

### 6. `edge-semantics`

필수 표면:

- NR12
- NR13
- NR20

핵심:

- edge 생성
- relation type 지정
- edge description 작성
- relation meaning와 일반 relation type 구분
- edge update/delete

### 7. `file-artifact-indexing`

필수 표면:

- NR10
- NR11
- NR24

핵심:

- file/folder entity를 network에 배치
- file-level metadata와 node-level metadata 구분
- PDF page range 확인
- TOC 추출 후 `pdf_toc` 저장

### 8. `narre-safety-transcript`

필수 표면:

- NR25

핵심:

- mutation plan 제시
- destructive confirmation
- tool log와 transcript가 사람이 읽을 수 있게 남는지 검증

## 현재 의도적으로 제외한 시나리오 축

다음은 제품에는 있으나 현재 Narre 책임이 아니므로 신규 시나리오 백로그에서 제외한다.

- module CRUD
- module directory CRUD
- context CRUD
- context member add/remove
- project create/open/delete/repath
- workbench/tab/theme/terminal 설정

## 결론

현재 시나리오 세트는 Narre 책임 표면 전체를 거의 덮지 못한다.

가장 먼저 보강해야 하는 것은 단순 기능 단위 테스트가 아니라 다음 세 가지다.

- **multi-turn bootstrap**: 사용자는 도메인만 설명하고 Narre가 ontology/schema/network를 끌어낸다.
- **network object CRUD**: object lookup, node placement, edge relation, portal/hierarchy를 실제로 수행한다.
- **schema/model/meaning/ORM 검증**: 사용자가 모르는 model, meaning, field binding, schema 관계를 Narre가 적절히 선택한다.
