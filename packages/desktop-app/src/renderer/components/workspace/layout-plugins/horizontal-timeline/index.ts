import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { WorkspaceLayoutPlugin, LayoutRenderNode, NodeDropContext, NodeDropResult } from '../types';
import { TimelineBackground } from './TimelineBackground';
import { TimelineOverlay } from './TimelineOverlay';
import { computeTimelineLayout } from './timeline-layout';
import { PIXELS_PER_DAY, todayEpochDays, epochDaysToDate } from './scale-utils';

export const horizontalTimelinePlugin: WorkspaceLayoutPlugin = {
  key: 'horizontal-timeline',
  displayName: 'Gantt Chart',

  requiredFields: [
    { key: 'time_value', type: 'date' as 'number', label: 'layout.timeline.timeValue', required: true },
    { key: 'end_time_value', type: 'date' as 'number', label: 'layout.timeline.endTimeValue', required: false },
    { key: 'role', type: 'enum', label: 'layout.timeline.role', required: true, default: 'occurrence', options: ['period', 'occurrence'] },
    { key: 'color', type: 'string', label: 'layout.timeline.color', required: false },
  ],

  configSchema: [],

  getDefaultConfig() {
    return {
      _originDay: todayEpochDays(),
      field_mappings: {},
    };
  },

  interactionConstraints: {
    panAxis: 'x', // drag pan = horizontal only. vertical scroll via Shift+wheel
    nodeDragAxis: null, // nodes can be dragged both X (time) and Y (lane)
    enableSpanResize: true,
  },

  computeLayout: computeTimelineLayout,

  classifyNodes(nodes: LayoutRenderNode[]) {
    const cardNodes: LayoutRenderNode[] = [];
    const overlayNodes: LayoutRenderNode[] = [];

    for (const node of nodes) {
      const timeValue = node.metadata.time_value as number | undefined;
      const role = node.metadata.role as string | undefined;
      const endTimeValue = node.metadata.end_time_value as number | undefined;

      // Hide nodes without time data on timeline
      if (timeValue == null) continue;

      // Period with both dates → overlay band
      if (role === 'period' && endTimeValue != null) {
        overlayNodes.push(node);
      } else {
        // Occurrence → card node
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
      onClick: ({ setZoom, setPanX }) => {
        setZoom(1);
        setPanX(window.innerWidth / 2);
      },
    },
  ],

  onNodeDrop(context: NodeDropContext): NodeDropResult {
    const { newX, newY, node, config, zoom } = context;
    const fieldMappings = config.field_mappings as Record<string, Record<string, string>> | undefined;
    const archetypeId = node.archetypeId;
    const originDay = (config._originDay as number) ?? todayEpochDays();

    // InteractionLayer applies dy/zoom, but timeline Y has no zoom.
    // Reverse: actualDy = (newY - node.y) * zoom, then actualY = node.y + actualDy
    const correctedY = node.y + (newY - node.y) * zoom;

    // Reverse-calculate: workspace X -> epoch days -> ISO date
    const epochDay = Math.round(originDay + newX / PIXELS_PER_DAY);
    const date = epochDaysToDate(epochDay);
    const isoDate = date.toISOString().split('T')[0]; // YYYY-MM-DD

    const propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> = [];

    if (archetypeId && fieldMappings?.[archetypeId]?.time_value && node.conceptId) {
      propertyUpdates.push({
        conceptId: node.conceptId,
        fieldId: fieldMappings[archetypeId].time_value,
        value: isoDate,
      });
    }

    return {
      position: { x: Math.round(newX), y: Math.round(correctedY) },
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },
};
