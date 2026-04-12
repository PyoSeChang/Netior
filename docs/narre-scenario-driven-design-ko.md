# Narre 사용 시나리오 기반 관계형 Archetype 설계

작성일: 2026-04-12  
상태: Draft  
인코딩: UTF-8

## 1. 문서의 역할

이 문서는 이번 phase에서 Narre와 MCP를 설계할 때의 상위 기준 문서다.

이번 문서의 출발점은 CRUD가 아니다. 출발점은 사용자의 사용 시나리오다.

핵심 질문은 다음과 같다.

- 사용자는 내부 구현을 모르는 상태에서 무엇을 기대하는가
- 사용자는 그 기대를 자연어로 어떻게 말하는가
- Narre는 그 말을 듣고 어떤 내부 관계 모델로 해석해야 하는가
- 그 해석을 수행하려면 어떤 MCP, 프롬프트, 컨텍스트 설계가 필요한가

이 문서는 향후 다음 설계의 입력이 된다.

- MCP tool 일반화
- Narre system prompt와 task prompt
- session context contract
- mention/search surface
- eval scenario

## 2. 범위

### 2.1 이번 phase의 목표

- 관계형 archetype을 사용자 시나리오 기준으로 정의한다.
- Narre가 자연어에서 사용자의 내적 기대를 추론할 수 있도록 해석 틀을 만든다.
- 그 해석 틀에서 필요한 MCP/tool/prompt/context의 일반화 축을 도출한다.

### 2.2 이번 phase의 비목표

- `module` 생성, 수정, 삭제, module-directory 관리
- `context` 생성, 수정, 삭제, context-member 관리
- multi-agent 권한/책임 설계
- 라우트 단위의 기계적 MCP 미러링
- 레이아웃 자동 편집 중심의 UI 설계

`module`은 사용자 정의 맥락 경계다.  
`context`는 현재 모델에 존재하지만 이번 phase의 agent-owned surface가 아니다.

## 3. 설계 전제

### 3.1 사용자 언어가 기준이다

사용자는 보통 다음처럼 말하지 않는다.

- "`archetype_ref` 필드를 만들어줘"
- "instance-backed multi-select 옵션 소스를 설정해줘"
- "relation type과 edge로 모델링해줘"

사용자는 보통 다음처럼 말한다.

- "캐릭터마다 스탯이 있어"
- "캐릭터가 아이템을 장착하게 하고 싶어"
- "전투 관련 타입끼리 폴더처럼 묶고 싶어"
- "루트에서 종족, 직업, 캐릭터 순서로 내려가고 싶어"

따라서 Narre는 내부 구현 용어를 먼저 묻는 대신, 사용자 자연어에서 구조를 추론해야 한다.

### 3.2 관계형 archetype은 한 종류가 아니다

이번 문서에서 관계형 archetype은 최소 두 종류를 포함한다.

- 타입 참조형 관계  
  예: `Character`가 `Stats`를 가진다.  
  느낌: `Character { Stats stats }`

- 인스턴스 기반 선택형 관계  
  예: `Character`가 `Item` archetype의 실제 객체들 중 하나 또는 여러 개를 선택한다.

둘은 사용자의 표현이 비슷해도 내부 의미와 필요한 작업이 다르다.

### 3.3 Narre는 다섯 층을 구분해야 한다

사용자 요청을 해석할 때 Narre는 최소 아래 층을 구분해야 한다.

- schema 설계
- instance 생성/수정
- graph 관계
- organization 정리
- network/hierarchy/view 구조

같은 문장 안에도 둘 이상이 섞여 있을 수 있다.

## 4. 사용 시나리오 케이스

### Case 1. 타입을 먼저 세우고 싶다

- 사용자가 내적으로 기대하는 것:  
  반복적으로 등장하는 종류를 먼저 정하고 싶다. 개별 객체보다 세계를 나누는 틀이 필요하다.
- 사용자는 어떻게 말하는지:  
  "캐릭터, 아이템, 스킬 정도가 필요할 것 같아"  
  "문서 타입을 먼저 나누고 싶어"
- agent는 어떻게 이해해야 하는지:  
  이건 instance 작업이 아니라 archetype 설계 요청이다.
- 내부 분기:  
  도메인 엔티티 분류인지, 상태값 분류인지, 표시용 카테고리인지 구분해야 한다.  
  상태값 분류라면 archetype이 아니라 field나 choice일 수 있다.
- agent는 어떤 작업을 해야 하는지:  
  archetype 후보를 제안하고, 역할 차이를 설명하고, 과한 분해 여부를 판단한 뒤 archetype 초안을 만든다.

### Case 2. 특정 archetype의 내부 구조를 만들고 싶다

- 사용자가 내적으로 기대하는 것:  
  특정 종류의 객체가 어떤 속성을 가져야 하는지 정하고 싶다.
- 사용자는 어떻게 말하는지:  
  "캐릭터에는 이름, 종족, 레벨, 체력이 있어야 해"  
  "아이템에는 등급하고 가격이 필요해"
- agent는 어떻게 이해해야 하는지:  
  이건 archetype field 설계 요청이다.
