# Narre MVP — Verification Plan

> 구현 단계마다 확인해야 할 검증 항목.
> 각 항목은 "이걸 확인하면 이 단계가 맞게 된 것"을 판단할 수 있을 정도로 구체적으로 작성한다.

---

## Phase 1: moc-core 패키지 추출

desktop-app의 DB 로직(repositories, migrations, connection)을 `packages/netior-core`로 추출.

### V1-1. 패키지 구조

- [ ] `packages/netior-core/package.json`이 존재하고 name이 `@netior/core`인지 확인.
- [ ] `pnpm install`이 에러 없이 완료되는지 확인.
- [ ] `pnpm --filter @netior/core build`가 에러 없이 완료되는지 확인.
- [ ] better-sqlite3가 moc-core의 dependency에 포함되어 있는지 확인.

### V1-2. 추출 범위

- [ ] `db/connection.ts`가 moc-core에 존재하고, DB 경로를 외부에서 주입 가능한지 확인.
- [ ] `db/migrations/*.ts`가 moc-core에 존재하는지 확인.
- [ ] `db/repositories/*.ts`가 moc-core에 존재하는지 확인 (project, concept, canvas, archetype, relationType, canvasType, conceptFile, canvasNode, edge, editorPrefs).
- [ ] moc-core가 `@netior/shared`의 타입/상수를 import하는지 확인.

### V1-3. desktop-app 연동

- [ ] desktop-app이 moc-core를 dependency로 가지는지 확인.
- [ ] desktop-app의 기존 IPC 핸들러가 moc-core의 repository를 사용하도록 변경되었는지 확인.
- [ ] desktop-app 내부에 repository/migration/connection 코드가 남아있지 않은지 확인 (중복 제거).

### V1-4. 기존 동작 보존

- [ ] `pnpm test` 전체 통과.
- [ ] `pnpm typecheck` 전체 통과.
- [ ] `pnpm dev:desktop`로 앱 실행 후 프로젝트 열기/닫기 정상.
- [ ] 개념 CRUD 정상.
- [ ] 캔버스 열기, 노드 배치, 엣지 생성 정상.
- [ ] 아크타입/관계타입/캔버스타입 CRUD 정상.
- [ ] 파일 열기 (마크다운, 이미지, 텍스트) 정상.

---

## Phase 2: netior-mcp 패키지 (MCP 서버)

moc-core를 HTTP MCP 서버로 래핑. SSE transport + 변경 이벤트 발행.

### V2-1. 패키지 구조

- [ ] `packages/netior-mcp/package.json`이 존재하고 name이 `@netior/mcp`인지 확인.
- [ ] moc-core를 dependency로 가지는지 확인.
- [ ] `pnpm --filter @netior/mcp build`가 에러 없이 완료되는지 확인.
- [ ] 환경변수 `MOC_DB_PATH`로 DB 경로를 지정할 수 있는지 확인.

### V2-2. MCP 서버 기동

- [ ] `node packages/netior-mcp/dist/index.js` 실행 시 HTTP 서버가 시작되는지 확인.
- [ ] MCP 프로토콜의 `initialize` 핸드셰이크가 정상 응답하는지 확인.
- [ ] `tools/list` 요청 시 등록된 모든 도구 목록이 반환되는지 확인.
- [ ] 서버 종료 시 DB 연결이 정리되는지 확인.

### V2-3. Archetype 도구

- [ ] `list_archetypes(project_id)` → 해당 프로젝트의 아크타입 전체 목록 반환.
- [ ] `create_archetype(project_id, name, icon, color, node_shape)` → DB에 INSERT 후 생성된 아크타입 반환.
- [ ] `create_archetype` 중복 이름 → 에러 메시지 반환 (서버 크래시 아님).
- [ ] `update_archetype(archetype_id, {name: "새이름"})` → 해당 필드만 UPDATE.
- [ ] `update_archetype` 존재하지 않는 ID → 에러 메시지 반환.
- [ ] `delete_archetype(archetype_id)` → DB에서 DELETE.
- [ ] `delete_archetype` 후 해당 아크타입을 쓰는 concept의 archetype_id가 NULL이 되는지 확인 (SET NULL cascade).

