import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getSetting, setSetting } from '@netior/core';

export function registerConfigIpc(): void {
  ipcMain.handle('config:get', async (_e, key: string): Promise<IpcResult<unknown>> => {
    try {
      const value = getSetting(key);
      return { success: true, data: value ?? null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(
    'config:set',
    async (_e, key: string, value: unknown): Promise<IpcResult<unknown>> => {
      try {
        setSetting(key, typeof value === 'string' ? value : JSON.stringify(value));
        return { success: true, data: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  );
}
