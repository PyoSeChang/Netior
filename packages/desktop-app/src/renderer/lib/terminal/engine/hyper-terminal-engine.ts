import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { Terminal, type ITerminalOptions } from '@xterm/xterm';
import type { TerminalLaunchConfig, TerminalSessionInfo } from '@netior/shared/types';
import { unwrapIpc } from '../../../services/ipc';
import {
  getTerminalAppearanceSnapshot,
  onTerminalAppearanceChanged,
  type TerminalAppearanceSnapshot,
} from '../terminal-services';
import type {
  TerminalEngine,
  TerminalEngineInstance,
  TerminalEngineLaunchConfig,
  TerminalFindResult,
  TerminalLayoutDimensions,
  TerminalRawXterm,
  TerminalSearchController,
} from './terminal-engine';

type DisposableLike = { dispose(): void };

interface SearchDecorationOptions {
  matchBackground?: string;
  matchBorder?: string;
  matchOverviewRuler: string;
  activeMatchBackground?: string;
  activeMatchBorder?: string;
  activeMatchColorOverviewRuler: string;
}

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
  title: string,
  launchConfig?: TerminalEngineLaunchConfig,
): TerminalLaunchConfig {
  return {
    cwd,
    title,
    shell: launchConfig?.shell ?? getDefaultExecutable(),
    args: launchConfig?.args ?? getDefaultArgs(),
    agent: launchConfig?.agent,
  };
}

function buildSearchDecorations(appearance: TerminalAppearanceSnapshot): SearchDecorationOptions {
  return {
    matchBackground: appearance.colors.findMatchHighlightBackground,
    matchBorder: appearance.colors.findMatchHighlightBorder,
    matchOverviewRuler: appearance.colors.findMatchHighlightBorder,
    activeMatchBackground: appearance.colors.findMatchBackground,
    activeMatchBorder: appearance.colors.findMatchBorder,
    activeMatchColorOverviewRuler: appearance.colors.findMatchBorder,
  };
}

function buildTerminalOptions(appearance: TerminalAppearanceSnapshot): ITerminalOptions {
  const buildNumber = window.electron.terminal.getWindowsBuildNumber();

  return {
    allowProposedApi: true,
    cursorBlink: appearance.cursorBlink,
    cursorStyle: 'block',
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    lineHeight: appearance.lineHeight,
    letterSpacing: appearance.letterSpacing,
    minimumContrastRatio: appearance.minimumContrastRatio,
    scrollback: 10_000,
    theme: {
      background: appearance.colors.background,
      foreground: appearance.colors.foreground,
      cursor: appearance.colors.foreground,
      cursorAccent: appearance.colors.background,
      selectionBackground: appearance.colors.selection,
      selectionInactiveBackground: appearance.colors.inactiveSelection,
    },
    windowsPty: buildNumber == null
      ? undefined
      : {
          backend: 'conpty',
          buildNumber,
        },
  };
}

class HyperSearchController implements TerminalSearchController {
  findResult: TerminalFindResult | undefined;

  constructor(
    private readonly searchAddon: SearchAddon,
    private readonly getDecorations: () => SearchDecorationOptions,
  ) {}

  async findNext(term: string, opts: { incremental?: boolean }): Promise<boolean> {
    return this.searchAddon.findNext(term, {
      incremental: opts.incremental,
      decorations: this.getDecorations(),
    });
  }

  async findPrevious(term: string, opts: { incremental?: boolean }): Promise<boolean> {
    return this.searchAddon.findPrevious(term, {
      incremental: opts.incremental,
      decorations: this.getDecorations(),
    });
  }

  clearSearchDecorations(): void {
    this.searchAddon.clearDecorations();
    this.findResult = undefined;
  }

  clearActiveSearchDecoration(): void {
    this.searchAddon.clearActiveDecoration();
  }

  onDidChangeFindResults(listener: (result: TerminalFindResult) => void): { dispose(): void } {
    return this.searchAddon.onDidChangeResults((result) => {
      this.findResult = result;
      listener(result);
    });
  }
}

class HyperTerminalEngineInstance implements TerminalEngineInstance {
  readonly kind = 'hyper' as const;

  private readonly term = new Terminal(buildTerminalOptions(getTerminalAppearanceSnapshot()));
  private readonly fitAddon = new FitAddon();
  private readonly searchAddon = new SearchAddon({ highlightLimit: 1_000 });
  private readonly searchController = new HyperSearchController(
    this.searchAddon,
    () => buildSearchDecorations(getTerminalAppearanceSnapshot()),
  );
  private readonly hostElement = document.createElement('div');
  private readonly titleListeners = new Set<() => void>();
  private readonly allDisposables: DisposableLike[] = [];
  private readonly runtimeDisposables: DisposableLike[] = [];
  private readonly readyPromise: Promise<void>;

  private attachedContainer: HTMLElement | null = null;
  private currentTitle: string;
  private startPromise: Promise<void> | null = null;
  private ready = false;
  private visible = true;
  private runtimeReleased = false;
  private resolveReady!: () => void;

