# Network Object 도메인 정의 초안

## 목적

이 문서는 Netior의 `network object`를 구현 이전의 도메인 개념으로 정의하기 위한 초안이다.

여기서 중요한 것은 데이터 구조나 UI 세부사항이 아니라, Netior가 자신의 작업 세계를 어떤 존재들로 나누어 이해하는가이다.

즉 이 문서는:

- Netior 안에서 무엇이 독립된 존재로 취급되는가
- 그 존재들은 서로 어떤 층위에서 구분되는가
- 각 존재는 작업 세계 안에서 어떤 역할을 맡는가

를 정리하려는 문서다.

## 1. 핵심 정의

`Network Object`는 Netior의 network 안에서 독립된 존재로 취급될 수 있는 기본 단위다.

조금 더 풀어 말하면, 다음 조건을 만족할 때 어떤 것은 `network object`가 된다.

- 독립적으로 이름 붙일 수 있다
- 다른 것들과 관계를 맺을 수 있다
- 특정 맥락 안에서 다시 읽힐 수 있다
- 사용자의 작업과 판단의 초점이 될 수 있다

따라서 `network object`는 카드, 노드, 패널 같은 표현 방식보다 먼저 존재하는 개념이다.
표현은 object를 드러내는 방식일 뿐이며, object 자체는 그보다 앞선 의미 단위다.

이 관점에서 Netior의 방향은 분명하다.

> Netior는 concept만 배치하는 보드가 아니라, 서로 다른 종류의 존재들을 함께 다루는 typed object workspace를 지향한다.

## 2. 왜 필요한가

초기 모델에서는 `concept`가 너무 많은 책임을 떠안기 쉬웠다.

- 의미 단위이기도 하고
- 구조 진입점이기도 하며
- 하위 공간으로 들어가는 포털이기도 하고
- 다른 객체를 대신해 네트워크에 등장하는 대표자 역할도 맡게 된다

이 구조는 concept를 과도하게 특권화한다.

하지만 실제 작업 세계에서는 `concept`만 중요한 것이 아니다.

- 프로젝트 자체도 작업의 대상이 된다
- 관계의 종류도 정의 대상이 된다
- 맥락도 별도의 의미 프레임으로 다뤄진다
- 파일도 근거와 산출물의 단위로 중요하다
- 구조적 작업 공간인 network 자체도 객체가 된다

따라서 Netior는 concept 하나를 중심으로 모든 것을 접어 넣는 대신, 서로 다른 존재 양식을 가진 객체들을 같은 평면 위에서 다룰 필요가 있다.
그 공통 자격이 바로 `network object`다.

## 3. 객체별 정의

### 3.1 Project

`Project`는 하나의 작업 세계에 대한 가장 큰 경계다.

프로젝트는 단순한 파일 묶음이 아니라:

- 무엇이 이 세계에 속하는가
- 무엇을 내가 지속적으로 책임질 것인가
- 어떤 로컬한 ontology와 작업 규칙이 이 안에서 유효한가

를 정하는 단위다.

즉 `project`는 저장 위치보다 세계의 범위를 정하는 객체다.

### 3.2 Network

`Network`는 객체와 관계를 특정 문제의식 아래 배열하고 읽기 위한 작업 장면이다.

network는 단순히 선이 많은 그래프 화면이 아니다.
그것은:

- 의미가 드러나는 장
- 편집이 일어나는 장
- 구조를 재배열하는 장
- 탐색과 추상화가 일어나는 장

이다.

이때 중요한 구분은 다음과 같다.

- `sub-network`는 지속적으로 유지되고 편집되는 구조적 작업 공간이다
- `context`는 같은 구조를 어떤 목적 아래 읽을지를 정하는 의미 프레임이다

즉 network 계층은 세계를 잘게 쪼갠 존재론이 아니라, 작업을 조직하기 위한 구조다.

### 3.3 Concept

`Concept`는 이름 붙이고 구별하고 발전시킬 수 있는 기본 의미 단위다.

concept는:

- 사유의 대상이 되고
- 관계의 중심이 되며
- 다른 객체들과 연결되면서 의미망을 형성한다

