# Meaning Model 구현 계획 v1

작성일: 2026-04-14  
상태: Draft  
인코딩: UTF-8

## 1. 목적

이 문서는 Netior에 `meaning model`를 실제로 도입하기 위한 1차 개발 계획을 정의한다.

이번 계획의 범위는 다음 네 축이다.

- `shared` 레이어에 model / meaning slot 타입과 기준 선언 추가
- `Schema Editor`에서 model 부착과 slot 바인딩을 편집 가능하게 만들기
- `Concept Editor`에서 slot-aware property 입력과 검증 흐름 추가
- `calendar` layout family가 previous field mapping 없이 `temporal model`와 `meaning slot`만 읽도록 전환

이 문서는 설계 문서 [models-v1-ko.md](models-v1-ko.md)의 구현용 후속 문서다.

## 2. 이번 단계의 결론

- `model`는 schema 수준 의미 체계로 도입한다.
- 앱은 schema 이름이나 사용자 정의 필드 라벨이 아니라 `meaning slot`을 읽는다.
- schema 필드는 필요 시 특정 `meaning slot`에 바인딩된다.
- model 부착 시 필요한 필드는 자동 생성될 수 있다.
- `node_type`는 model 체계에 포함하지 않는다.
- `node_type`는 계속 네트워크 안에서의 node role을 뜻한다.
- `calendar`는 `temporal` model와 `meaning slot`만 읽고, `field mapping`은 제거한다.

## 3. 범위와 비범위

### 3.1 이번 단계에 포함

- shared DTO와 의미 레지스트리 추가
- schema / schema field 저장 구조 확장
- schema editor의 model 관리 UI
- concept editor의 slot-aware property 입력
- calendar plugin의 temporal slot 해석
- `node_type`와 `model`의 책임 경계 문서화 및 UI 반영

### 3.2 이번 단계에 포함하지 않음

- 최종 DSL 문법 구현
- timeline / gantt 전체 전환
- model 기반 자동 쿼리 빌더
- drag 결과를 concept property로 writeback 하는 전체 인터랙션
- DB 필드명 전체 리네이밍

## 4. 핵심 책임 분리

### 4.1 Model

`model`는 객체가 무엇인지를 설명한다.

예:

- `temporal`
- `statusful`
- `hierarchical`

이 정보는 schema에 붙는다.

### 4.2 Meaning Slot

`meaning slot`은 앱이 실제로 읽는 meaning key다.

예:

- `start_at`
- `end_at`
- `all_day`
- `status`

이 정보는 schema 필드와 연결된다.

### 4.3 Node Type

`node_type`는 객체 의미가 아니라, 특정 네트워크 안에서 해당 노드가 어떤 역할을 수행하는지 나타낸다.

예:

- `basic`
- `portal`
- `group`
- `hierarchy`

즉:

- `model` = 객체 의미
- `meaning slot` = 앱이 읽는 의미 키
- `node_type` = 네트워크 안에서의 node role

캘린더, 타임라인, 간트 같은 뷰 전용 타입은 `node_type`로 추가하지 않는다.

## 5. 목표 데이터 모델

### 5.1 Shared 타입 레벨

`@netior/shared`에는 최소한 다음 개념이 추가되어야 한다.

- `SemanticCategoryKey`
  - `time`
  - `workflow`
  - `structure`
  - `knowledge`
  - `space`
  - `quant`
  - `governance`
- `ModelKey`
  - `temporal`
  - `dueable`
  - `recurring`
  - `statusful`
  - `assignable`
  - `prioritizable`
  - `progressable`
  - `estimable`
  - `hierarchical`
  - `ordered`
  - `taggable`
  - `categorizable`
  - `sourceable`
  - `attachable`
  - `versioned`
  - `locatable`
  - `measurable`
  - `budgeted`
  - `ownable`
  - `approvable`
- `MeaningSlotKey`
  - 예: `start_at`, `end_at`, `all_day`, `status`, `owner_ref`
- `SlotConstraintLevel`
  - `strict`
  - `constrained`
  - `loose`

그리고 shared에는 아래 두 종류의 정의가 필요하다.

- model 정의 레지스트리
  - model가 어떤 category에 속하는지
  - 어떤 slot을 core/optional로 갖는지
- slot constraint 정의 레지스트리
  - 허용 타입
  - 다중값 여부
  - coercion 허용 여부
  - 기본 validation 수준

### 5.2 Schema DTO

API 레벨에서는 schema이 아래 필드를 가져야 한다.

- `models: ModelKey[]`

DB 내부 저장 형식은 초기에 `JSON TEXT`여도 괜찮지만, renderer와 service에서는 배열로 다룬다.

### 5.3 Schema Field DTO

schema 필드는 아래 필드를 가져야 한다.

- `meaning_slot: MeaningSlotKey | null`
- `slot_binding_locked: boolean`
- `generated_by_model: boolean`