### V2-4. Relation Type 도구

- [ ] `list_relation_types(project_id)` → 전체 목록 반환. directed가 boolean으로 변환되는지 확인.
- [ ] `create_relation_type(project_id, name, directed, line_style, color)` → 생성 후 반환.
- [ ] `create_relation_type` 기본값 적용 확인: directed 미지정 시 false, line_style 미지정 시 'solid'.
- [ ] `update_relation_type(relation_type_id, {color: "#ff0000"})` → 해당 필드만 UPDATE.
- [ ] `delete_relation_type(relation_type_id)` → 삭제. 해당 타입을 쓰는 edge의 relation_type_id가 NULL이 되는지 확인.

### V2-5. Canvas Type 도구

- [ ] `list_canvas_types(project_id)` → 전체 목록 반환. allowed_relation_types 포함.
- [ ] `create_canvas_type(project_id, name, icon, color, allowed_relation_type_ids)` → 생성 후 junction 테이블까지 INSERT.
- [ ] `update_canvas_type(canvas_type_id, {name: "새이름", allowed_relation_type_ids: [1,3]})` → junction 테이블도 갱신.
- [ ] `delete_canvas_type(canvas_type_id)` → 삭제. junction 레코드도 CASCADE 삭제.

### V2-6. Concept 도구

- [ ] `list_concepts(project_id)` → 전체 목록 반환.
- [ ] `list_concepts(project_id, {query: "세종"})` → 제목 검색 결과 반환.
- [ ] `create_concept(project_id, title, archetype_id)` → 생성 후 반환.
- [ ] `create_concept` archetype_id 없이 → archetype_id NULL로 생성.
- [ ] `update_concept(concept_id, {title: "새제목", color: "#00ff00"})` → 해당 필드만 UPDATE.
- [ ] `delete_concept(concept_id)` → 삭제. 관련 canvas_node, concept_file, edge 등 CASCADE 확인.

### V2-7. Project Summary 도구

- [ ] `get_project_summary(project_id)` → 아크타입 수, 관계타입 수, 캔버스타입 수, 개념 수, 캔버스 수 포함 요약 반환.

### V2-8. 변경 이벤트 (SSE)

- [ ] SSE 엔드포인트에 클라이언트가 연결 가능한지 확인.
- [ ] `create_archetype` 호출 후 SSE 채널에 `{ type: "archetypes", action: "created", id: N }` 이벤트 발행되는지 확인.
- [ ] `update_concept` 호출 후 SSE 채널에 `{ type: "concepts", action: "updated", id: N }` 이벤트 발행되는지 확인.
- [ ] `delete_relation_type` 호출 후 SSE 이벤트 발행되는지 확인.
- [ ] 클라이언트 연결 끊김 시 서버가 에러 없이 정리하는지 확인.
- [ ] 다수 클라이언트 동시 연결 시 모든 클라이언트에 이벤트 전달되는지 확인.

### V2-9. Claude Code 등록

- [ ] Claude Code의 MCP 서버 설정에 netior-mcp를 등록할 수 있는지 확인 (stdio 모드).
- [ ] Claude Code에서 `moc__list_archetypes` 등의 도구가 인식되는지 확인.
- [ ] Claude Code에서 도구 호출 시 실제 DB에 반영되는지 확인.

### V2-10. WAL 모드

- [ ] netior-mcp 시작 시 `PRAGMA journal_mode=WAL`이 설정되는지 확인.
- [ ] netior-mcp 시작 시 `PRAGMA busy_timeout=5000`이 설정되는지 확인.
- [ ] desktop-app과 netior-mcp가 동시에 같은 DB에 접근할 때 SQLITE_BUSY 에러 없이 동작하는지 확인.

### V2-11. 테스트

- [ ] netior-mcp의 각 도구에 대한 단위 테스트 존재.
- [ ] `pnpm test` 전체 통과.
- [ ] `pnpm typecheck` 전체 통과.

---

## Phase 3: agent-server 패키지 (Narre)

Claude Agent SDK (TypeScript)로 Narre 에이전트 구현. netior-mcp를 MCP 서버로 연결.

### V3-1. 패키지 구조

