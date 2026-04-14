import type { LayoutComputeResult, LayoutRenderNode } from '../types';

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarCell {
  epochDay: number;
  column: number;
  row: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isFocus: boolean;
  label: string;
}

export interface CalendarGrid {
  view: CalendarView;
  focusEpochDay: number;
  weekStartsOn: 0 | 1;
  columns: number;
  rows: number;
  rangeStart: number;
  rangeEnd: number;
  title: string;
  weekdayLabels: string[];
  cells: CalendarCell[];
}

export interface CalendarFrame extends CalendarGrid {
  width: number;
  height: number;
  bodyTop: number;
  cellWidth: number;
  cellHeight: number;
}

export interface CalendarTemporalColumn {
  epochDay: number;
  x: number;
  width: number;
  label: string;
  weekdayLabel: string;
  isToday: boolean;
  isFocus: boolean;
  isWeekend: boolean;
}

export interface CalendarTemporalFrame {
  view: 'day' | 'week';
  scrollPx: number;
  scrollMax: number;
  headerTop: number;
  headerHeight: number;
  allDayTop: number;
  allDayHeight: number;
  allDayMaxRows: number;
  timelineTop: number;
  timelineHeight: number;
  timelineContentHeight: number;
  timeAxisWidth: number;
  columnGap: number;
  pxPerMinute: number;
  columns: CalendarTemporalColumn[];
}

export interface CalendarSnapshot {
  frame: CalendarFrame;
  layout: LayoutComputeResult;
  visibleNodeIds: Set<string>;
  temporal?: CalendarTemporalFrame;
}

interface CalendarEventRange {
  node: LayoutRenderNode;
  startAbsMinute: number;
  endAbsMinute: number;
  hasExplicitTime: boolean;
}

interface TimedDayEventPlacement {
  event: CalendarEventRange;
  startMinute: number;
  endMinute: number;
  column?: number;
  totalColumns?: number;
}

export const CALENDAR_TITLE_HEIGHT = 40;
export const CALENDAR_WEEKDAY_HEIGHT = 36;
export const CALENDAR_BODY_TOP = CALENDAR_TITLE_HEIGHT + CALENDAR_WEEKDAY_HEIGHT;
export const CALENDAR_CELL_PADDING = 8;
export const CALENDAR_CARD_HEIGHT = 60;
export const CALENDAR_CARD_GAP = 8;
export const CALENDAR_DAY_ALL_DAY_LABEL_WIDTH = 56;
export const CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT = 22;
export const CALENDAR_DAY_ALL_DAY_CARD_HEIGHT = 28;
export const CALENDAR_DAY_HOUR_SLOT_HEIGHT = 52;
export const CALENDAR_DAY_SECTION_PADDING = 10;
export const CALENDAR_DAY_TIMELINE_GAP = 6;
export const CALENDAR_DAY_MIN_EVENT_HEIGHT = 36;
export const CALENDAR_DAY_DEFAULT_DURATION_MINUTES = 60;

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 840;

function getPreferredLocale(): string {
  return typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
}

export function dateToEpochDays(date: Date): number {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcDate / 86400000);
}

