import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bug } from 'lucide-react';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { EdgeDebugOverlay } from './EdgeDebugOverlay';
import { NodeContextMenu } from './NodeContextMenu';
import { NetworkContextMenu } from './NetworkContextMenu';
import { NetworkControls } from './NetworkControls';
import { useInteraction } from './InteractionLayer';
import { EdgeContextMenu } from './EdgeContextMenu';
import { FileNodeAddModal } from './FileNodeAddModal';
import { ObjectPickerModal } from './ObjectPickerModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
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
import type { Archetype, ArchetypeField } from '@netior/shared/types';
import { useI18n } from '../../hooks/useI18n';
import type { RenderNode, RenderEdge, RenderPoint, RenderEdgeAnchor } from './types';
import type { NodeResizeDirection } from './node-components/types';
import { getAutoNodeWidth } from './node-components/node-visual-utils';
import { getLayout } from './layout-plugins/registry';
import type { LayoutRenderNode } from './layout-plugins/types';
import { dateToEpochDays, isoToEpochDays } from './layout-plugins/horizontal-timeline/scale-utils';
import { formatTemporalSlotValueForWriteback, getOccurrenceKey, getSourceNodeId } from './layout-plugins/temporal-utils';
import { useNetworkShortcuts } from './useNetworkShortcuts';
import { HIERARCHY_PARENT_CONTRACT, isHierarchyParentContract } from '../../lib/hierarchy-contract';

interface NetworkWorkspaceProps {
  projectId: string | null;
}

interface ParsedNodePosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

interface EntryPortalChipSpec {
  id: string;
  networkId: string;
  targetNodeId: string;
  label: string;
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

interface ParsedTemporalMetadataValue {
  epochDay: number;
  minutesOfDay?: number;
  hasTime: boolean;
}

interface ParsedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

const HIERARCHY_ROOT_CHILD_MIN_Y_OFFSET = 112;
const HIERARCHY_MAGNETIC_THRESHOLD = 28;
const HIERARCHY_X_MAGNETIC_THRESHOLD = 28;
const GROUP_COLLAPSED_SIZE = { width: 240, height: 80 };
const HIERARCHY_COLLAPSED_SIZE = { width: 260, height: 84 };

function toEpochDay(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function parseDateOnlyParts(value: string): ParsedDateTimeParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseDateTimeParts(value: string): (ParsedDateTimeParts & { hasExplicitZone: boolean }) | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    hasExplicitZone: !!match[6],
  };
}

function extractDateTimePartsInTimeZone(date: Date, timeZone: string): ParsedDateTimeParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: Intl.DateTimeFormatPartTypes): number | null => {
      const part = parts.find((item) => item.type === type)?.value;
      return part ? Number(part) : null;
    };
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    if (year == null || month == null || day == null || hour == null || minute == null) {
      return null;
    }
    return { year, month, day, hour, minute };
  } catch {
    return null;
  }
}

function parseTemporalMetadataValue(value: string, timeZone?: string | null): ParsedTemporalMetadataValue | null {
  const dateOnly = parseDateOnlyParts(value);
  if (dateOnly) {
    return {
      epochDay: toEpochDay(dateOnly.year, dateOnly.month, dateOnly.day),
      hasTime: false,
    };
  }

  const dateTimeParts = parseDateTimeParts(value);
  if (dateTimeParts) {
    if (!dateTimeParts.hasExplicitZone) {
      return {
        epochDay: toEpochDay(dateTimeParts.year, dateTimeParts.month, dateTimeParts.day),
        minutesOfDay: (dateTimeParts.hour ?? 0) * 60 + (dateTimeParts.minute ?? 0),
        hasTime: true,
      };
    }

    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      if (timeZone) {
        const zonedParts = extractDateTimePartsInTimeZone(parsed, timeZone);
        if (zonedParts) {
          return {
            epochDay: toEpochDay(zonedParts.year, zonedParts.month, zonedParts.day),
            minutesOfDay: (zonedParts.hour ?? 0) * 60 + (zonedParts.minute ?? 0),
            hasTime: true,
          };
        }
      }
      return {
        epochDay: dateToEpochDays(parsed),
        minutesOfDay: parsed.getHours() * 60 + parsed.getMinutes(),
        hasTime: true,
      };
    }
  }

  const fallbackEpochDay = isoToEpochDays(value);
  return fallbackEpochDay == null ? null : { epochDay: fallbackEpochDay, hasTime: false };
}

