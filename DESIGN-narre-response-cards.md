# DESIGN: Narre Response Cards

## 개요

Narre 채팅 메시지의 리치 렌더링 시스템. 마크다운 렌더링 + 구조화된 인터랙티브 카드 컴포넌트.

## 현재 상태

- plain text + whitespace-pre-wrap (마크다운 렌더링 없음)
- 멘션 칩만 유일한 리치 요소
- 도구 로그 접기/펼치기 (NarreToolLog)

## 목표

1. 마크다운 렌더링 도입 (react-markdown + remark-gfm)
2. 구조화된 카드 컴포넌트 (proposal, permission, summary 등)
3. 카드 타입 추가 시 렌더링 로직 변경 최소화되는 공통 구조

## 마크다운 렌더링

react-markdown + remark-gfm으로 기존 plain text 교체.

지원 요소: 표, 코드블록, 리스트, 볼드/이탤릭, 링크, 인라인 코드.

향후 통합 에디터(컨셉 링크, 캔버스 링크 등) 만들 때 교체 예정. CodeMirror 6도 해당 시점에 교체. 지금은 가볍게 출발.

## 카드 타입

| 타입 | 용도 | 인터랙션 |
|------|------|----------|
| text | 일반 응답 | 마크다운 렌더링 (읽기 전용) |
| proposal | 타입/Concept 제안 | 인라인 셀 편집, 행 추가/삭제, 확인/재분석 버튼 |
| permission | 파괴적 작업 확인 | 확인/거부 버튼 |
| summary | 실행 결과 요약 | 성공/실패 아이콘 + 항목 리스트 (읽기 전용) |
| tool_log | 도구 실행 로그 | 접기/펼치기 (기존 NarreToolLog) |

## ProposalCard

온보딩 4단계(Archetype, RelationType, CanvasType, Concept)에서 공용으로 사용. 컬럼 정의만 바꿔서 재사용.

### 시각 구조

```
┌─ {title} ─────────────────────────────────┐
│                                            │
│  {col1}    {col2}     {col3}    {col4}     │
│  [editable][editable] [editable][readonly] │
│  [editable][editable] [editable][readonly] │
│  [editable][editable] [editable][readonly] │
│                                            │
│  [+ 추가]                                  │
│                                            │
│              [수정 완료] [다시 분석]          │
└────────────────────────────────────────────┘
```

### 컬럼 정의 기반 렌더링

컬럼 정의에 따라 셀의 렌더링/에디팅 방식이 결정됨.

**셀 타입:**

| 셀 타입 | 표시 | 편집 |
|---------|------|------|
| text | 텍스트 | Input |
| icon | 아이콘 미리보기 | IconSelector |
| color | 색상 칩 | ColorPicker |
| enum | 라벨 | Select |
| boolean | 체크/X | Toggle |
| readonly | 텍스트 | 편집 불가 |

### 단계별 컬럼 구성

**Archetype:**

| 컬럼 | 셀 타입 |
|------|---------|
| 이름 | text |
| 아이콘 | icon |
| 색상 | color |
| 근거 | readonly |

**RelationType:**

| 컬럼 | 셀 타입 |
|------|---------|
| 이름 | text |
| 방향 | boolean |
| 선 스타일 | enum (solid/dashed/dotted) |
| 근거 | readonly |

**CanvasType:**

| 컬럼 | 셀 타입 |
|------|---------|
| 이름 | text |
| 허용 RelationType | enum (다중 선택) |
| 근거 | readonly |

**Concept:**

| 컬럼 | 셀 타입 |
|------|---------|
| 이름 | text |
| Archetype | enum |
| 근거 | readonly |

### 인터랙션

| 입력 | 동작 |
|------|------|
| 셀 클릭 | 편집 모드 진입 (editable 셀만) |
| 셀 외부 클릭 | 편집 완료 |
| [+ 추가] | 빈 행 추가 |
| 행 삭제 (X 버튼 또는 hover) | 해당 행 제거 |
| [수정 완료] | 확정된 데이터를 Narre에게 전달 → 생성 실행 |
| [다시 분석] | 현재 단계 재분석 요청 |