export function epochDaysToDate(days: number): Date {
  const date = new Date(days * 86400000 + 43200000);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function todayEpochDays(): number {
  return dateToEpochDays(new Date());
}

export function normalizeCalendarView(value: unknown): CalendarView {
  return value === 'day' || value === 'week' || value === 'month' ? value : 'month';
}

export function normalizeWeekStartsOn(value: unknown): 0 | 1 {
  if (value === 0 || value === 'sunday') return 0;
  return 1;
}

export function normalizeFocusEpochDay(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : todayEpochDays();
}

export function clampDayScrollPx(scrollPx: number, maxScroll: number): number {
  return Math.max(0, Math.min(scrollPx, maxScroll));
}

function getMonthStartEpochDay(epochDay: number): number {
  const date = epochDaysToDate(epochDay);
  return dateToEpochDays(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function getStartOfWeek(epochDay: number, weekStartsOn: 0 | 1): number {
  const date = epochDaysToDate(epochDay);
  const weekday = date.getDay();
  const offset = (weekday - weekStartsOn + 7) % 7;
  return epochDay - offset;
}

function getWeekdayLabels(weekStartsOn: 0 | 1, locale = getPreferredLocale()): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const baseSunday = new Date(Date.UTC(2024, 0, 7));
  return Array.from({ length: 7 }, (_, index) => {
    const shifted = new Date(baseSunday.getTime() + ((weekStartsOn + index) % 7) * 86400000);
    return formatter.format(shifted);
  });
}

function formatTitle(
  view: CalendarView,
  focusEpochDay: number,
  locale = getPreferredLocale(),
  weekStartsOn: 0 | 1 = 1,
): string {
  const focusDate = epochDaysToDate(focusEpochDay);
  if (view === 'day') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      weekday: 'long',
    }).format(focusDate);
  }
  if (view === 'week') {
    const weekStart = epochDaysToDate(getStartOfWeek(focusEpochDay, weekStartsOn));
    const weekEnd = epochDaysToDate(getStartOfWeek(focusEpochDay, weekStartsOn) + 6);
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(focusDate);
}

export function buildCalendarGrid(params: {
  view: CalendarView;
  focusEpochDay: number;
  weekStartsOn: 0 | 1;
  locale?: string;
}): CalendarGrid {
  const { view, focusEpochDay, weekStartsOn } = params;
  const locale = params.locale ?? getPreferredLocale();
  const today = todayEpochDays();
  const focusDate = epochDaysToDate(focusEpochDay);
  const currentMonth = focusDate.getMonth();
  const weekdayLabels =
    view === 'day'
      ? [new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(focusDate)]
      : getWeekdayLabels(weekStartsOn, locale);

  if (view === 'day') {
    return {
      view,
      focusEpochDay,
      weekStartsOn,
      columns: 1,
      rows: 1,
      rangeStart: focusEpochDay,
      rangeEnd: focusEpochDay + 1,
      title: formatTitle(view, focusEpochDay, locale, weekStartsOn),
      weekdayLabels,
      cells: [
        {
          epochDay: focusEpochDay,
          column: 0,
          row: 0,
          inCurrentMonth: true,
          isToday: focusEpochDay === today,
          isFocus: true,
          label: String(epochDaysToDate(focusEpochDay).getDate()),
        },
      ],
    };
  }

  if (view === 'week') {
    const start = getStartOfWeek(focusEpochDay, weekStartsOn);
    const cells = Array.from({ length: 7 }, (_, index) => {
      const epochDay = start + index;
      return {
        epochDay,
        column: index,
        row: 0,
        inCurrentMonth: epochDaysToDate(epochDay).getMonth() === currentMonth,
        isToday: epochDay === today,
        isFocus: epochDay === focusEpochDay,
        label: String(epochDaysToDate(epochDay).getDate()),
      };
    });

    return {
      view,
      focusEpochDay,
      weekStartsOn,
      columns: 7,
      rows: 1,
      rangeStart: start,
      rangeEnd: start + 7,
      title: formatTitle(view, focusEpochDay, locale, weekStartsOn),
      weekdayLabels,
      cells,
    };
  }

  const monthStart = getMonthStartEpochDay(focusEpochDay);
  const gridStart = getStartOfWeek(monthStart, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, index) => {
    const epochDay = gridStart + index;
    const date = epochDaysToDate(epochDay);
    return {
      epochDay,
      column: index % 7,
      row: Math.floor(index / 7),
      inCurrentMonth: date.getMonth() === currentMonth,
      isToday: epochDay === today,
      isFocus: epochDay === focusEpochDay,
      label: String(date.getDate()),
    };
  });

  return {
    view,
    focusEpochDay,
    weekStartsOn,
    columns: 7,
    rows: 6,
    rangeStart: gridStart,
    rangeEnd: gridStart + 42,
    title: formatTitle(view, focusEpochDay, locale, weekStartsOn),
    weekdayLabels,
    cells,
  };
}

