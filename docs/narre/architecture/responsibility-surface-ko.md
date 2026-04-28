# Netior Narre 책임 표면 인벤토리

## 목적

이 문서는 Netior 앱 전체 기능 중 **Narre가 사용자의 자연어 요청을 받아 직접 이해하고 조작해야 하는 제품 책임 표면**을 정리한다.

핵심 기준은 단순하다.

- 사용자는 Netior의 network, node, edge, schema, model, meaning, slot, binding, field definition를 몰라도 된다.
- Narre는 사용자가 설명한 도메인을 바탕으로 어떤 네트워크 객체를 만들고, 어떤 관계를 맺고, 어떤 타입/속성을 설계해야 하는지 스스로 추론해야 한다.
- 따라서 Narre 책임은 “채팅 응답”이 아니라 **network object CRUD, 그래프 authoring, 타입/관계 모델링, artifact indexing**이다.

## 관련 문서

- [Netior 제품 전체 기능 리스트](../../product/feature-list-ko.md)
- [Narre MCP Coverage By Responsibility Surface](mcp-coverage-by-surface-ko.md)
- [Narre Eval 시나리오 인덱스 By Responsibility Surface](../eval/scenario-index-by-surface-ko.md)

## 이번 문서의 경계

### Narre 책임에 포함한다

- network object에 관한 생성, 조회, 수정, 삭제, 배치, 탐색
- network node 생성, 수정, 삭제, occurrence role, node metadata, node config
- edge 생성, 조회, 수정, 삭제, relation type, relation meaning, visual override
- concept 생성, 수정, 삭제, schema 연결, property 값 입력
- schema, model, meaning, field definition, field meaning binding, meaning slot binding, ORM형 참조 설계
- relation type, type group 설계
- file/folder entity를 network object로 끌어올리고 file/PDF metadata를 구조화하는 일
- `/bootstrap`, `/index`처럼 Narre가 제품 구조를 실제로 바꾸는 skill

### 현재 Narre 책임에서 제외한다

- **module / module directory 등록**: 파일 접근을 위한 앱 설정 계층이다. Narre가 파일을 읽을 수는 있어야 하지만 module CRUD 자체는 지금 Narre 책임이 아니다.
- **context authoring**: context 생성, 수정, 삭제, member 관리가 앱에는 있지만 현재 Narre 책임 표면에서 제외한다.
- **project lifecycle**: 프로젝트 생성, 열기, 삭제, 누락 경로 재지정은 앱 진입 UX다. Narre는 current project metadata와 프로젝트의 Ontology network를 이해하면 된다.
- workbench 편의 기능: split pane, detached window, 탭 관리, theme, font, terminal appearance, shortcut 설정
- 일반 파일 에디터 기능: Markdown/code/image/PDF viewer 자체 조작

## 조사 범위

다음 구현 표면을 실제로 읽고 책임 표면을 다시 잡았다.

- `packages/shared/src/types/index.ts`
- `packages/shared/src/constants/netior-mcp-tools.ts`
- `packages/netior-core/src/repositories/objects.ts`
- `packages/netior-core/src/repositories/network.ts`
- `packages/netior-core/src/repositories/system-networks.ts`
- `packages/netior-core/src/migrations/022-network-universe-ontology.ts`
- `packages/netior-core/src/repositories/concept.ts`
- `packages/netior-core/src/repositories/concept-property.ts`
- `packages/netior-core/src/repositories/schema.ts`
- `packages/netior-core/src/repositories/relation-type.ts`
- `packages/netior-core/src/repositories/type-group.ts`
- `packages/netior-core/src/repositories/file.ts`
- `packages/desktop-app/src/main/ipc/network-ipc.ts`
- `packages/desktop-app/src/main/ipc/object-ipc.ts`
- `packages/desktop-app/src/main/ipc/file-ipc.ts`
- `packages/desktop-app/src/renderer/components/workspace/NetworkWorkspace.tsx`
- `packages/desktop-app/src/renderer/components/workspace/ObjectPickerModal.tsx`
- `packages/desktop-app/src/renderer/components/workspace/FileNodeAddModal.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NodeContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NetworkContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/editor/ConceptEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/ConceptPropertiesPanel.tsx`
- `packages/desktop-app/src/renderer/components/editor/SchemaEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/RelationTypeEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/EdgeEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/FileMetadataEditor.tsx`
- `packages/netior-mcp/src/tools/*`

