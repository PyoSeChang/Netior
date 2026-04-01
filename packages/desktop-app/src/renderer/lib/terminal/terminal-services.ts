import { getService, initialize, ITerminalConfigurationService, ITerminalService, TerminalLocation } from '@codingame/monaco-vscode-api/services';
import getConfigurationServiceOverride, { initUserConfiguration, updateUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override';
// keybindings service intentionally removed — it intercepts Ctrl+C/V/F/+/- etc.
// MoC handles all terminal keyboard shortcuts independently.
import getTerminalServiceOverride, { type ITerminalService as TerminalServiceType } from '@codingame/monaco-vscode-terminal-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import type { ICreateTerminalOptions } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import { getTerminalBackend, SESSION_ENV_KEY } from './terminal-backend';

interface TerminalDomRoots {
  workbench: HTMLDivElement;
  panel: HTMLDivElement;
  terminal: HTMLDivElement;
}

const terminalInstances = new Map<string, Promise<ITerminalInstance>>();

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
let currentFontSize = DEFAULT_FONT_SIZE;
let initializePromise: Promise<void> | null = null;
let roots: TerminalDomRoots | null = null;
let themeObserver: MutationObserver | null = null;

function getCssColorAsHex(property: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;

  const el = document.createElement('div');
  el.style.color = raw;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return fallback;

  const [, r, g, b] = match;
  return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`;
}

function withAlpha(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}

function buildTerminalUserConfiguration(): string {
  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';
  const background = getCssColorAsHex('--surface-panel', isDark ? '#141414' : '#fbfbfb');
  const foreground = getCssColorAsHex('--text-default', isDark ? '#d4d4d4' : '#1f2328');
  const muted = getCssColorAsHex('--text-muted', isDark ? '#8b949e' : '#6b7280');
  const border = getCssColorAsHex('--border-default', isDark ? '#30363d' : '#d0d7de');
  const accent = getCssColorAsHex('--accent', isDark ? '#2f81f7' : '#0969da');
  const accentHover = getCssColorAsHex('--accent-hover', accent);
  const selection = withAlpha(accent, isDark ? '33' : '22');
  const inactiveSelection = withAlpha(muted, isDark ? '2e' : '1f');
  const scrollbar = withAlpha(border, isDark ? '44' : '33');
  const scrollbarHover = withAlpha(muted, isDark ? '66' : '55');
  const scrollbarActive = withAlpha(accentHover, isDark ? '88' : '77');

  return JSON.stringify({
    'terminal.integrated.defaultLocation': 'editor',
    'terminal.integrated.fontFamily': "'Cascadia Code', 'Consolas', 'Courier New', monospace",
    'terminal.integrated.fontSize': currentFontSize,
    'terminal.integrated.lineHeight': 1.25,
    'terminal.integrated.letterSpacing': 0.2,
    'terminal.integrated.gpuAcceleration': 'auto',
    'terminal.integrated.enablePersistentSessions': false,
    'terminal.integrated.shellIntegration.enabled': true,
    'terminal.integrated.cursorBlinking': true,
    'terminal.integrated.smoothScrolling': true,
    'terminal.integrated.minimumContrastRatio': 4.5,
    'workbench.colorCustomizations': {
      'terminal.background': background,
      'terminal.foreground': foreground,
      'terminalCursor.foreground': foreground,
      'terminalCursor.background': background,
      'terminal.selectionBackground': selection,
      'terminal.inactiveSelectionBackground': inactiveSelection,
      'terminal.border': '#00000000',
      'terminal.dropBackground': withAlpha(accent, isDark ? '26' : '1a'),
      'terminal.tab.activeBorder': accent,
      'terminal.tab.activeBorderTop': accent,
      'terminal.tab.activeForeground': foreground,
      'terminal.tab.inactiveForeground': muted,
      'terminalCommandDecoration.defaultBackground': accent,
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': scrollbar,
      'scrollbarSlider.hoverBackground': scrollbarHover,
      'scrollbarSlider.activeBackground': scrollbarActive,
      'editor.background': background,
      'panel.background': background,
      'terminal.findMatchBackground': withAlpha(accent, isDark ? '44' : '33'),
      'terminal.findMatchHighlightBackground': withAlpha(accent, isDark ? '22' : '18'),
      'terminal.findMatchBorder': accent,
      'terminal.findMatchHighlightBorder': withAlpha(accent, isDark ? '66' : '44'),
    },
  });
}

async function applyTerminalThemeConfiguration(): Promise<void> {
  await updateUserConfiguration(buildTerminalUserConfiguration());
}

function ensureDomRoots(): TerminalDomRoots {
  if (roots) return roots;

  const workbench = document.createElement('div');
  workbench.id = 'moc-terminal-workbench';
  Object.assign(workbench.style, {
    position: 'fixed',
    inset: '0',
    width: '0',
    height: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    opacity: '0',
    zIndex: '-1',
  });

  const panel = document.createElement('div');
  panel.id = 'moc-terminal-panel';

  const terminal = document.createElement('div');
  terminal.id = 'moc-terminal-container';
  Object.assign(terminal.style, {
    width: '100%',
    height: '100%',
    background: 'transparent',
  });

  workbench.append(panel, terminal);
  document.body.appendChild(workbench);
  roots = { workbench, panel, terminal };
  return roots;
}

export async function ensureTerminalServices(): Promise<void> {
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    const domRoots = ensureDomRoots();
    const backend = getTerminalBackend();

    await initUserConfiguration(buildTerminalUserConfiguration());

    await initialize(
      {
        ...getConfigurationServiceOverride(),
        ...getThemeServiceOverride(),
        ...getTerminalServiceOverride(backend),
      },
      domRoots.workbench,
    );

    backend.setReady();

    const terminalService = await getService(ITerminalService);
    const terminalConfigurationService = await getService(ITerminalConfigurationService);
    terminalService.setContainers(domRoots.panel, domRoots.terminal);
    terminalConfigurationService.setPanelContainer(domRoots.panel);

    if (!themeObserver) {
      themeObserver = new MutationObserver(() => {
        void applyTerminalThemeConfiguration();
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-mode', 'data-concept'],
      });
    }
  })();

  return initializePromise;
}

function getDefaultExecutable(): string {
  return window.electron.terminal.getWindowsBuildNumber() != null
    ? 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
    : '/bin/bash';
}

function getDefaultArgs(): string[] | undefined {
  return window.electron.terminal.getWindowsBuildNumber() != null ? ['-NoLogo'] : undefined;
}

function makeCreateOptions(sessionId: string, cwd: string, title: string): ICreateTerminalOptions {
  return {
    cwd,
    location: TerminalLocation.Editor,
    config: {
      cwd,
      name: title,
      executable: getDefaultExecutable(),
      args: getDefaultArgs(),
      env: {
        [SESSION_ENV_KEY]: sessionId,
      },
      type: 'Local',
    },
  };
}

export async function getTerminalService(): Promise<TerminalServiceType> {
  await ensureTerminalServices();
  return getService(ITerminalService);
}

export async function getOrCreateTerminalInstance(
  sessionId: string,
  cwd: string,
  title: string,
): Promise<ITerminalInstance> {
  const existing = terminalInstances.get(sessionId);
  if (existing) return existing;

  const pending = (async () => {
    const terminalService = await getTerminalService();
    const instance = await terminalService.createTerminal(makeCreateOptions(sessionId, cwd, title));

    instance.onDisposed(() => {
      terminalInstances.delete(sessionId);
    });
    instance.onExit(() => {
      terminalInstances.delete(sessionId);
    });

    return instance;
  })();

  terminalInstances.set(sessionId, pending);

  try {
    return await pending;
  } catch (error) {
    terminalInstances.delete(sessionId);
    throw error;
  }
}

export function adjustTerminalFontSize(delta: number): void {
  currentFontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, currentFontSize + delta));
  void updateUserConfiguration(buildTerminalUserConfiguration());
}

export function resetTerminalFontSize(): void {
  currentFontSize = DEFAULT_FONT_SIZE;
  void updateUserConfiguration(buildTerminalUserConfiguration());
}
