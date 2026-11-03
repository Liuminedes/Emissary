// src/main/whatsapp/bot.js
// Une un canal de mensajería con el motor de flujos. No sabe si el canal es Baileys o Cloud API.
//
// Contrato de canal:
//   channel.events  EventEmitter que emite
//     'message' { userId, text, pushName }   un cliente escribió
//     'echo'    { userId, text }             el asesor escribió a mano en ese chat
//   channel.sendText(userId, text) -> Promise<boolean>
//
// historial: { add(userId, origen, texto) } y onActivity(userId) avisan a quien muestre las conversaciones.

import { isOptOut } from './flows/keywords.js';
import { createReplyLimiter } from './pacing.js';

const OPTOUT_REPLY = 'Listo, no volverás a recibir difusiones de nuestra parte. Si necesitas algo, escríbenos cuando quieras.';

// onOptOut(userId): se llama cuando el cliente pide la baja de las difusiones
export function attachBot({ channel, engine, SesionesRepo, historial, onActivity = () => {}, onOptOut = () => {}, log = console, limiter = createReplyLimiter() }) {
  const record = (userId, origen, texto) => {
    try {
      historial?.add(userId, origen, texto);
      onActivity(userId);
    } catch (err) {
      log.error('[bot] no se pudo guardar el historial:', err.message);
    }
  };

  // Un mensaje a la vez: dos mensajes seguidos del mismo cliente no deben pisar su sesión
  let queue = Promise.resolve();
  const enqueue = (job) => {
    queue = queue.then(job).catch((err) => log.error('[bot] error:', err.message));
  };

  channel.events.on('message', ({ userId, text, pushName }) => enqueue(async () => {
    record(userId, 'cliente', text);
    if (isOptOut(text)) {
      try { onOptOut(userId); } catch (err) { log.error('[bot] no se pudo registrar la baja:', err.message); }
      if (limiter(userId) && await channel.sendText(userId, OPTOUT_REPLY)) record(userId, 'bot', OPTOUT_REPLY);
      return;
    }
    for (const reply of engine.handleIncomingMessage({ userId, text, pushName })) {
      if (!limiter(userId)) { log.error(`[bot] demasiadas respuestas seguidas a ${userId}: se omite el resto`); break; }
      if (await channel.sendText(userId, reply)) record(userId, 'bot', reply);
    }
  }));

  channel.events.on('echo', ({ userId, text }) => enqueue(async () => {
    const session = SesionesRepo.get(userId);
    session.advisorTook = true; // save() renueva updatedAt: el bot retoma pasado el TTL sin actividad
    SesionesRepo.save(session);
    if (text) record(userId, 'asesor', text);
  }));
}
