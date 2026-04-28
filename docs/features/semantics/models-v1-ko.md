# Meaning Model / Model 기준안 v1

작성일: 2026-04-14  
상태: v1 기준안  
인코딩: UTF-8

## 1. 목적

이 문서는 Netior가 사용자 정의 도메인을 앱이 해석 가능한 의미 체계로 읽기 위해 사용하는 `meaning model`의 1차 기준안을 정의한다.

핵심 목표는 다음과 같다.

- 사용자가 자유롭게 schema 이름과 속성 라벨을 정해도 앱은 그 의미를 이해할 수 있어야 한다.
- 캘린더, 타임라인, 보드, 트리, 대시보드 같은 뷰는 도메인 이름이 아니라 안정적인 의미 슬롯을 읽어야 한다.
- 같은 schema에 여러 의미를 조합할 수 있어야 한다.

이 문서는 대분류와 model 목록을 먼저 고정하고, 이후 DSL과 DB 스키마, 자동 생성 규칙의 기준으로 사용한다.

## 2. 용어

- `meaning model`
  사용자 정의 도메인을 앱이 해석 가능하게 만드는 상위 개념이다.
- `model`
  schema에 부착되는 조합 가능한 의미 단위다.
- `meaning slot`
  앱이 실제로 읽는 안정적인 의미 키다. 사용자는 이 슬롯에 대응하는 속성의 라벨을 자유롭게 바꿀 수 있다.

현재 기준에서:

- schema은 `models`를 가진다.
- edge의 기존 `relation_meaning`는 개념적으로 같은 우산 아래에 있지만, 필드명 변경은 별도 마이그레이션으로 다룬다.
- `node_type`는 schema 의미가 아니라 네트워크 안에서 해당 노드가 수행하는 역할을 뜻하며, `model`와는 별개로 유지한다.

## 3. 설계 원칙

- model는 뷰 이름이 아니라 의미 단위여야 한다.
- 하나의 schema은 여러 model를 동시에 가질 수 있다.
- 앱은 사용자 라벨이 아니라 meaning slot을 읽는다.
- model는 필요한 속성을 자동 생성하고 타입을 강제할 수 있어야 한다.
- model는 UI 힌트가 아니라 런타임 의미 체계다.

좋은 model 예:

- `temporal`
- `statusful`
- `hierarchical`

나쁜 model 예:

- `calendar_item`
- `timeline_node`
- `board_card`

위 예시는 특정 뷰에 종속된 이름이기 때문이다.

## 4. 대분류

v1에서는 model 탐색과 선택 UX를 위해 다음 대분류를 사용한다.

| Key | 한글 이름 | 목적 |
| --- | --- | --- |
| `time` | 시간 | 일정, 기간, 반복, 마감 같은 시간성 해석 |
| `workflow` | 워크플로우 | 상태, 담당, 우선순위, 진행률 같은 실행 흐름 해석 |
| `structure` | 구조 | 계층, 순서, 태그, 분류 같은 조직 방식 해석 |
| `knowledge` | 지식 | 출처, 첨부, 버전 같은 문서/지식 객체 해석 |
| `space` | 공간 | 장소, 좌표, 위치 기반 해석 |
| `quant` | 수치 | 값, 목표, 예산 같은 수치/지표 해석 |
| `governance` | 거버넌스 | 승인, 소유, 통제 같은 운영 규칙 해석 |

## 5. Model 목록 v1

### 5.1 Time

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `temporal` | 시작/종료 시점과 종일 여부를 가진 시간 객체 | `start_at`, `end_at`, `all_day`, `timezone` |
| `dueable` | 마감 시점이 중요한 객체 | `due_at` |
| `recurring` | 반복 규칙을 가진 객체 | `recurrence_rule`, `recurrence_until`, `recurrence_count` |