다만 다음 phase의 철학에서 concept는 더 이상 특권적 구조 entry가 아니다.
concept는 중요한 객체이지만, 탐색 책임을 본질적으로 떠안는 객체는 아니다.

즉 concept의 핵심은 구조 진입점이 되는 것이 아니라, 의미 단위로 존재하는 것이다.

### 3.4 Schema

`Schema`은 어떤 객체가 무엇으로 읽혀야 하는지를 정하는 사용자 정의 타입이다.

schema은 단순 분류 태그가 아니다.
그것은 객체의 해석 틀이다.

schema은 적어도 다음 역할을 가진다.

- 어떤 속성들이 중요한가를 정한다
- 그 객체를 어떤 종류의 존재로 읽을지 정한다
- 같은 종류의 객체들 사이에 공통 형식을 부여한다
- 객체가 어떤 대표적 모습과 서술 양식을 가질지 규정할 수 있다

여기에 `model` 개념이 들어오면 schema은 한 층 더 분화된다.

- schema의 `이름`은 사용자가 정의하는 도메인 타입이다
- schema의 `model`은 앱이 해석할 수 있는 조합 가능한 의미 모델이다

즉 `task`, `event`, `document` 같은 것은 사용자 도메인 이름이고,
`statusful`, `assignable`, `temporal`, `versioned` 같은 것은 그 schema이 어떤 방식으로 해석되어야 하는지를 앱에 알려 주는 의미 모델이다.

여기서 중요한 점은 다음과 같다.

- model은 뷰 이름이 아니라 의미 모델이어야 한다
- 하나의 schema은 여러 model을 동시에 가질 수 있다
- model은 UI 장식이 아니라 런타임 의미 체계다
- model은 여러 meaning과 meaning slot 요구를 묶어 schema의 속성 구조를 유도할 수 있다

즉 schema은 단순히 “이 객체는 무슨 종류인가”만 정하는 것이 아니라,
“앱이 이 객체를 어떤 의미 체계로 읽어야 하는가”까지 품는 객체가 된다.

특히 schema의 중요한 확장은 `다른 schema을 참조할 수 있다`는 점이다.
이것은 다음과 같은 모델링을 가능하게 한다.

- `캐릭터`가 `스탯`을 참조한다
- `사람`이 `회사`를 참조한다
- `실험`이 `가설`과 `장비`를 참조한다

즉 schema은 primitive 속성 목록에 머무르지 않고, 다른 타입을 참조하는 방식으로 계층적이고 구성적인 도메인 모델을 만들 수 있다.
이 점에서 schema은 ORM의 relation field와 유사한 감각을 갖는다.

따라서 schema은 다음을 함께 아우르는 객체로 보는 편이 맞다.

- 분류 규칙
- model 조합
- meaning key의 선언
- 속성 스키마
- 타입 간 참조 구조
- 대표적 표현 양식
- 기본 문서 골격

### 3.5 Model

`Model`은 사용자 도메인 타입을 앱이 해석 가능한 의미 체계로 연결하는 재사용 가능한 의미 모델이다.

model은 단순 태그나 보기 옵션이 아니다.
그것은:

- 어떤 meaning들이 함께 필요한가
- 그 meaning을 표현하려면 어떤 meaning slot들이 필요한가
- 여러 schema이 공유할 수 있는 의미 패턴이 무엇인가
- agent와 layout plugin이 어떤 안정적인 키를 기준으로 객체를 읽어야 하는가

를 정하는 1급 network object다.

예를 들어 `temporal` model은 객체가 시간 위에서 읽힌다는 뜻을 담고,
그 안에는 `time point`, `duration`, `deadline`, `recurrence` 같은 meaning들이 포함될 수 있다.
각 meaning은 다시 `start_at`, `end_at`, `due_at`, `recurrence_frequency` 같은 meaning slot 요구로 내려간다.

따라서 model의 위치는 다음과 같이 읽는 편이 좋다.

- `schema`은 사용자가 정의한 도메인 타입이다
- `model`은 그 타입을 앱이 어떤 의미 축으로 읽을지 정하는 의미 모델이다
- `meaning`은 model 안에서 실제로 해석되는 의미 단위다
- `meaning slot`은 meaning을 데이터로 읽기 위한 안정적인 필드 키다

