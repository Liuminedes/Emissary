// src/main/whatsapp/inbox.js
// Acciones del asesor sobre una conversación desde la app: tomar, soltar y responder.

const MAX_TEXTO = 4096;

export function createInbox({ SesionesRepo, historial, channel, onActivity = () => {} }) {
  const setControl = (userId, { advisorTook, handoffMode }) => {
    const session = SesionesRepo.get(userId);
    session.advisorTook = advisorTook;
    session.handoffMode = handoffMode;
    SesionesRepo.save(session);
    onActivity(userId);
  };

  return {
    // El bot calla mientras el asesor atiende (caduca tras el TTL de inactividad del motor)
    takeControl: (userId) => setControl(userId, { advisorTook: true, handoffMode: false }),

    // Devuelve el chat al bot; el cliente retoma el flujo donde iba
    releaseControl: (userId) => setControl(userId, { advisorTook: false, handoffMode: false }),

    async sendAsAdvisor(userId, text) {
      const limpio = typeof text === 'string' ? text.trim() : '';
      if (!limpio || limpio.length > MAX_TEXTO) throw new Error('Mensaje vacío o demasiado largo');
      if (!(await channel.sendText(userId, limpio))) throw new Error('WhatsApp no está conectado');
      historial.add(userId, 'asesor', limpio);
      setControl(userId, { advisorTook: true, handoffMode: false }); // quien responde a mano tiene el control
      return { ok: true };
    },
  };
}
