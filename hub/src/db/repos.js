// hub/src/db/repos.js
// Repositorios SQLite con la misma interfaz que usa createEngine (src/main/whatsapp/flows).
// Cada fábrica recibe el tenantId y lo cierra en el closure: ninguna consulta puede olvidar el filtro.
import { getFlowTemplate } from '../../../src/main/whatsapp/flows/defaultFlow.js';
import { calculateScore, ETAPAS } from '../../../src/main/db/scoring.js';

const RETENCION_DIAS = 90;
const ORIGENES = ['cliente', 'bot', 'asesor'];
const digits = (s) => String(s || '').replace(/\D/g, '');
const phoneOf = (userId) => digits(String(userId).replace(/[@:].*$/, ''));

export function createTenantRepos(db, tenantId) {
  const NegocioRepo = {
    get: () => db.prepare(
      'SELECT marca, nombre_negocio, nombre_asesor, cargo, telefono, horario, portfolio_url FROM tenants WHERE id = ?'
    ).get(tenantId),
  };

  const SesionesRepo = {
    get(userId) {
      const row = db.prepare('SELECT * FROM sesiones WHERE tenant_id = ? AND user_id = ?').get(tenantId, userId);
      if (!row) {
        return {
          userId, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false,
          lead: {}, catalog: {}, createdAt: Date.now(), updatedAt: Date.now(),
        };
      }
      return {
        userId: row.user_id, step: row.step, pushName: row.push_name,
        advisorTook: !!row.advisor_took, handoffMode: !!row.handoff_mode,
        lead: JSON.parse(row.lead_json || '{}'), catalog: JSON.parse(row.catalog_json || '{}'),
        createdAt: row.created_at, updatedAt: row.updated_at,
      };
    },

    save(s) {
      s.updatedAt = Date.now();
      db.prepare(`
        INSERT INTO sesiones (tenant_id, user_id, step, push_name, advisor_took, handoff_mode, lead_json, catalog_json, created_at, updated_at)
        VALUES (@t, @userId, @step, @pushName, @advisorTook, @handoffMode, @leadJson, @catalogJson, @createdAt, @updatedAt)
        ON CONFLICT (tenant_id, user_id) DO UPDATE SET
          step = @step, push_name = @pushName, advisor_took = @advisorTook, handoff_mode = @handoffMode,
          lead_json = @leadJson, catalog_json = @catalogJson, updated_at = @updatedAt
      `).run({
        t: tenantId, userId: s.userId, step: s.step, pushName: s.pushName || '',
        advisorTook: s.advisorTook ? 1 : 0, handoffMode: s.handoffMode ? 1 : 0,
        leadJson: JSON.stringify(s.lead || {}), catalogJson: JSON.stringify(s.catalog || {}),
        createdAt: s.createdAt || Date.now(), updatedAt: s.updatedAt,
      });
      return s;
    },

    delete: (userId) => { db.prepare('DELETE FROM sesiones WHERE tenant_id = ? AND user_id = ?').run(tenantId, userId); },

    isExcluded: (userId) => !!db.prepare('SELECT 1 FROM excluidos WHERE tenant_id = ? AND telefono = ?').get(tenantId, phoneOf(userId)),
    addExcluded: (phone) => { db.prepare('INSERT OR IGNORE INTO excluidos (tenant_id, telefono) VALUES (?, ?)').run(tenantId, digits(phone)); },
    removeExcluded: (phone) => { db.prepare('DELETE FROM excluidos WHERE tenant_id = ? AND telefono = ?').run(tenantId, digits(phone)); },

    isGloballyPaused: () => db.prepare("SELECT value FROM config_global WHERE tenant_id = ? AND key = 'global_paused'").get(tenantId)?.value === '1',
    setGlobalPause(paused) {
      db.prepare(`
        INSERT INTO config_global (tenant_id, key, value) VALUES (?, 'global_paused', ?)
        ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value
      `).run(tenantId, paused ? '1' : '0');
    },
  };

  const LeadsRepo = {
    listAll: () => db.prepare('SELECT * FROM leads WHERE tenant_id = ? ORDER BY updated_at DESC').all(tenantId),

    upsert(lead) {
      const now = Date.now();
      const existing = db.prepare('SELECT * FROM leads WHERE tenant_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1').get(tenantId, lead.userId);
      const campos = ['nombre', 'telefono', 'interes', 'presupuesto', 'empleo', 'ingreso'];
      const merged = Object.fromEntries(campos.map((k) => [k, lead[k] || existing?.[k] || '']));
      const calificacion = calculateScore(merged);

      if (existing) {
        db.prepare(`
          UPDATE leads SET nombre = @nombre, telefono = @telefono, interes = @interes, presupuesto = @presupuesto,
            empleo = @empleo, ingreso = @ingreso, calificacion = @calificacion, updated_at = @now
          WHERE id = @id AND tenant_id = @t
        `).run({ ...merged, calificacion, now, id: existing.id, t: tenantId });
        return db.prepare('SELECT * FROM leads WHERE id = ?').get(existing.id);
      }
      const info = db.prepare(`
        INSERT INTO leads (tenant_id, user_id, nombre, telefono, interes, presupuesto, empleo, ingreso, etapa, calificacion, created_at, updated_at)
        VALUES (@t, @userId, @nombre, @telefono, @interes, @presupuesto, @empleo, @ingreso, 'nuevo', @calificacion, @now, @now)
      `).run({ ...merged, userId: lead.userId, calificacion, now, t: tenantId });
      return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
    },

    updateEtapa(id, etapa) {
      if (!ETAPAS.includes(etapa)) return null;
      db.prepare('UPDATE leads SET etapa = ?, updated_at = ? WHERE id = ? AND tenant_id = ?').run(etapa, Date.now(), id, tenantId);
      return db.prepare('SELECT * FROM leads WHERE id = ? AND tenant_id = ?').get(id, tenantId);
    },

    // Solo avanza: nunca retrocede una etapa
    updateEtapaByUserId(userId, etapa) {
      const existing = db.prepare('SELECT id, etapa FROM leads WHERE tenant_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1').get(tenantId, userId);
      if (existing && ETAPAS.indexOf(etapa) > ETAPAS.indexOf(existing.etapa || 'nuevo')) {
        db.prepare('UPDATE leads SET etapa = ?, updated_at = ? WHERE id = ?').run(etapa, Date.now(), existing.id);
      }
    },
  };

  const FlujoRepo = {
    getFlow() {
      const row = db.prepare('SELECT nodes, edges FROM flujo_visual WHERE tenant_id = ?').get(tenantId);
      try {
        const nodes = row && JSON.parse(row.nodes);
        if (nodes?.length) return { nodes, edges: JSON.parse(row.edges) };
      } catch { /* flujo corrupto: se cae a la plantilla */ }
      return getFlowTemplate(NegocioRepo.get()?.marca);
    },
    saveFlow(nodes, edges) {
      db.prepare(`
        INSERT INTO flujo_visual (tenant_id, nodes, edges, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (tenant_id) DO UPDATE SET nodes = excluded.nodes, edges = excluded.edges, updated_at = excluded.updated_at
      `).run(tenantId, JSON.stringify(nodes), JSON.stringify(edges), Date.now());
    },
  };

  const CatalogoRepo = {
    listAll() {
      const items = db.prepare('SELECT * FROM catalogo_items WHERE tenant_id = ? AND active = 1 ORDER BY sort_order ASC, id ASC').all(tenantId);
      const variantes = db.prepare('SELECT * FROM catalogo_variantes WHERE item_id = ? ORDER BY precio ASC');
      return items.map((it) => ({ ...it, specs: JSON.parse(it.specs_json || '{}'), variantes: variantes.all(it.id) }));
    },
    getCategories() {
      return db.prepare('SELECT categoria AS name, COUNT(*) AS count FROM catalogo_items WHERE tenant_id = ? AND active = 1 GROUP BY categoria').all(tenantId)
        .map((r) => ({ name: r.name, count: r.count }));
    },
    upsertItem(item) {
      const info = db.prepare(`
        INSERT INTO catalogo_items (tenant_id, categoria, nombre, emoji, descripcion, specs_json, sort_order, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(tenantId, item.categoria || 'General', item.nombre, item.emoji || '', item.descripcion || '', JSON.stringify(item.specs || {}), item.sort_order || 0);
      const insertVar = db.prepare('INSERT INTO catalogo_variantes (item_id, version, precio, bono, nota, year) VALUES (?, ?, ?, ?, ?, ?)');
      for (const v of item.variantes || []) insertVar.run(info.lastInsertRowid, v.version, v.precio || 0, v.bono || 0, v.nota || '', v.year || 0);
      return Number(info.lastInsertRowid);
    },
  };

  const HistorialRepo = {
    add(userId, origen, texto) {
      if (!ORIGENES.includes(origen) || !texto) return;
      db.prepare('INSERT INTO historial (tenant_id, user_id, origen, texto, created_at) VALUES (?, ?, ?, ?, ?)').run(tenantId, userId, origen, texto, Date.now());
    },
    listConversations() {
      return db.prepare(`
        SELECT h.user_id, h.origen AS ultimo_origen, h.texto AS ultimo_texto, h.created_at AS ultimo_at,
               COALESCE(NULLIF(l.nombre, ''), NULLIF(s.push_name, ''), h.user_id) AS nombre,
               COALESCE(s.advisor_took, 0) AS advisor_took, COALESCE(s.handoff_mode, 0) AS handoff_mode
        FROM historial h
        JOIN (SELECT user_id, MAX(id) AS max_id FROM historial WHERE tenant_id = @t GROUP BY user_id) u ON u.max_id = h.id
        LEFT JOIN sesiones s ON s.tenant_id = @t AND s.user_id = h.user_id
        LEFT JOIN leads l ON l.id = (SELECT MAX(id) FROM leads WHERE tenant_id = @t AND user_id = h.user_id)
        WHERE h.tenant_id = @t
        ORDER BY h.id DESC LIMIT 200
      `).all({ t: tenantId });
    },
    listMessages: (userId, limit = 300) => db.prepare(
      'SELECT * FROM (SELECT * FROM historial WHERE tenant_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC'
    ).all(tenantId, userId, limit),
    purgeOld: (dias = RETENCION_DIAS) => { db.prepare('DELETE FROM historial WHERE tenant_id = ? AND created_at < ?').run(tenantId, Date.now() - dias * 864e5); },
  };

  return { NegocioRepo, SesionesRepo, LeadsRepo, FlujoRepo, CatalogoRepo, HistorialRepo };
}
