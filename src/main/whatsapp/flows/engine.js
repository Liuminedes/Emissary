// src/main/whatsapp/flows/engine.js
// Cableado de producción: el motor con los repos reales de SQLite y las notificaciones de Electron.
import { NegocioRepo } from '../../db/repositories/negocio.repo.js';
import { SesionesRepo } from '../../db/repositories/sesiones.repo.js';
import { LeadsRepo } from '../../db/repositories/leads.repo.js';
import { FlujoRepo } from '../../db/repositories/flujo.repo.js';
import { CatalogoRepo } from '../../db/repositories/catalogo.repo.js';
import { sendHandoffNotification } from '../../util/notifier.js';
import { createEngine } from './conversation.flow.js';

const motor = createEngine({ NegocioRepo, SesionesRepo, LeadsRepo, FlujoRepo, CatalogoRepo, sendHandoffNotification });

export const engine = {
  // Hasta completar la configuración mínima el bot calla: los mensajes saldrían con datos vacíos
  handleIncomingMessage: (msg) => (NegocioRepo.isSetupComplete() ? motor.handleIncomingMessage(msg) : []),
};
