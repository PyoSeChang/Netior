import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { BrowserWindow, type WebContents } from 'electron';
import { basename } from 'path';
import { existsSync } from 'fs';
import { IPC_CHANNELS } from '@netior/shared/constants';
import type {
  TerminalLaunchConfig,
  TerminalSessionInfo,
  TerminalSessionState,
} from '@netior/shared/types';
import { agentRuntimeManager } from '../agent-runtime/agent-runtime-manager';


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
  launchEnv: Record<string, string>;
  process: IPty | null;
  outputBuffer: string;
}

const MAX_REPLAY_CHARS = 200_000;

class TerminalBackendService {
  private sessions = new Map<string, TerminalSessionRecord>();

  async createInstance(sessionId: string, launchConfig: TerminalLaunchConfig): Promise<TerminalSessionInfo> {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing.info;

    const resolvedLaunchConfig = await agentRuntimeManager.prepareTerminalLaunch(sessionId, launchConfig);
    const shell = resolveShell(resolvedLaunchConfig);
    const info: TerminalSessionInfo = {
      sessionId,
      cwd: resolvedLaunchConfig.cwd,
      title: shell.title,
      shellPath: shell.command,
      shellArgs: shell.args,
      state: 'created',
      pid: null,
      exitCode: null,
      cols: 80,
      rows: 30,
    };

    this.sessions.set(sessionId, {
      info,
      launchEnv: resolvedLaunchConfig.env ?? {},
      process: null,
      outputBuffer: '',
    });
    return info;
  }

  attach(sessionId: string, target?: WebContents): TerminalSessionInfo {
    const record = this.requireSession(sessionId);
    if (record.process) {
      this.replaySession(record, target);
      return record.info;
    }

    record.info.exitCode = null;
    const ptyProcess = pty.spawn(record.info.shellPath, record.info.shellArgs, {
      name: 'xterm-256color',
      cols: record.info.cols,
      rows: record.info.rows,
      cwd: record.info.cwd,
      env: {
        ...process.env,
        ...record.launchEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'netior',
        NETIOR_PTY_ID: sessionId,
      } as Record<string, string>,
      useConpty: true,
    });

    record.process = ptyProcess;
    record.info.pid = ptyProcess.pid;
    this.setState(record, 'starting');

    ptyProcess.onData((data) => {
      record.outputBuffer = `${record.outputBuffer}${data}`;
      if (record.outputBuffer.length > MAX_REPLAY_CHARS) {
        record.outputBuffer = record.outputBuffer.slice(-MAX_REPLAY_CHARS);
      }
      this.send(IPC_CHANNELS.TERMINAL_DATA, { sessionId, data });
    });

    ptyProcess.onExit(({ exitCode }) => {
      record.process = null;
      record.info.exitCode = exitCode;
      agentRuntimeManager.cleanupTerminalLaunch(sessionId, 'exit', exitCode);
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
    agentRuntimeManager.cleanupTerminalLaunch(sessionId, 'shutdown', record.info.exitCode);
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
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }

  private replaySession(record: TerminalSessionRecord, target?: WebContents): void {
    if (!target || target.isDestroyed()) return;

    target.send(IPC_CHANNELS.TERMINAL_READY, {
      sessionId: record.info.sessionId,
      pid: record.info.pid,
      cwd: record.info.cwd,
      title: record.info.title,
    });
    target.send(IPC_CHANNELS.TERMINAL_STATE_CHANGED, {
      sessionId: record.info.sessionId,
      state: record.info.state,
      exitCode: record.info.exitCode,
    });
    target.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGED, {
      sessionId: record.info.sessionId,
      title: record.info.title,
    });
    if (record.outputBuffer) {
      target.send(IPC_CHANNELS.TERMINAL_DATA, {
        sessionId: record.info.sessionId,
        data: record.outputBuffer,
      });
    }
  }
}

export const terminalBackendService = new TerminalBackendService();
export const ptyManager = terminalBackendService;
