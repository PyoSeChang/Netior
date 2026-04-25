import React from 'react';
import { CalendarDays } from 'lucide-react';
import type {
  WorkspaceLayoutPlugin,
  LayoutRenderNode,
  NodeDropContext,
  NodeDropResult,
  SpanResizeContext,
  SpanResizeResult,
} from '../types';
import { TimelineBackground } from './TimelineBackground';
import { TimelineOverlay } from './TimelineOverlay';
import { computeTimelineLayout } from './timeline-layout';
import { PIXELS_PER_DAY, todayEpochDays } from './scale-utils';
import {
  formatTemporalSlotValueForWriteback,
  projectRecurringTemporalNodes,
} from '../temporal-utils';
import {
  getSemanticBoolean,
  getSemanticNumber,
  getSemanticSlotFieldId,
} from '../semantic';

export const horizontalTimelinePlugin: WorkspaceLayoutPlugin = {
  key: 'horizontal-timeline',
  displayName: 'Gantt Chart',

  configSchema: [],

  getDefaultConfig() {
    return {
      _originDay: todayEpochDays(),
    };
  },

  interactionConstraints: {
    panAxis: 'x', // drag pan = horizontal only. vertical scroll via Shift+wheel
    nodeDragAxis: null, // nodes can be dragged both X (time) and Y (lane)
    enableSpanResize: true,
  },
  viewportMode: 'timeline',
  wheelBehavior: 'timeline',
  persistViewport: false,
  getViewportReset({ viewport }) {
    return {
      zoom: 1,
      panX: viewport.width / 2,
      panY: 0,
    };
  },

  computeLayout: computeTimelineLayout,

  projectNodes({ nodes, viewport, viewportState, config }) {
    const originDay = (config._originDay as number) ?? todayEpochDays();
    const pxPerDay = Math.max(PIXELS_PER_DAY * viewportState.zoom, 0.0001);
    const rangeStart = Math.floor(originDay + (-viewportState.panX) / pxPerDay) - 2;
    const rangeEnd = Math.ceil(originDay + (viewport.width - viewportState.panX) / pxPerDay) + 2;
    return projectRecurringTemporalNodes(nodes, rangeStart, rangeEnd);
  },

  classifyNodes(nodes: LayoutRenderNode[]) {
    const cardNodes: LayoutRenderNode[] = [];
    const overlayNodes: LayoutRenderNode[] = [];

    for (const node of nodes) {
      const timeValue = getSemanticNumber(node, 'time.start');
      const endTimeValue = getSemanticNumber(node, 'time.end');

      // Hide nodes without time data on timeline
      if (timeValue == null) continue;

      if (endTimeValue != null) {
        overlayNodes.push(node);
      } else {
        cardNodes.push(node);
      }
    }

    return { cardNodes, overlayNodes };
  },

  BackgroundComponent: TimelineBackground,
  OverlayComponent: TimelineOverlay,

  hiddenControls: ['zoom', 'fit', 'nav'],

  controlItems: [
    {
      key: 'go-to-today',
      icon: React.createElement(CalendarDays, { size: 14 }),
      label: '오늘로 이동',
      onClick: ({ setZoom, setPanX, setPanY }) => {
        setZoom(1);
        setPanX(window.innerWidth / 2);
        setPanY(0);
      },
    },
  ],

  onNodeDrop(context: NodeDropContext): NodeDropResult {
    const { newX, newY, node, config, zoom } = context;
    const originDay = (config._originDay as number) ?? todayEpochDays();

    // InteractionLayer applies dy/zoom, but timeline Y has no zoom.
    // Reverse: actualDy = (newY - node.y) * zoom, then actualY = node.y + actualDy
    const correctedY = node.y + (newY - node.y) * zoom;

    // Reverse-calculate: workspace X -> epoch days -> ISO date/datetime
    const epochDay = Math.round(originDay + newX / PIXELS_PER_DAY);

    const startFieldId = getSemanticSlotFieldId(node, 'time.start');
    const allDayFieldId = getSemanticSlotFieldId(node, 'time.all_day');
    const propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> = [];

    if (startFieldId && node.conceptId) {
      propertyUpdates.push({
        conceptId: node.conceptId,
        fieldId: startFieldId,
        value: formatTemporalSlotValue(node, 'start_at', epochDay),
      });
    }
    if (allDayFieldId && node.conceptId) {
      propertyUpdates.push({
        conceptId: node.conceptId,
        fieldId: allDayFieldId,
        value: String(getSemanticBoolean(node, 'time.all_day') === true),
      });
    }

    return {
      position: { x: Math.round(newX), y: Math.round(correctedY) },
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },

  onSpanResize(context: SpanResizeContext): SpanResizeResult {
    const { dx, edge, node, zoom } = context;
    const startFieldId = getSemanticSlotFieldId(node, 'time.start');
    const endFieldId = getSemanticSlotFieldId(node, 'time.end');
    const propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> = [];
    if (!node.conceptId || (!startFieldId && !endFieldId)) return {};

    const pxPerDay = PIXELS_PER_DAY * zoom;
    if (pxPerDay === 0) return {};

    const deltaDays = Math.round(dx / pxPerDay);
    const startDay = getSemanticNumber(node, 'time.start');
    const endDay = getSemanticNumber(node, 'time.end');
    if (startDay == null || endDay == null) return {};

    if (edge === 'start' && startFieldId) {
      const nextStartDay = Math.min(startDay + deltaDays, endDay);
      propertyUpdates.push({
        conceptId: node.conceptId,
        fieldId: startFieldId,
        value: formatTemporalSlotValue(node, 'start_at', nextStartDay),
      });
    }

    if (edge === 'end' && endFieldId) {
      const nextEndDay = Math.max(endDay + deltaDays, startDay);
      propertyUpdates.push({
        conceptId: node.conceptId,
        fieldId: endFieldId,
        value: formatTemporalSlotValue(node, 'end_at', nextEndDay),
      });
    }

    return {
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },
};

function formatTemporalSlotValue(
  node: LayoutRenderNode,
  slot: 'start_at' | 'end_at',
  epochDay: number,
): string {
  const hasTime = node.metadata[`${slot}_has_time`] === true;
  const minutes = typeof node.metadata[`${slot}_minutes`] === 'number'
    ? Number(node.metadata[`${slot}_minutes`])
    : undefined;
  return formatTemporalSlotValueForWriteback(node, slot, epochDay, hasTime ? minutes : undefined, !hasTime);
}
