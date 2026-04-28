# Group / Hierarchy Implementation Plan

Updated: 2026-04-10

이 문서는 현재 network workspace의 `group` / `hierarchy` 구현 방향을 최신 합의 기준으로 다시 정리한 계획 문서다.

중요:

- `hierarchy`는 `group`의 내부 mode가 아니다.
- `hierarchy`는 `group`과 별도의 `node_type`이다.
- 이전 초안에 있던 `groupLayoutMode = hierarchy` 방향은 폐기한다.

## 핵심 결정

### 1. Node Type

목표 node type:

- `basic`
- `portal`
- `group`
- `hierarchy`

정리:

- `group` = 자유 배치형 컨테이너
- `hierarchy` = 계층형 컨테이너
- `portal` = 포털 UI 표현

previous `box`는 migration에서 `group`으로 치환한다.

### 2. 구조 / 배치 분리

구조는 edge가 저장한다.

- `edges.relation_meaning`
- `core:contains`
- `core:entry_portal`

배치와 시각 상태는 layout이 저장한다.

- `layout_nodes.position_json`
- `layout_edges.visual_json`
- `layouts.layout_config_json`

`relation_type`는 user semantic이고, system behavior는 `relation_meaning`가 담당한다.

### 3. Group

`group`의 목표 인터랙션:

- border only
- background 없음
- nested group 가능
- edit mode resize
- expanded / collapsed 상태
- child freeform 배치
- child position은 parent-relative 저장
- cycle 금지

`group`은 계층 정렬을 책임지지 않는다.

### 4. Hierarchy

`hierarchy`는 별도 node type이다.

목표:

- 계층형 child 정렬
- magnetic anchor
- 자동 정렬 + 수동 미세조정 공존
- orthogonal edge route와 결합

즉 `groupLayoutMode = hierarchy` 같은 모델로 가지 않는다.

### 5. Entry Portal

- concept와 network의 연결은 `core:entry_portal` edge로 저장
- 렌더링은 concept 내부 chip/button으로 투영
- browse mode에서만 navigation

## 현재 구현 상태

완료:

- `edges.relation_meaning` 도입
- `box -> group` migration
- relation meaning edge hidden 처리
- route/waypoint 가능한 edge renderer foundation
- group border-only foundation
- group containment MVP
  - drag/drop containment
  - `core:contains` edge 생성/삭제
  - child relative position 저장
  - parent chain을 따라 world position 복원
  - nested group 지원
  - file/object insertion path 연동

아직 안 됨:

- draft concept 생성 시 group 내부 자동 attach
- `hierarchy` node type 추가
- hierarchy 전용 렌더/배치/orthogonal routing
- group resize
- group collapse / expand
- `core:entry_portal` chip 렌더

## 다음 순서

1. draft concept 생성도 group containment로 연결
2. `hierarchy`를 별도 node type으로 추가
3. hierarchy 전용 배치/anchor/orthogonal edge 도입
4. group resize
5. group collapse / expand
6. entry portal chip

## 단계별 완료 기준

### Phase A — Draft Concept Containment

- group 내부에서 새 concept를 만들면 저장 직후 child로 들어간다
- `core:contains` edge와 relative position이 같이 저장된다
- reopen 후에도 같은 위치에 복원된다

### Phase B — Hierarchy Node Type

- `hierarchy`를 저장/수정/로드할 수 있다
- editor selector와 renderer에서 `group`과 구분된다
- 기존 `group` 경로는 회귀 없이 유지된다

### Phase C — Hierarchy Interaction

- hierarchy child가 magnetic anchor에 맞춰 정렬된다
- auto layout + local offset이 같이 동작한다
- hierarchy 관련 edge가 orthogonal route로 보인다

### Phase D — Group Resize / Collapse

- edit mode resize handle
- width/height 저장/복원
- collapse 시 child 숨김
- expand 시 원위치 복원

### Phase E — Entry Portal Chip

- `core:entry_portal` edge가 concept 내부 chip으로 렌더된다
- browse mode에서만 navigation 된다
- edit mode에서 편집이 막히지 않는다

## 일반화는 나중에

지금은 hardcoded renderer path로 먼저 완성한다. 실제 사용성이 안정화된 뒤 아래를 일반화한다.

- node presentation resolver
- edge presentation resolver
- plugin contract
- contract registry
- geometry / slot / port model
