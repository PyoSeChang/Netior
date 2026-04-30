import { create } from 'zustand';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, ObjectRecord, Concept, FileEntity,
  NetworkBreadcrumbItem, NetworkTreeNode, Layout,
} from '@netior/shared/types';
import { networkService, layoutService } from '../services';
import type { NetworkFullData, NodePosition, EdgeVisual } from '../services/network-service';
import {
  CONTAINS_MODEL_KEY,
  HIERARCHY_PARENT_MODEL_KEY,
  isContainsEdge,
  isHierarchyParentEdge,
  systemEdgeModelId,
} from '../lib/edge-models';
import type { EdgeWithModel } from '../lib/edge-models';

export interface NetworkNodeWithObject extends NetworkNode {
  object?: ObjectRecord;
  concept?: Concept;
  file?: FileEntity;
}

export type EdgeWithRelationType = EdgeWithModel;

interface ParsedNodePosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
  slotIndex?: number;
  collapsed?: boolean;
  [key: string]: unknown;
}

function buildPositionMap(positions: NodePosition[]): Map<string, ParsedNodePosition> {
  const map = new Map<string, ParsedNodePosition>();
  for (const position of positions) {
    try {
      const parsed = JSON.parse(position.positionJson) as Record<string, unknown>;
      map.set(position.nodeId, {
        ...parsed,
        x: typeof parsed.x === 'number' ? parsed.x : 0,
        y: typeof parsed.y === 'number' ? parsed.y : 0,
        width: typeof parsed.width === 'number' ? parsed.width : undefined,
        height: typeof parsed.height === 'number' ? parsed.height : undefined,
        slotIndex: typeof parsed.slotIndex === 'number' ? parsed.slotIndex : undefined,
        collapsed: parsed.collapsed === true,
      });
    } catch {
      // ignore invalid persisted position payload
    }
  }
  return map;
}

function buildContainsParentMap(edges: EdgeWithRelationType[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const edge of edges) {
    if (!isContainsEdge(edge)) continue;
    if (edge.source_node_id === edge.target_node_id) continue;
    map.set(edge.target_node_id, edge.source_node_id);
  }
  return map;
}

