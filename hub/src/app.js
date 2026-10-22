// hub/src/app.js
// Cablea el webhook, el canal de Cloud API y el motor de flujos del escritorio (código compartido),
// con un runtime independiente por tenant (repos, canal y bot propios), más las guardas de la Fase 3.
import { createServer } from './server.js';
import { createCloudChannel } from './channel.js';
import { createTenantRepos } from './db/repos.js';
import { findTenantByPhoneNumberId, listTenants } from './db/tenants.js';
import { createEngine } from '../../src/main/whatsapp/flows/conversation.flow.js';
import { attachBot } from '../../src/main/whatsapp/bot.js';
import { createConsent } from './compliance/consent.js';
import { createUsage } from './compliance/usage.js';
import { createCampaigns } from './campaigns.js';
import { createAdmin } from './admin.js';

/**
 * @param {object}   opts.cfg          resultado de loadConfig()
 * @param {object}   opts.db           base abierta con openDb()
 * @param {Function} opts.makeProvider (tenant) => proveedor de envío (sendText/sendTemplate)
 * @returns servidor HTTP con `server.campaigns` (llamar `campaigns.tick()` periódicamente)
 */
export function createHub({ cfg, db, makeProvider, now = Date.now, log = console }) {
  const runtimes = new Map(); // tenantId -> { channel }
  const providers = new Map(); // tenantId -> proveedor
  const providerFor = (tenant) => {
    if (!providers.has(tenant.id)) providers.set(tenant.id, makeProvider(tenant));
    return providers.get(tenant.id);
  };

  function runtimeFor(tenant) {
    let rt = runtimes.get(tenant.id);
    if (rt) return rt;
    const repos = createTenantRepos(db, tenant.id);
    const consent = createConsent(db, tenant.id, { now, negocioNombre: () => repos.NegocioRepo.get()?.nombre_negocio || '' });
    const usage = createUsage(db, tenant.id, { now });

    // Las respuestas del bot dentro de la ventana de 24 h cuentan como consumo "service" (sin costo)
    const provider = providerFor(tenant);
    const tracked = { sendText: async (to, text) => { const r = await provider.sendText(to, text); usage.record('service'); return r; } };
    const channel = createCloudChannel(tracked, log);

    const motor = createEngine({
      ...repos,
      // shortcut: sin notificación nativa en el servidor; por ahora solo log. Pendiente: aviso al escritorio por WebSocket.
      sendHandoffNotification: (userId) => log.log(`[hub:${tenant.slug}] ${userId} pidió hablar con un asesor`),
    });
    // BAJA/ALTA se atienden antes que el flujo; el resto sigue al motor
    const engine = { handleIncomingMessage: (msg) => consent.handleInbound(msg) ?? motor.handleIncomingMessage(msg) };

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

  const campaigns = createCampaigns({ db, providerFor, now, log });
  const admin = createAdmin({ db, campaigns, adminToken: cfg.adminToken, now });

  const server = createServer(cfg, (event) => {
    const tenant = resolveTenant(event);
    if (!tenant) return log.error('[hub] evento sin tenant, descartado. phone_number_id:', event.phoneNumberId || '(vacío)');
    runtimeFor(tenant).channel.handleEvent(event);
  }, log, admin);
  server.campaigns = campaigns;
  return server;
}