### 버튼 클릭 시 데이터 흐름

"수정 완료" 클릭:
1. ProposalCard가 편집된 rows 데이터를 수집
2. 유저 메시지로 전송 (구조화된 데이터 + "이대로 생성해줘")
3. Narre가 데이터 기반으로 create 도구 호출
4. 결과를 summary 카드로 반환

## PermissionCard

```
┌─────────────────────────────────────┐
│ ⚠ 인물 아크타입을 삭제하면           │
│   세종대왕 개념의 아크타입이          │
│   해제됩니다.                        │
│                                     │
│              [취소] [삭제]            │
└─────────────────────────────────────┘
```

버튼 클릭 → 유저 응답으로 Narre에게 전달.

## SummaryCard

```
┌─────────────────────────────────────┐
│ ✓ Archetype 3개 생성 완료            │
│   ✓ 인물                            │
│   ✓ 사건                            │
│   ✓ 장소                            │
└─────────────────────────────────────┘
```

읽기 전용. 성공/실패 상태 표시.

## 도구 아키텍처

카드는 Narre(LLM)가 **UI 도구를 호출**해서 생성. Claude Code의 AskUserQuestion 패턴과 동일.

### 도구 소속 분리

```
netior-mcp (데이터 도구)           agent-server (UI 도구)
├── create_archetype            ├── propose
├── list_concepts               ├── ask
├── read_file                   ├── confirm
├── ...                         └── ...
```

- netior-mcp: 순수 데이터 조작. Claude Code에서도 연결 가능.
- agent-server UI 도구: Narre 전용. 프론트엔드 렌더링 필요하므로 Claude Code에서는 사용 불가.

### UI 도구 목록

| 도구 | 용도 | 카드 타입 |
|------|------|-----------|
| propose | 타입/Concept 제안 (편집 가능 표) | proposal |
| ask | 구조화된 질문 (선택지 제시) | interview |
| confirm | 파괴적 작업 확인 요청 | permission |

summary, tool_log는 도구 호출 아님. 기존 SSE 이벤트(tool_start/tool_end)와 텍스트로 처리.

### 데이터 흐름

```
LLM이 UI 도구 호출 (예: propose)
  → agent-server가 tool_call 가로챔
  → SSE event: card { type, payload } 로 프론트엔드 전달
  → 프론트엔드가 카드 컴포넌트 렌더링
  → 유저가 편집/버튼 클릭
  → 유저 응답이 tool result로 LLM에게 반환
  → LLM이 다음 동작 결정 (생성 실행, 재분석 등)
```

## SSE 이벤트 확장

기존 이벤트에 카드 이벤트 추가:

```
기존:
  event: text        — 텍스트 청크
  event: tool_start  — 도구 실행 시작
  event: tool_end    — 도구 실행 결과
  event: done        — 완료
  event: error       — 에러

추가:
  event: card        — 카드 데이터 ({ type, ...payload })
```

card 이벤트의 payload는 카드 타입에 따라 다름. 프론트엔드는 type으로 분기해서 해당 컴포넌트 렌더링.

## 핵심 원칙

- 데이터 도구(netior-mcp)와 UI 도구(agent-server) 명확히 분리.
- UI 도구 호출 → SSE card 이벤트 → 프론트엔드 카드 → 유저 응답 → tool result. 이 루프가 핵심.
- 카드 타입 추가 = UI 도구 정의 + 카드 컴포넌트 작성 + 등록. 렌더링 로직 변경 없이.
- ProposalCard는 컬럼 정의 기반 공용 컴포넌트. 단계별 컬럼만 교체.
- 마크다운은 react-markdown으로 시작. 향후 통합 에디터 시점에 교체.
