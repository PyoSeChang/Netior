import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@netior/shared/constants';
import type { TerminalLaunchConfig } from '@netior/shared/types';
import { terminalBackendService } from '../pty/pty-manager';

export function registerPtyIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE_INSTANCE, (_event, sessionId: string, launchConfig: TerminalLaunchConfig) => {
    const session = terminalBackendService.createInstance(sessionId, launchConfig);
    return { success: true, data: session };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_GET_SESSION, (_event, sessionId: string) => {
    return { success: true, data: terminalBackendService.getSession(sessionId) };
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_ATTACH, (_event, sessionId: string) => {
    const session = terminalBackendService.attach(sessionId);
    return { success: true, data: session };
  });

  ipcMain.on(IPC_CHANNELS.TERMINAL_INPUT, (_event, sessionId: string, data: string) => {
    terminalBackendService.input(sessionId, data);
  });

  ipcMain.on(IPC_CHANNELS.TERMINAL_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    terminalBackendService.resize(sessionId, cols, rows);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_SHUTDOWN, (_event, sessionId: string) => {
    terminalBackendService.shutdown(sessionId);
    return { success: true, data: null };
  });
}