의도는 이렇다.

- `meaning_slot`
  앱이 이 필드를 어떤 meaning 의미로 읽는지
- `slot_binding_locked`
  타입이나 의미를 임의로 바꾸지 못하게 보호하는지
- `generated_by_model`
  model 부착 과정에서 시스템이 자동 생성한 필드인지

## 6. 레이어별 구현 범위

Netior의 타입 추가는 기본적으로 아래 순서를 따른다.

`migration -> shared types -> core repository -> IPC -> preload -> renderer`

이번 작업도 그 순서를 따른다.

### 6.1 Shared

대상:

- `packages/shared/src/types/index.ts`
- 필요 시 `packages/shared/src/constants/` 아래 의미 레지스트리 파일 추가

작업:

- model/category/slot 관련 타입 추가
- `Schema`, `SchemaCreate`, `SchemaUpdate`에 `models` 추가
- `SchemaField`, `SchemaFieldCreate`, `SchemaFieldUpdate`에 slot 바인딩 관련 필드 추가
- slot constraint registry export

완료 기준:

- renderer와 core가 공통 타입으로 `models`, `meaning_slot`를 읽을 수 있다.

### 6.2 netior-core

대상:

- 신규 migration 파일
- `packages/netior-core/src/repositories/schema.ts`

작업:

- `schemas` 테이블에 model 저장 컬럼 추가
- `schema_fields` 테이블에 slot 관련 컬럼 추가
- create/update/list/get 시 JSON 파싱/직렬화 처리
- model 부착 시 자동 필드 생성 유틸 준비
- slot 충돌 시 repository 레벨에서 방어

완료 기준:

- schema 생성/수정/조회 시 model와 slot 정보가 round-trip 된다.

### 6.3 Service / IPC / Preload

대상:

- schema 관련 IPC 채널과 preload bridge
- renderer service 계층

작업:

- DTO 확장 반영
- model/slot 필드가 누락 없이 renderer까지 전달되게 연결

완료 기준:

- renderer store가 추가 API 없이 기존 schema 로딩 흐름 안에서 새 필드를 받는다.

### 6.4 Renderer Store

대상:

- `packages/desktop-app/src/renderer/stores/schema-store.ts`

작업:

- 새 DTO 필드 반영
- model attach/detach와 auto field generation 호출 흐름 정리

완료 기준:

- schema store가 model/slot 데이터까지 state로 유지한다.

## 7. Schema Editor 계획

대상:

- [SchemaEditor.tsx](../../../packages/desktop-app/src/renderer/components/editor/SchemaEditor.tsx)
- [SchemaFieldRow.tsx](../../../packages/desktop-app/src/renderer/components/editor/SchemaFieldRow.tsx)

### 7.1 새 섹션

`Property Schema` 위 또는 바로 아래에 `Models` 섹션을 추가한다.

기능:

- category별 model 목록 표시
- model attach / detach
- 각 model가 추가하는 core slot 미리보기
- 이미 바인딩된 slot 상태 표시

### 7.2 model 부착 동작

model를 붙이면:

- 필요한 core slot을 검사한다
- 해당 slot에 바인딩된 field가 없으면 자동 생성한다
- 생성된 field에는 `meaning_slot`, `generated_by_model`, `slot_binding_locked`를 설정한다

예:

- `temporal` 부착 시
  - `start_at`
  - 필요 시 `end_at`
  - 필요 시 `all_day`

### 7.3 field row UX

각 필드 행에는 아래 정보가 보여야 한다.

- meaning slot 배지
- model 생성 필드 여부
- 잠금 상태

행동 규칙:

- 라벨은 바꿀 수 있다
- `meaning_slot`가 붙은 필드는 전체 field type 목록을 보여주지 않고, slot constraint가 허용하는 타입 후보만 선택지로 제공한다
- `meaning_slot`가 붙은 필드는 임의 삭제 시 경고를 보여준다

### 7.4 detach 정책

v1에서는 단순하게 간다.

- model detach는 허용한다
- 다만 연결된 meaning slot field가 남아 있으면 경고한다
- 자동 생성 필드는 유지하되 `generated_by_model`는 남겨둘 수 있다

즉, 처음 단계에서는 aggressive cleanup보다 데이터 보존을 우선한다.

## 8. Concept Editor 계획

대상:

- [ConceptEditor.tsx](../../../packages/desktop-app/src/renderer/components/editor/ConceptEditor.tsx)
- [ConceptPropertiesPanel.tsx](../../../packages/desktop-app/src/renderer/components/editor/ConceptPropertiesPanel.tsx)

### 8.1 기본 방향

기존처럼 field 목록을 그대로 렌더링하되, 내부 해석은 slot-aware로 바꾼다.

즉:

- 화면에는 사용자가 정한 필드 라벨을 보여준다
- 내부에서는 해당 필드가 어떤 `meaning_slot`인지 알고 있다

