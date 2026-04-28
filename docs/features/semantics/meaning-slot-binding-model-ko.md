# Meaning / Slot / Binding 모델 리팩터링

> MCP/Narre 등 agent-facing 소비처의 최신 계약은 `model-meaning-field-agent-contract-ko.md`를 함께 본다.

작성일: 2026-04-27
상태: Implementation Draft

## 1. 핵심 방향

이번 리팩터링은 `model`, `meaning`, `slot`, `field`를 같은 말처럼 겹쳐 쓰던 구조를 분리한다.

새 모델의 중심은 다음 흐름이다.

```text
Model -> Meaning -> Slot -> Binding -> Field
```

- `Model`: authoring preset. 사용자가 한 번에 켜는 의미 묶음이다.
- `Meaning`: 도메인 의미 단위. 예: 마감, 반복, 담당, 승인, 위치.
- `Slot`: 한 Meaning을 성립시키는 역할 자리. 예: 마감의 `마감 시점`, 반복의 `반복 빈도`.
- `Binding`: Slot이 실제로 어디에서 실현되는지 가리키는 연결이다.
- `Field`: 사용자가 값을 입력하고 Concept Property가 저장되는 물리적 필드다.

중요한 점은 Slot과 Field가 더 이상 같은 개념이 아니라는 것이다. Slot은 의미적 역할이고, Field는 그 역할을 담는 실제 저장/입력 표면이다.

## 2. 왜 Slot과 Field를 구분하는가

하나의 Meaning이 꼭 하나의 Field로 표현되지 않는다.

예를 들어 `반복` Meaning은 최소한 다음 Slot들을 가질 수 있다.

- 반복 빈도
- 반복 간격
- 반복 요일
- 반복 월일
- 반복 종료
- 반복 횟수

이 Meaning은 하나의 필드가 아니라 여러 필드의 조합으로 성립한다.

반대로 하나의 Field가 여러 의미 경로에서 재사용될 수도 있다. 예를 들어 `완료 시점` Field는 `진행` Meaning의 완료 시점이면서, 어떤 스키마에서는 `업무 상태` Meaning의 상태 변경 시점으로도 해석될 수 있다. 이때 Field를 복제하지 않고 여러 Binding이 같은 Field를 바라보게 만들 수 있다.

따라서 쿼리와 layout plugin은 Field 이름을 직접 추측하지 않는다. 다음 순서로 해석한다.

```text
Meaning -> Slot -> Binding -> Field -> Concept Property
```

## 3. Model의 역할

Model은 최종 도메인 모델이 아니라 빠른 생성 UX다.

예:

```text
Recurring Model
  creates Meaning: 반복
  required Slots: 반복 빈도, 반복 간격
  optional Slots: 반복 요일, 반복 월일, 반복 종료, 반복 횟수
```

Model을 끄더라도 이미 만들어진 Meaning, Slot Binding, Field 값은 즉시 삭제하지 않는다. Model은 preset이고, 데이터 소유자는 Schema와 Concept Property이기 때문이다.

## 4. Binding Target

현재 1차 구현의 기본 target은 `field`다.

```text
Slot Binding
  target_kind: field | edge | derived
  field_id: nullable
```

이 구조는 이후 확장을 열어둔다.

- `field`: Concept Property로 저장되는 일반 필드
- `edge`: 관계 자체가 의미를 실현하는 경우
- `derived`: 다른 값에서 계산되는 경우

예를 들어 `계층` Meaning의 부모 Slot은 처음에는 Field로 구현할 수 있지만, 나중에는 Edge를 target으로 삼을 수 있다.

## 5. UI/UX 흐름

Schema Editor의 속성 스키마 화면은 다음 흐름으로 재설계한다.

1. 왼쪽에서 의미 영역을 고른다.
2. Model preset을 켜거나 Meaning을 직접 추가한다.
3. Meaning 카드에서 필요한 역할 Slot들을 확인한다.
4. 아직 연결되지 않은 Slot은 `필드 만들기`로 Field를 생성한다.
5. 생성된 Field는 아래의 단일 Field 목록에서 이름, 타입, 필수 여부를 다듬는다.

화면에는 `time.recurrence_until` 같은 내부 key를 노출하지 않는다. 사용자는 `반복 종료`, `마감 시점`, `담당자`처럼 도메인 언어만 본다.

Field 타입 선택기는 Slot Binding이 있는 경우 해당 Slot이 허용하는 타입만 보여준다. 예를 들어 `마감 시점`은 `date | datetime` 계열만 고를 수 있다.

## 6. Projection과 소비처

layout plugin, Narre, MCP는 raw field 목록을 직접 조합하지 않는다. 대신 semantic projection은 다음 형태로 읽는다.

```text
SchemaSemanticProjection
  schemaId
  models
  meanings[]
    meaningKey
    slots[]
      slotKey
      targetKind
      fieldId
      fieldType
      value
```

Calendar는 `시간 범위` Meaning의 `시작 시점`, `종료 시점`, `종일 여부` Slot만 읽으면 된다. Board는 `업무 상태`, `담당`, `우선순위` Meaning을 읽으면 된다.

## 7. 리팩터링 단계

1. Shared type과 semantic registry에 Meaning과 Slot Binding을 추가한다.
2. Core migration으로 `schema_meanings`, `schema_meaning_slot_bindings`를 추가한다.
3. Repository, service, IPC, preload, renderer service/store를 연결한다.
4. Schema Editor를 Meaning 중심 authoring flow로 교체한다.
5. 기존 혼재된 UI 문구와 컴포넌트를 model/meaning/slot 언어로 정리한다.
6. Concept Editor와 layout plugin이 semantic projection을 읽도록 확장한다.

## 8. 완료 기준

- Schema가 Model뿐 아니라 Meaning 목록을 직접 가진다.
- Meaning은 여러 Slot Binding을 가진다.
- Slot Binding은 Field, Edge, Derived 중 하나를 target으로 삼을 수 있다.
- Schema Editor에서 내부 key가 아니라 도메인 언어로 Meaning과 Slot을 고른다.
- Type picker는 선택된 Slot의 contract에 맞는 타입만 보여준다.
- 소비처는 Field 이름이 아니라 Meaning/Slot 경로로 값을 찾는다.
