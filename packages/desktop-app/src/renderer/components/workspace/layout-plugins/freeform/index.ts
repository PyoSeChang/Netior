import type { NodeConfig, NodeSortConfig } from '@netior/shared/types';
import type { RenderEdge } from '../../types';
import type { WorkspaceLayoutPlugin, LayoutRenderNode } from '../types';
import { extractNodeConfig } from '../../../../lib/node-config';
import { FreeformBackground } from './FreeformBackground';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getNodeWidth(node: Pick<LayoutRenderNode, 'width'>): number {
  return Math.max(node.width ?? 160, 1);
}

function getNodeHeight(node: Pick<LayoutRenderNode, 'height'>): number {
  return Math.max(node.height ?? 60, 1);
}

function buildContainsMaps(nodes: LayoutRenderNode[], edges: RenderEdge[]): {
  childrenByParent: Map<string, string[]>;
  parentByChild: Map<string, string>;
} {
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = new Map<string, string[]>();
  const parentByChild = new Map<string, string>();

  for (const edge of edges) {
    if (edge.systemContract !== 'core:contains') continue;
    if (!visibleNodeIds.has(edge.sourceId) || !visibleNodeIds.has(edge.targetId)) continue;

    const children = childrenByParent.get(edge.sourceId) ?? [];
    children.push(edge.targetId);
    childrenByParent.set(edge.sourceId, children);
    parentByChild.set(edge.targetId, edge.sourceId);
  }

  return { childrenByParent, parentByChild };
}

function getNodeDepth(nodeId: string, parentByChild: Map<string, string>): number {
  let depth = 0;
  let current = parentByChild.get(nodeId);

  while (current) {
    depth += 1;
    current = parentByChild.get(current);
  }

  return depth;
}

function collectSubtreeIds(rootId: string, childrenByParent: Map<string, string[]>): string[] {
  const ordered: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    ordered.push(current);

    const children = childrenByParent.get(current);
    if (!children) continue;
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push(children[i]);
    }
  }

  return ordered;
}

function shiftSubtree(
  nodeId: string,
  deltaX: number,
  deltaY: number,
  nodeMap: Map<string, LayoutRenderNode>,
  childrenByParent: Map<string, string[]>,
): void {
  if (deltaX === 0 && deltaY === 0) return;

  for (const descendantId of collectSubtreeIds(nodeId, childrenByParent)) {
    const node = nodeMap.get(descendantId);
    if (!node) continue;
    node.x += deltaX;
    node.y += deltaY;
  }
}

function isSortableNodeConfig(nodeConfig: NodeConfig | null | undefined): nodeConfig is Extract<NodeConfig, { kind: 'grid' | 'list' }> {
  return !!nodeConfig && nodeConfig.kind !== 'freeform';
}

function getGroupNodeConfig(node: LayoutRenderNode): NodeConfig | null {
  const nodeConfig = extractNodeConfig(node.metadata);
  if (!node.isGroup || !nodeConfig) return null;
  return nodeConfig;
}

function getSortValue(node: LayoutRenderNode, sort: NodeSortConfig): unknown {
  if (sort.kind === 'system_slot') {
    return node.metadata[sort.slot];
  }

  const fieldValues = node.metadata.__fieldValues;
  if (!isRecord(fieldValues)) return undefined;
  return fieldValues[sort.fieldId];
}

function isEmptySortValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

function compareDefinedSortValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  if (typeof left === 'boolean' && typeof right === 'boolean') {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function comparePosition(left: LayoutRenderNode, right: LayoutRenderNode): number {
  if (left.y !== right.y) return left.y - right.y;
  if (left.x !== right.x) return left.x - right.x;
  return left.id.localeCompare(right.id);
}

function compareSortableNodes(
  left: LayoutRenderNode,
  right: LayoutRenderNode,
  sort: NodeSortConfig | null | undefined,
): number {
  if (!sort) return comparePosition(left, right);

  const leftValue = getSortValue(left, sort);
  const rightValue = getSortValue(right, sort);
  const leftEmpty = isEmptySortValue(leftValue);
  const rightEmpty = isEmptySortValue(rightValue);

  if (leftEmpty !== rightEmpty) {
    const emptyDirection = sort.emptyPlacement === 'first' ? -1 : 1;
    return leftEmpty ? emptyDirection : -emptyDirection;
  }

  if (!leftEmpty && !rightEmpty) {
    const direction = sort.direction === 'desc' ? -1 : 1;
    const valueComparison = compareDefinedSortValues(leftValue, rightValue) * direction;
    if (valueComparison !== 0) return valueComparison;
  }

  return comparePosition(left, right);
}

function getSortedChildren(
  children: LayoutRenderNode[],
  sort: NodeSortConfig | null | undefined,
): LayoutRenderNode[] {
  return [...children].sort((left, right) => compareSortableNodes(left, right, sort));
}

function getGridMetrics(
  container: LayoutRenderNode,
  children: LayoutRenderNode[],
  config: Extract<NodeConfig, { kind: 'grid' }>,
): {
  width: number;
  height: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  padding: number;
  gapX: number;
  gapY: number;
} {
  const columns = Math.max(1, Math.floor(config.columns ?? 2));
  const gapX = Math.max(0, config.gapX ?? 16);
  const gapY = Math.max(0, config.gapY ?? 16);
  const padding = Math.max(0, config.padding ?? 24);
  const cellWidth = Math.max(config.itemWidth ?? 0, ...children.map(getNodeWidth), 160);
  const cellHeight = Math.max(config.itemHeight ?? 0, ...children.map(getNodeHeight), 60);
  const usedColumns = Math.min(columns, children.length);
  const rows = Math.ceil(children.length / columns);

  return {
    width: Math.max(
      getNodeWidth(container),
      padding * 2 + usedColumns * cellWidth + Math.max(0, usedColumns - 1) * gapX,
    ),
    height: Math.max(
      getNodeHeight(container),
      padding * 2 + rows * cellHeight + Math.max(0, rows - 1) * gapY,
    ),
    columns,
    cellWidth,
    cellHeight,
    padding,
    gapX,
    gapY,
  };
}

function getListMetrics(
  container: LayoutRenderNode,
  children: LayoutRenderNode[],
  config: Extract<NodeConfig, { kind: 'list' }>,
): {
  width: number;
  height: number;
  itemHeight: number;
  padding: number;
  gap: number;
} {
  const padding = Math.max(0, config.padding ?? 24);
  const gap = Math.max(0, config.gap ?? 12);
  const maxChildWidth = Math.max(...children.map(getNodeWidth), 160);
  const itemHeight = Math.max(config.itemHeight ?? 0, ...children.map(getNodeHeight), 60);

  return {
    width: Math.max(getNodeWidth(container), padding * 2 + maxChildWidth),
    height: Math.max(
      getNodeHeight(container),
      padding * 2 + children.length * itemHeight + Math.max(0, children.length - 1) * gap,
    ),
    itemHeight,
    padding,
    gap,
  };
}

function applyGroupNodeSize(
  container: LayoutRenderNode,
  children: LayoutRenderNode[],
  config: NodeConfig,
): void {
  if (!isSortableNodeConfig(config) || children.length === 0) return;

  const metrics = config.kind === 'grid'
    ? getGridMetrics(container, children, config)
    : getListMetrics(container, children, config);

  container.width = metrics.width;
  container.height = metrics.height;
}

function applyGroupNodePositions(
  container: LayoutRenderNode,
  children: LayoutRenderNode[],
  config: NodeConfig,
  nodeMap: Map<string, LayoutRenderNode>,
  childrenByParent: Map<string, string[]>,
): void {
  if (!isSortableNodeConfig(config) || children.length === 0) return;

  if (config.kind === 'grid') {
    const metrics = getGridMetrics(container, children, config);
    const left = container.x - metrics.width / 2;
    const top = container.y - metrics.height / 2;

    container.width = metrics.width;
    container.height = metrics.height;

    children.forEach((child, index) => {
      const column = index % metrics.columns;
      const row = Math.floor(index / metrics.columns);
      const targetX = left + metrics.padding + column * (metrics.cellWidth + metrics.gapX) + metrics.cellWidth / 2;
      const targetY = top + metrics.padding + row * (metrics.cellHeight + metrics.gapY) + metrics.cellHeight / 2;
      shiftSubtree(child.id, targetX - child.x, targetY - child.y, nodeMap, childrenByParent);
    });
    return;
  }

  const metrics = getListMetrics(container, children, config);
  const left = container.x - metrics.width / 2;
  const top = container.y - metrics.height / 2;

  container.width = metrics.width;
  container.height = metrics.height;

  children.forEach((child, index) => {
    const targetX = left + metrics.padding + getNodeWidth(child) / 2;
    const targetY = top + metrics.padding + index * (metrics.itemHeight + metrics.gap) + metrics.itemHeight / 2;
    shiftSubtree(child.id, targetX - child.x, targetY - child.y, nodeMap, childrenByParent);
  });
}

function projectConfiguredGroupNodes(nodes: LayoutRenderNode[], edges: RenderEdge[]): LayoutRenderNode[] {
  const projectedNodes = nodes.map((node) => ({ ...node }));
  const nodeMap = new Map(projectedNodes.map((node) => [node.id, node] as const));
  const { childrenByParent, parentByChild } = buildContainsMaps(projectedNodes, edges);

  const configuredGroups = projectedNodes
    .map((node) => ({ node, config: getGroupNodeConfig(node) }))
    .filter((item): item is { node: LayoutRenderNode; config: NodeConfig } => !!item.config)
    .filter((item) => item.config.kind !== 'freeform');

  const sizeOrder = [...configuredGroups].sort(
    (left, right) => getNodeDepth(right.node.id, parentByChild) - getNodeDepth(left.node.id, parentByChild),
  );

  for (const { node, config } of sizeOrder) {
    const liveContainer = nodeMap.get(node.id);
    if (!liveContainer) continue;

    const children = (childrenByParent.get(node.id) ?? [])
      .map((childId) => nodeMap.get(childId))
      .filter((child): child is LayoutRenderNode => !!child);

    applyGroupNodeSize(liveContainer, children, config);
  }

  const positionOrder = [...configuredGroups].sort(
    (left, right) => getNodeDepth(left.node.id, parentByChild) - getNodeDepth(right.node.id, parentByChild),
  );

  for (const { node, config } of positionOrder) {
    const liveContainer = nodeMap.get(node.id);
    if (!liveContainer) continue;

    const directChildren = (childrenByParent.get(node.id) ?? [])
      .map((childId) => nodeMap.get(childId))
      .filter((child): child is LayoutRenderNode => !!child);

    const sortedChildren = isSortableNodeConfig(config)
      ? getSortedChildren(directChildren, config.sort)
      : directChildren;

    applyGroupNodePositions(liveContainer, sortedChildren, config, nodeMap, childrenByParent);
  }

  return projectedNodes;
}

export const freeformPlugin: WorkspaceLayoutPlugin = {
  key: 'freeform',
  displayName: 'Freeform',

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

  projectNodes({ nodes, edges }) {
    return projectConfiguredGroupNodes(nodes, edges);
  },

  computeLayout({ nodes }) {
    const result: Record<string, { x: number; y: number; width?: number; height?: number }> = {};
    for (const node of nodes) {
      result[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height };
    }
    return result;
  },

  classifyNodes(nodes: LayoutRenderNode[]) {
    return { cardNodes: nodes, overlayNodes: [] };
  },

  BackgroundComponent: FreeformBackground,
};
