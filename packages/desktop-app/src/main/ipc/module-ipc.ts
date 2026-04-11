import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import {
  addRemoteModuleDirectory,
  createRemoteModule,
  deleteRemoteModule,
  listRemoteModuleDirectories,
  listRemoteModules,
  removeRemoteModuleDirectory,
  updateRemoteModule,
  updateRemoteModuleDirectoryPath,
} from '../netior-service/netior-service-client';

export function registerModuleIpc(): void {
  ipcMain.handle('module:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await createRemoteModule(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('module:list', async (_e, projectId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteModules(projectId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('module:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteModule(id, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('module:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await deleteRemoteModule(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('moduleDir:add', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await addRemoteModuleDirectory(data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('moduleDir:list', async (_e, moduleId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await listRemoteModuleDirectories(moduleId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('moduleDir:remove', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await removeRemoteModuleDirectory(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('moduleDir:updatePath', async (_e, id: string, dirPath: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await updateRemoteModuleDirectoryPath(id, dirPath) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
