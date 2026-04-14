# Layout Plugin 방향 문서

작성일: 2026-04-14  
상태: Draft  
인코딩: UTF-8

## 1. 목적

이 문서는 Netior의 `layout-plugin`을 어떤 범위로 정의할지, 무엇을 코어가 책임지고 무엇을 설정과 확장 포인트로 열 것인지 정리한다.

이번 문서의 핵심 목적은 두 가지다.

- `layout type` 자체를 플러그인으로 개방하지 않는 이유를 명확히 한다.
- `calendar`와 `timeline`을 중심으로, 이후에도 흔들리지 않을 최소 구조를 정한다.

## 2. 결론 요약

- `layout type` 등록은 코어 책임으로 둔다.
- 플러그인은 새로운 레이아웃 패밀리를 추가하는 수단이 아니다.
- 대부분의 차이는 `layout config`, `preset`, `policy override`로 해결한다.
- 각 레이아웃 패밀리는 공통 알고리즘 강박 없이 개별적으로 구현해도 된다.
- 다만 워크스페이스 본체가 레이아웃별 예외 코드로 오염되지 않도록, 공통 계약은 좁고 단단하게 유지한다.
- 현재 설계 대상은 `freeform`을 기준선으로 두고 `timeline`, `calendar`를 우선 정리한다.
- `gantt`는 장기적으로 `timeline`의 프리셋이 아니라 별도 패밀리로 다루는 방향을 유지한다.

## 3. 왜 `layout type` 자체를 플러그인으로 열지 않는가

`layout type`은 단순한 옵션이 아니라 사실상 하나의 작업 공간 모드에 가깝다. 새로운 타입을 추가하려면 보통 아래 책임이 함께 따라온다.

- 데이터 요구사항 정의
- 노드 배치 엔진
- 배경과 오버레이 렌더링
- pan, zoom, scroll 같은 뷰포트 정책
- 드래그와 편집 인터랙션
- 저장 구조와의 연결

이 레벨을 외부 플러그인에 열어버리면 두 문제가 생긴다.

- 코어가 보장해야 할 호환성 표면이 지나치게 커진다.
- 아직 충분히 축적되지 않은 공통 추상화를 너무 이르게 고정하게 된다.

현재 단계에서 더 적합한 방향은 다음과 같다.

- 코어가 범용적인 레이아웃 패밀리를 직접 만든다.
- 사용자는 그 위에서 설정, 프리셋, 정책 선택으로 동작을 조정한다.
- 코드 확장이 꼭 필요한 경우에만 제한된 범위의 플러그인을 허용한다.

## 4. 새 개념 정리

### 4.1 Layout Family

코어가 제공하는 최상위 레이아웃 종류다. 현재 기준선과 설계 대상은 아래와 같다.

- `freeform`: 관계 탐색과 자유 배치 중심의 캔버스
- `timeline`: 연속 시간축 기반 배치
- `calendar`: 일간, 주간, 월간 캘린더 그리드 기반 배치
- `gantt`: 작업, lane, dependency, progress를 포함하는 별도 시간 작업 뷰. 현재 즉시 구현 대상은 아니지만 `timeline`과 분리된 family로 유지한다.

### 4.2 Layout Mode

같은 family 안의 내부 보기 모드다.

- `calendar`: `day`, `week`, `month`
- `timeline`: 이후 필요 시 `event`, `span`, `grouped` 같은 모드 가능

`mode`는 새로운 family가 아니다. 같은 엔진 안의 뷰 전환이다.

### 4.3 Layout Preset

특정 사용 시나리오에 맞춘 기본 조합이다. 프리셋은 코드보다 설정에 가깝다.

- 기본 시간 필드
- 기본 색상 규칙
- 기본 그룹 기준
- 기본 range
- 기본 density

예를 들어 `calendar` 안에서도 일정 관리용, 이벤트 관리용 프리셋은 다를 수 있다.

### 4.4 Layout Config

현재 선택된 레이아웃의 저장 가능한 설정 데이터다. 사용자의 선택과 프로젝트별 정책은 최대한 이 레이어에서 표현한다.

