# Package Versions

```yaml
packages:
  shared:
    version: "0.5.0"
    type: patch
    summary: "초기 버전"
    impact: local
    contracts: []
  core:
    version: "0.3.0"
    type: patch
    summary: "초기 버전"
    impact: local
    contracts: []
  mcp:
    version: "0.2.0"
    type: patch
    summary: "초기 버전"
    impact: local
    contracts: []
  narre-server:
    version: "0.2.0"
    type: patch
    summary: "초기 버전"
    impact: local
    contracts: []
  desktop-app:
    version: "0.8.0"
    type: minor
    summary: "에디터 버그 수정, 목차 상태 저장, 단축키 추가, 뷰모드 스위치 리팩토링"
    impact: local
    contracts: []
  narre-eval:
    version: "1.0.0"
    type: major
    summary: "평가 플랫폼으로 전면 재설계 — 시나리오 번들, 어댑터, 메트릭, 비교, 강화된 검증"
    impact: cross-package
    contracts: [tooling]
```
