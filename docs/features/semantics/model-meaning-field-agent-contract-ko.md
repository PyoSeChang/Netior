# Model / Meaning / Field Agent Contract

작성일: 2026-04-27
상태: Current Contract

## 1. 핵심 개념

현재 agent-facing 도메인 모델은 다음 흐름을 기준으로 읽는다.

```text
Model -> Meaning -> Field -> Concept Property
             \-> Meaning Slot Binding -> Field | Edge | Derived
```

- `Schema`: 사용자가 정의하는 도메인 타입이다. 내부 저장소와 일부 레거시 API 이름은 아직 과거 명칭을 유지하지만, agent-facing 언어에서는 항상 `schema`라고 부른다.
- `Model`: schema에 붙일 수 있는 조합 가능한 의미 모델이다. 기본 모델과 사용자 정의 모델이 모두 가능하다.
- `Meaning`: model이 제공하거나 schema가 직접 가지는 의미 단위다. 하나의 meaning은 하나 이상의 field로 표현될 수 있다.
- `Field`: concept property 값을 저장하는 실제 필드 계약이다.
- `meaning_bindings`: field가 어떤 의미 경로로 해석될 수 있는지 나타내는 meaning 배열이다.
- `Meaning Slot Binding`: built-in meaning이 요구하는 내부 slot을 실제 field, edge, derived 값 중 어디에 연결할지 나타내는 내부 연결이다.
- `Concept Property`: concept가 field에 저장한 실제 값이다.
- `RelationType` / `Edge`: 독립적인 그래프 관계 의미를 표현한다. field로 대체할 수 없는 관계는 edge로 유지한다.

`meaning_slot`, `meaning_key`, `field_meaning_bindings`, `field_meaning_bindings`는 더 이상 agent-facing 계약이 아니다. 마이그레이션과 과거 데이터 읽기 호환 경로에만 남긴다.

## 2. Field Meaning Binding

field의 공개 의미 계약은 하나다.

```ts
meaning_bindings: string[]
```

예:

```json
{
  "name": "마감 시점",
  "field_type": "date",
  "meaning_bindings": ["time.due", "temporal.deadline", "obligation.due"]
}
```

하나의 field가 여러 의미 경로를 가질 수 있다. 이 배열은 UI 라벨이 아니라 query, layout, Narre, MCP가 공통으로 읽는 의미 색인이다.

## 3. Model Recipe

model recipe는 `roles`가 아니라 `meanings`를 가진다.

```json
{
  "meanings": [
    {
      "key": "recurrence",
      "name": "반복",
      "representation": "field_group",
      "fields": [
        { "key": "frequency", "name": "반복 빈도", "field_types": ["select"], "required": true },
        { "key": "interval", "name": "반복 간격", "field_types": ["number"], "required": true }
      ]
    }
  ],
  "rules": []
}
```

사용자 정의 model은 `key`를 lowercase snake_case로 저장한다. 사용자에게 보이는 이름은 `name`과 `description`이다.

## 4. MCP Surface

MCP는 agent가 쓰는 도구 언어이므로 previous meaning 용어를 노출하지 않는다.

- Model CRUD: `list_models`, `get_model`, `create_model`, `update_model`, `delete_model`
- Schema CRUD: `list_schemas`, `create_schema`, `update_schema`, `delete_schema`
- Schema field: `list_schema_fields`, `create_schema_field`, `update_schema_field`, `delete_schema_field`, `reorder_schema_fields`
- Schema meaning: `list_schema_meanings`, `ensure_schema_meaning`, `update_schema_meaning`, `delete_schema_meaning`, `update_schema_meaning_slot`
- Field create/update: `meaning_bindings`를 사용한다.
- Concept search filter: `meaning_binding`으로 field를 찾을 수 있다.
- Network node sort: `meaning_binding` 또는 concrete `property` 기준을 사용한다.
- Edge meaning: `meaning_key`이나 `relation_meaning` 입력을 받지 않고, relation type으로 표현한다.

## 5. Narre Prompt Surface

Narre는 prompt digest에서 다음 정보를 우선 제공받는다.

- project models
- schemas with attached models
- schema meanings and bound fields
- fields with `meaning_bindings`
- field relation map
- relation types
- network context

Narre는 "schema slot"이나 "meaning key"을 먼저 떠올리지 않는다. 먼저 domain ontology를 추론하고, 그 다음 schema / model / meaning / field / relation type으로 투영한다.

## 6. Responsibility Boundary

- `@netior/shared`: public type, meaning/model vocabulary, MCP tool specs
- `@netior/core`: DB migration, repository, previous read compatibility
- `@netior/service`: HTTP API boundary and agent sync adapter
- `@netior/mcp`: agent-facing tool surface
- `@netior/narre-server`: prompt digest, planning policy, provider runtime
- `desktop-app`: UI authoring flow and renderer state

새 소비처는 `meaning_bindings`와 model/meaning API를 사용해야 한다. previous column/table 이름은 새 소비처의 입력 스키마나 prompt에 다시 노출하지 않는다.