- [ ] `packages/agent-server/package.json`이 존재하고 name이 `@netior/agent-server`인지 확인.
- [ ] `claude_agent_sdk` (또는 `@anthropic-ai/claude-code-sdk`)가 dependency에 포함되는지 확인.
- [ ] `@netior/shared`를 dependency로 가지는지 확인.
- [ ] `pnpm --filter @netior/agent-server build`가 에러 없이 완료되는지 확인.

### V3-2. 시스템 프롬프트 구성

- [ ] 프로젝트 이름이 시스템 프롬프트에 포함되는지 확인.
- [ ] 현재 프로젝트의 아크타입 목록이 시스템 프롬프트에 포함되는지 확인 (name, icon, color, node_shape).
- [ ] 현재 프로젝트의 관계 타입 목록이 포함되는지 확인 (name, directed, line_style, color).
- [ ] 현재 프로젝트의 캔버스 타입 목록이 포함되는지 확인 (name, allowed_relations).
- [ ] 개념 목록은 시스템 프롬프트에 포함되지 **않고** 도구로 조회하는지 확인.
- [ ] 아크타입/관계타입/캔버스타입이 0개일 때 프롬프트가 에러 없이 생성되는지 확인.

### V3-3. MCP 연결

- [ ] agent-server가 netior-mcp에 HTTP로 연결하는지 확인.
- [ ] netior-mcp의 모든 도구가 agent에서 사용 가능한지 확인.
- [ ] 도구 호출 시 netior-mcp가 실제 DB를 수정하는지 확인.

### V3-4. 세션 관리

- [ ] 새 세션 시작 시 고유 session_id가 생성되는지 확인.
- [ ] 기존 session_id로 resume 시 이전 대화 컨텍스트가 복원되는지 확인.
- [ ] resume 후 이전 대화 내용을 참조하는 질문에 정상 응답하는지 확인.

### V3-5. 스트리밍 응답

- [ ] agent-server가 SSE로 응답을 스트리밍하는지 확인.
- [ ] 텍스트 토큰이 실시간으로 전달되는지 확인.
- [ ] 도구 호출 시작/완료 이벤트가 스트리밍에 포함되는지 확인.
- [ ] 최종 결과(ResultMessage)가 스트림 종료와 함께 전달되는지 확인.

### V3-6. Init 시나리오

- [ ] "역사 프로젝트야" 입력 → 아크타입, 관계타입, 캔버스타입 제안 응답이 오는지 확인.
- [ ] "좋아, 생성해" 입력 → 실제 도구 호출로 DB에 타입들이 생성되는지 확인.
- [ ] "문헌 대신 작품으로" → 수정된 제안 후 생성되는지 확인.

### V3-7. CRUD 시나리오

- [ ] "아크타입 목록 보여줘" → `list_archetypes` 호출 → 포맷팅된 목록 응답.
- [ ] "인물 아크타입 만들어줘" → `create_archetype` 호출 → 생성 결과 응답.
- [ ] "인물 아크타입 색상 파란색으로" → `update_archetype` 호출 → 수정 결과 응답.
- [ ] "인물 아크타입 삭제해줘" → 확인 요청 → 승인 후 `delete_archetype` 호출.
- [ ] 관계타입, 캔버스타입, 개념에 대해서도 동일한 CRUD 패턴이 동작하는지 확인.

### V3-8. 파괴적 작업 확인

- [ ] 삭제 요청 시 Narre가 확인을 요청하는지 확인.
- [ ] 종속 데이터가 있는 삭제 시 경고 메시지가 포함되는지 확인.
- [ ] 대량 수정(init으로 10개 이상 생성) 시에도 정상 동작하는지 확인.

### V3-9. API 키

- [ ] `ANTHROPIC_API_KEY` 환경변수로 API 키를 전달할 수 있는지 확인.
- [ ] API 키가 없을 때 명확한 에러 메시지가 반환되는지 확인.
- [ ] 잘못된 API 키일 때 에러 메시지가 반환되는지 확인 (크래시 아님).

---

## Phase 4: Desktop-app — Narre 에디터 탭

EditorTabType에 'narre' 추가, 세션 목록/채팅 화면 기본 구조.

### V4-1. EditorTabType 확장