- 내부 분기:  
  단순 scalar field인지, 날짜/숫자/불리언인지, 단일 선택인지, 다중 선택인지, 참조형인지 구분해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  field 후보를 추출하고, 타입을 추론하고, 필수 여부와 기본값 가능성을 판단한 뒤 field 구조를 만든다.

### Case 3. 한 archetype이 다른 archetype을 가진다

- 사용자가 내적으로 기대하는 것:  
  어떤 객체가 다른 구조를 자기 내부의 일부처럼 참조하길 원한다.
- 사용자는 어떻게 말하는지:  
  "캐릭터마다 스탯이 있어"  
  "무기에는 공격 프로필이 붙어"  
  "문서마다 메타데이터 시트가 있어"
- agent는 어떻게 이해해야 하는지:  
  이건 타입 참조형 관계 후보이며, 보통 relational field 쪽 해석이 우선이다.
- 내부 분기:  
  단일 참조인지, 여러 개를 가질 수 있는지, 필수인지 선택인지, 포함처럼 느껴지지만 실제로는 참조로 둘지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  대상 archetype 존재 여부를 확인하고, 없으면 먼저 제안/생성하고, 현재 archetype에 relational field를 추가한다.

### Case 4. 선택 필드의 옵션이 문자열이 아니라 다른 archetype의 객체여야 한다

- 사용자가 내적으로 기대하는 것:  
  옵션을 문자열 목록으로 박아두는 게 아니라 실제 객체 집합에서 고르고 싶다.
- 사용자는 어떻게 말하는지:  
  "캐릭터가 아이템을 장착하게 하고 싶어"  
  "직업은 Job 객체들 중에서 고르게 하고 싶어"  
  "등록된 분류 중에서 선택하게 하고 싶어"
- agent는 어떻게 이해해야 하는지:  
  이건 고정 enum이 아니라 instance-backed choice field 후보다.
- 내부 분기:  
  단일 선택인지, 다중 선택인지, source archetype의 모든 객체를 쓰는지, 조건부 subset을 쓰는지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  옵션 소스 archetype을 정하고, 필요한 객체가 이미 있는지 확인하고, 없으면 먼저 생성 흐름을 제안한 뒤 choice field를 만든다.

### Case 5. 사용자는 field와 edge의 차이를 모르지만 결과는 기대한다

- 사용자가 내적으로 기대하는 것:  
  어떤 관계가 보이고 추적되고 수정 가능하기를 원한다. 내부 표현은 모른다.
- 사용자는 어떻게 말하는지:  
  "캐릭터가 아이템을 소유해"  
  "인물은 조직에 소속돼"  
  "문서가 다른 문서를 참고해"
- agent는 어떻게 이해해야 하는지:  
  이건 field인지 edge인지, 또는 둘 다 필요한지 구분해야 하는 요청이다.
- 내부 분기:  
  객체 내부 속성형 관계인지, 독립된 두 객체 간 그래프 관계인지, 검색과 시각화가 중요한지, 폼 입력과 구조 제약이 중요한지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  관계 의미를 사용자 언어로 요약한 뒤, field/edge 중 더 적절한 표현을 선택하고 필요한 schema나 graph 작업을 수행한다.

### Case 6. 사용자는 하나, 여러 개, 없을 수도 있음을 자연어로 기대한다

- 사용자가 내적으로 기대하는 것:  
  수량 규칙이 구조에 반영되길 원한다.
- 사용자는 어떻게 말하는지:  
  "캐릭터는 하나의 스탯 시트를 가져"  
  "캐릭터는 여러 아이템을 장착할 수 있어"  
  "탈것은 없을 수도 있어"
- agent는 어떻게 이해해야 하는지:  
  이건 cardinality와 optionality를 추론해야 하는 요청이다.
- 내부 분기:  
  exactly one, optional one, one-to-many, many-to-many를 구분해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  single ref / multi ref / optional 여부를 구조에 반영하고, 기존 데이터에 영향이 있으면 짧게 확인한다.

### Case 7. 공통 구조를 재사용하고 싶다

- 사용자가 내적으로 기대하는 것:  
  중복 없이 공통 구조를 재사용하고 싶다.
- 사용자는 어떻게 말하는지:  
  "스탯 구조는 캐릭터랑 몬스터 둘 다 써야 해"  
  "가격 정보는 아이템이랑 상점 둘 다 필요해"
- agent는 어떻게 이해해야 하는지:  
  이건 공통 archetype 추출 또는 참조 구조 재사용 요청이다.
- 내부 분기:  
  별도 archetype으로 뽑을지, 단순 field 복제면 충분한지, 정말 독립 객체여야 하는지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  공통 구조를 식별하고, 추출 가치와 복잡성을 비교하고, 필요하면 공통 archetype을 생성한 뒤 참조 구조로 연결한다.

### Case 8. 객체를 먼저 만들고 나중에 구조를 붙인다

- 사용자가 내적으로 기대하는 것:  
  처음엔 대충 넣고, 나중에 구조화해도 괜찮다고 기대한다.
- 사용자는 어떻게 말하는지:  
  "일단 캐릭터 몇 개 만들어놨는데 이제 스탯 구조를 붙이고 싶어"  
  "아이템은 이미 많은데 장비 슬롯 개념을 추가하고 싶어"
