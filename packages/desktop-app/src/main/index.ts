import { app, shell, BrowserWindow, ipcMain, Menu, Notification, nativeImage } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { mkdirSync, existsSync } from 'fs';
import { initDatabase, closeDatabase, getSetting, setSetting } from '@netior/core';
import { registerAllIpc } from './ipc';
import { ptyManager } from './pty/pty-manager';
import { startNarreServer, stopNarreServer } from './process/narre-server-manager';
import { agentRuntimeManager } from './agent-runtime/agent-runtime-manager';

// Force userData to %APPDATA%/netior
app.name = 'Netior';
app.setPath('userData', join(app.getPath('appData'), 'netior'));

function getNativeBinding(): string | undefined {
  const candidates = [
    join(__dirname, '../../node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
    join(process.resourcesPath ?? '', 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

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

function sendWindowMaximizedState(win: BrowserWindow): void {
  win.webContents.send('window:maximized-changed', win.isMaximized());
}

function attachWindowStateEvents(win: BrowserWindow): void {
  win.on('maximize', () => sendWindowMaximizedState(win));
  win.on('unmaximize', () => sendWindowMaximizedState(win));
  win.on('enter-full-screen', () => sendWindowMaximizedState(win));
  win.on('leave-full-screen', () => sendWindowMaximizedState(win));
}

function loadWindowBounds(): { width: number; height: number; x?: number; y?: number; isMaximized?: boolean } {
  const raw = getSetting('windowBounds');
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch { /* use defaults */ }
  }
  return { width: 1200, height: 800 };
}

function saveWindowBounds(win: BrowserWindow): void {
  const isMaximized = win.isMaximized();
  // Save normal (non-maximized) bounds so restore works correctly
  const bounds = isMaximized ? (win as any)._lastNormalBounds ?? win.getNormalBounds() : win.getBounds();
  setSetting('windowBounds', JSON.stringify({ ...bounds, isMaximized }));
}

function createWindow(): void {
  const saved = loadWindowBounds();

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
    if (mainWindow) saveWindowBounds(mainWindow);
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
    if (mainWindow) sendWindowMaximizedState(mainWindow);
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

  // Initialize database with injectable path
  const dbDir = join(app.getPath('userData'), 'data');
  mkdirSync(dbDir, { recursive: true });
  const dbPath = join(dbDir, is.dev ? 'netior-dev.db' : 'netior.db');
  console.log(`[DB] Using database: ${dbPath}`);
  const nativeBinding = getNativeBinding();
  initDatabase(dbPath, nativeBinding ? { nativeBinding } : undefined);
  registerAllIpc();

  // Start Narre server (Claude Agent SDK falls back to OAuth if no API key)
  const apiKey = getSetting('anthropic_api_key') || '';
  startNarreServer({ apiKey, dbPath, dataDir: dbDir });

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

  createWindow();

  agentRuntimeManager.start().catch((err) => {
    console.error('[AgentRuntime] Failed to start:', err);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  agentRuntimeManager.stop();
  stopNarreServer();
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
