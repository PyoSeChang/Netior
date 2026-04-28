# Narre MCP Coverage By Responsibility Surface

## 목적

이 문서는 [Netior Narre 책임 표면 인벤토리](responsibility-surface-ko.md)의 `NR01~NR25` 기준으로, 현재 MCP tool이 각 책임 표면을 얼마나 실제로 수행할 수 있는지 정리한다.

## 관련 문서

- [Netior 제품 전체 기능 리스트](../../product/feature-list-ko.md)
- [Netior Narre 책임 표면 인벤토리](responsibility-surface-ko.md)
- [Narre Eval 시나리오 인덱스 By Responsibility Surface](../eval/scenario-index-by-surface-ko.md)

## 판정 기준

- `강함`: 핵심 행위를 MCP로 직접 수행 가능
- `부분`: 일부 하위 행위만 가능하거나 조회/저수준 조합만 가능
- `없음`: 현재 MCP 표면에 직접 대응 없음
- `간접`: skill/runtime이 orchestration하고 MCP는 하위 도구만 제공

## 표면별 커버리지

| ID | 책임 표면 | MCP 커버리지 | 관련 MCP 도구 | 메모 |
|---|---|---|---|---|
| NR01 | 현재 project와 Universe/Ontology 이해 | 강함 | `get_project_summary`, `get_universe_network`, `get_project_ontology_network`, `get_network_tree` | `get_app_root_network`, `get_project_root_network` alias는 MCP tool list에서 제거했다. 시스템 네트워크는 `kind`로 구분한다 |
| NR02 | 일반 network object CRUD | 강함 | `list_networks`, `create_network`, `update_network`, `delete_network`, `get_network_tree`, `get_network_ancestors`, `get_network_full` | `kind = network`인 일반 network CRUD와 topology 조회는 직접 가능. Universe/Ontology는 시스템 네트워크라 직접 수정/삭제 대상 아님 |
| NR03 | object record 조회와 ref 해석 | 강함 | `get_object`, `get_object_by_ref` | domain object ID와 object record ID 연결 가능. `type_group`도 object type에 포함 |
| NR04 | network node CRUD와 object placement | 강함 | `create_network_node`, `update_network_node`, `delete_network_node`, `get_network_full`, `get_object_by_ref` | object placement 자체는 가능 |
| NR05 | node occurrence role과 metadata | 강함 | `create_network_node`, `update_network_node`, `delete_network_node` | `node_type`, `parent_node_id`, raw metadata, `node_config` 지원 |
| NR06 | layout-aware placement | 없음 | 없음 | node position, size, collapsed, edge visual 저장 도구가 없음 |
| NR07 | concept CRUD | 부분 | `list_concepts`, `create_concept`, `update_concept`, `delete_concept` | title/schema/visual은 가능. concept body/content는 MCP에 직접 노출되지 않음 |
| NR08 | concept property CRUD | 강함 | `get_concept_properties`, `upsert_concept_property`, `delete_concept_property` | field value 저장은 가능 |
| NR09 | recurrence와 virtual occurrence | 부분 | `upsert_concept_property`, `create_schema_field`, `update_schema_field` | recurrence를 여러 field와 meaning binding으로 표현할 수 있으나 recurrence source/occurrence materialization 전용 tool은 없음 |
| NR10 | file/folder entity와 network placement | 부분 | `list_directory`, `glob_files`, `read_file`, `get_object_by_ref`, `create_network_node` | file entity 일반 create/update/delete 도구가 없음. 이미 있는 file object 배치만 저수준 조합 가능 |
| NR11 | file metadata와 PDF TOC | 부분 | `get_file_metadata`, `update_file_pdf_toc` | PDF TOC는 가능. 일반 file metadata와 node-level metadata 전반은 부족 |
| NR12 | edge CRUD | 강함 | `create_edge`, `get_edge`, `update_edge`, `delete_edge` | 직접 가능 |
| NR13 | edge semantics와 visual override | 부분 | `create_edge`, `update_edge`, `list_relation_types`, `create_relation_type`, `update_relation_type` | relation/system/description은 가능. edge visual override tool은 없음 |
| NR14 | portal/subnetwork/navigation | 부분 | `create_network`, `create_network_node`, `create_edge`, `get_network_tree`, `get_network_ancestors` | portal 구조는 저수준 조합 가능. desktop open/switch UX는 MCP 밖 |
| NR15 | group/hierarchy/containment semantics | 부분 | `create_network_node`, `update_network_node`, `create_edge`, `delete_edge` | `group`/`hierarchy` role과 relation meaning는 가능. layout/drag/drop 수준은 없음 |
| NR16 | schema CRUD | 강함 | `list_schemas`, `create_schema`, `update_schema`, `delete_schema` | models까지 포함 |
| NR17 | schema field definition CRUD | 강함 | `list_schema_fields`, `create_schema_field`, `update_schema_field`, `delete_schema_field`, `reorder_schema_fields` | field definition과 `meaning_bindings` 입력이 열려 있음 |
| NR18 | model / meaning / binding | 강함 | `list_models`, `get_model`, `create_model`, `update_model`, `delete_model`, `list_schema_meanings`, `ensure_schema_meaning`, `update_schema_meaning`, `delete_schema_meaning`, `update_schema_meaning_slot`, `create_schema_field`, `update_schema_field` | model CRUD, model meanings/recipes, schema meaning, field meaning bindings, meaning slot binding 지원 |
| NR19 | ORM형 schema 관계와 property 모델링 | 강함 | `create_schema_field`, `update_schema_field`, `get_field_candidates`, `list_schema_fields` | `schema_ref`, relation field, candidate 조회 가능 |
| NR20 | relation type CRUD | 강함 | `list_relation_types`, `create_relation_type`, `update_relation_type`, `delete_relation_type` | 직접 가능 |
| NR21 | type group CRUD | 강함 | `list_type_groups`, `create_type_group`, `update_type_group`, `delete_type_group` | 직접 가능. type group object record와 Ontology network node 자동 투영은 core에서 처리한다 |
| NR22 | discovery/search/candidate resolution | 강함 | `get_project_summary`, `list_concepts`, `get_field_candidates`, `get_network_full`, `get_object_by_ref` | 중복 방지와 후보 탐색에 필요한 도구가 있음 |
| NR23 | `/bootstrap` domain interview와 실행 | 간접 | `ask`, `propose`, `confirm` + graph/schema tools | skill prompt가 orchestration하고 MCP가 mutation을 수행 |
| NR24 | `/index` artifact indexing | 간접 | `read_pdf_pages`, `read_pdf_pages_vision`, `get_file_metadata`, `update_file_pdf_toc` | skill prompt가 orchestration |
| NR25 | Narre interaction과 safety | 간접 | 전체 MCP metadata, approval metadata | session/card/tool-log는 narre-server와 desktop-app 책임 |

