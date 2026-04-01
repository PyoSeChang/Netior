import { create } from 'zustand';
import type {
  Archetype, ArchetypeCreate, ArchetypeUpdate,
  ArchetypeField, ArchetypeFieldCreate, ArchetypeFieldUpdate,
} from '@netior/shared/types';
import { archetypeService } from '../services';

interface ArchetypeStore {
  archetypes: Archetype[];
  fields: Record<string, ArchetypeField[]>;
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createArchetype: (data: ArchetypeCreate) => Promise<Archetype>;
  updateArchetype: (id: string, data: ArchetypeUpdate) => Promise<void>;
  deleteArchetype: (id: string) => Promise<void>;

  loadFields: (archetypeId: string) => Promise<void>;
  createField: (data: ArchetypeFieldCreate) => Promise<ArchetypeField>;
  updateField: (id: string, archetypeId: string, data: ArchetypeFieldUpdate) => Promise<void>;
  deleteField: (id: string, archetypeId: string) => Promise<void>;
  reorderFields: (archetypeId: string, orderedIds: string[]) => Promise<void>;

  clear: () => void;
}

export const useArchetypeStore = create<ArchetypeStore>((set) => ({
  archetypes: [],
  fields: {},
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const archetypes = await archetypeService.list(projectId);
      set({ archetypes });
    } finally {
      set({ loading: false });
    }
  },

  createArchetype: async (data) => {
    const archetype = await archetypeService.create(data);
    set((s) => ({ archetypes: [...s.archetypes, archetype] }));
    return archetype;
  },

  updateArchetype: async (id, data) => {
    const updated = await archetypeService.update(id, data);
    set((s) => ({
      archetypes: s.archetypes.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteArchetype: async (id) => {
    await archetypeService.delete(id);
    set((s) => ({
      archetypes: s.archetypes.filter((a) => a.id !== id),
      fields: Object.fromEntries(Object.entries(s.fields).filter(([k]) => k !== id)),
    }));
  },

  loadFields: async (archetypeId) => {
    const fields = await archetypeService.field.list(archetypeId);
    set((s) => ({ fields: { ...s.fields, [archetypeId]: fields } }));
  },

  createField: async (data) => {
    const field = await archetypeService.field.create(data);
    set((s) => ({
      fields: {
        ...s.fields,
        [data.archetype_id]: [...(s.fields[data.archetype_id] ?? []), field],
      },
    }));
    return field;
  },

  updateField: async (id, archetypeId, data) => {
    const updated = await archetypeService.field.update(id, data);
    set((s) => ({
      fields: {
        ...s.fields,
        [archetypeId]: (s.fields[archetypeId] ?? []).map((f) => (f.id === id ? updated : f)),
      },
    }));
  },

  deleteField: async (id, archetypeId) => {
    await archetypeService.field.delete(id);
    set((s) => ({
      fields: {
        ...s.fields,
        [archetypeId]: (s.fields[archetypeId] ?? []).filter((f) => f.id !== id),
      },
    }));
  },

  reorderFields: async (archetypeId, orderedIds) => {
    await archetypeService.field.reorder(archetypeId, orderedIds);
    set((s) => {
      const current = s.fields[archetypeId] ?? [];
      const reordered = orderedIds
        .map((id, i) => {
          const field = current.find((f) => f.id === id);
          return field ? { ...field, sort_order: i } : null;
        })
        .filter(Boolean) as ArchetypeField[];
      return { fields: { ...s.fields, [archetypeId]: reordered } };
    });
  },

  clear: () => set({ archetypes: [], fields: {} }),
}));
