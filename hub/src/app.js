// hub/src/app.js
// Cablea el webhook, el canal de Cloud API y el motor de flujos del escritorio (código compartido),
// con un runtime independiente por tenant (repos, canal y bot propios).
import { createServer } from './server.js';
import { createCloudChannel } from './channel.js';
import { createTenantRepos } from './db/repos.js';
import { findTenantByPhoneNumberId, listTenants } from './db/tenants.js';
import { createEngine } from '../../src/main/whatsapp/flows/conversation.flow.js';
import { attachBot } from '../../src/main/whatsapp/bot.js';

/**
 * @param {object}   opts.cfg          resultado de loadConfig()
 * @param {object}   opts.db           base abierta con openDb()
 * @param {Function} opts.makeProvider (tenant) => proveedor de envío (sendText/sendTemplate)
 */
export function createHub({ cfg, db, makeProvider, log = console }) {
  const runtimes = new Map(); // tenantId -> { channel }

  function runtimeFor(tenant) {
    let rt = runtimes.get(tenant.id);
    if (rt) return rt;
    const repos = createTenantRepos(db, tenant.id);
    const channel = createCloudChannel(makeProvider(tenant), log);
    const engine = createEngine({
      ...repos,
      // shortcut: sin notificación nativa en el servidor; por ahora solo log. Pendiente: aviso al escritorio por WebSocket.
      sendHandoffNotification: (userId) => log.log(`[hub:${tenant.slug}] ${userId} pidió hablar con un asesor`),
    });
    attachBot({ channel, engine, SesionesRepo: repos.SesionesRepo, historial: repos.HistorialRepo, log });
    rt = { channel };
    runtimes.set(tenant.id, rt);
    return rt;
  }

  // Meta indica a qué número llegó el evento. Con un único tenant no hay riesgo de cruce, así que se tolera un id desconocido.
  function resolveTenant(event) {
    const byNumber = findTenantByPhoneNumberId(db, event.phoneNumberId);
    if (byNumber) return byNumber;
    const all = listTenants(db);
    return all.length === 1 ? all[0] : null;
  }

  return createServer(cfg, (event) => {
    const tenant = resolveTenant(event);
    if (!tenant) return log.error('[hub] evento sin tenant, descartado. phone_number_id:', event.phoneNumberId || '(vacío)');
    runtimeFor(tenant).channel.handleEvent(event);
  }, log);
}
