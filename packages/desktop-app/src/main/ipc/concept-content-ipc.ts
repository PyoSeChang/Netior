import { ipcMain } from 'electron';
import type { IpcResult } from '@netior/shared/types';
import { syncRemoteConceptFromAgent, syncRemoteConceptToAgent } from '../netior-service/netior-service-client';
import { broadcastChange } from './broadcast-change';

export function registerConceptContentIpc(): void {
  ipcMain.handle('concept:syncToAgent', async (_e, conceptId: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await syncRemoteConceptToAgent(conceptId);
      broadcastChange({ type: 'concepts', action: 'updated', id: conceptId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('concept:syncFromAgent', async (_e, conceptId: string, agentContent: string): Promise<IpcResult<unknown>> => {
    try {
      const result = await syncRemoteConceptFromAgent(conceptId, agentContent);
      broadcastChange({ type: 'concepts', action: 'updated', id: conceptId });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });
}
