// src/main/index.js
import { app, BrowserWindow } from 'electron';
import { getDb } from './db/db.js';
import { NegocioRepo } from './db/repositories/negocio.repo.js';
import { FlujoRepo } from './db/repositories/flujo.repo.js';
import { createMainWindow } from './window.js';
import { createTray, updateTrayStatus } from './tray.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { applyAutoLaunch } from './autolaunch.js';
import { initWhatsApp, waEvents } from './whatsapp/connection.js';
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
    registerIpcHandlers();

    // Reenviar estado de WhatsApp al renderer en tiempo real
    waEvents.on('status', (status) => {
      updateTrayStatus(status.status);
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('wa:status', status);
    });

    // Detectar si el asesor escribe manualmente
    waEvents.on('advisor-message', ({ clientUserId }) => {
      const session = SesionesRepo.get(clientUserId);
      
      // Si la sesión está limpia (nunca interactuó con el bot)
      if (!session.step && !session.lead?.name) {
        session.advisorInitiated = true; // El asesor dio el primer paso
      } else {
        session.advisorTook = true; // El asesor interrumpió o continuó un chat existente
      }
      
      SesionesRepo.save(session);
    });

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
