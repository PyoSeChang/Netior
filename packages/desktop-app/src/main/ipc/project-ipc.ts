import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { createProject, listProjects, deleteProject, updateProject, updateProjectRootDir } from '@netior/core';

export function registerProjectIpc(): void {
  ipcMain.handle('project:create', async (_e, data): Promise<IpcResult<unknown>> => {
    try {
      const result = createProject(data);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:list', async (): Promise<IpcResult<unknown>> => {
    try {
      const result = listProjects();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:delete', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      const result = deleteProject(id);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:update', async (_e, id: string, data): Promise<IpcResult<unknown>> => {
    try {
      const result = updateProject(id, data);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('project:updateRootDir', async (_e, id: string, rootDir: string): Promise<IpcResult<unknown>> => {
    try {
      const result = updateProjectRootDir(id, rootDir);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
