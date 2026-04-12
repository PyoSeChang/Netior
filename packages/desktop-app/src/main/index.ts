import { app, shell, BrowserWindow, ipcMain, Menu, Notification, nativeImage, screen } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { mkdirSync, existsSync } from 'fs';
import { registerAllIpc } from './ipc';
import { ptyManager } from './pty/pty-manager';
import { stopNarreServer } from './process/narre-server-manager';
import { startNetiorService, stopNetiorService } from './process/netior-service-manager';
import { agentRuntimeManager } from './agent-runtime/agent-runtime-manager';
import { getConfiguredNarreProvider, syncNarreServerWithSettings } from './narre/narre-config';
import { getRemoteConfig, setRemoteConfig } from './netior-service/netior-service-client';
import { initMainLogging } from './logging';
import {
  getNetiorServicePort,
  getRuntimeInstanceId,
  getRuntimeScope,
  getRuntimeSessionDataDir,
  getSharedUserDataRoot,
} from './runtime/runtime-paths';
import {
  registerDesktopRuntimeInstance,
  unregisterDesktopRuntimeInstance,
} from './runtime/runtime-coordination';

// Force userData to %APPDATA%/netior
app.name = 'Netior';
app.setPath('userData', getSharedUserDataRoot());
app.setPath('sessionData', getRuntimeSessionDataDir());
const desktopMainLogFilePath = initMainLogging();
console.log(`[desktop-main] Runtime scope: ${getRuntimeScope()}`);
console.log(`[desktop-main] Runtime instance: ${getRuntimeInstanceId()}`);
console.log(`[desktop-main] Log file: ${desktopMainLogFilePath}`);
registerDesktopRuntimeInstance();

function getNotificationIcon() {
  const candidates = [
    join(app.getAppPath(), 'build/icons/netior-app-icon.png'),
    join(app.getAppPath(), '../build/icons/netior-app-icon.png'),
    join(process.cwd(), 'build/icons/netior-app-icon.png'),
    join(process.cwd(), 'packages/desktop-app/build/icons/netior-app-icon.png'),
    join(__dirname, '../../build/icons/netior-app-icon.png'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const icon = nativeImage.createFromPath(candidate);
    if (!icon.isEmpty()) return icon;
  }

  return undefined;
}

let mainWindow: BrowserWindow | null = null;
const detachedWindows = new Map<string, BrowserWindow>();

interface StoredWindowBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
  displayId?: number;
}

function focusMainWindow(reason: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  console.log(`[main-window] Focusing main window (${reason})`);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
}

function sendWindowMaximizedState(win: BrowserWindow): void {
  win.webContents.send('window:maximized-changed', win.isMaximized());
}

function attachWindowStateEvents(win: BrowserWindow): void {
  win.on('maximize', () => sendWindowMaximizedState(win));
  win.on('unmaximize', () => sendWindowMaximizedState(win));
  win.on('enter-full-screen', () => sendWindowMaximizedState(win));
  win.on('leave-full-screen', () => sendWindowMaximizedState(win));
}

async function loadWindowBounds(): Promise<StoredWindowBounds> {
  const raw = await withTimeout(
    getRemoteConfig('windowBounds'),
    1000,
    null,
    'loadWindowBounds',
  );
  if (raw) {
    try {
      const parsed = typeof raw === 'string'
        ? JSON.parse(raw)
        : raw;
      return resolveStoredWindowBounds(parsed);
    } catch { /* use defaults */ }
  }
  return resolveStoredWindowBounds(null);
}

async function saveWindowBounds(win: BrowserWindow): Promise<void> {
  const isMaximized = win.isMaximized();
  const currentBounds = win.getBounds();
  const activeDisplay = screen.getDisplayMatching(currentBounds);
  // Save normal (non-maximized) bounds for restore size/position, but pair it with the
  // actual display that was active when the window closed.
  const bounds = isMaximized ? (win as any)._lastNormalBounds ?? win.getNormalBounds() : currentBounds;
  await withTimeout(
    setRemoteConfig('windowBounds', JSON.stringify({
      ...bounds,
      isMaximized,
      displayId: activeDisplay.id,
    } satisfies StoredWindowBounds)),
    1000,
    false,
    'saveWindowBounds',
  );
}

