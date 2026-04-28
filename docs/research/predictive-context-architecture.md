# Predictive Context Architecture

> Context Navigator 기반 LLM 아키텍처

## 0. 개요

본 아키텍처는 기존 LLM 기반 시스템의 한계를 "토큰 예측"이 아닌 "컨텍스트 상태 공간 탐색" 문제로 재정의하고, 이를 해결하기 위해 이중 레이어 구조를 도입한다.

핵심 아이디어:

- LLM은 로컬 토큰 예측기이다.
- 전역적 문맥 탐색과 메타인지는 별도 계층이 담당해야 한다.

## 1. 문제 정의

### 1.1 메타인지 부재

기존 `LLM + MCP` 구조의 문제:

- 현재 지식으로 무엇을 알 수 있는지 모름
- 무엇이 부족한지 모름
- 어디를 탐색해야 하는지 모름

즉, 시스템은 "반응"만 할 뿐, "탐색 전략"이 없다.

### 1.2 연상(Association) 부재

그래프 구조는 존재하지만 의미 기반 점프(연상)가 없다.

예:

```text
A -> B -> C 관계 존재
하지만 A에서 C를 능동적으로 떠올리지 못함
```

### 1.3 결과

현재 구조는 "지식 그래프 + 쿼리 인터페이스"에 가깝다. 하지만 필요한 것은 "지식 그래프 + 사고 시스템"이다.

## 2. 핵심 아이디어

### 2.1 레이어 분리

하위 레이어: `LLM (무의식)`

- 역할: 토큰 예측
- 특징: 미시적(`local`), 반응형, 현재 컨텍스트에만 의존

상위 레이어: `Context Predictor (의식)`

- 역할: 컨텍스트 예측
- 특징: 거시적(`global`), 능동적 탐색, 미래 상태 예측

### 2.2 핵심 전환

기존:

```text
Input -> Retrieve -> Generate
```

변경:

```text
Input -> Context Prediction -> Pre-Exploration -> Context Injection -> Generate
```

## 3. 컨텍스트 상태 공간 (Context State Space)

대화는 단순 텍스트가 아니라 상태 공간 위의 이동으로 모델링된다.

예시 상태:

- 개념 정의
- 시스템 설계
- 구현
- 비판
- 추상화
- 브랜딩

상태 표현 예시:

```yaml
mode: design
target: ontology_editor
abstraction: high
intention: architecture_invention
uncertainty:
  - metacognition
  - association
  - feedback_loop
```

## 4. 작동 방식

### 4.1 Context Prediction

입력:

- 사용자 발화
- 최근 대화
- 온톨로지 상태

출력:

- 다음 가능한 컨텍스트 상태들
- 각 상태의 확률
- 전이 경로

### 4.2 Pre-Exploration

예측된 상태를 기반으로 다음을 수행한다.

- 관련 노드 탐색
- 연관 개념 확장
- 미래 필요 정보 선확보

### 4.3 Context Injection (Hook 기반)

프롬프트에 단순 데이터가 아니라 구조화된 컨텍스트 패킷을 주입한다.

예:

```yaml
current_context: architecture_design

next_possible_contexts:
  - system_decomposition (0.6)
  - risk_analysis (0.3)
  - naming (0.1)

relevant_nodes:
  - context_prediction
  - ontology_delta
  - agent_loop

missing_slots:
  - evaluation_strategy
  - cost_control

discarded_paths:
  - pure_rag_approach
```

### 4.4 Generation

하위 LLM이 해당 컨텍스트 기반으로 생성 수행한다.

## 5. 피드백 루프

### 5.1 세션 중 (Online Feedback)

- 현재 컨텍스트 가설 검증
- 오탐 시 롤백
- 탐색 경로 수정

### 5.2 세션 후 (Offline Feedback)

- 컨텍스트 예측 정확도 평가
- 상태 전이 모델 업데이트
- 탐색 정책 개선
- World Model 업데이트

## 6. 핵심 구성 요소

### 6.1 Context Predictor

- 상태 전이 예측
- 미래 컨텍스트 가설 생성

### 6.2 Exploration Policy

- 탐색 전략 결정
- `exploit` (깊게)
- `explore` (넓게)
- `rollback`

### 6.3 Context Assembler

- 탐색 결과 압축
- 프롬프트 최적화

### 6.4 Online Critic

- 현재 컨텍스트 적합성 검증

### 6.5 World Model Updater

- 장기 학습
- 상태공간 및 전이 구조 개선

## 7. 특징

### 7.1 Anticipatory Retrieval

질의 기반이 아니라 미래 기반 검색이다.

### 7.2 Context-Centric Architecture

`reasoning`이 아니라 `context positioning`이 핵심이다.

### 7.3 Multi-Hypothesis System

- 단일 컨텍스트 확신 금지
- 여러 가설 유지

## 8. 리스크

### 8.1 상태 공간 설계 문제

- 너무 단순하면 의미가 없다.
- 너무 복잡하면 폭발한다.

### 8.2 상위 레이어 hallucination

- 잘못된 컨텍스트를 강제할 수 있다.

### 8.3 비용 문제

- 선탐색 비용 증가
- 예측 실패 시 낭비

### 8.4 모델 분리 문제

- `Global vs User vs Session` 모델 충돌 가능

## 9. 기존 접근과의 차이

| 구분 | 기존 RAG | 본 아키텍처 |
| --- | --- | --- |
| 기준 | 질의 | 미래 상태 |
| 검색 | 사후 | 사전 |
| 구조 | 정적 | 동적 |
| 역할 | 보조 | 핵심 |

## 10. 정의

**Predictive Context Architecture**는 토큰 예측 기반 LLM 위에 컨텍스트 상태 공간을 예측하고 탐색하는 상위 레이어를 추가하여, 대화의 미래 문맥을 선제적으로 구성하는 이중 레이어 시스템이다.

## 11. 한 줄 요약

LLM은 답을 만든다. 이 시스템은 어떤 맥락에서 답을 만들지 결정한다.
