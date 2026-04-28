# Next Phase 종합 설계 메모

## 목적

이 문서는 이번 세션에서 논의한 Netior의 다음 Phase 방향을 한 문서로 종합 정리한 메모다.

이 문서는 구현 명세가 아니다.
다음 설계 단계로 넘어가기 전에, 상위 구조와 핵심 결정, 중요한 원칙, 아직 남아 있는 질문을 한 번에 붙잡기 위한 문서다.

특히 다음 내용을 함께 정리한다.

- 왜 `Canvas`에서 `Network`로 전환하는가
- 다음 Phase의 최상위 구조는 무엇인가
- `App Root Network`, `Project Root Network`, `sub-network`, `context`는 어떻게 다른가
- node는 어떻게 바뀌어야 하는가
- 타입 체계는 어떻게 정리되는가
- 왜 feedback loop가 핵심 원리인가

## 1. 핵심 전환: Canvas 앱에서 Network Editor로

다음 Phase에서 Netior는 더 이상 canvas 중심 앱으로 설명되지 않는다.

이전 모델은 대략 다음과 같았다.

- canvas를 트리처럼 구성한다
- canvas 위에 concept를 배치한다
- concept node가 하위 canvas로 들어가는 포탈 역할을 한다

이 구조는 초기 출발점으로는 유효했다.
하지만 다음 Phase로 가면 한계가 분명해진다.

- concept가 너무 많은 책임을 갖게 된다
- 구조 진입이 concept에 과도하게 종속된다
- concept 외의 주요 객체를 다루기 어렵다
- 결국 “concept를 담는 board”에 머물 위험이 있다

다음 Phase의 핵심 전환은 이것이다.

> Netior는 canvas들의 트리를 다루는 앱이 아니라, network를 편집하는 앱이다.

따라서 사용자에게 보이는 핵심 작업면 자체를 `Network`로 이해해야 한다.
즉 사용자는 “캔버스를 연다”가 아니라 “네트워크를 연다”, “네트워크를 편집한다”, “네트워크를 탐색한다”고 느껴야 한다.

이것은 단순한 용어 변경이 아니다.
무엇을 편집하는 제품인가에 대한 인식 자체를 바꾸는 일이다.

## 2. Network의 의미

다음 Phase에서 `Network`는 단순 시각화 그래프가 아니다.

Network는 다음을 함께 뜻한다.

- 객체와 관계가 존재하는 구조 공간
- 사용자가 작업하는 편집 공간
- 의미, 탐색, 추상화, 구조 전환이 일어나는 작업면

즉 network는 “선을 많이 보여주는 화면”이 아니다.
Netior가 편집하는 핵심 대상 그 자체다.

## 3. Root Network 구조

다음 Phase에서는 최소 두 종류의 루트 네트워크가 필요하다.

### 3.1 App Root Network

앱 전체 차원의 최상위 network다.

이곳에서는 앱 전역 혹은 프로젝트 간 구조를 다룰 수 있어야 한다.

- 프로젝트 간 관계
- cross-project 구조
- 전역 agent
- 공용 타입 체계 후보
- 개인 전체 지식 구조

App Root Network는 “프로젝트 목록 화면”이 아니라,
프로젝트를 포함한 더 큰 지식 공간의 진입점이다.

### 3.2 Project Root Network

각 프로젝트 내부의 최상위 network다.

이곳은 해당 프로젝트의 로컬 루트이자 주된 진입면이다.

- concept
- context
- agent
- schema
- relation type
- sub-network
- 프로젝트 고유 ontology

Project Root Network는 단순 폴더 루트의 시각화가 아니라,
프로젝트 내부 지식 구조의 최상위 작업 공간이어야 한다.

## 4. 계층 구조에 대한 입장

`root network -> sub-network` 구조는 유효하다.
하지만 그것을 존재론의 본질로 두면 다시 트리 모델로 회귀할 위험이 있다.

