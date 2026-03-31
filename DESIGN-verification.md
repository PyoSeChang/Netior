# Canvas Layout — Verification Plan

> 구현 단계마다 확인해야 할 검증 항목.
> 각 항목은 "이걸 확인하면 이 단계가 맞게 된 것"을 판단할 수 있을 정도로 구체적으로 작성한다.

---

## Phase 1: DB Migration

canvas 테이블에 layout, layout_config 컬럼 추가.

### V1-1. 마이그레이션 적용

- [ ] 앱 시작 시 migration이 실행되어 canvas 테이블에 layout, layout_config 컬럼이 존재하는지 확인.
- [ ] 기존 canvas 행들의 layout 값이 모두 'freeform'인지 확인.
- [ ] 기존 canvas 행들의 layout_config 값이 null인지 확인.

### V1-2. 기존 동작 무결성

- [ ] 마이그레이션 후 앱을 실행하여 기존 캔버스가 정상적으로 열리는지 확인.
- [ ] 기존 캔버스에서 노드 배치, 팬, 줌, 엣지 생성이 이전과 동일하게 동작하는지 확인.
- [ ] 캔버스 생성/삭제가 정상 동작하는지 확인.

### V1-3. 테스트

- [ ] 기존 canvas repository 테스트가 모두 통과하는지 확인 (`pnpm test`).
- [ ] canvas create 시 layout 기본값이 'freeform'으로 들어가는지 테스트에서 확인.
- [ ] canvas create 시 layout_config를 지정하면 해당 값이 저장되는지 테스트에서 확인.
- [ ] canvas update로 layout, layout_config를 변경할 수 있는지 테스트에서 확인.
- [ ] getCanvasFull 결과에 layout, layout_config 필드가 포함되는지 확인.

---

## Phase 2: Shared Types 업데이트

Canvas, CanvasCreate, CanvasUpdate 타입에 layout, layout_config 추가.

### V2-1. 타입 정합성

- [ ] `pnpm --filter @moc/shared build`가 에러 없이 완료되는지 확인.
- [ ] `pnpm typecheck`가 에러 없이 완료되는지 확인.
- [ ] Canvas 타입에 layout(string), layout_config(Record 또는 null) 필드가 존재하는지 확인.
- [ ] CanvasCreate 타입에 layout(선택), layout_config(선택) 필드가 존재하는지 확인.
- [ ] CanvasUpdate 타입에 layout(선택), layout_config(선택) 필드가 존재하는지 확인.

### V2-2. 의존 패키지

- [ ] desktop-app에서 shared 타입 import가 정상인지 확인.
- [ ] 기존 Canvas 타입을 사용하는 모든 파일이 타입 에러 없이 컴파일되는지 확인.

---

## Phase 3: Repository 업데이트

canvas repository의 create, update, getCanvasFull 등에서 새 컬럼 처리.

### V3-1. Create

- [ ] layout 없이 canvas 생성 시 DB에 'freeform'이 저장되는지 확인.
- [ ] layout='horizontal-timeline'으로 canvas 생성 시 해당 값이 저장되는지 확인.
- [ ] layout_config에 JSON 객체를 넣으면 직렬화되어 저장되고, 조회 시 파싱되어 돌아오는지 확인.

### V3-2. Update

- [ ] 기존 canvas의 layout을 'horizontal-timeline'으로 변경 후 조회하면 변경된 값이 반환되는지 확인.
- [ ] layout_config를 업데이트하면 변경된 JSON이 저장되는지 확인.
- [ ] layout만 업데이트하고 layout_config는 건드리지 않았을 때, 기존 layout_config가 유지되는지 확인.

### V3-3. Read

- [ ] getCanvas 결과에 layout, layout_config가 포함되는지 확인.
- [ ] getCanvasFull 결과에 layout, layout_config가 포함되는지 확인.
- [ ] layout_config가 null인 canvas를 조회하면 null로 반환되는지 확인 (빈 문자열이 아닌 null).
- [ ] layout_config가 복잡한 JSON(field_mappings 포함)인 경우 정확히 파싱되는지 확인.

