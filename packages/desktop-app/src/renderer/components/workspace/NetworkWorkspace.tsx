import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { NodeContextMenu } from './NodeContextMenu';
import { NetworkContextMenu } from './NetworkContextMenu';
import { NetworkControls } from './NetworkControls';
import { useInteraction } from './InteractionLayer';
import { EdgeContextMenu } from './EdgeContextMenu';
import { FileNodeAddModal } from './FileNodeAddModal';
import { ObjectPickerModal } from './ObjectPickerModal';
import { useNetworkStore, type NetworkNodeWithObject, type EdgeWithRelationType } from '../../stores/network-store';
import { networkService, layoutService, fileService, objectService } from '../../services';
import { conceptPropertyService } from '../../services';
import type { NodePosition, EdgeVisual } from '../../services/network-service';
import { useConceptStore } from '../../stores/concept-store';
import { useEditorStore } from '../../stores/editor-store';
import { useUIStore } from '../../stores/ui-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useRelationTypeStore } from '../../stores/relation-type-store';
import { useContextStore } from '../../stores/context-store';
import { useProjectStore } from '../../stores/project-store';
import { useNetworkObjectSelectionStore } from '../../stores/network-object-selection-store';
import type { Archetype } from '@netior/shared/types';
import { useI18n } from '../../hooks/useI18n';
import type { RenderNode, RenderEdge, RenderPoint } from './types';
import type { NodeResizeDirection } from '../canvas/node-components/types';
import { getLayout } from './layout-plugins/registry';
import type { LayoutRenderNode } from './layout-plugins/types';
import { isoToEpochDays } from './layout-plugins/horizontal-timeline/scale-utils';
import { useNetworkShortcuts } from './useNetworkShortcuts';

interface NetworkWorkspaceProps {
  projectId: string;
}

interface ParsedNodePosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

interface NodeResizeState {
  nodeId: string;
  direction: NodeResizeDirection;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  minWidth: number;
  minHeight: number;
}

interface NodeResizePreview {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const HIERARCHY_HEADER_OFFSET = 76;
const HIERARCHY_ROW_GAP = 92;
const GROUP_COLLAPSED_SIZE = { width: 240, height: 72 };
const HIERARCHY_COLLAPSED_SIZE = { width: 260, height: 84 };

function pickInitialNetworkId(
  projectId: string,
  networks: Array<{ id: string; project_id: string | null; scope: string; parent_network_id: string | null }>,
): string | null {
  const projectNetworks = networks.filter((network) => network.project_id === projectId);
  if (projectNetworks.length === 0) return null;

  const projectNetworkIds = new Set(projectNetworks.map((network) => network.id));
  const topLevelProjectNetworks = projectNetworks.filter(
    (network) => !network.parent_network_id || !projectNetworkIds.has(network.parent_network_id),
  );

  const preferredRoot =
    topLevelProjectNetworks.find((network) => network.scope === 'project') ??
    topLevelProjectNetworks[0] ??
    projectNetworks[0];

  return preferredRoot?.id ?? null;
}

function buildPositionMap(positions: NodePosition[]): Map<string, ParsedNodePosition> {
  const map = new Map<string, ParsedNodePosition>();
  for (const p of positions) {
    try {
      const parsed = JSON.parse(p.positionJson) as Record<string, unknown>;
      map.set(p.nodeId, {
        ...parsed,
        x: typeof parsed.x === 'number' ? parsed.x : 0,
        y: typeof parsed.y === 'number' ? parsed.y : 0,
        width: typeof parsed.width === 'number' ? parsed.width : undefined,
        height: typeof parsed.height === 'number' ? parsed.height : undefined,
      });
    } catch {
      // skip invalid JSON
    }
  }
  return map;
}

function buildContainsParentMap(edges: EdgeWithRelationType[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const edge of edges) {
    if (edge.system_contract !== 'core:contains') continue;
    if (edge.source_node_id === edge.target_node_id) continue;
    map.set(edge.target_node_id, edge.source_node_id);
  }
  return map;
}

function getPositionSlotIndex(position?: ParsedNodePosition): number | null {
  return typeof position?.slotIndex === 'number' ? position.slotIndex : null;
}

function isCollapsedPosition(position?: ParsedNodePosition): boolean {
  return position?.collapsed === true;
}

function getDefaultNodeDimensions(node: NetworkNodeWithObject): { width: number; height: number } {
  const rawNodeType = node.node_type as string;
  const isPortal = rawNodeType === 'portal';
  const isGroup = rawNodeType === 'group' || rawNodeType === 'box';
  const isHierarchy = rawNodeType === 'hierarchy';
  const objectType = node.object?.object_type;

  if (objectType === 'concept') {
    return {
      width: isPortal ? 180 : isHierarchy ? 380 : isGroup ? 360 : 160,
      height: isPortal ? 68 : isHierarchy ? 240 : isGroup ? 220 : 60,
    };
  }

  if (objectType === 'file') {
    return {
      width: isHierarchy ? 300 : isGroup ? 280 : 140,
      height: isHierarchy ? 220 : isGroup ? 180 : 50,
    };
  }

  if (objectType === 'network') {
    return {
      width: isPortal ? 180 : isHierarchy ? 340 : isGroup ? 320 : 160,
      height: isPortal ? 68 : isHierarchy ? 220 : isGroup ? 200 : 60,
    };
  }

  return {
    width: isHierarchy ? 340 : isGroup ? 320 : objectType === 'project' ? 180 : 140,
    height: isHierarchy ? 220 : isGroup ? 200 : objectType === 'project' ? 64 : 50,
  };
}

function getNodeDimensions(
  nodeId: string,
  nodeById: Map<string, NetworkNodeWithObject>,
  rawPosMap: Map<string, ParsedNodePosition>,
): { width: number; height: number } {
  const defaults = nodeById.get(nodeId) ? getDefaultNodeDimensions(nodeById.get(nodeId)!) : { width: 160, height: 60 };
  const position = rawPosMap.get(nodeId);
  return {
    width: typeof position?.width === 'number' ? position.width : defaults.width,
    height: typeof position?.height === 'number' ? position.height : defaults.height,
  };
}

function buildHierarchyChildMap(
  nodes: NetworkNodeWithObject[],
  rawPosMap: Map<string, ParsedNodePosition>,
  containsParentByChild: Map<string, string>,
): Map<string, string[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const grouped = new Map<string, NetworkNodeWithObject[]>();

  for (const node of nodes) {
    const parentId = containsParentByChild.get(node.id);
    if (!parentId) continue;

    const parent = nodeById.get(parentId);
    if ((parent?.node_type as string) !== 'hierarchy') continue;

    const siblings = grouped.get(parentId) ?? [];
    siblings.push(node);
    grouped.set(parentId, siblings);
  }

  const childMap = new Map<string, string[]>();
  for (const [parentId, children] of grouped) {
    children.sort((left, right) => {
      const leftPos = rawPosMap.get(left.id);
      const rightPos = rawPosMap.get(right.id);
      const leftSlot = getPositionSlotIndex(leftPos);
      const rightSlot = getPositionSlotIndex(rightPos);

      if (leftSlot != null || rightSlot != null) {
        if (leftSlot == null) return 1;
        if (rightSlot == null) return -1;
        if (leftSlot !== rightSlot) return leftSlot - rightSlot;
      }

      const leftY = leftPos?.y ?? 0;
      const rightY = rightPos?.y ?? 0;
      if (leftY !== rightY) return leftY - rightY;

      const leftX = leftPos?.x ?? 0;
      const rightX = rightPos?.x ?? 0;
      if (leftX !== rightX) return leftX - rightX;

      return left.created_at.localeCompare(right.created_at);
    });

    childMap.set(parentId, children.map((child) => child.id));
  }

  return childMap;
}

function getHierarchyAnchor(parentSize: { width: number; height: number }, childIndex: number): RenderPoint {
  return {
    x: 0,
    y: -(parentSize.height / 2) + HIERARCHY_HEADER_OFFSET + childIndex * HIERARCHY_ROW_GAP,
  };
}

function resolveWorldPosition(
  nodeId: string,
  nodeById: Map<string, NetworkNodeWithObject>,
  rawPosMap: Map<string, ParsedNodePosition>,
  containsParentByChild: Map<string, string>,
  hierarchyChildrenByParent: Map<string, string[]>,
  cache: Map<string, ParsedNodePosition>,
  visiting: Set<string>,
): ParsedNodePosition {
  const cached = cache.get(nodeId);
  if (cached) return cached;

  const base = rawPosMap.get(nodeId) ?? { x: 0, y: 0 };
  if (visiting.has(nodeId)) return base;

  const parentId = containsParentByChild.get(nodeId);
  if (!parentId) {
    cache.set(nodeId, base);
    return base;
  }

  visiting.add(nodeId);
  const parent = resolveWorldPosition(
    parentId,
    nodeById,
    rawPosMap,
    containsParentByChild,
    hierarchyChildrenByParent,
    cache,
    visiting,
  );
  visiting.delete(nodeId);

  const parentNodeType = nodeById.get(parentId)?.node_type as string | undefined;
  if (parentNodeType === 'hierarchy') {
    const children = hierarchyChildrenByParent.get(parentId) ?? [];
    const childIndex = Math.max(children.indexOf(nodeId), 0);
    const parentSize = getNodeDimensions(parentId, nodeById, rawPosMap);
    const anchor = getHierarchyAnchor(parentSize, childIndex);
    const resolved = {
      ...base,
      x: parent.x + anchor.x + base.x,
      y: parent.y + anchor.y + base.y,
    };
    cache.set(nodeId, resolved);
    return resolved;
  }

  const resolved = {
    ...base,
    x: parent.x + base.x,
    y: parent.y + base.y,
  };
  cache.set(nodeId, resolved);
  return resolved;
}

function buildWorldPositionMap(
  nodes: NetworkNodeWithObject[],
  rawPosMap: Map<string, ParsedNodePosition>,
  containsParentByChild: Map<string, string>,
): Map<string, ParsedNodePosition> {
  const cache = new Map<string, ParsedNodePosition>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const hierarchyChildrenByParent = buildHierarchyChildMap(nodes, rawPosMap, containsParentByChild);
  const ids = new Set<string>([...nodes.map((node) => node.id), ...rawPosMap.keys()]);

  for (const nodeId of ids) {
    resolveWorldPosition(
      nodeId,
      nodeById,
      rawPosMap,
      containsParentByChild,
      hierarchyChildrenByParent,
      cache,
      new Set<string>(),
    );
  }

  return cache;
}

function toRenderPoint(value: unknown): RenderPoint | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as { x?: unknown; y?: unknown };
  if (typeof candidate.x !== 'number' || typeof candidate.y !== 'number') return null;