- [ ] `EditorTabType`에 `'narre'`가 추가되었는지 확인.
- [ ] `@netior/shared` 타입이 업데이트되었는지 확인.
- [ ] `pnpm --filter @netior/shared build` 후 `pnpm typecheck` 통과.

### V4-2. 탭 열기

- [ ] 사이드바 또는 메뉴에서 Narre 탭을 열 수 있는지 확인.
- [ ] Narre 탭에 전용 아이콘이 표시되는지 확인.
- [ ] Narre 탭이 에디터 독에 정상적으로 배치되는지 확인.
- [ ] 다른 에디터 탭과 함께 탭 전환이 정상인지 확인.
- [ ] Narre 탭을 닫았다 다시 열어도 정상인지 확인.

### V4-3. 세션 목록 화면

- [ ] Narre 탭 초기 진입 시 세션 목록이 표시되는지 확인.
- [ ] 각 세션에 제목, 시간, 메시지 수가 표시되는지 확인.
- [ ] 세션이 없을 때 빈 상태 안내가 표시되는지 확인.
- [ ] "새 대화" 버튼이 존재하고 클릭 시 빈 채팅 화면으로 전환되는지 확인.
- [ ] 세션 클릭 시 해당 대화 내역이 로드되는지 확인.
- [ ] 세션 목록이 최신순 정렬인지 확인.

### V4-4. 세션 저장/로드

- [ ] `%APPDATA%/netior/data/narre/{project_id}/` 디렉토리가 생성되는지 확인.
- [ ] 새 대화 시작 시 `sessions.json`에 항목이 추가되는지 확인.
- [ ] 메시지 전송/수신 시 `session_{uuid}.json`에 기록되는지 확인.
- [ ] 앱 재시작 후 세션 목록이 복원되는지 확인.
- [ ] 앱 재시작 후 세션 클릭 시 전체 대화 내역이 로드되는지 확인.
- [ ] 프로젝트 전환 시 해당 프로젝트의 세션만 표시되는지 확인.

### V4-5. API 키 설정

- [ ] API 키 미설정 시 Narre 탭에서 설정 안내가 표시되는지 확인.
- [ ] API 키 입력 UI가 존재하는지 확인.
- [ ] 입력된 API 키가 `%APPDATA%/moc/config.json`에 저장되는지 확인.
- [ ] 저장된 API 키가 앱 재시작 후에도 유지되는지 확인.
- [ ] API 키가 UI에 평문으로 노출되지 않는지 확인 (마스킹).

---

## Phase 5: Desktop-app — 채팅 UI

메시지 렌더링, 스트리밍 표시, 도구 실행 로그.

### V5-1. 메시지 렌더링

- [ ] 사용자 메시지가 우측 정렬, `accent-muted` 배경으로 표시되는지 확인.
- [ ] Narre 메시지가 좌측 정렬, `surface-card` 배경으로 표시되는지 확인.
- [ ] Narre 메시지에 마크다운이 렌더링되는지 확인 (볼드, 리스트, 코드블록 등).
- [ ] 메시지 영역이 `max-w-[600px]` 중앙 정렬인지 확인.
- [ ] 메시지가 많을 때 스크롤이 정상인지 확인.
- [ ] 새 메시지 수신 시 자동 스크롤다운되는지 확인.
- [ ] 사용자가 위로 스크롤한 상태에서는 자동 스크롤하지 않는지 확인.

### V5-2. 스트리밍 표시

- [ ] Narre 응답이 토큰 단위로 점진적으로 표시되는지 확인.
- [ ] 스트리밍 중 메시지 버블이 실시간으로 확장되는지 확인.
- [ ] 스트리밍 중 입력창이 비활성화되는지 확인.
- [ ] 스트리밍 완료 후 입력창이 다시 활성화되는지 확인.

### V5-3. 도구 실행 로그

- [ ] 도구 호출 시 접힌 상태의 실행 로그가 표시되는지 확인 ("▶ 도구 실행 (3/5)").
- [ ] 클릭 시 펼쳐져 개별 도구 상태가 보이는지 확인.
- [ ] 진행 중 도구: ⟳ 아이콘 + 도구 이름.
- [ ] 완료 도구: ✓ 아이콘 + 도구 이름 + 요약.
- [ ] 실패 도구: ✗ 아이콘 + 도구 이름 + 에러.
- [ ] 대기 중 도구: ○ 아이콘 + 도구 이름.
- [ ] 모든 도구 완료 후 카운터가 최종 상태를 반영하는지 확인 ("✓ 도구 실행 (5/5)").