- agent는 어떻게 이해해야 하는지:  
  이건 schema evolution과 migration 시나리오다.
- 내부 분기:  
  기존 값에서 자동 추출 가능한지, 빈값으로 남겨도 되는지, 수동 매핑이 필요한지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  현재 concept 상태를 조사하고, 새 구조 도입 시 영향을 분석하고, 자동 변환 가능한 부분과 확인이 필요한 부분을 나눠서 제안한다.

### Case 9. 구조를 합치거나 쪼개고 싶다

- 사용자가 내적으로 기대하는 것:  
  현재 모델이 너무 거칠거나 너무 세분화되어 있어서 더 자연스러운 구조로 바꾸고 싶다.
- 사용자는 어떻게 말하는지:  
  "캐릭터랑 몬스터를 생명체로 묶을까?"  
  "아이템을 장비와 소모품으로 나누고 싶어"  
  "이 스탯 구조는 너무 커서 분리해야겠어"
- agent는 어떻게 이해해야 하는지:  
  이건 생성이 아니라 schema refactor다.
- 내부 분기:  
  merge인지, split인지, rename인지, 공통 base 추출인지, field 이동인지 구분해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  기존 구조와 목표 구조를 비교하고, 영향받는 concept를 파악하고, 안전한 migration 순서를 제안한다.

### Case 10. 타입을 폴더처럼 정리하고 싶다

- 사용자가 내적으로 기대하는 것:  
  archetype과 relation type이 많아질수록 사람 기준으로 이해 가능한 구조를 원한다.
- 사용자는 어떻게 말하는지:  
  "타입이 많아서 폴더로 정리하고 싶어"  
  "전투 관련 타입끼리 묶고 싶어"  
  "관계 타입도 카테고리별로 나누자"
- agent는 어떻게 이해해야 하는지:  
  이건 의미 객체 생성이 아니라 type group organization이다.
- 내부 분기:  
  archetype group인지, relation type group인지, 상하위 그룹이 필요한지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  그룹 구조를 제안하고, 기존 타입 배치 계획을 세우고, 과도한 깊이를 피하면서 정리한다.

### Case 11. schema와 network 구조를 섞어서 말한다

- 사용자가 내적으로 기대하는 것:  
  "어떻게 보이고 탐색되는지"와 "무슨 구조인지"를 함께 기대한다.
- 사용자는 어떻게 말하는지:  
  "캐릭터 밑에 스탯이 보이게 해줘"  
  "아이템은 별도 네트워크로 관리하고 캐릭터 쪽에서 연결되면 좋겠어"  
  "루트에서 종족, 직업, 캐릭터 계층으로 내려가고 싶어"
- agent는 어떻게 이해해야 하는지:  
  이건 schema 요청과 network/hierarchy 요청이 섞인 경우다.
- 내부 분기:  
  표현 구조를 말하는지, 실제 데이터 관계를 말하는지, 둘 다 필요한지 구분해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  schema 변경과 network 변경을 분리해서 해석하고, 필요한 object/node/edge와 network hierarchy 작업을 나눠서 수행한다.

### Case 12. "알아서 구조를 잡아달라"고 말한다

- 사용자가 내적으로 기대하는 것:  
  자연어만으로도 상당 부분 알아서 설계해주길 바라지만, 큰 구조 변화는 의도와 맞아야 한다.
- 사용자는 어떻게 말하는지:  
  "알아서 구조 좀 잡아줘"  
  "대충 이런 느낌인데 적절히 해석해봐"
- agent는 어떻게 이해해야 하는지:  
  이건 자유도가 큰 대신 추론 책임이 큰 상황이다.
- 내부 분기:  
  low-risk 기본값으로 진행 가능한지, schema를 영구적으로 바꾸는지, 기존 데이터에 영향을 주는지 판단해야 한다.
- agent는 어떤 작업을 해야 하는지:  
  자연어를 관계 가설로 변환하고, 그 가설을 사용자 도메인 언어로 짧게 되짚은 뒤, low-risk는 바로 제안하고 high-impact는 확인받는다.

### Case 13. 사용자는 결과를 말하고 내부 표현은 모른다

- 사용자가 내적으로 기대하는 것:  
  "이런 식으로 쓰고 싶다"는 결과가 중요하지 내부 모델 명칭은 중요하지 않다.
- 사용자는 어떻게 말하는지:  
  "캐릭터를 열면 장비랑 스탯이 다 보여야 해"  
  "직업별로 고를 수 있는 스킬만 보이면 돼"  
  "아이템 목록 중에서 선택해서 장착하면 돼"
- agent는 어떻게 이해해야 하는지:  
  결과 요구에서 schema 요구, relation 요구, option-source 요구, network/view 요구를 역으로 추론해야 한다.
- 내부 분기:  
  결과를 만들기 위해 schema만 바꾸면 되는지, instance도 필요하지, graph/view까지 손대야 하는지 나눠야 한다.
- agent는 어떤 작업을 해야 하는지:  
  결과 요구를 내부 작업 단위로 분해하고, 사용자에게는 구현 용어가 아니라 결과 용어로 요약한 뒤 단계별로 수행한다.

## 5. Narre의 내부 관계 해석 모델

사용자 시나리오를 Narre가 해석할 때의 기본 관계 분류는 다음과 같다.

