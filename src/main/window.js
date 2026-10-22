// src/main/window.js
import { BrowserWindow, app } from 'electron';
import path from 'path';
import { dirnameFromMeta } from './util/paths.js';

const __dirname = dirnameFromMeta(import.meta.url);
const isDev = process.argv.includes('--dev');

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: 'Emissary',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'ui-build', 'index.html'));
  }

  // La UI es local: nada debe abrir ventanas ni navegar fuera de ella
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!isDev || !url.startsWith('http://localhost:5173')) e.preventDefault();
  });

  // Minimizar a la bandeja en vez de cerrar
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    }
  });

  return win;
}