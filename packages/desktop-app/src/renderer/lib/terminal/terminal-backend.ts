import { Emitter } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import type { IProcessEnvironment } from '@codingame/monaco-vscode-api/vscode/vs/base/common/platform';
import {
  ProcessPropertyType,
  type IProcessProperty,
  type IProcessPropertyMap,
  type IProcessReadyEvent,
  type IShellLaunchConfig,
  type ITerminalChildProcess,
  type ITerminalLaunchError,
  type ITerminalProcessOptions,
} from '@codingame/monaco-vscode-api/vscode/vs/platform/terminal/common/terminal';
import { SimpleTerminalBackend } from '@codingame/monaco-vscode-terminal-service-override';
import type { TerminalLaunchConfig } from '@moc/shared/types';
import { unwrapIpc } from '../../services/ipc';

const SESSION_ENV_KEY = 'MOC_TERMINAL_SESSION_ID';

function getSessionId(shellLaunchConfig: IShellLaunchConfig, fallbackId: number): string {
  const envValue = shellLaunchConfig.env?.[SESSION_ENV_KEY];
  if (typeof envValue === 'string' && envValue.length > 0) {
    return envValue;
  }
  return `moc-terminal-${fallbackId}`;
}

function toLaunchConfig(shellLaunchConfig: IShellLaunchConfig, cwd: string): TerminalLaunchConfig {
  return {
    cwd,
    shell: shellLaunchConfig.executable,
    args: Array.isArray(shellLaunchConfig.args)
      ? shellLaunchConfig.args
      : typeof shellLaunchConfig.args === 'string' && shellLaunchConfig.args.length > 0
        ? [shellLaunchConfig.args]
        : undefined,
    title: shellLaunchConfig.name,
  };
}

class MoCTerminalProcess implements ITerminalChildProcess {
  readonly shouldPersist = false;
  readonly onProcessReplayComplete = undefined;
  readonly onRestoreCommands = undefined;

  private readonly dataEmitter = new Emitter<string>();
  private readonly readyEmitter = new Emitter<IProcessReadyEvent>();
  private readonly propertyEmitter = new Emitter<IProcessProperty>();
  private readonly exitEmitter = new Emitter<number | undefined>();
  private readonly cleanup: Array<() => void> = [];

  readonly onProcessData = this.dataEmitter.event;
  readonly onProcessReady = this.readyEmitter.event;
  readonly onDidChangeProperty = this.propertyEmitter.event;
  readonly onProcessExit = this.exitEmitter.event;

  private pid = 0;
  private currentCwd: string;
  private initialCwd: string;
  private currentTitle: string;
  private exitCode: number | undefined;
  private startPromise: Promise<ITerminalLaunchError | { injectedArgs: string[] } | undefined> | null = null;
  private started = false;
  private shutdownRequested = false;

  constructor(
    readonly id: number,
    private readonly sessionId: string,
    private readonly shellLaunchConfig: IShellLaunchConfig,
    cwd: string,
  ) {
    this.currentCwd = cwd;
    this.initialCwd = cwd;
    this.currentTitle = shellLaunchConfig.name ?? shellLaunchConfig.executable ?? 'Terminal';

    this.cleanup.push(
      window.electron.terminal.onData((eventSessionId, data) => {
        if (eventSessionId === this.sessionId) {
          this.dataEmitter.fire(data);
        }
      }),
    );

    this.cleanup.push(
      window.electron.terminal.onExit((eventSessionId, exitCode) => {
        if (eventSessionId !== this.sessionId || this.exitCode !== undefined) return;
        this.exitCode = exitCode;
        this.exitEmitter.fire(exitCode);
      }),
    );

    this.cleanup.push(
      window.electron.terminal.onReady((payload) => {
        if (payload.sessionId !== this.sessionId) return;
        this.pid = payload.pid ?? 0;
        this.currentCwd = payload.cwd;
        this.initialCwd = payload.cwd;
        this.readyEmitter.fire({
          pid: this.pid,
          cwd: payload.cwd,
          windowsPty: window.electron.terminal.getWindowsBuildNumber() == null
            ? undefined
            : {
                backend: 'conpty',
                buildNumber: window.electron.terminal.getWindowsBuildNumber()!,
              },
        });
        if (payload.title) {
          this.currentTitle = payload.title;
          this.propertyEmitter.fire({ type: ProcessPropertyType.Title, value: payload.title });
        }
        this.propertyEmitter.fire({ type: ProcessPropertyType.Cwd, value: payload.cwd });
        this.propertyEmitter.fire({ type: ProcessPropertyType.InitialCwd, value: payload.cwd });
      }),
    );

    this.cleanup.push(
      window.electron.terminal.onTitleChanged((eventSessionId, title) => {
        if (eventSessionId !== this.sessionId || !title) return;
        this.currentTitle = title;
        this.propertyEmitter.fire({ type: ProcessPropertyType.Title, value: title });
      }),
    );
  }

