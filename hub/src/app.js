// hub/src/app.js
// Cablea el webhook, el canal de Cloud API y el motor de flujos del escritorio (código compartido).
import { createServer } from './server.js';
import { createCloudChannel } from './channel.js';
import { createMemoryRepos } from './memory-repos.js';
import { createEngine } from '../../src/main/whatsapp/flows/conversation.flow.js';
import { attachBot } from '../../src/main/whatsapp/bot.js';

export function createHub({ cfg, provider, log = console }) {
  const repos = createMemoryRepos(cfg.business);
  const channel = createCloudChannel(provider, log);
  const engine = createEngine({
    ...repos,
    // shortcut: sin notificación nativa en el servidor; por ahora solo log. Pendiente: aviso al escritorio por WebSocket.
    sendHandoffNotification: (userId) => log.log(`[hub] ${userId} pidió hablar con un asesor`),
  });
  attachBot({ channel, engine, SesionesRepo: repos.SesionesRepo, log });

  return createServer(cfg, (event) => channel.handleEvent(event), log);
}
