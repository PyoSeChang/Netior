import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { mkdirSync, existsSync } from 'fs';
import { initDatabase, closeDatabase, getSetting, setSetting } from '@moc/core';
import { registerAllIpc } from './ipc';
import { ptyManager } from './pty/pty-manager';
import { startAgentServer, stopAgentServer } from './process/agent-server-manager';

// Force userData to %APPDATA%/moc
app.name = 'moc';
app.setPath('userData', join(app.getPath('appData'), 'moc'));

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

let mainWindow: BrowserWindow | null = null;
const detachedWindows = new Map<string, BrowserWindow>();

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
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Intercept Ctrl+=/- before Electron and VS Code keybindings consume them
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && !input.alt && !input.meta && input.type === 'keyDown') {
      if (input.key === '-' || input.key === '=' || input.key === '+' || input.key === '0') {
        event.preventDefault();
        mainWindow!.webContents.send('terminal:font-size', input.key);
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
  electronApp.setAppUserModelId('com.moc.app');
  Menu.setApplicationMenu(null);

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Initialize database with injectable path
  const dbDir = join(app.getPath('userData'), 'data');
  mkdirSync(dbDir, { recursive: true });
  const dbPath = join(dbDir, is.dev ? 'moc-dev.db' : 'moc.db');
  console.log(`[DB] Using database: ${dbPath}`);
  const nativeBinding = getNativeBinding();
  initDatabase(dbPath, nativeBinding ? { nativeBinding } : undefined);
  registerAllIpc();

  // Start Narre agent-server (Claude Agent SDK falls back to OAuth if no API key)
  const apiKey = getSetting('anthropic_api_key') || '';
  startAgentServer({ apiKey, dbPath, dataDir: dbDir });

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

  // Detached editor window IPC
  ipcMain.handle('editor:detach', (_event, tabId: string, title: string) => {
    // Focus existing detached window if already open
    if (detachedWindows.has(tabId)) {
      detachedWindows.get(tabId)!.focus();
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

    detachedWindows.set(tabId, detached);

    const hash = `#/detached/${encodeURIComponent(tabId)}/${encodeURIComponent(title || 'Editor')}`;
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      detached.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${hash}`);
    } else {
      detached.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.slice(1) });
    }

    detached.on('closed', () => {
      detachedWindows.delete(tabId);
      mainWindow?.webContents.send('editor:detached-closed', tabId);
    });
  });

  ipcMain.on('editor:reattach', (_event, tabId: string, mode: string) => {
    mainWindow?.webContents.send('editor:reattach-to-mode', tabId, mode);
    const win = detachedWindows.get(tabId);
    if (win) win.close();
  });

  createWindow();
  ptyManager.init(mainWindow!);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  ptyManager.killAll();
  stopAgentServer();
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
