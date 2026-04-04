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
    version: "0.2.0"
    type: minor
    summary: "PDF TOC 추출/저장 도구 4개 추가, path validation 리팩터링"
    impact: cross-package
    contracts: [tooling]
  narre-server:
    version: "0.1.0"
    type: minor
    summary: "Narre AI 에이전트 서버 초기 구현 - Claude Agent SDK 기반 SSE 스트리밍, 슬래시 커맨드, UI 도구"
    impact: local
    contracts: []
  desktop-app:
    version: "0.5.1"
    type: patch
    summary: "초기 버전"
    impact: local
    contracts: []
  narre-eval:
    version: "1.0.0"
    type: major
    summary: "평가 플랫폼으로 전면 재설계 — 시나리오 번들, 어댑터, 메트릭, 비교, 강화된 검증"
    impact: cross-package
    contracts: [tooling]
```
