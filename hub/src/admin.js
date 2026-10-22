// hub/src/admin.js
// API de administración (JSON): consentimientos, campañas, ajustes de envío y panel de costos.
// Se desactiva si no hay ADMIN_TOKEN. El token va en el header Authorization: Bearer (nunca en la URL).
import { safeEqual } from './security.js';
import { readBody } from './server.js';
import { CampaignError } from './campaigns.js';
import { createConsent, normalizeNumber } from './compliance/consent.js';
import { createUsage } from './compliance/usage.js';
import { toUserId } from './channel.js';

// Ajustes editables y su rango válido
const AJUSTES = {
  limite_diario_max: [1, 10000, true],
  presupuesto_mensual_usd: [0, 1e6, false],
  tarifa_marketing_usd: [0, 100, false],
  tarifa_utility_usd: [0, 100, false],
  hora_inicio: [0, 23, true],
  hora_fin: [1, 24, true],
};

export function createAdmin({ db, campaigns, adminToken, now = Date.now }) {
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  function tenantFrom(slug) {
    const t = slug
      ? db.prepare('SELECT * FROM tenants WHERE slug = ?').get(String(slug))
      : (db.prepare('SELECT * FROM tenants').all().length === 1 ? db.prepare('SELECT * FROM tenants').get() : null);
    if (!t) throw Object.assign(new Error('Tenant no encontrado (indica ?tenant=slug)'), { status: 404 });
    return t;
  }

  // Devuelve true si atendió la petición
  return async function handle(req, res, url) {
    if (!adminToken || !url.pathname.startsWith('/admin/')) return false;

    const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (!safeEqual(bearer, adminToken)) { json(res, 401, { error: 'No autorizado' }); return true; }

    try {
      const body = req.method === 'POST' ? JSON.parse((await readBody(req)).toString('utf8') || '{}') : {};
      const t = tenantFrom(url.searchParams.get('tenant') || body.tenant);
      const p = url.pathname;
      let m;

      if (req.method === 'GET' && p === '/admin/costos') {
        return json(res, 200, createUsage(db, t.id, { now }).summary(url.searchParams.get('mes') || undefined)), true;
      }
      if (req.method === 'GET' && p === '/admin/salud') {
        return json(res, 200, campaigns.salud(t.id)), true;
      }
      if (req.method === 'POST' && p === '/admin/config') {
        const sets = [];
        const vals = {};
        for (const [k, [min, max, entero]] of Object.entries(AJUSTES)) {
          if (body[k] === undefined) continue;
          const v = Number(body[k]);
          if (!Number.isFinite(v) || v < min || v > max || (entero && !Number.isInteger(v))) throw new CampaignError(`${k} fuera de rango (${min} a ${max})`);
          sets.push(`${k} = @${k}`); vals[k] = v;
        }
        if (!sets.length) throw new CampaignError('Sin ajustes válidos');
        if ((vals.hora_inicio ?? t.hora_inicio) >= (vals.hora_fin ?? t.hora_fin)) throw new CampaignError('hora_inicio debe ser menor que hora_fin');
        db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = @id`).run({ ...vals, id: t.id });
        return json(res, 200, { ok: true }), true;
      }
      if (req.method === 'POST' && p === '/admin/consentimientos') {
        if (!Array.isArray(body.contactos) || body.contactos.length > 5000) throw new CampaignError('contactos inválidos');
        const consent = createConsent(db, t.id, { now });
        let registrados = 0;
        for (const c of body.contactos) {
          const n = normalizeNumber(c?.numero);
          if (n && c.fuente) { consent.registerOptIn(toUserId(n), c.fuente); registrados++; }
        }
        return json(res, 200, { registrados, descartados: body.contactos.length - registrados }), true;
      }
      if (req.method === 'POST' && p === '/admin/campanas') {
        return json(res, 201, campaigns.crear(t.id, body)), true;
      }
      if ((m = p.match(/^\/admin\/campanas\/(\d+)$/)) && req.method === 'GET') {
        return json(res, 200, campaigns.estado(t.id, Number(m[1]))), true;
      }
      if ((m = p.match(/^\/admin\/campanas\/(\d+)\/(iniciar|pausar)$/)) && req.method === 'POST') {
        campaigns[m[2]](t.id, Number(m[1]));
        return json(res, 200, { ok: true }), true;
      }
      json(res, 404, { error: 'Ruta no encontrada' });
    } catch (err) {
      const status = err instanceof CampaignError ? 400 : err instanceof SyntaxError ? 400 : err.status || 500;
      json(res, status, { error: status === 500 ? 'Error interno' : err.message });
    }
    return true;
  };
}
