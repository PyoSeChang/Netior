import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRelationType, listRelationTypes, getRelationType,
  updateRelationType, deleteRelationType,
} from '@netior/core';

export function registerRelationTypeIpc(): void {
  ipcMain.handle('relationType:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createRelationType(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('relationType:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listRelationTypes(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('relationType:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getRelationType(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('relationType:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateRelationType(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('relationType:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteRelationType(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