### 5.1 Scalar Field

- 의미: 단순 속성값
- 예: 이름, 레벨, 가격, 설명
- 사용자 표현 신호: "이 정보가 있어야 해", "속성으로 넣자"

### 5.2 Typed Archetype Reference

- 의미: 한 archetype의 field가 다른 archetype을 타입으로 참조
- 예: `Character.stats -> Stats`
- 사용자 표현 신호: "A마다 B가 있다", "A는 B를 가진다", "A에 B 시트가 붙는다"

### 5.3 Instance-Backed Choice

- 의미: 선택 필드의 옵션이 문자열이 아니라 다른 archetype의 실제 객체 집합
- 예: `Character.equipment`가 `Item` 객체들을 옵션으로 사용
- 사용자 표현 신호: "A가 B들 중에서 고른다", "등록된 B 중 하나를 선택한다", "실제 아이템을 장착한다"

### 5.4 Graph Edge

- 의미: 독립된 두 객체 간의 관계를 그래프에서 표현
- 예: 소속, 동맹, 적대, 참조
- 사용자 표현 신호: "A가 B에 속한다", "A가 B를 참고한다", "A와 B가 연결된다"

### 5.5 Type Group

- 의미: archetype과 relation type을 폴더처럼 정리하는 구조
- 사용자 표현 신호: "폴더처럼 묶자", "카테고리별로 정리하자"

### 5.6 Network/Hierarchy/View Structure

- 의미: schema 자체가 아니라 탐색과 시각화를 위한 구조
- 사용자 표현 신호: "루트에서 내려가고 싶다", "밑에 보이게 해줘", "별도 네트워크로 관리하자"

## 6. 기본 해석 우선순위

자연어가 애매할 때 Narre는 아래 순서로 판단한다.

1. 이 요청은 schema인가, instance인가, graph인가, organization인가, network/view인가
2. schema라면 scalar field인가, typed reference인가, instance-backed choice인가
3. cardinality는 하나인가, 여러 개인가, 없을 수도 있는가
4. 지금 바로 변경해도 되는가, 구조 변경이라 확인이 필요한가

다음 기본 규칙을 둔다.

- "가진다", "붙어 있다", "시트가 있다"는 typed reference 후보
- "고른다", "장착한다", "등록된 목록 중에서 선택한다"는 instance-backed choice 후보
- "속한다", "연결된다", "참고한다"는 edge 후보
- "묶고 싶다", "폴더로 정리하고 싶다"는 type group 후보
- "루트에서 보이게", "밑에 보이게", "별도 네트워크로"는 network/view 후보

## 7. 세션 컨텍스트 계약

### 7.1 항상 주는 기본 컨텍스트

일반 작업 세션에서도 아래 정보는 기본 제공 대상이다.

- 프로젝트의 archetype 지도
- 각 archetype의 핵심 field 요약
- 어떤 field가 typed reference인지
- 어떤 field가 instance-backed choice인지
- archetype 간 의존 관계 요약
- type group 요약
- root network와 network tree의 요약

여기서는 프로젝트 전체 instance를 다 넣지 않는다.

### 7.2 현재 작업 대상 concept에 대해 확장해서 주는 컨텍스트

사용자가 특정 concept를 열거나 언급하거나 수정하려는 순간 아래까지 확장한다.

- concept의 id와 title
- concept의 archetype
- 그 archetype의 전체 field 구조
- 현재 property 값
- relational field가 가리키는 현재 대상
- instance-backed choice field의 현재 선택값

### 7.3 1-hop 확장 원칙

현재 concept가 직접 의존하는 archetype과 값까지만 자동 확장한다.

예:

- `Character`를 다루면 `Stats` archetype 정보는 자동 확장
- `Character`가 `Item` instance-backed choice를 쓰면 `Item` archetype 정보와 현재 선택값은 자동 확장
- `Item` archetype의 전체 객체 목록은 필요할 때 조회

### 7.4 이번 phase에서 자동 주입하지 않는 것

- module 정보
- context 정보

이 둘은 이번 phase의 Narre 설계 핵심이 아니다.

## 8. 시나리오에서 도출되는 MCP 일반화 원칙

이번 phase에서 중요한 것은 "이번에 필요한 기능별 tool 목록"이 아니다.

더 중요한 것은 다음이다.

- 관계형 archetype 모델이 앞으로 더 복잡해져도
- 관계 유형마다 새 tool을 계속 추가하지 않고
- 기존 primitive 위에서 확장 가능하게 만들고
- 기능 추가의 한계 비용을 낮추는 것

따라서 MCP는 route 미러링도 아니고 feature별 tool 나열도 아니다.  
MCP는 **공통 primitive family**를 중심으로 일반화되어야 한다.

### 8.1 왜 primitive family가 필요한가

앞으로 관계형 archetype 모델은 계속 고도화될 수 있다.

예:

- 단순 typed reference
- instance-backed choice
- filtered option source
- 현재 concept 상태에 따라 달라지는 source
- polymorphic reference
- nested structure에 가까운 relation
- 표시 규칙이 붙은 relation
- migration 정보가 필요한 relation

이때 관계 유형마다 다음처럼 tool이 늘어나면 실패다.

