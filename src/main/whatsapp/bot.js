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

export function attachBot({ channel, engine, SesionesRepo, historial, onActivity = () => {}, log = console }) {
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
    for (const reply of engine.handleIncomingMessage({ userId, text, pushName })) {
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
