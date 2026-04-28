import { create } from 'zustand';
import type {
  Schema, SchemaCreate, SchemaUpdate,
  SchemaField, SchemaFieldCreate, SchemaFieldUpdate,
  SchemaMeaning, SchemaMeaningCreate, SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate, SchemaMeaningUpdate,
} from '@netior/shared/types';
import { schemaService } from '../services';

interface SchemaStore {
  schemas: Schema[];
  fields: Record<string, SchemaField[]>;
  meanings: Record<string, SchemaMeaning[]>;
  loading: boolean;

  loadByProject: (projectId: string) => Promise<void>;
  createSchema: (data: SchemaCreate) => Promise<Schema>;
  updateSchema: (id: string, data: SchemaUpdate) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;

  loadFields: (schemaId: string) => Promise<void>;
  createField: (data: SchemaFieldCreate) => Promise<SchemaField>;
  updateField: (id: string, schemaId: string, data: SchemaFieldUpdate) => Promise<void>;
  deleteField: (id: string, schemaId: string) => Promise<void>;
  reorderFields: (schemaId: string, orderedIds: string[]) => Promise<void>;

  loadMeanings: (schemaId: string) => Promise<void>;
  ensureMeaning: (data: SchemaMeaningCreate) => Promise<SchemaMeaning>;
  updateMeaning: (id: string, schemaId: string, data: SchemaMeaningUpdate) => Promise<void>;
  deleteMeaning: (id: string, schemaId: string) => Promise<void>;
  updateMeaningSlot: (
    id: string,
    schemaId: string,
    data: SchemaMeaningSlotBindingUpdate,
  ) => Promise<SchemaMeaningSlotBinding>;

  clear: () => void;
}

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemas: [],
  fields: {},
  meanings: {},
  loading: false,

  loadByProject: async (projectId) => {
    set({ loading: true });
    try {
      const schemas = await schemaService.list(projectId);
      set({ schemas });
    } finally {
      set({ loading: false });
    }
  },

  createSchema: async (data) => {
    const schema = await schemaService.create(data);
    set((s) => ({ schemas: [...s.schemas, schema] }));
    return schema;
  },

  updateSchema: async (id, data) => {
    const updated = await schemaService.update(id, data);
    set((s) => ({
      schemas: s.schemas.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteSchema: async (id) => {
    await schemaService.delete(id);
    set((s) => ({
      schemas: s.schemas.filter((a) => a.id !== id),
      fields: Object.fromEntries(Object.entries(s.fields).filter(([k]) => k !== id)),
      meanings: Object.fromEntries(Object.entries(s.meanings).filter(([k]) => k !== id)),
    }));
  },

  loadFields: async (schemaId) => {
    const fields = await schemaService.field.list(schemaId);
    set((s) => ({ fields: { ...s.fields, [schemaId]: fields } }));
  },

  createField: async (data) => {
    const field = await schemaService.field.create(data);
    const meanings = await schemaService.meaning.list(data.schema_id);
    set((s) => ({
      fields: {
        ...s.fields,
        [data.schema_id]: [...(s.fields[data.schema_id] ?? []), field],
      },
      meanings: { ...s.meanings, [data.schema_id]: meanings },
    }));
    return field;
  },

  updateField: async (id, schemaId, data) => {
    const updated = await schemaService.field.update(id, data);
    const meanings = await schemaService.meaning.list(schemaId);
    set((s) => ({
      fields: {
        ...s.fields,
        [schemaId]: (s.fields[schemaId] ?? []).map((f) => (f.id === id ? updated : f)),
      },
      meanings: { ...s.meanings, [schemaId]: meanings },
    }));
  },

  deleteField: async (id, schemaId) => {
    await schemaService.field.delete(id);
    const meanings = await schemaService.meaning.list(schemaId);
    set((s) => ({
      fields: {
        ...s.fields,
        [schemaId]: (s.fields[schemaId] ?? []).filter((f) => f.id !== id),
      },
      meanings: { ...s.meanings, [schemaId]: meanings },
    }));
  },

  reorderFields: async (schemaId, orderedIds) => {
    await schemaService.field.reorder(schemaId, orderedIds);
    set((s) => {
      const current = s.fields[schemaId] ?? [];
      const reordered = orderedIds
        .map((id, i) => {
          const field = current.find((f) => f.id === id);
          return field ? { ...field, sort_order: i } : null;
        })
        .filter(Boolean) as SchemaField[];
      return { fields: { ...s.fields, [schemaId]: reordered } };
    });
  },

  loadMeanings: async (schemaId) => {
    const meanings = await schemaService.meaning.list(schemaId);
    set((s) => ({ meanings: { ...s.meanings, [schemaId]: meanings } }));
  },

  ensureMeaning: async (data) => {
    const meaning = await schemaService.meaning.ensure(data);
    const meanings = await schemaService.meaning.list(data.schema_id);
    set((s) => ({ meanings: { ...s.meanings, [data.schema_id]: meanings } }));
    return meaning;
  },

  updateMeaning: async (id, schemaId, data) => {
    const updated = await schemaService.meaning.update(id, data);
    set((s) => ({
      meanings: {
        ...s.meanings,
        [schemaId]: (s.meanings[schemaId] ?? []).map((meaning) => (
          meaning.id === id ? updated : meaning
        )),
      },
    }));
  },

  deleteMeaning: async (id, schemaId) => {
    await schemaService.meaning.delete(id);
    set((s) => ({
      meanings: {
        ...s.meanings,
        [schemaId]: (s.meanings[schemaId] ?? []).filter((meaning) => meaning.id !== id),
      },
    }));
  },

  updateMeaningSlot: async (id, schemaId, data) => {
    const binding = await schemaService.meaning.updateSlot(id, data);
    await get().loadMeanings(schemaId);
    return binding;
  },

  clear: () => set({ schemas: [], fields: {}, meanings: {} }),
}));
