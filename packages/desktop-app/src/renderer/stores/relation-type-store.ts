import { create } from 'zustand';
import type { RelationType, RelationTypeCreate, RelationTypeUpdate } from '@netior/shared/types';
import { relationTypeService } from '../services/relation-type-service';

interface RelationTypeStore {
  relationTypes: RelationType[];
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createRelationType: (data: RelationTypeCreate) => Promise<RelationType>;
  updateRelationType: (id: string, data: RelationTypeUpdate) => Promise<void>;
  deleteRelationType: (id: string) => Promise<void>;
  clear: () => void;
}

export const useRelationTypeStore = create<RelationTypeStore>((set) => ({
  relationTypes: [],
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    const relationTypes = await relationTypeService.list(projectId);
    set({ relationTypes, loading: false });
  },

  createRelationType: async (data) => {
    const created = await relationTypeService.create(data);
    set((s) => ({ relationTypes: [...s.relationTypes, created] }));
    return created;
  },

  updateRelationType: async (id, data) => {
    const updated = await relationTypeService.update(id, data);
    set((s) => ({
      relationTypes: s.relationTypes.map((rt) => (rt.id === id ? updated : rt)),
    }));
  },

  deleteRelationType: async (id) => {
    await relationTypeService.delete(id);
    set((s) => ({
      relationTypes: s.relationTypes.filter((rt) => rt.id !== id),
    }));
  },

  clear: () => set({ relationTypes: [], loading: false }),
}));