### V5-4. 에러 표시

- [ ] 네트워크 에러 시 에러 메시지가 표시되는지 확인.
- [ ] API 키 에러 시 명확한 안내가 표시되는지 확인.
- [ ] agent-server 연결 실패 시 에러 메시지가 표시되는지 확인.
- [ ] 에러 후 재시도(새 메시지 입력)가 가능한지 확인.

### V5-5. 레이아웃

- [ ] 입력 영역이 하단 고정인지 확인.
- [ ] 메시지 영역 높이가 입력 영역을 제외한 나머지를 채우는지 확인.
- [ ] 채팅 화면에서 "← 목록" 버튼이 세션 목록으로 돌아가는지 확인.
- [ ] semantic token만 사용하는지 확인 (하드코딩 색상 클래스 없음).

---

## Phase 6: Desktop-app — 멘션 입력 (ContentEditable)

`@` 트리거 멘션 시스템.

### V6-1. ContentEditable 기본 동작

- [ ] 입력 영역이 contenteditable로 동작하는지 확인.
- [ ] 일반 텍스트 입력이 정상인지 확인.
- [ ] Enter로 전송, Shift+Enter로 줄바꿈이 되는지 확인.
- [ ] 빈 입력 시 전송이 무시되는지 확인.
- [ ] 전송 후 입력 영역이 비워지는지 확인.

### V6-2. 멘션 피커 트리거

- [ ] `@` 입력 시 멘션 피커 팝업이 열리는지 확인.
- [ ] `@` 이후 텍스트 입력 시 실시간 필터링되는지 확인.
- [ ] 필터링이 모든 엔티티 타입(개념, 캔버스, 아크타입 등)을 통합 검색하는지 확인.
- [ ] 검색 결과가 카테고리별로 그룹핑되는지 확인.
- [ ] 검색 결과가 없을 때 "결과 없음" 표시가 나오는지 확인.

### V6-3. 멘션 피커 탐색

- [ ] 위/아래 화살표로 항목 탐색이 되는지 확인.
- [ ] Enter로 현재 선택 항목이 삽입되는지 확인.
- [ ] Esc로 피커가 닫히는지 확인.
- [ ] 피커 외부 클릭으로 피커가 닫히는지 확인.
- [ ] 마우스 클릭으로도 항목 선택이 가능한지 확인.

### V6-4. 칩 삽입

- [ ] 선택한 엔티티가 칩(인라인 태그)으로 삽입되는지 확인.
- [ ] 칩이 해당 엔티티 타입의 색상을 반영하는지 확인 (아크타입 색상, 캔버스타입 색상 등).
- [ ] 칩에 엔티티 이름이 표시되는지 확인.
- [ ] 칩 내부 텍스트가 편집 불가인지 확인.
- [ ] 칩 앞뒤에 커서 이동이 정상인지 확인.
- [ ] Backspace로 칩이 하나의 단위로 삭제되는지 확인.
- [ ] 한 메시지에 여러 칩을 삽입해도 정상인지 확인.

### V6-5. 프롬프트 변환

- [ ] 전송 시 칩이 구조화된 참조로 변환되는지 확인: `[concept:id=42, title="세종대왕"]`.
- [ ] 일반 텍스트와 칩 참조가 혼합된 메시지가 올바르게 직렬화되는지 확인.
- [ ] Narre가 변환된 참조의 ID를 인식하여 정확한 엔티티를 대상으로 동작하는지 확인.

### V6-6. 멘션 가능 엔티티

