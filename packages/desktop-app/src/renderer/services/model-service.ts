import type {
  Model,
  ModelCreate,
  ModelUpdate,
} from '@netior/shared/types';
import { unwrapIpc } from './ipc';

function getModelApi(): NonNullable<typeof window.electron.model> {
  if (!window.electron.model) {
    throw new Error('Model IPC API is unavailable. Restart the Electron dev app so the updated preload script is loaded.');
  }
  return window.electron.model;
}

export async function createModel(data: ModelCreate): Promise<Model> {
  return unwrapIpc(await getModelApi().create(data as unknown as Record<string, unknown>));
}

export async function listModels(projectId: string): Promise<Model[]> {
  return unwrapIpc(await getModelApi().list(projectId));
}

export async function getModel(id: string): Promise<Model | undefined> {
  return unwrapIpc(await getModelApi().get(id));
}

export async function updateModel(id: string, data: ModelUpdate): Promise<Model> {
  return unwrapIpc(await getModelApi().update(id, data as unknown as Record<string, unknown>));
}

export async function deleteModel(id: string): Promise<boolean> {
  return unwrapIpc(await getModelApi().delete(id));
}

export const modelService = {
  create: createModel,
  list: listModels,
  get: getModel,
  update: updateModel,
  delete: deleteModel,
};
