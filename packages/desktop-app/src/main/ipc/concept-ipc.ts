import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteConcept,
  deleteRemoteConcept,
  listRemoteConceptsByProject,
  searchRemoteConcepts,
  updateRemoteConcept,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerConceptIpc(): void {
  ipcMain.handle('concept:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteConcept(data);
      broadcastChange({ type: 'concepts', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:getByProject', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteConceptsByProject(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteConcept(id, data);
      broadcastChange({ type: 'concepts', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteConcept(id);
      broadcastChange({ type: 'concepts', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:search', async (_e, projectId: string, query: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await searchRemoteConcepts(projectId, query) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