function getHierarchyContainerIds(nodes: NetworkNodeWithObject[]): Set<string> {
  return new Set(
    nodes
      .filter((node) => (node.node_type as string) === 'hierarchy')
      .map((node) => node.id),
  );
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

function buildHierarchyParentMap(
  nodes: NetworkNodeWithObject[],
  edges: EdgeWithRelationType[],
  containsParentByChild: Map<string, string>,
): Map<string, string> {
  const hierarchyContainerIds = getHierarchyContainerIds(nodes);
  const map = new Map<string, string>();

  for (const edge of edges) {
    if (!isHierarchyParentEdge(edge)) continue;

    const targetHierarchyId = getHierarchyContainerIdForNode(edge.target_node_id, containsParentByChild, hierarchyContainerIds);
    if (!targetHierarchyId) continue;

    const sourceHierarchyId = getHierarchySourceContainerId(edge.source_node_id, containsParentByChild, hierarchyContainerIds);
    if (!sourceHierarchyId || sourceHierarchyId !== targetHierarchyId) continue;
    map.set(edge.target_node_id, edge.source_node_id);
  }

  return map;
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

function serializePositionJson(position: ParsedNodePosition): string {
  return JSON.stringify(position);
}

async function healHierarchyOrphans(networkId: string): Promise<void> {
  const full = await networkService.getFull(networkId);
  if (!full) return;

  const nodes = full.nodes as NetworkNodeWithObject[];
  const edges = full.edges as EdgeWithRelationType[];
  const containsParentByChild = buildContainsParentMap(edges);
  const hierarchyContainerIds = getHierarchyContainerIds(nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    const directContainerId = containsParentByChild.get(node.id);
    if (!directContainerId) continue;
    if (!hierarchyContainerIds.has(directContainerId)) continue;

    const structuralEdges = edges.filter(
      (edge) => isHierarchyParentEdge(edge) && edge.target_node_id === node.id,
    );

    const validExplicitParents = structuralEdges.filter((edge) =>
      edge.source_node_id !== directContainerId
      && edge.source_node_id !== node.id
      && nodeById.has(edge.source_node_id)
      && getHierarchySourceContainerId(edge.source_node_id, containsParentByChild, hierarchyContainerIds) === directContainerId,
    );
    const validFallbackParents = structuralEdges.filter((edge) =>
      edge.source_node_id === directContainerId,
    );

    const preferredEdge = validExplicitParents[0] ?? validFallbackParents[0] ?? null;

    for (const edge of structuralEdges) {
      if (preferredEdge && edge.id === preferredEdge.id) continue;
      await networkService.edge.delete(edge.id);
    }

    if (!preferredEdge) {
      await networkService.edge.create({
        network_id: networkId,
        source_node_id: directContainerId,
        target_node_id: node.id,
        model_id: systemEdgeModelId(full.network.project_id, HIERARCHY_PARENT_MODEL_KEY),
      });
    }
  }
}

function buildRelativePosition(
  existing: ParsedNodePosition | undefined,
  worldPosition: ParsedNodePosition,
  nextContainerId: string | null,
  nodeById: Map<string, NetworkNodeWithObject>,
  worldPosMap: Map<string, ParsedNodePosition>,
): ParsedNodePosition {
  const next: ParsedNodePosition = {
    ...(existing ?? {}),
    x: worldPosition.x,
    y: worldPosition.y,
  };

  delete next.slotIndex;

  if (!nextContainerId) {
    return next;
  }

  const parentWorld = worldPosMap.get(nextContainerId) ?? { x: 0, y: 0 };
  const parentNodeType = nodeById.get(nextContainerId)?.node_type as string | undefined;

  next.x = worldPosition.x - parentWorld.x;
  next.y = worldPosition.y - parentWorld.y;

  return next;
}

interface NetworkStore {
  networks: Network[];
  currentNetwork: Network | null;
  currentLayout: Layout | null;
  nodes: NetworkNodeWithObject[];
  edges: EdgeWithRelationType[];
  nodePositions: NodePosition[];
  edgeVisuals: EdgeVisual[];
  loading: boolean;

  // Navigation
  breadcrumbs: NetworkBreadcrumbItem[];
  networkHistory: string[];
  networkTree: NetworkTreeNode[];

  // Network CRUD
  loadUniverseWorkspace: () => Promise<Network | null>;
  loadNetworks: (projectId: string) => Promise<void>;
  loadNetworkTree: (projectId: string) => Promise<void>;
  createNetwork: (data: NetworkCreate) => Promise<Network>;
  openNetwork: (networkId: string) => Promise<void>;
  updateNetwork: (id: string, data: NetworkUpdate) => Promise<void>;
  deleteNetwork: (id: string) => Promise<void>;

  // Hierarchical navigation
  navigateToChild: (childNetworkId: string) => Promise<void>;
  navigateBack: () => Promise<void>;
  navigateToBreadcrumb: (networkId: string) => Promise<void>;

  // Node
  addNode: (data: NetworkNodeCreate) => Promise<NetworkNode>;
  updateNode: (id: string, data: NetworkNodeUpdate) => Promise<NetworkNode>;
  removeNode: (id: string) => Promise<void>;

  // Node position (layout layer)
  setNodePosition: (nodeId: string, positionJson: string) => Promise<void>;

  // Edge
  addEdge: (data: EdgeCreate) => Promise<Edge>;
  removeEdge: (id: string) => Promise<void>;

  // Edge visual (layout layer)
  setEdgeVisual: (edgeId: string, visualJson: string) => Promise<void>;

  // Viewport (layout layer)
  saveViewport: (viewportJson: string) => Promise<void>;

  clear: () => void;
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  networks: [],
  currentNetwork: null,
  currentLayout: null,
  nodes: [],
  edges: [],
  nodePositions: [],
  edgeVisuals: [],
  loading: false,
  breadcrumbs: [],
  networkHistory: [],
  networkTree: [],

  loadUniverseWorkspace: async () => {
    const universe = await networkService.getUniverse();
    set({
      networks: universe ? [universe] : [],
      networkTree: universe ? [{ network: universe, children: [] }] : [],
    });
    return universe ?? null;
  },

  loadNetworks: async (projectId) => {
    const networks = await networkService.list(projectId);
    set({ networks });
  },

  loadNetworkTree: async (projectId) => {
    const tree = await networkService.getTree(projectId);
    set({ networkTree: tree });
  },

  createNetwork: async (data) => {
    const network = await networkService.create(data);
    if (!data.parent_network_id) {
      set((s) => ({ networks: [...s.networks, network] }));
    }
    return network;
  },

  openNetwork: async (networkId) => {
    set({ loading: true });
    try {
      const full = await networkService.getFull(networkId) as NetworkFullData | undefined;
      if (!full) return;
      const breadcrumbs = await networkService.getAncestors(networkId);
      set({
        currentNetwork: full.network,
        currentLayout: full.layout ?? null,
        nodes: full.nodes,
        edges: full.edges,
        nodePositions: full.nodePositions,
        edgeVisuals: full.edgeVisuals,
        breadcrumbs,
      });
    } finally {
      set({ loading: false });
    }
  },

  updateNetwork: async (id, data) => {
    const updated = await networkService.update(id, data);
    set((s) => ({
      networks: s.networks.map((n) => (n.id === id ? updated : n)),
      currentNetwork: s.currentNetwork?.id === id ? updated : s.currentNetwork,
    }));
  },

  deleteNetwork: async (id) => {
    await networkService.delete(id);
    set((s) => ({
      networks: s.networks.filter((n) => n.id !== id),
      currentNetwork: s.currentNetwork?.id === id ? null : s.currentNetwork,
      currentLayout: s.currentNetwork?.id === id ? null : s.currentLayout,
      nodes: s.currentNetwork?.id === id ? [] : s.nodes,
      edges: s.currentNetwork?.id === id ? [] : s.edges,
      nodePositions: s.currentNetwork?.id === id ? [] : s.nodePositions,
      edgeVisuals: s.currentNetwork?.id === id ? [] : s.edgeVisuals,
    }));
  },

  navigateToChild: async (childNetworkId) => {
    const { currentNetwork } = get();
    if (currentNetwork) {
      set((s) => ({ networkHistory: [...s.networkHistory, currentNetwork.id] }));
    }
    await get().openNetwork(childNetworkId);
  },

  navigateBack: async () => {
    const { networkHistory } = get();
    if (networkHistory.length === 0) return;

    const previousId = networkHistory[networkHistory.length - 1];
    set((s) => ({ networkHistory: s.networkHistory.slice(0, -1) }));
    await get().openNetwork(previousId);
  },

  navigateToBreadcrumb: async (networkId) => {
    const { breadcrumbs, networkHistory } = get();
    const targetIdx = breadcrumbs.findIndex((b) => b.networkId === networkId);
    if (targetIdx < 0) return;

    const levelsBack = breadcrumbs.length - 1 - targetIdx;
    const newHistory = networkHistory.slice(0, networkHistory.length - levelsBack);
    set({ networkHistory: newHistory });
    await get().openNetwork(networkId);
  },

  addNode: async (data) => {
    const node = await networkService.node.add(data);
    const { currentNetwork } = get();
    if (currentNetwork) await get().openNetwork(currentNetwork.id);
    return node;
  },

  updateNode: async (id, data) => {
    const updated = await networkService.node.update(id, data);
    set((s) => ({
      nodes: s.nodes.map((node) => (node.id === id ? { ...node, ...updated } : node)),
    }));
    return updated;
  },

  removeNode: async (id) => {
    const {
      currentNetwork,
      currentLayout,
      nodes,
      edges,
      nodePositions,
      openNetwork,
    } = get();
    const node = nodes.find((candidate) => candidate.id === id);
    const networkId = currentNetwork?.id ?? node?.network_id ?? null;

    if (!node) {
      await networkService.node.remove(id);
      set((s) => ({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
        nodePositions: s.nodePositions.filter((p) => p.nodeId !== id),
      }));
      return;
    }

    const rawPosMap = buildPositionMap(nodePositions);
    const containsParentByChild = buildContainsParentMap(edges);
    const worldPosMap = buildWorldPositionMap(nodes, edges, rawPosMap, containsParentByChild);
    const nodeById = new Map(nodes.map((candidate) => [candidate.id, candidate]));
    const hierarchyContainerIds = getHierarchyContainerIds(nodes);
    const hierarchyParentByChild = buildHierarchyParentMap(nodes, edges, containsParentByChild);
    const containsModelId = systemEdgeModelId(currentNetwork?.project_id, CONTAINS_MODEL_KEY);
    const hierarchyParentModelId = systemEdgeModelId(currentNetwork?.project_id, HIERARCHY_PARENT_MODEL_KEY);

    const outerContainerId = containsParentByChild.get(id) ?? null;
    const directContainedEdges = edges.filter(
      (edge) => isContainsEdge(edge) && edge.source_node_id === id,
    );
    const directTreeChildEdges = edges.filter(
      (edge) => isHierarchyParentEdge(edge) && edge.source_node_id === id,
    );
    const directTreeChildTargetIds = new Set(directTreeChildEdges.map((edge) => edge.target_node_id));
    const deletedNodeHierarchyId = getHierarchyContainerIdForNode(id, containsParentByChild, hierarchyContainerIds);
    const deletedNodeStructuralParent = hierarchyParentByChild.get(id) ?? null;
    const affectedHierarchyNodeIds = new Set(
      nodes
        .filter((candidate) => getHierarchyContainerIdForNode(candidate.id, containsParentByChild, hierarchyContainerIds) === id)
        .map((candidate) => candidate.id),
    );

    await networkService.node.remove(id);

    for (const directChildEdge of directContainedEdges) {
      const childId = directChildEdge.target_node_id;
      const childWorld = worldPosMap.get(childId) ?? rawPosMap.get(childId) ?? { x: 0, y: 0 };
      const nextPosition = buildRelativePosition(
        rawPosMap.get(childId),
        childWorld,
        outerContainerId,
        nodeById,
        worldPosMap,
      );

      if (currentLayout) {
        await layoutService.node.setPosition(currentLayout.id, childId, serializePositionJson(nextPosition));
      }

      if (outerContainerId) {
        await networkService.edge.create({
          network_id: networkId ?? node.network_id,
          source_node_id: outerContainerId,
          target_node_id: childId,
          model_id: containsModelId,
        });

        const targetNodeType = nodeById.get(outerContainerId)?.node_type as string | undefined;
        if (targetNodeType === 'hierarchy') {
          const willReceiveStructuralFallback = directTreeChildTargetIds.has(childId);
          const stillHasHierarchyParent = (node.node_type as string) === 'hierarchy'
            ? false
            : willReceiveStructuralFallback
              ? true
            : edges.some(
              (edge) =>
                isHierarchyParentEdge(edge)
                && edge.target_node_id === childId
                && edge.source_node_id !== id,
            );
          if (!stillHasHierarchyParent) {
            await networkService.edge.create({
              network_id: networkId ?? node.network_id,
              source_node_id: outerContainerId,
              target_node_id: childId,
              model_id: hierarchyParentModelId,
            });
          }
        }
      }
    }

    if ((node.node_type as string) === 'hierarchy') {
      for (const edge of edges) {
        if (!isHierarchyParentEdge(edge)) continue;
        if (!affectedHierarchyNodeIds.has(edge.target_node_id)) continue;
        await networkService.edge.delete(edge.id);
      }
    } else if (deletedNodeHierarchyId) {
      const fallbackHierarchyId = deletedNodeHierarchyId;
      const fallbackParentId =
        deletedNodeStructuralParent && deletedNodeStructuralParent !== fallbackHierarchyId
          ? deletedNodeStructuralParent
          : null;
      const structuralTargets = new Set(directTreeChildEdges.map((edge) => edge.target_node_id));

      for (const childId of structuralTargets) {
        await networkService.edge.create({
          network_id: networkId ?? node.network_id,
          source_node_id: fallbackParentId ?? fallbackHierarchyId,
          target_node_id: childId,
          model_id: hierarchyParentModelId,
        });
      }
    }

    if (networkId) {
      await healHierarchyOrphans(networkId);
      await openNetwork(networkId);
      return;
    }

    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
      nodePositions: s.nodePositions.filter((p) => p.nodeId !== id),
    }));
  },

  setNodePosition: async (nodeId, positionJson) => {
    const { currentLayout } = get();
    if (!currentLayout) return;

    // Optimistic update
    set((s) => ({
      nodePositions: s.nodePositions.some((p) => p.nodeId === nodeId)
        ? s.nodePositions.map((p) => p.nodeId === nodeId ? { ...p, positionJson } : p)
        : [...s.nodePositions, { nodeId, positionJson }],
    }));

    await layoutService.node.setPosition(currentLayout.id, nodeId, positionJson);
  },

  addEdge: async (data) => {
    const edge = await networkService.edge.create(data);
    set((s) => ({ edges: [...s.edges, edge] }));
    return edge;
  },

  removeEdge: async (id) => {
    const { currentNetwork, nodes, edges, openNetwork } = get();
    const edge = edges.find((candidate) => candidate.id === id);

    if (!edge) {
      await networkService.edge.delete(id);
      set((s) => ({
        edges: s.edges.filter((e) => e.id !== id),
        edgeVisuals: s.edgeVisuals.filter((v) => v.edgeId !== id),
      }));
      return;
    }

    await networkService.edge.delete(id);

    if (isHierarchyParentEdge(edge)) {
      const remainingEdges = edges.filter((candidate) => candidate.id !== id);
      const containsParentByChild = buildContainsParentMap(remainingEdges);
      const hierarchyContainerId = getHierarchyContainerIdForNode(
        edge.target_node_id,
        containsParentByChild,
        getHierarchyContainerIds(nodes),
      );
      const stillHasHierarchyParent = remainingEdges.some(
        (candidate) =>
          isHierarchyParentEdge(candidate)
          && candidate.target_node_id === edge.target_node_id,
      );

      if (hierarchyContainerId && !stillHasHierarchyParent) {
        await networkService.edge.create({
          network_id: edge.network_id,
          source_node_id: hierarchyContainerId,
          target_node_id: edge.target_node_id,
          model_id: systemEdgeModelId(currentNetwork?.project_id, HIERARCHY_PARENT_MODEL_KEY),
        });
      }
    }

    const networkId = currentNetwork?.id ?? edge.network_id;
    if (networkId) {
      await healHierarchyOrphans(networkId);
      await openNetwork(networkId);
      return;
    }

    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      edgeVisuals: s.edgeVisuals.filter((v) => v.edgeId !== id),
    }));
  },

  setEdgeVisual: async (edgeId, visualJson) => {
    const { currentLayout } = get();
    if (!currentLayout) return;

    set((s) => ({
      edgeVisuals: s.edgeVisuals.some((v) => v.edgeId === edgeId)
        ? s.edgeVisuals.map((v) => v.edgeId === edgeId ? { ...v, visualJson } : v)
        : [...s.edgeVisuals, { edgeId, visualJson }],
    }));

    await layoutService.edge.setVisual(currentLayout.id, edgeId, visualJson);
  },

  saveViewport: async (viewportJson) => {
    const { currentLayout } = get();
    if (!currentLayout) return;
    await layoutService.update(currentLayout.id, { viewport_json: viewportJson });
  },

  clear: () => set({
    networks: [], currentNetwork: null, currentLayout: null,
    nodes: [], edges: [], nodePositions: [], edgeVisuals: [],
    breadcrumbs: [], networkHistory: [], networkTree: [],
  }),
}));
