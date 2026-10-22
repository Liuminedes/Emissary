// src/main/whatsapp/bot.js
// Une un canal de mensajería con el motor de flujos. No sabe si el canal es Baileys o Cloud API.
//
// Contrato de canal:
//   channel.events  EventEmitter que emite
//     'message' { userId, text, pushName }   un cliente escribió
//     'echo'    { userId }                   el asesor escribió a mano en ese chat
//   channel.sendText(userId, text) -> Promise<boolean>

export function attachBot({ channel, engine, SesionesRepo, log = console }) {
  // Un mensaje a la vez: dos mensajes seguidos del mismo cliente no deben pisar su sesión
  let queue = Promise.resolve();
  const enqueue = (job) => {
    queue = queue.then(job).catch((err) => log.error('[bot] error:', err.message));
  };

  channel.events.on('message', ({ userId, text, pushName }) => enqueue(async () => {
    for (const reply of engine.handleIncomingMessage({ userId, text, pushName })) {
      await channel.sendText(userId, reply);
    }
  }));

  channel.events.on('echo', ({ userId }) => enqueue(async () => {
    const session = SesionesRepo.get(userId);
    session.advisorTook = true; // save() renueva updatedAt: el bot retoma pasado el TTL sin actividad
    SesionesRepo.save(session);
  }));
}
