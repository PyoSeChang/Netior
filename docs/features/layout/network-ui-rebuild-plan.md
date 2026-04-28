# Network UI Rebuild Plan

작성일: 2026-04-07

## 1. 목적

이 문서는 `.claude/worktrees/phase1-canvas-to-network` 워크트리에서
이미 올라와 있는 backend/store 계층을 바탕으로,
renderer UI/UX를 **복구가 아니라 재구축**하기 위한 실행 계획서다.

현재 상태는 다음과 같다.

- core, IPC, preload, service, store는 `network`, `layout`, `object`, `context` 구조를 상당 부분 반영하고 있다
- 하지만 renderer는 여전히 canvas 앱 시절의 진입 흐름과 화면 구조를 많이 유지하고 있다
- 이전 UI 커밋은 use-flow와 기존 패턴 이해 없이 작성되어 되돌려졌다

따라서 이번 작업의 목표는 “백엔드에 맞춰 명칭만 바꾸는 UI”가 아니라,
다음 Phase의 사용자 흐름을 실제로 드러내는 `network-native` UI를 새로 만드는 것이다.

## 2. 전제

### 2.1 재사용 대상

다음 계층은 최대한 재사용한다.

- `@netior/core` repository / migration
- main IPC
- preload bridge
- renderer services
- renderer stores

### 2.2 폐기 대상

다음 방향은 채택하지 않는다.

- 되돌린 UI 커밋을 그대로 복구하는 방식
- renderer에 임시 분기만 덧붙여 backend 기능을 억지로 노출하는 방식
- canvas 시절 interaction model을 유지한 채 명칭만 `network`로 바꾸는 방식

### 2.3 구현 원칙

- 구현 순서는 데이터 구조가 아니라 **사용자 체감 변화 순서**를 따른다
- 각 단계는 독립적으로 데모 가능해야 한다
- 새로 쓰는 UI는 기존 desktop-app 패턴을 따른다
- semantic token만 사용한다
- feature flag 없이 기본 흐름을 교체한다

## 3. 현재 문제 요약

### 3.1 앱 진입

- 프로젝트를 열기 전에는 여전히 `ProjectHome` 중심이다
- root network를 제품의 기본 진입면으로 느끼게 하는 흐름이 없다

### 3.2 앱 셸

- ActivityBar와 Sidebar가 아직 `canvases / files / schemas` 중심이다
- `contexts`가 사용자 진입면에 노출되지 않는다
- `network`라는 작업 단위를 중심으로 화면이 조직되지 않는다

### 3.3 워크스페이스

- `NetworkWorkspace`는 내부 데이터는 많이 반영하지만,
  사용자 관점에서는 여전히 concept/file 중심 조작에 머무른다
- object picker, box node, context filtering, portal affordance가 빠져 있다
- 빈 공간 메뉴와 node 메뉴가 새 object model을 충분히 드러내지 못한다

### 3.4 Context

- context 데이터는 존재하지만 사용자 기능이 아니다
- context 목록, 활성화, member 편집, dimming/hiding 흐름이 빠져 있다

### 3.5 User Type 확장 UI

- `schema_ref` 입력 UI가 빠져 있다
- type group UI도 빠져 있다

## 4. 최종 목표

재구축 완료 시 사용자는 다음을 체감해야 한다.

1. 프로젝트에 들어오면 “canvas 앱”이 아니라 “network workspace”를 쓰고 있다고 느낀다
2. network hierarchy를 탐색하고 breadcrumb/back으로 이동할 수 있다
3. concept 외의 object도 workspace 안에 배치할 수 있다
4. portal node를 통해 network entry를 인식하고 이동할 수 있다
5. context를 만들고 활성화해서 같은 network를 다른 작업 프레임으로 볼 수 있다
6. schema reference와 type group 같은 확장 기능이 UI에서 실제로 사용 가능하다

## 5. 비목표

이번 계획에서는 다음을 우선 목표로 두지 않는다.

- App Root Network를 첫 화면으로 완전히 교체하는 대규모 onboarding 재설계
- NodeType 전체 후보군을 한 번에 구현
- box/collection의 고급 drag-drop 규칙 완성
- context별 전용 layout 편집 UX 완성
- 디자인 시스템 전면 교체

즉 이번 재구축은 “Phase 2~6의 개념을 사용자에게 보이게 만드는 최소 완성 UI”가 목표다.

## 6. 구현 전략

전체 작업은 5개의 마일스톤으로 나눈다.

### Milestone A. Shell Reframe

목표:

- 앱 전체가 `network` 중심 구조로 보이게 만든다

범위:

- title bar / activity bar / sidebar / workspace shell
- project 진입 후 기본 시야 정리

핵심 결과:

- `canvases` 용어 제거
- `networks` 중심 navigation 노출
- `contexts`를 사이드 UI에 진입 가능하게 추가

대상 파일:

- `packages/desktop-app/src/renderer/App.tsx`
- `packages/desktop-app/src/renderer/components/sidebar/ActivityBar.tsx`
- `packages/desktop-app/src/renderer/components/sidebar/Sidebar.tsx`
- `packages/desktop-app/src/renderer/components/workspace/WorkspaceShell.tsx`
- `packages/desktop-app/src/renderer/stores/ui-store.ts`

