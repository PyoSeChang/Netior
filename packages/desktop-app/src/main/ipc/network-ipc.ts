import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  addRemoteNetworkNode,
  createRemoteEdge,
  createRemoteNetwork,
  deleteRemoteEdge,
  deleteRemoteNetwork,
  getRemoteAppRootNetwork,
  getRemoteEdge,
  getRemoteNetworkAncestors,
  getRemoteNetworkFull,
  getRemoteNetworkTree,
  getRemoteProjectRootNetwork,
  listRemoteNetworks,
  removeRemoteNetworkNode,
  updateRemoteEdge,
  updateRemoteNetwork,
  updateRemoteNetworkNode,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerNetworkIpc(): void {
  ipcMain.handle('network:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteNetwork(data);
      broadcastChange({ type: 'networks', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:list', async (_e, projectId: string, rootOnly?: boolean): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteNetworks(projectId, rootOnly) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteNetwork(id, data);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteNetwork(id);
      broadcastChange({ type: 'networks', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getFull', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteNetworkFull(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getAppRoot', async (): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteAppRootNetwork() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getProjectRoot', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteProjectRootNetwork(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getAncestors', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteNetworkAncestors(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('network:getTree', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteNetworkTree(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('networkNode:add', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await addRemoteNetworkNode(data);
      broadcastChange({ type: 'networks', action: 'updated', id: data.network_id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('networkNode:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteNetworkNode(id, data);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('networkNode:remove', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await removeRemoteNetworkNode(id);
      broadcastChange({ type: 'networks', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await createRemoteEdge(data);
      broadcastChange({ type: 'edges', action: 'created', id: result.id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteEdge(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteEdge(id, data);
      broadcastChange({ type: 'edges', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await deleteRemoteEdge(id);
      broadcastChange({ type: 'edges', action: 'deleted', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