export function createCalendarFrame(params: {
  view: CalendarView;
  focusEpochDay: number;
  weekStartsOn: 0 | 1;
  width?: number;
  height?: number;
  locale?: string;
}): CalendarFrame {
  const width = Math.max(params.width ?? DEFAULT_WIDTH, 640);
  const height = Math.max(params.height ?? DEFAULT_HEIGHT, 420);
  const grid = buildCalendarGrid(params);
  const bodyHeight = Math.max(height - CALENDAR_BODY_TOP, 240);
  return {
    ...grid,
    width,
    height,
    bodyTop: CALENDAR_BODY_TOP,
    cellWidth: width / grid.columns,
    cellHeight: bodyHeight / grid.rows,
  };
}

export function resolveEventDisplayDay(
  startEpochDay: number | undefined,
  endEpochDay: number | undefined,
  frame: CalendarGrid,
): number | null {
  if (startEpochDay == null) return null;
  const normalizedStart = endEpochDay != null ? Math.min(startEpochDay, endEpochDay) : startEpochDay;
  const normalizedEnd = endEpochDay != null ? Math.max(startEpochDay, endEpochDay) : startEpochDay;
  const endExclusive = normalizedEnd + 1;
  if (endExclusive <= frame.rangeStart || normalizedStart >= frame.rangeEnd) return null;
  return Math.max(normalizedStart, frame.rangeStart);
}

function extractCalendarEventRange(node: LayoutRenderNode): CalendarEventRange | null {
  const startEpochDay = node.metadata.time_value as number | undefined;
  if (startEpochDay == null) return null;

  const endEpochDayRaw = node.metadata.end_time_value as number | undefined;
  const endEpochDay = endEpochDayRaw != null ? Math.max(startEpochDay, endEpochDayRaw) : startEpochDay;
  const startMinutes = typeof node.metadata.time_value_minutes === 'number' ? node.metadata.time_value_minutes : null;
  const endMinutes = typeof node.metadata.end_time_value_minutes === 'number' ? node.metadata.end_time_value_minutes : null;
  const hasStartTime = node.metadata.time_value_has_time === true;
  const hasEndTime = node.metadata.end_time_value_has_time === true;
  const hasExplicitTime = hasStartTime || hasEndTime;

  const startAbsMinute = startEpochDay * 1440 + (hasStartTime ? startMinutes ?? 0 : 0);
  let endAbsMinute: number;

  if (endEpochDayRaw != null) {
    endAbsMinute = hasEndTime
      ? endEpochDay * 1440 + (endMinutes ?? 0)
      : (endEpochDay + 1) * 1440;
  } else if (hasExplicitTime) {
    endAbsMinute = startAbsMinute + CALENDAR_DAY_DEFAULT_DURATION_MINUTES;
  } else {
    endAbsMinute = (startEpochDay + 1) * 1440;
  }

  if (endAbsMinute <= startAbsMinute) {
    endAbsMinute = hasExplicitTime
      ? startAbsMinute + CALENDAR_DAY_DEFAULT_DURATION_MINUTES
      : (endEpochDay + 1) * 1440;
  }

  return {
    node,
    startAbsMinute,
    endAbsMinute,
    hasExplicitTime,
  };
}