- 필드 매핑
- 기본 보기 모드
- 색상 기준
- 라벨 기준
- 그룹 기준
- range preset
- density
- 표시 옵션

### 4.5 Layout Policy Override

코어가 제공하는 family 안에서, 동작 세부 정책을 바꾸는 선택지다. 엔진 전체를 바꾸는 것이 아니라 이미 준비된 정책 슬롯 중 하나를 고르는 개념이다.

- 겹침 처리 방식
- 그룹 정렬 방식
- 카드 쌓기 방식
- 월간 셀 overflow 처리
- 주간 시작 요일
- timeline lane 배치 방식

### 4.6 Plugin

이 문서에서 플러그인은 `새 layout type 등록`이 아니다. 플러그인은 설정만으로 표현할 수 없는 코드 확장을 의미한다.

가능한 예시는 아래와 같다.

- 특수 카드 렌더러
- 보조 overlay 위젯
- 특정 집계 계산기
- family 내부에서 선택 가능한 새 정책 모듈

플러그인은 코어 family 위에 얹히는 얇은 확장층이어야 한다.

## 5. 핵심 정책

### 5.1 코어가 책임지는 것

- layout family 목록
- family별 배치 엔진
- family별 viewport 해석 모델
- 저장 모델과 lifecycle
- 공통 capability 계약

### 5.2 config가 책임지는 것

- 어떤 필드를 시작일, 종료일, 색상, 라벨로 쓸지
- 어떤 mode를 기본으로 열지
- 어떤 preset을 사용할지
- 어떤 density와 range를 쓸지
- 어떤 groupBy와 sort를 쓸지

### 5.3 plugin이 책임지는 것

- config만으로 표현할 수 없는 코드 수준 확장
- 코어가 미리 열어둔 slot에 들어가는 renderer 또는 policy 모듈

### 5.4 plugin이 책임지지 않는 것

- 새로운 layout family 등록
- DB/IPC 계약 변경
- workspace lifecycle 변경
- 노드/엣지 핵심 자료구조 변경

## 6. Override Surface는 어떻게 나눌 것인가

override surface를 레이아웃 타입이 100퍼센트 혼자 정의하게 두면 공통화가 무너지고, 반대로 모든 것을 공통 표준으로 만들면 억지 추상화가 된다.

따라서 override는 3층으로 나눈다.

### 6.1 공통 계층

대부분의 뷰가 공유할 수 있는 설정이다.

- 대상 데이터 집합
- filter
- sort
- label field
- color field
- card density
- secondary metadata 표시 여부

### 6.2 Family 공통 계층

같은 계열 뷰끼리 공유하는 설정이다. 현재는 시간 계열 family를 먼저 상정한다.

- `startField`
- `endField`
- `groupBy`
- `rangePreset`
- `colorBy`
- `labelBy`

### 6.3 Type 전용 계층

개별 family 또는 mode에만 의미가 있는 설정이다.

- `calendar`
- `view`
- `weekStartsOn`
- `daySlotGranularity`
- `monthOverflowPolicy`

- `timeline`
- `scale`
- `laneStrategy`
- `overlapStrategy`
- `axisAnchor`

중요한 점은, 엔진은 family별로 투박하게 구현하되 override surface는 계층적으로 공통화한다는 것이다.

## 7. `calendar`와 `timeline` 설계 원칙

### 7.1 공통점

두 family 모두 시간 기반 메타데이터를 사용한다.

- 시작일과 종료일 매핑이 필요하다.
- instant item과 span item을 함께 다뤄야 한다.
- range와 grouping의 개념이 있다.

따라서 필드 매핑과 일부 표시 정책은 공유할 수 있다.

### 7.2 차이점

두 family는 시간만 공유할 뿐, 화면과 인터랙션의 본질은 다르다.

- `calendar`는 캘린더 셀과 뷰 모드가 핵심이다.
- `timeline`은 연속적인 시간축과 배치 밀도 제어가 핵심이다.

따라서 다음은 공통 추상화로 억지로 묶지 않는다.

- 좌표 계산 방식
- 그리드 구성 방식
- 스크롤과 pan 해석 방식
- 겹침 배치 알고리즘