## 현재 MCP가 강한 축

현재 MCP는 다음 축에서 Narre 실행기로 충분히 쓸 수 있다.

- network CRUD
- object lookup
- network node CRUD
- edge CRUD
- concept property CRUD
- schema CRUD
- field definition CRUD
- model CRUD와 model recipe 조작
- schema meaning과 field meaning binding 조작
- relation type CRUD
- type group CRUD
- Universe/Ontology system network 조회
- project summary와 candidate lookup

즉 **schema + graph core + object placement**는 비교적 잘 열려 있다.

## 현재 MCP가 약한 축

### 1. Layout-aware placement

Narre가 starter graph를 만들면 사용자는 결과를 캔버스에서 봐야 한다. 그런데 현재 MCP에는 다음이 없다.

- node position 저장
- node size/collapsed 저장
- edge visual override 저장
- layout type/config 수정

따라서 graph content는 만들 수 있어도, “보기 좋은 network projection”은 아직 약하다.

### 2. File entity 일반 계층

PDF TOC 저장은 가능하지만 다음은 부족하다.

- file entity create
- file entity update
- file entity delete
- path 기반 file entity 조회/생성
- node-level file metadata 편집

현재 `/index`는 일부 가능하지만, file/folder object를 graph에 끌어올리는 일반 workflow는 충분하지 않다.

### 3. Concept body와 recurrence

concept title/schema/visual은 열려 있지만 다음은 약하다.

- concept body/content create/update
- recurrence source/occurrence key 직접 조작
- recurring occurrence materialization 전용 workflow

### 4. Edge visual override

edge semantic은 가능하지만, `EdgeEditor`가 다루는 layout-level visual override는 MCP에 없다.

## 현재 의도적으로 제외한 축

다음은 제품에는 있으나 현재 Narre 책임 surface와 MCP coverage 우선순위에서 제외한다.

- module CRUD
- module directory CRUD
- context CRUD
- context member add/remove
- project lifecycle CRUD
- workbench/tab/theme/terminal 설정

이 항목은 “MCP 공백”으로 기록하지 않는다. 지금은 Narre 책임이 아니기 때문이다.

## 결론

현재 MCP는 Narre를 **Netior 도메인 모델 조작기**로 만들기 위한 핵심 도구는 갖추고 있다.

다만 `/bootstrap`이 실제 제품 품질로 동작하려면 다음 보강이 우선이다.

- layout node position/edge visual tool
- file entity general CRUD
- concept content update
- recurrence/occurrence 전용 workflow
- high-level portal/group/hierarchy helper