  constructor(
    private readonly sessionId: string,
    private readonly cwd: string,
    initialTitle: string,
    private readonly launchConfig?: TerminalEngineLaunchConfig,
    private readonly onDidExit?: () => void,
  ) {
    this.currentTitle = initialTitle;
    this.hostElement.className = 'netior-hyper-terminal-host h-full w-full';
    Object.assign(this.hostElement.style, {
      width: '100%',
      height: '100%',
      overflow: 'hidden',
    });

    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });

    this.term.attachCustomKeyEventHandler((event) => !(event as KeyboardEvent & { catched?: boolean }).catched);
    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(this.searchAddon);

    this.registerRuntimeDisposable(this.term.onData((data) => {
      window.electron.terminal.input(this.sessionId, data);
    }));
    this.registerRuntimeDisposable(this.term.onResize(({ cols, rows }) => {
      window.electron.terminal.resize(this.sessionId, cols, rows);
    }));
    this.registerRuntimeDisposable(this.term.onTitleChange((title) => {
      this.setTitle(title);
    }));
    this.registerRuntimeDisposable(window.electron.terminal.onReady((payload) => {
      if (payload.sessionId !== this.sessionId) return;
      if (payload.title) {
        this.setTitle(payload.title);
      }
      this.ready = true;
      this.resolveReady();
    }));
    this.registerRuntimeDisposable(window.electron.terminal.onData((eventSessionId, data) => {
      if (eventSessionId !== this.sessionId) return;
      this.term.write(data);
    }));
    this.registerRuntimeDisposable(window.electron.terminal.onTitleChanged((eventSessionId, title) => {
      if (eventSessionId !== this.sessionId) return;
      this.setTitle(title);
    }));
    this.registerRuntimeDisposable(window.electron.terminal.onExit((eventSessionId) => {
      if (eventSessionId !== this.sessionId) return;
      this.releaseRuntime();
      this.onDidExit?.();
    }));

    this.registerDisposable(onTerminalAppearanceChanged((appearance) => {
      this.applyAppearance(appearance);
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
        buildLaunchConfig(this.cwd, this.currentTitle, this.launchConfig),
      ));

      if (info.title) {
        this.setTitle(info.title);
      }

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

    if (!this.term.element) {
      this.term.open(this.hostElement);
      this.applyAppearance(getTerminalAppearanceSnapshot());
    }

    this.syncVisibility();
    this.fitIfNeeded();
  }

  detachFromElement(): void {
    if (this.hostElement.parentElement) {
      this.hostElement.parentElement.removeChild(this.hostElement);
    }
    this.attachedContainer = null;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.syncVisibility();
    if (visible) {
      this.fitIfNeeded();
    }
  }

  layout(dimensions: TerminalLayoutDimensions): void {
    this.hostElement.style.width = `${Math.max(0, Math.floor(dimensions.width))}px`;
    this.hostElement.style.height = `${Math.max(0, Math.floor(dimensions.height))}px`;
    this.fitIfNeeded();
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
    this.term.focus();
    this.term.textarea?.focus();
  }

  scrollUpPage(): void {
    this.term.scrollPages(-1);
  }

  scrollDownPage(): void {
    this.term.scrollPages(1);
  }

  hasSelection(): boolean {
    return this.term.hasSelection();
  }

  copySelection(): void {
    const selection = this.term.getSelection();
    if (!selection) return;
    void navigator.clipboard.writeText(selection);
  }

  async sendText(text: string, shouldExecute: boolean, bracketedPasteMode: boolean): Promise<void> {
    await this.start();
    await this.readyPromise;

    let payload = text;
    if (bracketedPasteMode && this.term.modes.bracketedPasteMode) {
      payload = `\u001b[200~${payload}\u001b[201~`;
    }
    if (shouldExecute) {
      payload += '\r';
    }

    window.electron.terminal.input(this.sessionId, payload);
  }

  getSelection(): string {
    return this.term.getSelection();
  }

  getSearchController(): TerminalSearchController {
    return this.searchController;
  }

  getRawXterm(): TerminalRawXterm {
    return this.term as unknown as TerminalRawXterm;
  }

  disableBuiltinLinkHandling(): void {}

  dispose(): void {
    this.detachFromElement();
    this.releaseRuntime();
    disposeAll(this.allDisposables);
    this.term.dispose();
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

  private fitIfNeeded(): void {
    if (!this.term.element || !this.visible || !this.attachedContainer) return;
    this.fitAddon.fit();
  }

  private syncVisibility(): void {
    this.hostElement.style.display = this.visible ? 'block' : 'none';
  }

  private applyAppearance(appearance: TerminalAppearanceSnapshot): void {
    this.term.options = buildTerminalOptions(appearance);
    if (this.term.element) {
      this.fitIfNeeded();
    }
  }

  private setTitle(title: string): void {
    if (!title || title === this.currentTitle) return;
    this.currentTitle = title;
    for (const listener of this.titleListeners) {
      listener();
    }
  }
}

class HyperTerminalEngine implements TerminalEngine {
  readonly kind = 'hyper' as const;

  private readonly terminals = new Map<string, Promise<HyperTerminalEngineInstance>>();

  async getOrCreateTerminal(
    sessionId: string,
    cwd: string,
    title: string,
    launchConfig?: TerminalEngineLaunchConfig,
  ): Promise<TerminalEngineInstance> {
    const existing = this.terminals.get(sessionId);
    if (existing) {
      return existing;
    }

    const instance = new HyperTerminalEngineInstance(
      sessionId,
      cwd,
      title,
      launchConfig,
      () => {
        this.terminals.delete(sessionId);
      },
    );

    const pending = (async () => {
      try {
        await instance.start();
        return instance;
      } catch (error) {
        instance.dispose();
        this.terminals.delete(sessionId);
        throw error;
      }
    })();

    this.terminals.set(sessionId, pending);
    return pending;
  }
}

let engineSingleton: HyperTerminalEngine | null = null;

export function getHyperTerminalEngine(): TerminalEngine {
  engineSingleton ??= new HyperTerminalEngine();
  return engineSingleton;
}
