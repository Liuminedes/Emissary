// src/main/db/repositories/metricas.repo.js
import { getDb } from '../db.js';
import { buildMetrics, ventanaDesde } from '../metrics.js';

export const MetricasRepo = {
  resumen(now = Date.now()) {
    const db = getDb();
    return buildMetrics({
      now,
      mensajes: db.prepare('SELECT user_id, origen, created_at FROM historial WHERE created_at >= ?').all(ventanaDesde(now)),
      leads: db.prepare('SELECT etapa, calificacion, created_at FROM leads').all(),
      sesiones: db.prepare('SELECT handoff_mode, advisor_took FROM sesiones WHERE handoff_mode = 1').all(),
    });
  },
};