  return { x: candidate.x, y: candidate.y };
}

function buildVisualMap(
  visuals: EdgeVisual[],
): Map<string, { color?: string; lineStyle?: string; directed?: boolean; route?: RenderEdge['route']; routePoints?: RenderPoint[] }> {
  const map = new Map<string, { color?: string; lineStyle?: string; directed?: boolean; route?: RenderEdge['route']; routePoints?: RenderPoint[] }>();
  for (const v of visuals) {
    try {
      const parsed = JSON.parse(v.visualJson);
      const route = parsed.route === 'straight' || parsed.route === 'orthogonal' || parsed.route === 'hidden'
        ? parsed.route as RenderEdge['route']
        : undefined;
      const routePoints = Array.isArray(parsed.waypoints)
        ? parsed.waypoints
          .map((waypoint: unknown) => toRenderPoint(waypoint))
          .filter((point: RenderPoint | null): point is RenderPoint => point !== null)
        : undefined;
      map.set(v.edgeId, {
        color: parsed.color,
        lineStyle: parsed.line_style,
        directed: parsed.directed,
        route,
        routePoints,
      });
    } catch {
      // skip invalid JSON
    }
  }
  return map;
}

function getGenericObjectPresentation(
  objectType?: string,
  objectRefId?: string,
  networkNames?: Map<string, string>,
  projectNames?: Map<string, string>,
  archetypeNames?: Map<string, string>,
  relationTypeNames?: Map<string, string>,
  contextNames?: Map<string, string>,
): { label: string; icon: string; semanticTypeLabel: string } {
  switch (objectType) {
    case 'network':
      return {
        label: (objectRefId ? networkNames?.get(objectRefId) : undefined) ?? 'Network',
        icon: '🌐',
        semanticTypeLabel: 'Network',
      };
    case 'project':
      return {
        label: (objectRefId ? projectNames?.get(objectRefId) : undefined) ?? 'Project',
        icon: '🗂️',
        semanticTypeLabel: 'Project',
      };
    case 'archetype':
      return {
        label: (objectRefId ? archetypeNames?.get(objectRefId) : undefined) ?? 'Archetype',
        icon: '◈',
        semanticTypeLabel: 'Archetype',
      };
    case 'relation_type':
      return {
        label: (objectRefId ? relationTypeNames?.get(objectRefId) : undefined) ?? 'Relation Type',
        icon: '↔',
        semanticTypeLabel: 'Relation Type',
      };
    case 'context':
      return {
        label: (objectRefId ? contextNames?.get(objectRefId) : undefined) ?? 'Context',
        icon: '◫',
        semanticTypeLabel: 'Context',
      };
    case 'agent':
      return { label: 'Agent', icon: '✦', semanticTypeLabel: 'Agent' };
    case 'module':
      return { label: 'Module', icon: '▣', semanticTypeLabel: 'Module' };
    case 'folder':
      return { label: 'Folder', icon: '📁', semanticTypeLabel: 'Folder' };
    default:
      return { label: objectType ?? 'Object', icon: '📦', semanticTypeLabel: objectType ?? 'Object' };
  }
}

function toRenderNodes(
  nodes: NetworkNodeWithObject[],
  archetypes: Archetype[],
  posMap: Map<string, ParsedNodePosition>,
  networkNames: Map<string, string>,
  projectNames: Map<string, string>,
  archetypeNames: Map<string, string>,
  relationTypeNames: Map<string, string>,
  contextNames: Map<string, string>,
): RenderNode[] {
  const archMap = new Map(archetypes.map((a) => [a.id, a]));
  return nodes.map((n) => {
    const pos = posMap.get(n.id);
    const objectType = n.object?.object_type;
    const rawNodeType = n.node_type as string;
    const isPortal = n.node_type === 'portal';
    const isGroup = rawNodeType === 'group' || rawNodeType === 'box';
    const isHierarchy = rawNodeType === 'hierarchy';
    const isContainer = isGroup || isHierarchy;
    const isCollapsed = isContainer && isCollapsedPosition(pos);
    if (objectType === 'concept' && n.concept) {
      const arch = n.concept.archetype_id ? archMap.get(n.concept.archetype_id) : undefined;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label: n.concept.title,
        icon: n.concept.icon || arch?.icon || '📌',
        shape: isPortal ? 'dashed' : isHierarchy ? 'hierarchy' : isGroup ? 'group' : arch?.node_shape ?? undefined,
        semanticType: arch?.name || 'concept',
        semanticTypeLabel: isPortal ? 'Concept Portal' : isHierarchy ? 'Concept Hierarchy' : isGroup ? 'Concept Group' : arch?.name || 'Concept',
        width: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
          : pos?.width ?? (isPortal ? 180 : isHierarchy ? 380 : isGroup ? 360 : 160),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : pos?.height ?? (isPortal ? 68 : isHierarchy ? 240 : isGroup ? 220 : 60),
        conceptId: n.object?.ref_id ?? undefined,
        canvasCount: 0,
        nodeType: 'concept' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
      };
    }
    if (objectType === 'file' && n.file) {
      const isFile = n.file.type === 'file';
      const filePath = n.file.path;
      const fileName = filePath?.replace(/\\/g, '/').split('/').pop() || '?';
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label: fileName,
        icon: isFile ? `file:${fileName}` : `folder:${fileName}`,
        semanticType: isFile ? 'file' : 'directory',
        semanticTypeLabel: isPortal
          ? 'File Portal'
          : isHierarchy
            ? (isFile ? 'File Hierarchy' : 'Directory Hierarchy')
            : isGroup
              ? (isFile ? 'File Group' : 'Directory Group')
              : isFile ? 'File' : 'Directory',
        shape: isHierarchy ? 'hierarchy' : isGroup ? 'group' : undefined,
        width: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
          : pos?.width ?? (isHierarchy ? 300 : isGroup ? 280 : 140),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : pos?.height ?? (isHierarchy ? 220 : isGroup ? 180 : 50),
        canvasCount: 0,
        nodeType: isFile ? 'file' as const : 'dir' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
        fileId: n.object?.ref_id ?? undefined,
        filePath: filePath ?? undefined,
      };
    }
    if (objectType === 'network') {
      const refId = n.object?.ref_id;
      const networkName = refId ? networkNames.get(refId) : undefined;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label: networkName ?? 'Network',
        icon: '🌐',
        shape: isPortal ? 'dashed' as string | undefined : isHierarchy ? 'hierarchy' as string | undefined : isGroup ? 'group' as string | undefined : 'rectangle' as string | undefined,
        semanticType: 'network',
        semanticTypeLabel: isPortal ? 'Network Portal' : isHierarchy ? 'Network Hierarchy' : isGroup ? 'Network Group' : 'Network',
        width: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
          : pos?.width ?? (isPortal ? 180 : isHierarchy ? 340 : isGroup ? 320 : 160),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : pos?.height ?? (isPortal ? 68 : isHierarchy ? 220 : isGroup ? 200 : 60),
        canvasCount: 0,
        nodeType: 'network' as const,
        objectType,
        objectTargetId: refId ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
        networkId: refId ?? undefined,
      };
    }
    const genericObject = getGenericObjectPresentation(
      objectType,
      n.object?.ref_id,
      networkNames,
      projectNames,
      archetypeNames,
      relationTypeNames,
      contextNames,
    );

    return {
      id: n.id,
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      label: genericObject.label,
      icon: genericObject.icon,
      semanticType: objectType ?? 'unknown',
      semanticTypeLabel: isHierarchy
        ? `${genericObject.semanticTypeLabel} Hierarchy`
        : isGroup ? `${genericObject.semanticTypeLabel} Group` : genericObject.semanticTypeLabel,
      shape: isPortal ? 'dashed' as string | undefined : isHierarchy ? 'hierarchy' as string | undefined : isGroup ? 'group' as string | undefined : undefined,
      width: isCollapsed
        ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
        : pos?.width ?? (isHierarchy ? 340 : isGroup ? 320 : objectType === 'project' ? 180 : 140),
      height: isCollapsed
        ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
        : pos?.height ?? (isHierarchy ? 220 : isGroup ? 200 : objectType === 'project' ? 64 : 50),
      canvasCount: 0,
      nodeType: 'object' as const,
      objectType,
      objectTargetId: n.object?.ref_id ?? undefined,
      isPortal,
      isGroup,
      isHierarchy,
      isContainer,
      isCollapsed,
    };
  });
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  objectType?: string;
  objectTargetId?: string;
  objectTitle?: string;
  conceptId?: string;
  fileId?: string;
  filePath?: string;
  networkId?: string;
}

