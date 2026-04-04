# Package Versions

```yaml
packages:
  shared:
    version: "0.4.0"
    type: minor
    summary: "패인 전환, 에이전트 점프 단축키 i18n 키 추가"
    impact: local
    contracts: []
  core:
    version: "0.2.0"
    type: minor
    summary: "File 1급 엔티티 (files 테이블, FileRepository), canvas_nodes에 file_id/metadata 추가, concept_files 제거"
    impact: local
    contracts: []
  mcp:
    version: "0.1.0"
    type: minor
    summary: "MCP 서버 초기 구현 - 17개 타입 시스템 도구 + 6개 파일시스템 도구"
    impact: local
    contracts: []
  narre-server:
    version: "0.1.0"
    type: minor
    summary: "Narre AI 에이전트 서버 초기 구현 - Claude Agent SDK 기반 SSE 스트리밍, 슬래시 커맨드, UI 도구"
    impact: local
    contracts: []
  desktop-app:
    version: "0.5.0"
    type: minor
    summary: "패인 인식 탭 단축키, 활성 패인 UI, 에디터 포커스, 에이전트 알림 큐"
    impact: local
    contracts: []
  narre-eval:
    version: "1.0.0"
    type: major
    summary: "평가 플랫폼으로 전면 재설계 — 시나리오 번들, 어댑터, 메트릭, 비교, 강화된 검증"
    impact: cross-package
    contracts: [tooling]
```