더 맞는 해석은 다음과 같다.

- 실제 지식 구조는 하나의 큰 network에 가깝다
- hierarchy는 인간이 작업하기 위해 network를 조직하는 방식이다

즉 sub-network는 “실제 세계가 트리다”라는 뜻이 아니라,
“우리가 이 network를 그렇게 잘라서 다루고 있다”는 뜻에 가깝다.

## 5. Context

이번 논의에서 가장 중요한 개념 중 하나가 `context`다.

현재 작업 정의는 다음과 같다.

> Context는 전체 관계 공간에서 특정 상황에 활성화되는 관계 부분집합이다.

그리고 context를 설명하는 핵심 문장은 이렇다.

> 중요한 것은 연결의 총량이 아니라, 특정 상황에서 어떤 관계 집합을 활성화하느냐이다.

이 문장은 Netior의 방향을 매우 잘 드러낸다.

### 5.1 Context가 필요한 이유

context는 다음을 위해 필요하다.

- agent가 어디서부터 어디까지를 봐야 하는지 정하는 것
- 같은 객체를 다른 관점에서 재구성하는 것
- 상위 구조를 유지하면서 하위 구현을 바꾸는 것
- 전체 network가 아니라 작업 목적에 맞는 의미 범위를 활성화하는 것

즉 context는 단순 필터가 아니다.
작업 범위와 우선순위를 정하는 메타인지적 프레임에 가깝다.

### 5.2 현재 결정

현재 단계에서는 context의 데이터 모델에서 `배치 정보는 뺀다`.

즉 context는 기본적으로:

- 의미
- 범위
- 관점
- 우선순위

의 계층으로 본다.

배치는 network/sub-network 또는 별도의 표현 계층에서 다루는 쪽으로 정리한다.

## 6. Sub-network와 Context의 차이

둘 다 전체 network의 일부를 다룬다는 점에서는 비슷해 보일 수 있다.
하지만 역할은 다르다.

### 6.1 Sub-network

sub-network는 **지속적으로 유지·편집되는 구조 단위**다.

또한 sub-network는 배치 정보를 가진다.

- 어떤 노드가 보이는가
- 노드가 어디에 위치하는가
- 엣지가 어떻게 보이는가
- 하나의 작업면으로서 어떻게 편집되는가

즉 sub-network는 배치된 작업 공간이다.

### 6.2 Context

context는 **특정 목적에 따라 활성화되는 의미 프레임**이다.

즉:

- 무엇이 중요한가
- 어떤 관계를 우선적으로 볼 것인가
- 무엇을 지금은 뒤로 미룰 것인가

를 정한다.

### 6.3 한 줄 구분

- `sub-network`는 구조를 따로 편집하는 작업 공간이다
- `context`는 같은 구조를 어떤 프레임으로 읽을지 정하는 방식이다

## 7. Portal과 탐색 규칙

다음 Phase에서는 모든 node가 탐색 진입점이 되는 구조를 지향하지 않는다.

현재까지 정리된 원칙은 다음과 같다.

- `sub-network`를 가지는 node만 entry가 될 수 있다
- 기본적으로 network 탐색은 `network node`를 통해서만 일어난다
- 예외적으로 `project node`는 `Project Root Network`로 들어가는 entry가 될 수 있다

반대로:

- `context`는 entry 대상이 아니다
- `concept`도 기본적으로 entry 대상이 아니다

즉 기존의 `concept portal` 구조는 다음 Phase에서 버린다.

concept는 관계 객체이지, 탐색 책임을 가진 구조 entry가 아니다.

## 8. Network 안에서 다룰 객체

다음 Phase의 network는 concept만 놓는 공간이 아니어야 한다.

지금까지 후보로 나온 주요 객체는 다음과 같다.

- project
- network
- context
- concept
- schema
- relation type
- agent
- file
- edge

