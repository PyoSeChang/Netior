# @netior/narre-server

마지막 검증: 2026-04-10

## 역할

Express + Claude Agent SDK 기반의 HTTP/SSE 서버다. desktop-app이 child process로 실행하고, 서버는 `netior-mcp`와 in-process `narre-ui`를 함께 연결한다.

## 현재 엔드포인트

- `GET /health`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/:id`
- `DELETE /sessions/:id`
- `POST /chat`
- `POST /chat/respond`
- `POST /command`

## 현재 동작

- 세션 인덱스는 `sessions.json`, 메시지는 `session_{id}.json`으로 저장한다.
- `/chat`은 최초 메시지면 system prompt를 앞에 붙이고, 재개 세션이면 user prompt만 전달한다.
- slash command는 현재 `/onboarding`, `/index` 두 개다.
- `narre-ui`는 `propose`, `ask`, `confirm` 세 도구를 제공하고 응답은 `/chat/respond`로 받는다.
- mention은 inline tag로 치환되어 모델 프롬프트에 들어간다.
- `netior-mcp`는 현재 Narre 런타임의 `process.execPath`로 실행되고, Electron-as-Node일 때만 `ELECTRON_RUN_AS_NODE=1`을 함께 전달한다.

## 주의할 점

- `/command`는 현재 not implemented다.
- DB를 직접 열지 않고 `netior-mcp`를 통해 데이터를 변경한다.
- 전용 테스트 파일은 없다.
