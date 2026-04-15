# System Semantics 개발 계획 v1

작성일: 2026-04-14  
상태: Review Draft  
인코딩: UTF-8

## 1. 목적

이 문서는 Netior에 `system semantics`를 도입하기 위한 실제 개발 순서와 작업 단위를 정리한다.

설계 기준은 아래 문서를 따른다.

- [system-semantics-traits-v1-ko.md](/C:/PyoSeChang/projects/netior/.claude/worktrees/layout-plugin/docs/system-semantics-traits-v1-ko.md)
- [system-semantics-implementation-plan-ko.md](/C:/PyoSeChang/projects/netior/.claude/worktrees/layout-plugin/docs/system-semantics-implementation-plan-ko.md)

이 문서의 목적은 세 가지다.

- 어떤 순서로 개발할지 합의한다.
- 어디까지를 이번 1차 범위로 볼지 고정한다.
- 검토 시 무엇을 먼저 의사결정해야 하는지 드러낸다.

## 2. 1차 범위

이번 1차는 아래까지만 한다.

- archetype에 `semantic_traits`를 붙일 수 있게 한다.
- archetype field에 `system_slot`를 붙일 수 있게 한다.
- trait 부착 시 필요한 slot field를 자동 생성할 수 있게 한다.
- concept editor가 slot-aware 입력과 기본 검증을 한다.
- calendar layout이 `temporal` slot을 우선 읽게 한다.
- `node_type`는 semantic 체계와 분리된 `network role`로 유지한다.

이번 1차에서 하지 않는 것은 아래다.

- DSL 문법 구현
- timeline / gantt 전체 전환
- drag writeback
- trait 기반 query builder
- DB/API 전체 naming 정리

## 3. 선행 결정

개발 시작 전에 확정되어야 하는 최소 결정은 아래다.

### 3.1 확정 대상

- trait 목록 v1
- 대표 system slot 목록 v1
- slot contract 강도 체계
  - `strict`
  - `constrained`
  - `loose`
- `node_type`는 계속 network role이라는 원칙

### 3.2 이번 문서 기준으로 이미 잠정 확정된 것

- `semantic trait`는 archetype 의미
- `node_type`는 network 안에서의 node role
- calendar는 `start_at`, `end_at`, `all_day`를 우선 사용
- `approvable`는 `governance` 소속

## 4. 개발 전략

이번 작업은 한 번에 끝까지 밀기보다, 아래 원칙으로 진행한다.

- 저장 구조를 먼저 연다.
- editor에서 선언할 수 있게 만든다.
- concept 입력에 의미를 반영한다.
- 마지막에 calendar에서 실제로 소비한다.

즉 순서는 다음과 같다.

1. 기반 타입과 저장 구조
2. archetype 선언 UI
3. concept 입력 UI
4. calendar 소비

이 순서를 지켜야 중간 단계에서도 데이터가 무너지지 않는다.

## 5. Phase 계획

### Phase 0. 기준선 정리

목표:

- trait / slot / node_type 책임 경계를 문서로 먼저 고정한다.

작업:

- 기준 문서 정리
- 구현 문서 정리
- 개발 계획 문서 정리

완료 기준:

- 이후 개발에서 `semantic trait`와 `node_type`를 섞지 않는다는 합의가 있다.

상태:

- 진행 중

### Phase 1. Shared / Core 기반 추가

목표:

- 시스템 의미를 저장하고 주고받을 수 있는 최소 데이터 구조를 만든다.

작업 묶음:

- `packages/shared/src/types/index.ts`
  - `SemanticCategoryKey`
  - `SemanticTraitKey`
  - `SystemSlotKey`
  - `SlotContractLevel`
  - `Archetype.semantic_traits`
  - `ArchetypeField.system_slot`
  - `ArchetypeField.generated_by_trait`
  - `ArchetypeField.slot_binding_locked`
- `packages/shared/src/constants/`
  - trait registry
  - slot registry
- `packages/netior-core/src/migrations/`
  - archetypes table 확장
  - archetype_fields table 확장
- `packages/netior-core/src/repositories/archetype.ts`
  - 새 필드 round-trip
- archetype IPC / preload / renderer service 연결

완료 기준:

- archetype과 archetype field가 trait / slot 정보를 손실 없이 저장하고 조회한다.

리스크:

- JSON TEXT로 갈지 정규화할지 아직 열려 있다.
- 1차는 JSON 저장으로 시작하는 편이 리스크가 낮다.

### Phase 2. Archetype Editor 적용

목표:

- 사용자가 archetype에 semantic trait를 선언할 수 있게 한다.

작업 묶음:

- `ArchetypeEditor`
  - `Semantic Traits` 섹션 추가
  - category별 trait 표시
  - trait attach / detach
- trait attach 시 자동 생성 로직
  - 예: `temporal -> start_at`
- `ArchetypeFieldRow`
  - system slot 배지 표시
  - generated field 표시
  - locked field 표시
  - system slot별 허용 타입 후보만 type picker에 노출

완료 기준:

- archetype editor에서 trait를 붙일 수 있다.
- 붙인 trait의 core slot field가 자동 생성된다.
- 사용자는 라벨은 바꿀 수 있지만 slot 의미는 깨지 못한다.

검토 포인트:

- detach 시 자동 생성 field를 삭제할지 남길지
- locked field의 편집 범위를 어디까지 열지

### Phase 3. Concept Editor 적용

목표:

- concept property 입력이 단순 field 나열이 아니라 의미 슬롯을 이해하게 만든다.

작업 묶음:

- `ConceptPropertiesPanel`
  - slot-aware rendering
  - slot contract 기반 soft validation
- 입력 규칙
  - `all_day -> boolean`
  - `start_at -> date|datetime`
  - `progress_ratio -> 0..1`
- trait가 있는 archetype에서 필요 slot 누락 시 경고
- `ConceptEditor`
  - occurrence 편집 섹션의 `node_type`를 사실상 `node role`로 설명

완료 기준:

- concept editor가 semantic slot 정보를 바탕으로 입력을 안내한다.
- 사용자 라벨을 유지하면서도 시스템은 canonical slot을 읽는다.

검토 포인트:

- hard validation을 언제부터 적용할지
- trait grouping UI를 이번에 넣을지, 후속으로 미룰지

### Phase 4. Calendar Plugin 적용

목표:

- calendar가 semantic slot만 읽게 만든다.

작업 묶음:

- calendar plugin의 field resolution 변경
  - `system_slot only`
- `temporal` trait가 붙고 필요한 slot이 연결된 archetype만 후보로 해석
- `start_at`, `end_at`, `all_day` 기반 배치
- `NetworkEditor`의 legacy mapping UI 제거

완료 기준:

- calendar가 `temporal` slot만 읽는다.
- runtime에서 field mapping 코드 경로가 제거된다.

검토 포인트:

- `timezone` 지원을 이번 phase에 같이 넣을지
- recurring는 1차에서 읽기만 할지, 아예 미룰지

### Phase 5. 후속 확장

목표:

- 같은 semantic 기반을 timeline / gantt / DSL로 확장한다.

후속 후보:

- timeline의 temporal slot 전환
- gantt family 도입
- DSL의 trait / slot 선언 문법
- slot 기반 query / filter / auto-view 추천

## 6. 작업 단위 제안

리뷰와 구현 편의를 위해 작업을 아래처럼 쪼개는 것을 권장한다.

### Ticket A. Shared semantics types

범위:

- shared type 추가
- registry 정의

산출물:

- renderer와 core가 같은 trait / slot 타입을 본다.

### Ticket B. Core persistence

범위:

- migration
- repository round-trip

산출물:

- DB 저장 가능

### Ticket C. Archetype trait editor

범위:

- archetype editor UI
- attach / detach
- auto field generation

산출물:

- 선언 가능

### Ticket D. Archetype field slot UX

범위:

- field row badge
- lock / generated 표시
- system slot별 type picker 제한

산출물:

- schema 편집 안정화

### Ticket E. Concept slot-aware input

범위:

- concept property panel validation
- node role 설명 정리

산출물:

- 입력 단계 안정화

### Ticket F. Calendar semantic adoption

범위:

- temporal slot 해석
- field mapping 코드 제거

산출물:

- 첫 실제 소비처 완성

## 7. 검토 순서 제안

문서를 검토할 때는 아래 순서가 효율적이다.

1. 책임 경계가 맞는지 본다.
   - `semantic trait`
   - `system slot`
   - `node_type`
2. 1차 범위가 적절한지 본다.
   - DSL 제외가 맞는지
   - calendar까지만 가는 게 맞는지
3. shared/core 저장 구조가 과한지 본다.
4. archetype editor UX가 복잡해지지 않는지 본다.
5. concept editor validation을 얼마나 세게 할지 본다.

## 8. 현재 가장 중요한 오픈 질문

아직 리뷰가 필요한 핵심 쟁점은 아래다.

- `slot contract`를 어디까지 강제할지
- trait detach 시 auto-generated field를 어떻게 처리할지
- slot binding을 사용자가 수동 변경 가능하게 할지
- calendar에서 `recurring`, `timezone`까지 1차에 넣을지
- `owner_ref`와 `assignee_refs`를 UI에서 얼마나 구분해서 보여줄지

## 9. 완료 정의

이번 1차 개발이 끝났다고 보려면 아래 조건을 만족해야 한다.

- archetype에 `semantic_traits`를 붙일 수 있다
- archetype field에 `system_slot`를 부여할 수 있다
- trait 부착 시 core slot field가 자동 생성된다
- concept editor가 slot-aware validation을 한다
- calendar가 `temporal` slot을 우선 읽는다
- `node_type`는 network role로 유지되고, semantic 의미와 섞이지 않는다

## 10. 추천 진행 순서

실제 구현 시작 순서는 아래를 권장한다.

1. Ticket A
2. Ticket B
3. Ticket C
4. Ticket D
5. Ticket E
6. Ticket F

즉:

- 먼저 저장 가능하게 만들고
- 그 다음 선언 가능하게 만들고
- 마지막에 calendar가 소비하게 한다

이 순서가 가장 안정적이다.
