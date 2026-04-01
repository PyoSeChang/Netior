# DESIGN: Narre MVP

## 개요

Narre는 Netior의 AI 어시스턴트. 사용자가 자연어로 프로젝트의 타입 시스템과 개념을 관리할 수 있게 한다.

MVP 범위: **Init + Archetype CRUD + Relation Type CRUD + Canvas Type CRUD + Concept CRUD**

---

## 아키텍처

### 패키지 구조

```
packages/
├── shared/          # 타입, 상수, i18n (기존)
├── moc-core/        # DB 로직 추출 (repositories, migrations) — NEW
├── netior-mcp/         # moc-core를 HTTP MCP로 래핑 — NEW
├── desktop-app/     # Electron 앱, moc-core 직접 import (기존 + Narre UI)
└── agent-server/    # Narre 에이전트, Claude Agent SDK (TypeScript) — NEW
```

### 데이터 흐름

```
desktop-app (Renderer)         desktop-app (Main)          외부 프로세스
───────────────────           ──────────────────          ──────────────
NarreEditor.tsx                ipc/narre-handlers.ts       agent-server (Narre)
│                              │                            │
│── user message ──IPC──→      │── HTTP ──→                 │
│                              │                            │── tool call ──→ netior-mcp
│                              │                            │                  │
│                              │                            │                  ├── moc-core
│                              │                            │                  │     └── netior.db
│                              │                            │                  │
│                              │                            │← tool result ──  │
│                              │← SSE stream ──             │                  │
│← assistant message ──IPC──   │                            │
│                              │                            │
│                              │── SSE 구독 ──→ netior-mcp change events
│← store refetch ──IPC──       │   (DB 변경 시 invalidation)
```

### DB 접근 전략

- **desktop-app** → moc-core 직접 import (in-process, HTTP 오버헤드 없음)
- **netior-mcp** → moc-core를 HTTP API로 래핑 (외부 클라이언트용)
- **동시 접근** → SQLite WAL 모드 + busy_timeout(5000)
- **동기화** → netior-mcp가 mutation 시 SSE 이벤트 발행 → desktop-app Main이 구독 → Renderer 스토어 refetch
- **장애 격리** → netior-mcp가 죽어도 desktop-app 정상 동작

### agent-server (Narre)

- TypeScript (Claude Agent SDK) — `@netior/shared` 타입/상수 import 가능
- netior-mcp를 MCP 서버로 연결 (HTTP transport)
- 시스템 프롬프트에 프로젝트 메타데이터 동적 주입
- 응답 스트리밍: SSE

### API 키

- 앱 설정에서 Anthropic API 키 입력/저장
- `%APPDATA%/moc/config.json` 또는 앱 내 설정 UI

---

## 시스템 프롬프트 구성

매 세션 시작 시 DB에서 조회하여 주입:

```
너는 Narre, Netior 프로젝트의 AI 어시스턴트야.
사용자의 개념 정리를 도와주는 역할이야.

## 현재 프로젝트: {project.name}

## 아크타입 ({archetypes.length}개)
- {name}: icon={icon}, color={color}, shape={node_shape}
- ...

## 관계 타입 ({relationTypes.length}개)
- {name}: directed={directed}, style={line_style}, color={color}
- ...

## 캔버스 타입 ({canvasTypes.length}개)
- {name}: allowed_relations=[{allowedRelations}]
- ...

## 사용 가능한 도구
netior-mcp를 통해 위 데이터를 CRUD할 수 있어.
개념 목록은 도구(list_concepts)로 조회해.
```

타입 시스템(아크타입, 릴레이션타입, 캔버스타입)은 수가 적으므로 프롬프트에 포함.
개념/캔버스/엣지는 수가 많을 수 있으므로 도구로 조회.

---

## netior-mcp 도구 목록

| 도구 | 설명 | 입력 |
|---|---|---|
| **get_project_summary** | 프로젝트 전체 요약 | project_id |
| **list_archetypes** | 아크타입 목록 | project_id |
| **create_archetype** | 아크타입 생성 | project_id, name, icon, color, node_shape, fields? |
| **update_archetype** | 아크타입 수정 | archetype_id, 변경할 필드들 |
| **delete_archetype** | 아크타입 삭제 | archetype_id |
| **list_relation_types** | 관계 타입 목록 | project_id |
| **create_relation_type** | 관계 타입 생성 | project_id, name, directed, line_style, color |
| **update_relation_type** | 관계 타입 수정 | relation_type_id, 변경할 필드들 |
| **delete_relation_type** | 관계 타입 삭제 | relation_type_id |
| **list_canvas_types** | 캔버스 타입 목록 | project_id |
| **create_canvas_type** | 캔버스 타입 생성 | project_id, name, icon, color, allowed_relation_type_ids |
| **update_canvas_type** | 캔버스 타입 수정 | canvas_type_id, 변경할 필드들 |
| **delete_canvas_type** | 캔버스 타입 삭제 | canvas_type_id |
| **list_concepts** | 개념 목록/검색 | project_id, query? |
| **create_concept** | 개념 생성 | project_id, title, archetype_id?, color?, icon? |
| **update_concept** | 개념 수정 | concept_id, 변경할 필드들 |
| **delete_concept** | 개념 삭제 | concept_id |

