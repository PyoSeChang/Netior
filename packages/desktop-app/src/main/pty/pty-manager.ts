import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { BrowserWindow } from 'electron';
import { basename } from 'path';
import { existsSync } from 'fs';
import { IPC_CHANNELS } from '@moc/shared/constants';
import type {
  TerminalLaunchConfig,
  TerminalSessionInfo,
  TerminalSessionState,
} from '@moc/shared/types';

function resolveShell(config?: TerminalLaunchConfig): { command: string; args: string[]; title: string } {
  if (config?.shell) {
    return {
      command: config.shell,
      args: config.args ?? [],
      title: config.title ?? basename(config.shell),
    };
  }

  const powerShell = 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (existsSync(powerShell)) {
    return {
      command: powerShell,
      args: ['-NoLogo'],
      title: config?.title ?? 'PowerShell',
    };
  }

  const command = process.env.COMSPEC || 'cmd.exe';
  return {
    command,
    args: [],
    title: config?.title ?? basename(command),
  };
}

interface TerminalSessionRecord {
  info: TerminalSessionInfo;
  process: IPty | null;
}

class TerminalBackendService {
  private sessions = new Map<string, TerminalSessionRecord>();
  private mainWindow: BrowserWindow | null = null;

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  createInstance(sessionId: string, launchConfig: TerminalLaunchConfig): TerminalSessionInfo {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing.info;

    const shell = resolveShell(launchConfig);
    const info: TerminalSessionInfo = {
      sessionId,
      cwd: launchConfig.cwd,
      title: shell.title,
      shellPath: shell.command,
      shellArgs: shell.args,
      state: 'created',
      pid: null,
      exitCode: null,
      cols: 80,
      rows: 30,
    };

    this.sessions.set(sessionId, { info, process: null });
    return info;
  }

  attach(sessionId: string): TerminalSessionInfo {
    const record = this.requireSession(sessionId);
    if (record.process) return record.info;

    record.info.exitCode = null;
    const ptyProcess = pty.spawn(record.info.shellPath, record.info.shellArgs, {
      name: 'xterm-256color',
      cols: record.info.cols,
      rows: record.info.rows,
      cwd: record.info.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'moc',
      } as Record<string, string>,
      useConpty: true,
    });

    record.process = ptyProcess;
    record.info.pid = ptyProcess.pid;
    this.setState(record, 'starting');

    ptyProcess.onData((data) => {
      this.send(IPC_CHANNELS.TERMINAL_DATA, { sessionId, data });
    });

    ptyProcess.onExit(({ exitCode }) => {
      record.process = null;
      record.info.exitCode = exitCode;
      this.setState(record, 'exited');
      this.send(IPC_CHANNELS.TERMINAL_EXIT, { sessionId, exitCode });
    });

    this.setState(record, 'running');
    this.send(IPC_CHANNELS.TERMINAL_READY, {
      sessionId,
      pid: record.info.pid,
      cwd: record.info.cwd,
      title: record.info.title,
    });
    this.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGED, { sessionId, title: record.info.title });

    return record.info;
  }

  getSession(sessionId: string): TerminalSessionInfo | null {
    return this.sessions.get(sessionId)?.info ?? null;
  }

  input(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.process?.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    record.info.cols = cols;
    record.info.rows = rows;
    record.process?.resize(cols, rows);
  }

  shutdown(sessionId: string): void {
    const record = this.sessions.get(sessionId);
    if (!record) return;
    record.process?.kill();
    record.process = null;
    this.sessions.delete(sessionId);
  }

  killAll(): void {
    for (const [sessionId] of this.sessions) {
      this.shutdown(sessionId);
    }
  }
  private requireSession(sessionId: string): TerminalSessionRecord {
    const record = this.sessions.get(sessionId);
    if (!record) {
      throw new Error(`Terminal session not found: ${sessionId}`);
    }
    return record;
  }

  private setState(record: TerminalSessionRecord, state: TerminalSessionState): void {
    record.info.state = state;
    this.send(IPC_CHANNELS.TERMINAL_STATE_CHANGED, {
      sessionId: record.info.sessionId,
      state,
      exitCode: record.info.exitCode,
    });
  }

  private send(channel: string, payload: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }
}

export const terminalBackendService = new TerminalBackendService();
export const ptyManager = terminalBackendService;