### V3-4. 테스트

- [ ] `pnpm test` 전체 통과.
- [ ] 새로 추가한 테스트 케이스들이 모두 통과하는지 확인.

---

## Phase 4: Plugin Interface & Registry

플러그인 인터페이스 정의, 레지스트리 구현, freeform 플러그인 등록.

### V4-1. 인터페이스 파일

- [ ] `pnpm typecheck` 통과.
- [ ] CanvasLayoutPlugin 인터페이스가 네 가지 책임(배치, 시각, 인터랙션, 노드 분류)을 모두 포함하는지 확인.
- [ ] FieldRequirement, ConfigField, InteractionConstraints 등 하위 타입이 정의되어 있는지 확인.

### V4-2. 레지스트리

- [ ] registerLayout으로 플러그인 등록 후 getLayout으로 조회하면 동일 객체가 반환되는지 확인.
- [ ] 등록되지 않은 키로 getLayout 호출 시 freeform 플러그인이 반환되는지 확인.
- [ ] listLayouts가 등록된 모든 플러그인 목록을 반환하는지 확인.

### V4-3. Freeform 플러그인

- [ ] freeform 플러그인의 key가 'freeform'인지 확인.
- [ ] interactionConstraints가 panAxis: null, nodeDragAxis: null, enableSpanResize: false인지 확인.
- [ ] classifyNodes가 모든 노드를 cardNodes로 분류하고 overlayNodes는 빈 배열인지 확인.
- [ ] computeLayout이 노드의 기존 position_x/y를 그대로 반환하는지 확인.
- [ ] BackgroundComponent가 기존 dot grid를 렌더링하는지 확인.
- [ ] OverlayComponent가 없거나 null인지 확인.

---

## Phase 5: ConceptWorkspace 리팩토링

ConceptWorkspace가 canvas.layout 값으로 플러그인을 조회하고, 렌더링 위임.

### V5-1. 플러그인 해석

- [ ] currentCanvas의 layout 값이 'freeform'일 때 freeform 플러그인이 선택되는지 확인.
- [ ] currentCanvas의 layout 값이 없거나 알 수 없는 값일 때 freeform으로 fallback하는지 확인.

### V5-2. 렌더링 위임

- [ ] Background 위치에 plugin.BackgroundComponent가 렌더링되는지 확인.
- [ ] plugin.OverlayComponent가 존재하면 EdgeLayer와 NodeLayer 사이에 렌더링되는지 확인.
- [ ] plugin.OverlayComponent가 없으면 해당 위치에 아무것도 렌더링되지 않는지 확인.
- [ ] NodeLayer에 plugin.classifyNodes의 cardNodes만 전달되는지 확인.

### V5-3. 메타데이터 매핑

- [ ] canvas.layout_config에 field_mappings가 있을 때, 각 concept 노드의 concept_properties가 로드되는지 확인.
- [ ] field_mappings에 따라 concept_properties 값이 표준 메타데이터(time_value 등)로 변환되어 노드에 붙는지 확인.
- [ ] field_mappings가 없는 archetype의 노드는 metadata가 비어 있는지 확인.
- [ ] layout_config가 null(freeform)이면 매핑 로직을 건너뛰는지 확인.

### V5-4. 기존 동작 보존 (가장 중요)