---

## UI 설계

### EditorTabType 추가

기존 에디터 탭 타입에 `'narre'` 추가.

```
EditorTabType: 'concept' | 'file' | 'archetype' | 'terminal' | 'edge'
             | 'relationType' | 'canvasType' | 'canvas' | 'narre'
```

### 세션 목록 화면 (Narre 탭 초기 진입)

```
┌─────────────────────────────────────────┐
│ [탭: ★ Narre]  [탭: 세종대왕]  [탭: ...]│
├─────────────────────────────────────────┤
│                                         │
│  최근 대화                               │
│  ┌───────────────────────────────────┐  │
│  │ 📝 프로젝트 초기 설정              │  │
│  │    3시간 전 · 메시지 12개          │  │
│  ├───────────────────────────────────┤  │
│  │ 📝 인물 아크타입 필드 추가         │  │
│  │    어제 · 메시지 8개               │  │
│  └───────────────────────────────────┘  │
│                                         │
│           [+ 새 대화]                    │
│                                         │
├─────────────────────────────────────────┤
│ [메시지 입력...]                    [➤] │
└─────────────────────────────────────────┘
```

- 세션 클릭 → 해당 대화 이어서 (resume)
- 새 대화 또는 입력창에 바로 타이핑 → 새 세션 시작
- 세션 제목은 첫 메시지 기반 Narre가 자동 생성

### 채팅 화면

```
┌─────────────────────────────────────────┐
│ [탭: ★ Narre]                   [← 목록]│
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Narre ──────────────────────────┐   │
│  │ 조선시대 프로젝트에 맞는 타입을   │   │
│  │ 제안합니다:                       │   │
│  │                                   │   │
│  │ **아크타입 (5)**                  │   │
│  │ 👤 인물  🏛 기관  📜 사건        │   │
│  │ 📍 장소  📖 작품                  │   │
│  │                                   │   │
│  │ **관계 타입 (4)**                 │   │
│  │ → 소속  ── 관련  → 인과  → 저술  │   │
│  │                                   │   │
│  │ 이대로 생성할까요?                │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ 사용자 ─────────────────────────┐   │
│  │ 좋아, 생성해줘                    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Narre (실행 중) ────────────────┐   │
│  │ ▼ 도구 실행 (5/7)                │   │
│  │   ✓ 아크타입 "인물" 생성          │   │
│  │   ✓ 아크타입 "기관" 생성          │   │
│  │   ✓ 아크타입 "사건" 생성          │   │
│  │   ✓ 아크타입 "장소" 생성          │   │
│  │   ✓ 아크타입 "작품" 생성          │   │
│  │   ⟳ 관계 타입 "소속" 생성 중...   │   │
│  │   ○ 관계 타입 "관련"              │   │
│  └──────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│ [메시지 입력...]                    [➤] │
└─────────────────────────────────────────┘
```

### 메시지 영역

- 에디터 독의 `max-w-[600px]` 중앙 정렬 규칙 따름
- 스크롤 가능
- Narre 메시지: 좌측 정렬, `surface-card` 배경
- 사용자 메시지: 우측 정렬, `accent-muted` 배경
- 마크다운 렌더링 지원

### 메시지 타입별 렌더링

| 메시지 타입 | 렌더링 |
|---|---|
| 텍스트 | 마크다운 렌더링 |
| 도구 호출 중 | 접을 수 있는 실행 로그 (tool name + ✓/⟳/✗ status) |
| 도구 결과 | 인라인 요약 |
| 에러 | 에러 배경 + 메시지 |

### 도구 실행 로그

- 기본: 접힌 상태 ("▶ 도구 실행 (5/7)")
- 클릭: 펼쳐서 개별 도구 호출 상태 확인
- 각 항목: ✓ 완료 / ⟳ 진행중 / ✗ 실패

---

## 멘션 입력 (ContentEditable)

일반 TextArea 대신 contenteditable 입력으로, 엔티티를 인라인 멘션.

### 완성된 입력 예시

```
┌─────────────────────────────────────────────────┐
│ [세종대왕] 개념의 아크타입을 [인물] 로 변경해줘  │
│                                             [➤] │
└─────────────────────────────────────────────────┘
```

### 멘션 피커

`@` 입력 시 팝업:

```
┌─────────────────────────────────────────────────┐
│ @세종                                            │
│ ┌────────────────────────────────┐               │
│ │ 개념                           │               │
│ │   👤 세종대왕                  │               │
│ │   📜 세종실록                  │               │
│ │ 캔버스                         │               │
│ │   📋 세종시대 인물관계          │               │
│ └────────────────────────────────┘               │
│                                             [➤] │
└─────────────────────────────────────────────────┘
```

