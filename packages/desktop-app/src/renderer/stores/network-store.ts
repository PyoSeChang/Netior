import { create } from 'zustand';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate,
  Edge, EdgeCreate, ObjectRecord, Concept, FileEntity, RelationType,
  NetworkBreadcrumbItem, NetworkTreeNode, Layout,
} from '@netior/shared/types';
import { networkService, layoutService } from '../services';
import type { NetworkFullData, NodePosition, EdgeVisual } from '../services/network-service';

export interface NetworkNodeWithObject extends NetworkNode {
  object?: ObjectRecord;
  concept?: Concept;
  file?: FileEntity;
}

export type EdgeWithRelationType = Edge & { relation_type?: RelationType };

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

  removeNode: async (id) => {
    await networkService.node.remove(id);
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
    await networkService.edge.delete(id);
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
