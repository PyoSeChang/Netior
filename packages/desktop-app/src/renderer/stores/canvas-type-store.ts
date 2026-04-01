import { create } from 'zustand';
import type { CanvasType, CanvasTypeCreate, CanvasTypeUpdate, RelationType } from '@netior/shared/types';
import { canvasTypeService } from '../services/canvas-type-service';

interface CanvasTypeStore {
  canvasTypes: CanvasType[];
  allowedRelations: Record<string, RelationType[]>;
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createCanvasType: (data: CanvasTypeCreate) => Promise<CanvasType>;
  updateCanvasType: (id: string, data: CanvasTypeUpdate) => Promise<void>;
  deleteCanvasType: (id: string) => Promise<void>;
  loadAllowedRelations: (canvasTypeId: string) => Promise<void>;
  addAllowedRelation: (canvasTypeId: string, relationTypeId: string) => Promise<void>;
  removeAllowedRelation: (canvasTypeId: string, relationTypeId: string) => Promise<void>;
  clear: () => void;
}

export const useCanvasTypeStore = create<CanvasTypeStore>((set, get) => ({
  canvasTypes: [],
  allowedRelations: {},
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    const canvasTypes = await canvasTypeService.list(projectId);
    set({ canvasTypes, loading: false });
  },

  createCanvasType: async (data) => {
    const created = await canvasTypeService.create(data);
    set((s) => ({ canvasTypes: [...s.canvasTypes, created] }));
    return created;
  },

  updateCanvasType: async (id, data) => {
    const updated = await canvasTypeService.update(id, data);
    set((s) => ({
      canvasTypes: s.canvasTypes.map((ct) => (ct.id === id ? updated : ct)),
    }));
  },

  deleteCanvasType: async (id) => {
    await canvasTypeService.delete(id);
    set((s) => {
      const { [id]: _, ...rest } = s.allowedRelations;
      return {
        canvasTypes: s.canvasTypes.filter((ct) => ct.id !== id),
        allowedRelations: rest,
      };
    });
  },

  loadAllowedRelations: async (canvasTypeId) => {
    const relations = await canvasTypeService.relation.list(canvasTypeId);
    set((s) => ({
      allowedRelations: { ...s.allowedRelations, [canvasTypeId]: relations },
    }));
  },

  addAllowedRelation: async (canvasTypeId, relationTypeId) => {
    await canvasTypeService.relation.add(canvasTypeId, relationTypeId);
    await get().loadAllowedRelations(canvasTypeId);
  },

  removeAllowedRelation: async (canvasTypeId, relationTypeId) => {
    await canvasTypeService.relation.remove(canvasTypeId, relationTypeId);
    await get().loadAllowedRelations(canvasTypeId);
  },

  clear: () => set({ canvasTypes: [], allowedRelations: {}, loading: false }),
}));
