import { ipcMain } from 'electron';
import type { IpcResult, TypeGroupKind } from '@netior/shared/types';
import {
  createRemoteTypeGroup,
  deleteRemoteTypeGroup,
  listRemoteTypeGroups,
  updateRemoteTypeGroup,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerTypeGroupIpc(): void {
  ipcMain.handle('typeGroup:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteTypeGroup(data);
      broadcastChange({ type: 'typeGroups', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('typeGroup:list', async (_e, projectId: string, kind: TypeGroupKind): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteTypeGroups(projectId, kind) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('typeGroup:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteTypeGroup(id, data);
      broadcastChange({ type: 'typeGroups', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('typeGroup:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteTypeGroup(id);
      if (result) {
        broadcastChange({ type: 'typeGroups', action: 'deleted', id });
      }
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
