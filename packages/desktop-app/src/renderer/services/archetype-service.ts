import type {
  Archetype, ArchetypeCreate, ArchetypeUpdate,
  ArchetypeField, ArchetypeFieldCreate, ArchetypeFieldUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createArchetype(data: ArchetypeCreate): Promise<Archetype> {
  return unwrapIpc(await window.electron.archetype.create(data as unknown as Record<string, unknown>));
}

export async function listArchetypes(projectId: string): Promise<Archetype[]> {
  return unwrapIpc(await window.electron.archetype.list(projectId));
}

export async function getArchetype(id: string): Promise<Archetype | undefined> {
  return unwrapIpc(await window.electron.archetype.get(id));
}

export async function updateArchetype(id: string, data: ArchetypeUpdate): Promise<Archetype> {
  return unwrapIpc(await window.electron.archetype.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteArchetype(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.archetype.delete(id));
}

export async function createField(data: ArchetypeFieldCreate): Promise<ArchetypeField> {
  return unwrapIpc(await window.electron.archetype.createField(data as unknown as Record<string, unknown>));
}

export async function listFields(archetypeId: string): Promise<ArchetypeField[]> {
  return unwrapIpc(await window.electron.archetype.listFields(archetypeId));
}

export async function updateField(id: string, data: ArchetypeFieldUpdate): Promise<ArchetypeField> {
  return unwrapIpc(await window.electron.archetype.updateField(id, data as unknown as Record<string, unknown>));
}

export async function deleteField(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.archetype.deleteField(id));
}

export async function reorderFields(archetypeId: string, orderedIds: string[]): Promise<boolean> {
  return unwrapIpc(await window.electron.archetype.reorderFields(archetypeId, orderedIds));
}

export const archetypeService = {
  create: createArchetype,
  list: listArchetypes,
  get: getArchetype,
  update: updateArchetype,
  delete: deleteArchetype,
  field: {
    create: createField,
    list: listFields,
    update: updateField,
    delete: deleteField,
    reorder: reorderFields,
  },
};
