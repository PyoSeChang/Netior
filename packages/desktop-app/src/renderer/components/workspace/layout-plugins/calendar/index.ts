import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LayoutRenderNode, NodeDropContext, NodeDropResult, WorkspaceLayoutPlugin } from '../types';
import { CalendarBackground } from './CalendarBackground';
import { CalendarHeaderControls } from './CalendarHeaderControls';
import {
  CALENDAR_DAY_HOUR_SLOT_HEIGHT,
  clampDayScrollPx,
  createCalendarSnapshot,
  epochDaysToDate,
  createCalendarFrame,
  normalizeCalendarView,
  normalizeFocusEpochDay,
  shiftFocusEpochDay,
  todayEpochDays,
} from './calendar-utils';
import {
  formatTemporalSlotValueForWriteback,
  projectRecurringTemporalNodes,
} from '../temporal-utils';

function resetViewport(setZoom: (zoom: number) => void, setPanX: (panX: number) => void, setPanY: (panY: number) => void): void {
  setZoom(1);
  setPanX(0);
  setPanY(0);
}

function focusNowViewport(setZoom: (zoom: number) => void, setPanX: (panX: number) => void, setPanY: (panY: number) => void): void {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const pxPerMinute = CALENDAR_DAY_HOUR_SLOT_HEIGHT / 60;
  const targetScroll = Math.max(0, minutes * pxPerMinute - CALENDAR_DAY_HOUR_SLOT_HEIGHT * 2);
  setZoom(1);
  setPanX(0);
  setPanY(targetScroll);
}

function getSlotFieldIds(node: LayoutRenderNode): Record<string, string> | undefined {
  return node.metadata.__slotFieldIds as Record<string, string> | undefined;
}

function formatSlotValue(
  node: LayoutRenderNode,
  slot: 'start_at' | 'end_at',
  epochDay: number,
  minutesOfDay?: number,
  forceDateOnly = false,
): string {
  return formatTemporalSlotValueForWriteback(node, slot, epochDay, minutesOfDay, forceDateOnly);
}

function resolveCalendarDuration(node: LayoutRenderNode): {
  hasEnd: boolean;
  startEpochDay: number;
  endEpochDay: number;
  startMinutes: number;
  durationMinutes: number;
  daySpan: number;
  isTimed: boolean;
} | null {
  const startEpochDay = node.metadata.start_at as number | undefined;
  if (startEpochDay == null) return null;

  const endEpochDayRaw = node.metadata.end_at as number | undefined;
  const hasEnd = endEpochDayRaw != null;
  const endEpochDay = hasEnd ? Math.max(startEpochDay, endEpochDayRaw) : startEpochDay;
  const startMinutes = typeof node.metadata.start_at_minutes === 'number' ? Number(node.metadata.start_at_minutes) : 0;
  const endMinutes = typeof node.metadata.end_at_minutes === 'number' ? Number(node.metadata.end_at_minutes) : startMinutes;
  const isAllDay = node.metadata.all_day === true;
  const isTimed = !isAllDay && (node.metadata.start_at_has_time === true || node.metadata.end_at_has_time === true);

  if (!isTimed) {
    return {
      hasEnd,
      startEpochDay,
      endEpochDay,
      startMinutes: 0,
      durationMinutes: Math.max(1440, (endEpochDay - startEpochDay + 1) * 1440),
      daySpan: endEpochDay - startEpochDay,
      isTimed: false,
    };
  }

  const startAbsMinute = startEpochDay * 1440 + startMinutes;
  let endAbsMinute: number;
  if (hasEnd) {
    endAbsMinute = endEpochDay * 1440 + endMinutes;
  } else {
    endAbsMinute = startAbsMinute + 60;
  }
  if (endAbsMinute <= startAbsMinute) {
    endAbsMinute = startAbsMinute + 60;
  }

  return {
    hasEnd,
    startEpochDay,
    endEpochDay,
    startMinutes,
    durationMinutes: endAbsMinute - startAbsMinute,
    daySpan: endEpochDay - startEpochDay,
    isTimed: true,
  };
}