완료 기준:

- 프로젝트를 열었을 때 ActivityBar/Sidebar 명칭과 정보 구조가 `network` 중심이다
- `contexts`가 탐색 가능한 1급 영역으로 노출된다
- canvas라는 인상이 남는 고정 텍스트/뷰 키가 제거된다

### Milestone B. Network Navigation UX

목표:

- network hierarchy를 사용자가 실제로 탐색할 수 있게 만든다

범위:

- network tree
- breadcrumb
- history/back
- 초기 network selection 규칙

핵심 결과:

- `parent_network_id` 기반 tree와 breadcrumb가 일관되게 동작한다
- 첫 진입 시 어떤 network를 열지 명확한 규칙을 갖는다

대상 파일:

- `packages/desktop-app/src/renderer/components/sidebar/NetworkList.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NetworkBreadcrumb.tsx`
- `packages/desktop-app/src/renderer/stores/network-store.ts`
- `packages/desktop-app/src/renderer/App.tsx`

완료 기준:

- 사용자가 sidebar tree, breadcrumb, back action으로 network를 탐색할 수 있다
- concept portal 없이도 hierarchy가 이해된다

### Milestone C. Workspace Interaction Rewrite

목표:

- `NetworkWorkspace`를 concept board에서 typed object workspace로 전환한다

범위:

- node interaction
- context menu
- portal affordance
- network/object/file/concept double-click action
- object 추가 진입점

핵심 결과:

- network object는 portal처럼 보이고 동작한다
- 빈 공간 메뉴와 node 메뉴가 새 object model을 기준으로 재작성된다
- object picker를 통해 concept 외 object도 배치할 수 있다

대상 파일:

- `packages/desktop-app/src/renderer/components/workspace/NetworkWorkspace.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NodeLayer.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NodeContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/workspace/NetworkContextMenu.tsx`
- `packages/desktop-app/src/renderer/components/workspace/EdgeLayer.tsx`
- `packages/desktop-app/src/renderer/components/workspace/ObjectPickerModal.tsx` 신규

완료 기준:

- network object를 node로 추가하고 열 수 있다
- portal entry가 시각적으로 구분된다
- concept/file 전용 메뉴가 아니라 object-aware 메뉴가 동작한다

### Milestone D. Context UX

목표:

- context를 데이터가 아니라 사용자 기능으로 만든다

범위:

- context list
- context editor
- member picker
- active context state
- dimming/hiding

핵심 결과:

- 현재 network 기준 context 목록을 볼 수 있다
- context를 만들고 편집하고 활성화할 수 있다
- 활성 context가 workspace 렌더링에 반영된다

대상 파일:

- `packages/desktop-app/src/renderer/components/sidebar/ContextList.tsx` 신규
- `packages/desktop-app/src/renderer/components/editor/ContextEditor.tsx`
- `packages/desktop-app/src/renderer/components/editor/ContextMemberPicker.tsx` 신규
- `packages/desktop-app/src/renderer/stores/context-store.ts`
- `packages/desktop-app/src/renderer/components/workspace/NetworkWorkspace.tsx`

완료 기준:

- context를 만들 수 있다
- object/edge member를 추가/제거할 수 있다
- active context가 화면에서 보인다

### Milestone E. User Type UI Exposure

목표:

- backend에 이미 있는 schema_ref/type_groups 기능을 UI에서 실제 사용 가능하게 만든다

범위:

- schema field editor
- concept property editor
- type group store/list UI

핵심 결과:

- `schema_ref` 필드를 정의할 수 있다
- concept property에서 schema reference를 선택할 수 있다
- schema/relation type group을 UI에서 관리할 수 있다

대상 파일:

- `packages/desktop-app/src/renderer/components/editor/SchemaFieldRow.tsx`
- `packages/desktop-app/src/renderer/components/editor/ConceptPropertiesPanel.tsx`
- `packages/desktop-app/src/renderer/components/ui/SchemaRefPicker.tsx` 신규
- `packages/desktop-app/src/renderer/stores/type-group-store.ts` 신규
- `packages/desktop-app/src/renderer/components/sidebar/SchemaList.tsx`
- `packages/desktop-app/src/renderer/components/sidebar/RelationTypeList.tsx`

완료 기준:

- schema reference가 생성/편집/선택 가능하다
- type group이 UI에서 조회/생성/이동 가능하다

## 7. 구현 순서

실행 순서는 다음과 같이 고정한다.

1. Milestone A
2. Milestone B
3. Milestone C
4. Milestone D
5. Milestone E

이 순서의 이유는 다음과 같다.

- A/B가 먼저 끝나야 앱이 `network app`처럼 보인다
- C가 끝나야 backend object model이 사용자에게 드러난다
- D는 구조 위에서 읽기 프레임을 추가하는 단계다
- E는 마지막에 붙여도 전체 흐름을 깨지 않는다

## 8. 세부 작업 항목

### 8.1 A단계 세부 작업

