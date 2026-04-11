import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  getRemoteLayoutByNetwork,
  getRemoteLayoutEdgeVisuals,
  getRemoteLayoutNodePositions,
  removeRemoteLayoutEdgeVisual,
  removeRemoteLayoutNodePosition,
  setRemoteLayoutEdgeVisual,
  setRemoteLayoutNodePosition,
  updateRemoteLayout,
} from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerLayoutIpc(): void {
  ipcMain.handle('layout:getByNetwork', async (_e, networkId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteLayoutByNetwork(networkId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layout:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = await updateRemoteLayout(id, data);
      broadcastChange({ type: 'layouts', action: 'updated', id });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutNode:setPosition', async (_e, layoutId: string, nodeId: string, positionJson: string): Promise<IpcResult<unknown>> => {
    try {
      await setRemoteLayoutNodePosition(layoutId, nodeId, positionJson);
      broadcastChange({ type: 'layouts', action: 'updated', id: layoutId });
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutNode:getPositions', async (_e, layoutId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteLayoutNodePositions(layoutId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutNode:remove', async (_e, layoutId: string, nodeId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await removeRemoteLayoutNodePosition(layoutId, nodeId);
      broadcastChange({ type: 'layouts', action: 'updated', id: layoutId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutEdge:setVisual', async (_e, layoutId: string, edgeId: string, visualJson: string): Promise<IpcResult<unknown>> => {
    try {
      await setRemoteLayoutEdgeVisual(layoutId, edgeId, visualJson);
      broadcastChange({ type: 'layouts', action: 'updated', id: layoutId });
      return { success: true, data: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutEdge:getVisuals', async (_e, layoutId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteLayoutEdgeVisuals(layoutId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('layoutEdge:remove', async (_e, layoutId: string, edgeId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await removeRemoteLayoutEdgeVisual(layoutId, edgeId);
      broadcastChange({ type: 'layouts', action: 'updated', id: layoutId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
