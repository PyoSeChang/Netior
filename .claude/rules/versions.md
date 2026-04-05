# Package Versions

```yaml
packages:
  shared:
    version: "0.5.0"
    type: minor
    summary: "/index 슬래시 커맨드, 파일 멘션 i18n, PDF TOC 입력 폼 i18n 추가"
    impact: cross-package
    contracts: []
  core:
    version: "0.3.0"
    type: minor
    summary: "updateFileMetadataField 함수 추가 -- 파일 메타데이터 단일 키 머지 저장"
    impact: cross-package
    contracts: [api]
  mcp:
    version: "0.2.0"
    type: minor
    summary: "PDF TOC 추출/저장 도구 4개 추가, path validation 리팩터링"
    impact: cross-package
    contracts: [tooling]
  narre-server:
    version: "0.2.0"
    type: minor
    summary: "/index TOC 추출 프롬프트, NETIOR_ELECTRON_PATH MCP 네이티브 모듈 호환"
    impact: cross-package
    contracts: [prompt, tooling]
  desktop-app:
    version: "0.7.0"
    type: minor
    summary: "테마 벽지색/accent 분리, interactive state 토큰 통일, 설정 모달 UX 개선"
    impact: local
    contracts: []
  narre-eval:
    version: "1.0.0"
    type: major
    summary: "평가 플랫폼으로 전면 재설계 — 시나리오 번들, 어댑터, 메트릭, 비교, 강화된 검증"
    impact: cross-package
    contracts: [tooling]
```
