import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteSemanticModel,
  deleteRemoteSemanticModel,
  getRemoteSemanticModel,
  listRemoteSemanticModels,
  updateRemoteSemanticModel,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerModelIpc(): void {
  ipcMain.handle('model:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteSemanticModel(data);
      broadcastChange({ type: 'models', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('model:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteSemanticModels(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('model:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteSemanticModel(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('model:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteSemanticModel(id, data);
      broadcastChange({ type: 'models', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('model:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteSemanticModel(id);
      broadcastChange({ type: 'models', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