이 중 무엇을 첫 단계에서 node로 직접 다룰지는 별도 논의가 필요하지만,
방향 자체는 분명하다.

> network는 concept-only board가 아니라 typed object workspace여야 한다.

## 9. Node 방향

다음 Phase의 node는 더 이상 concept-only card가 아니다.

핵심 전환은 다음과 같다.

- concept card 중심 구조에서
- typed entity node 중심 구조로 전환한다

이 말은 “모든 node가 똑같은 박스다”라는 뜻이 아니다.
오히려 각 객체는 network 안에서 더 풍부한 방식으로 표현될 수 있어야 한다.

## 10. Node는 정적 UI가 아니다

이번 논의에서 매우 중요했던 원칙 중 하나는 이것이다.

> node는 정적인 카드가 아니라, network 안에서 상호작용 가능한 UI여야 한다.

이 원칙이 중요한 이유는 sub-network의 남용을 막기 위해서다.

만약 node가 너무 정적이면:

- 정보가 조금만 많아져도
- 표현력이 부족해지고
- 곧바로 sub-network로 빼야 하는 압박이 생긴다

그러면 sub-network는 구조적 이유가 아니라 UI 한계를 보완하는 우회 수단이 된다.
이것은 피해야 한다.

따라서 다음 Phase의 node는:

- 정적 박스가 아니어야 하고
- 타입마다 다른 interaction model을 가질 수 있어야 하며
- 한 network 안에서 충분한 표현력과 조작성을 제공해야 한다

중요한 점은 모든 node가 `expanded/collapsed` 같은 동일한 상태를 갖는다는 뜻이 아니라는 것이다.

오히려:

- 어떤 node는 summary/detail 전환
- 어떤 node는 상태 표시
- 어떤 node는 inline editing
- 어떤 node는 preview/inspect
- 어떤 node는 drag-and-drop collection interaction

처럼 서로 다른 상호작용을 가질 수 있다.

## 11. NodeType과 Network Object Type의 분리

이번 세션에서 가장 중요한 정리 중 하나가 이것이다.

`노드 타입`은 `네트워크 객체 타입`과 1:1이 아니다.

둘은 다른 층이다.

### 11.1 Network Object Type

객체가 시스템 안에서 무엇인지를 말한다.

예:

- network
- project
- schema
- relation type
- concept
- edge
- agent
- context

즉 존재론적 분류다.

### 11.2 NodeType

같은 객체를 network UI 위에서 어떻게 표현하고 어떤 상호작용을 줄지를 말한다.

즉 UI 표현과 인터랙션의 분류다.

같은 concept도 어떤 network에서는 summary node, 어떤 network에서는 detail node로 보일 수 있다.
반대로 같은 node type이 여러 객체 타입에 재사용될 수도 있다.

## 12. NodeType 후보군

이번 세션에서 나온 node type 후보군은 다음과 같다.

- Summary Node
- Detail Node
- Portal Node
- Status Node
- Inspector Node
- Editor Node
- Collection Node

### 12.1 Collection Node의 중요성

Collection Node는 후보가 아니라 거의 필수 타입으로 봐야 한다.

특히 소설 도메인에서:

- 캐릭터
- 세력
- 왕실기사단
- 종족
- 조직

같은 집합적 객체를 다룰 때 box 형태의 node가 필요하다.
그리고 다른 node를 drag and drop으로 내부에 넣을 수 있어야 한다.

즉 Collection Node는 단순 박스가 아니라:

- 집합/소속 구조를 한 network 안에서 표현하고
- 불필요한 sub-network 분리를 줄이며
- 하나의 network 안의 표현력을 높이는 핵심 UI

로 이해해야 한다.

## 13. 타입 체계 정리

이번 논의에서 타입 체계는 다음 네 층으로 정리되었다.

### 13.1 Network Object Type

네트워크 안에서 존재하는 객체의 분류다.

예:

- network
- project
- schema
- relation type
- concept
- edge
- agent
- context