async function createWindow(): Promise<void> {
  const saved = await loadWindowBounds();

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  attachWindowStateEvents(mainWindow);

  if (saved.isMaximized) {
    mainWindow.maximize();
  }

  let shown = false;
  const showMainWindow = (reason: string) => {
    if (!mainWindow || mainWindow.isDestroyed() || shown) {
      return;
    }

    shown = true;
    console.log(`[main-window] Showing main window (${reason})`);
    mainWindow.show();
    sendWindowMaximizedState(mainWindow);
  };
  const showTimeout = setTimeout(() => {
    showMainWindow('startup-timeout');
  }, 2000);

  // Track normal bounds for save when maximized
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      (mainWindow as any)._lastNormalBounds = mainWindow.getBounds();
    }
  });
  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      (mainWindow as any)._lastNormalBounds = mainWindow.getBounds();
    }
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      void saveWindowBounds(mainWindow);
    }
  });
  mainWindow.on('closed', () => {
    clearTimeout(showTimeout);
    mainWindow = null;
  });

  mainWindow.once('ready-to-show', () => showMainWindow('ready-to-show'));
  mainWindow.webContents.once('did-finish-load', () => showMainWindow('did-finish-load'));
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main-window] did-fail-load', { errorCode, errorDescription, validatedURL });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main-window] render-process-gone', details);
  });
  mainWindow.on('unresponsive', () => {
    console.error('[main-window] unresponsive');
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Intercept app-level shortcuts before terminal/editor layers consume them
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const hasPrimaryModifier = input.control || input.meta;
    if (hasPrimaryModifier && input.type === 'keyDown') {
      if (!input.alt && input.key === 'Tab') {
        event.preventDefault();
        mainWindow!.webContents.send('app:shortcut', input.shift ? 'previousTab' : 'nextTab');
        return;
      }

      if (!input.alt && !input.shift && /^[1-9]$/.test(input.key)) {
        event.preventDefault();
        mainWindow!.webContents.send('app:shortcut', `openTabByIndex:${input.key}`);
        return;
      }

      if (!input.alt && (input.key === '-' || input.key === '=' || input.key === '+' || input.key === '0')) {
        event.preventDefault();
        mainWindow!.webContents.send('terminal:font-size', input.key);
        return;
      }

      if (!input.alt && !input.shift && input.key === '.') {
        event.preventDefault();
        mainWindow!.webContents.send('app:shortcut', 'jumpToLastAgent');
        return;
      }

      if (input.alt && !input.shift && (input.key === 'ArrowRight' || input.key === 'ArrowLeft')) {
        event.preventDefault();
        mainWindow!.webContents.send('app:shortcut', input.key === 'ArrowRight' ? 'nextPane' : 'previousPane');
        return;
      }
    }
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.netior.app');
  Menu.setApplicationMenu(null);

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const dbDir = join(app.getPath('userData'), 'data');
  mkdirSync(dbDir, { recursive: true });
  const dbPath = join(dbDir, is.dev ? 'netior-dev.db' : 'netior.db');
  const netiorServiceStarted = await startNetiorService({
    dbPath,
    port: getNetiorServicePort(),
  });
  if (!netiorServiceStarted) {
    throw new Error('Netior service failed to start');
  }
  console.log('[netior-service] Startup enabled');
  registerAllIpc();

  // Window control IPC
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle('window:isMaximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle('agent:notifyNative', (event, payload: {
    tabId: string;
    title: string;
    message: string;
    playSound: boolean;
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || !win.isMinimized() || !Notification.isSupported()) {
      console.log('[AgentNotify] native notification skipped', {
        hasWindow: Boolean(win),
        destroyed: win?.isDestroyed() ?? null,
        minimized: win?.isMinimized() ?? null,
        supported: Notification.isSupported(),
        title: payload.title,
      });
      return false;
    }

    const notification = new Notification({
      title: payload.title ? `Netior | ${payload.title}` : 'Netior',
      body: payload.message,
      icon: getNotificationIcon(),
      silent: !payload.playSound,
    });

    notification.on('click', () => {
      if (win.isDestroyed()) {
        return;
      }

      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
      win.webContents.send('agent:focusTab', { tabId: payload.tabId });
    });

    notification.show();
    console.log('[AgentNotify] native notification shown', {
      title: payload.title,
      playSound: payload.playSound,
    });
    return true;
  });
  ipcMain.handle('agent:playInAppSound', (_event, kind: 'completion' | 'attention' | 'error') => {
    console.log('[AgentSound] main-process beep', { kind });
    shell.beep();
    return true;
  });
  ipcMain.handle('agent:setName', async (_event, terminalSessionId: string, name: string) => {
    return agentRuntimeManager.setTerminalSessionName(terminalSessionId, name);
  });

  // Detached editor window IPC (host-based)
  ipcMain.handle('editor:detach', (_event, hostId: string, title: string) => {
    // Focus existing detached window if already open
    if (detachedWindows.has(hostId)) {
      detachedWindows.get(hostId)!.focus();
      return;
    }

    const detached = new BrowserWindow({
      width: 700,
      height: 500,
      minWidth: 400,
      minHeight: 300,
      frame: false,
      titleBarStyle: 'hidden',
      title: title || 'Editor',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    detachedWindows.set(hostId, detached);
    attachWindowStateEvents(detached);

    // Intercept shortcuts for detached windows too
    detached.webContents.on('before-input-event', (event, input) => {
      const hasPrimaryModifier = input.control || input.meta;
      if (hasPrimaryModifier && input.type === 'keyDown') {
        if (!input.alt && input.key === 'Tab') {
          event.preventDefault();
          detached.webContents.send('app:shortcut', input.shift ? 'previousTab' : 'nextTab');
          return;
        }

        if (!input.alt && !input.shift && /^[1-9]$/.test(input.key)) {
          event.preventDefault();
          detached.webContents.send('app:shortcut', `openTabByIndex:${input.key}`);
          return;
        }

        if (!input.alt && (input.key === '-' || input.key === '=' || input.key === '+' || input.key === '0')) {
          event.preventDefault();
          detached.webContents.send('terminal:font-size', input.key);
          return;
        }

        if (!input.alt && !input.shift && input.key === '.') {
          event.preventDefault();
          detached.webContents.send('app:shortcut', 'jumpToLastAgent');
          return;
        }
      }
    });

    const hash = `#/detached/${encodeURIComponent(hostId)}`;
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      detached.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${hash}`);
    } else {
      detached.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.slice(1) });
    }

    detached.on('closed', () => {
      detachedWindows.delete(hostId);
      mainWindow?.webContents.send('editor:detached-closed', hostId);
    });
    detached.once('ready-to-show', () => sendWindowMaximizedState(detached));
  });

  ipcMain.on('editor:reattach', (_event, tabId: string, mode: string) => {
    mainWindow?.webContents.send('editor:reattach-to-mode', tabId, mode);
  });

  ipcMain.on('editor:closeDetachedWindow', (_event, hostId: string) => {
    const win = detachedWindows.get(hostId);
    if (win) win.close();
  });

  // Editor state sync relay — main process caches state and broadcasts to all other windows
  let cachedEditorState: unknown = null;
  let cachedSettingsState: unknown = null;

  ipcMain.handle('editor:getState', () => {
    return cachedEditorState;
  });

  ipcMain.on('editor:pushState', (event, state: unknown) => {
    cachedEditorState = state;
    const sender = BrowserWindow.fromWebContents(event.sender);
    // Broadcast to all other windows
    if (mainWindow && mainWindow !== sender && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('editor:syncState', state);
    }
    for (const [, win] of detachedWindows) {
      if (win !== sender && !win.isDestroyed()) {
        win.webContents.send('editor:syncState', state);
      }
    }
  });

  ipcMain.handle('settings:getState', () => {
    return cachedSettingsState;
  });

  ipcMain.on('settings:pushState', (event, state: unknown) => {
    cachedSettingsState = state;
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow && mainWindow !== sender && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:syncState', state);
    }
    for (const [, win] of detachedWindows) {
      if (win !== sender && !win.isDestroyed()) {
        win.webContents.send('settings:syncState', state);
      }
    }
  });

  // Cross-window tab drag state (IPC relay for dataTransfer sandboxing)
  let pendingDragTabId: string | null = null;
  ipcMain.on('editor:dragStart', (_event, tabId: string) => {
    pendingDragTabId = tabId;
    console.log(`[DragIPC] dragStart tabId=${tabId}`);
  });
  ipcMain.handle('editor:getDragData', () => pendingDragTabId);
  ipcMain.on('editor:getDragDataSync', (event) => {
    event.returnValue = pendingDragTabId;
  });
  ipcMain.on('editor:dragEnd', () => {
    console.log(`[DragIPC] dragEnd clearing tabId=${pendingDragTabId}`);
    pendingDragTabId = null;
  });

  await createWindow();

  void (async () => {
    try {
      const narreProvider = await getConfiguredNarreProvider();
      const narreStarted = await syncNarreServerWithSettings();
      console.log(`[narre-server] Startup ${narreStarted ? 'enabled' : 'skipped'} (provider=${narreProvider})`);
    } catch (error) {
      console.warn(`[narre-server] Startup skipped: ${(error as Error).message}`);
    }
  })();

  agentRuntimeManager.start().catch((err) => {
    console.error('[AgentRuntime] Failed to start:', err);
  });

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      void createWindow();
      return;
    }

    focusMainWindow('activate');
  });
});

function resolveStoredWindowBounds(raw: unknown): StoredWindowBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const defaultWidth = Math.min(1200, primaryDisplay.workArea.width);
  const defaultHeight = Math.min(800, primaryDisplay.workArea.height);

  const fallback: StoredWindowBounds = centerBoundsInDisplay(primaryDisplay, {
    width: defaultWidth,
    height: defaultHeight,
    isMaximized: false,
  });

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Partial<StoredWindowBounds>;
  const width = typeof candidate.width === 'number' ? candidate.width : fallback.width;
  const height = typeof candidate.height === 'number' ? candidate.height : fallback.height;
  const isMaximized = candidate.isMaximized === true;

  const targetDisplay = typeof candidate.displayId === 'number'
    ? screen.getAllDisplays().find((display) => display.id === candidate.displayId) ?? null
    : null;

  const display = targetDisplay ?? (
    typeof candidate.x === 'number' && typeof candidate.y === 'number'
      ? screen.getDisplayMatching({
        x: candidate.x,
        y: candidate.y,
        width,
        height,
      })
      : primaryDisplay
  );

  return clampBoundsToDisplay(display, {
    width,
    height,
    x: candidate.x,
    y: candidate.y,
    isMaximized,
    displayId: display.id,
  });
}

function centerBoundsInDisplay(
  display: Electron.Display,
  bounds: Pick<StoredWindowBounds, 'width' | 'height' | 'isMaximized'>,
): StoredWindowBounds {
  const width = Math.min(Math.max(bounds.width, 800), display.workArea.width);
  const height = Math.min(Math.max(bounds.height, 600), display.workArea.height);
  return {
    width,
    height,
    x: display.workArea.x + Math.max(0, Math.floor((display.workArea.width - width) / 2)),
    y: display.workArea.y + Math.max(0, Math.floor((display.workArea.height - height) / 2)),
    isMaximized: bounds.isMaximized,
    displayId: display.id,
  };
}

function clampBoundsToDisplay(display: Electron.Display, bounds: StoredWindowBounds): StoredWindowBounds {
  const width = Math.min(Math.max(bounds.width, 800), display.workArea.width);
  const height = Math.min(Math.max(bounds.height, 600), display.workArea.height);

  const minX = display.workArea.x;
  const minY = display.workArea.y;
  const maxX = display.workArea.x + Math.max(0, display.workArea.width - width);
  const maxY = display.workArea.y + Math.max(0, display.workArea.height - height);

  const x = typeof bounds.x === 'number'
    ? clamp(bounds.x, minX, maxX)
    : minX + Math.max(0, Math.floor((display.workArea.width - width) / 2));
  const y = typeof bounds.y === 'number'
    ? clamp(bounds.y, minY, maxY)
    : minY + Math.max(0, Math.floor((display.workArea.height - height) / 2));

  return {
    width,
    height,
    x,
    y,
    isMaximized: bounds.isMaximized,
    displayId: display.id,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

app.on('window-all-closed', () => {
  ptyManager.killAll();
  agentRuntimeManager.stop();
  unregisterDesktopRuntimeInstance();
  stopNarreServer();
  stopNetiorService();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  unregisterDesktopRuntimeInstance();
});

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => {
          console.warn(`[desktop-main] ${label} timed out after ${timeoutMs}ms; using fallback`);
          resolve(fallbackValue);
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    console.warn(`[desktop-main] ${label} failed; using fallback`, error);
    return fallbackValue;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
