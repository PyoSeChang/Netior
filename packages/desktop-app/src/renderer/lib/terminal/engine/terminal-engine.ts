export interface TerminalEngineLaunchConfig {
  shell?: string;
  args?: string[];
  agent?: {
    provider: 'claude' | 'codex';
    remoteUrl?: string;
  };
}

export interface TerminalFindResult {
  resultIndex: number;
  resultCount: number;
}

export interface TerminalSearchController {
  findNext(term: string, opts: { incremental?: boolean }): Promise<boolean>;
  findPrevious(term: string, opts: { incremental?: boolean }): Promise<boolean>;
  clearSearchDecorations(): void;
  clearActiveSearchDecoration(): void;
  findResult?: TerminalFindResult;
  onDidChangeFindResults?: (listener: (result: TerminalFindResult) => void) => { dispose(): void };
}

export interface TerminalBufferLine {
  translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
  isWrapped?: boolean;
  getCell?(x: number): { getWidth(): number } | undefined;
}

export interface TerminalRawXterm {
  element?: HTMLElement;
  textarea?: HTMLTextAreaElement | null;
  cols?: number;
  rows?: number;
  modes?: {
    bracketedPasteMode?: boolean;
  };
  dimensions?: { css?: { cell?: { width?: number; height?: number } } };
  _core?: {
    _renderService?: {
      dimensions?: {
        actualCellWidth?: number;
        actualCellHeight?: number;
      };
    };
  };
  buffer: {
    active: {
      viewportY: number;
      length: number;
      getLine(bufferLineIndex: number): TerminalBufferLine | undefined;
    };
  };
}

export interface TerminalLayoutDimensions {
  width: number;
  height: number;
}

export interface TerminalEngineInstance {
  readonly kind: 'hyper';
  readonly title: string;
  attachToElement(element: HTMLElement): void;
  detachFromElement(): void;
  setVisible(visible: boolean): void;
  layout(dimensions: TerminalLayoutDimensions): void;
  onTitleChanged(listener: () => void): { dispose(): void };
  focusWhenReady(): Promise<void>;
  scrollUpPage(): void;
  scrollDownPage(): void;
  hasSelection(): boolean;
  copySelection(): void;
  sendText(text: string, shouldExecute: boolean, bracketedPasteMode: boolean): Promise<void>;
  getSelection(): string;
  getSearchController(): TerminalSearchController | undefined;
  getRawXterm(): TerminalRawXterm | undefined;
}

export interface TerminalEngine {
  readonly kind: 'hyper';
  getOrCreateTerminal(
    sessionId: string,
    cwd: string,
    title: string,
    launchConfig?: TerminalEngineLaunchConfig,
  ): Promise<TerminalEngineInstance>;
}
