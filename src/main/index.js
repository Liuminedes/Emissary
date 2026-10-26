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
import { createAuth } from './auth/auth.js';
import { UsuariosRepo } from './db/repositories/usuarios.repo.js';
import { SesionesRepo } from './db/repositories/sesiones.repo.js';
import { createFileLogger } from './util/logger.js';
import { userDataPath } from './util/paths.js';

// Registro de errores en %APPDATA%/Emissary/logs: sin esto un fallo en el equipo del cliente no deja rastro
const logger = createFileLogger({ dir: userDataPath('logs') });
for (const level of ['error', 'warn']) {
  const original = console[level].bind(console);
  console[level] = (...args) => { original(...args); logger[level](...args); };
}
// El bot vive en segundo plano: un error suelto se registra y la app sigue atendiendo en vez de cerrarse
process.on('uncaughtException', (err) => logger.error('Excepción no capturada:', err));
process.on('unhandledRejection', (reason) => logger.error('Promesa rechazada sin manejar:', reason));
logger.info(`Emissary ${app.getVersion()} arrancando (Electron ${process.versions.electron}, ${process.platform} ${process.arch})`);

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
    const auth = createAuth({ repo: UsuariosRepo });
    registerIpcHandlers({ inbox, auth, logger });

    // Errores y avisos internos de la conexión con WhatsApp (Baileys)
    waEvents.on('log', (mensaje) => logger.error(mensaje));

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