function snapMinutes(minutes: number): number {
  return Math.max(0, Math.min(1439, Math.round(minutes / 15) * 15));
}

export const calendarPlugin: WorkspaceLayoutPlugin = {
  key: 'calendar',
  displayName: 'Calendar',

  configSchema: [
    {
      key: 'view',
      type: 'enum',
      label: 'layout.calendar.view',
      default: 'month',
      options: ['day', 'week', 'month'],
      optionLabelKeyPrefix: 'layout.calendar',
    },
    {
      key: 'weekStartsOn',
      type: 'enum',
      label: 'layout.calendar.weekStartsOn',
      default: 'monday',
      options: ['sunday', 'monday'],
      optionLabelKeyPrefix: 'layout.calendar',
    },
  ],

  getDefaultConfig() {
    return {
      view: 'month',
      weekStartsOn: 'monday',
      _focusEpochDay: todayEpochDays(),
    };
  },

  interactionConstraints: {
    panAxis: 'none',
    nodeDragAxis: null,
    enableSpanResize: false,
  },
  viewportMode: 'screen',
  wheelBehavior: 'calendar',
  persistViewport: false,
  getViewportPolicy() {
    return {
      viewportMode: 'screen',
      wheelBehavior: 'calendar',
      persistViewport: false,
      interactionConstraints: {
        panAxis: 'none',
        nodeDragAxis: null,
        enableSpanResize: false,
      },
      viewportReset: {
        zoom: 1,
        panX: 0,
        panY: 0,
      },
    };
  },
  getViewportReset() {
    return {
      zoom: 1,
      panX: 0,
      panY: 0,
    };
  },

  computeLayout({ nodes, viewport, viewportState, config }) {
    return createCalendarSnapshot({
      nodes,
      config,
      viewport,
      scrollPx: viewportState.panY,
    }).layout;
  },

  projectNodes({ nodes, viewport, config }) {
    const frame = createCalendarFrame({
      view: normalizeCalendarView(config.view),
      focusEpochDay: normalizeFocusEpochDay(config._focusEpochDay),
      weekStartsOn: config.weekStartsOn === 'sunday' ? 0 : 1,
      width: viewport.width,
      height: viewport.height,
    });
    return projectRecurringTemporalNodes(nodes, frame.rangeStart, frame.rangeEnd);
  },

  classifyNodes(nodes, config) {
    const snapshot = createCalendarSnapshot({
      nodes,
      config,
      viewport: { width: 1200, height: 840 },
    });
    return {
      cardNodes: nodes.filter((node) => snapshot.visibleNodeIds.has(node.id)),
      overlayNodes: [],
    };
  },

  BackgroundComponent: CalendarBackground,
  ControlsComponent: CalendarHeaderControls,

  hiddenControls: ['zoom', 'fit', 'nav', 'mode'],
  controlsPresentation: 'header-fixed',

  onWheel({ event, viewport, nodes, config, panY, setPanY }) {
    const view = normalizeCalendarView(config.view);
    if (view === 'month' || event.ctrlKey) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta === 0) return;

    const snapshot = createCalendarSnapshot({
      nodes,
      config,
      viewport,
      scrollPx: panY,
    });
    const maxScroll = snapshot.temporal?.scrollMax ?? 0;
    setPanY(clampDayScrollPx(panY + delta, maxScroll));
  },

  onNodeDrop(context: NodeDropContext): NodeDropResult {
    const snapshot = createCalendarSnapshot({
      nodes: context.nodes,
      config: context.config,
      viewport: context.viewport,
      scrollPx: context.viewportState.panY,
    });
    const slotFieldIds = getSlotFieldIds(context.node);
    const duration = resolveCalendarDuration(context.node);

    if (!slotFieldIds?.start_at || !context.node.conceptId || !duration) {
      return { position: { x: Math.round(context.newX), y: Math.round(context.newY) } };
    }

    const propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> = [];
    const pushUpdate = (fieldId: string | undefined, value: string | boolean) => {
      if (!fieldId || !context.node.conceptId) return;
      propertyUpdates.push({
        conceptId: context.node.conceptId,
        fieldId,
        value: typeof value === 'boolean' ? String(value) : value,
      });
    };

    if (snapshot.temporal) {
      const targetColumn = snapshot.temporal.columns.find((column) => (
        context.newX >= column.x && context.newX <= column.x + column.width
      )) ?? snapshot.temporal.columns[0];

      if (!targetColumn) {
        return { position: { x: Math.round(context.newX), y: Math.round(context.newY) } };
      }

      const contentY = context.newY + snapshot.temporal.scrollPx;
      const isAllDayDrop = contentY < snapshot.temporal.timelineTop;
      const allDayFieldId = slotFieldIds.all_day;

      if (isAllDayDrop) {
        pushUpdate(slotFieldIds.start_at, formatSlotValue(context.node, 'start_at', targetColumn.epochDay, undefined, true));
        if (duration.hasEnd && slotFieldIds.end_at) {
          pushUpdate(
            slotFieldIds.end_at,
            formatSlotValue(context.node, 'end_at', targetColumn.epochDay + duration.daySpan, undefined, true),
          );
        }
        if (allDayFieldId) {
          pushUpdate(allDayFieldId, true);
        }
      } else {
        const droppedMinute = snapMinutes(
          (contentY - snapshot.temporal.timelineTop) / snapshot.temporal.pxPerMinute,
        );
        const nextStartAbsMinute = targetColumn.epochDay * 1440 + droppedMinute;
        const nextStartEpochDay = Math.floor(nextStartAbsMinute / 1440);
        const nextStartMinute = nextStartAbsMinute % 1440;

        pushUpdate(
          slotFieldIds.start_at,
          formatSlotValue(context.node, 'start_at', nextStartEpochDay, nextStartMinute),
        );

        if (duration.hasEnd && slotFieldIds.end_at) {
          const nextEndAbsMinute = nextStartAbsMinute + duration.durationMinutes;
          const nextEndEpochDay = Math.floor(nextEndAbsMinute / 1440);
          const nextEndMinute = nextEndAbsMinute % 1440;
          pushUpdate(
            slotFieldIds.end_at,
            formatSlotValue(context.node, 'end_at', nextEndEpochDay, nextEndMinute),
          );
        }

        if (allDayFieldId) {
          pushUpdate(allDayFieldId, false);
        }
      }

      return {
        position: { x: Math.round(context.newX), y: Math.round(context.newY) },
        propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
      };
    }

    const targetCell = snapshot.frame.cells.find((cell) => {
      const left = cell.column * snapshot.frame.cellWidth;
      const right = left + snapshot.frame.cellWidth;
      const top = snapshot.frame.bodyTop + cell.row * snapshot.frame.cellHeight;
      const bottom = top + snapshot.frame.cellHeight;
      return context.newX >= left && context.newX <= right && context.newY >= top && context.newY <= bottom;
    });

    if (!targetCell) {
      return { position: { x: Math.round(context.newX), y: Math.round(context.newY) } };
    }

    if (duration.isTimed) {
      const nextStartAbsMinute = targetCell.epochDay * 1440 + duration.startMinutes;
      const nextStartEpochDay = Math.floor(nextStartAbsMinute / 1440);
      const nextStartMinute = nextStartAbsMinute % 1440;
      pushUpdate(
        slotFieldIds.start_at,
        formatSlotValue(context.node, 'start_at', nextStartEpochDay, nextStartMinute),
      );
      if (duration.hasEnd && slotFieldIds.end_at) {
        const nextEndAbsMinute = nextStartAbsMinute + duration.durationMinutes;
        const nextEndEpochDay = Math.floor(nextEndAbsMinute / 1440);
        const nextEndMinute = nextEndAbsMinute % 1440;
        pushUpdate(
          slotFieldIds.end_at,
          formatSlotValue(context.node, 'end_at', nextEndEpochDay, nextEndMinute),
        );
      }
      if (slotFieldIds.all_day) {
        pushUpdate(slotFieldIds.all_day, false);
      }
    } else {
      pushUpdate(
        slotFieldIds.start_at,
        formatSlotValue(context.node, 'start_at', targetCell.epochDay, undefined, true),
      );
      if (duration.hasEnd && slotFieldIds.end_at) {
        pushUpdate(
          slotFieldIds.end_at,
          formatSlotValue(context.node, 'end_at', targetCell.epochDay + duration.daySpan, undefined, true),
        );
      }
      if (slotFieldIds.all_day) {
        pushUpdate(slotFieldIds.all_day, true);
      }
    }

    return {
      position: { x: Math.round(context.newX), y: Math.round(context.newY) },
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },

  controlItems: [
    {
      key: 'calendar-previous',
      icon: React.createElement(ChevronLeft, { size: 14 }),
      label: 'layout.calendar.previous',
      onClick: ({ config, updateConfig, setZoom, setPanX, setPanY }) => {
        const view = normalizeCalendarView(config.view);
        const focus = normalizeFocusEpochDay(config._focusEpochDay);
        resetViewport(setZoom, setPanX, setPanY);
        return updateConfig((current) => ({
          ...current,
          _focusEpochDay: shiftFocusEpochDay(view, focus, -1),
        }));
      },
    },
    {
      key: 'calendar-today',
      icon: React.createElement(CalendarDays, { size: 14 }),
      label: 'layout.calendar.today',
      onClick: ({ config, updateConfig, setZoom, setPanX, setPanY }) => {
        const view = normalizeCalendarView(config.view);
        if (view === 'day') {
          focusNowViewport(setZoom, setPanX, setPanY);
        } else {
          resetViewport(setZoom, setPanX, setPanY);
        }
        return updateConfig((current) => ({
          ...current,
          _focusEpochDay: todayEpochDays(),
        }));
      },
    },
    {
      key: 'calendar-next',
      icon: React.createElement(ChevronRight, { size: 14 }),
      label: 'layout.calendar.next',
      onClick: ({ config, updateConfig, setZoom, setPanX, setPanY }) => {
        const view = normalizeCalendarView(config.view);
        const focus = normalizeFocusEpochDay(config._focusEpochDay);
        resetViewport(setZoom, setPanX, setPanY);
        return updateConfig((current) => ({
          ...current,
          _focusEpochDay: shiftFocusEpochDay(view, focus, 1),
        }));
      },
    },
    {
      key: 'calendar-day',
      icon: React.createElement('span', { style: { fontSize: 10, fontWeight: 700 } }, 'D'),
      label: 'layout.calendar.day',
      isActive: ({ config }) => normalizeCalendarView(config.view) === 'day',
      onClick: ({ updateConfig, setZoom, setPanX, setPanY }) => {
        resetViewport(setZoom, setPanX, setPanY);
        return updateConfig((current) => ({ ...current, view: 'day' }));
      },
    },
    {
      key: 'calendar-week',
      icon: React.createElement('span', { style: { fontSize: 10, fontWeight: 700 } }, 'W'),
      label: 'layout.calendar.week',
      isActive: ({ config }) => normalizeCalendarView(config.view) === 'week',
      onClick: ({ updateConfig, setZoom, setPanX, setPanY }) => {
        resetViewport(setZoom, setPanX, setPanY);
        return updateConfig((current) => ({ ...current, view: 'week' }));
      },
    },
    {
      key: 'calendar-month',
      icon: React.createElement('span', { style: { fontSize: 10, fontWeight: 700 } }, 'M'),
      label: 'layout.calendar.month',
      isActive: ({ config }) => normalizeCalendarView(config.view) === 'month',
      onClick: ({ updateConfig, setZoom, setPanX, setPanY }) => {
        resetViewport(setZoom, setPanX, setPanY);
        return updateConfig((current) => ({ ...current, view: 'month' }));
      },
    },
  ],
};