interface FileDropItem {
  path: string;
  type: 'file' | 'dir';
}

function parseFileDropItems(raw: string): FileDropItem[] {
  try {
    const payload = JSON.parse(raw) as {
      type?: 'file' | 'dir' | 'directory';
      path?: string;
      paths?: string[];
      items?: Array<{ path: string; type?: 'file' | 'dir' | 'directory' }>;
    };

    if (Array.isArray(payload.items) && payload.items.length > 0) {
      return payload.items
        .filter((item): item is { path: string; type?: 'file' | 'dir' | 'directory' } => typeof item.path === 'string' && item.path.length > 0)
        .map((item) => ({
          path: item.path,
          type: item.type === 'directory' || item.type === 'dir' ? 'dir' : 'file',
        }));
    }

    if (typeof payload.path === 'string' && payload.path.length > 0) {
      return [{
        path: payload.path,
        type: payload.type === 'directory' || payload.type === 'dir' ? 'dir' : 'file',
      }];
    }

    if (Array.isArray(payload.paths)) {
      return payload.paths
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
        .map((path) => ({ path, type: 'file' }));
    }
  } catch (err) {
    console.error('[NetworkWorkspace] Invalid file drop payload:', err);
  }

  return [];
}

function resolveEdgePresentation(edge: EdgeWithRelationType): Pick<RenderEdge, 'hidden' | 'route' | 'systemContract'> {
  const systemContract = edge.system_contract ?? null;

  if (systemContract === 'core:contains' || systemContract === 'core:entry_portal') {
    return {
      hidden: true,
      route: 'hidden',
      systemContract,
    };
  }

  return {
    hidden: false,
    route: 'straight',
    systemContract,
  };
}

function toRenderEdges(
  edges: EdgeWithRelationType[],
  visualMap: Map<string, { color?: string; lineStyle?: string; directed?: boolean; route?: RenderEdge['route']; routePoints?: RenderPoint[] }>,
): RenderEdge[] {
  return edges.map((e) => {
    const vis = visualMap.get(e.id);
    const presentation = resolveEdgePresentation(e);
    return {
      id: e.id,
      sourceId: e.source_node_id,
      targetId: e.target_node_id,
      directed: vis?.directed != null ? vis.directed : (e.relation_type?.directed ?? false),
      label: e.relation_type?.name ?? '',
      color: vis?.color ?? e.relation_type?.color ?? undefined,
      lineStyle: (vis?.lineStyle ?? e.relation_type?.line_style ?? undefined) as 'solid' | 'dashed' | 'dotted' | undefined,
      systemContract: presentation.systemContract,
      route: presentation.route === 'straight' ? (vis?.route ?? 'straight') : presentation.route,
      routePoints: vis?.routePoints,
      hidden: presentation.hidden,
    };
  });
}

function isPointInsideNodeBounds(node: RenderNode, x: number, y: number): boolean {
  const width = node.width ?? 160;
  const height = node.height ?? 60;
  return (
    x >= node.x - width / 2 &&
    x <= node.x + width / 2 &&
    y >= node.y - height / 2 &&
    y <= node.y + height / 2
  );
}

function wouldCreateContainmentCycle(
  nodeId: string,
  candidateGroupId: string,
  containsParentByChild: Map<string, string>,
): boolean {
  let current: string | undefined = candidateGroupId;
  while (current) {
    if (current === nodeId) return true;
    current = containsParentByChild.get(current);
  }
  return false;
}

function isDescendantOf(nodeId: string, ancestorId: string, containsParentByChild: Map<string, string>): boolean {
  let current = containsParentByChild.get(nodeId);
  while (current) {
    if (current === ancestorId) return true;
    current = containsParentByChild.get(current);
  }
  return false;
}

function getContainerMinimumSize(node: RenderNode): { width: number; height: number } {
  if (node.isHierarchy) {
    return { width: 260, height: 180 };
  }
  return { width: 220, height: 140 };
}

function computeResizePreview(
  state: NodeResizeState,
  clientX: number,
  clientY: number,
  zoom: number,
): NodeResizePreview {
  const dx = (clientX - state.startClientX) / zoom;
  const dy = (clientY - state.startClientY) / zoom;

  let nextWidth = state.startWidth;
  let nextHeight = state.startHeight;
  let nextX = state.startX;
  let nextY = state.startY;

  if (state.direction.includes('e')) {
    nextWidth = Math.max(state.minWidth, state.startWidth + dx);
    nextX = state.startX + (nextWidth - state.startWidth) / 2;
  }
  if (state.direction.includes('w')) {
    nextWidth = Math.max(state.minWidth, state.startWidth - dx);
    nextX = state.startX + (state.startWidth - nextWidth) / 2;
  }
  if (state.direction.includes('s')) {
    nextHeight = Math.max(state.minHeight, state.startHeight + dy);
    nextY = state.startY + (nextHeight - state.startHeight) / 2;
  }
  if (state.direction.includes('n')) {
    nextHeight = Math.max(state.minHeight, state.startHeight - dy);
    nextY = state.startY + (state.startHeight - nextHeight) / 2;
  }

  return {
    nodeId: state.nodeId,
    x: Math.round(nextX),
    y: Math.round(nextY),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
  };
}

function hasHierarchyAncestor(
  nodeId: string,
  containsParentByChild: Map<string, string>,
  hierarchyContainerIds: Set<string>,
): boolean {
  let current: string | undefined = nodeId;
  while (current) {
    if (hierarchyContainerIds.has(current)) return true;
    current = containsParentByChild.get(current);
  }
  return false;
}

function hasCollapsedAncestor(
  nodeId: string,
  containsParentByChild: Map<string, string>,
  collapsedContainerIds: Set<string>,
): boolean {
  let current = containsParentByChild.get(nodeId);
  while (current) {
    if (collapsedContainerIds.has(current)) return true;
    current = containsParentByChild.get(current);
  }
  return false;
}

