import { create } from 'zustand';
import type {
  Canvas, CanvasCreate, CanvasUpdate,
  CanvasNode, CanvasNodeCreate, CanvasNodeUpdate,
  Edge, EdgeCreate, Concept, RelationType,
  CanvasBreadcrumbItem, CanvasTreeNode,
} from '@netior/shared/types';
import { canvasService } from '../services';
import type { CanvasFullData } from '../services/canvas-service';

export interface CanvasNodeWithConcept extends CanvasNode {
  concept?: Concept;
  canvas_count: number;
}

export type EdgeWithRelationType = Edge & { relation_type?: RelationType };

interface CanvasStore {
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  nodes: CanvasNodeWithConcept[];
  edges: EdgeWithRelationType[];
  loading: boolean;

  // Navigation
  breadcrumbs: CanvasBreadcrumbItem[];
  canvasHistory: string[];
  canvasTree: CanvasTreeNode[];

  // Canvas CRUD
  loadCanvases: (projectId: string, rootOnly?: boolean) => Promise<void>;
  loadCanvasTree: (projectId: string) => Promise<void>;
  createCanvas: (data: CanvasCreate) => Promise<Canvas>;
  openCanvas: (canvasId: string) => Promise<void>;
  updateCanvas: (id: string, data: CanvasUpdate) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;

  // Hierarchical navigation
  drillInto: (conceptId: string) => Promise<void>;
  navigateBack: () => Promise<void>;
  navigateToBreadcrumb: (canvasId: string) => Promise<void>;

  // Node
  addNode: (data: CanvasNodeCreate) => Promise<CanvasNode>;
  updateNode: (id: string, data: CanvasNodeUpdate) => Promise<void>;
  removeNode: (id: string) => Promise<void>;

  // Edge
  addEdge: (data: EdgeCreate) => Promise<Edge>;
  removeEdge: (id: string) => Promise<void>;

  // Viewport
  saveViewport: (viewport: { viewport_x: number; viewport_y: number; viewport_zoom: number }) => Promise<void>;

  clear: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  canvases: [],
  currentCanvas: null,
  nodes: [],
  edges: [],
  loading: false,
  breadcrumbs: [],
  canvasHistory: [],
  canvasTree: [],

  loadCanvases: async (projectId, rootOnly = false) => {
    const canvases = await canvasService.list(projectId, rootOnly);
    set({ canvases });
  },

  loadCanvasTree: async (projectId) => {
    const tree = await canvasService.getTree(projectId);
    set({ canvasTree: tree });
  },

  createCanvas: async (data) => {
    const canvas = await canvasService.create(data);
    // Only add to sidebar list if it's a root canvas
    if (!data.concept_id) {
      set((s) => ({ canvases: [...s.canvases, canvas] }));
    }
    return canvas;
  },

  openCanvas: async (canvasId) => {
    set({ loading: true });
    try {
      const full = await canvasService.getFull(canvasId) as CanvasFullData | undefined;
      if (!full) return;
      const breadcrumbs = await canvasService.getAncestors(canvasId);
      set({
        currentCanvas: full.canvas,
        nodes: full.nodes,
        edges: full.edges,
        breadcrumbs,
      });
    } finally {
      set({ loading: false });
    }
  },

  updateCanvas: async (id, data) => {
    const updated = await canvasService.update(id, data);
    set((s) => ({
      canvases: s.canvases.map((c) => (c.id === id ? updated : c)),
      currentCanvas: s.currentCanvas?.id === id ? updated : s.currentCanvas,
    }));
  },

  deleteCanvas: async (id) => {
    await canvasService.delete(id);
    set((s) => ({
      canvases: s.canvases.filter((c) => c.id !== id),
      currentCanvas: s.currentCanvas?.id === id ? null : s.currentCanvas,
      nodes: s.currentCanvas?.id === id ? [] : s.nodes,
      edges: s.currentCanvas?.id === id ? [] : s.edges,
    }));
  },

  drillInto: async (conceptId) => {
    const canvases = await canvasService.getCanvasesByConcept(conceptId);
    if (canvases.length === 0) return;

    const { currentCanvas } = get();
    if (currentCanvas) {
      set((s) => ({ canvasHistory: [...s.canvasHistory, currentCanvas.id] }));
    }
    await get().openCanvas(canvases[0].id);
  },

  navigateBack: async () => {
    const { canvasHistory } = get();
    if (canvasHistory.length === 0) return;

    const previousId = canvasHistory[canvasHistory.length - 1];
    set((s) => ({ canvasHistory: s.canvasHistory.slice(0, -1) }));
    await get().openCanvas(previousId);
  },

  navigateToBreadcrumb: async (canvasId) => {
    const { breadcrumbs, canvasHistory } = get();
    const targetIdx = breadcrumbs.findIndex((b) => b.canvasId === canvasId);
    if (targetIdx < 0) return;

    // Truncate history: keep only entries up to the point that matches
    // The breadcrumb at targetIdx means we go back (breadcrumbs.length - 1 - targetIdx) levels
    const levelsBack = breadcrumbs.length - 1 - targetIdx;
    const newHistory = canvasHistory.slice(0, canvasHistory.length - levelsBack);
    set({ canvasHistory: newHistory });
    await get().openCanvas(canvasId);
  },

  addNode: async (data) => {
    const node = await canvasService.node.add(data);
    // Need to reload full to get concept data
    const { currentCanvas } = get();
    if (currentCanvas) await get().openCanvas(currentCanvas.id);
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
    await canvasService.node.update(id, data);
  },

  removeNode: async (id) => {
    await canvasService.node.remove(id);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source_node_id !== id && e.target_node_id !== id),
    }));
  },

  addEdge: async (data) => {
    const edge = await canvasService.edge.create(data);
    set((s) => ({ edges: [...s.edges, edge] }));
    return edge;
  },

  removeEdge: async (id) => {
    await canvasService.edge.delete(id);
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) }));
  },

  saveViewport: async (viewport) => {
    const { currentCanvas } = get();
    if (!currentCanvas) return;
    await get().updateCanvas(currentCanvas.id, viewport);
  },

  clear: () => set({
    canvases: [], currentCanvas: null, nodes: [], edges: [],
    breadcrumbs: [], canvasHistory: [], canvasTree: [],
  }),
}));