- [ ] freeform 상태에서 노드 클릭 → 선택 동작 변화 없음.
- [ ] freeform 상태에서 노드 더블클릭 → 에디터 열기 동작 변화 없음.
- [ ] freeform 상태에서 노드 우클릭 → 컨텍스트 메뉴 동작 변화 없음.
- [ ] freeform 상태에서 노드 드래그 → 자유 이동 동작 변화 없음.
- [ ] freeform 상태에서 캔버스 팬 → 자유 팬 동작 변화 없음.
- [ ] freeform 상태에서 줌 → zoom-toward-cursor 동작 변화 없음.
- [ ] freeform 상태에서 Shift+드래그 → 선택 박스 동작 변화 없음.
- [ ] freeform 상태에서 엣지 생성 → 기존과 동일.
- [ ] freeform 상태에서 Ctrl+wheel → 캔버스 계층 이동 동작 변화 없음.
- [ ] freeform 상태에서 Delete 키 → 선택 노드 삭제 동작 변화 없음.
- [ ] freeform 상태에서 배경 dot grid 렌더링 동작 변화 없음.
- [ ] freeform 상태에서 뷰포트 저장/복원 동작 변화 없음.
- [ ] freeform 상태에서 파일/디렉토리 드래그 앤 드롭 동작 변화 없음.

---

## Phase 6: InteractionLayer 리팩토링

renderingMode 문자열 분기 → InteractionConstraints 구조체 기반으로 전환.

### V6-1. 제약 적용

- [ ] panAxis가 null이면 X, Y 모두 자유롭게 팬되는지 확인.
- [ ] panAxis가 'x'이면 Y 팬이 0으로 고정되는지 확인.
- [ ] panAxis가 'y'이면 X 팬이 0으로 고정되는지 확인.
- [ ] nodeDragAxis가 null이면 X, Y 모두 자유롭게 드래그되는지 확인.
- [ ] nodeDragAxis가 'x'이면 Y 드래그 오프셋이 0으로 고정되는지 확인.
- [ ] nodeDragAxis가 'y'이면 X 드래그 오프셋이 0으로 고정되는지 확인.

### V6-2. Span Resize

- [ ] enableSpanResize가 false이면 span resize 핸들이 렌더링되지 않는지 확인.
- [ ] enableSpanResize가 true이면 span resize 핸들이 밴드 양쪽 끝에 나타나는지 확인.
- [ ] 핸들 드래그 시 spanResizeOffset이 정확히 업데이트되는지 확인.
- [ ] 마우스를 놓으면 onSpanResizeEnd 콜백이 호출되는지 확인.

### V6-3. 기존 동작 보존

- [ ] freeform(constraints 모두 null/false) 상태에서 Phase 5의 V5-4 항목 전부 재검증.

---

## Phase 7: Horizontal Timeline Plugin

### V7-1. 배경 (TimelineBackground)

- [ ] 수평 축 라인이 캔버스 전체 너비에 걸쳐 렌더링되는지 확인.
- [ ] 축 라인이 캔버스 좌표계의 고정 Y 위치에 있는지 확인.
- [ ] 팬 시 축 라인이 viewport 변환에 따라 정확히 이동하는지 확인.
- [ ] 줌 시 축 라인이 viewport 변환에 따라 정확히 스케일되는지 확인.
- [ ] 눈금이 tick_interval 간격으로 표시되는지 확인.
- [ ] 눈금 라벨에 unit 접미사가 붙는지 확인 (예: "100년").
- [ ] tick_interval을 변경하면 눈금 간격이 변하는지 확인.
- [ ] unit을 변경하면 라벨이 변하는지 확인.

### V7-2. 배치 (computeLayout)

- [ ] time_value가 있는 노드의 X 좌표가 time_value × TIME_SCALE인지 확인.
- [ ] time_value와 end_time_value가 모두 있는 노드의 X 좌표가 중간점이고, width가 범위 × TIME_SCALE인지 확인.
- [ ] role이 'period'인 노드의 Y 좌표가 축 위(period zone)인지 확인.
- [ ] role이 'occurrence'인 노드의 Y 좌표가 축 아래(occurrence zone)인지 확인.
- [ ] 사용자가 저장한 Y값이 있는 occurrence 노드는 해당 Y값이 유지되는지 확인.
- [ ] X 범위가 겹치는 occurrence 노드들이 수직으로 스태킹되는지 확인.
- [ ] time_value가 없는 노드(매핑 안 된 archetype)가 에러 없이 처리되는지 확인.

### V7-3. 노드 분류 (classifyNodes)