model이 network object가 되면 사용자는 model 자체를 이름 붙이고, 설명하고, 관계 맺고, 편집할 수 있다.
또한 ontology network 안에서 model을 schema, relation type, type group과 함께 배치할 수 있으므로 agent도 “이 프로젝트의 의미 체계”를 더 직접적으로 읽을 수 있다.

### 3.6 Relation Type

`Relation Type`은 두 객체가 맺는 연결을 어떤 의미로 읽을지를 정하는 관계의 문법이다.

중요한 것은 relation type이 관계 자체가 아니라, 관계의 종류라는 점이다.

예를 들어:

- 포함한다
- 영향을 준다
- 반박한다
- 소속된다
- 참조한다

같은 것은 각각 relation type이 될 수 있다.

relation type은 단순 이름표가 아니라, 관계를 읽는 방식을 함께 규정한다.
즉 relation type은:

- 관계의 의미를 정하고
- 필요하다면 방향성을 정하며
- 어떤 관계군에 속하는지 조직할 수 있고
- 화면에서 어떤 수사적 강조를 가질지까지 품을 수 있다

따라서 relation type은 의미와 표현이 만나는 관계 규칙 객체다.

### 3.7 Edge

`Edge`는 두 객체 사이에서 실제로 발생한 관계의 한 사례다.

이때 edge는 단순 선이 아니다.
edge에는 적어도 세 층이 겹친다.

- 연결 그 자체
- 그 연결을 어떤 뜻으로 읽을지에 대한 사용자 의미
- 그 연결이 시스템 안에서 어떤 구조적 책임을 가질지에 대한 규약

첫 번째와 두 번째를 구분하기 위해 `relation type`이 필요하다.
`relation type`이 관계의 문법이라면, `edge`는 그 문법이 특정 객체들 사이에서 실제로 실현된 사건이다.

세 번째 층은 `relation meaning`다.
이것은 사용자가 만든 도메인 관계와는 다른 차원이다.
즉 edge는 때로는 “이 둘은 어떤 의미 관계를 맺는다”를 나타내고, 때로는 “이 연결은 시스템 구조상 어떤 계약을 수행한다”를 나타낸다.

현재 드러난 대표 계약은 다음과 같이 읽을 수 있다.

- `contains`: 한 객체가 다른 객체를 구조적으로 포함한다
- `entry_portal`: 이 연결이 탐색 진입 책임을 맡는다
- `hierarchy_parent`: 이 연결이 위계상의 부모-자식 질서를 규정한다

따라서 edge는 사용자 의미와 시스템 구조가 만나는 1급 관계 객체다.

### 3.8 Context

`Context`는 전체 관계 공간에서 특정 상황에 활성화되는 관계 부분집합이다.

중요한 것은 context가 단순 필터가 아니라는 점이다.
context는:

- 지금 무엇이 중요한가
- 어떤 관계를 우선적으로 읽을 것인가
- 무엇을 잠시 뒤로 미룰 것인가
- 현재 작업 범위를 어디까지로 볼 것인가

를 정하는 메타인지적 프레임이다.

또한 context는 “객체의 부분집합”에 그치지 않는다.
context는 객체뿐 아니라 관계도 함께 활성화한다.
즉 context는 “무엇이 지금 보이나”만 정하는 것이 아니라, “어떤 연결이 지금 의미 있는가”까지 정한다.

이 점에서 context는:

- viewpoint
- working frame
- semantic scope
- priority lens

를 겸하는 객체다.

### 3.9 File

`File`은 사유나 작업의 흔적이 실제로 남는 물질적 기록 객체다.

concept가 의미의 단위라면, file은:

- 원문이 남는 곳
- 근거가 머무는 곳
- 산출물이 쌓이는 곳
- 외부 세계와 접속하는 표면

이다.

따라서 file은 단순 첨부물이 아니라, 의미 구조와 현실 자료를 이어 주는 물질적 객체다.

### 3.10 Agent

`Agent`는 작업 세계 안에서 읽고, 판단하고, 제안하고, 조작할 수 있는 행위 주체다.

여기서 중요한 것은 agent가 전지적 관찰자가 아니라는 점이다.
agent는 전체 network를 한꺼번에 다루기보다, 적절한 context 안에서 더 잘 작동한다.

