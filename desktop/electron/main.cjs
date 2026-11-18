// Storyframe desktop viewer — Electron main process.
const { app, BrowserWindow, ipcMain, shell, Menu, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/**
 * Optional runtime config: %APPDATA%/Storyframe/config.json  →  { "apiUrl": "https://api.example.com/api" }
 * Lets an installed EXE point at a different server without rebuilding.
 * Only the public API URL lives here — no secrets ever ship with the desktop app.
 */
function readConfig() {
  try {
    const file = path.join(app.getPath('userData'), 'config.json');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    return typeof cfg === 'object' && cfg ? cfg : {};
  } catch {
    return {};
  }
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#000000',
    title: 'Storyframe',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  // Never open new windows inside the app; send web links to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://');
    if (!allowed) e.preventDefault();
  });

  const sendFs = () => win.webContents.send('window:fullscreen-changed', win.isFullScreen());
  win.on('enter-full-screen', sendFs);
  win.on('leave-full-screen', sendFs);
  win.on('closed', () => { win = null; });
}

ipcMain.handle('config:get', () => ({
  apiUrl: readConfig().apiUrl || null,
  shareUrl: readConfig().shareUrl || null,
  version: app.getVersion(),
}));
ipcMain.handle('window:set-fullscreen', (_e, value) => {
  if (win) win.setFullScreen(Boolean(value));
  return win?.isFullScreen() ?? false;
});
ipcMain.handle('window:is-fullscreen', () => win?.isFullScreen() ?? false);
ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text ?? '').slice(0, 2000));
  return true;
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  if (!DEV_URL) Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