- `SidebarView`에서 `canvases`를 `networks`로 교체
- ActivityBar에 `contexts` 추가
- Sidebar 렌더 분기를 `networks / files / schemas / contexts`로 재구성
- workspace shell에서 project 진입 후 network 중심 레이아웃이 기본임을 강화
- UI copy에서 남은 canvas 용어 제거

### 8.2 B단계 세부 작업

- `NetworkList`의 생성/open/delete 흐름을 `parent_network_id` 기준으로 점검
- 초기 진입 시 root-like network를 여는 규칙 정의
- breadcrumb와 title bar breadcrumb 역할 중복 정리
- `navigateBack`, `navigateToBreadcrumb`의 UX 표시 위치 정리

### 8.3 C단계 세부 작업

- object picker 신규 작성
- 빈 공간 우클릭 메뉴를 object 추가 중심으로 재작성
- node별 context menu를 object_type 기반으로 재구성
- portal node 시각 affordance 정의
- 필요 시 `RenderNode` 타입에 portal/box 표현용 필드 추가
- box node는 최소 시각 표현만 우선 제공하고, 고급 편집은 후속으로 남긴다

### 8.4 D단계 세부 작업

- context store에 `activeContextId` 추가
- context member 조회/캐시 상태 추가
- context list와 eye toggle UI 추가
- context editor에 member section 추가
- workspace에서 active context 적용 시 dimming/hiding 규칙 구현

### 8.5 E단계 세부 작업

- `TypeSelector`에 `schema_ref` 노출 확인
- `SchemaRefPicker` 신규 작성
- concept property input switch에 `schema_ref` 처리 추가
- type group store와 list UI 추가
- schema/relation type 목록의 folder/group 렌더링 설계

## 9. 의사결정 가이드

재구축 중 선택이 갈릴 때는 아래 원칙을 따른다.

### 9.1 복잡한 기능 vs 명확한 흐름

복잡한 기능보다 명확한 흐름을 우선한다.

예:

- Box node 고급 편집 < object picker + portal affordance
- App Root 완전 전환 < Project Root 기반 network shell 정착

### 9.2 새 추상화 추가 기준

새 store나 helper는 다음 조건에서만 추가한다.

- 여러 컴포넌트가 같은 state를 공유해야 할 때
- 기존 store에 붙이면 책임이 흐려질 때

그 외에는 기존 service/store를 재사용한다.

### 9.3 되돌린 코드 활용 기준

되돌린 커밋의 코드는 참고만 한다.

- 화면 구조를 그대로 되살리지 않는다
- 로직이 독립적이고 현재 방향과 맞는 경우에만 부분 차용한다

## 10. 검증 계획

각 마일스톤 완료 시 아래를 확인한다.

### 10.1 정적 검증

```bash
pnpm --filter @netior/desktop-app exec tsc --noEmit
```

참고:

- 현재 워크트리에서는 `pnpm typecheck`가 `turbo` 권한 문제로 실패할 수 있다
- 따라서 renderer 작업 검증은 우선 desktop-app 단독 타입체크를 기준으로 삼는다

### 10.2 수동 검증

각 단계마다 다음을 실제로 확인한다.

- 프로젝트 열기
- network tree에서 network 열기
- breadcrumb/back 이동
- 빈 공간 우클릭과 node 우클릭
- object 추가
- context 생성/활성화
- schema_ref 입력

### 10.3 회귀 체크

다음 기능은 작업 내내 깨지면 안 된다.

- concept 생성
- file node 추가
- edge 생성/편집
- editor tab 열기/닫기
- narre 탭 열기

## 11. 예상 리스크

### 11.1 Store는 준비됐지만 UX 규칙이 덜 정리된 부분

특히 아래는 구현 중 다시 결정을 요구할 수 있다.

- 첫 network 자동 선택 규칙
- portal node의 정확한 시각 언어
- context 적용 시 hide vs dim 기본값
- box node를 이번 단계에서 어디까지 노출할지

### 11.2 Root Network와 Home의 관계

App Root Network를 바로 진입면으로 삼을지,
현재의 `ProjectHome`을 유지한 채 project 내부만 network-first로 갈지는 별도 결정이 필요하다.

이번 계획에서는 후자를 기본값으로 둔다.

## 12. 완료 정의

이 계획서 기준 “UI 재구축 완료”는 다음을 만족하는 상태다.

1. 프로젝트를 열면 `network` 중심 shell이 보인다
2. network hierarchy를 사용자가 탐색할 수 있다
3. object-aware workspace interaction이 동작한다
4. context가 실제 기능으로 노출된다
5. schema_ref / type_group 기능이 UI에서 사용 가능하다
6. desktop-app 타입체크가 통과한다

## 13. 다음 작업

이 문서 다음 단계는 각 마일스톤을 실제 작업 티켓으로 분해하는 것이다.

권장 시작점:

- A-1 `ui-store.ts` / `ActivityBar.tsx` / `Sidebar.tsx`
- A-2 `App.tsx` / `WorkspaceShell.tsx`
- B-1 `NetworkList.tsx` / `NetworkBreadcrumb.tsx`