- `create_typed_ref_field`
- `create_instance_choice_field`
- `create_filtered_choice_field`
- `create_polymorphic_ref_field`

이 방식은 agent 추론 모델이 풍부해질수록 MCP surface도 같이 폭증한다.

이번 설계는 반대로 가야 한다.

- Narre 내부 추론 모델은 풍부하게
- MCP 조작 primitive는 좁고 일반적으로

### 8.2 공통 primitive family

이번 phase에서 MCP는 최소 아래 family로 공통화되어야 한다.

#### A. Schema Discovery

의미:

- 프로젝트 스키마를 읽는 primitive

대표 질문:

- 프로젝트에 어떤 archetype이 있는가
- 특정 archetype은 어떤 field를 가지는가
- field contract는 무엇인가
- 어떤 archetype이 다른 archetype에 의존하는가
- type group 구조는 어떻게 생겼는가

#### B. Schema Mutation

의미:

- archetype과 field contract를 바꾸는 primitive

대표 작업:

- archetype 생성/수정/삭제
- field 생성/수정/삭제/정렬
- relation type 생성/수정/삭제
- type group 생성/수정/삭제/이동

#### C. Instance Discovery

의미:

- 특정 archetype이나 concept의 실제 값을 읽는 primitive

대표 질문:

- 특정 archetype의 concept들은 무엇인가
- 특정 concept의 현재 property 값은 무엇인가
- 현재 relational field 값은 무엇인가
- 현재 choice field의 후보와 선택값은 무엇인가

#### D. Instance Mutation

의미:

- 실제 concept 값과 relation 값을 바꾸는 primitive

대표 작업:

- concept 생성/수정/삭제
- concept property 읽기/쓰기
- single ref 값 갱신
- multi ref 값 갱신
- instance-backed choice 값 갱신

#### E. Candidate Source Discovery

의미:

- 특정 field에 값을 넣기 위해 후보 집합을 찾는 primitive

대표 질문:

- 이 field가 참조할 수 있는 archetype은 무엇인가
- 이 field에서 선택 가능한 concept 후보는 무엇인가
- 후보 집합은 전체 archetype 객체인가, 조건부 subset인가

이 family는 앞으로 관계형 archetype 고도화에서 특히 중요하다.

#### F. Graph Discovery and Mutation

의미:

- schema와 별개로 network/view 구조를 다루는 primitive

대표 작업:

- network tree 조회
- network full 조회
- object lookup
- node 추가/수정/삭제
- edge 추가/수정/삭제

이 family는 schema와 표현 구조를 분리하기 위해 필요하다.

### 8.3 새 관계 유형이 생겨도 tool을 늘리지 않는 방법

새 관계형 기능이 생길 때마다 tool을 추가하는 대신, 아래 descriptor를 richer하게 만드는 방향으로 가야 한다.

#### Field Contract Descriptor

field는 단순히 "이름 + 타입"이 아니다.  
앞으로는 field contract 자체가 확장 포인트가 된다.

최소 포함 정보 예시:

- field key/name
- value kind
- cardinality
- optionality
- default
- relation mode
- target archetype
- option source
- constraint
- display hint

핵심은 field 유형이 늘어나도 `create_field`, `update_field` 같은 primitive는 유지하고, 내부 payload만 커지게 만드는 것이다.

#### Option Source Descriptor

option source는 단순 enum이냐 archetype source냐의 이분법으로 끝나지 않는다.

앞으로 가능한 확장 예:

- 고정 문자열 목록
- 특정 archetype의 전체 객체
- 특정 archetype의 조건부 subset
- 현재 concept의 다른 값에 따라 달라지는 후보
- 앞으로 추가될 계산형 source

따라서 MCP는 "선택 필드 전용 새 tool"보다 "option source descriptor를 읽고 쓰는 일반 contract"를 중심으로 가야 한다.

#### Value Binding Descriptor

관계형 field의 실제 값도 일반화가 필요하다.

예:

- 단일 참조
- 다중 참조
- 단일 선택
- 다중 선택
- 비어 있음 허용

이 역시 각각 전용 tool로 쪼개기보다, 값 바인딩 규약을 공통 payload로 다루는 쪽이 낫다.

#### Descriptor Contract가 실제로 고정해야 하는 질문

descriptor contract는 코드 구현 형식보다 먼저, Narre가 어떤 질문에 일관되게 답할 수 있어야 하는지를 고정해야 한다.

모든 관계형 요청은 최소 아래 질문으로 분해되어야 한다.

- 이 요청은 schema를 바꾸는가, instance를 바꾸는가, graph를 바꾸는가
- 새로 생기거나 수정되는 field contract는 무엇인가
- 그 field가 참조하거나 선택할 후보 집합은 어디에서 오는가
- 실제 값은 단일인가, 다중인가, 비어 있을 수 있는가
- 기존 concept들에는 어떤 migration 영향이 있는가

핵심은 새 관계 유형이 들어올 때마다 "새 기능 이름"을 붙이는 것이 아니라, 위 질문들에 대한 답을 더 풍부하게 만드는 것이다.

### 8.4 시나리오별 primitive 매핑표