즉 Netior에서 agent는:

- 정보를 모두 가진 절대 주체가 아니라
- 특정 작업 프레임을 부여받는 행위 주체이며
- context를 통해 작업 범위와 관계 우선순위를 전달받는 존재

로 읽는 편이 맞다.

### 3.11 Type Group

`Type Group`은 ontology 자체가 아니라 사용자 정의 타입을 관리하기 위한 조직 구조다.

즉 type group은:

- schema을 묶고
- relation type을 묶고
- 커지는 타입 체계를 사람이 다룰 수 있게 정리한다

하지만 이것은 새로운 존재 종류를 만드는 것이 아니다.
type group은 schema과 relation type을 폴더처럼 정리하기 위한 편의 구조에 가깝다.

즉 type group은:

- domain object를 새로 만드는 장치가 아니고
- 타입 체계의 정체성을 규정하는 층도 아니며
- 사용자가 커진 타입 목록을 관리하기 위한 조직 장치다

따라서 type group은 존재론보다는 타입 관리 UX에 가까운 메타 구조다.

### 3.12 Module

`Module`은 핵심 존재론이라기보다 프로젝트 주변의 경로 접근을 정리하기 위한 편의 기능에 가깝다.

프로젝트에는 이미 `root_dir`이라는 기준 경로가 있다.
module은 그 바깥이나 곁에 존재하는 다음 성격의 경로를 다루기 위한 장치로 읽는 편이 맞다.

- 프로젝트 외부지만 함께 참조해야 하는 폴더
- 내부적으로 자주 접근하고 싶은 경로
- 일종의 작업용 북마크나 빠른 진입점

즉 module은:

- project의 세계를 확장하는 보조 경로 장치이고
- 사용자의 접근 편의를 높이는 기능이며
- 아직 agent가 직접 다루는 핵심 도메인 개념은 아니다

따라서 module은 현재 단계에서 “의미 객체”라기보다 “경로 접근과 작업 편의를 위한 부가 구조”로 두는 편이 맞다.

### 3.13 Layout Family / Layout Config

`layout type`은 network 안의 존재를 늘리는 개념이 아니다.
그것은 같은 network를 어떤 작업 공간 모드로 읽고 조작할 것인가를 정하는 층이다.

즉 layout type은 단순 옵션이라기보다, 하나의 workspace mode에 가깝다.

예:

- `freeform`: 관계 탐색과 자유 배치 중심의 작업면
- `timeline`: 연속 시간축을 따라 읽는 작업면
- `calendar`: 일/주/월 그리드 안에서 읽는 작업면
- `gantt`: 시간축 위에서 작업 흐름과 의존성을 읽는 별도 작업면

여기서 중요한 것은 `layout family`, `mode`, `preset`, `config`의 구분이다.

- `layout family`는 최상위 작업면 종류다
- `mode`는 같은 family 안의 보기 방식이다
- `preset`은 특정 사용 시나리오에 맞춘 기본 조합이다
- `layout config`는 사용자의 선택과 정책을 저장하는 설정 층이다

`layout config`는 객체 의미를 정의하지 않는다.
대신 현재 작업면에서 무엇을 어떻게 읽고 조작할지에 대한 정책을 담는다.

예를 들어 layout config는:

- 기본 보기 모드
- range
- grouping
- density
- label / color 기준
- viewport와 interaction 정책

같은 것을 담을 수 있다.

따라서 layout family와 layout config는 존재론 층이 아니라,
network를 어떻게 공간화하고 탐색하고 편집할 것인가를 정하는 작업면 층이다.

## 4. 세부 개념 정리

### 4.1 Schema의 세부 개념

schema은 다음 하위 개념들로 이루어진다.

