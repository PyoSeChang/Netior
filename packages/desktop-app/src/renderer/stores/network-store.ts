import { create } from 'zustand';
import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, Concept, FileEntity, RelationType,
  NetworkBreadcrumbItem, NetworkTreeNode,
} from '@netior/shared/types';
import { networkService } from '../services';
import type { NetworkFullData } from '../services/network-service';

export interface NetworkNodeWithConcept extends NetworkNode {
  concept?: Concept;
  file?: FileEntity;
  network_count: number;
}

export type EdgeWithRelationType = Edge & { relation_type?: RelationType };

interface NetworkStore {
  networks: Network[];
  currentNetwork: Network | null;
  nodes: NetworkNodeWithConcept[];
  edges: EdgeWithRelationType[];
  loading: boolean;

  // Navigation
  breadcrumbs: NetworkBreadcrumbItem[];
  networkHistory: string[];
  networkTree: NetworkTreeNode[];

  // Network CRUD
  loadNetworks: (projectId: string, rootOnly?: boolean) => Promise<void>;
  loadNetworkTree: (projectId: string) => Promise<void>;
  createNetwork: (data: NetworkCreate) => Promise<Network>;
  openNetwork: (networkId: string) => Promise<void>;
  updateNetwork: (id: string, data: NetworkUpdate) => Promise<void>;
  deleteNetwork: (id: string) => Promise<void>;

  // Hierarchical navigation
  drillInto: (conceptId: string) => Promise<void>;
  navigateBack: () => Promise<void>;
  navigateToBreadcrumb: (networkId: string) => Promise<void>;

  // Node
  addNode: (data: NetworkNodeCreate) => Promise<NetworkNode>;
  updateNode: (id: string, data: NetworkNodeUpdate) => Promise<void>;
  removeNode: (id: string) => Promise<void>;

  // Edge
  addEdge: (data: EdgeCreate) => Promise<Edge>;
  removeEdge: (id: string) => Promise<void>;

  // Viewport
  saveViewport: (viewport: { viewport_x: number; viewport_y: number; viewport_zoom: number }) => Promise<void>;

  clear: () => void;
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  networks: [],
  currentNetwork: null,
  nodes: [],
  edges: [],
  loading: false,
  breadcrumbs: [],
  networkHistory: [],
  networkTree: [],

  loadNetworks: async (projectId, rootOnly = false) => {
    const networks = await networkService.list(projectId, rootOnly);
    set({ networks });
  },

  loadNetworkTree: async (projectId) => {
    const tree = await networkService.getTree(projectId);
    set({ networkTree: tree });
  },

  createNetwork: async (data) => {
    const network = await networkService.create(data);
    // Only add to sidebar list if it's a root network
    if (!data.concept_id) {
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
        nodes: full.nodes,
        edges: full.edges,
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
      nodes: s.currentNetwork?.id === id ? [] : s.nodes,
      edges: s.currentNetwork?.id === id ? [] : s.edges,
    }));
  },

  drillInto: async (conceptId) => {
    const networks = await networkService.getNetworksByConcept(conceptId);
    if (networks.length === 0) return;

    const { currentNetwork } = get();
    if (currentNetwork) {
      set((s) => ({ networkHistory: [...s.networkHistory, currentNetwork.id] }));
    }
    await get().openNetwork(networks[0].id);
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

    // Truncate history: keep only entries up to the point that matches
    // The breadcrumb at targetIdx means we go back (breadcrumbs.length - 1 - targetIdx) levels
    const levelsBack = breadcrumbs.length - 1 - targetIdx;
    const newHistory = networkHistory.slice(0, networkHistory.length - levelsBack);
    set({ networkHistory: newHistory });
    await get().openNetwork(networkId);
  },

  addNode: async (data) => {
    const node = await networkService.node.add(data);
    // Need to reload full to get concept data
    const { currentNetwork } = get();
    if (currentNetwork) await get().openNetwork(currentNetwork.id);
    return node;
  },

  updateNode: async (id, data) => {
    // Optimistic update first — ensures position change is in the same
    // React batch as nodeDragOffset clear, preventing ghost frames.
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              position_x: data.position_x ?? n.position_x,
              position_y: data.position_y ?? n.position_y,
              width: data.width !== undefined ? data.width : n.width,
              height: data.height !== undefined ? data.height : n.height,
            }
          : n,
      ),
    }));
    await networkService.node.update(id, data);
  },

  removeNode: async (id) => {
    await networkService.node.remove(id);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
    }));
  },

  addEdge: async (data) => {
    const edge = await networkService.edge.create(data);
    set((s) => ({ edges: [...s.edges, edge] }));
    return edge;
  },

  removeEdge: async (id) => {
    await networkService.edge.delete(id);
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
  },

  saveViewport: async (viewport) => {
    const { currentNetwork } = get();
    if (!currentNetwork) return;
    await get().updateNetwork(currentNetwork.id, viewport);
  },

  clear: () => set({
    networks: [], currentNetwork: null, nodes: [], edges: [],
    breadcrumbs: [], networkHistory: [], networkTree: [],
  }),
}));