아래 매핑은 "사용자 요청을 들었을 때 Narre가 어떤 primitive 조합으로 내려가야 하는가"를 리더 관점에서 검토하기 쉽게 정리한 것이다.

#### 1. 타입 분류 초안을 잡아달라는 요청

- 사용자가 기대하는 결과:  
  도메인의 주요 종류를 archetype 단위로 나눈 초안
- Narre의 1차 해석:  
  schema 설계 + 필요 시 type group organization
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Schema Mutation`
- 중심 descriptor:  
  field descriptor보다 archetype 분류 기준과 group 구조
- 짧게 확인해야 하는 분기:  
  사용자가 말한 항목이 archetype인지, 단순 선택값인지, 표시용 카테고리인지 애매할 때

#### 2. 특정 archetype의 필드 구조를 만들거나 고치는 요청

- 사용자가 기대하는 결과:  
  해당 archetype이 가져야 할 속성 구조
- Narre의 1차 해석:  
  schema 설계
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Schema Mutation`
- 중심 descriptor:  
  `Field Contract Descriptor`
- 짧게 확인해야 하는 분기:  
  scalar field인지, 관계형 field인지, single인지 multi인지가 구조적으로 갈릴 때

#### 3. "A마다 B가 있다" 같은 typed reference 요청

- 사용자가 기대하는 결과:  
  A가 B 구조를 자기 일부처럼 가지는 typed relation
- Narre의 1차 해석:  
  typed archetype reference
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Schema Mutation`, `Instance Discovery`
- 중심 descriptor:  
  `Field Contract Descriptor`, `Value Binding Descriptor`
- 짧게 확인해야 하는 분기:  
  A가 B 하나를 가지는지 여러 개를 가지는지, 필수인지 선택인지, edge가 더 맞는지 애매할 때

#### 4. "등록된 B 중에서 고르게" 하는 instance-backed choice 요청

- 사용자가 기대하는 결과:  
  고정 문자열이 아니라 실제 객체 집합을 옵션으로 사용하는 선택 구조
- Narre의 1차 해석:  
  instance-backed choice
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Schema Mutation`, `Candidate Source Discovery`, `Instance Discovery`, `Instance Mutation`
- 중심 descriptor:  
  `Field Contract Descriptor`, `Option Source Descriptor`, `Value Binding Descriptor`
- 짧게 확인해야 하는 분기:  
  enum이면 충분한지, 실제 객체를 옵션 소스로 써야 하는지, 단일 선택인지 다중 선택인지 애매할 때

#### 5. 사용자가 field와 edge를 섞어 말하는 요청

- 사용자가 기대하는 결과:  
  두 대상 사이의 관계가 추적 가능하고 수정 가능한 형태로 존재
- Narre의 1차 해석:  
  schema relation 후보와 graph relation 후보를 함께 비교
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Graph Discovery and Mutation`
- 중심 descriptor:  
  필요 시 `Field Contract Descriptor`, 그렇지 않으면 relation type과 edge 규약
- 짧게 확인해야 하는 분기:  
  결과가 "폼에서 값처럼 다뤄야 하는가" 아니면 "독립된 두 객체 간 관계여야 하는가"가 갈릴 때

#### 6. 기존 객체가 이미 있는 상태에서 구조를 붙이는 요청

- 사용자가 기대하는 결과:  
  기존 데이터를 버리지 않고 schema를 강화하는 것
- Narre의 1차 해석:  
  schema evolution + migration
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Instance Discovery`, `Schema Mutation`, `Instance Mutation`
- 중심 descriptor:  
  `Field Contract Descriptor`, `Value Binding Descriptor`
- 짧게 확인해야 하는 분기:  
  자동 이관이 가능한지, 빈값 허용인지, 수동 보정이 필요한지 애매할 때

#### 7. 구조를 합치거나 쪼개는 refactor 요청

- 사용자가 기대하는 결과:  
  더 자연스러운 schema 구조로 재편하되 기존 의미를 잃지 않는 것