### 8.2 validation 방식

v1에서는 hard block보다 soft validation을 우선한다.

- slot constraint와 맞지 않는 입력은 즉시 경고
- 가능한 경우 coercion
- 저장 자체는 지나치게 막지 않는다

예:

- `all_day`는 boolean 토글만 허용
- `start_at`은 `date | datetime` 계열만 허용
- `progress_ratio`는 0..1 범위 경고

### 8.3 model-aware 표시

필요 시 속성 패널에서 model별 grouping을 지원할 수 있다.

예:

- Time
- Workflow
- Knowledge

다만 v1에서는 grouping보다 입력 안정화가 우선이다.

### 8.4 node_type 반영

`Concept Editor`의 network occurrence 섹션에서는 `node_type`를 계속 편집하되, UI 라벨은 점진적으로 `Node Role` 또는 그에 해당하는 표현으로 바꾼다.

이 섹션은 concept 의미 편집이 아니라, 네트워크 안에서의 등장 방식 편집임을 분명히 한다.

## 9. Calendar Plugin 적용 계획

대상:

- [calendar/index.ts](../../../packages/desktop-app/src/renderer/components/workspace/layout-plugins/calendar/index.ts)
- calendar 관련 utils / background / controls
- [NetworkEditor.tsx](../../../packages/desktop-app/src/renderer/components/editor/NetworkEditor.tsx)

### 9.1 해석 우선순위

calendar는 시간 필드를 layout config가 아니라 schema field의 `meaning_slot`에서만 찾는다.

### 9.2 최소 해석 슬롯

calendar v1이 읽는 slot은 다음이다.

- `start_at`
- `end_at`
- `all_day`

가능하면 이후:

- `timezone`
- `recurrence_rule`

까지 확장한다.

### 9.3 포함 대상

calendar는 해당 schema이 `temporal` model를 가지고 있고, 필요한 `meaning_slot`가 연결된 concept만 시간 객체 후보로 본다.

### 9.4 writeback

이번 단계에서 calendar의 핵심은 읽기 구조 전환이다.

- 우선은 slot 읽기와 배치 계산 연결
- drag 결과를 `start_at` / `end_at`에 다시 쓰는 것은 후속 단계

## 10. Node Type 계획

`node_type`는 이번 작업에서 model 체계와 분리해 유지한다.

원칙:

- `basic`, `portal`, `group`, `hierarchy`만 공식 role로 유지
- 새 model를 이유로 `node_type`를 늘리지 않는다
- `calendar_event`, `timeline_item`, `gantt_bar` 같은 뷰 전용 타입은 금지

필요한 UI 조정:

- `node_type`를 설명할 때 “type”보다 “role” 의미를 강조
- 문서와 에디터에서 model와 별도임을 반복 노출

## 11. 구현 순서

### Phase 1. Shared / Core 기반 추가

- shared 타입 추가
- migration 추가
- core repository round-trip 연결
- IPC / preload / service 확장

산출물:

- model / slot이 API로 오간다

### Phase 2. Schema Editor 적용

- model 섹션 추가
- model attach/detach
- auto field generation
- field row의 slot 표시와 보호

산출물:

- schema에서 model를 선언하고 slot field를 만들 수 있다

### Phase 3. Concept Editor 적용

- slot-aware field input
- soft validation
- node role 라벨 조정

산출물:

- 개념 편집 시 semantic slot 의미를 반영한 입력이 가능하다

### Phase 4. Calendar 적용

- temporal model 우선 해석
- previous field mapping 제거
- all-day / timed 구분 시 slot 사용

산출물:

- calendar가 field mapping 없이 의미 슬롯 중심으로 동작한다

### Phase 5. 후속 정리

- timeline 적용
- gantt 적용
- DSL 표면 문법 연결

## 12. 리스크와 주의점

- model detach 시 자동 생성 필드를 어떻게 정리할지 아직 보수적으로 가야 한다.
- `slot type`은 단일 타입 강제보다 허용 타입 계약이 더 적절하다.
- concept editor에서 지나친 hard validation은 기존 데이터와 충돌할 수 있다.
- 기존 field mapping 데이터가 남아 있어도 runtime이 더 이상 그것을 읽지 않게 정리해야 한다.
- `node_type`와 model를 섞으면 구조가 다시 무너지므로, 둘을 분리한 책임 경계를 계속 유지해야 한다.

## 13. 완료 기준

아래 조건이 만족되면 1차 도입이 완료된 것으로 본다.

- schema이 `models`를 저장하고 조회할 수 있다
- schema field가 `meaning_slot`를 가질 수 있다
- schema editor에서 model 부착 시 slot field가 자동 생성된다
- concept editor가 slot-aware 입력을 제공한다
- calendar가 `temporal` slot을 우선 읽는다
- `node_type`는 계속 network role로 남고, 뷰 전용 타입이 추가되지 않는다
