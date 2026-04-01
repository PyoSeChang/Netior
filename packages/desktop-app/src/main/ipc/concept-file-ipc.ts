import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createConceptFile, getConceptFilesByConcept, deleteConceptFile,
} from '@netior/core';

export function registerConceptFileIpc(): void {
  ipcMain.handle('conceptFile:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createConceptFile(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('conceptFile:getByConcept', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getConceptFilesByConcept(conceptId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('conceptFile:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteConceptFile(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
