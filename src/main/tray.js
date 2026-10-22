// src/main/tray.js
import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { dirnameFromMeta } from './util/paths.js';

const __dirname = dirnameFromMeta(import.meta.url);

let tray = null;

export function createTray(mainWindow) {
  const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('Emissary');

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Emissary', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);

  tray.on('click', () => mainWindow.show());
  return tray;
}

export function updateTrayStatus(status) {
  if (!tray) return;
  const labels = {
    connected: 'Emissary — Conectado ✅',
    connecting: 'Emissary — Conectando…',
    qr: 'Emissary — Esperando escaneo de QR',
    disconnected: 'Emissary — Desconectado ⚠️',
  };
  tray.setToolTip(labels[status] || 'Emissary');
}
