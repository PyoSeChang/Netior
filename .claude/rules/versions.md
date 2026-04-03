# Package Versions

```yaml
packages:
  shared:
    version: "0.1.1"
    type: patch
    summary: "터미널 Todo 및 에디터 최소화 관련 i18n 키 추가"
  core:
    version: "0.1.0"
    type: minor
    summary: "DB 로직 추출 및 리포지토리 패턴 확립 — desktop-app에서 분리하여 MCP 서버와 공유 가능한 코어 패키지 초기 버전"
  mcp:
    version: "0.1.0"
    type: minor
    summary: "MCP 서버 초기 구현 - 17개 타입 시스템 도구 + 6개 파일시스템 도구"
  narre-server:
    version: "0.1.0"
    type: minor
    summary: "Narre AI 에이전트 서버 초기 구현 - Claude Agent SDK 기반 SSE 스트리밍, 슬래시 커맨드, UI 도구"
  desktop-app:
    version: "0.2.0"
    type: minor
    summary: "터미널 Todo 패널, 단축키 시스템, 개별 탭 최소화, 테마 확장, Claude 훅 오인식 수정"
  narre-eval:
    version: "0.2.0"
    type: minor
    summary: "폴더 기반 시나리오 구조, 시나리오 타입 구분, 이름 있는 verify 형식, conversation 자동 응답 지원"
```
