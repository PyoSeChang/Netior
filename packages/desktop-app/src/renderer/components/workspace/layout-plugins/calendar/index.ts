import React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { WorkspaceLayoutPlugin } from '../types';
import { CalendarBackground } from './CalendarBackground';
import { CalendarHeaderControls } from './CalendarHeaderControls';
import {
  CALENDAR_DAY_HOUR_SLOT_HEIGHT,
  clampDayScrollPx,
  createCalendarSnapshot,
  normalizeCalendarView,
  normalizeFocusEpochDay,
  shiftFocusEpochDay,
  todayEpochDays,
} from './calendar-utils';

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

export const calendarPlugin: WorkspaceLayoutPlugin = {
  key: 'calendar',
  displayName: 'Calendar',

  requiredFields: [
    { key: 'time_value', type: 'date', label: 'layout.calendar.timeValue', required: true },
    { key: 'end_time_value', type: 'date', label: 'layout.calendar.endTimeValue', required: false },
  ],

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
      field_mappings: {},
    };
  },

  interactionConstraints: {
    panAxis: 'none',
    nodeDragAxis: 'none',
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
        nodeDragAxis: 'none',
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
