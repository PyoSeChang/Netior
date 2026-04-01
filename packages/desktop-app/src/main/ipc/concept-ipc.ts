import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createConcept, getConceptsByProject, updateConcept, deleteConcept, searchConcepts,
} from '@netior/core';

export function registerConceptIpc(): void {
  ipcMain.handle('concept:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createConcept(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:getByProject', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getConceptsByProject(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateConcept(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteConcept(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:search', async (_e, projectId: string, query: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: searchConcepts(projectId, query) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