### 5.2 Workflow

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `statusful` | 상태 기반 흐름을 가진 객체 | `status` |
| `assignable` | 담당자를 가진 객체 | `primary_assignee_ref`, `assignee_refs` |
| `prioritizable` | 우선순위를 가진 객체 | `priority` |
| `progressable` | 진행률 또는 완료 시점을 가진 객체 | `progress_ratio`, `completed_at` |
| `estimable` | 추정치와 실제값을 비교하는 객체 | `estimate_value`, `estimate_unit`, `actual_value` |

### 5.3 Structure

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `hierarchical` | 부모-자식 구조를 가진 객체 | `parent_ref`, `order_index` |
| `ordered` | 단순 순서를 가진 객체 | `order_index` |
| `taggable` | 다중 태그를 가진 객체 | `tag_keys` |
| `categorizable` | 단일 또는 제한된 분류 체계를 가진 객체 | `category_key` |

### 5.4 Knowledge

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `sourceable` | 출처와 인용을 가진 객체 | `source_url`, `source_ref`, `citation` |
| `attachable` | 파일, 이미지, 외부 리소스 첨부가 가능한 객체 | `attachment_refs` |
| `versioned` | 버전/개정 이력을 가지는 객체 | `version`, `revision`, `supersedes_ref` |

### 5.5 Space

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `locatable` | 장소나 좌표를 가진 객체 | `place_ref`, `address`, `lat`, `lng` |

### 5.6 Quant

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `measurable` | 수치값과 단위를 가진 객체 | `measure_value`, `measure_unit`, `target_value` |
| `budgeted` | 예산/비용을 가진 객체 | `budget_amount`, `budget_currency`, `budget_limit` |

### 5.7 Governance

| Model | 목적 | 대표 meaning slot |
| --- | --- | --- |
| `ownable` | 소유 주체가 중요한 객체 | `owner_ref` |
| `approvable` | 승인 절차가 필요한 객체 | `approval_state`, `approved_by_ref`, `approved_at` |

## 6. Model 상세 기준

아래 표는 v1에서 실제 설계 기준으로 삼는 상세 규칙이다. 여기서 `core slot`은 model 부착 시 기본적으로 생성 또는 요구되는 슬롯이고, `optional slot`은 필요 시 추가되는 슬롯이다.

### 6.1 Time

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `temporal` | `start_at` | `end_at`, `all_day`, `timezone` | `date \| datetime`, `boolean`, `string` | 캘린더/타임라인의 기본 시간 축. `end_at`이 없으면 시점 또는 단일 일정으로 해석한다. |
| `dueable` | `due_at` | - | `date \| datetime` | 마감 중심 객체. 보드/리스트/대시보드에서 due 기준 정렬과 강조에 사용한다. |
| `recurring` | `recurrence_rule` | `recurrence_until`, `recurrence_count` | `string`, `date \| datetime`, `integer` | 반복 규칙. 단독보다는 `temporal` 또는 `dueable`과 함께 쓰는 것을 기본으로 한다. |

### 6.2 Workflow

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `statusful` | `status` | `status_changed_at` | `string \| enum`, `datetime` | 보드의 기본 grouping 축. 상태 전이 이력의 최소 기준을 제공한다. |
| `assignable` | `assignee_refs` | `primary_assignee_ref` | `ref[]`, `ref` | 담당자 기반 정렬/필터링에 사용한다. `owner_ref`와 달리 실행 담당 의미다. |
| `prioritizable` | `priority` | - | `number \| enum` | 우선순위 정렬과 triage의 기준이다. |
| `progressable` | `progress_ratio` | `completed_at` | `number(0..1)`, `datetime` | 진행률 바, 완료 시각, dashboard 집계에 사용한다. |
| `estimable` | `estimate_value` | `estimate_unit`, `actual_value` | `number`, `string \| enum`, `number` | gantt나 작업 관리에서 예상 대비 실제를 비교한다. |

### 6.3 Structure

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `hierarchical` | `parent_ref` | `order_index` | `ref`, `number` | freeform의 트리 arrange나 구조 탐색에서 부모-자식 의미를 부여한다. |
| `ordered` | `order_index` | - | `number` | 형제 간 또는 리스트 내 순서를 정의한다. |
| `taggable` | `tag_keys` | - | `string[]` | 다중 라벨 분류. filter chip, quick grouping, search model에 사용한다. |
| `categorizable` | `category_key` | - | `string \| enum` | 단일 대표 분류. board column, dashboard segment, table grouping의 기본값으로 쓰기 좋다. |

