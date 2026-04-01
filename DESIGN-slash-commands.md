# DESIGN: Slash Command System

## 개요

Narre 채팅에서 `/` 접두사로 실행하는 커맨드 시스템. 대화형 커맨드(Narre 세션 진입)와 시스템 커맨드(서버 단독 처리)를 지원.

## 커맨드 유형

| 유형 | 기준 | 엔드포인트 | 예시 |
|------|------|-----------|------|
| 대화형 (conversation) | Narre 세션으로 진입, 멀티턴 가능 | `POST /chat` | /onboarding, /rewiring |
| 시스템 (system) | 서버가 처리하고 끝, 세션 없음 | `POST /command` | /usage, /compact |

## 아키텍처

```
@netior/shared (커맨드 정의)
  ├── types: SlashCommand, CommandArg, CommandType
  └── constants: SLASH_COMMANDS (레지스트리)
           │
     ┌─────┴─────┐
     ▼           ▼
desktop-app    agent-server
(피커 + 분기)  (검증 + 실행)
```

### @netior/shared — 커맨드 정의

커맨드 레지스트리. 프론트엔드와 서버가 동일한 정의를 공유.

```
SlashCommand:
  name        — 커맨드 이름 ("onboarding", "usage")
  description — 피커에 표시할 설명
  type        — "conversation" | "system"
  args        — 인자 목록 (선택)

CommandArg:
  name        — 인자 이름
  description — 설명
  required    — 필수 여부
  type        — "string" | "enum"
  options     — enum일 경우 선택지 목록
```

### desktop-app (renderer) — 피커 + 전송

**피커 트리거:**
- 입력 맨 앞에서 `/` 타이핑 시 피커 표시
- 텍스트 중간의 `/`는 무시
- 피커 목록은 shared의 SLASH_COMMANDS에서 import

**피커 인터랙션:**

| 입력 | 동작 |
|------|------|
| `/` (입력 맨 앞) | 피커 표시 |
| `/` 이후 타이핑 | 필터링 |
| ↑↓ | 선택 이동 |
| Enter | 선택된 커맨드 전송 |
| Escape | 피커 닫기 |
| 피커 밖 클릭 | 피커 닫기 |

**전송 분기:**
```
입력값 파싱 → "/" 시작?
  → shared에서 커맨드 조회
    → type "conversation" → POST /chat (새 세션, message에 커맨드 포함)
    → type "system"       → POST /command
    → 미매칭              → POST /chat (일반 메시지로 Narre에게)
```

### agent-server — 검증 + 실행

**공통:**
- 요청 수신 시 커맨드 존재 여부 + type 서버 측 재검증
- 실행 중인 커맨드 추적, 동일 커맨드 중복 실행 거부

**대화형 커맨드 (POST /chat):**
```
메시지가 "/"로 시작
  → 커맨드 파싱 (name + args)
  → 새 세션 강제 생성 (기존 세션 유지, 전환)
  → 커맨드 전용 시스템 프롬프트로 Narre 호출
  → SSE 스트리밍 (기존 채팅과 동일 이벤트 형식)
```

**시스템 커맨드 (POST /command):**
```
커맨드 파싱 (name + args)
  → handler 직접 실행
  → SSE 스트리밍 (동일 이벤트 형식: text, done, error)
```

**커맨드 핸들러 레지스트리:**
```
agent-server 내부:
  commandHandlers: Map<string, handler>
    "onboarding" → onboardingHandler (Narre 호출 + 전용 시스템 프롬프트)
    "usage"      → usageHandler (API 사용량 조회)
```

## 응답 프로토콜

대화형/시스템 모두 SSE 통일. 프론트엔드 처리 로직 단일화.

```
event: text       — 텍스트 청크
event: tool_start — 도구 실행 시작 (대화형만)
event: tool_end   — 도구 실행 결과 (대화형만)
event: error      — 에러
event: done       — 완료
```

시스템 커맨드는 text 이벤트(들) + done으로 끝.

## 기존 세션에서 대화형 커맨드 실행 시

새 세션을 강제 생성. 기존 세션은 보존되어 나중에 돌아갈 수 있음.

## Edge Case

| 케이스 | 동작 |
|--------|------|
| 매칭 안 되는 `/xxx` 전송 | 일반 메시지로 Narre에게 전달 |
| 커맨드 실행 중 동일 커맨드 재전송 | 서버에서 거부, 에러 반환 |
| 인자 누락 (required arg) | 서버에서 검증, 에러 반환 |
| agent-server 미실행 상태 | 프론트엔드에서 연결 불가 에러 표시 |

## 초기 커맨드 목록

| 커맨드 | 유형 | 인자 | 설명 |
|--------|------|------|------|
| /onboarding | conversation | 없음 | 프로젝트 타입 체계 구축 |

추가 예정: /rewiring, /usage, /compact 등.

## 선행 작업

- `@netior/shared`: SlashCommand 타입 + SLASH_COMMANDS 상수 추가
- `agent-server`: /command 엔드포인트 + 커맨드 라우터 + 핸들러 레지스트리
- `desktop-app`: NarreMentionInput에 "/" 피커 통합
