import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import { getOrCreateTerminalInstance } from '../terminal-services';
import type {
  TerminalEngine,
  TerminalEngineInstance,
  TerminalEngineLaunchConfig,
  TerminalRawXterm,
  TerminalSearchController,
} from './terminal-engine';

class VscodeTerminalEngineInstance implements TerminalEngineInstance {
  readonly kind = 'vscode' as const;

  constructor(private readonly instance: ITerminalInstance) {}

  get title(): string {
    return this.instance.title;
  }

  attachToElement(element: HTMLElement): void {
    this.instance.attachToElement(element);
  }

  detachFromElement(): void {
    this.instance.detachFromElement();
  }

  setVisible(visible: boolean): void {
    this.instance.setVisible(visible);
  }

  layout(dimensions: { width: number; height: number }): void {
    this.instance.layout(dimensions);
  }

  onTitleChanged(listener: () => void): { dispose(): void } {
    return this.instance.onTitleChanged(listener);
  }

  focusWhenReady(): Promise<void> {
    return this.instance.focusWhenReady();
  }

  scrollUpPage(): void {
    this.instance.scrollUpPage();
  }

  scrollDownPage(): void {
    this.instance.scrollDownPage();
  }

  hasSelection(): boolean {
    return this.instance.hasSelection();
  }

  copySelection(): void {
    (this.instance as unknown as { xterm?: { copySelection(): void } }).xterm?.copySelection();
  }

  async sendText(text: string, shouldExecute: boolean, bracketedPasteMode: boolean): Promise<void> {
    await this.instance.sendText(text, shouldExecute, bracketedPasteMode);
  }

  getSelection(): string {
    const instance = this.instance as unknown as {
      getSelection?(): string;
      xterm?: { getSelection?(): string };
    };
    return instance.getSelection?.() ?? instance.xterm?.getSelection?.() ?? '';
  }

  getSearchController(): TerminalSearchController | undefined {
    return (this.instance as unknown as { xterm?: TerminalSearchController }).xterm;
  }

  getRawXterm(): TerminalRawXterm | undefined {
    return (this.instance as unknown as { xterm?: { raw?: TerminalRawXterm } }).xterm?.raw;
  }

  disableBuiltinLinkHandling(): void {
    const contribution = (this.instance as unknown as {
      getContribution?(id: string): { dispose?(): void } | undefined;
    }).getContribution?.('terminal.link');

    contribution?.dispose?.();
  }
}

class VscodeTerminalEngine implements TerminalEngine {
  readonly kind = 'vscode' as const;

  async getOrCreateTerminal(
    sessionId: string,
    cwd: string,
    title: string,
    launchConfig?: TerminalEngineLaunchConfig,
  ): Promise<TerminalEngineInstance> {
    const instance = await getOrCreateTerminalInstance(sessionId, cwd, title, launchConfig);
    return new VscodeTerminalEngineInstance(instance);
  }
}

let engineSingleton: VscodeTerminalEngine | null = null;

export function getVscodeTerminalEngine(): TerminalEngine {
  engineSingleton ??= new VscodeTerminalEngine();
  return engineSingleton;
}
