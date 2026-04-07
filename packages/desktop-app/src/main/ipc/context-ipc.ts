import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createContext, listContexts, getContext, updateContext, deleteContext,
  addContextMember, removeContextMember, getContextMembers,
} from '@netior/core';
import { broadcastChange } from './broadcast-change';

export function registerContextIpc(): void {
  ipcMain.handle('context:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = createContext(data);
      broadcastChange({ type: 'contexts', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:list', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listContexts(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getContext(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = updateContext(id, data);
      broadcastChange({ type: 'contexts', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = deleteContext(id);
      broadcastChange({ type: 'contexts', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:addMember', async (_e, contextId: string, memberType: string, memberId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = addContextMember(contextId, memberType as 'object' | 'edge', memberId);
      broadcastChange({ type: 'contexts', action: 'updated', id: contextId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:removeMember', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = removeContextMember(id);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('context:getMembers', async (_e, contextId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getContextMembers(contextId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
