import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@netior/shared/constants';
import type {
  DeleteUserAgentInput,
  DeleteUserAgentSkillInput,
  IpcResult,
  UpsertUserAgentInput,
  UpsertUserAgentSkillInput,
  UserAgentRecord,
  UserAgentSkillSummary,
} from '@netior/shared/types';
import {
  deleteUserAgent,
  deleteUserAgentSkill,
  listUserAgents,
  upsertUserAgent,
  upsertUserAgentSkill,
} from '../agents/user-agent-store';

export function registerAgentDefinitionIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_LIST_DEFINITIONS,
    async (_event, projectId?: string | null): Promise<IpcResult<UserAgentRecord[]>> => {
      try {
        return { success: true, data: await listUserAgents(projectId) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_UPSERT_DEFINITION,
    async (_event, input: UpsertUserAgentInput): Promise<IpcResult<UserAgentRecord>> => {
      try {
        return { success: true, data: await upsertUserAgent(input) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_DELETE_DEFINITION,
    async (_event, input: DeleteUserAgentInput): Promise<IpcResult<boolean>> => {
      try {
        return { success: true, data: await deleteUserAgent(input) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_UPSERT_SKILL,
    async (_event, input: UpsertUserAgentSkillInput): Promise<IpcResult<UserAgentSkillSummary>> => {
      try {
        return { success: true, data: await upsertUserAgentSkill(input) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_DELETE_SKILL,
    async (_event, input: DeleteUserAgentSkillInput): Promise<IpcResult<boolean>> => {
      try {
        return { success: true, data: await deleteUserAgentSkill(input) };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    },
  );
}
