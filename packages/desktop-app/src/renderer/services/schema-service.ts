import type {
  Schema, SchemaCreate, SchemaUpdate,
  SchemaField, SchemaFieldCreate, SchemaFieldUpdate,
  SchemaMeaning, SchemaMeaningCreate, SchemaMeaningSlotBinding,
  SchemaMeaningSlotBindingUpdate, SchemaMeaningUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createSchema(data: SchemaCreate): Promise<Schema> {
  return unwrapIpc(await window.electron.schema.create(data as unknown as Record<string, unknown>));
}

export async function listSchemas(projectId: string): Promise<Schema[]> {
  return unwrapIpc(await window.electron.schema.list(projectId));
}

export async function getSchema(id: string): Promise<Schema | undefined> {
  return unwrapIpc(await window.electron.schema.get(id));
}

export async function updateSchema(id: string, data: SchemaUpdate): Promise<Schema> {
  return unwrapIpc(await window.electron.schema.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteSchema(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.schema.delete(id));
}

export async function createField(data: SchemaFieldCreate): Promise<SchemaField> {
  return unwrapIpc(await window.electron.schema.createField(data as unknown as Record<string, unknown>));
}

export async function listFields(schemaId: string): Promise<SchemaField[]> {
  return unwrapIpc(await window.electron.schema.listFields(schemaId));
}

export async function updateField(id: string, data: SchemaFieldUpdate): Promise<SchemaField> {
  return unwrapIpc(await window.electron.schema.updateField(id, data as unknown as Record<string, unknown>));
}

export async function deleteField(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.schema.deleteField(id));
}

export async function reorderFields(schemaId: string, orderedIds: string[]): Promise<boolean> {
  return unwrapIpc(await window.electron.schema.reorderFields(schemaId, orderedIds));
}

export async function listMeanings(schemaId: string): Promise<SchemaMeaning[]> {
  return unwrapIpc(await window.electron.schema.listMeanings(schemaId));
}

export async function ensureMeaning(data: SchemaMeaningCreate): Promise<SchemaMeaning> {
  return unwrapIpc(await window.electron.schema.ensureMeaning(data as unknown as Record<string, unknown>));
}

export async function updateMeaning(id: string, data: SchemaMeaningUpdate): Promise<SchemaMeaning> {
  return unwrapIpc(await window.electron.schema.updateMeaning(id, data as unknown as Record<string, unknown>));
}

export async function deleteMeaning(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.schema.deleteMeaning(id));
}

export async function updateMeaningSlot(
  id: string,
  data: SchemaMeaningSlotBindingUpdate,
): Promise<SchemaMeaningSlotBinding> {
  return unwrapIpc(await window.electron.schema.updateMeaningSlot(id, data as unknown as Record<string, unknown>));
}

export const schemaService = {
  create: createSchema,
  list: listSchemas,
  get: getSchema,
  update: updateSchema,
  delete: deleteSchema,
  field: {
    create: createField,
    list: listFields,
    update: updateField,
    delete: deleteField,
    reorder: reorderFields,
  },
  meaning: {
    list: listMeanings,
    ensure: ensureMeaning,
    update: updateMeaning,
    delete: deleteMeaning,
    updateSlot: updateMeaningSlot,
  },
};
