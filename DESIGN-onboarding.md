# DESIGN: Project Onboarding

## 개요

기존 프로젝트 디렉토리를 Netior에 가져왔을 때, 도메인을 분석해서 타입 체계(Archetype, RelationType, CanvasType)를 구축하고 Concept까지 생성하는 기능. Narre 슬래시 커맨드(`/onboarding`)로 실행.

## 프로젝트 상태별 동작

| 상태 | 조건 | 동작 |
|------|------|------|
| 파일 있음 | module_directories에 파일 존재 | 디렉토리/파일 분석 → 타입 제안 → Concept 매핑 |
| 빈 프로젝트 | 모듈 없음 또는 파일 없음 | 대화 기반 도메인 분석 → 타입 제안 |
| 불완전한 타입 | 일부 타입 존재 | 기존 타입 기반으로 보완 제안 |

## 온보딩 4단계

각 단계: 분석 → 표 형태 제안 → 유저 확인/수정 → 생성 → 다음 단계.

### 1단계: Archetype

파일 구조 또는 대화에서 개념의 종류를 추출.

```
[Narre 제안 형식]
**Archetype (3)**
| 이름 | 아이콘 | 색상 | 근거 |
|------|--------|------|------|
| 인물 | user   | #4A90D9 | characters/ 하위 12개 파일 |
| 사건 | calendar | #E74C3C | events/ 하위 8개 파일 |
| 장소 | map-pin | #2ECC71 | places/ 하위 5개 파일 |
```

### 2단계: RelationType

Archetype 간 관계를 분석. 파일 내용에서 교차 참조, 디렉토리 구조 등 근거.

```
[Narre 제안 형식]
**RelationType (2)**
| 이름 | 방향 | 근거 |
|------|------|------|
| 참여 | 방향 있음 | 인물→사건 관계 다수 발견 |
| 위치 | 방향 있음 | 사건→장소 관계 발견 |
```

### 3단계: CanvasType

RelationType의 부분집합으로 수평 관심사(관점)를 정의. RelationType 확정 후 제안.

```
[Narre 제안 형식]
**CanvasType (2)**
| 이름 | 허용 RelationType |
|------|-------------------|
| 인물 관계도 | 참여, 위치 |
| 시간순 | 참여 |
```

### 4단계: Concept

파일을 Concept으로 매핑 (파일 있는 경우) 또는 도메인 기반 제안.

```
[Narre 제안 형식]
**Concept (25)**
| 이름 | Archetype | 근거 |
|------|-----------|------|
| 세종대왕 | 인물 | characters/sejong.md |
| 임진왜란 | 사건 | events/imjin.md |
```

## 빠른 모드

소규모/빈 프로젝트에서 유저가 "한번에 해줘" 요청 시 4단계 연속 진행 (중간 확인 생략). Narre가 프로젝트 규모로 판단.

## 수정 흐름

- 유저가 제안에 수정 요청 → Narre가 수정된 표 다시 표시 → 재확인
- 이전 단계 소급 수정 가능 (이미 생성된 타입에 update 도구 호출)
- "다시 해줘" → 현재 단계 재분석
- "여기까지만" → 조기 종료

## 선행 작업

### netior-mcp 도구 추가 (6개)

| 도구 | 기능 | 제한 |
|------|------|------|
| `list_modules` | 프로젝트 모듈 목록 | - |
| `list_module_directories` | 모듈의 등록 디렉토리 목록 | - |
| `list_directory` | 디렉토리 내 파일/폴더 목록 | module_directories 하위만 |
| `read_file` | 파일 내용 읽기 | module_directories 하위만 |
| `glob_files` | 패턴 매칭 파일 검색 | module_directories 하위만 |
| `grep_files` | 파일 내용 검색 | module_directories 하위만 |

파일시스템 도구는 요청 경로가 프로젝트의 module_directories.dir_path 하위인지 검증. 범위 밖 접근 거부.

### 슬래시 커맨드 시스템

`/onboarding` 진입점. 별도 설계 문서 참조: `DESIGN-slash-commands.md`.

## Edge Case

| 케이스 | 동작 |
|--------|------|
| 모듈 0개 (디렉토리 미등록) | 파일 분석 불가 → 상태 2(대화 기반)로 폴백 |
| 온보딩 중 세션 끊김 | 이미 생성된 타입은 유지. 재접속 후 이어서 가능 |
| 이미 타입 존재 | 기존 타입 기반으로 보완 (상태 3) |
