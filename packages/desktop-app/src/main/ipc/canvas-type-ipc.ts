import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createCanvasType, listCanvasTypes, getCanvasType,
  updateCanvasType, deleteCanvasType,
  addAllowedRelation, removeAllowedRelation, removeAllowedRelationByPair, listAllowedRelations,
} from '@netior/core';

export function registerCanvasTypeIpc(): void {
  ipcMain.handle('canvasType:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createCanvasType(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listCanvasTypes(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getCanvasType(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateCanvasType(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteCanvasType(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:addRelation', async (_e, canvasTypeId: string, relationTypeId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: addAllowedRelation(canvasTypeId, relationTypeId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:removeRelation', async (_e, canvasTypeId: string, relationTypeId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: removeAllowedRelationByPair(canvasTypeId, relationTypeId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasType:listRelations', async (_e, canvasTypeId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listAllowedRelations(canvasTypeId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
