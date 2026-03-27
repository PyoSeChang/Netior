import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { initDatabase, closeDatabase } from './db/connection';
import { registerAllIpc } from './ipc';

// Force userData to %APPDATA%/moc
app.name = 'moc';
app.setPath('userData', join(app.getPath('appData'), 'moc'));

let mainWindow: BrowserWindow | null = null;
const detachedWindows = new Map<string, BrowserWindow>();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.moc.app');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  await initDatabase();
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});
