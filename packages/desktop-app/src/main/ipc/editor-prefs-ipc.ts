import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getEditorPrefs, upsertEditorPrefs } from '@netior/core';

export function registerEditorPrefsIpc(): void {
  ipcMain.handle('editorPrefs:get', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getEditorPrefs(conceptId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('editorPrefs:upsert', async (_e, conceptId: string, data): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: upsertEditorPrefs(conceptId, data) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