- [ ] role이 'period'이고 end_time_value가 있는 노드가 overlayNodes로 분류되는지 확인.
- [ ] role이 'occurrence'인 노드가 cardNodes로 분류되는지 확인.
- [ ] role이 'period'이지만 end_time_value가 없는 노드가 cardNodes로 분류되는지 확인 (밴드를 그릴 수 없으므로).
- [ ] metadata가 없는 노드(매핑 안 됨)가 cardNodes로 분류되는지 확인.

### V7-4. 오버레이 (OverlayComponent)

**커넥터 (Connectors)**
- [ ] 각 occurrence 노드에서 축까지 dashed 수직선이 그려지는지 확인.
- [ ] 커넥터의 X 좌표가 노드의 X 좌표와 일치하는지 확인.
- [ ] 노드 드래그 중 커넥터가 실시간으로 따라 이동하는지 확인.
- [ ] period(밴드) 노드에는 커넥터가 없는지 확인.

**마커 (Markers)**
- [ ] 각 occurrence 노드의 시간 위치에 축 위 원형 마커가 표시되는지 확인.
- [ ] span 노드(period)에는 마커가 없는지 확인.
- [ ] 노드 드래그 중 마커가 실시간으로 따라 이동하는지 확인.

**기간 밴드 (Period Bands)**
- [ ] period + span 노드가 축 위에 반투명 사각형 밴드로 렌더링되는지 확인.
- [ ] 밴드의 X 시작점이 time_value × TIME_SCALE × zoom + panX인지 확인.
- [ ] 밴드의 너비가 (end_time_value - time_value) × TIME_SCALE × zoom인지 확인.
- [ ] 밴드 중앙에 라벨(concept title)이 표시되는지 확인.
- [ ] 겹치는 기간 밴드가 레인으로 분리되는지 확인.
- [ ] 짧은 기간이 축 가까이(lane 0), 긴 기간이 위쪽에 배치되는지 확인.
- [ ] 밴드 클릭 시 해당 노드가 선택되는지 확인.
- [ ] 밴드 더블클릭 시 에디터가 열리는지 확인.
- [ ] 밴드 우클릭 시 컨텍스트 메뉴가 열리는지 확인.

**Resize 핸들**
- [ ] edit mode에서 밴드 양쪽 끝에 리사이즈 핸들이 보이는지 확인.
- [ ] browse mode에서는 리사이즈 핸들이 보이지 않는지 확인.
- [ ] 왼쪽 핸들 드래그 시 밴드 왼쪽 끝만 이동하는지 확인.
- [ ] 오른쪽 핸들 드래그 시 밴드 오른쪽 끝만 이동하는지 확인.
- [ ] 드래그 중 밴드 너비가 실시간으로 변하는지 확인.
- [ ] 드래그 종료 시 역산된 시간값이 concept_properties에 저장되는지 확인.

### V7-5. 인터랙션

**노드 드래그 (Occurrence)**
- [ ] 노드를 X 방향으로 드래그한 뒤 놓으면, 새 X 좌표가 시간값으로 역산되어 concept_properties가 업데이트되는지 확인.
- [ ] 역산 공식이 정확한지 확인: new_time_value = new_x / TIME_SCALE.
- [ ] Y 방향 드래그는 position_y만 업데이트하고 concept_properties는 건드리지 않는지 확인.
- [ ] 드래그 중 커넥터와 마커가 실시간으로 따라가는지 확인.

**밴드 드래그 (Period)**
- [ ] 밴드를 X 방향으로 드래그하면 start, end 모두 같은 양만큼 이동하는지 확인.
- [ ] 드래그 종료 시 time_value, end_time_value 모두 업데이트되는지 확인.

**팬**
- [ ] X, Y 모두 자유롭게 팬되는지 확인.
- [ ] 팬 시 축, 눈금, 밴드, 커넥터, 마커가 모두 정확히 이동하는지 확인.

