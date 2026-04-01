import type {
  CanvasType, CanvasTypeCreate, CanvasTypeUpdate,
  CanvasTypeAllowedRelation, RelationType,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

export async function createCanvasType(data: CanvasTypeCreate): Promise<CanvasType> {
  return unwrapIpc(await window.electron.canvasType.create(data as unknown as Record<string, unknown>));
}

export async function listCanvasTypes(projectId: string): Promise<CanvasType[]> {
  return unwrapIpc(await window.electron.canvasType.list(projectId));
}

export async function getCanvasType(id: string): Promise<CanvasType | undefined> {
  return unwrapIpc(await window.electron.canvasType.get(id));
}

export async function updateCanvasType(id: string, data: CanvasTypeUpdate): Promise<CanvasType> {
  return unwrapIpc(await window.electron.canvasType.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteCanvasType(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.canvasType.delete(id));
}

export async function addAllowedRelation(canvasTypeId: string, relationTypeId: string): Promise<CanvasTypeAllowedRelation> {
  return unwrapIpc(await window.electron.canvasType.addRelation(canvasTypeId, relationTypeId));
}

export async function removeAllowedRelation(canvasTypeId: string, relationTypeId: string): Promise<boolean> {
  return unwrapIpc(await window.electron.canvasType.removeRelation(canvasTypeId, relationTypeId));
}

export async function listAllowedRelations(canvasTypeId: string): Promise<RelationType[]> {
  return unwrapIpc(await window.electron.canvasType.listRelations(canvasTypeId));
}

export const canvasTypeService = {
  create: createCanvasType,
  list: listCanvasTypes,
  get: getCanvasType,
  update: updateCanvasType,
  delete: deleteCanvasType,
  relation: {
    add: addAllowedRelation,
    remove: removeAllowedRelation as (canvasTypeId: string, relationTypeId: string) => Promise<boolean>,
    list: listAllowedRelations,
  },
};