- `도메인 타입`: 사용자가 자기 세계 안에서 붙이는 타입 이름과 정체성
- `model`: schema에 부착되는 조합 가능한 의미 모델
- `meaning`: model 안에서 실제로 해석되는 의미 단위
- `meaning slot`: 앱이 실제로 읽는 안정적인 필드 키
- `slot constraint`: 어떤 타입의 속성이 어떤 의미 슬롯을 맡을 수 있는지에 대한 제약
- `속성 스키마`: 어떤 속성을 이 타입의 핵심으로 볼 것인가
- `타입 간 참조`: 다른 schema을 참조함으로써 구성적 도메인 모델을 만든다
- `계층적 구성`: 타입이 다른 타입을 포함하면서 더 큰 모델을 형성한다
- `대표 표현`: 이 타입의 객체가 어떤 인상과 형식으로 나타날지 정할 수 있다
- `기본 문서 양식`: 해당 타입의 객체가 어떤 서술 골격을 갖는지 정할 수 있다

예를 들어 `task`라는 schema은 사용자 도메인 이름이고,
그 schema에 `statusful + assignable + dueable + progressable` 같은 model을 붙이면
앱은 이 schema을 “상태, 담당자, 마감, 진행률을 가진 실행 객체”로 읽을 수 있다.

이때 앱이 실제로 읽는 것은 사용자가 붙인 필드 라벨이 아니라 `status`, `assignee_refs`, `due_at`, `progress_ratio` 같은 meaning slot이다.

따라서 schema은 “무슨 종류인가”를 넘어서 “어떻게 구성되고, 앱이 어떻게 읽고, 어떻게 서술할 것인가”를 정하는 객체다.

### 4.2 Relation Type의 세부 개념

relation type은 다음 하위 개념들로 이루어진다.

- `관계 의미`: 이 연결이 무엇을 뜻하는가
- `방향성`: 이 관계가 비대칭인가, 방향을 갖는가
- `관계군`: 어떤 상위 관계 묶음 안에 속하는가
- `표현 수사`: 이 관계를 얼마나 강하게, 어떤 분위기로 읽을 것인가

즉 relation type은 관계의 사전이자 문법이다.

### 4.3 Edge의 세부 개념

edge는 다음 하위 개념을 함께 가진다.

- `relation instance`: 특정 객체들 사이에 실제로 맺어진 연결
- `relation meaning`: relation type을 통해 읽히는 사용자 의미
- `local description`: 이 사례에만 붙는 구체적 설명
- `relation meaning`: 시스템이 구조적으로 해석하는 계약

즉 edge는 “연결의 발생”인 동시에, “해석 가능한 사건”이다.

### 4.4 Context의 세부 개념

context는 다음 하위 개념을 가진다.

- `범위`: 지금 어디까지를 작업 세계로 볼 것인가
- `관점`: 무엇을 중심으로 읽을 것인가
- `우선순위`: 어떤 관계와 객체를 먼저 다룰 것인가
- `활성화`: 전체 관계망 중 어떤 부분을 지금 살아 있는 것으로 볼 것인가

따라서 context는 필터보다 작업 인식의 프레임에 가깝다.

### 4.5 Network Node의 세부 개념

network node는 다음 하위 개념을 가진다.

- `situated manifestation`: object가 특정 network 안에서 나타난 국소적 현현
- `local role`: 이 network 안에서 이 object가 어떤 역할을 수행하는가
- `interaction surface`: 사용자가 이 object와 실제로 상호작용하는 접면
- `network-local emphasis`: 이 network에서 무엇을 드러내고 무엇을 뒤로 미루는가
- `working handle`: 편집, 탐색, 배치, 연결의 실제 조작 단위

중요한 것은 node가 단순 렌더링 결과가 아니라는 점이다.
node는 object가 특정 작업 장면 안에서 다시 한 번 개념화된 결과에 가깝다.

특히 concept의 경우 이 구분이 중요하다.

- `concept`는 세계 안의 의미 단위다
- `concept node`는 그 concept가 특정 network 안에서 취한 국소적 자세다

즉 concept node는 concept과 닮았지만 concept 그 자체는 아니다.
같은 concept라도 어떤 network에서는 entry처럼 읽히고, 어떤 network에서는 summary처럼 읽히며, 어떤 network에서는 collection 안의 한 구성원처럼 읽힐 수 있다.

이 구분을 더 밀어 붙이면 `folder node` 같은 개념도 여기서 설명된다.
folder는 filesystem folder가 아니라, 특정 network 안에서 “결과물을 이 안에 담아라”, “필요한 것을 여기서 꺼내 써라”라는 식의 수납/인출 규칙을 맡는 node다.

