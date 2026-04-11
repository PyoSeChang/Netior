import { ipcMain } from 'electron';
import type { IpcResult, NetworkObjectType } from '@netior/shared/types';
import { getRemoteObject, getRemoteObjectByRef } from '../netior-service/netior-service-client';

export function registerObjectIpc(): void {
  ipcMain.handle('object:get', async (_e, id: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteObject(id) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('object:getByRef', async (_e, objectType: NetworkObjectType, refId: string): Promise<IpcResult<unknown>> => {
    try {
      return { success: true, data: await getRemoteObjectByRef(objectType, refId) };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