## Network Object 책임 매트릭스

`NetworkObjectType`은 현재 다음 object type을 가진다.

| object type | 제품 데이터 원천 | Narre 책임 여부 | Narre가 해야 하는 일 |
|---|---|---|---|
| `concept` | `concepts` | 포함 | 생성, 수정, 삭제, 조회, property 입력, network node 배치, occurrence 관리 |
| `network` | `networks` | 포함 | `kind = network`인 일반 네트워크 생성, 수정, 삭제, hierarchy 구성, portal/subnetwork 연결 |
| `project` | `projects` | 부분 포함 | 프로젝트 생성/삭제는 제외. Universe에서 project object를 portal node로 이해하고 탐색하는 것은 포함 |
| `schema` | `schemas` | 포함 | CRUD, model, field definition, file template, visual default 설계 |
| `model` | `semantic_models` | 포함 | CRUD, description, category, meanings, field recipes를 설계하고 schema에 부착 |
| `relation_type` | `relation_types` | 포함 | CRUD, edge semantic default, line style, directed, color 설계 |
| `type_group` | `type_groups` | 포함 | Ontology network에 투영되는 schema organization object로 이해하고 CRUD를 수행 |
| `file` | `files` | 포함 | file/directory entity 조회/생성/metadata 수정, network node 배치, PDF TOC 저장 |
| `folder` | 명시적 repository 없음 | 부분 포함 | 현재는 별도 folder CRUD가 아니라 `FileEntity.type = directory`로 다룬다 |
| `agent` | 현재 제품 구현 없음 | 제외 | 현재 Narre 책임 표면 아님 |
| `module` | `modules` | 제외 | module CRUD는 Narre 책임 아님 |
| `context` | `contexts` | 제외 | context authoring은 현재 Narre 책임 아님 |

중요한 점은 `objects` 테이블이 독립적인 사용자 편집 대상이 아니라는 것이다. `concept`, `network`, `schema`, `model`, `relation_type`, `type_group`, `file`, `project`가 만들어질 때 object record가 함께 만들어지고, Narre는 이 object record를 조회해서 `network_nodes`에 배치한다.

현재 코드 기준으로 `Universe`와 `Ontology`는 일반 network가 아니라 시스템 네트워크다.

- `Universe`: 앱 전체 프로젝트 포털 네트워크. project object가 portal node로 배치된다.
- `Ontology`: 프로젝트의 타입/스키마 네트워크. type group, schema, model, relation type object가 자동 투영된다.
- `network`: 사용자가 도메인 작업을 투영하는 일반 네트워크. Narre가 생성/수정/삭제할 수 있는 주 대상이다.

## 책임 표면 ID

