import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteFile,
  deleteRemoteFile,
  getRemoteFile,
  getRemoteFileByPath,
  listRemoteFilesByProject,
  updateRemoteFile,
} from '../netior-service/netior-service-client';

export function registerFileIpc(): void {
  ipcMain.handle('file:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await createRemoteFile(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteFile(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:getByPath', async (_e, projectId: string, path: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteFileByPath(projectId, path) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:getByProject', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteFilesByProject(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteFile(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('file:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteFile(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
