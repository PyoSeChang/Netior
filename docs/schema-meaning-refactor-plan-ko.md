# Schema / Meaning Key 리팩터링 계획

> 최신 agent-facing 계약은 `docs/features/semantics/model-meaning-field-agent-contract-ko.md`를 기준으로 한다.
> 이 문서는 `meaning_key`, `meaning_slot`, `model` 중심의 이전 전환 계획을 보존한 레거시 참고 문서다.

## 1. 목표

이번 리팩터링의 목표는 `schema`, `model`, `meaning_slot`, `edge.relation_meaning`, layout metadata가 각자 비슷한 의미를 반복해서 표현하던 구조를 하나의 의미 체계로 압축하는 것이다.

핵심 원칙은 다음과 같다.

- `Concept`는 실제 개념 또는 대상이다.
- `Schema`는 Concept가 따르는 구조 정의다. 기존 `Schema`의 제품 언어를 대체한다.
- `Slot`은 Schema가 정의하는 값 자리다. 기존 `SchemaField`의 제품 언어를 대체한다.
- `Property`는 Concept가 Slot에 채운 실제 값이다.
- `Relation`은 Concept 사이의 연결이다.
- `Meaning Key`은 앱과 agent가 읽는 meaning key이다.
- `Model`은 Meaning Key 묶음 또는 preset이다. 기존 model는 Model으로 낮춘다.
- `Semantic Projection`은 layout plugin, Narre, MCP가 읽는 정규화된 read model이다.

## 2. 이름 변경 기준

사용자-facing 용어는 아래처럼 정리한다.

| 기존 | 새 용어 | 이유 |
| --- | --- | --- |
| Schema | Schema | Concept의 구조와 의미 슬롯을 정의하는 틀 |
| Schema Field | Slot | Schema 안에서 값이 들어가는 자리 |
| Concept Property | Property | Concept의 실제 Slot 값 |
| Model | Model | 의미 원자가 아니라 meaning binding 묶음/preset |
| Meaning Slot | Meaning Key | 앱이 읽는 meaning key |
| Edge Relation Meaning | Relation Meaning | relation에 붙는 meaning key |

코드와 DB에서는 호환을 위해 기존 이름을 단계적으로 유지한다. 새 용어는 우선 타입 alias, API 입력, 문구, projection surface에서 도입한다.

## 3. 의미 체계

기존에는 field 의미와 edge 의미가 서로 다른 컬럼에 있었다.

```text
schema_fields.meaning_slot
edges.relation_meaning
schemas.models
```

새 모델에서는 이들을 하나의 vocabulary로 읽는다.

```text
Field Meaning:
  time.start
  time.end
  time.due
  workflow.status
  workflow.priority
  structure.parent

Relation Meaning:
  structure.contains
  structure.entry_portal
  structure.parent
```

부착 위치는 다르지만 의미 vocabulary는 하나다.

```text
Slot has meaning_key
Relation has meaning_key
```

## 4. Model 정책

Model은 저장 모델의 진실이 아니라 authoring preset이다.

예:

```text
Temporal Model
  core: time.start
  optional: time.end, time.all_day, time.timezone

Workflow Model
  core: workflow.status
  optional: workflow.priority, workflow.progress, workflow.assignees
```

Model을 제거할 때는 1차 리팩터링에서 Slot과 Property 값을 삭제하지 않는다. 자동 생성된 Slot도 보존하고, 현재 Model과 연결되지 않은 meaning binding은 detached 상태로 경고한다.

## 5. Compatibility Layer

기존 DB 컬럼은 즉시 제거하지 않는다.

```text
models
meaning_slot -> meaning_key
relation_meaning -> meaning_key
```

리포지토리는 새 필드와 기존 필드를 동시에 round-trip한다.

```text
write models
write meaning_key and meaning_slot
write meaning_key and relation_meaning
```

이 방식은 기존 UI, MCP, Narre, 저장 데이터와의 호환을 유지하면서 새 소비 모델로 이전할 수 있게 한다.

## 6. Semantic Projection

layout plugin과 agent는 raw schema를 직접 조합하지 않는다.

기존 소비 방식:

```text
schema -> fields -> meaning_slot -> concept_properties -> layout metadata
edge -> relation_meaning
```

새 소비 방식:

```text
ConceptSemanticProjection
  schemaId
  models
  values[meaning_key]
  rawValues[meaning_key]
  slotFieldIds[meaning_key]
  slotFieldTypes[meaning_key]
  components.temporal
  components.workflow
  components.structure
```

Calendar는 `time.start`, `time.end`, `time.all_day`만 읽으면 되고, hierarchy 계열은 `structure.parent`, `structure.contains`만 읽으면 된다.

## 7. 리팩터링 순서

1. 문서와 shared vocabulary를 고정한다.
2. 기존 slot/contract를 meaning key으로 변환하는 compatibility helper를 추가한다.
3. core repository가 `models`, `meaning_key`을 round-trip하게 한다.
4. desktop workspace에 Semantic Projection을 추가한다.
5. calendar/timeline/freeform 소비처를 projection helper 중심으로 옮긴다.
6. UI 문구를 Schema/Slot/Model 중심으로 바꾼다.
7. Narre/MCP 설명과 입력을 Schema/Slot/Meaning 언어로 확장한다.
8. 새 DB 컬럼을 추가하고 기존 컬럼에서 backfill한다.

## 8. 완료 기준

- 기존 `schema` 데이터가 `schema` 용어로 설명될 수 있다.
- schema의 model 참조는 `models`로만 유지한다.
- `meaning_slot`과 `meaning_key`이 같은 의미를 유지한다.
- `edge.relation_meaning`와 relation meaning이 같은 의미를 유지한다.
- layout plugin이 raw field/edge 의미를 직접 조합하지 않고 projection helper를 통해 읽는다.
- Model detach가 Concept Property 값을 삭제하지 않는다.
