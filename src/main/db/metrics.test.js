import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMetrics, ventanaDesde, DIAS_ACTIVIDAD } from './metrics.js';

// Jueves 22-oct-2026, 15:00 hora local
const NOW = new Date(2026, 9, 22, 15, 0).getTime();
const at = (diasAtras, h = 10) => new Date(2026, 9, 22 - diasAtras, h, 0).getTime();
const msg = (user_id, origen, created_at) => ({ user_id, origen, created_at });

test('conversaciones de hoy y de ayer cuentan clientes distintos, no mensajes', () => {
  const m = buildMetrics({ now: NOW, mensajes: [
    msg('a', 'cliente', at(0, 9)), msg('a', 'bot', at(0, 9)), msg('a', 'cliente', at(0, 11)), msg('b', 'cliente', at(0, 12)),
    msg('a', 'cliente', at(1, 10)), msg('c', 'cliente', at(1, 16)), msg('d', 'cliente', at(1, 23)),
  ] });
  assert.equal(m.conversacionesHoy, 2);
  assert.equal(m.conversacionesAyer, 3);
  assert.equal(m.recibidosHoy, 3);
});

test('los límites del día son la medianoche local', () => {
  const m = buildMetrics({ now: NOW, mensajes: [
    msg('a', 'cliente', new Date(2026, 9, 22, 0, 0, 0).getTime()),      // justo hoy
    msg('b', 'cliente', new Date(2026, 9, 21, 23, 59, 59).getTime()),   // justo ayer
  ] });
  assert.equal(m.conversacionesHoy, 1);
  assert.equal(m.conversacionesAyer, 1);
});

test('actividad: 7 días, del más antiguo al de hoy, por origen', () => {
  const m = buildMetrics({ now: NOW, mensajes: [
    msg('a', 'cliente', at(0)), msg('a', 'bot', at(0)), msg('a', 'bot', at(0)), msg('a', 'asesor', at(0)),
    msg('b', 'cliente', at(6)), msg('b', 'cliente', at(7)), // el de hace 7 días queda fuera de la ventana
  ] });
  assert.equal(m.actividad.length, DIAS_ACTIVIDAD);
  assert.deepEqual(m.actividad.map((d) => d.dia), ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
  assert.equal(m.actividad.at(-1).etiqueta, 'jue');
  assert.deepEqual([m.actividad.at(-1).cliente, m.actividad.at(-1).bot, m.actividad.at(-1).asesor], [1, 2, 1]);
  assert.equal(m.actividad[0].cliente, 1);
  assert.equal(m.actividad.reduce((s, d) => s + d.cliente, 0), 2);
});

test('ventana de lectura: empieza en la medianoche de hace 6 días', () => {
  assert.equal(ventanaDesde(NOW), new Date(2026, 9, 16).getTime());
});

test('leads: embudo por etapa, nuevos en 7 días y calientes solo entre los abiertos', () => {
  const l = (etapa, calificacion, dias) => ({ etapa, calificacion, created_at: at(dias) });
  const m = buildMetrics({ now: NOW, leads: [
    l('nuevo', '🔥 Caliente', 0), l('cotizando', '🔥 Caliente', 3), l('cerrado', '🔥 Caliente', 2),
    l('perdido', '❄️ Frío', 20), l('nuevo', '🟡 Tibio', 9), l('negociacion', '❄️ Frío', 1),
  ] });
  assert.deepEqual(m.embudo, { nuevo: 2, cotizando: 1, negociacion: 1, cerrado: 1, perdido: 1 });
  assert.equal(m.leadsTotal, 6);
  assert.equal(m.leadsNuevos7d, 4);
  assert.equal(m.leadsCalientes, 2); // el cerrado ya no cuenta
});

test('esperando asesor: pidió hablar y nadie le ha respondido', () => {
  const m = buildMetrics({ now: NOW, sesiones: [
    { handoff_mode: 1, advisor_took: 0 }, { handoff_mode: 1, advisor_took: 0 }, { handoff_mode: 1, advisor_took: 1 },
  ] });
  assert.equal(m.esperandoAsesor, 2);
});

test('sin datos: todo en cero y sin romperse', () => {
  const m = buildMetrics({ now: NOW });
  assert.deepEqual([m.conversacionesHoy, m.leadsTotal, m.esperandoAsesor], [0, 0, 0]);
  assert.equal(m.actividad.length, 7);
  assert.equal(m.embudo.nuevo, 0);
});
