// hub/src/campaigns.js
// Campañas de plantillas con todas las guardas: consentimiento, baja, frecuencia, horario, tope diario con
// rampa, espaciado aleatorio, presupuesto mensual y corte automático por fallos o bajas.
import { createConsent, normalizeNumber } from './compliance/consent.js';
import { createUsage } from './compliance/usage.js';
import { localDay, localHour } from './compliance/time.js';
import { dailyCap, inWindow, breakerReason, MIN_GAP_MS, JITTER_MS, BREAKER } from './compliance/limits.js';
import { toUserId, toWaId } from './channel.js';

const MAX_CONTACTOS = 5000;
const MAX_OMITIDOS_POR_TICK = 200;
const PLANTILLA = /^[a-z0-9_]{1,512}$/; // formato de nombre de plantilla de Meta

export class CampaignError extends Error {}

/**
 * @param {object}   deps.db
 * @param {Function} deps.providerFor  (tenant) => { sendTemplate(to, {name, language}) }
 * @param {Function} deps.now          reloj inyectable (ms)
 * @param {Function} deps.random       aleatorio inyectable (0..1)
 */
export function createCampaigns({ db, providerFor, now = Date.now, random = Math.random, log = console }) {
  const tenantOf = (id) => db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  const nextAllowed = new Map(); // tenantId -> ms. shortcut: se pierde al reiniciar; el tope diario sí persiste.
  let running = false;

  const scoped = (tenantId) => ({
    consent: createConsent(db, tenantId, { now }),
    usage: createUsage(db, tenantId, { now }),
  });

  function pauseAll(tenantId, motivo) {
    db.prepare("UPDATE campanas SET estado = 'pausada', motivo_pausa = ? WHERE tenant_id = ? AND estado = 'en_curso'").run(motivo, tenantId);
    log.error(`[campañas] tenant ${tenantId} pausado: ${motivo}`);
  }

  function crear(tenantId, { nombre, plantilla, idioma = 'es', categoria = 'marketing', contactos }) {
    if (typeof nombre !== 'string' || !nombre.trim()) throw new CampaignError('Falta el nombre de la campaña');
    if (!PLANTILLA.test(plantilla || '')) throw new CampaignError('Nombre de plantilla inválido (minúsculas, números y guion bajo)');
    if (!['marketing', 'utility'].includes(categoria)) throw new CampaignError('La categoría debe ser marketing o utility');
    if (!Array.isArray(contactos) || contactos.length === 0 || contactos.length > MAX_CONTACTOS) {
      throw new CampaignError(`La campaña admite de 1 a ${MAX_CONTACTOS} contactos`);
    }

    const { consent, usage } = scoped(tenantId);
    const info = db.prepare(
      "INSERT INTO campanas (tenant_id, nombre, plantilla, idioma, categoria, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(tenantId, nombre.trim().slice(0, 120), plantilla, idioma, categoria, now());
    const id = Number(info.lastInsertRowid);

    const insert = db.prepare('INSERT OR IGNORE INTO campana_items (campana_id, tenant_id, user_id, estado, motivo) VALUES (?, ?, ?, ?, ?)');
    const omitidos = {};
    let elegibles = 0;
    db.exec('BEGIN');
    try {
      for (const c of contactos) {
        const numero = normalizeNumber(c?.numero);
        if (!numero) { omitidos['número inválido'] = (omitidos['número inválido'] || 0) + 1; continue; }
        const userId = toUserId(numero);
        const check = consent.canReceiveCampaign(userId, categoria);
        const res = insert.run(id, tenantId, userId, check.ok ? 'pendiente' : 'omitido', check.ok ? null : check.motivo);
        if (!res.changes) { omitidos.duplicado = (omitidos.duplicado || 0) + 1; continue; } // ya estaba en la lista
        if (check.ok) elegibles++;
        else omitidos[check.motivo] = (omitidos[check.motivo] || 0) + 1;
      }
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }

    const tarifa = usage.rateOf(categoria);
    return {
      id, elegibles, omitidos,
      tarifa_configurada: tarifa > 0,
      costo_estimado_usd: tarifa * elegibles,
    };
  }

  function iniciar(tenantId, campanaId) {
    const c = db.prepare('SELECT * FROM campanas WHERE id = ? AND tenant_id = ?').get(campanaId, tenantId);
    if (!c) throw new CampaignError('Campaña no encontrada');
    if (!['borrador', 'pausada'].includes(c.estado)) throw new CampaignError(`No se puede iniciar una campaña ${c.estado}`);
    const t = tenantOf(tenantId);
    const { usage } = scoped(tenantId);
    // Un tope sin tarifa no protege nada: todo costaría 0
    if (t.presupuesto_mensual_usd > 0 && usage.rateOf(c.categoria) === 0) {
      throw new CampaignError('Configura la tarifa de esta categoría para poder aplicar el presupuesto mensual');
    }
    db.prepare("UPDATE campanas SET estado = 'en_curso', motivo_pausa = NULL, started_at = COALESCE(started_at, ?) WHERE id = ?").run(now(), campanaId);
  }

  function pausar(tenantId, campanaId) {
    const r = db.prepare("UPDATE campanas SET estado = 'pausada', motivo_pausa = 'pausada manualmente' WHERE id = ? AND tenant_id = ? AND estado = 'en_curso'").run(campanaId, tenantId);
    if (!r.changes) throw new CampaignError('La campaña no está en curso');
  }

  function estado(tenantId, campanaId) {
    const c = db.prepare('SELECT * FROM campanas WHERE id = ? AND tenant_id = ?').get(campanaId, tenantId);
    if (!c) throw new CampaignError('Campaña no encontrada');
    const conteo = Object.fromEntries(
      db.prepare('SELECT estado, COUNT(*) n FROM campana_items WHERE campana_id = ? GROUP BY estado').all(campanaId).map((r) => [r.estado, r.n])
    );
    return { ...c, items: conteo };
  }

  // Salud de envío de un tenant: lo que el panel muestra y lo que tick() consulta
  function salud(tenantId) {
    const t = tenantOf(tenantId);
    const { usage, consent } = scoped(tenantId);
    const ahora = now();
    const primero = db.prepare("SELECT MIN(sent_at) m FROM campana_items WHERE tenant_id = ? AND estado = 'enviado'").get(tenantId).m;
    const edadDias = primero ? Math.floor((ahora - primero) / 864e5) : 0;
    const recent = db.prepare("SELECT estado FROM campana_items WHERE tenant_id = ? AND estado IN ('enviado', 'fallido') ORDER BY id DESC LIMIT ?")
      .all(tenantId, BREAKER.window).map((r) => r.estado);
    const sentLast24h = db.prepare("SELECT COUNT(*) c FROM campana_items WHERE tenant_id = ? AND estado = 'enviado' AND sent_at >= ?").get(tenantId, ahora - 864e5).c;
    return {
      tope_diario: dailyCap(edadDias, t.limite_diario_max),
      enviados_hoy: usage.sentToday(),
      dia_de_calentamiento: edadDias + 1,
      ventana_abierta: inWindow(localHour(ahora, t.zona_horaria), t.hora_inicio, t.hora_fin),
      corte: breakerReason({ recent, sentLast24h, optOutsLast24h: consent.optOutsSince(ahora - 864e5) }),
      gasto_mes_usd: usage.monthSpent(),
      presupuesto_mensual_usd: t.presupuesto_mensual_usd,
    };
  }

  // Un envío como máximo por tenant y por llamada. Se invoca cada pocos segundos desde un temporizador.
  async function tick() {
    if (running) return;
    running = true;
    try {
      const activas = db.prepare("SELECT * FROM campanas WHERE estado = 'en_curso' ORDER BY id").all();
      const hechos = new Set();
      for (const camp of activas) {
        if (hechos.has(camp.tenant_id)) continue;
        hechos.add(camp.tenant_id);
        await sendOne(camp).catch((err) => log.error('[campañas] error:', err.message));
      }
    } finally { running = false; }
  }

  async function sendOne(camp) {
    const tenantId = camp.tenant_id;
    const ahora = now();
    if (ahora < (nextAllowed.get(tenantId) || 0)) return;

    const s = salud(tenantId);
    if (s.corte) return pauseAll(tenantId, s.corte);
    if (!s.ventana_abierta || s.enviados_hoy >= s.tope_diario) return; // se reintenta en el próximo tick

    const { consent, usage } = scoped(tenantId);
    const tarifa = usage.rateOf(camp.categoria);
    if (s.presupuesto_mensual_usd > 0 && s.gasto_mes_usd + tarifa > s.presupuesto_mensual_usd) {
      return pauseAll(tenantId, 'presupuesto mensual agotado');
    }

    for (let i = 0; i < MAX_OMITIDOS_POR_TICK; i++) {
      const item = db.prepare("SELECT * FROM campana_items WHERE campana_id = ? AND estado = 'pendiente' ORDER BY id LIMIT 1").get(camp.id);
      if (!item) {
        db.prepare("UPDATE campanas SET estado = 'completa' WHERE id = ?").run(camp.id);
        return;
      }
      // Se revalida al enviar: pudo darse de baja o recibir otra campaña desde que se creó
      const check = consent.canReceiveCampaign(item.user_id, camp.categoria);
      if (!check.ok) {
        db.prepare("UPDATE campana_items SET estado = 'omitido', motivo = ? WHERE id = ?").run(check.motivo, item.id);
        continue;
      }
      try {
        const res = await providerFor(tenantOf(tenantId)).sendTemplate(toWaId(item.user_id), { name: camp.plantilla, language: camp.idioma });
        const costo = usage.record(camp.categoria, 1);
        consent.markCampaignSent(item.user_id);
        db.prepare("UPDATE campana_items SET estado = 'enviado', message_id = ?, costo_usd = ?, sent_at = ? WHERE id = ?").run(res?.id || null, costo, ahora, item.id);
        nextAllowed.set(tenantId, ahora + MIN_GAP_MS + random() * JITTER_MS);
      } catch (err) {
        db.prepare("UPDATE campana_items SET estado = 'fallido', motivo = ? WHERE id = ?").run(String(err.message).slice(0, 200), item.id);
        nextAllowed.set(tenantId, ahora + MIN_GAP_MS);
      }
      return;
    }
  }

  return { crear, iniciar, pausar, estado, salud, tick };
}
