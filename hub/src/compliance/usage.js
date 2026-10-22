// hub/src/compliance/usage.js
// Consumo y costo estimado por tenant. La tarifa la configura el operador: aquí no se asume ninguna.
import { localDay, localMonth } from './time.js';

export function createUsage(db, tenantId, { now = Date.now } = {}) {
  const tenant = () => db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
  const tz = () => tenant().zona_horaria;
  const rateOf = (categoria) => (categoria === 'service' ? 0 : tenant()[`tarifa_${categoria}_usd`] || 0);

  return {
    rateOf,

    // Suma un mensaje enviado; devuelve el costo estimado aplicado
    record(categoria, cantidad = 1) {
      const costo = rateOf(categoria) * cantidad;
      db.prepare(`
        INSERT INTO uso (tenant_id, dia, categoria, cantidad, costo_usd) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (tenant_id, dia, categoria) DO UPDATE SET cantidad = cantidad + excluded.cantidad, costo_usd = costo_usd + excluded.costo_usd
      `).run(tenantId, localDay(now(), tz()), categoria, cantidad, costo);
      return costo;
    },

    sentToday: () => db.prepare(
      "SELECT COALESCE(SUM(cantidad), 0) n FROM uso WHERE tenant_id = ? AND dia = ? AND categoria IN ('marketing', 'utility')"
    ).get(tenantId, localDay(now(), tz())).n,

    monthSpent: () => db.prepare('SELECT COALESCE(SUM(costo_usd), 0) s FROM uso WHERE tenant_id = ? AND dia LIKE ?')
      .get(tenantId, `${localMonth(now(), tz())}-%`).s,

    // Resumen del panel de costos para un mes (YYYY-MM; por defecto el actual)
    summary(mes = localMonth(now(), tz())) {
      const t = tenant();
      const porCategoria = db.prepare(`
        SELECT categoria, SUM(cantidad) AS mensajes, SUM(costo_usd) AS costo_usd
        FROM uso WHERE tenant_id = ? AND dia LIKE ? GROUP BY categoria ORDER BY categoria
      `).all(tenantId, `${mes}-%`).map((r) => ({ ...r }));
      const costo = porCategoria.reduce((a, r) => a + r.costo_usd, 0);
      const [y, m] = mes.split('-').map(Number);
      const desde = Date.UTC(y, m - 1, 1);
      const hasta = Date.UTC(y, m, 1);
      const leads = db.prepare('SELECT COUNT(*) c FROM leads WHERE tenant_id = ? AND created_at >= ? AND created_at < ?').get(tenantId, desde, hasta).c;
      const campanas = db.prepare(`
        SELECT c.id, c.nombre, c.categoria, c.estado,
               SUM(i.estado = 'enviado') AS enviados, SUM(i.estado = 'fallido') AS fallidos,
               SUM(i.estado = 'omitido') AS omitidos, COALESCE(SUM(i.costo_usd), 0) AS costo_usd
        FROM campanas c LEFT JOIN campana_items i ON i.campana_id = c.id
        WHERE c.tenant_id = ? AND c.created_at >= ? AND c.created_at < ? GROUP BY c.id ORDER BY c.id
      `).all(tenantId, desde, hasta).map((r) => ({ ...r }));
      return {
        mes,
        estimado: true, // el costo real lo factura Meta; esto usa las tarifas configuradas
        tarifas_configuradas: Boolean(t.tarifa_marketing_usd || t.tarifa_utility_usd),
        por_categoria: porCategoria,
        costo_total_usd: costo,
        presupuesto_mensual_usd: t.presupuesto_mensual_usd,
        presupuesto_restante_usd: t.presupuesto_mensual_usd > 0 ? Math.max(0, t.presupuesto_mensual_usd - costo) : null,
        leads_nuevos: leads,
        costo_por_lead_usd: leads > 0 ? costo / leads : null,
        campanas,
      };
    },
  };
}
