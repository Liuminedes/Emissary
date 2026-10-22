// hub/src/compliance/consent.js
// Registro de consentimiento y bajas automáticas, siempre acotado a un tenant.
import { normalize } from '../../../src/main/whatsapp/flows/keywords.js';
import { MIN_DAYS_BETWEEN } from './limits.js';

// El mensaje ENTERO debe ser la palabra clave: "no me des de baja" o "stop sign" no cuentan
const OPT_OUT = new Set(['baja', 'stop', 'cancelar', 'desuscribir', 'no mas', 'darme de baja', 'no quiero mas mensajes']);
const OPT_IN = new Set(['alta', 'start', 'suscribir']);

const digits = (s) => String(s || '').replace(/\D/g, '');

export function createConsent(db, tenantId, { now = Date.now, negocioNombre = () => '' } = {}) {
  const touch = (userId) =>
    db.prepare('INSERT OR IGNORE INTO contactos (tenant_id, user_id) VALUES (?, ?)').run(tenantId, userId);
  const get = (userId) => db.prepare('SELECT * FROM contactos WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId);

  return {
    get,

    // Hook previo al motor. Devuelve las respuestas a enviar, o null para que el motor siga con su flujo.
    // Decisión: tras una baja el cliente puede seguir escribiendo (él inició la conversación);
    // lo que se bloquea para siempre son las campañas, hasta que escriba ALTA.
    handleInbound({ userId, text }) {
      touch(userId);
      db.prepare('UPDATE contactos SET last_inbound_at = ? WHERE tenant_id = ? AND user_id = ?').run(now(), tenantId, userId);
      const t = normalize(text);
      const negocio = negocioNombre();

      if (OPT_OUT.has(t)) {
        db.prepare('UPDATE contactos SET opted_out = 1, opted_out_at = ? WHERE tenant_id = ? AND user_id = ?').run(now(), tenantId, userId);
        return [`Listo, no volverás a recibir mensajes promocionales${negocio ? ` de ${negocio}` : ''}. Si cambias de opinión, escribe *ALTA*.`];
      }
      if (OPT_IN.has(t)) {
        this.registerOptIn(userId, 'cliente_alta');
        return ['¡Gracias! Quedaste suscrito a nuestros mensajes. Cuando quieras dejar de recibirlos, escribe *BAJA*.'];
      }
      return null;
    },

    // Consentimiento explícito de marketing; `fuente` es la evidencia (ej. 'formulario web 2026-10-22')
    registerOptIn(userId, fuente) {
      if (!fuente || typeof fuente !== 'string') throw new Error('Indica la fuente del consentimiento');
      touch(userId);
      db.prepare(`UPDATE contactos SET marketing_opt_in = 1, opt_in_at = ?, opt_in_fuente = ?, opted_out = 0, opted_out_at = NULL
                  WHERE tenant_id = ? AND user_id = ?`).run(now(), fuente.slice(0, 200), tenantId, userId);
    },

    // ¿Se le puede enviar una campaña de esta categoría ahora?
    canReceiveCampaign(userId, categoria) {
      const c = get(userId);
      if (c?.opted_out) return { ok: false, motivo: 'dio de baja' };
      if (categoria === 'marketing' && !c?.marketing_opt_in) return { ok: false, motivo: 'sin consentimiento de marketing' };
      if (c?.last_campaign_at && now() - c.last_campaign_at < MIN_DAYS_BETWEEN * 864e5) return { ok: false, motivo: 'recibió una campaña hace poco' };
      return { ok: true };
    },

    markCampaignSent: (userId) => {
      touch(userId);
      db.prepare('UPDATE contactos SET last_campaign_at = ? WHERE tenant_id = ? AND user_id = ?').run(now(), tenantId, userId);
    },

    optOutsSince: (ms) => db.prepare('SELECT COUNT(*) c FROM contactos WHERE tenant_id = ? AND opted_out_at >= ?').get(tenantId, ms).c,
  };
}

export const normalizeNumber = (n) => {
  const d = digits(n);
  return d.length >= 10 && d.length <= 15 ? d : null;
};
