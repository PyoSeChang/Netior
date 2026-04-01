import type {
  RelationType, RelationTypeCreate, RelationTypeUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createRelationType(data: RelationTypeCreate): Promise<RelationType> {
  return unwrapIpc(await window.electron.relationType.create(data as unknown as Record<string, unknown>));
}

export async function listRelationTypes(projectId: string): Promise<RelationType[]> {
  return unwrapIpc(await window.electron.relationType.list(projectId));
}

export async function getRelationType(id: string): Promise<RelationType | undefined> {
  return unwrapIpc(await window.electron.relationType.get(id));
}

export async function updateRelationType(id: string, data: RelationTypeUpdate): Promise<RelationType> {
  return unwrapIpc(await window.electron.relationType.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteRelationType(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.relationType.delete(id));
}

export const relationTypeService = {
  create: createRelationType,
  list: listRelationTypes,
  get: getRelationType,
  update: updateRelationType,
  delete: deleteRelationType,
};