### 13.2 NodeType

network UI에서 객체를 어떻게 보여주고 상호작용할지에 대한 타입이다.
순수 UI 계층이다.

### 13.3 User Type

사용자가 자신의 도메인 ontology를 위해 정의하는 타입이다.

예:

- character
- faction
- chapter
- protein
- hypothesis

현재 구현 축으로 보면 `schema`, `relation type`이 여기에 가까운 역할을 한다.

### 13.3.1 User Type 간 참조 (계층적 구성)

User Type은 서로를 참조할 수 있어야 한다.

예를 들어 판타지 소설 도메인에서:

- `캐릭터` schema을 정의한다
- `스탯` schema을 정의한다
- `캐릭터`의 필드 중 하나가 `스탯` schema을 참조해야 한다

현재 schema field는 text, number, select 등 브라우저 기반 primitive input만 지원한다.
하지만 실제 도메인 모델링에서는 schema이 다른 schema을 포함하는 구조가 자연스럽다.

따라서 schema field type에 `schema 참조`가 추가되어야 한다.
즉 field가 가리키는 대상이 primitive 값이 아니라 특정 schema의 인스턴스(concept)가 되는 경우를 지원해야 한다.

이것은 단순한 기능 추가가 아니라, User Type 체계가 계층적 구성을 가질 수 있다는 구조적 전환이다.

### 13.3.2 User Type 그룹화 (폴더)

schema, relation type, network type 등 사용자 정의 타입이 늘어나면 flat list로는 관리가 어렵다.

이 타입 객체들을 그룹화할 수 있는 폴더 구조가 필요하다.

예를 들어:

- schema 폴더: `캐릭터 관련` / `세계관 관련` / `스토리 구조`
- relation type 폴더: `인물 관계` / `조직 관계` / `인과 관계`

이것은 타입 정의의 ontology 자체가 아니라 관리 편의를 위한 조직 구조다.
하지만 타입이 수십 개 이상 늘어나는 도메인에서는 사실상 필수적이다.

### 13.4 Relation Meaning

원래는 `System Type`으로 부르려 했지만, 현재 논의상 더 정확한 표현은 `Relation Meaning`다.

이것은 타입이라기보다 앱 내부 동작 규약 계층이다.

즉 사용자가 어떤 타입을 정의하든, 앱은 그것을 어떤 계약과 제약 아래에서 해석하고 동작해야 한다.

예를 들어 다음과 같은 계약이 될 수 있다.

- 이 객체는 container처럼 동작하는가
- 이 객체는 network entry가 될 수 있는가
- 이 객체는 relation endpoint가 될 수 있는가
- 이 객체는 groupable한가
- 이 객체는 editable한가

즉 정리하면:

- `Network Object Type` = 존재론
- `NodeType` = UI 표현/상호작용
- `User Type` = 도메인 정의
- `Relation Meaning` = 앱 동작 규약

## 14. Relation Meaning가 중요한 이유

이 계층이 필요한 이유는 다음과 같다.

- 모든 타입을 시스템이 고정하면 도메인 독립성이 사라진다
- 모든 타입을 사용자 정의에 맡기면 앱이 스스로를 이해하지 못한다

그래서 Netior는:

- 사용자가 자유롭게 정의하는 domain layer
- 앱이 기본적으로 이해해야 하는 contract layer

를 동시에 가져야 한다.

이 구조는 특히 user type과 relation type이 늘어날수록 중요해진다.

## 15. Feedback Loop 원리

이번 논의에서 또 하나 중요했던 것은 `feedback loop`다.

다음 Phase의 network는 단순히 잘 정리된 구조여서는 안 된다.
그 network를 통해 **무엇이 가능해지는지**, 그리고 그것이 **실제로 얼마나 유효한지**가 판단 가능해야 한다.

핵심 원리는 다음과 같다.

> 좋은 network란 예쁘게 정리된 network가 아니라, 더 나은 작업과 더 나은 판단을 실제로 만들어내는 network다.

