// hub/src/channel.js
// Canal de WhatsApp Cloud API según el contrato de src/main/whatsapp/bot.js:
//   events 'message' { userId, text, pushName } | 'echo' { userId, text }, y sendText(userId, text).
// El userId usa el mismo formato que Baileys (<número>@s.whatsapp.net) para que sesiones y leads
// existentes sigan siendo válidos si el negocio cambia de canal.
import { EventEmitter } from 'node:events';

export const toUserId = (waId) => `${String(waId).replace(/\D/g, '')}@s.whatsapp.net`;
export const toWaId = (userId) => String(userId).replace(/[@:].*$/, '').replace(/\D/g, '');

export function createCloudChannel(provider, log = console) {
  const events = new EventEmitter();

  return {
    events,

    async sendText(userId, text) {
      try {
        await provider.sendText(toWaId(userId), text);
        return true;
      } catch (err) {
        log.error('[canal] no se pudo enviar:', err.message);
        return false;
      }
    },

    // Recibe los eventos ya normalizados por parse.js
    handleEvent(event) {
      if (event.type === 'message' && event.text) {
        events.emit('message', { userId: toUserId(event.from), text: event.text, pushName: event.name });
      } else if (event.type === 'echo' && event.text) {
        events.emit('echo', { userId: toUserId(event.to), text: event.text });
      } else if (event.type === 'status' && event.status === 'failed') {
        log.error('[canal] WhatsApp reportó un envío fallido:', event.id, event.recipient);
      }
    },
  };
}
