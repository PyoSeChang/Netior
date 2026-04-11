import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  addRemoteContextMember,
  createRemoteContext,
  deleteRemoteContext,
  getRemoteContext,
  getRemoteContextMembers,
  listRemoteContexts,
  removeRemoteContextMember,
  updateRemoteContext,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerContextIpc(): void {
  ipcMain.handle('context:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteContext(data);
      broadcastChange({ type: 'contexts', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:list', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteContexts(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteContext(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteContext(id, data);
      broadcastChange({ type: 'contexts', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteContext(id);
      broadcastChange({ type: 'contexts', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:addMember', async (_e, contextId: string, memberType: string, memberId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await addRemoteContextMember(contextId, memberType as 'object' | 'edge', memberId);
      broadcastChange({ type: 'contexts', action: 'updated', id: contextId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:removeMember', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await removeRemoteContextMember(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:getMembers', async (_e, contextId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteContextMembers(contextId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
