import { getService, initialize, ITerminalConfigurationService, ITerminalService, TerminalLocation } from '@codingame/monaco-vscode-api/services';
import getConfigurationServiceOverride, { initUserConfiguration, updateUserConfiguration } from '@codingame/monaco-vscode-configuration-service-override';
// keybindings service intentionally removed — it intercepts Ctrl+C/V/F/+/- etc.
// Netior handles all terminal keyboard shortcuts independently.
import getTerminalServiceOverride, { type ITerminalService as TerminalServiceType } from '@codingame/monaco-vscode-terminal-service-override';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import type { ICreateTerminalOptions } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import type { TerminalLaunchConfig } from '@netior/shared/types';
import {
  AGENT_PROVIDER_ENV_KEY,
  AGENT_REMOTE_URL_ENV_KEY,
  getTerminalBackend,
  SESSION_ENV_KEY,
} from './terminal-backend';

interface TerminalDomRoots {
  workbench: HTMLDivElement;
  panel: HTMLDivElement;
  terminal: HTMLDivElement;
}

export interface TerminalAppearanceSnapshot {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  minimumContrastRatio: number;
  cursorBlink: boolean;
  colors: {
    background: string;
    foreground: string;
    muted: string;
    border: string;
    accent: string;
    accentHover: string;
    selection: string;
    inactiveSelection: string;
    scrollbar: string;
    scrollbarHover: string;
    scrollbarActive: string;
    findMatchBackground: string;
    findMatchHighlightBackground: string;
    findMatchBorder: string;
    findMatchHighlightBorder: string;
  };
}

const terminalInstances = new Map<string, Promise<ITerminalInstance>>();
const terminalAppearanceListeners = new Set<(snapshot: TerminalAppearanceSnapshot) => void>();

const DEFAULT_FONT_SIZE = 13;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 28;
const TERMINAL_FONT_FAMILY = "'Cascadia Code', 'Consolas', 'Courier New', monospace";
const TERMINAL_LINE_HEIGHT = 1.25;
const TERMINAL_LETTER_SPACING = 0.2;
const TERMINAL_MINIMUM_CONTRAST_RATIO = 4.5;
let currentFontSize = DEFAULT_FONT_SIZE;
let initializePromise: Promise<void> | null = null;
let roots: TerminalDomRoots | null = null;
let themeObserver: MutationObserver | null = null;
let cachedAppearanceSnapshot: TerminalAppearanceSnapshot | null = null;

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

function buildTerminalAppearanceSnapshot(): TerminalAppearanceSnapshot {
  const isDark = document.documentElement.getAttribute('data-mode') !== 'light';
  const background = getCssColorAsHex('--surface-editor', isDark ? '#242424' : '#f5f5f5');
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

  return {
    fontFamily: TERMINAL_FONT_FAMILY,
    fontSize: currentFontSize,
    lineHeight: TERMINAL_LINE_HEIGHT,
    letterSpacing: TERMINAL_LETTER_SPACING,
    minimumContrastRatio: TERMINAL_MINIMUM_CONTRAST_RATIO,
    cursorBlink: true,
    colors: {
      background,
      foreground,
      muted,
      border,
      accent,
      accentHover,
      selection,
      inactiveSelection,
      scrollbar,
      scrollbarHover,
      scrollbarActive,
      findMatchBackground: withAlpha(accent, isDark ? '44' : '33'),
      findMatchHighlightBackground: withAlpha(accent, isDark ? '22' : '18'),
      findMatchBorder: accent,
      findMatchHighlightBorder: withAlpha(accent, isDark ? '66' : '44'),
    },
  };
}