### 6.4 Knowledge

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `sourceable` | `source_url` 또는 `source_ref` | `citation` | `string`, `ref`, `string` | 문서/지식 객체의 출처 추적. 둘 중 하나는 반드시 의미상 채워질 수 있어야 한다. |
| `attachable` | `attachment_refs` | - | `ref[]` | 파일, 이미지, 외부 리소스 첨부. 미디어/문서 패널 연동의 기준이다. |
| `versioned` | `version` | `revision`, `supersedes_ref` | `string`, `string`, `ref` | 문서/정책/산출물의 버전 계보를 표현한다. |

### 6.5 Space

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `locatable` | `place_ref` 또는 `address` | `lat`, `lng` | `ref`, `string`, `number`, `number` | 위치 기반 객체. 지도나 장소 필터링의 기준이다. |

### 6.6 Quant

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `measurable` | `measure_value` | `measure_unit`, `target_value` | `number`, `string`, `number` | KPI, 지표, 진행 측정값의 기본 표현. |
| `budgeted` | `budget_amount` | `budget_currency`, `budget_limit` | `number`, `string`, `number` | 비용/예산 집계. dashboard나 table의 재무 요약에 사용한다. |

### 6.7 Governance

| Model | Core slot | Optional slot | 기본 타입 | 기본 해석 |
| --- | --- | --- | --- | --- |
| `ownable` | `owner_ref` | - | `ref` | 책임 소유 주체. 실행 담당인 `assignable`과 분리한다. |
| `approvable` | `approval_state` | `approved_by_ref`, `approved_at` | `string \| enum`, `ref`, `datetime` | 승인 워크플로우가 필요한 객체. 통제와 정책 준수 관점에서 해석한다. |

## 7. 뷰 해석 기준

model는 뷰와 직접 1:1로 대응하지 않지만, 앱은 대략 아래처럼 model를 읽어 각 뷰를 활성화할 수 있다.

| 뷰 | 주로 읽는 model |
| --- | --- |
| `calendar` | `temporal`, `recurring` |
| `timeline` | `temporal`, `recurring` |
| `gantt` | `temporal`, `progressable`, `estimable`, `statusful` |
| `board` | `statusful`, `assignable`, `prioritizable` |
| `freeform tree arrange` | `hierarchical`, `ordered` |
| `dashboard` | `measurable`, `budgeted`, `progressable` |
| `table/list` | 대부분 model를 공통적으로 표시 가능 |

## 8. 권장 model 조합

단일 model보다 조합이 실제 도메인 모델에 더 가깝다.

- `task`
  `statusful + assignable + dueable + prioritizable + progressable`
- `event`
  `temporal + locatable + attachable`
- `milestone`
  `temporal + statusful + progressable`
- `document`
  `sourceable + versioned + attachable`
- `budget item`
  `measurable + budgeted`

## 9. 구현 기준

v1 구현에서는 다음을 원칙으로 한다.

- model 부착 시 필요한 meaning slot을 자동 생성할 수 있어야 한다.
- 사용자는 slot에 연결된 속성의 라벨을 자유롭게 바꿀 수 있어야 한다.
- slot 타입은 model가 강제할 수 있어야 한다.
- model 충돌 시 meaning slot 타입이 다르면 부착을 막는다.
- 삭제 제한이 필요한 slot은 시스템이 보호한다.

## 10. 보류 항목

이번 문서에서 아직 확정하지 않은 것은 다음과 같다.

- 실제 DB 컬럼명과 API 필드명
- DSL 문법
- model 간 충돌 우선순위
- 자동 생성된 property의 수정/삭제 정책 세부 규칙

즉, v1에서는 `대분류`, `model 목록`, 그리고 각 model의 `core/optional slot`과 기본 해석 규칙까지 기준안으로 고정한다.