즉 folder node는:

- object 자체라기보다 network-local한 작업 지시를 가진 node이며
- type group의 folder처럼 타입 목록을 정리하는 메타 구조도 아니고
- 파일 시스템 경로를 그대로 반영한 폴더도 아니다

오히려 그것은 특정 network 안에서 결과물과 재료의 집결지, 인출지, 작업 버킷처럼 기능하는 node에 가깝다.

따라서 node는 object의 단순 그림이 아니라, object가 network 안에서 작업 가능해진 형태다.

## 5. 층위 구분

이 문서를 안정적으로 쓰기 위해서는 다음 구분이 필요하다.

### 5.1 Network Object Type

이 작업 세계 안에 어떤 존재들이 있는가를 정하는 존재론 층이다.

예:

- project
- network
- concept
- schema
- model
- relation type
- context
- file
- agent

반면 `type group`, `module`, `layout`, `folder node`는 이 존재론 자체보다는
관리 구조, 편의 기능, 작업면 정책, node-level 작업 장치에 더 가깝다.

### 5.2 User Type

사용자가 자기 도메인을 위해 정의하는 분류와 규칙의 층이다.

예:

- character
- faction
- protein
- hypothesis

현재 구조에서 schema과 relation type은 user type을 담는 핵심 그릇에 가깝다.

### 5.3 Model / Meaning / Meaning Slot

이 층은 사용자 도메인 이름과 앱 해석 가능성을 이어 주는 의미 계층이다.

`model`은 schema에 부착되는 조합 가능한 의미 모델이다.
중요한 것은 model이 `calendar item`이나 `board card` 같은 뷰 이름이 아니라,
`temporal`, `statusful`, `hierarchical`, `versioned`처럼 객체의 의미 구조를 설명하는 단위여야 한다는 점이다.

`meaning`은 model 안에서 실제로 해석되는 더 작은 의미 단위다.
예를 들어 `temporal` model 안에는 `time point`, `duration`, `deadline`, `recurrence` 같은 meaning들이 들어갈 수 있다.

`meaning slot`은 앱이 실제로 읽는 meaning key다.
사용자는 화면에서 `시작일`, `마감`, `담당자`, `상태`처럼 자유로운 라벨을 붙일 수 있지만,
앱은 그 라벨이 아니라 `start_at`, `due_at`, `assignee_refs`, `status` 같은 안정적인 의미 키를 읽는다.

즉 이 층의 역할은 다음과 같다.

- 사용자 정의 schema을 앱이 해석 가능하게 만든다
- 하나의 schema에 여러 model을 조합할 수 있게 한다
- 하나의 model 안에 여러 meaning을 담을 수 있게 한다
- 뷰나 자동화가 사용자 라벨에 종속되지 않게 만든다
- 필요한 속성을 의미 슬롯 단위로 강제하거나 유도한다

이 점에서 `model`은 user type을 대체하는 것이 아니라,
user type을 시스템 해석 가능성에 연결하는 중간 의미 객체다.

### 5.4 Relation Meaning

relation meaning는 존재의 본질이 아니라, 앱이 그 존재나 관계를 어떻게 동작시킬지를 정하는 규약 층이다.

즉 중요한 질문은:

- 이것이 container처럼 동작하는가
- 이것이 entry가 될 수 있는가
- 이것이 hierarchy를 형성하는가
- 이것이 편집 가능하고 묶일 수 있는가

같은 것들이다.

`model`이 주로 schema의 의미를 설명한다면,
`relation meaning`는 주로 객체나 edge가 시스템 안에서 어떤 구조적 역할을 수행하는지 정한다.

### 5.5 Layout

layout은 object type이 아니다.
그것은 network를 어떤 공간 구조와 상호작용 규칙 아래 읽을 것인가를 정하는 작업면 층이다.

즉:

- object는 무엇이 존재하는가의 문제이고
- node는 그것이 어떻게 나타나는가의 문제이며
- layout은 그 나타남 전체를 어떤 좌표계, 배치 논리, viewport 정책 아래 다룰 것인가의 문제다

