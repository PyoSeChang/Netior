# Field Meaning Bindings

작성일: 2026-04-27
상태: Implementation Draft

## 목적

Netior의 slot 의미 모델을 `meaning_key` 단수에서 `field_meaning_bindings` 복수 모델로 확장한다.

기존 모델은 slot 하나를 하나의 meaning key에만 연결했다.

```text
Slot: 마감일
meaning_key: time.due
```

이 방식은 layout plugin이 쓰기에는 단순하지만, 온톨로지와 agent query 관점에서는 너무 빨리 막힌다. 실제 slot은 하나의 값 자리를 가지면서도 여러 의미론적 성격을 동시에 가진다.

```text
Slot: 마감일
field_meaning_bindings:
- time.due
- temporal.deadline
- obligation.due
- boundary.deadline
- consequence.trigger
```

## 개념 구분

```text
Schema
  Concept가 따르는 구조 패턴

Slot
  Schema 안에서 값을 담는 자리

Property
  Concept가 Slot에 채운 실제 값

Meaning Key
  previous 호환용 대표 의미. slot당 0..1개.

Field Meaning Binding
  slot이 온톨로지 안에서 갖는 의미론적 성격. slot당 0..N개.

Model
  slot과 field meaning bindings 묶음을 제안하는 authoring preset.
```

`meaning_key`은 대표값이다. `meaning binding`는 의미 경로다.

## 왜 필요한가

온톨로지 쿼리는 하나의 slot을 여러 경로로 찾아야 한다.

예를 들어 `마감일`은 시간 쿼리에도, 의무 쿼리에도, 경계 조건 쿼리에도 걸려야 한다.

```text
temporal.* slot 찾기
-> 마감일 포함

obligation.due slot 찾기
-> 마감일 포함

boundary.deadline + consequence.trigger 찾기
-> 마감일 포함
```

단일 `time.due`만 있으면 이런 경로를 매번 이름 하나에 우겨넣어야 한다. meaning binding junction을 두면 query builder, Narre, MCP, layout plugin이 같은 slot을 서로 다른 의미 축에서 안정적으로 찾을 수 있다.

## 데이터 계약

previous column은 즉시 제거하지 않는다.

```text
schema_fields.meaning_key TEXT
```

새 구조는 junction table로 둔다.

```text
field_meaning_bindings
- id
- field_id
- meaning_key
- source      manual | model | migration | system
- strength    optional
- sort_order
- created_at
```

`meaning_key`는 `temporal.deadline`, `obligation.due`처럼 dotted path를 쓴다. 지금은 key registry와 자유 확장을 같이 허용한다.

## Backfill 규칙

기존 meaning_key은 최소 하나의 meaning binding로 mirror된다.

```text
time.start -> time.start + temporal.point + temporal.boundary.start
time.end   -> time.end + temporal.point + temporal.boundary.end
time.due   -> time.due + temporal.point + temporal.deadline + obligation.due + boundary.deadline + consequence.trigger
```

그 외 meaning_key은 기본적으로 자기 자신을 meaning binding로 가진다.

## Projection 계약

layout plugin과 agent는 raw field를 직접 조합하지 않고 semantic projection을 읽는다.

```text
semantic.slots[meaning_key]
semantic.valuesByMeaningBinding[meaning_binding]
semantic.slotFieldIds[meaning_key]
semantic.meaningBindingFieldIds[meaning_binding]
```

기존 소비처는 `semantic.slots.time.start` 경로를 계속 쓸 수 있다. 새 소비처는 `semantic.valuesByMeaningBinding.temporal.deadline`처럼 meaning binding 경로로 검색한다.

## Model 계약

Model은 더 이상 단일 meaning_key 묶음만이 아니다. Model은 slot과 meaning binding bundle을 제안한다.

```text
Model: dueable

recommends:
Slot: Due
meaning_key: time.due
meaning_bindings:
- time.due
- temporal.deadline
- obligation.due
- boundary.deadline
- consequence.trigger
```

Model detach는 slot/property를 삭제하지 않는다. meaning binding source가 `model`인 binding만 별도로 제거할 수 있는 방향으로 확장한다.

## 호환성 원칙

- `meaning_key`은 previous 대표 의미로 유지한다.
- 새 code path는 `field_meaning_bindings`를 우선 읽는다.
- `field_meaning_bindings`가 비어 있으면 `meaning_key`에서 meaning binding를 유도한다.
- `meaning_slot`은 더 오래된 previous key로 유지하되, meaning binding projection에서는 fallback으로만 쓴다.

## 다음 단계

1. Meaning binding editor UI를 만든다.
2. Meaning binding ontology graph를 `field_meaning_bindings` registry나 ontology network로 승격한다.
3. Query builder가 `meaning_key`, prefix, parent/child expansion을 지원하게 한다.
4. Previous `meaning_key` 제거 여부를 별도 migration으로 결정한다.
