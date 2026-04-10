import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createNetwork, listNetworks, updateNetwork, deleteNetwork, getNetworkFull,
  getNetworkAncestors, getNetworkTree, getAppRootNetwork, getProjectRootNetwork,
  addNetworkNode, updateNetworkNode, removeNetworkNode,
  createEdge, getEdge, updateEdge, deleteEdge,
} from '@netior/core';
import { broadcastChange } from './broadcast-change';

export function registerNetworkIpc(): void {
  // Network CRUD
  ipcMain.handle('network:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = createNetwork(data);
      broadcastChange({ type: 'networks', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:list', async (_e, projectId: string, rootOnly?: boolean): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listNetworks(projectId, rootOnly) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = updateNetwork(id, data);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = deleteNetwork(id);
      broadcastChange({ type: 'networks', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getFull', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getNetworkFull(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getAppRoot', async (): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getAppRootNetwork() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getProjectRoot', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getProjectRootNetwork(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getAncestors', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getNetworkAncestors(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getTree', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getNetworkTree(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Network Node
  ipcMain.handle('networkNode:add', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = addNetworkNode(data);
      broadcastChange({ type: 'networks', action: 'updated', id: data.network_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('networkNode:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = updateNetworkNode(id, data);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('networkNode:remove', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = removeNetworkNode(id);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Edge
  ipcMain.handle('edge:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = createEdge(data);
      broadcastChange({ type: 'edges', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getEdge(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = updateEdge(id, data);
      broadcastChange({ type: 'edges', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = deleteEdge(id);
      broadcastChange({ type: 'edges', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