- [ ] Concept 멘션 가능: 아크타입 색상 칩, `[concept:id=N, title="..."]` 변환.
- [ ] Canvas 멘션 가능: 캔버스타입 색상 칩, `[canvas:id=N, name="..."]` 변환.
- [ ] Archetype 멘션 가능: 아크타입 아이콘 칩, `[archetype:id=N, name="..."]` 변환.
- [ ] RelationType 멘션 가능: 관계 아이콘 칩, `[relationType:id=N, name="..."]` 변환.
- [ ] CanvasType 멘션 가능: 캔버스타입 아이콘 칩, `[canvasType:id=N, name="..."]` 변환.
- [ ] Module 멘션 가능: 폴더 아이콘 칩, `[module:path="..."]` 변환.
- [ ] File 멘션 가능: 파일 아이콘 칩, `[file:path="..."]` 변환.
- [ ] Edge 멘션 가능: 관계타입 색상 칩, `[edge:id=N, source="...", target="..."]` 변환.

---

## Phase 7: Desktop-app — DB 변경 동기화

netior-mcp의 SSE 변경 이벤트를 구독하여 Zustand 스토어 갱신.

### V7-1. SSE 구독

- [ ] desktop-app Main 프로세스가 netior-mcp의 SSE 엔드포인트에 연결하는지 확인.
- [ ] 연결 끊김 시 자동 재연결하는지 확인.
- [ ] netior-mcp가 실행 중이 아닐 때 에러 없이 대기하는지 확인.

### V7-2. 스토어 갱신

- [ ] SSE `{ type: "archetypes" }` 수신 → Renderer의 아크타입 스토어가 refetch되는지 확인.
- [ ] SSE `{ type: "concepts" }` 수신 → Renderer의 개념 스토어가 refetch되는지 확인.
- [ ] SSE `{ type: "relationTypes" }` 수신 → Renderer의 관계타입 스토어가 refetch되는지 확인.
- [ ] SSE `{ type: "canvasTypes" }` 수신 → Renderer의 캔버스타입 스토어가 refetch되는지 확인.

### V7-3. UI 반영

- [ ] Narre가 아크타입을 생성한 후, 사이드바/에디터의 아크타입 목록에 즉시 반영되는지 확인.
- [ ] Narre가 개념을 생성한 후, 사이드바의 개념 목록에 즉시 반영되는지 확인.
- [ ] Narre가 관계타입을 수정한 후, 캔버스의 엣지 스타일이 갱신되는지 확인.
- [ ] Narre가 타입을 삭제한 후, UI에서 즉시 제거되는지 확인.

### V7-4. 충돌 없음

- [ ] Narre가 DB를 수정하는 동시에 사용자가 UI에서 다른 데이터를 수정해도 양쪽 모두 정상 저장되는지 확인.
- [ ] WAL 모드에서 desktop-app과 netior-mcp의 동시 읽기가 에러 없이 동작하는지 확인.
- [ ] 동시 쓰기 시 busy_timeout 내에 완료되는지 확인 (SQLITE_BUSY 없음).

---

## Phase 8: 통합 시나리오 검증

전체 시스템을 연결하여 실제 사용 시나리오 검증.

### V8-1. Init 시나리오 (End-to-End)

- [ ] 빈 프로젝트에서 Narre 탭 열기 → 세션 목록 비어있음 확인.
- [ ] "조선시대 역사 프로젝트야" 입력 → Narre가 타입 시스템 제안 (스트리밍).
- [ ] 제안 내용에 아크타입, 관계타입, 캔버스타입이 포함되어 있는지 확인.
- [ ] "좋아, 생성해" → 도구 실행 로그가 표시되며 순차적으로 완료.
- [ ] 도구 실행 완료 후 사이드바에 생성된 아크타입/관계타입이 즉시 반영되는지 확인.
- [ ] 세션이 자동 저장되었는지 확인 (파일 존재).
- [ ] 앱 재시작 → Narre 탭 → 세션 목록에 해당 세션 존재 → 클릭 → 대화 내역 복원.

### V8-2. CRUD 시나리오 (End-to-End)

- [ ] "인물 아크타입의 색상을 파란색으로 바꿔줘" → Narre가 `update_archetype` 호출 → 사이드바 아크타입 색상 갱신.
- [ ] "새 개념 만들어줘: 세종대왕, 아크타입은 인물" → `create_concept` → 사이드바 개념 목록에 추가.
- [ ] "@세종대왕 개념을 삭제해줘" (멘션 사용) → 확인 요청 → 승인 → 삭제 → UI 반영.

