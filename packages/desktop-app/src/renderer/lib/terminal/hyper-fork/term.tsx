import React from 'react';
import { Terminal, type IDisposable, type ITerminalOptions } from 'xterm';
import { CanvasAddon } from 'xterm-addon-canvas';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { WebglAddon } from 'xterm-addon-webgl';
import type {
  TerminalEngineLaunchConfig,
  TerminalFindResult,
  TerminalRawXterm,
  TerminalSearchController,
} from '../engine/terminal-engine';
import type { TerminalAppearanceSnapshot } from './terminal-appearance';

type DisposableLike = IDisposable | { dispose(): void };

interface SearchDecorationOptions {
  matchBackground?: string;
  matchBorder?: string;
  matchOverviewRuler: string;
  activeMatchBackground?: string;
  activeMatchBorder?: string;
  activeMatchColorOverviewRuler: string;
}

export interface ForkedHyperTermHandle {
  focus(): void;
  fitResize(): void;
  write(data: string | Uint8Array): void;
  scrollUpPage(): void;
  scrollDownPage(): void;
  hasSelection(): boolean;
  copySelection(): void;
  paste(text: string): void;
  getSelection(): string;
  getSearchController(): TerminalSearchController;
  getRawXterm(): TerminalRawXterm;
}

interface ForkedHyperTermProps {
  uid: string;
  appearance: TerminalAppearanceSnapshot;
  launchConfig?: TerminalEngineLaunchConfig;
  isTermActive: boolean;
  isTermVisible: boolean;
  onData(data: string): void;
  onResize(cols: number, rows: number): void;
  onTitle?(title: string): void;
  onActive(): void;
}

const isWebgl2Supported = (() => {
  let isSupported: boolean | undefined = window.WebGL2RenderingContext ? undefined : false;
  return (): boolean => {
    if (isSupported === undefined) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { depth: false, antialias: false });
      isSupported = gl instanceof window.WebGL2RenderingContext;
    }
    return isSupported;
  };
})();

function isEqualOptionValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left == null || right == null) return false;
  if (typeof left !== 'object' || typeof right !== 'object') return false;

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function getChangedTerminalOptions(
  current: ITerminalOptions,
  next: ITerminalOptions,
): Partial<ITerminalOptions> {
  const changed: Partial<ITerminalOptions> = {};

  for (const [key, value] of Object.entries(next) as [keyof ITerminalOptions, ITerminalOptions[keyof ITerminalOptions]][]) {
    if (!isEqualOptionValue(current[key], value)) {
      (changed as Record<string, unknown>)[key as string] = value;
    }
  }

  return changed;
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

function buildTerminalOptions(
  appearance: TerminalAppearanceSnapshot,
  launchConfig?: TerminalEngineLaunchConfig,
): ITerminalOptions {
  const buildNumber = window.electron.terminal.getWindowsBuildNumber();

  return {
    allowProposedApi: true,
    cursorBlink: appearance.cursorBlink,
    cursorStyle: 'block',
    fontFamily: appearance.fontFamily,
    fontSize: appearance.fontSize,
    lineHeight: appearance.lineHeight,
    letterSpacing: appearance.letterSpacing,
    scrollback: 10_000,
    windowsMode: buildNumber != null,
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
    disableStdin: false,
    allowTransparency: false,
    overviewRulerWidth: 20,
    screenReaderMode: false,
    macOptionIsMeta: launchConfig?.agent?.provider === 'codex' ? false : undefined,
  };
}

class ForkedHyperSearchController implements TerminalSearchController {
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

export class ForkedHyperTerm extends React.PureComponent<ForkedHyperTermProps> implements ForkedHyperTermHandle {
  private termWrapperRef: HTMLDivElement | null = null;
  private readonly termRef = document.createElement('div');
  private readonly fitAddon = new FitAddon();
  private readonly searchAddon = new SearchAddon();
  private readonly canvasAddon = new CanvasAddon();
  private readonly unicode11Addon = new Unicode11Addon();
  private rendererAddon: CanvasAddon | WebglAddon | null = null;
  private readonly searchController = new ForkedHyperSearchController(
    this.searchAddon,
    () => buildSearchDecorations(this.props.appearance),
  );
  private readonly disposables: DisposableLike[] = [];
  private readonly term: Terminal;
  private termOptions: ITerminalOptions;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimeout: number | null = null;
  private renderAddonsLoaded = false;

  constructor(props: ForkedHyperTermProps) {
    super(props);
    this.termOptions = buildTerminalOptions(props.appearance, props.launchConfig);
    this.term = new Terminal(this.termOptions);
    this.termRef.className = 'term_fit term_term';
    Object.assign(this.termRef.style, {
      width: '100%',
      height: '100%',
    });
  }

  componentDidMount(): void {
    this.term.attachCustomKeyEventHandler(this.keyboardHandler);
    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(this.searchAddon);

    this.disposables.push(this.term.onData((data) => {
      this.props.onData(data);
    }));
    this.disposables.push(this.term.onResize(({ cols, rows }) => {
      this.props.onResize(cols, rows);
    }));
    if (this.props.onTitle) {
      this.disposables.push(this.term.onTitleChange((title) => {
        this.props.onTitle?.(title);
      }));
    }
    this.disposables.push(this.searchAddon.onDidChangeResults((result) => {
      this.searchController.findResult = result;
    }));
    this.disposables.push(this.addWindowPasteHandler());

    if (this.termWrapperRef) {
      this.termWrapperRef.appendChild(this.termRef);
    }

    this.term.open(this.termRef);
    this.ensureRenderAddons();
    this.markInteractiveElements();
    this.applyPadding();
    this.observeWrapper();
    this.fitResize();

    if (this.props.isTermActive) {
      this.term.focus();
    }

    this.term.textarea?.addEventListener('focus', this.handleActive);
    this.disposables.push({
      dispose: () => this.term.textarea?.removeEventListener('focus', this.handleActive),
    });

    this.props.onResize(this.term.cols, this.term.rows);
  }

  componentDidUpdate(prevProps: ForkedHyperTermProps): void {
    const nextOptions = buildTerminalOptions(this.props.appearance, this.props.launchConfig);
    const changedOptions = getChangedTerminalOptions(this.termOptions, nextOptions);
    const fontMetricsChanged =
      this.props.appearance.fontSize !== prevProps.appearance.fontSize
      || this.props.appearance.fontFamily !== prevProps.appearance.fontFamily
      || this.props.appearance.lineHeight !== prevProps.appearance.lineHeight
      || this.props.appearance.letterSpacing !== prevProps.appearance.letterSpacing;

    if (Object.keys(changedOptions).length > 0) {
      this.term.options = changedOptions;
      this.termOptions = nextOptions;
    }

    if (this.props.appearance.padding !== prevProps.appearance.padding) {
      this.applyPadding();
    }

    if ((this.props.isTermVisible && !prevProps.isTermVisible) || fontMetricsChanged) {
      this.fitResize();
    }

    if (this.props.isTermActive && !prevProps.isTermActive) {
      this.term.focus();
    }
  }

  componentWillUnmount(): void {
    if (this.resizeTimeout != null) {
      window.clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.termWrapperRef?.removeChild(this.termRef);
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
    this.term.dispose();
  }

  focus(): void {
    this.term.focus();
  }

  fitResize(): void {
    if (!this.props.isTermVisible) return;
    this.fitAddon.fit();
  }

  write(data: string | Uint8Array): void {
    this.term.write(data);
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

  paste(text: string): void {
    this.term.paste(text);
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

  render(): JSX.Element {
    return (
      <div
        className={this.props.isTermActive ? 'term_fit term_active' : 'term_fit'}
        data-netior-terminal-host="true"
        data-netior-terminal-session={this.props.uid}
        style={{
          display: this.props.isTermVisible ? 'block' : 'none',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          ref={this.onTermWrapperRef}
          className="term_fit term_wrapper"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        />
      </div>
    );
  }

  private ensureRenderAddons(): void {
    if (this.renderAddonsLoaded) return;

    if (this.props.appearance.webGLRenderer && isWebgl2Supported()) {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        this.rendererAddon?.dispose();
        this.rendererAddon = this.canvasAddon;
        this.term.loadAddon(this.canvasAddon);
      });
      this.rendererAddon = webglAddon;
      this.term.loadAddon(webglAddon);
    } else {
      this.rendererAddon = this.canvasAddon;
      this.term.loadAddon(this.canvasAddon);
    }

    this.term.loadAddon(this.unicode11Addon);
    this.term.unicode.activeVersion = '11';
    this.renderAddonsLoaded = true;
  }

  private applyPadding(): void {
    if (!this.term.element) return;
    this.term.element.style.padding = this.props.appearance.padding;
  }

  private observeWrapper(): void {
    if (!this.termWrapperRef || this.resizeObserver) return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimeout != null) {
        window.clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = window.setTimeout(() => {
        this.fitResize();
      }, 500);
    });
    this.resizeObserver.observe(this.termWrapperRef);
  }

  private markInteractiveElements(): void {
    const textarea = this.term.textarea;
    if (!textarea) return;
    textarea.dataset.netiorTerminalInput = 'true';
    textarea.spellcheck = false;
  }

  private addWindowPasteHandler(): DisposableLike {
    const handlePaste = (event: ClipboardEvent): void => {
      if (!this.props.isTermActive) return;
      if (document.activeElement !== this.term.textarea) return;
      const text = event.clipboardData?.getData('text');
      if (!text) return;
      event.preventDefault();
      event.stopPropagation();
      this.term.paste(text);
    };

    window.addEventListener('paste', handlePaste, { capture: true });
    return {
      dispose(): void {
        window.removeEventListener('paste', handlePaste, { capture: true });
      },
    };
  }

  private readonly handleActive = (): void => {
    this.props.onActive();
  };

  private readonly keyboardHandler = (event: KeyboardEvent & { catched?: boolean }): boolean => !event.catched;

  private readonly onTermWrapperRef = (node: HTMLDivElement | null): void => {
    this.termWrapperRef = node;
  };
}