  start(): Promise<ITerminalLaunchError | { injectedArgs: string[] } | undefined> {
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      this.started = true;
      try {
        const launchConfig = toLaunchConfig(this.shellLaunchConfig, this.currentCwd);
        await unwrapIpc(await window.electron.terminal.createInstance(this.sessionId, launchConfig));
        await unwrapIpc(await window.electron.terminal.attach(this.sessionId));
        return { injectedArgs: [] };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start terminal process';
        return { message };
      }
    })();

    return this.startPromise;
  }

  shutdown(): void {
    if (this.shutdownRequested) return;
    this.shutdownRequested = true;
    void window.electron.terminal.shutdown(this.sessionId).catch(() => {});
    if (!this.started && this.exitCode === undefined) {
      this.exitCode = undefined;
      this.exitEmitter.fire(undefined);
    }
  }

  input(data: string): void {
    window.electron.terminal.input(this.sessionId, data);
  }

  resize(cols: number, rows: number): void {
    window.electron.terminal.resize(this.sessionId, cols, rows);
  }

  async processBinary(): Promise<void> {}

  sendSignal(signal: string): void {
    if (signal === 'SIGINT') {
      this.input('\u0003');
      return;
    }

    if (signal === 'SIGTERM' || signal === 'SIGKILL') {
      this.shutdown();
    }
  }

  clearBuffer(): void {}

  acknowledgeDataEvent(): void {}

  async setUnicodeVersion(): Promise<void> {}

  async getInitialCwd(): Promise<string> {
    return this.initialCwd;
  }

  async getCwd(): Promise<string> {
    return this.currentCwd;
  }

  async getLatency(): Promise<number> {
    return 0;
  }

  async refreshProperty<T extends ProcessPropertyType>(property: T): Promise<IProcessPropertyMap[T]> {
    switch (property) {
      case ProcessPropertyType.Cwd:
        return this.currentCwd as IProcessPropertyMap[T];
      case ProcessPropertyType.InitialCwd:
        return this.initialCwd as IProcessPropertyMap[T];
      case ProcessPropertyType.Title:
        return this.currentTitle as IProcessPropertyMap[T];
      default:
        return undefined as IProcessPropertyMap[T];
    }
  }

  async updateProperty<T extends ProcessPropertyType>(property: T, value: IProcessPropertyMap[T]): Promise<void> {
    if (property === ProcessPropertyType.Title && typeof value === 'string') {
      this.currentTitle = value;
      this.propertyEmitter.fire({ type: ProcessPropertyType.Title, value });
    }
  }

  dispose(): void {
    this.dataEmitter.dispose();
    this.readyEmitter.dispose();
    this.propertyEmitter.dispose();
    this.exitEmitter.dispose();
    for (const cleanup of this.cleanup.splice(0)) {
      cleanup();
    }
  }
}

export class MoCTerminalBackend extends SimpleTerminalBackend {
  private nextProcessId = 1;

  override getDefaultSystemShell = async (): Promise<string> => {
    if (window.electron.terminal.getWindowsBuildNumber() != null) {
      return 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    }
    return '/bin/bash';
  };

  override getEnvironment = async (): Promise<IProcessEnvironment> => ({});

  override getShellEnvironment = async (): Promise<IProcessEnvironment | undefined> => ({});

  override createProcess = async (
    shellLaunchConfig: IShellLaunchConfig,
    cwd: string,
    _cols: number,
    _rows: number,
    _unicodeVersion: '6' | '11',
    _env: IProcessEnvironment,
    _options: ITerminalProcessOptions,
    _shouldPersist: boolean,
  ): Promise<ITerminalChildProcess> => {
    const id = this.nextProcessId++;
    const sessionId = getSessionId(shellLaunchConfig, id);
    return new MoCTerminalProcess(id, sessionId, shellLaunchConfig, cwd);
  };
}

let backendSingleton: MoCTerminalBackend | null = null;

export function getTerminalBackend(): MoCTerminalBackend {
  backendSingleton ??= new MoCTerminalBackend();
  return backendSingleton;
}

export { SESSION_ENV_KEY };
