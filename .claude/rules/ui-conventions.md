# UI Component Conventions

## Form Elements

### Trigger (Selector/Picker)
- `<div>` + `role="combobox"` + `tabIndex={0}` + `onKeyDown` (Enter/Space)
- **NOT** `<button>`. Select component (`ui/Select.tsx`)이 기준 패턴.
- border: `border-input`, hover: `border-strong`, focus: `border-accent`

### Input
- 항상 `<Input>` 컴포넌트 사용. raw `<input>` 금지.
- size: `inputSize="sm"` (compact contexts) 또는 default

### Tooltip
- 항상 앱의 `<Tooltip>` 컴포넌트 사용. HTML `title` 속성 금지.

## i18n

- 모든 사용자에게 보이는 문자열은 `t('namespace.key')` 사용. 하드코딩 영어/한국어 금지.
- 키 추가 시 `ko.json`, `en.json` 양쪽 필수.
- `@moc/shared` 변경 후 `pnpm --filter @moc/shared build` 필요 (dev alias로 renderer는 자동 반영되나, dist 동기화 필요).

## Selection UI Pattern

대량 항목 선택 (아이콘 등 수십~수천 개):
- **모달** + 좌측 카테고리 사이드바 + 우측 그리드 + 상단 검색
- 참고: `ui/IconSelector.tsx`

소량 항목 선택 (타입 등 수십 개 이하):
- **드롭다운** 내부에 좌측 카테고리 + 우측 리스트 + 검색
- 참고: `ui/TypeSelector.tsx`

## Layout

- 에디터 콘텐츠: 수평 중앙 정렬 (`items-start justify-center`), `max-w-[600px]`
- 컨텍스트 메뉴 아이템: `py-1 text-xs` (compact)

## CSS Reset

- `reset.css`에서 `button { border: none; }` 적용됨 (의도된 설정).
- button에 border 필요 시 Tailwind 클래스로 명시적 지정.
