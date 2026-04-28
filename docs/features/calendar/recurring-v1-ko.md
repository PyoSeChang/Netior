# Calendar Recurring V1

## 목표

`recurring` model가 붙은 temporal concept를 calendar에서 반복 일정으로 해석할 수 있게 한다.

## 현재 제약

- 현재 workspace/node 모델은 `concept 1개 -> render node 1개` 구조다.
- 그래서 같은 concept를 month/week/day 범위 안에 여러 occurrence로 동시에 그릴 수 없다.
- 즉 recurring을 제대로 지원하려면 calendar 전용 `occurrence projection layer`가 추가로 필요하다.

## V1 방향

### 1. semantic input

- 입력 source는 `recurring` model의 slot이다.
- 사용 slot:
  - `recurrence_rule`
  - `recurrence_until`
  - `recurrence_count`
- temporal slot과 같이 읽는다:
  - `start_at`
  - `end_at`
  - `all_day`
  - `timezone`

### 2. projection layer

- calendar plugin 내부에서 원본 node를 직접 쓰지 않고, `occurrence` 단위로 projection 한다.
- occurrence id는 별도 virtual id를 가진다.
  - 예: `{sourceNodeId}::occurrence::{epochDay}::{index}`
- virtual occurrence는 화면 projection이고, 편집이 일어나면 별도 real concept로 실체화한다.
- 실체화된 occurrence가 있으면 같은 `source concept + occurrence key`의 virtual occurrence는 숨긴다.

### 3. supported rule scope

V1에서 먼저 지원할 규칙:

- `FREQ=DAILY`
- `FREQ=WEEKLY`
- `FREQ=MONTHLY`
- `INTERVAL`
- `COUNT`
- `UNTIL`
- `BYDAY`의 weekday 반복 (`MO,TU,WE,TH,FR`)

V1에서 제외:

- 예외일 (`EXDATE`)
- 복잡한 `BYSETPOS`
- timezone conversion UI
- drag 시 `this occurrence / this and following / all` 분기

### 4. interaction policy

V1에서는 recurring occurrence를 평소에는 virtual로 렌더링하고, 편집 순간 real entity로 승격한다.

- 기본 정책: `view = virtual occurrence`
- write 발생 시: `materialized occurrence concept + real network node` 생성
- 이후 같은 occurrence는 source series의 그림자가 아니라 독립 개체로 취급한다.
- materialized occurrence에 recurrence rule을 다시 부여하면 새 series source로 승격하고, 원래 series는 직전 occurrence까지만 유지한다.

이유:

- occurrence 단위 편집에는 todo, note, edge, status 같은 개별 상태가 붙을 수 있다.
- 따라서 편집 후에도 계속 virtual로 남겨두면 객체 identity를 보장할 수 없다.
- series 수정과 occurrence 수정은 분리된 생명주기를 가져야 한다.

## 구현 순서

1. calendar snapshot 전에 recurring projection layer 추가
2. visible range 안 occurrence 생성
3. occurrence -> source concept / occurrence key mapping 추가
4. `recurrence_source_concept_id`, `recurrence_occurrence_key`를 가진 materialized occurrence concept 저장 경로 추가
5. 더블클릭, context menu, drag, resize 시 virtual occurrence를 materialize 하도록 연결
6. materialized occurrence가 존재하면 projection에서 같은 occurrence를 숨김

## 결론

`recurring`은 단순 slot parsing만으로는 끝나지 않고, calendar 쪽에 `virtual occurrence` 계층과 `materialized occurrence` 저장 모델이 같이 있어야 제대로 지원된다. 따라서 현재 V1 원칙은 `virtual until edit, materialize on write`로 정리한다.
