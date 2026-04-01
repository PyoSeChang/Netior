import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { upsertProperty, getByConceptId, deleteProperty } from '@netior/core';

export function registerConceptPropertyIpc(): void {
  ipcMain.handle('conceptProp:upsert', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: upsertProperty(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('conceptProp:getByConcept', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getByConceptId(conceptId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('conceptProp:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteProperty(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