function buildGridSnapshot(frame: CalendarFrame, nodes: LayoutRenderNode[]): CalendarSnapshot {
  const dayToCell = new Map(frame.cells.map((cell) => [cell.epochDay, cell]));
  const buckets = new Map<number, LayoutRenderNode[]>();

  for (const node of nodes) {
    const displayDay = resolveEventDisplayDay(
      node.metadata.time_value as number | undefined,
      node.metadata.end_time_value as number | undefined,
      frame,
    );
    if (displayDay == null) continue;
    const bucket = buckets.get(displayDay) ?? [];
    bucket.push(node);
    buckets.set(displayDay, bucket);
  }

  const layout: LayoutComputeResult = {};
  const visibleNodeIds = new Set<string>();

  for (const [epochDay, bucket] of buckets) {
    const cell = dayToCell.get(epochDay);
    if (!cell) continue;
    bucket
      .sort((left, right) => {
        const leftStart = (left.metadata.time_value as number | undefined) ?? 0;
        const rightStart = (right.metadata.time_value as number | undefined) ?? 0;
        if (leftStart !== rightStart) return leftStart - rightStart;
        return left.label.localeCompare(right.label);
      })
      .forEach((node, index) => {
        visibleNodeIds.add(node.id);
        const width = Math.max(112, Math.min(frame.view === 'month' ? 180 : 220, frame.cellWidth - CALENDAR_CELL_PADDING * 2));
        layout[node.id] = {
          x: cell.column * frame.cellWidth + frame.cellWidth / 2,
          y:
            CALENDAR_BODY_TOP
            + cell.row * frame.cellHeight
            + CALENDAR_CELL_PADDING
            + CALENDAR_CARD_HEIGHT / 2
            + index * (CALENDAR_CARD_HEIGHT + CALENDAR_CARD_GAP),
          width,
          height: CALENDAR_CARD_HEIGHT,
        };
      });
  }

  return { frame, layout, visibleNodeIds };
}

function buildOverlapGroups(events: TimedDayEventPlacement[]): TimedDayEventPlacement[][] {
  const groups: TimedDayEventPlacement[][] = [];
  let currentGroup: TimedDayEventPlacement[] = [];
  let currentMaxEnd = -1;

  for (const event of events) {
    if (currentGroup.length === 0 || event.startMinute < currentMaxEnd) {
      currentGroup.push(event);
      currentMaxEnd = Math.max(currentMaxEnd, event.endMinute);
    } else {
      groups.push(currentGroup);
      currentGroup = [event];
      currentMaxEnd = event.endMinute;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function assignOverlapColumns(group: TimedDayEventPlacement[]): TimedDayEventPlacement[] {
  const placements: TimedDayEventPlacement[] = [];
  const active: Array<{ endMinute: number; column: number }> = [];
  let maxColumns = 1;

  for (const event of group) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endMinute <= event.startMinute) {
        active.splice(i, 1);
      }
    }

    const usedColumns = new Set(active.map((item) => item.column));
    let column = 0;
    while (usedColumns.has(column)) {
      column += 1;
    }

    active.push({ endMinute: event.endMinute, column });
    maxColumns = Math.max(maxColumns, active.length, column + 1);
    placements.push({ ...event, column });
  }

  return placements.map((placement) => ({
    ...placement,
    totalColumns: maxColumns,
  }));
}

