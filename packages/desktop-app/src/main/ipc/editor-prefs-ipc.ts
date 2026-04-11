import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getRemoteEditorPrefs, upsertRemoteEditorPrefs } from '../netior-service/netior-service-client';

export function registerEditorPrefsIpc(): void {
  ipcMain.handle('editorPrefs:get', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteEditorPrefs(conceptId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('editorPrefs:upsert', async (_e, conceptId: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await upsertRemoteEditorPrefs(conceptId, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