### V8-3. 멘션 시나리오 (End-to-End)

- [ ] 입력창에 "@인" 타이핑 → 멘션 피커에 "인물" 아크타입 표시.
- [ ] "인물" 선택 → 칩 삽입.
- [ ] "[인물] 아크타입의 아이콘을 변경해줘" 전송.
- [ ] Narre가 멘션된 아크타입 ID를 정확히 인식하여 해당 아크타입을 수정하는지 확인.

### V8-4. Resume 시나리오

- [ ] 대화 중 앱 종료 → 재시작 → Narre 탭 → 이전 세션 클릭.
- [ ] 이전 대화 내역이 화면에 표시되는지 확인.
- [ ] "아까 만든 아크타입에 필드 추가해줘" → Narre가 이전 컨텍스트를 기억하고 응답하는지 확인.

### V8-5. Claude Code 연동 시나리오

- [ ] Claude Code에 netior-mcp를 MCP 서버로 등록.
- [ ] Claude Code에서 "이 프로젝트의 아크타입 목록을 보여줘" → netior-mcp 도구 호출 → 결과 반환.
- [ ] Claude Code에서 아크타입 생성 → desktop-app이 켜져 있으면 SSE로 UI 갱신.
- [ ] Claude Code 단독 사용(desktop-app 미실행) 시에도 DB 접근 정상.

---

## Phase 9: Edge Case

### V9-1. 네트워크/프로세스 장애

- [ ] agent-server 응답 중 네트워크 끊김 → 에러 메시지 표시, 앱 크래시 없음.
- [ ] netior-mcp 프로세스 죽음 → 앱 자체는 정상 동작 (직접 DB 접근으로 fallback).
- [ ] Claude API rate limit → 에러 메시지 + 재시도 안내.
- [ ] Claude API timeout → 에러 메시지 표시.

### V9-2. 대량 데이터

- [ ] 개념 500개인 프로젝트에서 "개념 목록" 요청 → 합리적 시간 내 응답.
- [ ] 개념 500개인 프로젝트에서 시스템 프롬프트가 토큰 한도를 초과하지 않는지 확인 (개념은 프롬프트에 안 넣으니까).
- [ ] 긴 대화 (50턴 이상)에서 성능 저하 없이 동작하는지 확인.

### V9-3. 동시 조작

- [ ] Narre가 아크타입을 생성하는 도중에 사용자가 UI에서 다른 아크타입을 삭제해도 양쪽 다 정상.
- [ ] Narre가 개념을 수정하는 도중에 사용자가 같은 개념의 다른 필드를 수정 → 마지막 쓰기 우선.

### V9-4. 멘션 Edge Case

- [ ] 삭제된 엔티티를 멘션한 칩이 포함된 메시지 전송 → Narre가 "해당 엔티티가 존재하지 않습니다" 응답.
- [ ] 이름에 특수문자가 포함된 엔티티 멘션 가능한지 확인.
- [ ] 멘션 피커에서 엔티티가 0개일 때 빈 상태 처리.

### V9-5. 세션 Edge Case

- [ ] 세션 파일이 손상되었을 때 앱 크래시 없이 에러 처리되는지 확인.
- [ ] 디스크 용량 부족 시 세션 저장 실패 → 에러 메시지 표시.
- [ ] 프로젝트 삭제 후 해당 프로젝트의 세션 목록이 비어있는지 확인.

---

## 전 Phase 공통

### 테스트

- [ ] 각 Phase 완료 후 `pnpm test` 전체 통과.
- [ ] 각 Phase 완료 후 `pnpm typecheck` 전체 통과.

### 수동 검증

- [ ] 각 Phase 완료 후 `pnpm dev:desktop`로 앱 실행하여 해당 Phase의 항목을 수동으로 확인.

### i18n

- [ ] Narre 관련 새 문자열이 en.json, ko.json 양쪽에 존재하는지 확인.
- [ ] 한국어/영어 전환 시 Narre UI의 모든 텍스트가 올바르게 변하는지 확인.

### 시맨틱 토큰

- [ ] Narre UI에 하드코딩 색상 클래스가 없는지 확인.
- [ ] surface, text, border, accent 시맨틱 토큰만 사용하는지 확인.