| ID | 책임 표면 | 핵심 질문 |
|---|---|---|
| NR01 | 현재 project와 Universe/Ontology 이해 | Narre가 어떤 project, Universe, Ontology, 일반 network 범위에서 작업하는지 정확히 아는가 |
| NR02 | 일반 network object CRUD | `kind = network`인 network를 만들고, 이름/부모/scope를 바꾸고, 삭제하고, tree/ancestor를 읽는가 |
| NR03 | object record 조회와 ref 해석 | domain object와 network object record를 안전하게 연결하는가 |
| NR04 | network node CRUD와 object placement | 기존 object를 network 안에 node로 배치, 수정, 삭제하는가 |
| NR05 | node occurrence role과 metadata | 같은 object의 여러 occurrence, node type, parent, metadata, node config를 다루는가 |
| NR06 | layout-aware placement | starter graph를 만들 때 node 위치/크기/접힘/edge visual 같은 보기 상태를 고려하는가 |
| NR07 | concept CRUD | concept title, schema, icon/profile image, color, content를 다루는가 |
| NR08 | concept property CRUD | field definition에 맞춰 property 값을 입력, 수정, 삭제하는가 |
| NR09 | recurrence와 virtual occurrence | recurring concept, occurrence materialization, 여러 field/meaning binding 기반 반복 구조를 이해하는가 |
| NR10 | file/folder entity와 network placement | 파일/디렉터리를 object화하고 network node로 배치하는가 |
| NR11 | file metadata와 PDF TOC | file-level metadata와 node-level metadata, PDF TOC를 구분해 다루는가 |
| NR12 | edge CRUD | edge 생성, 조회, 수정, 삭제를 직접 수행하는가 |
| NR13 | edge semantics와 visual override | relation type, relation meaning, description, visual override를 구분하는가 |
| NR14 | portal/subnetwork/navigation | concept/network/project node에서 subnetwork와 portal 흐름을 구성하는가 |
| NR15 | group/hierarchy/containment semantics | `structure.contains`, `structure.parent`, group/list/grid/hierarchy 구조를 다루는가 |
| NR16 | schema CRUD | 도메인 class를 만들고 수정하고 삭제하는가 |
| NR17 | schema field definition CRUD | field type, required, default, option, order, ref schema, meaning bindings를 다루는가 |
| NR18 | model / meaning / binding | model CRUD, model meanings, field recipes, schema meaning, field meaning bindings, meaning slot binding을 다루는가 |
| NR19 | ORM형 schema 관계와 property 모델링 | schema 간 참조, relation field, choice source, cycle 위험을 설계하는가 |
| NR20 | relation type CRUD | edge class를 만들고 수정하고 삭제하는가 |
| NR21 | type group CRUD | schema/relation type 그룹을 만들고 정리하는가 |
| NR22 | discovery/search/candidate resolution | 기존 object, concept, field candidate를 찾아 중복 생성과 잘못된 참조를 피하는가 |
| NR23 | `/bootstrap` domain interview와 실행 | 사용자의 도메인 설명에서 ontology, schema, graph, artifact workflow를 추론해 만드는가 |
| NR24 | `/index` artifact indexing | PDF를 읽고 구조화된 TOC/file metadata를 저장하는가 |
| NR25 | Narre interaction과 safety | mention, slash, approval card, destructive confirmation, tool log를 안전하게 운용하는가 |

## 상세 책임 표면

### NR01. 현재 project와 Universe/Ontology 이해

관련 구현:

- `system-networks.ts`
- `project-tools.ts`
- `get_universe_network`
- `get_project_ontology_network`
- `get_project_summary`

Narre 책임:

- current project를 `project_id`로 직접 찍어 넣는 것이 아니라 project metadata와 런타임 범위 정보에서 해석한다.
- Universe와 Ontology를 구분한다.
- Universe는 앱 전체 프로젝트 포털 네트워크이며, project object는 Universe에서 portal node로 다뤄진다.
- Ontology는 프로젝트의 타입/스키마 네트워크이며, type group/schema/model/relation type object가 자동 투영된다.
- Universe/Ontology는 일반 network처럼 이름/부모를 바꾸거나 삭제하지 않는다.
- project lifecycle CRUD는 하지 않는다.

### NR02. 일반 network object CRUD

관련 구현:

- `network.ts`
- `network-ipc.ts`
- `network-tools.ts`

Narre 책임:

- `list_networks`, `create_network`, `update_network`, `delete_network` 수준의 network CRUD를 수행한다.
- 생성/수정/삭제 대상은 `kind = network`인 일반 network다.
- `kind = universe`와 `kind = ontology`는 시스템 네트워크이므로 직접 생성/수정/삭제 대상이 아니다.
- `parent_network_id`를 통해 network tree를 설계한다.
- `get_network_tree`, `get_network_ancestors`, `get_network_full`로 현재 구조를 읽는다.
- `/bootstrap`에서 캐릭터, 세계관, 플롯, 스토리처럼 domain-specific network split을 스스로 제안한다.