- Narre의 1차 해석:  
  schema refactor + migration
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Instance Discovery`, `Schema Mutation`, `Instance Mutation`
- 중심 descriptor:  
  `Field Contract Descriptor`, `Option Source Descriptor`, `Value Binding Descriptor`
- 짧게 확인해야 하는 분기:  
  merge인지 split인지, 기존 값 보존 방식이 무엇인지, 파괴적 변경이 있는지 애매할 때

#### 8. schema와 network/view를 섞어 말하는 요청

- 사용자가 기대하는 결과:  
  구조와 탐색 방식이 함께 맞춰지기를 기대
- Narre의 1차 해석:  
  schema 작업과 network/view 작업을 분리해서 병행
- 주로 필요한 primitive family:  
  `Schema Discovery`, `Schema Mutation`, `Graph Discovery and Mutation`
- 중심 descriptor:  
  schema 쪽은 `Field Contract Descriptor`, 표현 쪽은 network/node/edge 배치 규약
- 짧게 확인해야 하는 분기:  
  사용자가 말한 "밑에 보이게"가 진짜 데이터 관계인지 단순 표현 구조인지 애매할 때

### 8.5 구조적 모호성 확인 정책

Narre는 "모르면 전부 질문"하는 방식으로 동작하면 안 된다.  
반대로 구조적 의미가 크게 갈리는 요청을 임의로 확정해서도 안 된다.

확인 정책은 아래 세 층으로 운영한다.

#### A. 바로 진행해도 되는 경우

- 사용자의 의도가 특정 primitive로 거의 수렴하고 있다.
- 변경이 국소적이고 되돌리기 쉽다.
- 기존 데이터에 파괴적 영향이 없다.

예:

- optional scalar field를 하나 추가하는 경우
- archetype 초안을 제안하고 아직 확정 저장 전인 경우
- 현재 값만 국소적으로 수정하는 경우

#### B. 짧게 확인하고 진행해야 하는 경우

- 해석 분기에 따라 schema 의미가 달라진다.
- migration 비용이 바뀐다.
- field와 edge처럼 사용자 기대 결과가 달라질 수 있다.

대표 분기:

- field vs edge
- enum vs instance-backed choice
- single vs multi
- required vs optional
- 공통 archetype 추출 vs 단순 field 복제
- schema 변경 vs network/view만 변경

이 경우 질문은 내부 구현 용어가 아니라 결과 언어로 해야 한다.

예:

- "각 캐릭터가 하나의 스탯 시트를 가지는 구조로 만들까?"
- "장비를 문자열 목록이 아니라 실제 아이템 객체들 중에서 고르는 구조로 이해했어. 이 구조로 갈까?"

#### C. 반드시 확인해야 하는 경우

- 기존 데이터를 삭제하거나 덮어쓸 수 있다.
- merge/split/refactor로 기존 concept의 의미가 달라진다.
- 대량 migration이 필요하다.
- 사용자가 기대하는 결과가 둘 이상으로 크게 갈리고, 어느 쪽도 명백히 우세하지 않다.

예:

- 기존 enum 값을 instance-backed choice로 승격하면서 자동 변환 규칙이 필요한 경우
- archetype을 둘로 쪼개면서 기존 concept들을 재배치해야 하는 경우
- edge로 존재하던 관계를 field 구조로 흡수하는 경우

### 8.6 Narre 추론 모델과 MCP surface는 분리되어야 한다

Narre는 풍부한 자연어를 더 풍부한 해석 모델로 바꿔야 한다.

예:

- "캐릭터마다 스탯이 있어"
- "캐릭터는 아이템을 장착해"
- "직업별로 선택 가능한 스킬이 달라"
- "아이템은 소모품과 장비로 나뉘어"

이 해석은 계속 정교해질 수 있다.

하지만 MCP까지 이 정교함을 그대로 반영하면 tool이 계속 증식한다.

따라서 분리 원칙은 이렇다.

- Narre 내부: 풍부한 시나리오 해석
- MCP 외부 계약: 소수의 공통 primitive

즉 새 기능이 생길 때 바뀌어야 하는 곳의 우선순위는 보통 아래 순서다.

1. 해석 규칙
2. prompt
3. descriptor schema
4. discovery/mutation implementation
5. tool 추가는 최후의 수단

### 8.7 이번 phase에서 제외하는 MCP 축

- module CRUD
- context CRUD
- module 기반 권한/책임 제어
- context 기반 작업 프레임 편집

## 9. Prompt 설계 원칙

### 9.1 사용자 언어를 내부 용어보다 우선한다

Narre는 먼저 이렇게 생각해야 한다.

- 사용자가 무엇을 하고 싶어 하는가
- 사용자가 기대하는 관계는 어떤 종류인가
- 이걸 field, choice, edge, group, network 중 무엇으로 표현해야 하는가

다음 질문은 바로 하지 않는다.

- "`archetype_ref`로 만들까?"
- "relation type으로 만들까?"

먼저 이렇게 요약한다.

- "각 캐릭터가 하나의 스탯 시트를 가지는 구조로 이해했어"
- "장비는 실제 아이템 객체들 중에서 고르는 구조로 이해했어"

### 9.2 구조적 모호성만 짧게 확인한다

모든 애매함을 질문으로 돌리면 안 된다.

짧게 확인해야 하는 경우:

- field와 edge가 둘 다 가능한데 구조 차이가 큰 경우
- single과 multi가 바뀌면 schema 영향이 큰 경우
- enum과 instance-backed choice가 뒤바뀌면 migration 비용이 큰 경우
- 기존 데이터를 깨뜨릴 수 있는 refactor인 경우

### 9.3 Prompt가 강제해야 하는 기본 판단 순서

system/task prompt는 Narre에게 아래 순서를 강제해야 한다.

1. 요청을 schema / instance / graph / organization / network-view 중 어디에 속하는지 판단한다.
2. schema라면 scalar / typed reference / instance-backed choice 중 무엇인지 판단한다.
3. cardinality와 optionality를 추론한다.
4. low-risk면 제안하고, high-impact면 짧게 확인한다.
5. 사용자의 결과 언어로 다시 설명한다.

### 9.4 이번 phase에서 prompt가 명시해야 할 금지 사항

- module을 agent가 생성/관리 대상으로 다루지 말 것
- context를 agent가 생성/관리 대상으로 다루지 말 것
- 사용자가 edge를 기대하는 상황을 무조건 field로 축소하지 말 것
- 반대로 field를 기대하는 상황을 무조건 relation type으로 밀지 말 것

### 9.5 Prompt는 tool 나열보다 primitive 사고를 강제해야 한다

prompt는 agent에게 다음 사고방식을 강제해야 한다.

- "새 관계 유형이니까 새 기능으로 생각한다"가 아니라
- "이 요구는 기존 primitive 중 어디에 해당하는가"를 먼저 생각한다

예:

- typed reference는 field contract + value binding 문제다
- instance-backed choice는 field contract + option source + candidate discovery 문제다
- graph edge는 graph mutation 문제다

이렇게 해야 모델이 고도화되어도 Narre의 사고가 stable해진다.

## 10. Mention/Search 설계 원칙

이번 phase의 mention/search는 다음에 집중한다.

- concept
- archetype
- relation type
- project
- network

필요 시 향후 확장 후보:

- type group

이번 phase에서 제외:

- module
- context

중요한 것은 단순 mention 대상 수를 늘리는 것이 아니라, 현재 작업 대상 concept와 관련된 후보를 좁혀서 찾을 수 있게 하는 것이다.

예:

- `Character.equipment`를 수정하는 순간 `Item` archetype 기반 후보 concept 조회가 쉬워야 한다.
- `Character.stats`를 수정하는 순간 `Stats` archetype 기반 후보 concept 조회가 쉬워야 한다.

## 11. 발전 가능한 설계의 기준

이번 문서는 "이번에 되는 것"보다 "앞으로 고도화되어도 구조가 버티는가"를 더 중요하게 본다.

좋은 설계는 다음 기준을 만족해야 한다.

### 11.1 새 관계 유형이 생겨도 우선 descriptor 확장으로 흡수된다

다음이 우선순위다.

1. field contract 확장
2. option source 확장
3. candidate discovery 확장
4. value binding 확장
5. 그래도 안 되면 tool 추가 검토

### 11.2 tool 수보다 semantic coverage가 중요하다

좋은 MCP는 tool이 많아서 강한 것이 아니라,

- 적은 primitive로
- 더 많은 사용자 기대를
- 안정적으로 표현할 수 있어야 한다.

### 11.3 변경 비용은 국소적이어야 한다

새 관계형 기능이 들어올 때 다음 중 두세 군데만 바뀌는 것이 이상적이다.

- prompt 해석 규칙
- descriptor schema
- 후보 집합 조회 로직

반대로 다음이 매번 다 바뀌면 실패다.

- 새 tool 이름
- 새 payload 형식
- 새 mention 종류
- 새 세션 계약

## 12. Eval 설계 원칙

이번 phase의 eval은 CRUD 수보다 해석 정확도를 더 봐야 한다.

필수 시나리오:

- archetype 분류 초안 만들기
- archetype field 설계
- `Character -> Stats` typed reference 생성
- `Character -> Item` instance-backed choice 생성
- field와 edge를 올바르게 구분하는지 검증
- single/multi/optional을 올바르게 반영하는지 검증
- 기존 concept에 새 구조를 붙이는 migration 시나리오
- type group 정리 시나리오
- network hierarchy와 schema 요청을 섞어 말하는 시나리오

평가 포인트:

- 사용자의 내적 기대를 올바르게 추론했는가
- 내부 구현 용어를 강요하지 않았는가
- field와 edge를 혼동하지 않았는가
- enum과 instance-backed choice를 혼동하지 않았는가
- 구조 변경 시 적절한 확인을 했는가

추가 평가 포인트:

- 같은 요구를 기존 primitive family 안에서 해결하려고 했는가
- 새 관계 유형을 전용 기능처럼 다루지 않고 descriptor 수준에서 해석했는가
- tool 증식 없이 semantic coverage를 유지했는가

## 13. 이번 phase의 설계 결론

이번 phase의 중심은 단순한 tool inventory가 아니다.

중심은 다음이다.

- 사용자 자연어 시나리오의 분류
- 그 시나리오에서 사용자가 내적으로 기대하는 관계의 추론
- 그 추론을 지탱하는 session context
- 그 추론을 실행 가능한 작업으로 바꾸는 MCP 일반화
- 그 추론이 안정적으로 작동하도록 하는 prompt 설계
- 그 일반화가 앞으로도 버티도록 하는 primitive family 설계

따라서 이후 설계의 순서는 다음이 된다.

1. 사용 시나리오를 기준으로 관계 해석 모델을 고정한다.
2. 그 관계 해석 모델에서 필요한 primitive family를 정한다.
3. primitive family 위에서 descriptor contract를 설계한다.
4. 그 contract를 만족하는 MCP tool family를 설계한다.
5. 그 판단 순서를 강제하는 prompt를 설계한다.
6. 그 해석 정확도와 공통화 수준을 검증하는 eval을 설계한다.

## 14. 다음 단계

이 문서를 기준으로 다음 문서나 구현은 아래 순서로 이어진다.

1. primitive family 중심 MCP 일반화 설계
2. field contract / option source / value binding descriptor 설계
3. Narre system prompt와 task prompt 재설계
4. session context contract 구체화
5. mention/search 설계 구체화
6. eval scenario 설계

이 문서가 먼저 고정되어야, route-first 방식이 아니라 scenario-first 방식으로 Narre를 설계할 수 있다.