즉 network는 이런 루프 안에 있어야 한다.

1. 구조를 만든다
2. 실제 작업에 사용한다
3. 무엇이 가능해지고 무엇이 실패하는지 본다
4. 그 결과를 바탕으로 구조를 바꾼다

이 원리가 중요한 이유는:

- 어떤 객체를 추가할지 뺄지 판단할 기준이 생기고
- 어떤 관계가 실제로 유용한지 평가할 수 있으며
- 구조가 정적 분류 체계가 아니라 계속 리팩터링되는 작업 구조가 되기 때문이다

## 16. Context와 Agent

이번 세션의 출발점 중 하나는 agent를 위한 더 나은 구조였다.

중요한 인식은 다음과 같다.

- agent는 전체 network를 다 올려서 잘 일할 수 없다
- 중요한 것은 적절한 context를 주는 것이다
- context는 agent에게 작업 범위와 관계 우선순위를 제공한다

즉 Netior는 단순히 파일을 많이 주는 시스템이 아니라,
agent에게 더 나은 작업 프레임을 전달하는 시스템을 지향한다.

## 17. 다음 세부 설계로 이어질 질문

이번 세션으로 많은 것이 정리되었지만, 아직 다음 설계 단계에서 다뤄야 할 질문도 남아 있다.

### 17.1 Root Network

- App Root Network와 Project Root Network의 관계를 구체적으로 어떻게 둘 것인가
- sub-network를 언제 만들어야 하는가
- network 간 이동 UX를 어떻게 설계할 것인가

### 17.1.1 User Type 확장

- schema field type에 schema 참조를 어떤 형태로 추가할 것인가
- schema 간 참조의 깊이 제한이 필요한가
- 순환 참조를 허용할 것인가
- 타입 객체 폴더의 데이터 모델을 어떻게 설계할 것인가
- 폴더가 단순 UI 그룹인가, 의미 구조인가

### 17.2 Node

- 어떤 객체를 1차로 node화할 것인가
- 어떤 node type을 초기 버전에 포함할 것인가
- object type과 node type의 매핑을 어떻게 설계할 것인가
- Collection Node가 ontology와 어떻게 연결되는가

### 17.3 Relation Meaning

- 최소 어떤 contract부터 시작할 것인가
- entry, container, editable, relation-bearing 같은 계약을 어디까지 둘 것인가

### 17.4 기존 구조의 정리

- 현재 canvas 개념을 실제 마이그레이션에서 어떻게 걷어낼 것인가
- CanvasType을 어떻게 폐기/대체할 것인가
- concept-only node 구조를 어떻게 일반화할 것인가

## 18. 종합 요약

다음 Phase의 Netior는 더 이상 concept를 담는 canvas들의 트리로 설명되지 않는다.
대신 App Root Network와 Project Root Network를 중심으로, 다양한 객체와 관계를 다루는 network editor로 전환한다.

이 과정에서:

- `Canvas`는 최상위 개념에서 빠지고 `Network`가 중심이 되며
- `sub-network`는 배치된 작업 공간으로 남고
- `context`는 배치가 아닌 의미 프레임으로 다뤄지고
- `concept portal` 구조는 버려지며
- `network node`가 기본 탐색 entry가 되고
- `typed entity node`가 중심이 되며
- `node`는 정적 카드가 아니라 타입별 상호작용을 가진 network-native UI가 되어야 한다

또한 타입 체계는 다음 네 층으로 정리된다.

- Network Object Type
- NodeType
- User Type
- Relation Meaning

그리고 전체 구조는 반드시 feedback loop 안에서 평가되어야 한다.

즉 다음 Phase의 핵심은 단순한 UI 교체가 아니라:

> Netior를 canvas 기반 concept board에서, 구조와 의미, 작업과 피드백을 함께 다루는 network editor로 재정의하는 것이다.
