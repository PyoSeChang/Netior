import type { WorkspaceLayoutPlugin, LayoutRenderNode } from '../types';
import { FreeformBackground } from './FreeformBackground';

export const freeformPlugin: WorkspaceLayoutPlugin = {
  key: 'freeform',
  displayName: 'Freeform',

  requiredFields: [],
  configSchema: [],
  getDefaultConfig: () => ({}),

  interactionConstraints: {
    panAxis: null,
    nodeDragAxis: null,
    enableSpanResize: false,
  },
  viewportMode: 'world',
  wheelBehavior: 'freeform',
  persistViewport: true,

  computeLayout({ nodes }) {
    const result: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) {
      result[node.id] = { x: node.x, y: node.y };
    }
    return result;
  },

  classifyNodes(nodes: LayoutRenderNode[]) {
    return { cardNodes: nodes, overlayNodes: [] };
  },

  BackgroundComponent: FreeformBackground,
};
