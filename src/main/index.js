// src/main/index.js
import { app, BrowserWindow } from 'electron';
import { getDb } from './db/db.js';
import { NegocioRepo } from './db/repositories/negocio.repo.js';
import { FlujoRepo } from './db/repositories/flujo.repo.js';
import { createMainWindow } from './window.js';
import { createTray, updateTrayStatus } from './tray.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { applyAutoLaunch } from './autolaunch.js';
import { initWhatsApp, waEvents, channel } from './whatsapp/connection.js';
import { attachBot } from './whatsapp/bot.js';
import { createInbox } from './whatsapp/inbox.js';
import { HistorialRepo } from './db/repositories/historial.repo.js';
import { engine } from './whatsapp/flows/engine.js';
import { SesionesRepo } from './db/repositories/sesiones.repo.js';

// Solo una instancia de la app a la vez
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { win.show(); win.focus(); }
  });

  app.whenReady().then(async () => {
    getDb(); // inicializa/migra la DB local
    FlujoRepo.init();

    const mainWindow = createMainWindow();
    createTray(mainWindow);
    HistorialRepo.purgeOld();

    // Avisa a la pantalla de conversaciones que algo cambió
    const onActivity = (userId) => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('inbox:updated', { userId });
    };
    const inbox = createInbox({ SesionesRepo, historial: HistorialRepo, channel, onActivity });
    registerIpcHandlers({ inbox });

    // Reenviar estado de WhatsApp al renderer en tiempo real
    waEvents.on('status', (status) => {
      updateTrayStatus(status.status);
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('wa:status', status);
    });

    // Motor de flujos <-> canal (mensajes del cliente y eco del asesor)
    attachBot({ channel, engine, SesionesRepo, historial: HistorialRepo, onActivity });

    const negocio = NegocioRepo.get();
    await applyAutoLaunch(!!negocio.auto_launch);
    await initWhatsApp();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    // La app vive en la bandeja del sistema — no cerrar el proceso al cerrar la ventana
    if (process.platform !== 'darwin') {
      // no-op: se mantiene corriendo en tray
    }
  });

  app.on('before-quit', () => { app.isQuiting = true; });
}