**줌**
- [ ] 줌 시 축, 눈금, 밴드, 커넥터, 마커, 노드가 모두 정확히 스케일되는지 확인.
- [ ] zoom-toward-cursor가 정상 동작하는지 확인.
- [ ] 줌 레벨에 따라 눈금 밀도가 적절한지 확인 (너무 촘촘하거나 넓지 않은지).

### V7-6. 엣지

- [ ] 타임라인에서도 occurrence 노드 간 엣지 생성이 가능한지 확인.
- [ ] 엣지가 노드 위치에 따라 정확히 연결되는지 확인.
- [ ] 밴드(period) 노드에서 occurrence 노드로의 엣지가 가능한지, 불가능한지 결정하고 그에 맞게 동작하는지 확인.
- [ ] 노드 드래그 중 연결된 엣지가 따라 이동하는지 확인.

---

## Phase 8: 메타데이터 매핑 통합

concept_properties 로딩, field_mappings 기반 변환.

### V8-1. concept_properties 로딩

- [ ] 캔버스를 열 때 모든 concept 노드의 concept_properties가 일괄 로드되는지 확인.
- [ ] concept가 아닌 노드(file, dir)는 properties 로드를 건너뛰는지 확인.
- [ ] concept_properties가 없는 concept(값 미입력)은 빈 배열로 처리되는지 확인.

### V8-2. 매핑 변환

- [ ] field_mappings에 archetype_id가 있고, 해당 concept에 매핑된 field_id의 값이 있으면 metadata에 올바른 키-값이 생성되는지 확인.
- [ ] field_mappings에 없는 archetype_id의 concept은 metadata가 비어 있는지 확인.
- [ ] field_mappings에 end_time_value 매핑이 없는 archetype은 metadata에 end_time_value가 없는지 확인.
- [ ] concept_properties의 value가 문자열인데, 숫자로 변환이 필요할 때 올바르게 변환되는지 확인.
- [ ] value가 빈 문자열이거나 숫자로 변환 불가능할 때 에러 없이 처리되는지 확인 (NaN 방지).

### V8-3. 노드 드롭 시 역매핑

- [ ] 타임라인에서 노드를 드래그하여 놓으면, 역산된 시간값이 올바른 field_id의 concept_property로 저장되는지 확인.
- [ ] 저장 후 캔버스를 다시 열면 노드가 새 시간 위치에 정확히 배치되는지 확인.
- [ ] span resize 후 역산된 start/end 값이 각각 올바른 field_id로 저장되는지 확인.

---

## Phase 9: UI 통합

캔버스 설정에서 레이아웃 선택, 필드 매핑 설정.

### V9-1. 레이아웃 선택

- [ ] 캔버스 에디터(또는 설정 패널)에서 레이아웃 드롭다운이 표시되는지 확인.
- [ ] 드롭다운에 등록된 모든 플러그인(freeform, horizontal-timeline)이 나열되는지 확인.
- [ ] 레이아웃을 변경하면 canvas.layout이 DB에 저장되는지 확인.
- [ ] 레이아웃을 변경하면 캔버스가 해당 플러그인으로 즉시 전환되는지 확인.

### V9-2. 필드 매핑 설정

- [ ] 타임라인 레이아웃 선택 시 필드 매핑 설정 UI가 나타나는지 확인.
- [ ] 프로젝트에 존재하는 모든 archetype이 매핑 대상으로 나열되는지 확인.
- [ ] 각 archetype의 필드 목록이 드롭다운으로 선택 가능한지 확인.
- [ ] 필수 필드(time_value)가 매핑되지 않으면 경고 또는 저장 불가인지 확인.
- [ ] 선택 필드(end_time_value)가 매핑되지 않아도 저장 가능한지 확인.
- [ ] role 선택(period/occurrence)이 archetype별로 가능한지 확인.
- [ ] 매핑을 저장하면 canvas.layout_config가 DB에 올바르게 저장되는지 확인.

### V9-3. 축 설정

- [ ] unit 입력 필드가 있고, 변경 시 축 라벨에 반영되는지 확인.
- [ ] tick_interval 입력 필드가 있고, 변경 시 눈금 간격에 반영되는지 확인.
- [ ] direction 선택(asc/desc)이 있고, 변경 시 시간 방향이 바뀌는지 확인.

