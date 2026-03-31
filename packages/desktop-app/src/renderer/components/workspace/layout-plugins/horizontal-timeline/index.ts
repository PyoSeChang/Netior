import type { CanvasLayoutPlugin, LayoutRenderNode, NodeDropContext, NodeDropResult } from '../types';
import { TimelineBackground } from './TimelineBackground';
import { TimelineOverlay } from './TimelineOverlay';
import { computeTimelineLayout } from './timeline-layout';
import { PIXELS_PER_DAY, todayEpochDays, epochDaysToDate } from './scale-utils';

export const horizontalTimelinePlugin: CanvasLayoutPlugin = {
  key: 'horizontal-timeline',
  displayName: 'Horizontal Timeline',

  requiredFields: [
    { key: 'time_value', type: 'date' as 'number', label: 'layout.timeline.timeValue', required: true },
    { key: 'end_time_value', type: 'date' as 'number', label: 'layout.timeline.endTimeValue', required: false },
    { key: 'role', type: 'enum', label: 'layout.timeline.role', required: true, default: 'occurrence', options: ['period', 'occurrence'] },
  ],

  configSchema: [],

  getDefaultConfig() {
    return {
      _originDay: todayEpochDays(),
      field_mappings: {},
    };
  },

  interactionConstraints: {
    panAxis: null, // free pan (horizontal scroll + vertical for nodes)
    nodeDragAxis: null,
    enableSpanResize: true,
  },

  computeLayout: computeTimelineLayout,

  classifyNodes(nodes: LayoutRenderNode[]) {
    const cardNodes: LayoutRenderNode[] = [];
    const overlayNodes: LayoutRenderNode[] = [];

    for (const node of nodes) {
      const role = node.metadata.role as string | undefined;
      const endTimeValue = node.metadata.end_time_value as number | undefined;

      if (role === 'period' && endTimeValue != null) {
        overlayNodes.push(node);
      } else {
        cardNodes.push(node);
      }
    }

    return { cardNodes, overlayNodes };
  },

  BackgroundComponent: TimelineBackground,
  OverlayComponent: TimelineOverlay,

  onNodeDrop(context: NodeDropContext): NodeDropResult {
    const { newX, newY, node, config } = context;
    const fieldMappings = config.field_mappings as Record<string, Record<string, string>> | undefined;
    const archetypeId = node.archetypeId;
    const originDay = (config._originDay as number) ?? todayEpochDays();

    // Reverse-calculate: canvas X → epoch days → ISO date
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
      position: { x: Math.round(newX), y: Math.round(newY) },
      propertyUpdates: propertyUpdates.length > 0 ? propertyUpdates : undefined,
    };
  },
};
