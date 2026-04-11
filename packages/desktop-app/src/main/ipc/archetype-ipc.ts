import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteArchetype,
  createRemoteArchetypeField,
  deleteRemoteArchetype,
  deleteRemoteArchetypeField,
  getRemoteArchetype,
  listRemoteArchetypeFields,
  listRemoteArchetypes,
  reorderRemoteArchetypeFields,
  updateRemoteArchetype,
  updateRemoteArchetypeField,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerArchetypeIpc(): void {
  ipcMain.handle('archetype:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteArchetype(data);
      broadcastChange({ type: 'archetypes', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteArchetypes(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteArchetype(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteArchetype(id, data);
      broadcastChange({ type: 'archetypes', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetype:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteArchetype(id);
      broadcastChange({ type: 'archetypes', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteArchetypeField(data);
      broadcastChange({ type: 'archetypes', action: 'updated', id: data.archetype_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:list', async (_e, archetypeId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteArchetypeFields(archetypeId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteArchetypeField(id, data);
      broadcastChange({ type: 'archetypes', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteArchetypeField(id);
      broadcastChange({ type: 'archetypes', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('archetypeField:reorder', async (_e, archetypeId: string, orderedIds: string[]): Promise<IpcResult<unknown>> => {
    try {
      await reorderRemoteArchetypeFields(archetypeId, orderedIds);
      broadcastChange({ type: 'archetypes', action: 'updated', id: archetypeId });
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