function buildTemporalSnapshot(
  frame: CalendarFrame,
  nodes: LayoutRenderNode[],
  scrollPx: number,
): CalendarSnapshot {
  const headerTop = CALENDAR_TITLE_HEIGHT;
  const headerHeight = CALENDAR_WEEKDAY_HEIGHT;
  const allDayTop = frame.bodyTop;
  const timeAxisWidth = CALENDAR_DAY_ALL_DAY_LABEL_WIDTH;
  const laneX = timeAxisWidth;
  const laneWidth = Math.max(frame.width - laneX, 240);
  const columnGap = 0;
  const columnWidth = (laneWidth - columnGap * Math.max(0, frame.columns - 1)) / frame.columns;
  const columns: CalendarTemporalColumn[] = frame.cells.map((cell) => {
    const date = epochDaysToDate(cell.epochDay);
    return {
      epochDay: cell.epochDay,
      x: laneX + cell.column * (columnWidth + columnGap),
      width: columnWidth,
      label: String(date.getDate()),
      weekdayLabel: frame.view === 'day' ? frame.weekdayLabels[0] : frame.weekdayLabels[cell.column] ?? '',
      isToday: cell.isToday,
      isFocus: cell.isFocus,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
  const columnByEpochDay = new Map(columns.map((column) => [column.epochDay, column]));
  const allDayByDay = new Map<number, CalendarEventRange[]>();
  const timedByDay = new Map<number, TimedDayEventPlacement[]>();

  for (const node of nodes) {
    const event = extractCalendarEventRange(node);
    if (!event) continue;

    const eventStartDay = Math.floor(event.startAbsMinute / 1440);
    const renderDay = Math.max(frame.rangeStart, Math.min(frame.rangeEnd - 1, eventStartDay));
    if (event.endAbsMinute <= frame.rangeStart * 1440 || event.startAbsMinute >= frame.rangeEnd * 1440) {
      continue;
    }
    if (!columnByEpochDay.has(renderDay)) continue;

    if (event.hasExplicitTime) {
      const dayStartAbsMinute = renderDay * 1440;
      const bucket = timedByDay.get(renderDay) ?? [];
      bucket.push({
        event,
        startMinute: Math.max(0, event.startAbsMinute - dayStartAbsMinute),
        endMinute: Math.min(1440, event.endAbsMinute - dayStartAbsMinute),
      });
      timedByDay.set(renderDay, bucket);
    } else {
      const bucket = allDayByDay.get(renderDay) ?? [];
      bucket.push(event);
      allDayByDay.set(renderDay, bucket);
    }
  }

  for (const bucket of allDayByDay.values()) {
    bucket.sort((left, right) => {
      if (left.startAbsMinute !== right.startAbsMinute) return left.startAbsMinute - right.startAbsMinute;
      return left.node.label.localeCompare(right.node.label);
    });
  }

  for (const bucket of timedByDay.values()) {
    bucket.sort((left, right) => {
      if (left.startMinute !== right.startMinute) return left.startMinute - right.startMinute;
      if (left.endMinute !== right.endMinute) return left.endMinute - right.endMinute;
      return left.event.node.label.localeCompare(right.event.node.label);
    });
  }

  const allDayMaxRows = Math.max(1, ...Array.from(allDayByDay.values()).map((bucket) => bucket.length));
  const allDayContentHeight =
    allDayMaxRows > 0
      ? allDayMaxRows * CALENDAR_DAY_ALL_DAY_CARD_HEIGHT + Math.max(0, allDayMaxRows - 1) * CALENDAR_CARD_GAP
      : 0;
  const allDayHeight =
    CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT
    + CALENDAR_DAY_SECTION_PADDING * 2
    + Math.max(allDayContentHeight, CALENDAR_DAY_ALL_DAY_CARD_HEIGHT);
  const timelineTop = allDayTop + allDayHeight;
  const scrollViewportHeight = Math.max(frame.height - frame.bodyTop, 120);
  const timelineHeight = Math.max(frame.height - timelineTop, 120);
  const timelineContentHeight = CALENDAR_DAY_HOUR_SLOT_HEIGHT * 24;
  const scrollContentHeight = allDayHeight + timelineContentHeight;
  const scrollMax = Math.max(0, scrollContentHeight - scrollViewportHeight);
  const normalizedScrollPx = clampDayScrollPx(scrollPx, scrollMax);
  const pxPerMinute = CALENDAR_DAY_HOUR_SLOT_HEIGHT / 60;
  const layout: LayoutComputeResult = {};
  const visibleNodeIds = new Set<string>();
  const isBoxVisible = (x: number, y: number, width: number, height: number): boolean => (
    x + width / 2 > 0
    && x - width / 2 < frame.width
    && y + height / 2 > frame.bodyTop
    && y - height / 2 < frame.height
  );

  for (const column of columns) {
    const allDayEvents = allDayByDay.get(column.epochDay) ?? [];
    allDayEvents.forEach((event, index) => {
      const width = Math.max(column.width - 6, 92);
      const height = CALENDAR_DAY_ALL_DAY_CARD_HEIGHT;
      const x = column.x + column.width / 2;
      const y =
        allDayTop
        + CALENDAR_DAY_SECTION_PADDING
        + CALENDAR_DAY_ALL_DAY_HEADER_HEIGHT
        + index * (CALENDAR_DAY_ALL_DAY_CARD_HEIGHT + CALENDAR_CARD_GAP)
        + CALENDAR_DAY_ALL_DAY_CARD_HEIGHT / 2
        - normalizedScrollPx;
      layout[event.node.id] = {
        x,
        y,
        width,
        height,
      };
      if (isBoxVisible(x, y, width, height)) {
        visibleNodeIds.add(event.node.id);
      }
    });

    const timedEvents = timedByDay.get(column.epochDay) ?? [];
    const groupedTimedEvents = buildOverlapGroups(timedEvents)
      .flatMap((group) => assignOverlapColumns(group));

    groupedTimedEvents.forEach((placement) => {
      const totalColumns = placement.totalColumns ?? 1;
      const subColumn = placement.column ?? 0;
      const intraGap = totalColumns > 1 ? CALENDAR_DAY_TIMELINE_GAP : 0;
      const subColumnWidth = (column.width - intraGap * Math.max(0, totalColumns - 1)) / totalColumns;
      const startY = timelineTop + placement.startMinute * pxPerMinute - normalizedScrollPx;
      const endY = timelineTop + placement.endMinute * pxPerMinute - normalizedScrollPx;
      const height = Math.max(CALENDAR_DAY_MIN_EVENT_HEIGHT, endY - startY - 2);
      const left = column.x + subColumn * (subColumnWidth + intraGap);
      const x = left + subColumnWidth / 2;
      const y = startY + height / 2;

      layout[placement.event.node.id] = {
        x,
        y,
        width: subColumnWidth,
        height,
      };
      if (isBoxVisible(x, y, subColumnWidth, height)) {
        visibleNodeIds.add(placement.event.node.id);
      }
    });
  }

  return {
    frame,
    layout,
    visibleNodeIds,
    temporal: {
      view: frame.view === 'day' ? 'day' : 'week',
      scrollPx: normalizedScrollPx,
      scrollMax,
      headerTop,
      headerHeight,
      allDayTop,
      allDayHeight,
      allDayMaxRows,
      timelineTop,
      timelineHeight,
      timelineContentHeight,
      timeAxisWidth,
      columnGap,
      pxPerMinute,
      columns,
    },
  };
}

export function createCalendarSnapshot(params: {
  nodes: LayoutRenderNode[];
  config: Record<string, unknown>;
  viewport: { width: number; height: number };
  scrollPx?: number;
}): CalendarSnapshot {
  const frame = createCalendarFrame({
    view: normalizeCalendarView(params.config.view),
    focusEpochDay: normalizeFocusEpochDay(params.config._focusEpochDay),
    weekStartsOn: normalizeWeekStartsOn(params.config.weekStartsOn),
    width: params.viewport.width,
    height: params.viewport.height,
  });

  if (frame.view === 'day' || frame.view === 'week') {
    return buildTemporalSnapshot(frame, params.nodes, params.scrollPx ?? 0);
  }

  return buildGridSnapshot(frame, params.nodes);
}

export function shiftFocusEpochDay(
  view: CalendarView,
  focusEpochDay: number,
  delta: number,
): number {
  if (view === 'day') return focusEpochDay + delta;
  if (view === 'week') return focusEpochDay + delta * 7;
  const focusDate = epochDaysToDate(focusEpochDay);
  return dateToEpochDays(new Date(focusDate.getFullYear(), focusDate.getMonth() + delta, focusDate.getDate()));
}
