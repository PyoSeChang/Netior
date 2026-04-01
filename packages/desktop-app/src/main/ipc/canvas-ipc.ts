import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createCanvas, listCanvases, updateCanvas, deleteCanvas, getCanvasFull,
  getCanvasesByConceptId, getCanvasAncestors, getCanvasTree,
  addCanvasNode, updateCanvasNode, removeCanvasNode,
  createEdge, getEdge, updateEdge, deleteEdge,
} from '@netior/core';

export function registerCanvasIpc(): void {
  // Canvas CRUD
  ipcMain.handle('canvas:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createCanvas(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:list', async (_e, projectId: string, rootOnly?: boolean): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: listCanvases(projectId, rootOnly) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateCanvas(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteCanvas(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:getFull', async (_e, canvasId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getCanvasFull(canvasId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:getByConcept', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getCanvasesByConceptId(conceptId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:getAncestors', async (_e, canvasId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getCanvasAncestors(canvasId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvas:getTree', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getCanvasTree(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Canvas Node
  ipcMain.handle('canvasNode:add', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: addCanvasNode(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasNode:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: updateCanvasNode(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('canvasNode:remove', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: removeCanvasNode(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // Edge
  ipcMain.handle('edge:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: createEdge(data) };
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
      return { success: true, data: updateEdge(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('edge:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: deleteEdge(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