### NR03. object record 조회와 ref 해석

관련 구현:

- `objects.ts`
- `object-ipc.ts`
- `object-tools.ts`
- `ObjectPickerModal.tsx`

Narre 책임:

- domain object ID와 object record ID를 혼동하지 않는다.
- `get_object_by_ref(object_type, ref_id)`로 network node에 넣을 object record를 찾는다.
- `concept`, `network`, `project`, `schema`, `relation_type`, `type_group`, `file`을 object로 배치할 수 있음을 이해한다.
- `module`, `context`, `agent`는 현재 Narre 책임 표면에서 제외한다.

### NR04. network node CRUD와 object placement

관련 구현:

- `network.ts`의 `addNetworkNode`, `updateNetworkNode`, `removeNetworkNode`
- `network-node-tools.ts`
- `NetworkWorkspace.tsx`
- `ObjectPickerModal.tsx`

Narre 책임:

- 새 object를 만들고 끝내지 않고 필요한 network에 node로 배치한다.
- 기존 object를 찾은 뒤 `create_network_node`로 배치한다.
- node 삭제와 object 삭제를 구분한다. node 삭제는 occurrence 제거이고 object 삭제는 원본 제거다.
- network/project object는 기본적으로 portal 역할을 할 수 있음을 이해한다.
- Ontology가 관리하는 schema object node는 수동 삭제/이동보다 schema CRUD를 통해 바뀌는 자동 투영으로 취급한다.

### NR05. node occurrence role과 metadata

관련 구현:

- `NetworkNode`
- `ConceptEditor.tsx`
- `network-node-tools.ts`
- `node-config.ts`

Narre 책임:

- 같은 concept가 여러 network에 여러 node occurrence로 존재할 수 있음을 이해한다.
- `basic`, `portal`, `group`, `hierarchy` node role을 목적에 맞게 선택한다.
- `parent_node_id`, raw `metadata`, structured `nodeConfig`를 구분한다.
- group/list/grid 정렬 기준을 meaning binding 또는 concrete property field로 잡을 수 있음을 이해한다.

### NR06. layout-aware placement

관련 구현:

- `layout` repository/service
- `NetworkWorkspace.tsx`
- `EdgeEditor.tsx`

Narre 책임:

- starter graph를 만들 때 모든 node를 무작위로 쌓아두지 않는다.
- 현재 MCP는 layout node position과 edge visual 저장 도구가 부족하므로 coverage gap으로 관리해야 한다.
- 사용자에게 보이는 graph 품질은 content 품질과 별개가 아니라 Narre 결과물의 일부다.
- 다만 viewport/pan/zoom 같은 개인 보기 상태는 Narre 책임이 아니다.

### NR07. concept CRUD

관련 구현:

- `concept.ts`
- `concept-tools.ts`
- `ConceptEditor.tsx`

Narre 책임:

- `create_concept`, `update_concept`, `delete_concept`, `list_concepts`를 수행한다.
- title, schema, color, icon/profile image, content를 구분한다.
- schema default color/icon/file template가 concept 생성에 영향을 준다는 점을 이해한다.
- concept 생성 뒤 필요한 network node 배치를 이어서 수행한다.

### NR08. concept property CRUD

관련 구현:

- `concept-property.ts`
- `concept-property-tools.ts`
- `ConceptPropertiesPanel.tsx`

Narre 책임:

- `get_concept_properties`, `upsert_concept_property`, `delete_concept_property`를 수행한다.
- `text`, `textarea`, `number`, `boolean`, `date`, `datetime`, `select`, `multi-select`, `radio`, `relation`, `schema_ref`, `file`, `url`, `color`, `rating`, `tags` field type의 저장 형식을 이해한다.
- `meaning_bindings`와 field type이 concept property 입력에 어떤 의미를 주는지 고려한다.
- 사용자가 model, meaning, field를 몰라도 Narre가 적절한 property 값을 넣어야 한다.