이 점에서 layout type은 workspace mode에 가깝고,
layout config는 그 mode 안에서 쓰이는 저장 가능한 읽기/조작 정책이다.

### 5.6 Node

node는 object 자체가 아니다.
하지만 그렇다고 단순한 표시 껍데기라고 보기도 어렵다.

즉:

- object는 무엇인가의 문제이고
- node는 그것이 한 network 안에서 어떻게 나타나는가의 문제다

더 정확히 말하면:

- object는 세계 안에서의 정체성을 가진다
- node는 그 object가 특정 network 안에서 어떤 작업 단위로 나타나는지를 가진다

따라서 같은 object라도 다른 network에서는 다른 모습과 역할로 나타날 수 있다.
특히 concept node는 concept의 복제본이라기보다, concept의 network-local한 현현이다.

이 점에서 node는 존재론 그 자체는 아니지만, 단순 UI도 아니다.
node는 object와 network가 만나는 자리에서 생기는 2차적 작업 단위다.

## 6. 문서화 시 강조해야 할 원칙

- `concept`는 중요한 객체이지만 더 이상 모든 책임을 떠안는 중심축이 아니다
- `entry`는 객체의 본질이 아니라 계약이나 역할에 가깝다
- `context`는 필터가 아니라 작업 프레임이다
- `schema`은 단순 태그가 아니라 도메인 타입이다
- `model`은 뷰 이름이 아니라 schema에 부착되는 의미 모델이다
- `meaning`은 model 안에서 실제로 해석되는 의미 단위다
- 앱은 사용자 라벨이 아니라 `meaning slot`을 읽는다
- `type group`은 ontology가 아니라 타입 정리를 위한 편의 구조다
- `module`은 경로 접근과 북마크 성격의 보조 기능이며 아직 agent 핵심 개념이 아니다
- `layout type`은 object 분류가 아니라 workspace mode다
- `network node`는 object의 단순 그림이 아니라 network-local한 작업 단위다
- `folder node`는 filesystem folder가 아니라 network 안의 수납/인출 규칙을 맡는 node다
- `node_type`와 model은 서로 다른 책임을 가진다
- `relation type`은 관계 라벨이 아니라 관계 문법이다
- `edge`는 단순 선이 아니라 의미와 계약이 함께 실릴 수 있는 관계 사례다
- `file`은 부가 자료가 아니라 물질적 기록 객체다

## 7. 열린 질문

다음 항목은 후속 교정이 필요한 쟁점이다.

- `edge`를 존재론 차원의 정식 network object로 완전히 올릴 것인가
- `model`, `meaning`, `meaning slot`, `relation meaning`를 하나의 meaning model 우산 아래에서 어떻게 정리할 것인가
- `relation meaning`를 edge 중심으로 둘 것인가, 객체 일반의 규약 층으로 더 확장할 것인가
- `layout family`, `mode`, `preset`, `config`의 경계를 어디까지 고정할 것인가
- `folder node`와 generic group/container node의 경계를 얼마나 강하게 나눌 것인가
- `schema`의 표현 규약과 문서 규약을 어디까지 타입 본체에 포함할 것인가

## 8. 한 줄 정의 모음

- `Network Object는 Netior가 작업 세계 안에서 하나의 실체로 인정하는 단위다.`
- `Schema은 객체의 종류와 해석 방식을 정하는 도메인 타입이다.`
- `Model은 schema에 부착되어 앱이 그 객체를 어떤 의미 체계로 읽어야 하는지 알려 주는 조합 가능한 의미 모델이다.`
- `Meaning은 model 안에서 실제로 해석되는 의미 단위다.`
- `Layout Type은 network를 어떤 작업 공간 모드로 읽고 조작할지를 정하는 작업면 분류다.`
- `Network Node는 object가 특정 network 안에서 작업 가능하게 나타난 국소적 현현이다.`
- `Folder Node는 network 안에서 결과물의 수납과 인출 규칙을 맡는 작업용 node다.`
- `Relation Type은 관계를 읽는 문법이다.`
- `Edge는 관계가 실제로 발생한 한 사례다.`
- `Context는 특정 목적 아래 활성화되는 의미 프레임이다.`
- `File은 의미 구조와 현실 자료를 잇는 물질적 기록 객체다.`
