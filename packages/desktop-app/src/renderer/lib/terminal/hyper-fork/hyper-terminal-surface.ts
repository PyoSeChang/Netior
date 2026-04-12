import { createElement, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { TerminalLaunchConfig, TerminalSessionInfo } from '@netior/shared/types';
import { unwrapIpc } from '../../../services/ipc';
import type {
  TerminalEngineInstance,
  TerminalEngineLaunchConfig,
  TerminalLayoutDimensions,
  TerminalRawXterm,
  TerminalSearchController,
} from '../engine/terminal-engine';
import { registerHyperTerminalSurface, unregisterHyperTerminalSurface } from './term-registry';
import {
  getTerminalAppearanceSnapshot,
  onTerminalAppearanceChanged,
} from './terminal-appearance';
import { ForkedHyperTerms, type ForkedHyperTermsHandle } from './terms';

type DisposableLike = { dispose(): void };

function toDisposable(disposable: DisposableLike | (() => void)): DisposableLike {
  if (typeof disposable === 'function') {
    return { dispose: disposable };
  }
  return disposable;
}

function disposeAll(disposables: DisposableLike[]): void {
  for (const disposable of disposables.splice(0)) {
    disposable.dispose();
  }
}

function getDefaultExecutable(): string {
  return window.electron.terminal.getWindowsBuildNumber() != null
    ? 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    : '/bin/bash';
}

function getDefaultArgs(): string[] | undefined {
  return window.electron.terminal.getWindowsBuildNumber() != null ? ['-NoLogo'] : undefined;
}

function buildLaunchConfig(
  cwd: string,
  initialTitle: string,
  launchConfig?: TerminalEngineLaunchConfig,
): TerminalLaunchConfig {
  return {
    cwd,
    title: initialTitle,
    shell: launchConfig?.shell ?? getDefaultExecutable(),
    args: launchConfig?.args ?? getDefaultArgs(),
    agent: launchConfig?.agent,
  };
}

export class HyperTerminalSurface implements TerminalEngineInstance {
  readonly kind = 'hyper' as const;

  private readonly titleListeners = new Set<() => void>();
  private readonly allDisposables: DisposableLike[] = [];
  private readonly runtimeDisposables: DisposableLike[] = [];
  private readonly readyPromise: Promise<void>;
  private readonly hostElement = document.createElement('div');
  private readonly termsRef = createRef<ForkedHyperTerms>();

  private currentTitle: string;
  private currentAppearance = getTerminalAppearanceSnapshot();
  private startPromise: Promise<void> | null = null;
  private runtimeReleased = false;
  private resolveReady!: () => void;
  private lastResizeCols: number | null = null;
  private lastResizeRows: number | null = null;
  private reactRoot: Root | null = null;
  private attachedContainer: HTMLElement | null = null;
  private visible = true;

  constructor(
    private readonly sessionId: string,
    private readonly cwd: string,
    private readonly initialTitle: string,
    private readonly launchConfig?: TerminalEngineLaunchConfig,
    private readonly onDidExit?: () => void,
  ) {
    this.currentTitle = initialTitle;
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
    this.hostElement.className = 'netior-hyper-terminal-root';
    Object.assign(this.hostElement.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    });

    registerHyperTerminalSurface(this.sessionId, this);

    this.registerDisposable(() => {
      unregisterHyperTerminalSurface(this.sessionId, this);
    });

    this.registerRuntimeDisposable(window.electron.terminal.onReady((payload) => {
      if (payload.sessionId !== this.sessionId) return;
      if (this.acceptsTerminalTitleChanges && payload.title) {
        this.setTitle(payload.title);
      }
      this.resolveReady();
    }));
    this.registerRuntimeDisposable(window.electron.terminal.onData((eventSessionId, data) => {
      if (eventSessionId !== this.sessionId) return;
      this.termsRef.current?.write(data);
    }));
    if (this.acceptsTerminalTitleChanges) {
      this.registerRuntimeDisposable(window.electron.terminal.onTitleChanged((eventSessionId, title) => {
        if (eventSessionId !== this.sessionId) return;
        this.setTitle(title);
      }));
    }
    this.registerRuntimeDisposable(window.electron.terminal.onExit((eventSessionId) => {
      if (eventSessionId !== this.sessionId) return;
      this.releaseRuntime();
      this.onDidExit?.();
    }));

    this.registerDisposable(onTerminalAppearanceChanged((appearance) => {
      this.currentAppearance = appearance;
      this.renderTerms();
    }));
  }

  get title(): string {
    return this.currentTitle;
  }

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      const info = unwrapIpc<TerminalSessionInfo>(await window.electron.terminal.createInstance(
        this.sessionId,
        buildLaunchConfig(this.cwd, this.initialTitle, this.launchConfig),
      ));

      if (this.acceptsTerminalTitleChanges && info.title) {
        this.setTitle(info.title);
      }
      this.lastResizeCols = info.cols;
      this.lastResizeRows = info.rows;

      await unwrapIpc(await window.electron.terminal.attach(this.sessionId));
    })();

    return this.startPromise;
  }

  attachToElement(element: HTMLElement): void {
    this.attachedContainer = element;
    if (this.hostElement.parentElement !== element) {
      this.hostElement.parentElement?.removeChild(this.hostElement);
      element.appendChild(this.hostElement);
    }
    this.ensureReactRoot();
    this.renderTerms();
  }

  detachFromElement(): void {
    this.attachedContainer = null;
    this.hostElement.parentElement?.removeChild(this.hostElement);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.renderTerms();
  }

  layout(dimensions: TerminalLayoutDimensions): void {
    void dimensions;
    this.termsRef.current?.fitActiveTerm();
  }

  onTitleChanged(listener: () => void): { dispose(): void } {
    this.titleListeners.add(listener);
    return {
      dispose: () => {
        this.titleListeners.delete(listener);
      },
    };
  }

  async focusWhenReady(): Promise<void> {
    await this.start();
    await this.readyPromise;
    this.focus();
  }

  focus(): void {
    this.termsRef.current?.focusActiveTerm();
  }

  scrollUpPage(): void {
    this.termsRef.current?.scrollUpPage();
  }

  scrollDownPage(): void {
    this.termsRef.current?.scrollDownPage();
  }

  hasSelection(): boolean {
    return this.termsRef.current?.hasSelection() ?? false;
  }

  copySelection(): void {
    this.termsRef.current?.copySelection();
  }

  async sendText(text: string, shouldExecute: boolean, bracketedPasteMode: boolean): Promise<void> {
    await this.start();
    await this.readyPromise;

    if (bracketedPasteMode && !shouldExecute) {
      this.termsRef.current?.paste(text);
      return;
    }

    let payload = text;
    const xt = this.termsRef.current?.getRawXterm();
    if (bracketedPasteMode && xt?.modes?.bracketedPasteMode) {
      payload = `\u001b[200~${payload}\u001b[201~`;
    }
    if (shouldExecute) {
      payload += '\r';
    }

    window.electron.terminal.input(this.sessionId, payload);
  }

  getSelection(): string {
    return this.termsRef.current?.getSelection() ?? '';
  }

  getSearchController(): TerminalSearchController | undefined {
    return this.termsRef.current?.getSearchController();
  }

  getRawXterm(): TerminalRawXterm | undefined {
    return this.termsRef.current?.getRawXterm();
  }

  dispose(): void {
    this.releaseRuntime();
    disposeAll(this.allDisposables);
    if (this.reactRoot) {
      this.reactRoot.unmount();
      this.reactRoot = null;
    }
    this.hostElement.parentElement?.removeChild(this.hostElement);
  }

  private registerDisposable(disposable: DisposableLike | (() => void)): void {
    this.allDisposables.push(toDisposable(disposable));
  }

  private registerRuntimeDisposable(disposable: DisposableLike | (() => void)): void {
    const normalized = toDisposable(disposable);
    this.runtimeDisposables.push(normalized);
    this.allDisposables.push(normalized);
  }

  private releaseRuntime(): void {
    if (this.runtimeReleased) return;
    this.runtimeReleased = true;
    disposeAll(this.runtimeDisposables);
  }

  private get acceptsTerminalTitleChanges(): boolean {
    return !this.launchConfig?.agent;
  }

  private setTitle(title: string): void {
    if (!title || title === this.currentTitle) return;
    this.currentTitle = title;
    for (const listener of this.titleListeners) {
      listener();
    }
  }

  private ensureReactRoot(): void {
    if (this.reactRoot) return;
    this.reactRoot = createRoot(this.hostElement);
  }

  private renderTerms(): void {
    if (!this.reactRoot) return;

    this.reactRoot.render(
      createElement(ForkedHyperTerms, {
        ref: this.termsRef,
        uid: this.sessionId,
        appearance: this.currentAppearance,
        launchConfig: this.launchConfig,
        visible: this.visible,
        onData: (data: string) => {
          window.electron.terminal.input(this.sessionId, data);
        },
        onResize: (cols: number, rows: number) => {
          if (this.lastResizeCols === cols && this.lastResizeRows === rows) {
            return;
          }
          this.lastResizeCols = cols;
          this.lastResizeRows = rows;
          window.electron.terminal.resize(this.sessionId, cols, rows);
        },
        onTitle: this.acceptsTerminalTitleChanges
          ? (title: string) => {
              this.setTitle(title);
            }
          : undefined,
        onActive: () => {
          // Hyper uses this to update the active session stack.
          // Netior has one terminal surface per tab, so no extra state write is needed.
        },
      }),
    );
  }
}
