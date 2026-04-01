import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createArchetype, listArchetypes, getArchetype, updateArchetype, deleteArchetype,
  createField, listFields, updateField, deleteField, reorderFields,
} from '@netior/core';

export function registerArchetypeIpc(): void {
  ipcMain.handle('archetype:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createArchetype(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listArchetypes(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getArchetype(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateArchetype(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteArchetype(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Archetype Fields
  ipcMain.handle('archetypeField:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createField(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:list', async (_e, archetypeId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listFields(archetypeId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateField(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteField(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:reorder', async (_e, archetypeId: string, orderedIds: string[]): Promise<IpcResult<unknown>> => {
    try {
      reorderFields(archetypeId, orderedIds);
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