### NR09. recurrence와 virtual occurrence

관련 구현:

- `ConceptEditor.tsx`
- `MEANING_SLOT_DEFINITIONS`
- `NetworkWorkspace.tsx`

Narre 책임:

- 반복은 단일 문자열 필드가 아니라 cadence, interval, count/until, start/end 같은 여러 field와 meaning binding의 조합일 수 있음을 이해한다.
- recurring concept와 materialized occurrence concept를 구분한다.
- 반복 일정/퀘스트/에피소드 같은 도메인에서는 단일 concept 복제가 아니라 recurrence semantics를 고려한다.

### NR10. file/folder entity와 network placement

관련 구현:

- `file.ts`
- `file-ipc.ts`
- `FileNodeAddModal.tsx`
- `NetworkWorkspace.tsx`

Narre 책임:

- 파일이나 디렉터리를 network node로 배치하려면 먼저 file entity가 있어야 함을 이해한다.
- 기존 file entity를 path로 찾고 없으면 생성한 뒤 object record를 찾아 node로 배치한다.
- directory는 별도 `folder` repository가 아니라 `FileEntity.type = directory`로 다룬다.
- module CRUD는 책임이 아니지만, 등록된 파일 접근 범위 안에서 artifact를 찾는 것은 필요하다.

### NR11. file metadata와 PDF TOC

관련 구현:

- `FileMetadataEditor.tsx`
- `pdf-tools.ts`
- `filesystem-tools.ts`
- `index-toc.ts`

Narre 책임:

- file-level metadata와 node-level metadata를 구분한다.
- file-level metadata 예: `description`, `content_type`, `topics`, `pdf_toc`
- node-level metadata 예: network-local `description`, `relevant_pages`
- `/index`에서는 PDF page range를 읽고 승인된 TOC를 file metadata에 저장한다.

### NR12. edge CRUD

관련 구현:

- `network.ts`의 `createEdge`, `getEdge`, `updateEdge`, `deleteEdge`
- `edge-tools.ts`
- `NodeContextMenu.tsx`
- `EdgeContextMenu.tsx`

Narre 책임:

- edge 생성, 조회, 수정, 삭제를 직접 수행한다.
- edge를 만들 때 source/target node ID를 정확히 써야 한다.
- concept 사이의 값 관계가 property여야 하는지 edge여야 하는지 판단한다.
- destructive edge delete는 명확한 confirmation 대상이다.

### NR13. edge semantics와 visual override

관련 구현:

- `EdgeEditor.tsx`
- `RelationTypeEditor.tsx`
- `layout` edge visual

Narre 책임:

- relation type, relation meaning, description을 구분한다.
- relation type의 기본 `color`, `line_style`, `directed`와 edge-level visual override를 구분한다.
- `structure.contains`, `structure.entry_portal`, `structure.parent`는 일반 관계명이 아니라 product meaning이다.

### NR14. portal/subnetwork/navigation

관련 구현:

- `NodeContextMenu.tsx`
- `NetworkContextMenu.tsx`
- `NetworkWorkspace.tsx`

Narre 책임:

- concept가 하위 network를 가져야 하는 경우 subnetwork를 만들고 portal로 연결한다.
- network object를 node로 배치할 때 portal role을 이해한다.
- Universe의 project node, sibling network switch, breadcrumb/ancestor 탐색 흐름을 이해한다.
- 사용자가 “이 부분은 별도 세계관/플롯 맵으로 나누자”라고 말하면 network split을 제안하고 실행한다.

### NR15. group/hierarchy/containment semantics

관련 구현:

- `NetworkWorkspace.tsx`
- `ConceptEditor.tsx`
- `HIERARCHY_PARENT_CONTRACT`

Narre 책임:

- 단순 edge와 containment edge를 구분한다.
- group node와 hierarchy node는 단순 시각 요소가 아니라 node child ownership과 정렬 semantics를 가진다.
- `structure.contains`와 `structure.parent`를 적절히 사용한다.
- 캐릭터 소속, 플롯 단계, 세계관 계층 같은 도메인 구조를 node group/hierarchy로 표현할지 edge/relation으로 표현할지 판단한다.

### NR16. schema CRUD

관련 구현:

- `schema.ts`
- `schema-tools.ts`
- `SchemaEditor.tsx`

Narre 책임:

- schema을 도메인 class로 설계한다.
- `name`, `description`, `icon`, `color`, `node_shape`, `file_template`, `models`, `group_id`를 다룬다.
- schema을 만들고 끝내지 않고 필요한 field definition와 relation type까지 연결한다.

### NR17. schema field definition CRUD

관련 구현:

- `schema.ts`
- `schema-field-tools.ts`
- `SchemaEditor.tsx`

Narre 책임:

- field 추가, 수정, 삭제, reorder를 수행한다.
- `field_type`, `allowed_types`, `required`, `default_value`, `options`, `ref_schema_id`, `meaning_bindings`, `generated_by_model`를 구분한다.
- field가 concept property 입력과 어떻게 연결되는지 이해한다.

### NR18. model / meaning / binding

관련 구현:

- `semantic-model.ts`
- `model-tools.ts`
- `schema-meaning-tools.ts`
- `SchemaEditor.tsx`
- `schema-field-tools.ts`

Narre 책임:

- 사용자가 model를 모른다는 전제로 domain에서 필요한 model를 추론하거나 새로 만든다.
- model은 schema에 종속된 폼 조각이 아니라 project-level 의미 preset이다. description, category, meanings, field recipes를 가진다.
- schema에 model을 붙일 때는 schema meaning과 field recipe를 통해 실제 field definition으로 투영한다.
- field 하나는 여러 `meaning_bindings`를 가질 수 있고, meaning 하나도 여러 field로 표현될 수 있음을 이해한다.
- meaning slot binding은 built-in meaning이 요구하는 내부 slot을 실제 field, edge, derived 값에 연결하는 내부 계약이다.
- model-generated field와 사용자가 만든 detached meaning field를 구분한다.

### NR19. ORM형 schema 관계와 property 모델링

관련 구현:

- `SchemaField.field_type = schema_ref`
- `relation` field type
- `get_field_candidates`
- schema ref cycle detection

Narre 책임:

- “캐릭터는 세력에 속한다”, “퀘스트는 보상을 가진다”, “플롯은 장면을 포함한다” 같은 관계를 field로 둘지 edge/relation type으로 둘지 판단한다.
- `schema_ref`로 embedded/reference property를 만들 수 있음을 이해한다.
- `relation` field와 graph edge의 차이를 설명 없이 실무적으로 적용한다.
- circular schema reference 위험을 피한다.

### NR20. relation type CRUD

관련 구현:

- `relation-type.ts`
- `relation-type-tools.ts`
- `RelationTypeEditor.tsx`

Narre 책임:

- relation type을 edge class로 설계한다.
- `name`, `description`, `color`, `line_style`, `directed`, `group_id`를 다룬다.
- 관계가 domain-level edge라면 concept property가 아니라 relation type과 edge로 표현한다.

### NR21. type group CRUD

관련 구현:

- `type-group.ts`
- `type-group-tools.ts`
- `TypeGroupModal.tsx`

Narre 책임:

- schema과 relation type이 많아질 때 group을 만들어 정리한다.
- group 생성, 이름 변경, parent 변경, 정렬, 삭제를 수행한다.
- group은 도메인 객체 자체는 아니지만 schema 관리성에 영향을 준다.
- 현재 코드 기준으로 type group도 `NetworkObjectType`이며 Ontology network에 `type_group` object node로 자동 투영된다.

### NR22. discovery/search/candidate resolution

관련 구현:

- `list_concepts`
- `get_field_candidates`
- `get_project_summary`
- `get_network_full`
- `get_object_by_ref`

Narre 책임:

- 이미 있는 concept/schema/relation type/network/file을 먼저 찾고 중복 생성을 피한다.
- property filter와 field candidate를 사용해 올바른 concept 후보를 찾는다.
- project summary를 읽고 현재 schema와 graph 상태를 이해한다.
- tool use에서 사람이 알 수 없는 UUID를 임의로 추측하지 않는다.

### NR23. `/bootstrap` domain interview와 실행

관련 구현:

- `narre-server/src/prompts/bootstrap.ts`
- `narre-server/src/prompt-skills/bootstrap-skill.ts`
- `fantasy-world-bootstrap` scenario

Narre 책임:

- 사용자가 Netior 구조를 몰라도 domain brief를 바탕으로 ontology를 추론한다.
- 바로 생성하지 않고 artifact 종류, workflow, 핵심 entity, 관계, containment, lifecycle을 인터뷰한다.
- 이후 schema, model, meaning, field definition, relation type, network split, starter concept/node/edge 생성 계획을 제안한다.
- 승인 후 실제 network object CRUD를 수행한다.

### NR24. `/index` artifact indexing

관련 구현:

- `narre-server/src/prompts/index-toc.ts`
- `pdf-tools.ts`
- `FileMetadataEditor.tsx`

Narre 책임:

- PDF mention 또는 file object를 정확히 해석한다.
- 필요한 page range와 overview page를 확인한다.
- TOC를 구조화하고 사용자 승인 뒤 `pdf_toc` metadata에 저장한다.
- file metadata와 node metadata를 혼동하지 않는다.

### NR25. Narre interaction과 safety

관련 구현:

- `NarreChat.tsx`
- `NarreMentionInput.tsx`
- `NarreToolLog.tsx`
- `narre-ipc.ts`
- `narre-server`

Narre 책임:

- mention chip을 통해 project object, concept, file, network 등 참조를 정확히 해석한다.
- slash command에 따라 dynamic skill prompt를 로드한다.
- mutation tool은 승인/확인 경계를 지킨다.
- 삭제, 대량 변경, schema 변경, network split 같은 변경은 사용자가 이해할 수 있게 plan과 diff를 먼저 보여준다.
- tool log와 transcript가 나중에 평가 가능해야 한다.

## 책임에서 빠지면 안 되는 핵심 결론

Narre 책임의 중심은 다음 세 축이다.

- **Network object CRUD**: concept, 일반 network, schema, model, relation type, type group, file object를 만들고 수정하고 삭제하고 node로 배치한다.
- **Ontology/schema 추론**: 사용자가 모르는 model, meaning, field definition, ORM형 관계, relation type을 Narre가 도메인에서 추론한다.
- **Graph projection**: 추론한 도메인 구조를 실제 network, node, edge, portal, group, hierarchy로 투영한다.

따라서 `fantasy world bootstrap` 같은 평가에서는 최소한 다음이 보여야 한다.

- 캐릭터, 세계관, 플롯, 스토리 network split
- 캐릭터/세력/장소/사건/장면 같은 schema
- model, meaning, field meaning binding 사용
- schema_ref 또는 relation field 기반 ORM형 관계
- relation type과 edge를 통한 그래프 관계
- Ontology network에 투영되는 type group/schema/model/relation type 구조
- starter concept/node/edge 배치
- 사용자가 network나 model를 몰라도 Narre가 먼저 제안하는 interview/proposal 흐름

## 현재 제외 항목 재확인

다음은 앱 기능이지만 지금 Narre 책임 문서와 eval backlog에서 제외한다.

- module CRUD
- module directory CRUD
- context CRUD
- context member add/remove
- project create/open/delete/repath
- workbench/tab/split/detached window
- theme/font/shortcut/terminal appearance

이 항목들은 제품 기능 문서에는 남아 있어야 하지만, Narre 책임 표면에는 넣지 않는다.