### V9-4. i18n

- [ ] 레이아웃 관련 새 문자열이 en.json, ko.json 양쪽에 존재하는지 확인.
- [ ] 한국어, 영어 전환 시 레이아웃 설정 UI의 모든 텍스트가 올바르게 변하는지 확인.

---

## Phase 10: 레이아웃 전환

### V10-1. freeform → timeline

- [ ] freeform에서 배치한 노드들의 position_x/y가 보존되는지 확인 (DB 값 변경 안 됨).
- [ ] 전환 후 time_value 매핑이 완료된 노드가 축 위에 정확히 배치되는지 확인.
- [ ] 매핑이 안 된 노드(none-type 또는 매핑 없는 archetype)가 에러 없이 처리되는지 확인.
- [ ] 뷰포트(zoom, pan)가 타임라인 배치에 맞게 적절히 조정되는지 확인.

### V10-2. timeline → freeform

- [ ] freeform으로 전환 시 이전에 저장된 position_x/y가 있는 노드가 해당 위치로 복원되는지 확인.
- [ ] 타임라인에서만 배치했던 노드(position_x/y가 타임라인 좌표)는 합리적인 위치에 놓이는지 확인.
- [ ] 전환 후 freeform의 모든 기능(자유 드래그, 팬, 줌 등)이 정상인지 확인.

### V10-3. 연속 전환

- [ ] freeform → timeline → freeform 전환을 반복해도 노드 위치가 안정적인지 확인 (position drift 없음).
- [ ] 전환 중 엣지가 유지되는지 확인.
- [ ] 전환 중 선택 상태가 초기화되는지 확인.

---

## Phase 11: Edge Case

### V11-1. 빈 캔버스

- [ ] 노드가 없는 캔버스에서 타임라인 레이아웃을 적용해도 에러 없이 축이 렌더링되는지 확인.
- [ ] 빈 타임라인에 노드를 추가하면 정상적으로 배치되는지 확인.

### V11-2. none-type Concept

- [ ] archetype이 없는 concept 노드가 타임라인에 추가될 때 에러가 발생하지 않는지 확인.
- [ ] none-type 노드가 매핑 불가 상태로 적절히 표시되는지 확인 (경고 또는 축 밖 배치).

### V11-3. 대량 노드

- [ ] 100개 이상의 노드가 있는 타임라인에서 렌더링 성능이 허용 가능한지 확인.
- [ ] 충돌 회피 알고리즘이 대량 노드에서도 합리적인 시간 내에 완료되는지 확인.
- [ ] 눈금 수가 과도하게 많아지지 않는지 확인 (maxTicks 제한).

### V11-4. 극단적 값

- [ ] time_value가 음수인 노드가 정상적으로 축 왼쪽에 배치되는지 확인.
- [ ] time_value가 매우 큰 값(100000 등)일 때 레이아웃이 깨지지 않는지 확인.
- [ ] start와 end가 같은 값인 기간 노드(width=0)가 에러 없이 처리되는지 확인.
- [ ] start가 end보다 큰 기간 노드가 에러 없이 처리되는지 확인 (swap 또는 무시).

### V11-5. 동시 변경

- [ ] 타임라인에서 노드의 시간값을 드래그로 변경한 직후, 에디터에서 같은 concept의 properties를 열면 변경된 값이 반영되어 있는지 확인.
- [ ] 에디터에서 concept_property를 직접 수정한 후 타임라인으로 돌아오면 노드 위치가 갱신되는지 확인.

---

## 전 Phase 공통

### 테스트

- [ ] 각 Phase 완료 후 `pnpm test` 전체 통과.
- [ ] 각 Phase 완료 후 `pnpm typecheck` 전체 통과.

### 수동 검증

- [ ] 각 Phase 완료 후 `pnpm dev:desktop`로 앱 실행하여 해당 Phase의 항목을 수동으로 확인.
