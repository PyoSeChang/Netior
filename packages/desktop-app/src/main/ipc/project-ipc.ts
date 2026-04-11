import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  createRemoteProject,
  deleteRemoteProject,
  listRemoteProjects,
  updateRemoteProject,
  updateRemoteProjectRootDir,
} from '../netior-service/netior-service-client';

export function registerProjectIpc(): void {
  ipcMain.handle('project:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await createRemoteProject(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:list', async (): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteProjects() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteProject(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteProject(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:updateRootDir', async (_e, id: string, rootDir: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteProjectRootDir(id, rootDir) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