function ensureTerminalThemeObserver(): void {
  if (themeObserver || typeof document === 'undefined') return;

  themeObserver = new MutationObserver(() => {
    cachedAppearanceSnapshot = null;
    if (initializePromise) {
      void applyTerminalThemeConfiguration();
    }
    const snapshot = getTerminalAppearanceSnapshot();
    for (const listener of terminalAppearanceListeners) {
      listener(snapshot);
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-concept', 'data-theme-variant', 'style'],
  });
}

function buildTerminalUserConfiguration(): string {
  const appearance = getTerminalAppearanceSnapshot();

  return JSON.stringify({
    'terminal.integrated.defaultLocation': 'view',
    'terminal.integrated.fontFamily': appearance.fontFamily,
    'terminal.integrated.fontSize': appearance.fontSize,
    'terminal.integrated.lineHeight': appearance.lineHeight,
    'terminal.integrated.letterSpacing': appearance.letterSpacing,
    'terminal.integrated.gpuAcceleration': 'auto',
    'terminal.integrated.enablePersistentSessions': false,
    'terminal.integrated.shellIntegration.enabled': true,
    'terminal.integrated.sendKeybindingsToShell': true,
    'terminal.integrated.allowChords': false,
    'terminal.integrated.commandsToSkipShell': [
      '-workbench.action.togglePanel',
    ],
    'terminal.integrated.cursorBlinking': appearance.cursorBlink,
    'terminal.integrated.smoothScrolling': true,
    'terminal.integrated.minimumContrastRatio': appearance.minimumContrastRatio,
    'terminal.integrated.showDimensions': false,
    'workbench.colorCustomizations': {
      'terminal.background': appearance.colors.background,
      'terminal.foreground': appearance.colors.foreground,
      'terminalCursor.foreground': appearance.colors.foreground,
      'terminalCursor.background': appearance.colors.background,
      'terminal.selectionBackground': appearance.colors.selection,
      'terminal.inactiveSelectionBackground': appearance.colors.inactiveSelection,
      'terminal.border': '#00000000',
      'terminal.dropBackground': withAlpha(appearance.colors.accent, '26'),
      'terminal.tab.activeBorder': appearance.colors.accent,
      'terminal.tab.activeBorderTop': appearance.colors.accent,
      'terminal.tab.activeForeground': appearance.colors.foreground,
      'terminal.tab.inactiveForeground': appearance.colors.muted,
      'terminalCommandDecoration.defaultBackground': appearance.colors.accent,
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': appearance.colors.scrollbar,
      'scrollbarSlider.hoverBackground': appearance.colors.scrollbarHover,
      'scrollbarSlider.activeBackground': appearance.colors.scrollbarActive,
      'editor.background': appearance.colors.background,
      'panel.background': appearance.colors.background,
      'terminal.findMatchBackground': appearance.colors.findMatchBackground,
      'terminal.findMatchHighlightBackground': appearance.colors.findMatchHighlightBackground,
      'terminal.findMatchBorder': appearance.colors.findMatchBorder,
      'terminal.findMatchHighlightBorder': appearance.colors.findMatchHighlightBorder,
    },
  });
}

async function applyTerminalThemeConfiguration(): Promise<void> {
  await updateUserConfiguration(buildTerminalUserConfiguration());
}

export function getTerminalAppearanceSnapshot(): TerminalAppearanceSnapshot {
  ensureTerminalThemeObserver();
  cachedAppearanceSnapshot ??= buildTerminalAppearanceSnapshot();
  return cachedAppearanceSnapshot;
}

export function onTerminalAppearanceChanged(
  listener: (snapshot: TerminalAppearanceSnapshot) => void,
): { dispose(): void } {
  ensureTerminalThemeObserver();
  terminalAppearanceListeners.add(listener);
  return {
    dispose(): void {
      terminalAppearanceListeners.delete(listener);
    },
  };
}

function ensureDomRoots(): TerminalDomRoots {
  if (roots) return roots;

  const workbench = document.createElement('div');
  workbench.id = 'netior-terminal-workbench';
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
  panel.id = 'netior-terminal-panel';

  const terminal = document.createElement('div');
  terminal.id = 'netior-terminal-container';
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
    ensureTerminalThemeObserver();
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

function makeCreateOptions(
  sessionId: string,
  cwd: string,
  title: string,
  launchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>,
): ICreateTerminalOptions {
  const env: Record<string, string> = {
    [SESSION_ENV_KEY]: sessionId,
  };

  if (launchConfig?.agent?.provider) {
    env[AGENT_PROVIDER_ENV_KEY] = launchConfig.agent.provider;
  }
  if (launchConfig?.agent?.remoteUrl) {
    env[AGENT_REMOTE_URL_ENV_KEY] = launchConfig.agent.remoteUrl;
  }

  return {
    cwd,
    location: TerminalLocation.Panel,
    config: {
      cwd,
      name: title,
      executable: launchConfig?.shell ?? getDefaultExecutable(),
      args: launchConfig?.args ?? getDefaultArgs(),
      env,
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
  launchConfig?: Pick<TerminalLaunchConfig, 'shell' | 'args' | 'agent'>,
): Promise<ITerminalInstance> {
  const existing = terminalInstances.get(sessionId);
  if (existing) return existing;

  const pending = (async () => {
    const terminalService = await getTerminalService();
    const instance = await terminalService.createTerminal(makeCreateOptions(sessionId, cwd, title, launchConfig));

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
  cachedAppearanceSnapshot = null;
  if (initializePromise) {
    void updateUserConfiguration(buildTerminalUserConfiguration());
  }
  const snapshot = getTerminalAppearanceSnapshot();
  for (const listener of terminalAppearanceListeners) {
    listener(snapshot);
  }
}

export function resetTerminalFontSize(): void {
  currentFontSize = DEFAULT_FONT_SIZE;
  cachedAppearanceSnapshot = null;
  if (initializePromise) {
    void updateUserConfiguration(buildTerminalUserConfiguration());
  }
  const snapshot = getTerminalAppearanceSnapshot();
  for (const listener of terminalAppearanceListeners) {
    listener(snapshot);
  }
}