### 멘션 가능 엔티티

| 타입 | 표시 | 프롬프트 변환 |
|---|---|---|
| Concept | 칩 (아크타입 색상) | `[concept:id=42, title="세종대왕"]` |
| Canvas | 칩 (캔버스타입 색상) | `[canvas:id=7, name="인물관계"]` |
| Edge | 칩 (관계타입 색상) | `[edge:id=15, source="세종대왕", target="집현전"]` |
| Module | 칩 (폴더 아이콘) | `[module:path="조선전기"]` |
| File | 칩 (파일 아이콘) | `[file:path="조선전기/세종대왕.md"]` |
| Archetype | 칩 (아크타입 아이콘) | `[archetype:id=3, name="인물"]` |
| RelationType | 칩 (관계 아이콘) | `[relationType:id=2, name="소속"]` |
| CanvasType | 칩 (캔버스타입 아이콘) | `[canvasType:id=1, name="타임라인"]` |

### 멘션 피커 동작

| 입력 | 동작 |
|---|---|
| `@` 타이핑 | 피커 팝업 열림 |
| `@` 이후 텍스트 | 실시간 필터링 (모든 엔티티 타입 통합 검색) |
| 위/아래 화살표 | 항목 탐색 |
| Enter | 선택 → 칩 삽입 |
| Esc | 피커 닫기 |
| Backspace (칩 앞에서) | 칩 삭제 |

칩은 contenteditable 내에서 편집 불가, 하나의 단위로 삭제만 가능.

---

## 세션 저장

### 저장 위치

```
%APPDATA%/netior/data/narre/
└── {project_id}/
    ├── sessions.json           ← 세션 인덱스
    ├── session_{uuid}.json     ← 개별 대화 기록
    └── ...
```

### sessions.json (인덱스)

```json
{
  "sessions": [
    {
      "id": "uuid",
      "title": "프로젝트 초기 설정",
      "created_at": "2026-03-31T10:00:00Z",
      "last_message_at": "2026-03-31T10:15:00Z",
      "message_count": 12
    }
  ]
}
```

### session_{uuid}.json (대화 기록)

```json
{
  "id": "uuid",
  "title": "프로젝트 초기 설정",
  "agent_session_id": "claude-sdk-session-id",
  "messages": [
    {
      "role": "user",
      "content": "조선시대 역사 프로젝트야",
      "mentions": [
        { "type": "concept", "id": 42, "display": "세종대왕" }
      ],
      "timestamp": "2026-03-31T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "조선시대 프로젝트에 맞는 타입을 제안합니다...",
      "tool_calls": [
        { "tool": "create_archetype", "input": {...}, "status": "success" }
      ],
      "timestamp": "2026-03-31T10:00:05Z"
    }
  ]
}
```

### Resume

`agent_session_id`를 Claude Agent SDK의 `resume` 옵션에 전달하여 이전 세션 컨텍스트 복원.

---

## 인터랙션

### 채팅 UI

| 입력 | 동작 |
|---|---|
| Enter | 메시지 전송 (빈 입력 시 무시) |
| Shift+Enter | 줄바꿈 |
| 스크롤 | 메시지 히스토리 탐색 |
| 도구 실행 로그 클릭 | 펼침/접힘 토글 |
| Esc | 입력 포커스 해제 |
| ← 목록 버튼 | 세션 목록으로 돌아가기 |

### Narre 동작 원칙

| 상황 | Narre 동작 |
|---|---|
| 프로젝트에 타입이 없을 때 | init 제안 ("어떤 분야의 프로젝트인가요?") |
| "역사 프로젝트야" | 컨텍스트 파악 → 타입 시스템 제안 → 확인 요청 |
| "좋아" / "생성해" | netior-mcp 도구 호출 → 실제 DB 생성 → 결과 보고 |
| "문헌 대신 작품으로" | 제안 수정 후 재확인 |
| 파괴적 작업 (삭제, 대량 수정) | 항상 확인 요청 후 실행 |
| 종속 데이터 있는 삭제 | 경고 ("이 아크타입을 쓰는 개념이 3개 있습니다") |

---

## Edge Case

| 상황 | 처리 |
|---|---|
| 같은 이름 타입 생성 시도 | netior-mcp 에러 → Narre가 안내 |
| 네트워크 끊김 (Claude API) | 에러 메시지 + 재시도 안내 |
| 대량 개념 목록 요청 | 도구가 페이지네이션 또는 요약 반환 |
| agent-server 프로세스 죽음 | Main에서 감지 → 에러 표시 + 재시작 |
| Narre가 DB 수정 + 사용자가 동시에 UI 수정 | WAL 모드로 DB 충돌 방지. SSE 이벤트로 UI 동기화 |
| API 키 미설정 | Narre 탭 열 때 설정 안내 |
| Narre가 5개 중 3개 생성 후 실패 | 부분 성공 허용. 완료된 것 보고 + 실패 원인 안내 |
