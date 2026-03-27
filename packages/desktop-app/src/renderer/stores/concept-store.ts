import { create } from 'zustand';
import type { Concept, ConceptCreate, ConceptUpdate, ConceptProperty, ConceptPropertyUpsert } from '@moc/shared/types';
import { conceptService, conceptPropertyService, conceptContentService } from '../services';

let syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function debouncedSyncToAgent(conceptId: string) {
  if (syncTimers[conceptId]) clearTimeout(syncTimers[conceptId]);
  syncTimers[conceptId] = setTimeout(async () => {
    try {
      const updated = await conceptContentService.syncToAgent(conceptId);
      useConceptStore.setState((s) => ({
        concepts: s.concepts.map((c) => (c.id === conceptId ? updated : c)),
      }));
    } catch (err) {
      console.error('[ConceptContent] Failed to sync to agent:', err);
    }
    delete syncTimers[conceptId];
  }, 300);
}

interface ConceptStore {
  concepts: Concept[];
  loading: boolean;
  properties: Record<string, ConceptProperty[]>;

  loadByProject: (projectId: string) => Promise<void>;
  createConcept: (data: ConceptCreate) => Promise<Concept>;
  updateConcept: (id: string, data: ConceptUpdate) => Promise<void>;
  deleteConcept: (id: string) => Promise<void>;

  updateContent: (id: string, content: string | null) => Promise<void>;
  updateAgentContent: (id: string, agentContent: string) => Promise<void>;

  loadProperties: (conceptId: string) => Promise<void>;
  upsertProperty: (data: ConceptPropertyUpsert) => Promise<void>;
  deleteProperty: (id: string, conceptId: string) => Promise<void>;

  clear: () => void;
}

export const useConceptStore = create<ConceptStore>((set) => ({
  concepts: [],
  loading: false,
  properties: {},

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const concepts = await conceptService.getByProject(projectId);
      set({ concepts });
    } finally {
      set({ loading: false });
    }
  },

  createConcept: async (data) => {
    const concept = await conceptService.create(data);
    set((s) => ({ concepts: [...s.concepts, concept] }));
    return concept;
  },

  updateConcept: async (id, data) => {
    const updated = await conceptService.update(id, data);
    set((s) => ({
      concepts: s.concepts.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteConcept: async (id) => {
    await conceptService.delete(id);
    set((s) => ({ concepts: s.concepts.filter((c) => c.id !== id) }));
  },

  updateContent: async (id, content) => {
    const updated = await conceptService.update(id, { content });
    set((s) => ({
      concepts: s.concepts.map((c) => (c.id === id ? updated : c)),
    }));
    debouncedSyncToAgent(id);
  },

  updateAgentContent: async (id, agentContent) => {
    try {
      const updated = await conceptContentService.syncFromAgent(id, agentContent);
      set((s) => ({
        concepts: s.concepts.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (err) {
      console.error('[ConceptContent] Failed to sync from agent:', err);
    }
  },

  loadProperties: async (conceptId) => {
    const props = await conceptPropertyService.getByConcept(conceptId);
    set((s) => ({ properties: { ...s.properties, [conceptId]: props } }));
  },

  upsertProperty: async (data) => {
    const prop = await conceptPropertyService.upsert(data);
    set((s) => {
      const existing = s.properties[data.concept_id] ?? [];
      const updated = existing.some((p) => p.field_id === data.field_id)
        ? existing.map((p) => (p.field_id === data.field_id ? prop : p))
        : [...existing, prop];
      return { properties: { ...s.properties, [data.concept_id]: updated } };
    });
    debouncedSyncToAgent(data.concept_id);
  },

  deleteProperty: async (id, conceptId) => {
    await conceptPropertyService.delete(id);
    set((s) => ({
      properties: {
        ...s.properties,
        [conceptId]: (s.properties[conceptId] ?? []).filter((p) => p.id !== id),
      },
    }));
  },

  clear: () => {
    Object.values(syncTimers).forEach(clearTimeout);
    syncTimers = {};
    set({ concepts: [], properties: {} });
  },
}));
