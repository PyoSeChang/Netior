# Narre Eval Scenarios

시나리오는 `packages/narre-eval/scenarios/` 폴더에 정의됨. 각 시나리오는 하위 폴더로 관리.

## 시나리오 구조

```
scenarios/{name}/
  scenario.yaml     # 정의 (id, type, turns, verify, qualitative)
  seed.ts           # DB + 파일시스템 초기화
  responder.ts      # (conversation만) UI 카드 자동 응답
  fixtures/         # (선택) 시드용 파일
  results/          # 실행 결과 (TSV + transcripts)
```

## 현재 시나리오

### 01: init-project (single-turn)

**시드**: 빈 프로젝트
**턴**: "역사 프로젝트야. 인물, 사건, 장소 아크타입이 필요해. 만들어줘."
**검증**:
- 아크타입 3개 이상 생성 (인물, 사건, 장소 포함)
- 응답에 아크타입 이름 포함
- 에러 없음

---

### 02: type-update (single-turn)

**시드**: 아크타입 3개 (인물, 사건, 장소)
**턴**: "사건 아크타입을 문헌으로 이름 바꿔줘"
**검증**:
- 아크타입에 문헌 존재, 사건 부재
- 응답에 문헌 포함
- 에러 없음

---

### 03: cascade-delete (single-turn)

**시드**: 아크타입 1개 (인물) + Concept 1개 (세종대왕, archetype=인물)
**턴**: "인물 아크타입을 삭제해줘" → "응, 삭제해"
**검증**:
- 인물 아크타입 부재
- 세종대왕 Concept 유지
- 에러 없음

---

## 시나리오 추가 방법

1. `scenarios/` 하위에 폴더 생성
2. `scenario.yaml` 작성 (id, type, tags, turns, verify, qualitative)
3. `seed.ts` 작성 (SeedContext 사용)
4. conversation 타입이면 `responder.ts` 추가
5. 파일 시드 필요 시 `fixtures/` 폴더에 파일 배치

### verify 항목 종류

```yaml
verify:
  - name: "체크 의도 설명"     # 필수
    db:                        # DB 테이블 조회
      table: archetypes
      condition: "..."         # SQL WHERE (기본: project_id = ?)
      expect:
        count: 3               # 정확히 N개
        count_min: 1           # N개 이상
        count_max: 10          # N개 이하
        column_includes:       # 컬럼값 포함 확인
          name: ["인물", "사건"]
        not_null: [icon, color] # null이 아닌지

  - name: "레코드 부재 확인"
    db_absent:
      table: archetypes
      condition: "name = '사건'"

  - name: "도구 호출 확인"
    tool:
      name: create_archetype
      expect:
        count_min: 1
        count_max: 10

  - name: "응답 텍스트 확인"
    response:
      contains_all: ["인물", "사건"]
      contains_any: ["생성", "만들"]
      no_error: true
```
