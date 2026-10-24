// src/main/db/metrics.js
// Métricas del Dashboard calculadas sobre filas ya leídas. Módulo puro (sin SQLite) para poder probarlo.
// Los días se miden en la hora local del equipo, que es la del asesor.
import { ETAPAS } from './scoring.js';

export const DIAS_ACTIVIDAD = 7;

const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
// Medianoche de hace `n` días respetando cambios de horario (no resta 24 h fijas)
const daysAgo = (ms, n) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n).getTime(); };
const keyOf = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Desde cuándo hay que leer mensajes para cubrir toda la ventana
export const ventanaDesde = (now = Date.now()) => daysAgo(now, DIAS_ACTIVIDAD - 1);

/**
 * @param {number} p.now
 * @param {{user_id:string, origen:string, created_at:number}[]} p.mensajes  mensajes desde ventanaDesde(now)
 * @param {{etapa:string, calificacion:string, created_at:number}[]} p.leads  todos los leads
 * @param {{handoff_mode:number, advisor_took:number}[]} p.sesiones            sesiones en handoff
 */
export function buildMetrics({ now = Date.now(), mensajes = [], leads = [], sesiones = [] }) {
  const hoy = startOfDay(now);
  const ayer = daysAgo(now, 1);

  const dias = Array.from({ length: DIAS_ACTIVIDAD }, (_, i) => {
    const inicio = daysAgo(now, DIAS_ACTIVIDAD - 1 - i);
    return { dia: keyOf(inicio), etiqueta: DIAS_CORTOS[new Date(inicio).getDay()], cliente: 0, bot: 0, asesor: 0, inicio };
  });
  const porDia = new Map(dias.map((d) => [d.dia, d]));

  const conversaciones = { hoy: new Set(), ayer: new Set() };
  let recibidosHoy = 0;
  for (const m of mensajes) {
    const k = keyOf(m.created_at);
    const d = porDia.get(k);
    if (d && d[m.origen] !== undefined) d[m.origen] += 1;
    if (m.created_at >= hoy) { conversaciones.hoy.add(m.user_id); if (m.origen === 'cliente') recibidosHoy += 1; }
    else if (m.created_at >= ayer) conversaciones.ayer.add(m.user_id);
  }

  const embudo = Object.fromEntries(ETAPAS.map((e) => [e, 0]));
  const desdeSemana = daysAgo(now, DIAS_ACTIVIDAD - 1);
  let nuevos7d = 0;
  let calientes = 0;
  for (const l of leads) {
    if (embudo[l.etapa] !== undefined) embudo[l.etapa] += 1;
    if (l.created_at >= desdeSemana) nuevos7d += 1;
    const abierto = l.etapa !== 'cerrado' && l.etapa !== 'perdido';
    if (abierto && /caliente/i.test(l.calificacion || '')) calientes += 1;
  }

  return {
    conversacionesHoy: conversaciones.hoy.size,
    conversacionesAyer: conversaciones.ayer.size,
    recibidosHoy,
    leadsTotal: leads.length,
    leadsNuevos7d: nuevos7d,
    leadsCalientes: calientes,
    // El cliente pidió hablar con un asesor y nadie le ha respondido todavía
    esperandoAsesor: sesiones.filter((s) => s.handoff_mode && !s.advisor_took).length,
    embudo,
    actividad: dias.map(({ inicio, ...d }) => d),
  };
}