function parseBooleanMetadataValue(value: string): boolean | null {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

function parseNumericMetadataValue(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function applySystemSlotMetadata(
  metadata: Record<string, unknown>,
  field: ArchetypeField,
  rawValue: string,
  slotRawValues: Partial<Record<string, string>>,
): void {
  const slot = field.system_slot;
  if (!slot) return;

  if (slot === 'all_day') {
    const parsed = parseBooleanMetadataValue(rawValue);
    metadata[slot] = parsed ?? rawValue === 'true';
    return;
  }

  if (
    slot === 'start_at'
    || slot === 'end_at'
    || slot === 'due_at'
    || slot === 'recurrence_until'
    || slot === 'completed_at'
    || slot === 'approved_at'
  ) {
    const temporalValue = parseTemporalMetadataValue(rawValue, slotRawValues.timezone);
    if (temporalValue) {
      metadata[slot] = temporalValue.epochDay;
      if (typeof temporalValue.minutesOfDay === 'number') {
        metadata[`${slot}_minutes`] = temporalValue.minutesOfDay;
      }
      if (temporalValue.hasTime) {
        metadata[`${slot}_has_time`] = true;
      }
      return;
    }
  }

  if (
    field.field_type === 'number'
    || field.field_type === 'rating'
    || slot === 'progress_ratio'
    || slot === 'estimate_value'
    || slot === 'actual_value'
    || slot === 'order_index'
    || slot === 'lat'
    || slot === 'lng'
    || slot === 'measure_value'
    || slot === 'target_value'
    || slot === 'budget_amount'
    || slot === 'budget_limit'
    || slot === 'recurrence_count'
  ) {
    const parsed = parseNumericMetadataValue(rawValue);
    metadata[slot] = parsed ?? rawValue;
    return;
  }

  metadata[slot] = rawValue;
}

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

function getHierarchyContainerIdForNode(
  nodeId: string,
  containsParentByChild: Map<string, string>,
  hierarchyContainerIds: Set<string>,
): string | null {
  let current: string | undefined = nodeId;
  while (current) {
    if (hierarchyContainerIds.has(current)) return current;
    current = containsParentByChild.get(current);
  }
  return null;
}

function getHierarchySourceContainerId(
  sourceNodeId: string,
  containsParentByChild: Map<string, string>,
  hierarchyContainerIds: Set<string>,
): string | null {
  if (hierarchyContainerIds.has(sourceNodeId)) return sourceNodeId;
  return getHierarchyContainerIdForNode(sourceNodeId, containsParentByChild, hierarchyContainerIds);
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

function parseNodeMetadataRecord(metadata: string | null | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
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

function getPortalChipStripHeight(chipCount: number): number {
  return chipCount > 0 ? 32 : 0;
}

function buildHierarchyParentMap(
  nodes: NetworkNodeWithObject[],
  edges: EdgeWithRelationType[],
  containsParentByChild: Map<string, string>,
): Map<string, string> {
  const hierarchyContainerIds = new Set(
    nodes
      .filter((node) => (node.node_type as string) === 'hierarchy')
      .map((node) => node.id),
  );
  const map = new Map<string, string>();

  for (const edge of edges) {
    const contract = edge.system_contract ?? '';
    if (!isHierarchyParentContract(contract)) continue;

    const targetHierarchyId = getHierarchyContainerIdForNode(edge.target_node_id, containsParentByChild, hierarchyContainerIds);
    if (!targetHierarchyId) continue;

    const sourceHierarchyId = getHierarchySourceContainerId(edge.source_node_id, containsParentByChild, hierarchyContainerIds);
    if (!sourceHierarchyId || sourceHierarchyId !== targetHierarchyId) continue;
    map.set(edge.target_node_id, edge.source_node_id);
  }

  return map;
}

function buildHierarchyDepthMap(
  nodes: NetworkNodeWithObject[],
  hierarchyParentByChild: Map<string, string>,
  containsParentByChild: Map<string, string>,
): Map<string, number> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const hierarchyContainerIds = new Set(
    nodes
      .filter((node) => (node.node_type as string) === 'hierarchy')
      .map((node) => node.id),
  );
  const depthMap = new Map<string, number>();
  const visiting = new Set<string>();

  const resolveDepth = (nodeId: string): number => {
    const cached = depthMap.get(nodeId);
    if (cached != null) return cached;
    if (visiting.has(nodeId)) return 1;

    visiting.add(nodeId);

    const hierarchyId = getHierarchyContainerIdForNode(nodeId, containsParentByChild, hierarchyContainerIds);
    if (!hierarchyId) {
      visiting.delete(nodeId);
      return 0;
    }

    const parentId = hierarchyParentByChild.get(nodeId);
    let depth = 1;
    if (parentId && parentId !== hierarchyId && !hierarchyContainerIds.has(parentId)) {
      depth = resolveDepth(parentId) + 1;
    }

    visiting.delete(nodeId);
    depthMap.set(nodeId, depth);
    return depth;
  };

  for (const node of nodes) {
    const parentId = containsParentByChild.get(node.id);
    const parent = parentId ? nodeById.get(parentId) : undefined;
    if ((parent?.node_type as string) === 'hierarchy') {
      resolveDepth(node.id);
    }
  }

  return depthMap;
}

function getHierarchyMagneticWorldY(
  candidateYs: number[],
  minimumWorldY: number,
  worldY: number,
): number {
  let nextWorldY = worldY;
  let bestDistance = HIERARCHY_MAGNETIC_THRESHOLD + 1;

  for (const candidateY of candidateYs) {
    const distance = Math.abs(worldY - candidateY);
    if (distance <= HIERARCHY_MAGNETIC_THRESHOLD && distance < bestDistance) {
      bestDistance = distance;
      nextWorldY = candidateY;
    }
  }

  return Math.max(minimumWorldY, nextWorldY);
}

function getHierarchyMagneticWorldX(
  candidateXs: number[],
  worldX: number,
): number {
  let bestX = worldX;
  let bestDistance = HIERARCHY_X_MAGNETIC_THRESHOLD + 1;

  for (const candidateX of candidateXs) {
    const distance = Math.abs(worldX - candidateX);
    if (distance <= HIERARCHY_X_MAGNETIC_THRESHOLD && distance < bestDistance) {
      bestDistance = distance;
      bestX = candidateX;
    }
  }

  return bestX;
}

function getHierarchyRootChildMinimumWorldY(container: { y: number; height?: number }): number {
  return container.y - (container.height ?? 220) / 2 + HIERARCHY_ROOT_CHILD_MIN_Y_OFFSET;
}

function getHierarchyMinimumWorldY(
  hierarchyContainer: RenderNode,
  parentNodeId: string | null | undefined,
  renderNodes: RenderNode[],
): number {
  if (!parentNodeId || parentNodeId === hierarchyContainer.id) {
    return getHierarchyRootChildMinimumWorldY(hierarchyContainer);
  }

  const parentNode = renderNodes.find((node) => node.id === parentNodeId);
  return parentNode ? parentNode.y : getHierarchyRootChildMinimumWorldY(hierarchyContainer);
}

function resolveWorldPosition(
  nodeId: string,
  nodeById: Map<string, NetworkNodeWithObject>,
  rawPosMap: Map<string, ParsedNodePosition>,
  containsParentByChild: Map<string, string>,
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
    cache,
    visiting,
  );
  visiting.delete(nodeId);

  const parentNodeType = nodeById.get(parentId)?.node_type as string | undefined;
  if (parentNodeType === 'hierarchy') {
    const resolved = {
      ...base,
      x: parent.x + base.x,
      y: parent.y + base.y,
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
  edges: EdgeWithRelationType[],
  rawPosMap: Map<string, ParsedNodePosition>,
  containsParentByChild: Map<string, string>,
): Map<string, ParsedNodePosition> {
  const cache = new Map<string, ParsedNodePosition>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ids = new Set<string>([...nodes.map((node) => node.id), ...rawPosMap.keys()]);

  for (const nodeId of ids) {
    resolveWorldPosition(
      nodeId,
      nodeById,
      rawPosMap,
      containsParentByChild,
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
        icon: 'globe',
        semanticTypeLabel: 'Network',
      };
    case 'project':
      return {
        label: (objectRefId ? projectNames?.get(objectRefId) : undefined) ?? 'Project',
        icon: 'folder',
        semanticTypeLabel: 'Project',
      };
    case 'archetype':
      return {
        label: (objectRefId ? archetypeNames?.get(objectRefId) : undefined) ?? 'Archetype',
        icon: 'diamond',
        semanticTypeLabel: 'Archetype',
      };
    case 'relation_type':
      return {
        label: (objectRefId ? relationTypeNames?.get(objectRefId) : undefined) ?? 'Relation Type',
        icon: 'link-2',
        semanticTypeLabel: 'Relation Type',
      };
    case 'context':
      return {
        label: (objectRefId ? contextNames?.get(objectRefId) : undefined) ?? 'Context',
        icon: 'library',
        semanticTypeLabel: 'Context',
      };
    case 'agent':
      return { label: 'Agent', icon: 'sparkles', semanticTypeLabel: 'Agent' };
    case 'module':
      return { label: 'Module', icon: 'box', semanticTypeLabel: 'Module' };
    case 'folder':
      return { label: 'Folder', icon: 'folder', semanticTypeLabel: 'Folder' };
    default:
      return { label: objectType ?? 'Object', icon: 'package', semanticTypeLabel: objectType ?? 'Object' };
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
  portalChipsBySource: Map<string, EntryPortalChipSpec[]>,
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
    const portalChips = portalChipsBySource.get(n.id) ?? [];
    const portalChipStripHeight = getPortalChipStripHeight(portalChips.length);
    const parsedMetadata = parseNodeMetadataRecord(n.metadata);
    if (objectType === 'concept' && n.concept) {
      const arch = n.concept.archetype_id ? archMap.get(n.concept.archetype_id) : undefined;
      const label = n.concept.title;
      const icon = n.concept.icon || arch?.icon || 'pin';
      const baseWidth = isPortal ? 180 : isHierarchy ? 380 : isGroup ? 360 : 160;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label,
        icon,
        shape: isPortal ? 'dashed' : isHierarchy ? 'hierarchy' : isGroup ? 'group' : arch?.node_shape ?? undefined,
        semanticType: arch?.name || 'concept',
        semanticTypeLabel: isPortal ? 'Concept Portal' : isHierarchy ? 'Concept Hierarchy' : isGroup ? 'Concept Group' : arch?.name || 'Concept',
        width: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
          : pos?.width ?? getAutoNodeWidth({ label, icon, baseWidth, metadata: parsedMetadata, isContainer }),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : (pos?.height ?? (isPortal ? 68 : isHierarchy ? 240 : isGroup ? 220 : 60)) + portalChipStripHeight,
        conceptId: n.object?.ref_id ?? undefined,
        nodeType: 'concept' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
        portalChips,
        metadata: parsedMetadata,
      };
    }
    if (objectType === 'file' && n.file) {
      const isFile = n.file.type === 'file';
      const filePath = n.file.path;
      const fileName = filePath?.replace(/\\/g, '/').split('/').pop() || '?';
      const icon = isFile ? `file:${fileName}` : `folder:${fileName}`;
      const baseWidth = isHierarchy ? 300 : isGroup ? 280 : 140;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label: fileName,
        icon,
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
          : pos?.width ?? getAutoNodeWidth({ label: fileName, icon, baseWidth, metadata: parsedMetadata, isContainer }),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : pos?.height ?? (isHierarchy ? 220 : isGroup ? 180 : 50),
        nodeType: isFile ? 'file' as const : 'dir' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
        portalChips,
        fileId: n.object?.ref_id ?? undefined,
        filePath: filePath ?? undefined,
        metadata: parsedMetadata,
      };
    }
    if (objectType === 'network') {
      const refId = n.object?.ref_id;
      const networkName = refId ? networkNames.get(refId) : undefined;
      const label = networkName ?? 'Network';
      const icon = 'globe';
      const baseWidth = isPortal ? 180 : isHierarchy ? 340 : isGroup ? 320 : 160;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label,
        icon,
        shape: isPortal ? 'dashed' as string | undefined : isHierarchy ? 'hierarchy' as string | undefined : isGroup ? 'group' as string | undefined : 'rectangle' as string | undefined,
        semanticType: 'network',
        semanticTypeLabel: isPortal ? 'Network Portal' : isHierarchy ? 'Network Hierarchy' : isGroup ? 'Network Group' : 'Network',
        width: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.width : GROUP_COLLAPSED_SIZE.width)
          : pos?.width ?? getAutoNodeWidth({ label, icon, baseWidth, metadata: parsedMetadata, isContainer }),
        height: isCollapsed
          ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
          : pos?.height ?? (isPortal ? 68 : isHierarchy ? 220 : isGroup ? 200 : 60),
        nodeType: 'network' as const,
        objectType,
        objectTargetId: refId ?? undefined,
        isPortal,
        isGroup,
        isHierarchy,
        isContainer,
        isCollapsed,
        portalChips,
        networkId: refId ?? undefined,
        metadata: parsedMetadata,
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
    const baseWidth = isHierarchy ? 340 : isGroup ? 320 : objectType === 'project' ? 180 : 140;

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
        : pos?.width ?? getAutoNodeWidth({
          label: genericObject.label,
          icon: genericObject.icon,
          baseWidth,
          metadata: parsedMetadata,
          isContainer,
        }),
      height: isCollapsed
        ? (isHierarchy ? HIERARCHY_COLLAPSED_SIZE.height : GROUP_COLLAPSED_SIZE.height)
        : pos?.height ?? (isHierarchy ? 220 : isGroup ? 200 : objectType === 'project' ? 64 : 50),
      nodeType: 'object' as const,
      objectType,
      objectTargetId: n.object?.ref_id ?? undefined,
      isPortal,
      isGroup,
      isHierarchy,
      isContainer,
      isCollapsed,
      portalChips,
      metadata: parsedMetadata,
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

interface DeleteDialogState {
  rootNodeIds: string[];
  nodeIds: string[];
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

function isPointInsideExpandedNodeBounds(node: RenderNode, x: number, y: number, padding: number): boolean {
  const width = (node.width ?? 160) + padding * 2;
  const height = (node.height ?? 60) + padding * 2;
  return (
    x >= node.x - width / 2 &&
    x <= node.x + width / 2 &&
    y >= node.y - height / 2 &&
    y <= node.y + height / 2
  );
}

function getNodeBoundsAtPosition(
  node: Pick<RenderNode, 'width' | 'height'>,
  x: number,
  y: number,
): { left: number; top: number; right: number; bottom: number } {
  const width = node.width ?? 160;
  const height = node.height ?? 60;

  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  };
}

function getBoundsOverlapRatio(
  subjectBounds: { left: number; top: number; right: number; bottom: number },
  containerBounds: { left: number; top: number; right: number; bottom: number },
): number {
  const overlapWidth = Math.max(0, Math.min(subjectBounds.right, containerBounds.right) - Math.max(subjectBounds.left, containerBounds.left));
  const overlapHeight = Math.max(0, Math.min(subjectBounds.bottom, containerBounds.bottom) - Math.max(subjectBounds.top, containerBounds.top));
  const subjectArea = Math.max(1, (subjectBounds.right - subjectBounds.left) * (subjectBounds.bottom - subjectBounds.top));

  return (overlapWidth * overlapHeight) / subjectArea;
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

function getContainmentDepth(nodeId: string, containsParentByChild: Map<string, string>): number {
  let depth = 0;
  let current = containsParentByChild.get(nodeId);

  while (current) {
    depth += 1;
    current = containsParentByChild.get(current);
  }

  return depth;
}

function buildChildrenByParentMap(containsParentByChild: Map<string, string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [childId, parentId] of containsParentByChild.entries()) {
    const children = map.get(parentId) ?? [];
    children.push(childId);
    map.set(parentId, children);
  }
  return map;
}

function buildOwnedChildrenByParentMap(
  containsParentByChild: Map<string, string>,
  hierarchyParentByChild: Map<string, string>,
): Map<string, string[]> {
  const map = buildChildrenByParentMap(containsParentByChild);
  for (const [childId, parentId] of hierarchyParentByChild.entries()) {
    const children = map.get(parentId) ?? [];
    if (!children.includes(childId)) {
      children.push(childId);
    }
    map.set(parentId, children);
  }
  return map;
}

function collectOwnedSubtreeIds(
  rootNodeIds: string[],
  containsParentByChild: Map<string, string>,
  hierarchyParentByChild: Map<string, string>,
): string[] {
  const rootSet = new Set(rootNodeIds);
  const normalizedRoots = rootNodeIds.filter((nodeId) => {
    let current = containsParentByChild.get(nodeId) ?? hierarchyParentByChild.get(nodeId);
    while (current) {
      if (rootSet.has(current)) return false;
      current = containsParentByChild.get(current) ?? hierarchyParentByChild.get(current);
    }
    return true;
  });
  const childrenByParent = buildOwnedChildrenByParentMap(containsParentByChild, hierarchyParentByChild);
  const ordered: string[] = [];
  const visited = new Set<string>();

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    ordered.push(nodeId);
    const children = childrenByParent.get(nodeId) ?? [];
    for (const childId of children) {
      visit(childId);
    }
  };

  for (const rootNodeId of normalizedRoots) {
    visit(rootNodeId);
  }

  return ordered;
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

function getClosestHierarchyAncestorId(
  nodeId: string,
  containsParentByChild: Map<string, string>,
  hierarchyContainerIds: Set<string>,
): string | null {
  let current: string | undefined = nodeId;
  while (current) {
    if (hierarchyContainerIds.has(current)) return current;
    current = containsParentByChild.get(current);
  }
  return null;
}

function resolveOrthogonalEdgeHints(
  edge: RenderEdge,
  nodeMap: Map<string, RenderNode>,
  containsParentByChild: Map<string, string>,
  hierarchyContainerIds: Set<string>,
): Pick<RenderEdge, 'sourceAnchor' | 'targetAnchor' | 'orthogonalAxis' | 'routeStrategy'> {
  const sourceNode = nodeMap.get(edge.sourceId);
  const targetNode = nodeMap.get(edge.targetId);
  if (!sourceNode || !targetNode) return {};

  const sourceHierarchyId = getClosestHierarchyAncestorId(edge.sourceId, containsParentByChild, hierarchyContainerIds);
  const targetHierarchyId = getClosestHierarchyAncestorId(edge.targetId, containsParentByChild, hierarchyContainerIds);
  const sharesHierarchy = !!sourceHierarchyId && sourceHierarchyId === targetHierarchyId;

  if (sharesHierarchy && isHierarchyParentContract(edge.systemContract ?? '')) {
    const downward = targetNode.y >= sourceNode.y;
    const sourceAnchor: RenderEdgeAnchor = edge.sourceId === sourceHierarchyId
      ? (downward ? 'root-bottom' : 'root-top')
      : (downward ? 'bottom' : 'top');
    const targetAnchor: RenderEdgeAnchor = edge.targetId === targetHierarchyId
      ? (downward ? 'root-top' : 'root-bottom')
      : (downward ? 'top' : 'bottom');

    return {
      sourceAnchor,
      targetAnchor,
      orthogonalAxis: 'vertical',
      routeStrategy: 'hierarchy-branch',
    };
  }

  return {};
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
  const isDev = import.meta.env.DEV;
  const {
    currentNetwork, currentLayout, nodes, edges, nodePositions, edgeVisuals,
    loadAppWorkspace, loadNetworks, openNetwork,
    addNode, removeNode, setNodePosition,
    addEdge, removeEdge, saveViewport,
    navigateToChild, navigateBack,
  } = useNetworkStore();
  const concepts = useConceptStore((s) => s.concepts);
  const { createConcept } = useConceptStore();
  const workspaceMode = useUIStore((state) => state.workspaceMode);
  const { t } = useI18n();
  const networkObjectSelection = useNetworkObjectSelectionStore((s) => s.selection);
  const selectedNetworkObjects = useNetworkObjectSelectionStore((s) => s.selectedItems);
  const openProject = useProjectStore((s) => s.openProject);

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
  const [portalAttachSourceNodeId, setPortalAttachSourceNodeId] = useState<string | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<DeleteDialogState | null>(null);
  const [isDeletingNodes, setIsDeletingNodes] = useState(false);
  const [pendingWorldPositionOverrides, setPendingWorldPositionOverrides] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [showEdgeDebugOverlay, setShowEdgeDebugOverlay] = useState(false);

  // Load networks and open the correct root on first entry.
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (!projectId) {
        const appRoot = await loadAppWorkspace();
        if (!appRoot || cancelled) return;

        const store = useNetworkStore.getState();
        const needsInitialOpen =
          !store.currentNetwork
          || store.currentNetwork.scope !== 'app'
          || store.currentNetwork.parent_network_id !== null;
        if (needsInitialOpen) {
          await store.openNetwork(appRoot.id);
        }
        return;
      }

      await loadNetworks(projectId);
      if (cancelled) return;

      const store = useNetworkStore.getState();
      const needsInitialOpen =
        !store.currentNetwork || store.currentNetwork.project_id !== projectId;
      if (!needsInitialOpen) return;

      const projectRoot = await networkService.getProjectRoot(projectId);
      const initialNetworkId = projectRoot?.id ?? pickInitialNetworkId(projectId, store.networks);
      if (initialNetworkId) {
        await store.openNetwork(initialNetworkId);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [loadAppWorkspace, loadNetworks, projectId]);

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
  }, [workspaceMode]);

  // --- Layout plugin ---
  const layoutType = currentLayout?.layout_type ?? 'freeform';
  const layoutPlugin = useMemo(() => getLayout(layoutType), [layoutType]);
  const layoutConfig = useMemo(() => {
    if (!currentLayout?.layout_config_json) return {};
    try { return JSON.parse(currentLayout.layout_config_json); } catch { return {}; }
  }, [currentLayout?.layout_config_json]);
  const viewportPolicy = useMemo(
    () => layoutPlugin.getViewportPolicy?.({
      viewport: containerSize,
      config: layoutConfig,
    }) ?? {},
    [containerSize, layoutConfig, layoutPlugin],
  );
  const viewportMode = viewportPolicy.viewportMode ?? layoutPlugin.viewportMode ?? 'world';
  const wheelBehavior = viewportPolicy.wheelBehavior ?? layoutPlugin.wheelBehavior ?? (viewportMode === 'timeline' ? 'timeline' : 'freeform');
  const persistViewport = viewportPolicy.persistViewport ?? layoutPlugin.persistViewport ?? true;
  const interactionConstraints = viewportPolicy.interactionConstraints ?? layoutPlugin.interactionConstraints;
  const controlsPresentation = layoutPlugin.controlsPresentation ?? 'floating-draggable';

  // Restore viewport from layout when the layout owns persisted pan/zoom.
  useEffect(() => {
    if (!currentLayout) return;
    if (!persistViewport) return;
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
  }, [currentLayout?.id, currentNetwork?.id, persistViewport]);

  // Reset viewport when entering a layout that manages its own framing.
  const prevNetworkIdRef = useRef<string | undefined>(undefined);
  const prevLayoutRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!currentNetwork || !containerSize.width) return;
    const newLayout = layoutPlugin.key;
    const networkChanged = prevNetworkIdRef.current !== currentNetwork.id;
    const layoutChanged = prevLayoutRef.current !== undefined && prevLayoutRef.current !== newLayout;

    if ((networkChanged || layoutChanged) && !persistViewport) {
      const reset = viewportPolicy.viewportReset
        ?? layoutPlugin.getViewportReset?.({
          viewport: containerSize,
          config: layoutConfig,
        })
        ?? { zoom: 1, panX: 0, panY: 0 };
      setZoom(reset.zoom);
      setPanX(reset.panX);
      setPanY(reset.panY);
    } else if (layoutChanged && newLayout === 'freeform') {
      setZoom(1);
      setPanX(containerSize.width / 2);
      setPanY(containerSize.height / 2);
    }

    prevNetworkIdRef.current = currentNetwork.id;
    prevLayoutRef.current = newLayout;
  }, [containerSize, currentNetwork?.id, layoutConfig, layoutPlugin, persistViewport, viewportPolicy]);

  // Container resize observer: shift viewport center when the workspace resizes
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
          if (viewportMode === 'world') {
            setPanX((p) => p + dx / 2);
            setPanY((p) => p + dy / 2);
          } else if (viewportMode === 'timeline') {
            setPanX((p) => p + dx / 2);
          }
        }
      }
      prevSizeRef.current = { width, height };
      setContainerSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportMode]);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const archetypeFieldsById = useArchetypeStore((s) => s.fields);
  const loadArchetypeFields = useArchetypeStore((s) => s.loadFields);
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
  const isTemporalLayout = layoutType === 'horizontal-timeline' || layoutType === 'calendar';
  const temporalArchetypeIds = useMemo(() => (
    archetypes
      .filter((archetype) => (archetypeFieldsById[archetype.id] ?? []).some((field) => field.system_slot === 'start_at'))
      .map((archetype) => archetype.id)
  ), [archetypeFieldsById, archetypes]);
  const relationTypeNames = useMemo(() => new Map(relationTypes.map((relationType) => [relationType.id, relationType.name])), [relationTypes]);
  const contextNames = useMemo(() => new Map(contexts.map((context) => [context.id, context.name])), [contexts]);
  const entryPortalData = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const portalChipsBySource = new Map<string, EntryPortalChipSpec[]>();
    const entryPortalTargetNodeIds = new Set<string>();

    for (const edge of edges) {
      if (edge.system_contract !== 'core:entry_portal') continue;

      const sourceNode = nodeById.get(edge.source_node_id);
      const targetNode = nodeById.get(edge.target_node_id);
      const targetNetworkId =
        targetNode?.object?.object_type === 'network'
          ? targetNode.object.ref_id
          : undefined;

      if (!sourceNode || !targetNode || !targetNetworkId) continue;

      const chips = portalChipsBySource.get(sourceNode.id) ?? [];
      chips.push({
        id: edge.id,
        networkId: targetNetworkId,
        targetNodeId: targetNode.id,
        label: networkNames.get(targetNetworkId) ?? 'Network',
      });
      portalChipsBySource.set(sourceNode.id, chips);
      entryPortalTargetNodeIds.add(targetNode.id);
    }

    for (const chips of portalChipsBySource.values()) {
      chips.sort((left, right) => left.label.localeCompare(right.label));
    }

    return { portalChipsBySource, entryPortalTargetNodeIds };
  }, [edges, networkNames, nodes]);
  const rawPosMap = useMemo(() => buildPositionMap(nodePositions), [nodePositions]);
  const containsParentByChild = useMemo(() => buildContainsParentMap(edges), [edges]);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node] as const)),
    [nodes],
  );
  const allHierarchyContainerIds = useMemo(
    () => new Set(nodes.filter((node) => (node.node_type as string) === 'hierarchy').map((node) => node.id)),
    [nodes],
  );
  const hierarchyParentByChild = useMemo(
    () => buildHierarchyParentMap(nodes, edges, containsParentByChild),
    [nodes, edges, containsParentByChild],
  );
  const hierarchyDepthByNode = useMemo(
    () => buildHierarchyDepthMap(nodes, hierarchyParentByChild, containsParentByChild),
    [nodes, hierarchyParentByChild, containsParentByChild],
  );
  const collectSubtreeIds = useCallback((rootNodeIds: string[]) => (
    collectOwnedSubtreeIds(rootNodeIds, containsParentByChild, hierarchyParentByChild)
  ), [containsParentByChild, hierarchyParentByChild]);
  const worldPosMap = useMemo(
    () => buildWorldPositionMap(nodes, edges, rawPosMap, containsParentByChild),
    [nodes, edges, rawPosMap, containsParentByChild],
  );
  const directChildCountByParent = useMemo(() => {
    const map = new Map<string, number>();
    for (const parentId of containsParentByChild.values()) {
      map.set(parentId, (map.get(parentId) ?? 0) + 1);
    }
    return map;
  }, [containsParentByChild]);
  const visualMap = useMemo(() => buildVisualMap(edgeVisuals), [edgeVisuals]);

  const requestDeleteNodes = useCallback((rootNodeIds: string[]) => {
    const nodeIds = collectSubtreeIds(rootNodeIds);
    if (nodeIds.length === 0) return;
    setDeleteDialogState({ rootNodeIds, nodeIds });
    setContextMenu(null);
    setNetworkContextMenu(null);
    setEdgeContextMenu(null);
    setEdgeLinkingState(null);
  }, [collectSubtreeIds]);

  const confirmDeleteNodes = useCallback(async () => {
    if (!deleteDialogState) return;
    setIsDeletingNodes(true);
    try {
      const nodeDepth = (nodeId: string): number => {
        let depth = 0;
        let current = containsParentByChild.get(nodeId);
        while (current) {
          depth += 1;
          current = containsParentByChild.get(current);
        }
        return depth;
      };

      const orderedNodeIds = [...deleteDialogState.nodeIds].sort((left, right) => {
        const leftScore = nodeDepth(left) * 100 + (hierarchyDepthByNode.get(left) ?? 0);
        const rightScore = nodeDepth(right) * 100 + (hierarchyDepthByNode.get(right) ?? 0);
        return rightScore - leftScore;
      });

      for (const nodeId of orderedNodeIds) {
        await removeNode(nodeId);
      }

      setSelectedIds(new Set());
      useNetworkObjectSelectionStore.getState().clearSelection();
      setDeleteDialogState(null);
    } finally {
      setIsDeletingNodes(false);
    }
  }, [containsParentByChild, deleteDialogState, hierarchyDepthByNode, removeNode]);

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
        entryPortalData.portalChipsBySource,
      ).map((node) => (
        node.isContainer
          ? {
              ...node,
              metadata: {
                ...(node.metadata ?? {}),
                childCount: directChildCountByParent.get(node.id) ?? 0,
                portalCount: node.portalChips?.length ?? 0,
              },
              containmentDepth: getContainmentDepth(node.id, containsParentByChild),
            }
          : {
              ...node,
              containmentDepth: getContainmentDepth(node.id, containsParentByChild),
            }
      ));

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
    entryPortalData,
    containsParentByChild,
    directChildCountByParent,
    isContextFiltering,
    activeContextObjectIds,
  ]);

  const hydratedRenderNodes = useMemo(() => {
    if (!pendingWorldPositionOverrides) return renderNodes;
    return renderNodes.map((node) => {
      const override = pendingWorldPositionOverrides[node.id];
      return override ? { ...node, x: override.x, y: override.y } : node;
    });
  }, [pendingWorldPositionOverrides, renderNodes]);

  const collapsedContainerIds = useMemo(
    () => new Set(hydratedRenderNodes.filter((node) => node.isCollapsed).map((node) => node.id)),
    [hydratedRenderNodes],
  );

  const visibleRenderNodes = useMemo(
    () => hydratedRenderNodes.filter((node) =>
      !entryPortalData.entryPortalTargetNodeIds.has(node.id)
      && !hasCollapsedAncestor(node.id, containsParentByChild, collapsedContainerIds)),
    [hydratedRenderNodes, entryPortalData, containsParentByChild, collapsedContainerIds],
  );

  const hierarchyContainerIds = useMemo(
    () => new Set(visibleRenderNodes.filter((node) => node.isHierarchy).map((node) => node.id)),
    [visibleRenderNodes],
  );

  const renderEdges = useMemo(() => {
    const baseEdges = toRenderEdges(edges, visualMap);
    const visibleNodeIds = new Set(visibleRenderNodes.map((node) => node.id));
    const visibleNodeMap = new Map(visibleRenderNodes.map((node) => [node.id, node] as const));
    return baseEdges
      .filter((edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId))
      .map((edge) => {
        const explicitRoute = visualMap.get(edge.id)?.route;
        const sourceHierarchyId = getClosestHierarchyAncestorId(edge.sourceId, containsParentByChild, hierarchyContainerIds);
        const targetHierarchyId = getClosestHierarchyAncestorId(edge.targetId, containsParentByChild, hierarchyContainerIds);
        const sharesHierarchy = !!sourceHierarchyId && sourceHierarchyId === targetHierarchyId;
        const shouldUseHierarchyRoute =
          edge.route === 'straight' &&
          !explicitRoute &&
          sharesHierarchy &&
          isHierarchyParentContract(edge.systemContract ?? '');
        const route = shouldUseHierarchyRoute ? 'orthogonal' : edge.route;
        const orthogonalHints = route === 'orthogonal' && !edge.routePoints
          ? resolveOrthogonalEdgeHints(edge, visibleNodeMap, containsParentByChild, hierarchyContainerIds)
          : {};

        return {
          ...edge,
          ...orthogonalHints,
          route,
          dimmed: isContextFiltering ? !activeContextEdgeIds.has(edge.id) : edge.dimmed,
        };
      });
  }, [edges, visualMap, isContextFiltering, activeContextEdgeIds, containsParentByChild, hierarchyContainerIds, visibleRenderNodes]);

  const updatePluginConfig = useCallback(async (
    patch:
      | Record<string, unknown>
      | ((config: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    const liveLayout = useNetworkStore.getState().currentLayout;
    if (!liveLayout) return;

    let baseConfig: Record<string, unknown> = {};
    if (liveLayout.layout_config_json) {
      try {
        baseConfig = JSON.parse(liveLayout.layout_config_json) as Record<string, unknown>;
      } catch {
        baseConfig = {};
      }
    }

    const nextConfig = typeof patch === 'function'
      ? patch(baseConfig)
      : { ...baseConfig, ...patch };
    const nextLayout = await layoutService.update(liveLayout.id, {
      layout_config_json: JSON.stringify(nextConfig),
    });
    useNetworkStore.setState({ currentLayout: nextLayout });
  }, []);

  // Load concept_properties for all concept nodes
  // Re-fetch when concept store properties change (user edits in concept editor)
  const conceptStoreProperties = useConceptStore((s) => s.properties);
  const [nodeProperties, setNodeProperties] = useState<Record<string, Array<{ field_id: string; value: string | null }>>>({});
  const [propsVersion, setPropsVersion] = useState(0);

  const persistLayoutPropertyUpdates = useCallback(async (
    propertyUpdates: Array<{ conceptId: string; fieldId: string; value: string }> | undefined,
  ) => {
    if (!propertyUpdates || propertyUpdates.length === 0) return;

    const dedupedUpdates = Array.from(
      propertyUpdates.reduce((map, update) => (
        map.set(`${update.conceptId}:${update.fieldId}`, update)
      ), new Map<string, { conceptId: string; fieldId: string; value: string }>())
        .values(),
    );

    await Promise.all(
      dedupedUpdates.map((update) => useConceptStore.getState().upsertProperty({
        concept_id: update.conceptId,
        field_id: update.fieldId,
        value: update.value,
      })),
    );
  }, []);

  // Trigger reload when concept store properties change
  useEffect(() => {
    setPropsVersion((v) => v + 1);
  }, [conceptStoreProperties]);

  useEffect(() => {
    if (!currentNetwork) return;
    const conceptIds = nodes.filter((n) => n.object?.object_type === 'concept').map((n) => n.object!.ref_id);
    if (conceptIds.length === 0) {
      setNodeProperties({});
      return;
    }

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

  useEffect(() => {
    const archetypeIds = new Set(
      nodes
        .map((node) => node.concept?.archetype_id)
        .filter((value): value is string => !!value),
    );

    for (const archetypeId of archetypeIds) {
      if (!archetypeFieldsById[archetypeId]) {
        void loadArchetypeFields(archetypeId);
      }
    }
  }, [archetypeFieldsById, layoutType, loadArchetypeFields, nodes]);

  const layoutRenderNodes = useMemo<LayoutRenderNode[]>(() =>
    visibleRenderNodes.map((n) => {
      const sourceNode = nodes.find((candidate) => candidate.id === n.id);
      const archetypeId = n.nodeType === 'concept'
        ? sourceNode?.concept?.archetype_id ?? undefined
        : undefined;
      const metadata: Record<string, unknown> = { ...(n.metadata ?? {}) };
      const slotFieldIds: Record<string, string> = {};
      const slotFieldTypes: Record<string, string> = {};
      const conceptId = n.conceptId;
      const props = conceptId ? nodeProperties[conceptId] ?? [] : [];
      const propMap = new Map(props.map((prop) => [prop.field_id, prop.value]));

      if (sourceNode?.concept?.color) {
        metadata.display_color = sourceNode.concept.color;
      } else if (archetypeId) {
        const archetype = archetypes.find((item) => item.id === archetypeId);
        if (archetype?.color) metadata.display_color = archetype.color;
      }

      if (archetypeId) {
        const archetypeFields = archetypeFieldsById[archetypeId] ?? [];
        const slotRawValues: Partial<Record<string, string>> = {};

        for (const field of archetypeFields) {
          if (!field.system_slot) continue;
          slotFieldTypes[field.system_slot] = field.field_type;
          slotFieldIds[field.system_slot] = field.id;
          const rawValue = propMap.get(field.id);
          if (rawValue == null) continue;
          slotRawValues[field.system_slot] = rawValue;
        }

        for (const field of archetypeFields) {
          if (!field.system_slot) continue;
          const rawValue = propMap.get(field.id);
          if (rawValue == null) continue;
          applySystemSlotMetadata(metadata, field, rawValue, slotRawValues);
        }
      }

      if (Object.keys(slotFieldIds).length > 0) {
        metadata.__slotFieldIds = slotFieldIds;
      }
      if (Object.keys(slotFieldTypes).length > 0) {
        metadata.__slotFieldTypes = slotFieldTypes;
      }
      if (propMap.size > 0) {
        metadata.__fieldValues = Object.fromEntries(propMap);
      }
      if (sourceNode?.concept?.recurrence_source_concept_id) {
        metadata.__recurrenceSourceConceptId = sourceNode.concept.recurrence_source_concept_id;
      }
      if (sourceNode?.concept?.recurrence_occurrence_key) {
        metadata.__occurrenceKey = sourceNode.concept.recurrence_occurrence_key;
      }

      return { ...n, metadata, archetypeId };
    }),
  [visibleRenderNodes, nodes, archetypeFieldsById, nodeProperties, archetypes]);

  const projectedLayoutNodes = useMemo<LayoutRenderNode[]>(() => (
    layoutPlugin.projectNodes
      ? layoutPlugin.projectNodes({
        nodes: layoutRenderNodes,
        edges: renderEdges,
        viewport: { width: containerSize.width, height: containerSize.height },
        viewportState: { zoom, panX, panY },
        config: layoutConfig,
      })
      : layoutRenderNodes
  ), [layoutPlugin, layoutRenderNodes, renderEdges, containerSize.width, containerSize.height, zoom, panX, panY, layoutConfig]);


  // Compute layout positions (freeform returns same positions, timeline computes from metadata)
  const layoutResult = useMemo(
    () => layoutPlugin.computeLayout({
      nodes: projectedLayoutNodes,
      edges: renderEdges,
      viewport: { width: containerSize.width, height: containerSize.height },
      viewportState: { zoom, panX, panY },
      config: layoutConfig,
    }),
    [layoutPlugin, projectedLayoutNodes, renderEdges, containerSize, zoom, panX, panY, layoutConfig],
  );

  // Apply computed positions to nodes
  const positionedNodes = useMemo<LayoutRenderNode[]>(() =>
    projectedLayoutNodes.map((n) => {
      const pos = layoutResult[n.id];
      if (!pos) return n;
      return {
        ...n,
        x: pos.x,
        y: pos.y,
        width: pos.width ?? n.width,
        height: pos.height ?? n.height,
      };
    }),
  [projectedLayoutNodes, layoutResult]);
  const positionedNodeById = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node] as const)),
    [positionedNodes],
  );
  const resolveSourceWorkspaceNode = useCallback((renderNodeId: string) => {
    const renderNode = positionedNodeById.get(renderNodeId);
    const sourceNodeId = renderNode ? getSourceNodeId(renderNode) : renderNodeId;
    return nodeById.get(sourceNodeId);
  }, [nodeById, positionedNodeById]);

  // Classify nodes (freeform: all as cardNodes, timeline: period+span ??overlay)
  const { cardNodes } = useMemo(
    () => layoutPlugin.classifyNodes(positionedNodes, layoutConfig),
    [layoutConfig, layoutPlugin, positionedNodes],
  );
  const cardRenderNodes = useMemo<RenderNode[]>(() => cardNodes, [cardNodes]);
  const previewRenderNodes = useMemo(() => {
    if (!nodeResizePreview) return positionedNodes;

    const baseNode = positionedNodes.find((node) => node.id === nodeResizePreview.nodeId);
    if (!baseNode) return positionedNodes;

    const deltaX = nodeResizePreview.x - baseNode.x;
    const deltaY = baseNode.isHierarchy
      ? (nodeResizePreview.y - nodeResizePreview.height / 2) - (baseNode.y - (baseNode.height ?? 220) / 2)
      : nodeResizePreview.y - baseNode.y;

    return positionedNodes.map((node) => {
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
  }, [containsParentByChild, nodeResizePreview, positionedNodes]);

  const previewCardRenderNodes = useMemo<RenderNode[]>(() => (
    cardRenderNodes.map((node) => previewRenderNodes.find((candidate) => candidate.id === node.id) ?? node)
  ), [cardRenderNodes, previewRenderNodes]);

  const findEntryPortalHostAtPosition = useCallback((x: number, y: number): RenderNode | null => {
    const candidates = previewCardRenderNodes
      .filter((node) => node.objectType === 'concept')
      .filter((node) => !node.isCollapsed)
      .filter((node) => isPointInsideNodeBounds(node, x, y))
      .sort((left, right) => {
        const leftArea = (left.width ?? 160) * (left.height ?? 60);
        const rightArea = (right.width ?? 160) * (right.height ?? 60);
        return leftArea - rightArea;
      });

    return candidates[0] ?? null;
  }, [previewCardRenderNodes]);

  const syncHierarchyParentEdge = useCallback(async (nodeId: string, nextParentGroupId: string | null) => {
    if (!currentNetwork) return;

    const nextParentNode = nextParentGroupId ? nodeById.get(nextParentGroupId) : undefined;
    const nextHierarchyParentId = nextParentNode?.node_type === 'hierarchy' ? nextParentGroupId : null;
    const existingHierarchyParentEdges = edges.filter(
      (edge) => isHierarchyParentContract(edge.system_contract) && edge.target_node_id === nodeId,
    );
    const hasExplicitParentInNextHierarchy = !!nextHierarchyParentId && existingHierarchyParentEdges.some((edge) => (
      edge.source_node_id !== nextHierarchyParentId
      && getHierarchySourceContainerId(edge.source_node_id, containsParentByChild, allHierarchyContainerIds) === nextHierarchyParentId
    ));

    for (const edge of existingHierarchyParentEdges) {
      const sourceHierarchyId = getHierarchySourceContainerId(edge.source_node_id, containsParentByChild, allHierarchyContainerIds);
      const belongsToNextHierarchy = !!nextHierarchyParentId && sourceHierarchyId === nextHierarchyParentId;
      if (
        !belongsToNextHierarchy
        || (hasExplicitParentInNextHierarchy && edge.source_node_id === nextHierarchyParentId)
      ) {
        await networkService.edge.delete(edge.id);
      }
    }

    if (
      nextHierarchyParentId &&
      !hasExplicitParentInNextHierarchy &&
      !existingHierarchyParentEdges.some((edge) => (
        edge.source_node_id === nextHierarchyParentId
      ))
    ) {
      await networkService.edge.create({
        network_id: currentNetwork.id,
        source_node_id: nextHierarchyParentId,
        target_node_id: nodeId,
        system_contract: HIERARCHY_PARENT_CONTRACT,
      });
    }
  }, [allHierarchyContainerIds, containsParentByChild, currentNetwork, edges, nodeById]);

  const createHierarchyConnection = useCallback(async (sourceNodeId: string, targetNodeId: string) => {
    if (!currentNetwork) return null;

    const childNodeId = sourceNodeId;
    const parentNodeId = targetNodeId;
    const childHierarchyId = getHierarchyContainerIdForNode(childNodeId, containsParentByChild, allHierarchyContainerIds);
    const parentHierarchyId = getHierarchyContainerIdForNode(parentNodeId, containsParentByChild, allHierarchyContainerIds);
    const childNode = nodeById.get(childNodeId);
    const shouldCreateHierarchyParent =
      !!childHierarchyId &&
      childHierarchyId === parentHierarchyId &&
      childNode?.node_type !== 'hierarchy';

    let systemContract: 'core:hierarchy_parent' | undefined;
    if (shouldCreateHierarchyParent) {
      systemContract = HIERARCHY_PARENT_CONTRACT;

      let current: string | undefined = parentNodeId;
      while (current) {
        if (current === childNodeId) {
          return null;
        }
        current = hierarchyParentByChild.get(current);
      }

      const existingHierarchyParents = edges.filter(
        (edge) => isHierarchyParentContract(edge.system_contract) && edge.target_node_id === childNodeId,
      );
      for (const edge of existingHierarchyParents) {
        await networkService.edge.delete(edge.id);
      }
    }

    const edge = await addEdge({
      network_id: currentNetwork.id,
      source_node_id: shouldCreateHierarchyParent ? parentNodeId : sourceNodeId,
      target_node_id: shouldCreateHierarchyParent ? childNodeId : targetNodeId,
      ...(systemContract ? { system_contract: systemContract } : {}),
    });
    if (shouldCreateHierarchyParent && currentLayout) {
      const currentPosition = rawPosMap.get(childNodeId);
      const hierarchyContainerNode = previewCardRenderNodes.find((node) => node.id === childHierarchyId);
      const currentWorldPosition = worldPosMap.get(childNodeId) ?? currentPosition ?? { x: 0, y: 0 };
      const minimumWorldY = hierarchyContainerNode
        ? getHierarchyMinimumWorldY(hierarchyContainerNode, parentNodeId, previewCardRenderNodes)
        : currentWorldPosition.y;
      const nextPosition: ParsedNodePosition = {
        ...(currentPosition ?? {}),
        x: hierarchyContainerNode ? currentWorldPosition.x - hierarchyContainerNode.x : (currentPosition?.x ?? 0),
        y: hierarchyContainerNode
          ? Math.max(currentWorldPosition.y, minimumWorldY) - hierarchyContainerNode.y
          : (currentPosition?.y ?? 0),
      };
      if (typeof currentPosition?.slotIndex !== 'number') {
        delete nextPosition.slotIndex;
      }
      if (typeof currentPosition?.width !== 'number') {
        delete nextPosition.width;
      }
      if (typeof currentPosition?.height !== 'number') {
        delete nextPosition.height;
      }
      if (currentPosition?.collapsed !== true) {
        delete nextPosition.collapsed;
      }
      await layoutService.node.setPosition(
        currentLayout.id,
        childNodeId,
        JSON.stringify(nextPosition),
      );
    }
    await openNetwork(currentNetwork.id);
    return edge;
  }, [addEdge, allHierarchyContainerIds, containsParentByChild, currentLayout, currentNetwork, edges, hierarchyParentByChild, nodeById, openNetwork, previewCardRenderNodes, rawPosMap, worldPosMap]);

  const createEntryPortalAttachment = useCallback(async (
    sourceNodeId: string,
    networkRefId: string,
    targetNodeId?: string,
  ): Promise<boolean> => {
    if (!currentNetwork) return false;

    const targetNodeForNetwork = nodes.find((node) => (
      entryPortalData.entryPortalTargetNodeIds.has(node.id)
      && node.object?.object_type === 'network'
      && node.object.ref_id === networkRefId
      && edges.some((edge) => edge.system_contract === 'core:entry_portal' && edge.source_node_id === sourceNodeId && edge.target_node_id === node.id)
    ));
    if (targetNodeForNetwork) return false;

    if (targetNodeId) {
      const existingContainmentEdges = edges.filter(
        (edge) => edge.system_contract === 'core:contains' && edge.target_node_id === targetNodeId,
      );
      for (const edge of existingContainmentEdges) {
        await networkService.edge.delete(edge.id);
      }

      await syncHierarchyParentEdge(targetNodeId, null);
      await networkService.edge.create({
        network_id: currentNetwork.id,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        system_contract: 'core:entry_portal',
      });
      await openNetwork(currentNetwork.id);
      return true;
    }

    const networkObject = await objectService.getByRef('network', networkRefId);
    if (!networkObject) return false;

    const sourceRawPosition = rawPosMap.get(sourceNodeId) ?? { x: 0, y: 0 };
    const targetNode = await addNode({
      network_id: currentNetwork.id,
      object_id: networkObject.id,
      node_type: 'portal',
    });

    await setNodePosition(
      targetNode.id,
      JSON.stringify({
        ...sourceRawPosition,
        x: typeof sourceRawPosition.x === 'number' ? sourceRawPosition.x : 0,
        y: typeof sourceRawPosition.y === 'number' ? sourceRawPosition.y : 0,
      }),
    );

    await networkService.edge.create({
      network_id: currentNetwork.id,
      source_node_id: sourceNodeId,
      target_node_id: targetNode.id,
      system_contract: 'core:entry_portal',
    });
    await openNetwork(currentNetwork.id);
    return true;
  }, [addNode, currentNetwork, edges, entryPortalData.entryPortalTargetNodeIds, nodes, openNetwork, rawPosMap, setNodePosition, syncHierarchyParentEdge]);

  const closeObjectPicker = useCallback(() => {
    setObjectPickerOpen(false);
    setObjectInsertPosition(null);
    setPortalAttachSourceNodeId(null);
  }, []);

  const openNodeObject = useCallback((node: NetworkNodeWithObject) => {
    if (node.object?.object_type === 'network') {
      navigateToChild(node.object.ref_id);
      return;
    }

    if (node.object?.object_type === 'project') {
      const project = projects.find((item) => item.id === node.object?.ref_id);
      if (project) {
        void openProject(project);
      }
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
  }, [archetypeNames, contextNames, navigateToChild, openProject, projects, relationTypeNames, t]);

  const showNodeContextMenu = useCallback((node: NetworkNodeWithObject, x: number, y: number) => {
    const isConcept = node.object?.object_type === 'concept';
    const isFile = node.object?.object_type === 'file';
    const isNetwork = node.object?.object_type === 'network';
    setContextMenu({
      x,
      y,
      nodeId: node.id,
      objectType: node.object?.object_type,
      objectTargetId: node.object?.ref_id,
      objectTitle: node.concept?.title
        ?? node.file?.path?.replace(/\\/g, '/').split('/').pop()
        ?? networkNames.get(node.object?.ref_id ?? '')
        ?? projectNames.get(node.object?.ref_id ?? '')
        ?? undefined,
      conceptId: isConcept ? node.object?.ref_id : undefined,
      fileId: isFile ? node.object?.ref_id : undefined,
      filePath: node.file?.path ?? undefined,
      networkId: isNetwork ? node.object?.ref_id : undefined,
    });
  }, [networkNames, projectNames]);

  const openEdgeEditor = useCallback((edgeId: string) => {
    const edge = edges.find((candidate) => candidate.id === edgeId);
    if (!edge) return;
    const srcNode = nodes.find((n) => n.id === edge.source_node_id);
    const tgtNode = nodes.find((n) => n.id === edge.target_node_id);
    const srcLabel = srcNode?.concept?.title ?? srcNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
    const tgtLabel = tgtNode?.concept?.title ?? tgtNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ?? '?';
    useEditorStore.getState().openTab({
      type: 'edge',
      targetId: edgeId,
      title: `${srcLabel} -> ${tgtLabel}`,
    });
  }, [edges, nodes]);

  const syncNodeSelection = useCallback((node?: NetworkNodeWithObject) => {
    if (!node?.object?.ref_id) {
      useNetworkObjectSelectionStore.getState().clearSelection();
      return;
    }
    const objectType = node.object.object_type;
    if (!['network', 'project', 'concept', 'archetype', 'relation_type', 'context'].includes(objectType)) {
      useNetworkObjectSelectionStore.getState().clearSelection();
      return;
    }
    const title =
      node.concept?.title ??
      node.file?.path?.replace(/\\/g, '/').split('/').pop() ??
      networkNames.get(node.object.ref_id) ??
      projectNames.get(node.object.ref_id) ??
      archetypeNames.get(node.object.ref_id) ??
      relationTypeNames.get(node.object.ref_id) ??
      contextNames.get(node.object.ref_id);
    useNetworkObjectSelectionStore.getState().setSelection({
      objectType: objectType as 'network' | 'project' | 'concept' | 'archetype' | 'relation_type' | 'context',
      id: node.object.ref_id,
      title,
    });
  }, [archetypeNames, contextNames, networkNames, projectNames, relationTypeNames]);

  const syncSelectionFromNodeIds = useCallback((nodeIds: string[]) => {
    const selectedObjects = nodeIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is NetworkNodeWithObject =>
        !!node?.object?.ref_id && ['network', 'project', 'concept', 'archetype', 'relation_type', 'context'].includes(node.object.object_type))
      .map((node) => ({
        objectType: node.object!.object_type as 'network' | 'project' | 'concept' | 'archetype' | 'relation_type' | 'context',
        id: node.object!.ref_id,
        title:
          node.concept?.title ??
          node.file?.path?.replace(/\\/g, '/').split('/').pop() ??
          networkNames.get(node.object!.ref_id) ??
          projectNames.get(node.object!.ref_id) ??
          archetypeNames.get(node.object!.ref_id) ??
          relationTypeNames.get(node.object!.ref_id) ??
          contextNames.get(node.object!.ref_id),
      }))
      .filter((item, index, list) => list.findIndex((candidate) => `${candidate.objectType}:${candidate.id}` === `${item.objectType}:${item.id}`) === index);

    useNetworkObjectSelectionStore.getState().setSelectionState({
      selection: selectedObjects[0] ?? null,
      selectedItems: selectedObjects,
    });
  }, [archetypeNames, contextNames, networkNames, nodes, projectNames, relationTypeNames]);

  // --- Mouse interaction (via useInteraction, same pattern as Culturium) ---

  const isTimeline = viewportMode === 'timeline';
  const toLayoutCoordinates = useCallback((screenX: number, screenY: number) => {
    if (viewportMode === 'screen') {
      return { x: screenX, y: screenY };
    }
    if (viewportMode === 'timeline') {
      return { x: (screenX - panX) / zoom, y: screenY - panY };
    }
    return { x: (screenX - panX) / zoom, y: (screenY - panY) / zoom };
  }, [panX, panY, viewportMode, zoom]);

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

  const materializeRecurringOccurrence = useCallback(async (
    renderNodeId: string,
    options?: {
      position?: { x: number; y: number; slotIndex?: number | null };
      propertyUpdates?: Array<{ conceptId: string; fieldId: string; value: string }>;
    },
  ): Promise<NetworkNodeWithObject | null> => {
    const renderNode = positionedNodeById.get(renderNodeId);
    if (!renderNode) return resolveSourceWorkspaceNode(renderNodeId) ?? null;
    if (renderNode.metadata.__virtualOccurrence !== true) {
      return resolveSourceWorkspaceNode(renderNodeId) ?? null;
    }

    const sourceNode = resolveSourceWorkspaceNode(renderNodeId);
    const sourceConcept = sourceNode?.concept;
    if (!currentNetwork || !sourceNode || !sourceConcept || sourceNode.object?.object_type !== 'concept') {
      return sourceNode ?? null;
    }

    const occurrenceKey = getOccurrenceKey(renderNode);
    if (!occurrenceKey) return sourceNode;

    const existingConcept = concepts.find((concept) => (
      concept.recurrence_source_concept_id === sourceConcept.id
      && concept.recurrence_occurrence_key === occurrenceKey
    ));

    let materializedConcept = existingConcept;
    if (!materializedConcept) {
      materializedConcept = await createConcept({
        project_id: sourceConcept.project_id,
        title: sourceConcept.title,
        archetype_id: sourceConcept.archetype_id ?? undefined,
        recurrence_source_concept_id: sourceConcept.id,
        recurrence_occurrence_key: occurrenceKey,
        icon: sourceConcept.icon ?? undefined,
        color: sourceConcept.color ?? undefined,
        content: sourceConcept.content ?? undefined,
      });
    }

    const slotFieldIds = (renderNode.metadata.__slotFieldIds as Record<string, string> | undefined) ?? {};
    const basePropertyUpdates: Array<{ fieldId: string; value: string }> = [];
    const pushBaseUpdate = (fieldId: string | undefined, value: string | boolean | null | undefined) => {
      if (!fieldId || value == null) return;
      basePropertyUpdates.push({
        fieldId,
        value: typeof value === 'boolean' ? String(value) : value,
      });
    };

    const startEpochDay = typeof renderNode.metadata.start_at === 'number'
      ? Number(renderNode.metadata.start_at)
      : null;
    const endEpochDay = typeof renderNode.metadata.end_at === 'number'
      ? Number(renderNode.metadata.end_at)
      : null;
    const startHasTime = renderNode.metadata.start_at_has_time === true;
    const endHasTime = renderNode.metadata.end_at_has_time === true;
    const startMinutes = typeof renderNode.metadata.start_at_minutes === 'number'
      ? Number(renderNode.metadata.start_at_minutes)
      : undefined;
    const endMinutes = typeof renderNode.metadata.end_at_minutes === 'number'
      ? Number(renderNode.metadata.end_at_minutes)
      : undefined;

    if (startEpochDay != null) {
      pushBaseUpdate(
        slotFieldIds.start_at,
        formatTemporalSlotValueForWriteback(
          renderNode,
          'start_at',
          startEpochDay,
          startHasTime ? startMinutes : undefined,
          !startHasTime,
        ),
      );
    }
    if (endEpochDay != null) {
      pushBaseUpdate(
        slotFieldIds.end_at,
        formatTemporalSlotValueForWriteback(
          renderNode,
          'end_at',
          endEpochDay,
          endHasTime ? endMinutes : undefined,
          !endHasTime,
        ),
      );
    }
    if (typeof renderNode.metadata.all_day === 'boolean') {
      pushBaseUpdate(slotFieldIds.all_day, renderNode.metadata.all_day);
    }

    const sourceProperties = nodeProperties[sourceConcept.id]
      ?? conceptStoreProperties[sourceConcept.id]
      ?? await conceptPropertyService.getByConcept(sourceConcept.id);
    const recurrenceFieldIds = new Set(
      [slotFieldIds.recurrence_rule, slotFieldIds.recurrence_until, slotFieldIds.recurrence_count]
        .filter((value): value is string => !!value),
    );
    const nextPropertyValues = new Map<string, string | null>();

    for (const property of sourceProperties) {
      if (recurrenceFieldIds.has(property.field_id)) continue;
      nextPropertyValues.set(property.field_id, property.value);
    }

    for (const update of basePropertyUpdates) {
      nextPropertyValues.set(update.fieldId, update.value);
    }
    for (const update of options?.propertyUpdates ?? []) {
      nextPropertyValues.set(update.fieldId, update.value);
    }

    await Promise.all(
      Array.from(nextPropertyValues.entries()).map(([fieldId, value]) => (
        useConceptStore.getState().upsertProperty({
          concept_id: materializedConcept.id,
          field_id: fieldId,
          value,
        })
      )),
    );

    const conceptObject = await objectService.getByRef('concept', materializedConcept.id);
    if (!conceptObject) return null;

    let materializedNode = nodes.find((node) => (
      node.object?.object_type === 'concept'
      && node.object.ref_id === materializedConcept.id
    ));

    if (!materializedNode) {
      const createdNode = await networkService.node.add({
        network_id: currentNetwork.id,
        object_id: conceptObject.id,
      });

      const parentGroupId = containsParentByChild.get(sourceNode.id) ?? null;
      if (parentGroupId) {
        await networkService.edge.create({
          network_id: currentNetwork.id,
          source_node_id: parentGroupId,
          target_node_id: createdNode.id,
          system_contract: 'core:contains',
        });
      }

      const sourceHierarchyParentId = hierarchyParentByChild.get(sourceNode.id) ?? null;
      const parentGroupNode = parentGroupId ? nodeById.get(parentGroupId) : undefined;
      if (sourceHierarchyParentId) {
        await networkService.edge.create({
          network_id: currentNetwork.id,
          source_node_id: sourceHierarchyParentId,
          target_node_id: createdNode.id,
          system_contract: HIERARCHY_PARENT_CONTRACT,
        });
      } else if (parentGroupNode?.node_type === 'hierarchy' && parentGroupId) {
        await networkService.edge.create({
          network_id: currentNetwork.id,
          source_node_id: parentGroupId,
          target_node_id: createdNode.id,
          system_contract: HIERARCHY_PARENT_CONTRACT,
        });
      }

      materializedNode = {
        ...createdNode,
        object: conceptObject,
        concept: materializedConcept,
      };
    }

    if (currentLayout && materializedNode) {
      const sourceRawPosition = rawPosMap.get(sourceNode.id);
      const defaultSlotIndex = typeof sourceRawPosition?.slotIndex === 'number'
        ? sourceRawPosition.slotIndex
        : null;
      const nextPosition = options?.position
        ? serializePositionJson(
          materializedNode.id,
          options.position.x,
          options.position.y,
          options.position.slotIndex ?? defaultSlotIndex,
        )
        : serializePositionJson(
          materializedNode.id,
          sourceRawPosition?.x ?? renderNode.x,
          sourceRawPosition?.y ?? renderNode.y,
          defaultSlotIndex,
          typeof sourceRawPosition?.width === 'number' ? sourceRawPosition.width : undefined,
          typeof sourceRawPosition?.height === 'number' ? sourceRawPosition.height : undefined,
          sourceRawPosition?.collapsed === true ? true : null,
        );
      await layoutService.node.setPosition(currentLayout.id, materializedNode.id, nextPosition);
    }

    await openNetwork(currentNetwork.id);

    return useNetworkStore.getState().nodes.find((node) => (
      node.object?.object_type === 'concept'
      && node.object.ref_id === materializedConcept.id
    )) ?? materializedNode;
  }, [
    conceptStoreProperties,
    concepts,
    containsParentByChild,
    createConcept,
    currentLayout,
    currentNetwork,
    hierarchyParentByChild,
    nodeById,
    nodeProperties,
    nodes,
    openNetwork,
    positionedNodeById,
    rawPosMap,
    resolveSourceWorkspaceNode,
    serializePositionJson,
  ]);

  const resolveRenderableWorkspaceNode = useCallback(async (renderNodeId: string) => {
    const renderNode = positionedNodeById.get(renderNodeId);
    if (renderNode?.metadata.__virtualOccurrence === true) {
      return materializeRecurringOccurrence(renderNodeId);
    }
    return resolveSourceWorkspaceNode(renderNodeId) ?? null;
  }, [materializeRecurringOccurrence, positionedNodeById, resolveSourceWorkspaceNode]);

  const findDropTargetContainer = useCallback((
    nodeId: string,
    x: number,
    y: number,
    draggedNode?: Pick<RenderNode, 'width' | 'height'>,
  ): RenderNode | null => {
    const draggedBounds = draggedNode ? getNodeBoundsAtPosition(draggedNode, x, y) : null;
    const candidates = cardRenderNodes
      .filter((node) => node.isContainer && node.id !== nodeId)
      .filter((node) => !node.isCollapsed)
      .filter((node) => !wouldCreateContainmentCycle(nodeId, node.id, containsParentByChild))
      .filter((node) => {
        if (!draggedBounds) return isPointInsideNodeBounds(node, x, y);

        const containerBounds = getNodeBoundsAtPosition(node, node.x, node.y);
        return getBoundsOverlapRatio(draggedBounds, containerBounds) >= 0.5;
      })
      .sort((left, right) => {
        const leftArea = (left.width ?? 160) * (left.height ?? 60);
        const rightArea = (right.width ?? 160) * (right.height ?? 60);
        return leftArea - rightArea;
      });

    return candidates[0] ?? null;
  }, [cardRenderNodes, containsParentByChild]);

  const findHierarchyParentDropTarget = useCallback((
    nodeId: string,
    hierarchyContainerId: string,
    x: number,
    y: number,
  ): RenderNode | null => {
    const candidates = cardRenderNodes
      .filter((node) => node.id !== nodeId)
      .filter((node) => !node.isContainer)
      .filter((node) => getHierarchyContainerIdForNode(node.id, containsParentByChild, allHierarchyContainerIds) === hierarchyContainerId)
      .filter((node) => !isDescendantOf(node.id, nodeId, hierarchyParentByChild))
      .filter((node) => isPointInsideExpandedNodeBounds(node, x, y, 16))
      .sort((left, right) => {
        const leftArea = (left.width ?? 160) * (left.height ?? 60);
        const rightArea = (right.width ?? 160) * (right.height ?? 60);
        return leftArea - rightArea;
      });

    return candidates[0] ?? null;
  }, [allHierarchyContainerIds, cardRenderNodes, containsParentByChild, hierarchyParentByChild]);

  const getHierarchyMagneticXCandidates = useCallback((
    hierarchyContainerId: string,
    parentNodeId: string | null | undefined,
    excludeNodeIds: Set<string>,
    renderNodeSource: RenderNode[],
  ): number[] => {
    const structuralParentId = parentNodeId ?? hierarchyContainerId;
    const candidates: number[] = [];

    const parentNode = renderNodeSource.find((node) => node.id === structuralParentId);
    if (parentNode) {
      candidates.push(parentNode.x);
    }

    for (const node of renderNodeSource) {
      if (excludeNodeIds.has(node.id)) continue;
      if (getHierarchyContainerIdForNode(node.id, containsParentByChild, allHierarchyContainerIds) !== hierarchyContainerId) {
        continue;
      }

      const nodeParentId = hierarchyParentByChild.get(node.id) ?? hierarchyContainerId;
      if (nodeParentId !== structuralParentId) continue;
      candidates.push(node.x);
    }

    return candidates;
  }, [allHierarchyContainerIds, containsParentByChild, hierarchyParentByChild]);

  const getHierarchyMagneticYCandidates = useCallback((
    hierarchyContainerId: string,
    parentNodeId: string | null | undefined,
    excludeNodeIds: Set<string>,
    renderNodeSource: RenderNode[],
  ): number[] => {
    const structuralParentId = parentNodeId ?? hierarchyContainerId;
    const candidates: number[] = [];

    for (const node of renderNodeSource) {
      if (excludeNodeIds.has(node.id)) continue;
      if (getHierarchyContainerIdForNode(node.id, containsParentByChild, allHierarchyContainerIds) !== hierarchyContainerId) {
        continue;
      }

      const nodeParentId = hierarchyParentByChild.get(node.id) ?? hierarchyContainerId;
      if (nodeParentId !== structuralParentId) continue;
      candidates.push(node.y);
    }

    return candidates;
  }, [allHierarchyContainerIds, containsParentByChild, hierarchyParentByChild]);

  const resolveHierarchyDropParentId = useCallback((
    nodeId: string,
    hierarchyContainer: RenderNode,
    x: number,
    y: number,
  ): string | null => {
    const explicitParentNode = findHierarchyParentDropTarget(nodeId, hierarchyContainer.id, x, y);
    if (explicitParentNode) return explicitParentNode.id;

    const currentHierarchyContainerId = getHierarchyContainerIdForNode(nodeId, containsParentByChild, allHierarchyContainerIds);
    const currentHierarchyParentId = hierarchyParentByChild.get(nodeId) ?? null;
    if (
      hierarchyContainer.id === currentHierarchyContainerId &&
      currentHierarchyParentId &&
      currentHierarchyParentId !== hierarchyContainer.id
    ) {
      return currentHierarchyParentId;
    }

    return null;
  }, [allHierarchyContainerIds, containsParentByChild, findHierarchyParentDropTarget, hierarchyParentByChild]);

  const getLocalPlacementForContainer = useCallback((
    nodeId: string,
    container: RenderNode,
    worldX: number,
    worldY: number,
    hierarchyParentNodeId?: string | null,
  ): { x: number; y: number; slotIndex?: number | null } => {
    if (!container.isHierarchy) {
      return {
        x: worldX - container.x,
        y: worldY - container.y,
        slotIndex: null,
      };
    }

    const snappedWorldX = getHierarchyMagneticWorldX(
      getHierarchyMagneticXCandidates(
        container.id,
        hierarchyParentNodeId ?? null,
        new Set([nodeId]),
        previewCardRenderNodes,
      ),
      worldX,
    );
    const minimumWorldY = getHierarchyMinimumWorldY(container, hierarchyParentNodeId ?? null, previewCardRenderNodes);
    const snappedWorldY = getHierarchyMagneticWorldY(
      getHierarchyMagneticYCandidates(
        container.id,
        hierarchyParentNodeId ?? null,
        new Set([nodeId]),
        previewCardRenderNodes,
      ),
      minimumWorldY,
      worldY,
    );

    return {
      x: snappedWorldX - container.x,
      y: snappedWorldY - container.y,
      slotIndex: null,
    };
  }, [getHierarchyMagneticXCandidates, getHierarchyMagneticYCandidates, previewCardRenderNodes]);

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

    const hierarchyParentTarget = targetContainer.isHierarchy
      ? findHierarchyParentDropTarget(nodeId, targetContainer.id, position.x, position.y)
      : null;
    const localPlacement = getLocalPlacementForContainer(
      nodeId,
      targetContainer,
      position.x,
      position.y,
      hierarchyParentTarget?.id ?? null,
    );

    await networkService.edge.create({
      network_id: currentNetwork.id,
      source_node_id: targetContainer.id,
      target_node_id: nodeId,
      system_contract: 'core:contains',
    });
    if (targetContainer.isHierarchy) {
      const existingHierarchyParents = edges.filter(
        (edge) => isHierarchyParentContract(edge.system_contract) && edge.target_node_id === nodeId,
      );
      for (const edge of existingHierarchyParents) {
        await networkService.edge.delete(edge.id);
      }

      await networkService.edge.create({
        network_id: currentNetwork.id,
        source_node_id: hierarchyParentTarget?.id ?? targetContainer.id,
        target_node_id: nodeId,
        system_contract: HIERARCHY_PARENT_CONTRACT,
      });
    } else {
      await syncHierarchyParentEdge(nodeId, targetContainer.id);
    }
    await layoutService.node.setPosition(
      currentLayout.id,
      nodeId,
      serializePositionJson(nodeId, localPlacement.x, localPlacement.y, localPlacement.slotIndex ?? null),
    );
    await openNetwork(currentNetwork.id);
  }, [
    currentLayout,
    currentNetwork,
    edges,
    findHierarchyParentDropTarget,
    findDropTargetContainer,
    getLocalPlacementForContainer,
    layoutPlugin.key,
    openNetwork,
    serializePositionJson,
    setNodePosition,
    syncHierarchyParentEdge,
  ]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (layoutPlugin.onWheel) {
      layoutPlugin.onWheel({
        event: e,
        viewport: containerSize,
        nodes: positionedNodes,
        zoom,
        panX,
        panY,
        config: layoutConfig,
        setZoom,
        setPanX,
        setPanY,
        updateConfig: updatePluginConfig,
      });
      return;
    }

    if (wheelBehavior === 'timeline') {
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

    if (wheelBehavior === 'calendar') {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) > 0) {
        setPanX((px) => px - e.deltaX);
      }
      if (e.shiftKey && e.deltaY !== 0) {
        setPanX((px) => px - e.deltaY);
      } else if (e.deltaY !== 0) {
        setPanY((py) => py - e.deltaY);
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
  }, [containerSize, positionedNodes, zoom, panX, panY, layoutConfig, layoutPlugin, navigateBack, updatePluginConfig, wheelBehavior]);

  const handleNodeResizeStart = useCallback((
    nodeId: string,
    direction: NodeResizeDirection,
    startClientX: number,
    startClientY: number,
  ) => {
    if (workspaceMode !== 'edit' || layoutPlugin.key !== 'freeform') return;

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
  }, [workspaceMode, layoutPlugin.key, previewCardRenderNodes]);

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
    const node = positionedNodes.find((candidate) => candidate.id === nodeId);
    if (node && layoutPlugin.onNodeDrop) {
      const result = layoutPlugin.onNodeDrop({
        nodeId,
        newX: x,
        newY: y,
        zoom,
        viewport: { width: containerSize.width, height: containerSize.height },
        viewportState: { zoom, panX, panY },
        config: layoutConfig,
        nodes: positionedNodes,
        node,
      });

      if (node.metadata.__virtualOccurrence === true) {
        await materializeRecurringOccurrence(nodeId, {
          position: { x: result.position.x, y: result.position.y },
          propertyUpdates: result.propertyUpdates,
        });
        return;
      }

      await Promise.all([
        setNodePosition(nodeId, JSON.stringify({ x: result.position.x, y: result.position.y })),
        persistLayoutPropertyUpdates(result.propertyUpdates),
      ]);
      return;
    }
    await setNodePosition(nodeId, JSON.stringify({ x, y }));
  }, [
    containerSize.height,
    containerSize.width,
    layoutConfig,
    layoutPlugin,
    materializeRecurringOccurrence,
    panX,
    panY,
    persistLayoutPropertyUpdates,
    positionedNodes,
    setNodePosition,
    zoom,
  ]);

  const handleNodeDragEndWithContainment = useCallback(async (nodeId: string, x: number, y: number) => {
    const projectedNode = positionedNodes.find((candidate) => candidate.id === nodeId);
    if (projectedNode && layoutPlugin.onNodeDrop) {
      const result = layoutPlugin.onNodeDrop({
        nodeId,
        newX: x,
        newY: y,
        zoom,
        viewport: { width: containerSize.width, height: containerSize.height },
        viewportState: { zoom, panX, panY },
        config: layoutConfig,
        nodes: positionedNodes,
        node: projectedNode,
      });

      if (projectedNode.metadata.__virtualOccurrence === true) {
        await materializeRecurringOccurrence(nodeId, {
          position: { x: result.position.x, y: result.position.y, slotIndex: null },
          propertyUpdates: result.propertyUpdates,
        });
        return;
      }

      await Promise.all([
        setNodePosition(nodeId, serializePositionJson(nodeId, result.position.x, result.position.y, null)),
        persistLayoutPropertyUpdates(result.propertyUpdates),
      ]);
      return;
    }

    if (layoutPlugin.key !== 'freeform' || !currentNetwork || !currentLayout) {
      await setNodePosition(nodeId, serializePositionJson(nodeId, x, y, null));
      return;
    }

    const draggedNode = nodeById.get(nodeId);
    const draggedNetworkRefId = draggedNode?.object?.object_type === 'network'
      ? draggedNode.object.ref_id
      : null;
    const entryPortalHost = draggedNetworkRefId ? findEntryPortalHostAtPosition(x, y) : null;
    if (draggedNetworkRefId && entryPortalHost && entryPortalHost.id !== nodeId) {
      const attached = await createEntryPortalAttachment(entryPortalHost.id, draggedNetworkRefId, nodeId);
      if (attached) return;
    }

    const currentParentGroupId = containsParentByChild.get(nodeId) ?? null;
    const currentHierarchyContainerId = getHierarchyContainerIdForNode(nodeId, containsParentByChild, allHierarchyContainerIds);
    const currentHierarchyParentId = hierarchyParentByChild.get(nodeId) ?? null;
    const movedSubtreeIds = new Set(collectSubtreeIds([nodeId]));
    const draggedRenderNode = previewCardRenderNodes.find((candidate) => candidate.id === nodeId);
    const nextParentGroup = findDropTargetContainer(nodeId, x, y, draggedRenderNode);
    const nextParentGroupId = nextParentGroup?.id ?? null;
    const nextHierarchyContainerId = nextParentGroup?.isHierarchy
      ? nextParentGroup.id
      : nextParentGroupId
        ? getHierarchyContainerIdForNode(nextParentGroupId, containsParentByChild, allHierarchyContainerIds)
        : null;
    const effectiveHierarchyParentId = nextParentGroup?.isHierarchy
      ? resolveHierarchyDropParentId(nodeId, nextParentGroup, x, y)
      : null;
    const nextHierarchyParentId = nextParentGroup?.isHierarchy
      ? (effectiveHierarchyParentId ?? nextParentGroup.id)
      : null;
    const nextLocalPlacement = nextParentGroup
      ? getLocalPlacementForContainer(nodeId, nextParentGroup, x, y, effectiveHierarchyParentId)
      : null;
    const nextPositionJson = nextLocalPlacement
      ? serializePositionJson(nodeId, nextLocalPlacement.x, nextLocalPlacement.y, nextLocalPlacement.slotIndex ?? null)
      : serializePositionJson(nodeId, x, y, null);
    const currentWorldPosition = worldPosMap.get(nodeId) ?? rawPosMap.get(nodeId) ?? { x: 0, y: 0 };
    const nextWorldPosition = { x, y };
    const subtreeDeltaX = nextWorldPosition.x - currentWorldPosition.x;
    const subtreeDeltaY = nextWorldPosition.y - currentWorldPosition.y;
    const nextWorldPositions: Record<string, { x: number; y: number }> = {
      [nodeId]: nextWorldPosition,
    };
    for (const descendantId of movedSubtreeIds) {
      if (descendantId === nodeId) continue;
      const descendantWorld = worldPosMap.get(descendantId) ?? rawPosMap.get(descendantId) ?? { x: 0, y: 0 };
      nextWorldPositions[descendantId] = {
        x: descendantWorld.x + subtreeDeltaX,
        y: descendantWorld.y + subtreeDeltaY,
      };
    }
    const persistMovedStructuralDescendants = async (detachExternalContainment: boolean) => {
      const descendantIds = Array.from(movedSubtreeIds).filter((candidateId) => candidateId !== nodeId);
      for (const descendantId of descendantIds) {
        const containmentParentId = containsParentByChild.get(descendantId) ?? null;
        if (containmentParentId && movedSubtreeIds.has(containmentParentId)) {
          continue;
        }

        if (detachExternalContainment && containmentParentId && !movedSubtreeIds.has(containmentParentId)) {
          const existingDescendantContainsEdges = edges.filter(
            (edge) =>
              edge.system_contract === 'core:contains'
              && edge.target_node_id === descendantId
              && !movedSubtreeIds.has(edge.source_node_id),
          );
          for (const edge of existingDescendantContainsEdges) {
            await networkService.edge.delete(edge.id);
          }
        }

        const nextContainerId = detachExternalContainment ? null : containmentParentId;
        const descendantWorld = worldPosMap.get(descendantId) ?? rawPosMap.get(descendantId) ?? { x: 0, y: 0 };
        const nextWorldX = descendantWorld.x + subtreeDeltaX;
        const nextWorldY = descendantWorld.y + subtreeDeltaY;

        if (!nextContainerId) {
          await layoutService.node.setPosition(
            currentLayout.id,
            descendantId,
            serializePositionJson(descendantId, nextWorldX, nextWorldY, null),
          );
          continue;
        }

        const containerWorld = worldPosMap.get(nextContainerId) ?? rawPosMap.get(nextContainerId) ?? { x: 0, y: 0 };
        await layoutService.node.setPosition(
          currentLayout.id,
          descendantId,
          serializePositionJson(descendantId, nextWorldX - containerWorld.x, nextWorldY - containerWorld.y, null),
        );
      }
    };

    if (currentParentGroupId === nextParentGroupId && currentHierarchyParentId === nextHierarchyParentId) {
      setPendingWorldPositionOverrides(nextWorldPositions);
      try {
        await setNodePosition(nodeId, nextPositionJson);
        await persistMovedStructuralDescendants(false);
      } finally {
        setPendingWorldPositionOverrides(null);
      }
      return;
    }

    setPendingWorldPositionOverrides(nextWorldPositions);
    try {
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

      const existingHierarchyParents = edges.filter(
        (edge) => isHierarchyParentContract(edge.system_contract) && edge.target_node_id === nodeId,
      );
      for (const edge of existingHierarchyParents) {
        await networkService.edge.delete(edge.id);
      }

      if (nextParentGroup?.isHierarchy) {
        await networkService.edge.create({
          network_id: currentNetwork.id,
          source_node_id: effectiveHierarchyParentId ?? nextParentGroup.id,
          target_node_id: nodeId,
          system_contract: HIERARCHY_PARENT_CONTRACT,
        });
      } else if (currentHierarchyContainerId && !nextHierarchyContainerId) {
        const movedHierarchyEdges = edges.filter(
          (edge) =>
            isHierarchyParentContract(edge.system_contract)
            && movedSubtreeIds.has(edge.target_node_id),
        );
        for (const edge of movedHierarchyEdges) {
          await networkService.edge.delete(edge.id);
        }
      }

      await layoutService.node.setPosition(currentLayout.id, nodeId, nextPositionJson);
      await persistMovedStructuralDescendants(currentHierarchyContainerId != null && !nextHierarchyContainerId);
      await openNetwork(currentNetwork.id);
    } finally {
      setPendingWorldPositionOverrides(null);
    }
  }, [
    allHierarchyContainerIds,
    collectSubtreeIds,
    containsParentByChild,
    createEntryPortalAttachment,
    currentLayout,
    currentNetwork,
    edges,
    findDropTargetContainer,
    findEntryPortalHostAtPosition,
    getLocalPlacementForContainer,
    hierarchyParentByChild,
    layoutConfig,
    layoutPlugin,
    nodeById,
    openNetwork,
    positionedNodes,
    previewCardRenderNodes,
    rawPosMap,
    resolveHierarchyDropParentId,
    serializePositionJson,
    setNodePosition,
    setPendingWorldPositionOverrides,
    materializeRecurringOccurrence,
    worldPosMap,
    zoom,
  ]);

  const handleSpanResizeEnd = useCallback(async (nodeId: string, edge: 'start' | 'end', dx: number) => {
    if (!layoutPlugin.onSpanResize) return;
    const node = positionedNodes.find((candidate) => candidate.id === nodeId);
    if (!node) return;

    const result = layoutPlugin.onSpanResize({
      nodeId,
      edge,
      dx,
      zoom,
      config: layoutConfig,
      node,
    });

    if (node.metadata.__virtualOccurrence === true) {
      await materializeRecurringOccurrence(nodeId, {
        propertyUpdates: result.propertyUpdates,
      });
      return;
    }

    await persistLayoutPropertyUpdates(result.propertyUpdates);
  }, [layoutConfig, layoutPlugin, materializeRecurringOccurrence, persistLayoutPropertyUpdates, positionedNodes, zoom]);

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
    if (!currentNetwork || !projectId) return;

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

  const {
    dragState,
    nodeDragOffset,
    spanResizeOffset,
    handleWorkspaceMouseDown,
    handleNodeDragStart,
    handleSpanResizeStart,
  } = useInteraction({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    nodes: previewCardRenderNodes,
    zoom,
    panX,
    panY,
    viewportMode,
    mode: workspaceMode,
    constraints: interactionConstraints,
    onPanChange: handlePanChange,
    onNodeDragEnd: handleNodeDragEndWithContainment,
    onSpanResizeEnd: handleSpanResizeEnd,
    onSelectionBox: handleSelectionBox,
    onWorkspaceClick: handleNetworkClick,
    onWheel: handleWheel,
  });

  const magneticNodeDragOffset = useMemo(() => {
    if (dragState.type !== 'node' || !nodeDragOffset) return nodeDragOffset;

    const draggedNode = previewCardRenderNodes.find((node) => node.id === dragState.nodeId);
    if (!draggedNode) return nodeDragOffset;

    const currentWorldX = draggedNode.x + nodeDragOffset.dx / zoom;
    const currentWorldY = draggedNode.y + nodeDragOffset.dy / zoom;
    const targetContainer = findDropTargetContainer(draggedNode.id, currentWorldX, currentWorldY, draggedNode);
    if (!targetContainer?.isHierarchy) return nodeDragOffset;

    const effectiveParentNodeId = resolveHierarchyDropParentId(draggedNode.id, targetContainer, currentWorldX, currentWorldY);
    const subtreeIds = new Set(collectSubtreeIds([draggedNode.id]));
    const snappedWorldX = getHierarchyMagneticWorldX(
      getHierarchyMagneticXCandidates(
        targetContainer.id,
        effectiveParentNodeId,
        subtreeIds,
        previewCardRenderNodes,
      ),
      currentWorldX,
    );
    const snappedWorldY = getHierarchyMagneticWorldY(
      getHierarchyMagneticYCandidates(
        targetContainer.id,
        effectiveParentNodeId,
        subtreeIds,
        previewCardRenderNodes,
      ),
      getHierarchyMinimumWorldY(targetContainer, effectiveParentNodeId, previewCardRenderNodes),
      currentWorldY,
    );

    return {
      id: nodeDragOffset.id,
      dx: (snappedWorldX - draggedNode.x) * zoom,
      dy: (snappedWorldY - draggedNode.y) * zoom,
    };
  }, [
    collectSubtreeIds,
    dragState,
    findDropTargetContainer,
    getHierarchyMagneticXCandidates,
    getHierarchyMagneticYCandidates,
    nodeDragOffset,
    previewCardRenderNodes,
    resolveHierarchyDropParentId,
    zoom,
  ]);

  const hierarchyDropHint = useMemo(() => {
    if (dragState.type !== 'node' || !nodeDragOffset) return null;

    const draggedNode = previewCardRenderNodes.find((node) => node.id === dragState.nodeId);
    if (!draggedNode) return null;

    const currentWorldX = draggedNode.x + nodeDragOffset.dx / zoom;
    const currentWorldY = draggedNode.y + nodeDragOffset.dy / zoom;
    const targetContainer = findDropTargetContainer(draggedNode.id, currentWorldX, currentWorldY, draggedNode);
    if (!targetContainer?.isHierarchy) return null;

    const explicitParentNode = findHierarchyParentDropTarget(draggedNode.id, targetContainer.id, currentWorldX, currentWorldY);
    if (explicitParentNode) {
      return {
        containerId: targetContainer.id,
        parentNodeId: explicitParentNode.id,
        mode: 'parent' as const,
      };
    }

    const currentHierarchyContainerId = getHierarchyContainerIdForNode(draggedNode.id, containsParentByChild, allHierarchyContainerIds);
    const currentHierarchyParentId = hierarchyParentByChild.get(draggedNode.id) ?? null;
    if (
      targetContainer.id === currentHierarchyContainerId &&
      currentHierarchyParentId &&
      currentHierarchyParentId !== targetContainer.id
    ) {
      return {
        containerId: targetContainer.id,
        parentNodeId: currentHierarchyParentId,
        mode: 'preserve' as const,
      };
    }

    return {
      containerId: targetContainer.id,
      parentNodeId: null,
      mode: 'root' as const,
    };
  }, [allHierarchyContainerIds, containsParentByChild, dragState, findDropTargetContainer, findHierarchyParentDropTarget, hierarchyParentByChild, nodeDragOffset, previewCardRenderNodes, zoom]);

  const dragFollowerIds = useMemo(() => {
    if (dragState.type !== 'node') return undefined;
    const subtreeIds = collectSubtreeIds([dragState.nodeId]).filter((nodeId) => nodeId !== dragState.nodeId);
    return new Set(subtreeIds);
  }, [collectSubtreeIds, dragState]);

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (edgeLinkingState) {
      renderNodes
        .filter((node) => node.id !== edgeLinkingState.sourceNodeId)
        .forEach((node) => ids.add(node.id));
    }
    if (hierarchyDropHint) {
      ids.add(hierarchyDropHint.parentNodeId ?? hierarchyDropHint.containerId);
    }
    return ids.size > 0 ? ids : undefined;
  }, [edgeLinkingState, hierarchyDropHint, hydratedRenderNodes]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentNetwork) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: worldX, y: worldY } = toLayoutCoordinates(mx, my);
    setNetworkContextMenu({ x: e.clientX, y: e.clientY, worldX, worldY });
  }, [currentNetwork, toLayoutCoordinates]);

  // Save viewport on change (debounced)
  useEffect(() => {
    if (!currentLayout) return;
    if (!persistViewport) return;
    const timer = setTimeout(() => {
      saveViewport(JSON.stringify({ x: panX, y: panY, zoom }));
    }, 500);
    return () => clearTimeout(timer);
  }, [panX, panY, zoom, currentLayout, persistViewport, saveViewport]);

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
    useUIStore.getState().setWorkspaceMode(workspaceMode === 'browse' ? 'edit' : 'browse');
  }, [workspaceMode]);

  const controlExtraItems = useMemo(() => {
    const controlContext = {
      zoom,
      panX,
      panY,
      config: layoutConfig,
      setZoom,
      setPanX,
      setPanY,
      updateConfig: updatePluginConfig,
    };
    const pluginItems = layoutPlugin.controlItems?.map((item) => ({
      ...item,
      label: item.label.includes('.') ? t(item.label as never) : item.label,
      active: item.isActive?.(controlContext) ?? false,
      onClick: () => {
        void item.onClick(controlContext);
      },
    })) ?? [];

    return isDev ? [
      ...pluginItems,
      {
        key: 'edge-debug-overlay',
        icon: <Bug size={14} className={showEdgeDebugOverlay ? 'text-accent' : undefined} />,
        label: showEdgeDebugOverlay ? t('network.hideEdgeDebugOverlay') : t('network.showEdgeDebugOverlay'),
        onClick: () => setShowEdgeDebugOverlay((value) => !value),
      },
    ] : pluginItems;
  }, [isDev, layoutConfig, layoutPlugin.controlItems, panX, panY, setPanX, setPanY, setZoom, showEdgeDebugOverlay, t, updatePluginConfig, zoom]);

  const controlsRendererProps = useMemo(() => ({
    mode: workspaceMode,
    zoom,
    panX,
    panY,
    canGoBack: networkHistory.length > 0,
    canGoForward: false,
    config: layoutConfig,
    hiddenControls: layoutPlugin.hiddenControls,
    extraItems: controlExtraItems,
    setZoom,
    setPanX,
    setPanY,
    updateConfig: updatePluginConfig,
    onToggleMode: toggleMode,
    onZoomIn: () => setZoom((z) => Math.min(5, z * 1.2)),
    onZoomOut: () => setZoom((z) => Math.max(0.005, z / 1.2)),
    onFitToScreen: fitToScreen,
    onNavigateBack: () => navigateBack(),
    onNavigateForward: () => {},
  }), [workspaceMode, zoom, panX, panY, networkHistory.length, layoutConfig, layoutPlugin.hiddenControls, controlExtraItems, setZoom, setPanX, setPanY, updatePluginConfig, toggleMode, fitToScreen, navigateBack]);

  useNetworkShortcuts({
    selectedIds,
    renderNodes,
    edgeLinkingActive: !!edgeLinkingState,
    workspaceMode,
    onClearSelection: () => {
      setSelectedIds(new Set());
      useNetworkObjectSelectionStore.getState().clearSelection();
    },
    onDeleteSelection: () => {
      requestDeleteNodes(Array.from(selectedIds));
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
        handleWorkspaceMouseDown(e);
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
        if (!raw || !currentNetwork || !projectId) return;
        e.preventDefault();
        const dropItems = parseFileDropItems(raw);
        if (dropItems.length === 0) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const { x: worldX, y: worldY } = toLayoutCoordinates(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        for (const [index, item] of dropItems.entries()) {
          await addFileNodeAtPosition(item.path, item.type, {
            x: worldX + index * 32,
            y: worldY + index * 32,
          });
        }
      }}
    >
      {layoutPlugin.ControlsComponent ? (
        <layoutPlugin.ControlsComponent {...controlsRendererProps} />
      ) : (
        <NetworkControls
          {...controlsRendererProps}
          presentation={controlsPresentation}
        />
      )}

      <layoutPlugin.BackgroundComponent
        width={containerSize.width}
        height={containerSize.height}
        zoom={zoom}
        panX={panX}
        panY={panY}
        nodes={positionedNodes}
        edges={renderEdges}
        config={layoutConfig}
        nodeDragOffset={magneticNodeDragOffset}
      />

      <EdgeLayer
        edges={renderEdges}
        nodes={previewRenderNodes}
        zoom={zoom}
        panX={panX}
        panY={panY}
        viewportMode={viewportMode}
        zIndex={0}
        renderHitArea={false}
        renderVisibleStroke
        nodeDragOffset={magneticNodeDragOffset}
        dragFollowerIds={dragFollowerIds}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'edge' && targetId && workspaceMode === 'edit') {
            setEdgeContextMenu({ x, y, edgeId: targetId });
          }
        }}
        onDoubleClick={openEdgeEditor}
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
          nodeDragOffset={magneticNodeDragOffset}
          spanResizeOffset={spanResizeOffset}
          onSpanResizeStart={handleSpanResizeStart}
          onNodeClick={(id, event) => {
            setSelectedIds(new Set([id]));
            const sourceNode = resolveSourceWorkspaceNode(id);
            syncNodeSelection(sourceNode);
          }}
          onNodeDoubleClick={(id) => {
            void (async () => {
              const node = await resolveRenderableWorkspaceNode(id);
              if (node) openNodeObject(node);
            })();
          }}
          onContextMenu={(type, x, y, targetId) => {
            if (type === 'node' && targetId) {
              void (async () => {
                const node = await resolveRenderableWorkspaceNode(targetId);
                if (node) showNodeContextMenu(node, x, y);
              })();
            }
          }}
        />
      )}

      {(edgeLinkingState || hierarchyDropHint) && (
        <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-default bg-surface-modal px-4 py-1.5 text-xs text-default shadow-lg">
          <span>
            {edgeLinkingState
              ? (
                getHierarchyContainerIdForNode(edgeLinkingState.sourceNodeId, containsParentByChild, allHierarchyContainerIds)
                  ? t('network.hierarchyLinkChildToParent')
                  : (t('network.selectTarget') ?? 'Click a node to connect')
              )
              : hierarchyDropHint?.mode === 'parent'
                ? t('network.hierarchyDropToParent')
                : hierarchyDropHint?.mode === 'preserve'
                  ? t('network.hierarchyDropKeepParent')
                  : t('network.hierarchyDropRootChild')}
          </span>
          {edgeLinkingState && (
            <button
              type="button"
              className="underline opacity-80 hover:opacity-100"
              onClick={() => setEdgeLinkingState(null)}
            >
              {t('common.cancel') ?? 'Cancel'}
            </button>
          )}
        </div>
      )}

      <NodeLayer
        nodes={previewCardRenderNodes}
        selectedIds={selectedIds}
        highlightedIds={highlightedNodeIds}
        mode={workspaceMode}
        zoom={zoom}
        panX={panX}
        panY={panY}
        viewportMode={viewportMode}
        nodeDragOffset={magneticNodeDragOffset}
        dragFollowerIds={dragFollowerIds}
        onNodeResizeStart={handleNodeResizeStart}
        onNodeToggleCollapse={handleNodeToggleCollapse}
        onNodePortalChipClick={(_nodeId, _chipId, networkId) => {
          navigateToChild(networkId);
        }}
        onNodeClick={(id) => {
          if (edgeLinkingState) {
            const sourceNodeId = resolveSourceWorkspaceNode(id)?.id ?? id;
            if (sourceNodeId !== edgeLinkingState.sourceNodeId && currentNetwork) {
              createHierarchyConnection(edgeLinkingState.sourceNodeId, sourceNodeId).then((edge) => {
                if (!edge) return;
                const srcNode = nodes.find((n) => n.id === edge.source_node_id);
                const tgtNode = nodes.find((n) => n.id === edge.target_node_id);
                const srcLabel =
                  srcNode?.concept?.title ??
                  srcNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ??
                  '?';
                const tgtLabel =
                  tgtNode?.concept?.title ??
                  tgtNode?.file?.path?.replace(/\\/g, '/').split('/').pop() ??
                  '?';
                useEditorStore.getState().openTab({
                  type: 'edge',
                  targetId: edge.id,
                  title: `${srcLabel} -> ${tgtLabel}`,
                });
              });
            }
            setEdgeLinkingState(null);
            return;
          }
          const node = resolveSourceWorkspaceNode(id);
          setSelectedIds(new Set([id]));
          syncNodeSelection(node);
        }}
        onNodeDoubleClick={(id) => {
          void (async () => {
            const node = await resolveRenderableWorkspaceNode(id);
            if (node) openNodeObject(node);
          })();
        }}
        onNodeDragStart={handleNodeDragStart}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'node' && targetId) {
            void (async () => {
              const node = await resolveRenderableWorkspaceNode(targetId);
              if (node) showNodeContextMenu(node, x, y);
            })();
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
          mode={workspaceMode}
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
            if (node) {
              await createEntryPortalAttachment(node.id, network.id);
            }
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
              isDirty: true,
            });
          }}
          onAttachNetwork={(nodeId) => {
            setPortalAttachSourceNodeId(nodeId);
            setObjectInsertPosition(null);
            setObjectPickerOpen(true);
          }}
          onDeleteNode={(nodeId) => {
            requestDeleteNodes([nodeId]);
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
          onCreateConcept={projectId ? () => {
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
                allowedArchetypeIds: isTemporalLayout && temporalArchetypeIds.length > 0 ? temporalArchetypeIds : undefined,
              },
            });
          } : undefined}
          onAddObject={() => {
            setPortalAttachSourceNodeId(null);
            setObjectInsertPosition({ x: networkContextMenu.worldX, y: networkContextMenu.worldY });
            setObjectPickerOpen(true);
          }}
          onAddFileNode={projectId ? () => {
            setFileInsertPosition({ x: networkContextMenu.worldX, y: networkContextMenu.worldY });
            setFileNodeModalOpen(true);
            setNetworkContextMenu(null);
          } : undefined}
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
        onClose={closeObjectPicker}
        initialTab={portalAttachSourceNodeId ? 'network' : 'concept'}
        allowedTabs={portalAttachSourceNodeId ? ['network'] : undefined}
        onSelect={async (objectType, refId) => {
          if (!currentNetwork) return;

          if (portalAttachSourceNodeId) {
            if (objectType === 'network') {
              await createEntryPortalAttachment(portalAttachSourceNodeId, refId);
            }
            closeObjectPicker();
            return;
          }

          if (!objectInsertPosition) return;
          const objectRecord = await objectService.getByRef(objectType, refId);
          if (!objectRecord) return;

          const entryPortalHost = objectType === 'network'
            ? findEntryPortalHostAtPosition(objectInsertPosition.x, objectInsertPosition.y)
            : null;
          if (entryPortalHost) {
            await createEntryPortalAttachment(entryPortalHost.id, refId);
            closeObjectPicker();
            return;
          }

          const node = await addNode({
            network_id: currentNetwork.id,
            object_id: objectRecord.id,
            node_type: objectType === 'network' || objectType === 'project' ? 'portal' : 'basic',
          });
          await placeNodeAtPosition(node.id, objectInsertPosition);
          closeObjectPicker();
        }}
      />

      <EdgeLayer
        edges={renderEdges}
        nodes={previewRenderNodes}
        zoom={zoom}
        panX={panX}
        panY={panY}
        viewportMode={viewportMode}
        zIndex={3}
        renderHitArea
        renderVisibleStroke={false}
        nodeDragOffset={magneticNodeDragOffset}
        dragFollowerIds={dragFollowerIds}
        onContextMenu={(type, x, y, targetId) => {
          if (type === 'edge' && targetId && workspaceMode === 'edit') {
            setEdgeContextMenu({ x, y, edgeId: targetId });
          }
        }}
        onDoubleClick={openEdgeEditor}
      />

      {isDev && showEdgeDebugOverlay && (
        <EdgeDebugOverlay
          edges={renderEdges}
          nodes={previewRenderNodes}
          zoom={zoom}
          panX={panX}
          panY={panY}
          nodeDragOffset={magneticNodeDragOffset}
          dragFollowerIds={dragFollowerIds}
        />
      )}

      <ConfirmDialog
        open={!!deleteDialogState}
        onClose={() => {
          if (isDeletingNodes) return;
          setDeleteDialogState(null);
        }}
        onConfirm={() => {
          void confirmDeleteNodes();
        }}
        title={t('network.deleteSubtreeTitle')}
        message={t('network.deleteSubtreeMessage', {
          count: deleteDialogState?.nodeIds.length ?? 0,
        })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        isLoading={isDeletingNodes}
      />

    </div>
  );
}
