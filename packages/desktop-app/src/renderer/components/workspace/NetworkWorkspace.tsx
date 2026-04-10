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
import { networkService, fileService, objectService } from '../../services';
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
import type { RenderNode, RenderEdge } from './types';
import { getLayout } from './layout-plugins/registry';
import type { LayoutRenderNode } from './layout-plugins/types';
import { isoToEpochDays } from './layout-plugins/horizontal-timeline/scale-utils';
import { useNetworkShortcuts } from './useNetworkShortcuts';

interface NetworkWorkspaceProps {
  projectId: string | null;
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

function buildPositionMap(positions: NodePosition[]): Map<string, { x: number; y: number; width?: number; height?: number }> {
  const map = new Map<string, { x: number; y: number; width?: number; height?: number }>();
  for (const p of positions) {
    try {
      const parsed = JSON.parse(p.positionJson);
      map.set(p.nodeId, { x: parsed.x ?? 0, y: parsed.y ?? 0, width: parsed.width, height: parsed.height });
    } catch {
      // skip invalid JSON
    }
  }
  return map;
}

function buildVisualMap(visuals: EdgeVisual[]): Map<string, { color?: string; lineStyle?: string; directed?: boolean }> {
  const map = new Map<string, { color?: string; lineStyle?: string; directed?: boolean }>();
  for (const v of visuals) {
    try {
      const parsed = JSON.parse(v.visualJson);
      map.set(v.edgeId, { color: parsed.color, lineStyle: parsed.line_style, directed: parsed.directed });
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
  posMap: Map<string, { x: number; y: number; width?: number; height?: number }>,
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
    const isPortal = n.node_type === 'portal';
    const isBox = n.node_type === 'box';
    if (objectType === 'concept' && n.concept) {
      const arch = n.concept.archetype_id ? archMap.get(n.concept.archetype_id) : undefined;
      return {
        id: n.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        label: n.concept.title,
        icon: n.concept.icon || arch?.icon || '📌',
        shape: isPortal ? 'dashed' : isBox ? 'wide' : arch?.node_shape ?? undefined,
        semanticType: arch?.name || 'concept',
        semanticTypeLabel: isPortal ? 'Concept Portal' : arch?.name || 'Concept',
        width: pos?.width ?? 160,
        height: pos?.height ?? 60,
        conceptId: n.object?.ref_id ?? undefined,
        canvasCount: 0,
        nodeType: 'concept' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isBox,
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
        semanticTypeLabel: isPortal ? 'File Portal' : isFile ? 'File' : 'Directory',
        width: pos?.width ?? (isBox ? 220 : 140),
        height: pos?.height ?? (isBox ? 72 : 50),
        canvasCount: 0,
        nodeType: isFile ? 'file' as const : 'dir' as const,
        objectType,
        objectTargetId: n.object?.ref_id ?? undefined,
        isPortal,
        isBox,
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
        shape: isPortal ? 'dashed' as string | undefined : isBox ? 'wide' as string | undefined : 'rectangle' as string | undefined,
        semanticType: 'network',
        semanticTypeLabel: isPortal ? 'Network Portal' : 'Network',
        width: pos?.width ?? (isPortal ? 180 : isBox ? 220 : 160),
        height: pos?.height ?? (isPortal ? 68 : isBox ? 72 : 60),
        canvasCount: 0,
        nodeType: 'network' as const,
        objectType,
        objectTargetId: refId ?? undefined,
        isPortal,
        isBox,
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
      semanticTypeLabel: genericObject.semanticTypeLabel,
      shape: isPortal ? 'dashed' as string | undefined : isBox ? 'wide' as string | undefined : undefined,
      width: pos?.width ?? (isBox ? 220 : objectType === 'project' ? 180 : 140),
      height: pos?.height ?? (isBox ? 72 : objectType === 'project' ? 64 : 50),
      canvasCount: 0,
      nodeType: 'object' as const,
      objectType,
      objectTargetId: n.object?.ref_id ?? undefined,
      isPortal,
      isBox,
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

function toRenderEdges(edges: EdgeWithRelationType[], visualMap: Map<string, { color?: string; lineStyle?: string; directed?: boolean }>): RenderEdge[] {
  return edges.map((e) => {
    const vis = visualMap.get(e.id);
    return {
      id: e.id,
      sourceId: e.source_node_id,
      targetId: e.target_node_id,
      directed: vis?.directed != null ? vis.directed : (e.relation_type?.directed ?? false),
      label: e.relation_type?.name ?? '',
      color: vis?.color ?? e.relation_type?.color ?? undefined,
      lineStyle: (vis?.lineStyle ?? e.relation_type?.line_style ?? undefined) as 'solid' | 'dashed' | 'dotted' | undefined,
    };
  });
}

export function NetworkWorkspace({ projectId }: NetworkWorkspaceProps): JSX.Element {
  const {
    currentNetwork, currentLayout, nodes, edges, nodePositions, edgeVisuals,
    loadAppWorkspace, loadNetworks, openNetwork,
    addNode, removeNode, setNodePosition,
    addEdge, removeEdge, saveViewport,
    navigateToChild, navigateBack,
  } = useNetworkStore();
  const { createConcept } = useConceptStore();
  const { canvasMode } = useUIStore();
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
  const [fileNodeModalOpen, setFileNodeModalOpen] = useState(false);
  const [objectPickerOpen, setObjectPickerOpen] = useState(false);
  const [objectInsertPosition, setObjectInsertPosition] = useState<{ x: number; y: number } | null>(null);

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
  const posMap = useMemo(() => buildPositionMap(nodePositions), [nodePositions]);
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
      posMap,
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
    posMap,
    networkNames,
    projectNames,
    archetypeNames,
    relationTypeNames,
    contextNames,
    isContextFiltering,
    activeContextObjectIds,
  ]);

  const renderEdges = useMemo(() => {
    const baseEdges = toRenderEdges(edges, visualMap);
    if (!isContextFiltering) return baseEdges;
    return baseEdges.map((edge) => ({
      ...edge,
      dimmed: !activeContextEdgeIds.has(edge.id),
    }));
  }, [edges, visualMap, isContextFiltering, activeContextEdgeIds]);

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
    renderNodes.map((n) => {
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
  [renderNodes, nodes, fieldMappingsConfig, nodeProperties]);


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

  if (layoutPlugin.key !== 'freeform' && cardNodes.length > 0) {
    console.log('[NW] cardNodes:', cardNodes.map(n => ({ id: n.id.slice(0,8), label: n.label, x: n.x, y: n.y, role: (n as any).metadata?.role, tv: (n as any).metadata?.time_value })));
  }

  // --- Mouse interaction (via useInteraction, same pattern as Culturium) ---

  const isTimeline = layoutPlugin.key !== 'freeform';

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

  const handleSelectionBox = useCallback((nodeIds: string[]) => {
    setSelectedIds(new Set(nodeIds));
    syncSelectionFromNodeIds(nodeIds);
  }, [syncSelectionFromNodeIds]);

  const { dragState, nodeDragOffset, handleCanvasMouseDown, handleNodeDragStart } = useInteraction({
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    nodes: cardRenderNodes,
    zoom,
    panX,
    panY,
    mode: canvasMode,
    constraints: layoutPlugin.interactionConstraints,
    onPanChange: handlePanChange,
    onNodeDragEnd: handleNodeDragEnd,
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
        if (!raw || !currentNetwork || !projectId) return;
        e.preventDefault();
        const data = JSON.parse(raw) as { type: 'file' | 'dir'; path: string };
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const worldX = (e.clientX - rect.left - panX) / zoom;
        const worldY = (e.clientY - rect.top - panY) / zoom;
        // Create or find existing FileEntity, then add node with object_id
        let fileEntity = await fileService.getByPath(projectId, data.path);
        if (!fileEntity) {
          fileEntity = await fileService.create({
            project_id: projectId,
            path: data.path,
            type: data.type === 'file' ? 'file' : 'directory',
          });
        }
        const fileObj = await objectService.getByRef('file', fileEntity.id);
        if (!fileObj) return;
        const node = await addNode({
          network_id: currentNetwork.id,
          object_id: fileObj.id,
        });
        await setNodePosition(node.id, JSON.stringify({ x: worldX, y: worldY }));
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
        nodes={renderNodes}
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
                    ?? projectNames.get(node.object?.ref_id ?? '')
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
        nodes={cardRenderNodes}
        selectedIds={selectedIds}
        highlightedIds={edgeLinkingState ? new Set(renderNodes.filter((n) => n.id !== edgeLinkingState.sourceNodeId).map((n) => n.id)) : undefined}
        mode={canvasMode}
        zoom={zoom}
        panX={panX}
        panY={panY}
        timelineMode={isTimeline}
        nodeDragOffset={nodeDragOffset}
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
                  ?? projectNames.get(node.object?.ref_id ?? '')
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
          onCreateConcept={projectId ? () => {
            if (!currentNetwork) return;
            const draftId = `draft-${Date.now()}`;
            const worldX = networkContextMenu.worldX;
            const worldY = networkContextMenu.worldY;
            setNetworkContextMenu(null);
            useEditorStore.getState().openTab({
              type: 'concept',
              targetId: draftId,
              title: t('concept.defaultTitle'),
              draftData: {
                networkId: currentNetwork.id,
                positionX: worldX,
                positionY: worldY,
                allowedArchetypeIds: isTimeline ? Object.keys(fieldMappingsConfig) : undefined,
              },
            });
          } : undefined}
          onAddObject={() => {
            setObjectInsertPosition({ x: networkContextMenu.worldX, y: networkContextMenu.worldY });
            setObjectPickerOpen(true);
          }}
          onAddFileNode={projectId ? () => {
            setFileNodeModalOpen(true);
            setNetworkContextMenu(null);
          } : undefined}
          onClose={() => setNetworkContextMenu(null)}
        />
      )}

      <FileNodeAddModal
        open={fileNodeModalOpen}
        onClose={() => setFileNodeModalOpen(false)}
        onSelect={async (path, type) => {
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
          if (!fileObj) return;
          const node = await addNode({
            network_id: currentNetwork.id,
            object_id: fileObj.id,
          });
          await setNodePosition(node.id, JSON.stringify({ x: networkContextMenu?.worldX ?? 0, y: networkContextMenu?.worldY ?? 0 }));
          setFileNodeModalOpen(false);
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
          await setNodePosition(node.id, JSON.stringify(objectInsertPosition));
          setObjectPickerOpen(false);
          setObjectInsertPosition(null);
        }}
      />

    </div>
  );
}