export function NetworkWorkspace({ projectId }: NetworkWorkspaceProps): JSX.Element {
  const {
    currentNetwork, currentLayout, nodes, edges, nodePositions, edgeVisuals,
    loadNetworks, openNetwork,
    addNode, removeNode, setNodePosition,
    addEdge, removeEdge, saveViewport,
    navigateToChild, navigateBack,
  } = useNetworkStore();
  const { createConcept } = useConceptStore();
  const { canvasMode } = useUIStore();
  const { t } = useI18n();
  const networkObjectSelection = useNetworkObjectSelectionStore((s) => s.selection);
  const selectedNetworkObjects = useNetworkObjectSelectionStore((s) => s.selectedItems);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [networkContextMenu, setNetworkContextMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
  const [edgeLinkingState, setEdgeLinkingState] = useState<{ sourceNodeId: string } | null>(null);
  const [nodeResizeState, setNodeResizeState] = useState<NodeResizeState | null>(null);
  const [nodeResizePreview, setNodeResizePreview] = useState<NodeResizePreview | null>(null);
  const [fileNodeModalOpen, setFileNodeModalOpen] = useState(false);
  const [fileInsertPosition, setFileInsertPosition] = useState<{ x: number; y: number } | null>(null);
  const [objectPickerOpen, setObjectPickerOpen] = useState(false);
  const [objectInsertPosition, setObjectInsertPosition] = useState<{ x: number; y: number } | null>(null);

  // Load networks and open the project root-like network on first entry
  useEffect(() => {
    loadNetworks(projectId).then(() => {
      const store = useNetworkStore.getState();
      const needsInitialOpen =
        !store.currentNetwork || store.currentNetwork.project_id !== projectId;
      if (!needsInitialOpen) return;

      const initialNetworkId = pickInitialNetworkId(projectId, store.networks);
      if (initialNetworkId) {
        store.openNetwork(initialNetworkId);
      }
    });
  }, [projectId, loadNetworks]);

  useEffect(() => {
    if (selectedNetworkObjects.length === 0 && !networkObjectSelection) {
      setSelectedIds(new Set());
      return;
    }
    const targetObjects = selectedNetworkObjects.length > 0
      ? selectedNetworkObjects
      : networkObjectSelection
        ? [networkObjectSelection]
        : [];
    const targetKeys = new Set(targetObjects.map((item) => `${item.objectType}:${item.id}`));
    const matchedNodeIds = nodes
      .filter((node) =>
        node.object?.ref_id
        && targetKeys.has(`${node.object.object_type}:${node.object.ref_id}`))
      .map((node) => node.id);
    setSelectedIds(new Set(matchedNodeIds));
  }, [networkObjectSelection, nodes, selectedNetworkObjects]);

  // Cancel edge linking when mode changes
  useEffect(() => {
    setEdgeLinkingState(null);
  }, [canvasMode]);

  // Restore viewport from layout (freeform only — timeline always resets to today)
  useEffect(() => {
    if (!currentLayout) return;
    if (currentLayout.layout_type === 'horizontal-timeline') return; // handled by layout reset effect
    if (currentLayout.viewport_json) {
      try {
        const vp = JSON.parse(currentLayout.viewport_json);
        setZoom(vp.zoom ?? 1);
        setPanX(vp.x ?? 0);
        setPanY(vp.y ?? 0);
      } catch {
        // ignore invalid JSON
      }
    }
  }, [currentNetwork?.id]);

  // Reset viewport when layout changes (e.g., freeform → timeline)
  // Reset viewport for timeline networks (always center on today)
  const prevNetworkIdRef = useRef<string | undefined>(undefined);
  const prevLayoutRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!currentNetwork || !containerSize.width) return;
    const newLayout = currentLayout?.layout_type ?? 'freeform';
    const networkChanged = prevNetworkIdRef.current !== currentNetwork.id;
    const layoutChanged = prevLayoutRef.current !== undefined && prevLayoutRef.current !== newLayout;

    if (newLayout === 'horizontal-timeline' && (networkChanged || layoutChanged)) {
      setZoom(1);
      setPanX(containerSize.width / 2);
      setPanY(0);
    } else if (layoutChanged && newLayout === 'freeform') {
      setZoom(1);
      setPanX(containerSize.width / 2);
      setPanY(containerSize.height / 2);
    }

    prevNetworkIdRef.current = currentNetwork.id;
    prevLayoutRef.current = newLayout;
  }, [currentLayout?.layout_type, currentNetwork?.id, containerSize]);

  // Container resize observer — shift viewport center when canvas resizes
  const prevSizeRef = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const prev = prevSizeRef.current;
      if (prev) {
        const dx = width - prev.width;
        const dy = height - prev.height;
        if (dx !== 0 || dy !== 0) {
          setPanX((p) => p + dx / 2);
          setPanY((p) => p + dy / 2);
        }
      }
      prevSizeRef.current = { width, height };
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const relationTypes = useRelationTypeStore((s) => s.relationTypes);
  const contexts = useContextStore((s) => s.contexts);
  const membersByContext = useContextStore((s) => s.membersByContext);
  const activeContextId = useContextStore((s) => s.activeContextId);
  const loadContexts = useContextStore((s) => s.loadContexts);
  const loadContextMembers = useContextStore((s) => s.loadMembers);
  const projects = useProjectStore((s) => s.projects);
  const networks = useNetworkStore((s) => s.networks);
  const networkNames = useMemo(() => new Map(networks.map((n) => [n.id, n.name])), [networks]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.name])), [projects]);
  const archetypeNames = useMemo(() => new Map(archetypes.map((archetype) => [archetype.id, archetype.name])), [archetypes]);
  const relationTypeNames = useMemo(() => new Map(relationTypes.map((relationType) => [relationType.id, relationType.name])), [relationTypes]);
  const contextNames = useMemo(() => new Map(contexts.map((context) => [context.id, context.name])), [contexts]);
  const rawPosMap = useMemo(() => buildPositionMap(nodePositions), [nodePositions]);
  const containsParentByChild = useMemo(() => buildContainsParentMap(edges), [edges]);
  const worldPosMap = useMemo(
    () => buildWorldPositionMap(nodes, rawPosMap, containsParentByChild),
    [nodes, rawPosMap, containsParentByChild],
  );
  const visualMap = useMemo(() => buildVisualMap(edgeVisuals), [edgeVisuals]);

  useEffect(() => {
    if (!currentNetwork) return;
    loadContexts(currentNetwork.id);
  }, [currentNetwork?.id, loadContexts]);

  useEffect(() => {
    if (!activeContextId) return;
    if (membersByContext[activeContextId]) return;
    loadContextMembers(activeContextId);
  }, [activeContextId, loadContextMembers, membersByContext]);

  const activeContextMembers = activeContextId ? (membersByContext[activeContextId] ?? []) : [];
  const activeContext = activeContextId ? contexts.find((context) => context.id === activeContextId) ?? null : null;
  const activeContextObjectIds = useMemo(
    () => new Set(activeContextMembers.filter((member) => member.member_type === 'object').map((member) => member.member_id)),
    [activeContextMembers],
  );
  const activeContextEdgeIds = useMemo(
    () => new Set(activeContextMembers.filter((member) => member.member_type === 'edge').map((member) => member.member_id)),
    [activeContextMembers],
  );
  const isContextFiltering = !!activeContextId && activeContextMembers.length > 0;

  const renderNodes = useMemo(() => {
    const baseNodes = toRenderNodes(
      nodes,
      archetypes,
      worldPosMap,
      networkNames,
      projectNames,
      archetypeNames,
      relationTypeNames,
      contextNames,
    );

    if (!isContextFiltering) return baseNodes;

    return baseNodes.map((node, index) => ({
      ...node,
      dimmed: nodes[index]?.object ? !activeContextObjectIds.has(nodes[index].object!.id) : true,
    }));
  }, [
    nodes,
    archetypes,
    worldPosMap,
    networkNames,
    projectNames,
    archetypeNames,
    relationTypeNames,
    contextNames,
    isContextFiltering,
    activeContextObjectIds,
  ]);

  const collapsedContainerIds = useMemo(
    () => new Set(renderNodes.filter((node) => node.isCollapsed).map((node) => node.id)),
    [renderNodes],
  );

  const visibleRenderNodes = useMemo(
    () => renderNodes.filter((node) => !hasCollapsedAncestor(node.id, containsParentByChild, collapsedContainerIds)),
    [renderNodes, containsParentByChild, collapsedContainerIds],
  );

  const hierarchyContainerIds = useMemo(
    () => new Set(visibleRenderNodes.filter((node) => node.isHierarchy).map((node) => node.id)),
    [visibleRenderNodes],
  );

  const renderEdges = useMemo(() => {
    const baseEdges = toRenderEdges(edges, visualMap);
    const visibleNodeIds = new Set(visibleRenderNodes.map((node) => node.id));
    return baseEdges
      .filter((edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId))
      .map((edge) => {
      const explicitRoute = visualMap.get(edge.id)?.route;
      const shouldUseHierarchyRoute =
        edge.route === 'straight' &&
        !explicitRoute &&
        (
          hasHierarchyAncestor(edge.sourceId, containsParentByChild, hierarchyContainerIds) ||
          hasHierarchyAncestor(edge.targetId, containsParentByChild, hierarchyContainerIds)
        );

      return {
        ...edge,
        route: shouldUseHierarchyRoute ? 'orthogonal' : edge.route,
        dimmed: isContextFiltering ? !activeContextEdgeIds.has(edge.id) : edge.dimmed,
      };
    });
  }, [edges, visualMap, isContextFiltering, activeContextEdgeIds, containsParentByChild, hierarchyContainerIds, visibleRenderNodes]);

  // --- Layout plugin ---
  const layoutType = currentLayout?.layout_type ?? 'freeform';
  const layoutPlugin = useMemo(() => getLayout(layoutType), [layoutType]);
  const layoutConfig = useMemo(() => {
    if (!currentLayout?.layout_config_json) return {};
    try { return JSON.parse(currentLayout.layout_config_json); } catch { return {}; }
  }, [currentLayout?.layout_config_json]);

  // Load concept_properties for all concept nodes
  // Re-fetch when concept store properties change (user edits in concept editor)
  const conceptStoreProperties = useConceptStore((s) => s.properties);
  const [nodeProperties, setNodeProperties] = useState<Record<string, Array<{ field_id: string; value: string | null }>>>({});
  const [propsVersion, setPropsVersion] = useState(0);

  // Trigger reload when concept store properties change
  useEffect(() => {
    setPropsVersion((v) => v + 1);
  }, [conceptStoreProperties]);

  useEffect(() => {
    if (layoutType === 'freeform' || !currentNetwork) return;
    const conceptIds = nodes.filter((n) => n.object?.object_type === 'concept').map((n) => n.object!.ref_id);
    if (conceptIds.length === 0) return;

    Promise.all(
      conceptIds.map((cid) =>
        conceptPropertyService.getByConcept(cid).then((props) => [cid, props] as const),
      ),
    ).then((results) => {
      const map: Record<string, Array<{ field_id: string; value: string | null }>> = {};
      for (const [cid, props] of results) map[cid] = props;
      setNodeProperties(map);
    });
  }, [nodes, layoutType, currentNetwork?.id, propsVersion]);

  // Build LayoutRenderNodes with metadata from field_mappings + concept_properties
  const fieldMappingsConfig = (layoutConfig.field_mappings ?? {}) as Record<string, Record<string, string>>;

  const layoutRenderNodes = useMemo<LayoutRenderNode[]>(() =>
    visibleRenderNodes.map((n) => {
      const archetypeId = n.nodeType === 'concept'
        ? nodes.find((cn) => cn.id === n.id)?.concept?.archetype_id ?? undefined
        : undefined;

      // Build metadata from field_mappings
      const metadata: Record<string, unknown> = {};
      if (archetypeId && fieldMappingsConfig[archetypeId]) {
        const mapping = fieldMappingsConfig[archetypeId];
        const conceptId = n.conceptId;
        const props = conceptId ? nodeProperties[conceptId] ?? [] : [];

        for (const [metaKey, fieldIdOrValue] of Object.entries(mapping)) {
          // 'role' is stored directly as a value, not a field_id
          if (metaKey === 'role') {
            metadata[metaKey] = fieldIdOrValue;
            continue;
          }
          // Find the property value by field_id
          const prop = props.find((p) => p.field_id === fieldIdOrValue);
          if (prop?.value != null) {
            // Try date parsing first (for timeline date fields)
            const epochDays = isoToEpochDays(prop.value);
            if (epochDays != null) {
              metadata[metaKey] = epochDays;
            } else {
              const num = Number(prop.value);
              metadata[metaKey] = isNaN(num) ? prop.value : num;
            }
          }
        }
      }

      return { ...n, metadata, archetypeId };
    }),
  [visibleRenderNodes, nodes, fieldMappingsConfig, nodeProperties]);


  // Compute layout positions (freeform returns same positions, timeline computes from metadata)
  const layoutResult = useMemo(
    () => layoutPlugin.computeLayout({
      nodes: layoutRenderNodes,
      edges: renderEdges,
      viewport: { width: containerSize.width, height: containerSize.height },
      config: layoutConfig,
    }),
    [layoutPlugin, layoutRenderNodes, renderEdges, containerSize, layoutConfig],
  );

  // Apply computed positions to nodes
  const positionedNodes = useMemo<LayoutRenderNode[]>(() =>
    layoutRenderNodes.map((n) => {
      const pos = layoutResult[n.id];
      if (!pos) return n;
      return { ...n, x: pos.x, y: pos.y, width: pos.width ?? n.width };
    }),
  [layoutRenderNodes, layoutResult]);

  // Classify nodes (freeform: all as cardNodes, timeline: period+span → overlay)
  const { cardNodes } = useMemo(
    () => layoutPlugin.classifyNodes(positionedNodes),
    [layoutPlugin, positionedNodes],
  );
  const cardRenderNodes = useMemo<RenderNode[]>(() => cardNodes, [cardNodes]);
  const previewRenderNodes = useMemo(() => {
    if (!nodeResizePreview) return visibleRenderNodes;

    const baseNode = visibleRenderNodes.find((node) => node.id === nodeResizePreview.nodeId);
    if (!baseNode) return visibleRenderNodes;

    const deltaX = nodeResizePreview.x - baseNode.x;
    const deltaY = baseNode.isHierarchy
      ? (nodeResizePreview.y - nodeResizePreview.height / 2) - (baseNode.y - (baseNode.height ?? 220) / 2)
      : nodeResizePreview.y - baseNode.y;

    return visibleRenderNodes.map((node) => {
      if (node.id === nodeResizePreview.nodeId) {
        return {
          ...node,
          x: nodeResizePreview.x,
          y: nodeResizePreview.y,
          width: nodeResizePreview.width,
          height: nodeResizePreview.height,
        };
      }

      if (isDescendantOf(node.id, nodeResizePreview.nodeId, containsParentByChild)) {
        return {
          ...node,
          x: node.x + deltaX,
          y: node.y + deltaY,
        };
      }

      return node;
    });
  }, [containsParentByChild, nodeResizePreview, visibleRenderNodes]);

  const previewCardRenderNodes = useMemo<RenderNode[]>(() => (
    cardRenderNodes.map((node) => previewRenderNodes.find((candidate) => candidate.id === node.id) ?? node)
  ), [cardRenderNodes, previewRenderNodes]);

  const openNodeObject = useCallback((node: NetworkNodeWithObject) => {
    if (node.object?.object_type === 'network') {
      navigateToChild(node.object.ref_id);
      return;
    }

    if (node.object?.object_type === 'concept' && node.concept) {
      useEditorStore.getState().openTab({
        type: 'concept',
        targetId: node.object.ref_id,
        title: node.concept.title,
        networkId: node.network_id,
        nodeId: node.id,
      });
      return;
    }

    if (node.object?.object_type === 'file' && node.file?.path) {
      useEditorStore.getState().openTab({
        type: 'file',
        targetId: node.file.path,
        title: node.file.path.replace(/\\/g, '/').split('/').pop() || 'File',
      });
      return;
    }

    if (node.object?.object_type === 'archetype') {
      useEditorStore.getState().openTab({
        type: 'archetype',
        targetId: node.object.ref_id,
        title: archetypeNames.get(node.object.ref_id) ?? t('archetype.title'),
      });
      return;
    }

    if (node.object?.object_type === 'relation_type') {
      useEditorStore.getState().openTab({
        type: 'relationType',
        targetId: node.object.ref_id,
        title: relationTypeNames.get(node.object.ref_id) ?? t('relationType.title'),
      });
      return;
    }

    if (node.object?.object_type === 'context') {
      useEditorStore.getState().openTab({
        type: 'context',
        targetId: node.object.ref_id,
        title: contextNames.get(node.object.ref_id) ?? t('context.title'),
      });
    }
  }, [archetypeNames, contextNames, navigateToChild, relationTypeNames, t]);

  const syncNodeSelection = useCallback((node?: NetworkNodeWithObject) => {
    if (!node?.object?.ref_id) {
      useNetworkObjectSelectionStore.getState().clearSelection();
      return;
    }
    const objectType = node.object.object_type;
    if (!['network', 'concept', 'archetype', 'relation_type', 'context'].includes(objectType)) {
      useNetworkObjectSelectionStore.getState().clearSelection();
      return;
    }
    const title =
      node.concept?.title ??
      node.file?.path?.replace(/\\/g, '/').split('/').pop() ??
      networkNames.get(node.object.ref_id) ??
      archetypeNames.get(node.object.ref_id) ??
      relationTypeNames.get(node.object.ref_id) ??
      contextNames.get(node.object.ref_id);
    useNetworkObjectSelectionStore.getState().setSelection({
      objectType: objectType as 'network' | 'concept' | 'archetype' | 'relation_type' | 'context',
      id: node.object.ref_id,
      title,
    });
  }, [archetypeNames, contextNames, networkNames, relationTypeNames]);

  const syncSelectionFromNodeIds = useCallback((nodeIds: string[]) => {
    const selectedObjects = nodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is NetworkNodeWithObject =>
        !!node?.object?.ref_id && ['network', 'concept', 'archetype', 'relation_type', 'context'].includes(node.object.object_type))
      .map((node) => ({
        objectType: node.object!.object_type as 'network' | 'concept' | 'archetype' | 'relation_type' | 'context',
        id: node.object!.ref_id,
        title:
          node.concept?.title ??
          node.file?.path?.replace(/\\/g, '/').split('/').pop() ??
          networkNames.get(node.object!.ref_id) ??
          archetypeNames.get(node.object!.ref_id) ??
          relationTypeNames.get(node.object!.ref_id) ??
          contextNames.get(node.object!.ref_id),
      }))
      .filter((item, index, list) => list.findIndex((candidate) => `${candidate.objectType}:${candidate.id}` === `${item.objectType}:${item.id}`) === index);

    useNetworkObjectSelectionStore.getState().setSelectionState({
      selection: selectedObjects[0] ?? null,
      selectedItems: selectedObjects,
    });
  }, [archetypeNames, contextNames, networkNames, nodes, relationTypeNames]);

  if (layoutPlugin.key !== 'freeform' && cardNodes.length > 0) {
    console.log('[NW] cardNodes:', cardNodes.map(n => ({ id: n.id.slice(0,8), label: n.label, x: n.x, y: n.y, role: (n as any).metadata?.role, tv: (n as any).metadata?.time_value })));
  }

  // --- Mouse interaction (via useInteraction, same pattern as Culturium) ---

  const isTimeline = layoutPlugin.key !== 'freeform';

  const serializePositionJson = useCallback((
    nodeId: string,
    x: number,
    y: number,
    slotIndex?: number | null,
    width?: number,
    height?: number,
    collapsed?: boolean | null,
  ) => {
    const existing = rawPosMap.get(nodeId);
    const nextPosition: ParsedNodePosition = {
      ...(existing ?? {}),
      x,
      y,
    };

    if (slotIndex === null) {
      delete nextPosition.slotIndex;
    } else if (typeof slotIndex === 'number') {
      nextPosition.slotIndex = slotIndex;
    }

    if (typeof width === 'number') {
      nextPosition.width = width;
    }
    if (typeof height === 'number') {
      nextPosition.height = height;
    }
    if (collapsed === null) {
      delete nextPosition.collapsed;
    } else if (typeof collapsed === 'boolean') {
      nextPosition.collapsed = collapsed;
    }
    if (typeof nextPosition.width !== 'number') {
      delete nextPosition.width;
    }
    if (typeof nextPosition.height !== 'number') {
      delete nextPosition.height;
    }

    return JSON.stringify(nextPosition);
  }, [rawPosMap]);

  const findDropTargetContainer = useCallback((nodeId: string, x: number, y: number): RenderNode | null => {
    const candidates = cardRenderNodes
      .filter((node) => node.isContainer && node.id !== nodeId)
      .filter((node) => !node.isCollapsed)
      .filter((node) => !wouldCreateContainmentCycle(nodeId, node.id, containsParentByChild))
      .filter((node) => isPointInsideNodeBounds(node, x, y))
      .sort((left, right) => {
        const leftArea = (left.width ?? 160) * (left.height ?? 60);
        const rightArea = (right.width ?? 160) * (right.height ?? 60);
        return leftArea - rightArea;
      });

    return candidates[0] ?? null;
  }, [cardRenderNodes, containsParentByChild]);

  const getOrderedHierarchySiblings = useCallback((containerId: string, excludeNodeId?: string): RenderNode[] => (
    cardRenderNodes
      .filter((node) => containsParentByChild.get(node.id) === containerId)
      .filter((node) => node.id !== excludeNodeId)
      .sort((left, right) => {
        const leftSlot = getPositionSlotIndex(rawPosMap.get(left.id));
        const rightSlot = getPositionSlotIndex(rawPosMap.get(right.id));
        if (leftSlot != null || rightSlot != null) {
          if (leftSlot == null) return 1;
          if (rightSlot == null) return -1;
          if (leftSlot !== rightSlot) return leftSlot - rightSlot;
        }
        if (left.y !== right.y) return left.y - right.y;
        if (left.x !== right.x) return left.x - right.x;
        return left.id.localeCompare(right.id);
      })
  ), [cardRenderNodes, containsParentByChild, rawPosMap]);

  const getHierarchyInsertionIndex = useCallback((containerId: string, worldY: number, excludeNodeId?: string): number => {
    const siblings = getOrderedHierarchySiblings(containerId, excludeNodeId);
    const insertionIndex = siblings.findIndex((sibling) => worldY < sibling.y);
    return insertionIndex === -1 ? siblings.length : insertionIndex;
  }, [getOrderedHierarchySiblings]);

  const getHierarchySlotIndex = useCallback((containerId: string, insertionIndex: number, excludeNodeId?: string): number => {
    const siblings = getOrderedHierarchySiblings(containerId, excludeNodeId);
    if (siblings.length === 0) return 0;

    const getRankValue = (nodeId: string, fallbackIndex: number): number =>
      getPositionSlotIndex(rawPosMap.get(nodeId)) ?? fallbackIndex * 1024;

    if (insertionIndex <= 0) {
      return getRankValue(siblings[0].id, 0) - 1024;
    }

    if (insertionIndex >= siblings.length) {
      return getRankValue(siblings[siblings.length - 1].id, siblings.length - 1) + 1024;
    }

    const previousRank = getRankValue(siblings[insertionIndex - 1].id, insertionIndex - 1);
    const nextRank = getRankValue(siblings[insertionIndex].id, insertionIndex);
    return previousRank === nextRank ? previousRank + 0.5 : (previousRank + nextRank) / 2;
  }, [getOrderedHierarchySiblings, rawPosMap]);

  const getLocalPlacementForContainer = useCallback((
    nodeId: string,
    container: RenderNode,
    worldX: number,
    worldY: number,
  ): { x: number; y: number; slotIndex?: number | null } => {
    if (!container.isHierarchy) {
      return {
        x: worldX - container.x,
        y: worldY - container.y,
        slotIndex: null,
      };
    }

    const insertionIndex = getHierarchyInsertionIndex(container.id, worldY, nodeId);
    const anchor = getHierarchyAnchor(
      { width: container.width ?? 340, height: container.height ?? 220 },
      insertionIndex,
    );

    return {
      x: worldX - container.x - anchor.x,
      y: worldY - container.y - anchor.y,
      slotIndex: getHierarchySlotIndex(container.id, insertionIndex, nodeId),
    };
  }, [getHierarchyInsertionIndex, getHierarchySlotIndex]);

  const placeNodeAtPosition = useCallback(async (nodeId: string, position: { x: number; y: number }) => {
    if (layoutPlugin.key !== 'freeform' || !currentNetwork || !currentLayout) {
      await setNodePosition(nodeId, serializePositionJson(nodeId, position.x, position.y, null));
      return;
    }

    const targetContainer = findDropTargetContainer(nodeId, position.x, position.y);
    if (!targetContainer) {
      await setNodePosition(nodeId, serializePositionJson(nodeId, position.x, position.y, null));
      return;
    }

    const localPlacement = getLocalPlacementForContainer(nodeId, targetContainer, position.x, position.y);

    await networkService.edge.create({
      network_id: currentNetwork.id,
      source_node_id: targetContainer.id,
      target_node_id: nodeId,
      system_contract: 'core:contains',
    });
    await layoutService.node.setPosition(
      currentLayout.id,
      nodeId,
      serializePositionJson(nodeId, localPlacement.x, localPlacement.y, localPlacement.slotIndex ?? null),
    );
    await openNetwork(currentNetwork.id);
  }, [
    currentLayout,
    currentNetwork,
    findDropTargetContainer,
    getLocalPlacementForContainer,
    layoutPlugin.key,
    openNetwork,
    serializePositionJson,
    setNodePosition,
  ]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (isTimeline) {
      // Timeline: Ctrl+wheel = zoom (X only), wheel = horizontal scroll, Shift+wheel = vertical scroll
      if (e.ctrlKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mouseX = e.clientX - rect.left;
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.min(50, Math.max(0.01, zoom * factor));
        const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
        setZoom(newZoom);
        setPanX(newPanX);
      } else if (e.shiftKey) {
        setPanY((py) => py - e.deltaY);
      } else {
        setPanX((px) => px - e.deltaY);
      }
      return;
    }

    // Freeform: Ctrl+wheel = navigate back only (drill-in removed, use portal instead)
    if (e.ctrlKey) {
      if (e.deltaY > 0) {
        navigateBack();
      }
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(5, Math.max(0.005, zoom * factor));
    const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);
    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  }, [zoom, panX, panY, navigateBack, isTimeline]);

  const handleNodeResizeStart = useCallback((
    nodeId: string,
    direction: NodeResizeDirection,
    startClientX: number,
    startClientY: number,
  ) => {
    if (canvasMode !== 'edit' || layoutPlugin.key !== 'freeform') return;

    const node = previewCardRenderNodes.find((candidate) => candidate.id === nodeId);
    if (!node?.isContainer) return;

    const minSize = getContainerMinimumSize(node);
    setNodeResizeState({
      nodeId,
      direction,
      startClientX,
      startClientY,
      startX: node.x,
      startY: node.y,
      startWidth: node.width ?? minSize.width,
      startHeight: node.height ?? minSize.height,
      minWidth: minSize.width,
      minHeight: minSize.height,
    });
    setNodeResizePreview({
      nodeId,
      x: node.x,
      y: node.y,
      width: node.width ?? minSize.width,
      height: node.height ?? minSize.height,
    });
  }, [canvasMode, layoutPlugin.key, previewCardRenderNodes]);

  useEffect(() => {
    if (!nodeResizeState) return;

    const handleMouseMove = (event: MouseEvent) => {
      setNodeResizePreview(computeResizePreview(nodeResizeState, event.clientX, event.clientY, zoom));
    };

    const handleMouseUp = (event: MouseEvent) => {
      const nextPreview = computeResizePreview(nodeResizeState, event.clientX, event.clientY, zoom);
      setNodeResizeState(null);
      setNodeResizePreview(null);
      void setNodePosition(
        nodeResizeState.nodeId,
        serializePositionJson(
          nodeResizeState.nodeId,
          nextPreview.x,
          nextPreview.y,
          undefined,
          nextPreview.width,
          nextPreview.height,
        ),
      );
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [nodeResizeState, serializePositionJson, setNodePosition, zoom]);

  const handleNodeToggleCollapse = useCallback((nodeId: string) => {
    const nodePosition = rawPosMap.get(nodeId);
    const nextCollapsed = !isCollapsedPosition(nodePosition);
    const nextX = nodePosition?.x ?? 0;
    const nextY = nodePosition?.y ?? 0;
    const nextWidth = typeof nodePosition?.width === 'number' ? nodePosition.width : undefined;
    const nextHeight = typeof nodePosition?.height === 'number' ? nodePosition.height : undefined;

    void setNodePosition(
      nodeId,
      serializePositionJson(nodeId, nextX, nextY, undefined, nextWidth, nextHeight, nextCollapsed),
    );
  }, [rawPosMap, serializePositionJson, setNodePosition]);

  const handleNodeDragEnd = useCallback(async (nodeId: string, x: number, y: number) => {
    if (layoutPlugin.onNodeDrop) {
      const node = positionedNodes.find((n) => n.id === nodeId);
      if (node) {
        const result = layoutPlugin.onNodeDrop({
          nodeId,
          newX: x,
          newY: y,
          zoom,
          config: layoutConfig,
          node,
        });
        await setNodePosition(nodeId, JSON.stringify({ x: result.position.x, y: result.position.y }));
        // TODO: Phase 8 — save propertyUpdates to concept_properties via service
        return;
      }
    }
    await setNodePosition(nodeId, JSON.stringify({ x, y }));
  }, [setNodePosition, layoutPlugin, positionedNodes, layoutConfig, zoom]);

  const handleNodeDragEndWithContainment = useCallback(async (nodeId: string, x: number, y: number) => {
    if (layoutPlugin.onNodeDrop) {
      const node = positionedNodes.find((n) => n.id === nodeId);
      if (node) {
        const result = layoutPlugin.onNodeDrop({
          nodeId,
          newX: x,
          newY: y,
          zoom,
          config: layoutConfig,
          node,
        });
        await setNodePosition(nodeId, serializePositionJson(nodeId, result.position.x, result.position.y, null));
        return;
      }
    }

    if (layoutPlugin.key !== 'freeform' || !currentNetwork || !currentLayout) {
      await setNodePosition(nodeId, serializePositionJson(nodeId, x, y, null));
      return;
    }

    const currentParentGroupId = containsParentByChild.get(nodeId) ?? null;
    const nextParentGroup = findDropTargetContainer(nodeId, x, y);
    const nextParentGroupId = nextParentGroup?.id ?? null;
    const nextLocalPlacement = nextParentGroup
      ? getLocalPlacementForContainer(nodeId, nextParentGroup, x, y)
      : null;
    const nextPositionJson = nextLocalPlacement
      ? serializePositionJson(nodeId, nextLocalPlacement.x, nextLocalPlacement.y, nextLocalPlacement.slotIndex ?? null)
      : serializePositionJson(nodeId, x, y, null);

    if (currentParentGroupId === nextParentGroupId) {
      await setNodePosition(nodeId, nextPositionJson);
      return;
    }

    const existingContainsEdges = edges.filter(
      (edge) => edge.system_contract === 'core:contains' && edge.target_node_id === nodeId,
    );

    for (const edge of existingContainsEdges) {
      await networkService.edge.delete(edge.id);
    }

    if (nextParentGroupId) {
      await networkService.edge.create({
        network_id: currentNetwork.id,
        source_node_id: nextParentGroupId,
        target_node_id: nodeId,
        system_contract: 'core:contains',
      });
    }

    await layoutService.node.setPosition(currentLayout.id, nodeId, nextPositionJson);
    await openNetwork(currentNetwork.id);
  }, [
    containsParentByChild,
    currentLayout,
    currentNetwork,
    edges,
    findDropTargetContainer,
    getLocalPlacementForContainer,
    layoutConfig,
    layoutPlugin,
    openNetwork,
    positionedNodes,
    serializePositionJson,
    setNodePosition,
    zoom,
  ]);

  const handlePanChange = useCallback((newPanX: number, newPanY: number) => {
    setPanX(newPanX);
    setPanY(newPanY);
  }, []);

  const handleNetworkClick = useCallback(() => {
    setSelectedIds(new Set());
    setContextMenu(null);
    setNetworkContextMenu(null);
    setEdgeLinkingState(null);
    setEdgeContextMenu(null);
    useNetworkObjectSelectionStore.getState().clearSelection();
  }, []);

  const addFileNodeAtPosition = useCallback(async (
    path: string,
    type: 'file' | 'dir',
    position: { x: number; y: number },
  ) => {
    if (!currentNetwork) return;

    let fileEntity = await fileService.getByPath(projectId, path);
    if (!fileEntity) {
      fileEntity = await fileService.create({
        project_id: projectId,
        path,
        type: type === 'file' ? 'file' : 'directory',
      });
    }

    const fileObj = await objectService.getByRef('file', fileEntity.id);
    if (!fileObj) {
      console.error('[NetworkWorkspace] File object record was not found:', { fileId: fileEntity.id, path });
      return;
    }

    const node = await addNode({
      network_id: currentNetwork.id,
      object_id: fileObj.id,
    });
    await placeNodeAtPosition(node.id, position);
  }, [addNode, currentNetwork, placeNodeAtPosition, projectId]);

  const handleSelectionBox = useCallback((nodeIds: string[]) => {
    setSelectedIds(new Set(nodeIds));
    syncSelectionFromNodeIds(nodeIds);
  }, [syncSelectionFromNodeIds]);

  const { dragState, nodeDragOffset, handleCanvasMouseDown, handleNodeDragStart } = useInteraction({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    nodes: previewCardRenderNodes,
    zoom,
    panX,
    panY,
    mode: canvasMode,
    constraints: layoutPlugin.interactionConstraints,
    onPanChange: handlePanChange,
    onNodeDragEnd: handleNodeDragEndWithContainment,
    onSelectionBox: handleSelectionBox,
    onCanvasClick: handleNetworkClick,
    onWheel: handleWheel,
  });

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentNetwork) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - panX) / zoom;
    const worldY = (my - panY) / zoom;
    setNetworkContextMenu({ x: e.clientX, y: e.clientY, worldX, worldY });
  }, [currentNetwork, panX, panY, zoom]);

  // Save viewport on change (debounced)
  useEffect(() => {
    if (!currentLayout) return;
    const timer = setTimeout(() => {
      saveViewport(JSON.stringify({ x: panX, y: panY, zoom }));
    }, 500);
    return () => clearTimeout(timer);
  }, [panX, panY, zoom, currentLayout, saveViewport]);

  const fitToScreen = useCallback(() => {
    if (renderNodes.length === 0 || !containerSize.width) return;
    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of renderNodes) {
      const w = n.width ?? 160;
      const h = n.height ?? 60;
      minX = Math.min(minX, n.x - w / 2);
      minY = Math.min(minY, n.y - h / 2);
      maxX = Math.max(maxX, n.x + w / 2);
      maxY = Math.max(maxY, n.y + h / 2);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;
    const scaleX = (containerSize.width - padding * 2) / contentW;
    const scaleY = (containerSize.height - padding * 2) / contentH;
    const newZoom = Math.min(scaleX, scaleY, 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setZoom(newZoom);
    setPanX(containerSize.width / 2 - centerX * newZoom);
    setPanY(containerSize.height / 2 - centerY * newZoom);
  }, [renderNodes, containerSize]);

  const networkHistory = useNetworkStore((s) => s.networkHistory);
  const toggleMode = useCallback(() => {
    useUIStore.getState().setCanvasMode(canvasMode === 'browse' ? 'edit' : 'browse');
  }, [canvasMode]);

  useNetworkShortcuts({
    selectedIds,
    renderNodes,
    edgeLinkingActive: !!edgeLinkingState,
    canvasMode,
    onClearSelection: () => {
      setSelectedIds(new Set());
      useNetworkObjectSelectionStore.getState().clearSelection();
    },
    onDeleteSelection: () => {
      selectedIds.forEach((id) => removeNode(id));
      setSelectedIds(new Set());
      useNetworkObjectSelectionStore.getState().clearSelection();
    },
    onCancelLinking: () => setEdgeLinkingState(null),
    onSelectAll: () => {
      const allNodeIds = renderNodes.map((node) => node.id);
      setSelectedIds(new Set(allNodeIds));
      syncSelectionFromNodeIds(allNodeIds);
    },
    onFitToScreen: fitToScreen,
  });

  if (!currentNetwork) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        {t('network.noNetworkSelected')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-surface-base"
      style={{ cursor: dragState.type === 'pan' ? 'grabbing' : dragState.type === 'node' ? 'move' : 'default' }}
      onMouseDown={(e) => {
        setNetworkContextMenu(null);
        setContextMenu(null);
        setEdgeContextMenu(null);
        handleCanvasMouseDown(e);
      }}
      onContextMenu={handleContextMenu}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/netior-node')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={async (e) => {
        const raw = e.dataTransfer.getData('application/netior-node');
        if (!raw || !currentNetwork) return;
        e.preventDefault();
        const dropItems = parseFileDropItems(raw);
        if (dropItems.length === 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panX) / zoom;
        const worldY = (e.clientY - rect.top - panY) / zoom;
        for (const [index, item] of dropItems.entries()) {
          await addFileNodeAtPosition(item.path, item.type, {
            x: worldX + index * 32,
            y: worldY + index * 32,
          });
        }
      }}
    >
      <NetworkControls
        mode={canvasMode}
        zoom={zoom}
        canGoBack={networkHistory.length > 0}
        canGoForward={false}
        onToggleMode={toggleMode}
        onZoomIn={() => setZoom((z) => Math.min(5, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(0.005, z / 1.2))}
        onFitToScreen={fitToScreen}
        onNavigateBack={() => navigateBack()}
        onNavigateForward={() => {}}
        hiddenControls={layoutPlugin.hiddenControls}
        extraItems={layoutPlugin.controlItems?.map((item) => ({
          ...item,
          onClick: () => item.onClick({ zoom, panX, setZoom, setPanX }),
        }))}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[320px] flex-col gap-2">
        <div className="rounded-lg border border-subtle bg-surface-panel/90 px-3 py-2 shadow-sm backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted">Network</div>
          <div className="truncate text-sm font-medium text-default">{currentNetwork.name}</div>
          {activeContext && (
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
                Context
              </span>
              <span className="truncate text-xs text-secondary">{activeContext.name}</span>
            </div>
          )}
        </div>
      </div>

      <layoutPlugin.BackgroundComponent
        width={containerSize.width}
        height={containerSize.height}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodes={positionedNodes}
        edges={renderEdges}
        config={layoutConfig}
        nodeDragOffset={nodeDragOffset}
      />

      <EdgeLayer
        edges={renderEdges}
        nodes={previewRenderNodes}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodeDragOffset={nodeDragOffset}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'edge' && targetId && canvasMode === 'edit') {
            setEdgeContextMenu({ x, y, edgeId: targetId });
          }
        }}
        onDoubleClick={(edgeId) => {
          const edge = edges.find((e) => e.id === edgeId);
          if (!edge) return;
          const srcNode = nodes.find((n) => n.id === edge.source_node_id);
          const tgtNode = nodes.find((n) => n.id === edge.target_node_id);
          const srcLabel = srcNode?.concept?.title ?? srcNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
          const tgtLabel = tgtNode?.concept?.title ?? tgtNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
          useEditorStore.getState().openTab({
            type: 'edge',
            targetId: edgeId,
            title: `${srcLabel} → ${tgtLabel}`,
          });
        }}
      />

      {layoutPlugin.OverlayComponent && (
        <layoutPlugin.OverlayComponent
          width={containerSize.width}
          height={containerSize.height}
          zoom={zoom}
          panX={panX}
          panY={panY}
          nodes={positionedNodes}
          edges={renderEdges}
          config={layoutConfig}
          nodeDragOffset={nodeDragOffset}
          onNodeClick={(id, event) => {
            setSelectedIds(new Set([id]));
          }}
          onNodeDoubleClick={(id) => {
            const node = nodes.find((n) => n.id === id);
            if (node) openNodeObject(node);
          }}
          onContextMenu={(type, x, y, targetId) => {
            if (type === 'node' && targetId) {
              const node = nodes.find((n) => n.id === targetId);
              if (node) {
                const isConcept = node.object?.object_type === 'concept';
                const isFile = node.object?.object_type === 'file';
                const isNetwork = node.object?.object_type === 'network';
                setContextMenu({
                  x, y,
                  nodeId: targetId,
                  objectType: node.object?.object_type,
                  objectTargetId: node.object?.ref_id,
                  objectTitle: node.concept?.title
                    ?? node.file?.path?.replace(/\\/g, '/').split('/').pop()
                    ?? networkNames.get(node.object?.ref_id ?? '')
                    ?? undefined,
                  conceptId: isConcept ? node.object?.ref_id : undefined,
                  fileId: isFile ? node.object?.ref_id : undefined,
                  filePath: node.file?.path ?? undefined,
                  networkId: isNetwork ? node.object?.ref_id : undefined,
                });
              }
            }
          }}
        />
      )}

      {edgeLinkingState && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-accent text-text-on-accent px-4 py-1.5 rounded-full text-xs flex items-center gap-2 shadow-lg">
          <span>{t('network.selectTarget') ?? 'Click a node to connect'}</span>
          <button
            type="button"
            className="underline opacity-80 hover:opacity-100"
            onClick={() => setEdgeLinkingState(null)}
          >
            {t('common.cancel') ?? 'Cancel'}
          </button>
        </div>
      )}

      <NodeLayer
        nodes={previewCardRenderNodes}
        selectedIds={selectedIds}
        highlightedIds={edgeLinkingState ? new Set(renderNodes.filter((n) => n.id !== edgeLinkingState.sourceNodeId).map((n) => n.id)) : undefined}
        mode={canvasMode}
        zoom={zoom}
        panX={panX}
        panY={panY}
        timelineMode={isTimeline}
        nodeDragOffset={nodeDragOffset}
        onNodeResizeStart={handleNodeResizeStart}
        onNodeToggleCollapse={handleNodeToggleCollapse}
        onNodeClick={(id) => {
          if (edgeLinkingState) {
            if (id !== edgeLinkingState.sourceNodeId && currentNetwork) {
              addEdge({
                network_id: currentNetwork.id,
                source_node_id: edgeLinkingState.sourceNodeId,
                target_node_id: id,
              }).then((edge) => {
                openNetwork(currentNetwork.id);
                const srcNode = nodes.find((n) => n.id === edgeLinkingState.sourceNodeId);
                const tgtNode = nodes.find((n) => n.id === id);
                const srcLabel = srcNode?.concept?.title ?? '?';
                const tgtLabel = tgtNode?.concept?.title ?? '?';
                useEditorStore.getState().openTab({
                  type: 'edge',
                  targetId: edge.id,
                  title: `${srcLabel} → ${tgtLabel}`,
                });
              });
            }
            setEdgeLinkingState(null);
            return;
          }
          const node = nodes.find((n) => n.id === id);
          setSelectedIds(new Set([id]));
          syncNodeSelection(node);
        }}
        onNodeDoubleClick={(id) => {
          const node = nodes.find((n) => n.id === id);
          if (node) openNodeObject(node);
        }}
        onNodeDragStart={handleNodeDragStart}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'node' && targetId) {
            const node = nodes.find((n) => n.id === targetId);
            if (node) {
              const isConcept = node.object?.object_type === 'concept';
              const isFile = node.object?.object_type === 'file';
              const isNetwork = node.object?.object_type === 'network';
              setContextMenu({
                x,
                y,
                nodeId: targetId,
                objectType: node.object?.object_type,
                objectTargetId: node.object?.ref_id,
                objectTitle: node.concept?.title
                  ?? node.file?.path?.replace(/\\/g, '/').split('/').pop()
                  ?? networkNames.get(node.object?.ref_id ?? '')
                  ?? undefined,
                conceptId: isConcept ? node.object?.ref_id : undefined,
                fileId: isFile ? node.object?.ref_id : undefined,
                networkId: isNetwork ? node.object?.ref_id : undefined,
                filePath: node.file?.path ?? undefined,
              });
            }
          }
        }}
      />



      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          objectType={contextMenu.objectType as import('@netior/shared/types').NetworkObjectType | undefined}
          objectTargetId={contextMenu.objectTargetId}
          objectTitle={contextMenu.objectTitle}
          conceptId={contextMenu.conceptId}
          fileId={contextMenu.fileId}
          filePath={contextMenu.filePath}
          networkId={contextMenu.networkId}
          mode={canvasMode}
          onAddConnection={(nodeId) => {
            setEdgeLinkingState({ sourceNodeId: nodeId });
            setContextMenu(null);
          }}
          onOpenNetwork={(networkId) => {
            navigateToChild(networkId);
            setContextMenu(null);
          }}
          onCreateNetwork={async (conceptId) => {
            if (!currentNetwork) return;
            const node = nodes.find((n) => n.object?.object_type === 'concept' && n.object.ref_id === conceptId);
            const name = node?.concept ? `${node.concept.title} Network` : 'New Network';
            const network = await networkService.create({
              project_id: currentNetwork.project_id,
              name,
              parent_network_id: currentNetwork.id,
            });
            // Reload networks list
            await openNetwork(currentNetwork.id);
            if (currentNetwork.project_id) {
              await useNetworkStore.getState().loadNetworks(currentNetwork.project_id);
            }
            // Open NetworkEditor for the new network
            useEditorStore.getState().openTab({
              type: 'network',
              targetId: network.id,
              title: network.name,
            });
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {networkContextMenu && (
        <NetworkContextMenu
          x={networkContextMenu.x}
          y={networkContextMenu.y}
          onCreateConcept={() => {
            if (!currentNetwork) return;
            const draftId = `draft-${Date.now()}`;
            const worldX = networkContextMenu.worldX;
            const worldY = networkContextMenu.worldY;
            const targetGroup = findDropTargetContainer(draftId, worldX, worldY);
            const localPlacement = targetGroup
              ? getLocalPlacementForContainer(draftId, targetGroup, worldX, worldY)
              : null;
            setNetworkContextMenu(null);
            useEditorStore.getState().openTab({
              type: 'concept',
              targetId: draftId,
              title: t('concept.defaultTitle'),
              draftData: {
                networkId: currentNetwork.id,
                parentGroupNodeId: targetGroup?.id,
                slotIndex: typeof localPlacement?.slotIndex === 'number' ? localPlacement.slotIndex : undefined,
                positionX: localPlacement ? localPlacement.x : worldX,
                positionY: localPlacement ? localPlacement.y : worldY,
                allowedArchetypeIds: isTimeline ? Object.keys(fieldMappingsConfig) : undefined,
              },
            });
          }}
          onAddObject={() => {
            setObjectInsertPosition({ x: networkContextMenu.worldX, y: networkContextMenu.worldY });
            setObjectPickerOpen(true);
          }}
          onAddFileNode={() => {
            setFileInsertPosition({ x: networkContextMenu.worldX, y: networkContextMenu.worldY });
            setFileNodeModalOpen(true);
            setNetworkContextMenu(null);
          }}
          onClose={() => setNetworkContextMenu(null)}
        />
      )}

      <FileNodeAddModal
        open={fileNodeModalOpen}
        onClose={() => {
          setFileNodeModalOpen(false);
          setFileInsertPosition(null);
        }}
        onSelect={async (path, type) => {
          await addFileNodeAtPosition(path, type, fileInsertPosition ?? { x: 0, y: 0 });
          setFileNodeModalOpen(false);
          setFileInsertPosition(null);
        }}
      />

      <ObjectPickerModal
        open={objectPickerOpen}
        onClose={() => {
          setObjectPickerOpen(false);
          setObjectInsertPosition(null);
        }}
        onSelect={async (objectType, refId) => {
          if (!currentNetwork || !objectInsertPosition) return;
          const objectRecord = await objectService.getByRef(objectType, refId);
          if (!objectRecord) return;

          const node = await addNode({
            network_id: currentNetwork.id,
            object_id: objectRecord.id,
            node_type: objectType === 'network' || objectType === 'project' ? 'portal' : 'basic',
          });
          await placeNodeAtPosition(node.id, objectInsertPosition);
          setObjectPickerOpen(false);
          setObjectInsertPosition(null);
        }}
      />

    </div>
  );
}
