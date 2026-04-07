import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { getObject, getObjectByRef } from '@netior/core';
import type { NetworkObjectType } from '@netior/shared/types';

export function registerObjectIpc(): void {
  ipcMain.handle('object:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getObject(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('object:getByRef', async (_e, objectType: NetworkObjectType, refId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: getObjectByRef(objectType, refId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
