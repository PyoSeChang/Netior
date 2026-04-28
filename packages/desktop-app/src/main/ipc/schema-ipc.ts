import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteSchema,
  createRemoteSchemaField,
  deleteRemoteSchema,
  deleteRemoteSchemaField,
  deleteRemoteSchemaMeaning,
  ensureRemoteSchemaMeaning,
  getRemoteSchema,
  listRemoteSchemaFields,
  listRemoteSchemaMeanings,
  listRemoteSchemas,
  reorderRemoteSchemaFields,
  updateRemoteSchema,
  updateRemoteSchemaField,
  updateRemoteSchemaMeaning,
  updateRemoteSchemaMeaningSlotBinding,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerSchemaIpc(): void {
  ipcMain.handle('schema:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteSchema(data);
      broadcastChange({ type: 'schemas', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schema:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteSchemas(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schema:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteSchema(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schema:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteSchema(id, data);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schema:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteSchema(id);
      broadcastChange({ type: 'schemas', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaField:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteSchemaField(data);
      broadcastChange({ type: 'schemas', action: 'updated', id: data.schema_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaField:list', async (_e, schemaId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteSchemaFields(schemaId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaField:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteSchemaField(id, data);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaField:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteSchemaField(id);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaField:reorder', async (_e, schemaId: string, orderedIds: string[]): Promise<IpcResult<unknown>> => {
    try {
      await reorderRemoteSchemaFields(schemaId, orderedIds);
      broadcastChange({ type: 'schemas', action: 'updated', id: schemaId });
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaMeaning:list', async (_e, schemaId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteSchemaMeanings(schemaId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaMeaning:ensure', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await ensureRemoteSchemaMeaning(data);
      broadcastChange({ type: 'schemas', action: 'updated', id: data.schema_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaMeaning:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteSchemaMeaning(id, data);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaMeaning:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteSchemaMeaning(id);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('schemaMeaningSlot:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteSchemaMeaningSlotBinding(id, data);
      broadcastChange({ type: 'schemas', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