### 7.3 Viewport 정책

viewport는 더 이상 워크스페이스 공통 로직의 하드코딩 예외로 다루지 않는다. family 또는 mode가 자신의 뷰포트 정책을 정의할 수 있어야 한다.

예시:

- `calendar month`: 고정 프레임, pan/zoom 없음
- `calendar week`: 고정 프레임 중심, 제한적 스크롤 가능
- `calendar day`: 세로 축 중심 스크롤 허용
- `timeline`: 연속 축 탐색에 맞는 pan/zoom 허용

핵심은 `if calendar`, `if timeline` 분기가 아니라 capability 기반 정책 선택이다.

## 8. 권장 아키텍처

권장 구조는 아래 네 층이다.

### 8.1 Family Engine

코어가 소유하는 family별 계산기와 렌더링 진입점이다.

- `freeform engine`
- `timeline engine`
- `calendar engine`

### 8.2 Common View Model

모든 family가 공통으로 받는 최소 입력이다.

- concept set
- field mappings
- filter
- sort
- group
- color and label selection

### 8.3 Policy Layer

엔진을 교체하지 않고도 family 안에서 동작을 바꿀 수 있는 레이어다.

- stacking
- overlap
- grouping
- overflow
- viewport mode

### 8.4 Render Extension Slots

코어가 정한 레이아웃 family 위에서 제한적으로 코드 확장을 붙일 수 있는 슬롯이다.

- background
- overlay
- card renderer
- control items

## 9. 개발 원칙

- `layout type` 추가는 코어만 할 수 있다.
- `NetworkWorkspace`는 layout 이름별 특수 분기로 오염시키지 않는다.
- 공통화는 override surface에서만 하고, 엔진까지 억지로 같게 만들지 않는다.
- config가 코드가 되지 않게 한다.
- plugin이 작은 app framework가 되지 않게 한다.
- 먼저 `calendar`와 `timeline`의 차이를 선명하게 만들고, 그 다음 공통분모를 추출한다.

## 10. 금지사항

- 외부 플러그인이 새 family를 직접 등록하게 하지 않는다.
- family별 핵심 인터랙션을 공통 boolean 몇 개로만 축약하지 않는다.
- `calendar`를 `timeline`의 단순 skin으로 취급하지 않는다.
- 반대로 `timeline`과 `calendar`의 모든 설정을 각자 제로베이스로 분리하지도 않는다.

## 11. 현재 권장 범위

현재 단계에서 실제 설계와 구현 범위는 아래로 제한한다.

- `freeform`은 기존 기본 캔버스로 유지
- `timeline` family 정리
- `calendar` family 정리
- 시간 계열 공통 필드 매핑 정리
- viewport capability 계약 정리

이번 범위에서 바로 다루지 않는 항목은 아래와 같다.

- `gantt`의 구체 엔진 설계
- `table`, `board`, `dashboard`의 상세 설계
- 외부 배포 가능한 플러그인 플랫폼

## 12. 예시 구성

아래 예시는 이 문서가 의도하는 계층을 보여준다.

```json
{
  "family": "calendar",
  "common": {
    "labelField": "title",
    "colorField": "statusColor",
    "density": "comfortable"
  },
  "temporal": {
    "startField": "startDate",
    "endField": "endDate",
    "groupBy": "owner",
    "rangePreset": "this-month"
  },
  "layout": {
    "view": "month",
    "weekStartsOn": "monday",
    "monthOverflowPolicy": "stack"
  }
}
```

이 구조에서 family 엔진은 코어가 제공하고, 사용자는 공통 설정과 시간 계열 설정, family 전용 설정을 조합해 동작을 바꾼다.

## 13. 다음 단계

- 시간 계열 공통 계약을 `common + temporal + layout` 3층으로 정리한다.
- `calendar`의 `day/week/month` 모드별 viewport 정책을 명시한다.
- `timeline`의 scale, lane, overlap 정책 슬롯을 정리한다.
- `gantt`를 `timeline`과 분리된 family로 유지할 기준을 별도 문서로 정리한다.
- 이후 코드 구현은 이 문서의 책임 분리를 기준으로 진행한다.

