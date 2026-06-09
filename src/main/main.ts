import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import log from 'electron-log/main.js';
import { connectDatabase } from './database/db.js';
import { registerIpc } from './ipc.js';
import { createBackup, getSettings } from './services/settings.js';

log.initialize();

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'Poscore',
    backgroundColor: '#f7f8fb',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL!);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  connectDatabase();
  registerIpc();
  const settings = getSettings();
  if (settings.autoBackup) {
    try {
      createBackup(settings.backupLocation || undefined);
    } catch (error) {
      log.warn('Automatic backup failed', error);
    }
  }
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
