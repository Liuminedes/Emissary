import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFiltro, applySegmento, toVcf, toCsvContactos, enPartes, revisarTopes } from './segmentos.js';

const DIA = 86_400_000;
const now = 100 * DIA;
const lead = (o) => ({ user_id: '573001112233@s.whatsapp.net', nombre: 'Ana', telefono: '', interes: 'Sportage', etapa: 'cotizando', calificacion: '🔥 Caliente', updated_at: now - 10 * DIA, ...o });
const LEADS = [
  lead({}),
  lead({ user_id: '573004445566@s.whatsapp.net', nombre: 'Luis', etapa: 'nuevo', calificacion: '❄️ Frío', interes: 'Picanto', updated_at: now - 2 * DIA }),
  lead({ user_id: '99887766@lid', nombre: 'Oculto', telefono: '+57 315 999 8888' }),
  lead({ user_id: '55@lid', nombre: 'Sin número', telefono: '' }),
  lead({ user_id: '573007778899@s.whatsapp.net', nombre: 'Baja', etapa: 'cotizando' }),
];

test('el filtro se sanea: etapas y calificaciones inválidas se descartan', () => {
  assert.deepEqual(normalizeFiltro({ etapas: ['nuevo', 'x'], calificaciones: ['caliente', 'y'], diasSinContacto: '7', interes: '  sport ' }),
    { etapas: ['nuevo'], calificaciones: ['caliente'], diasSinContacto: 7, interes: 'sport' });
  assert.deepEqual(normalizeFiltro(undefined), { etapas: [], calificaciones: [], diasSinContacto: 0, interes: '' });
  assert.equal(normalizeFiltro({ diasSinContacto: -5 }).diasSinContacto, 0);
});

test('filtra por etapa, calificación, interés y días sin contacto', () => {
  const ctx = { now, bajas: new Set(['573007778899']) };
  assert.deepEqual(applySegmento(LEADS, { etapas: ['nuevo'] }, ctx).contactos.map((c) => c.nombre), ['Luis']);
  assert.deepEqual(applySegmento(LEADS, { calificaciones: ['frio'] }, ctx).contactos.map((c) => c.nombre), ['Luis']);
  assert.deepEqual(applySegmento(LEADS, { interes: 'sportáge' }, ctx).contactos.map((c) => c.nombre), ['Ana', 'Oculto']);
  assert.deepEqual(applySegmento(LEADS, { diasSinContacto: 7 }, ctx).contactos.map((c) => c.nombre), ['Ana', 'Oculto']);
});

test('la baja y la falta de número se cuentan aparte y nunca entran', () => {
  const r = applySegmento(LEADS, {}, { now, bajas: new Set(['573007778899']) });
  assert.deepEqual(r.contactos.map((c) => c.nombre), ['Ana', 'Luis', 'Oculto']);
  assert.equal(r.enBaja, 1);
  assert.equal(r.sinNumero, 1);
  assert.equal(r.contactos[2].numero, '573159998888', 'el id oculto usa el teléfono que dio el cliente');
});

test('el último contacto real (historial) pesa más que la fecha del lead', () => {
  const ultimoContacto = new Map([['573001112233@s.whatsapp.net', now - 1 * DIA]]);
  const r = applySegmento([lead({})], { diasSinContacto: 7 }, { now, ultimoContacto });
  assert.equal(r.contactos.length, 0);
});

test('un mismo número en dos leads se cuenta una vez', () => {
  assert.equal(applySegmento([lead({}), lead({ nombre: 'Ana 2' })], {}, { now }).contactos.length, 1);
});

test('vCard escapa comas, saltos de línea y usa el número si no hay nombre', () => {
  const v = toVcf([{ nombre: 'Pérez, Ana\nX', numero: '573001112233' }, { nombre: '', numero: '573004445566' }]);
  assert.match(v, /FN:Pérez\\, Ana X\r\n/);
  assert.match(v, /TEL;TYPE=CELL:\+573001112233\r\n/);
  assert.match(v, /FN:\+573004445566/);
  assert.equal((v.match(/BEGIN:VCARD/g) || []).length, 2);
});

test('el CSV protege fórmulas y deja el teléfono como texto', () => {
  const csv = toCsvContactos([{ nombre: '=cmd|calc', numero: '573001112233', etapa: 'nuevo', calificacion: '🔥 Caliente' }]);
  assert.match(csv, /'=cmd\|calc;="573001112233";nuevo;Caliente/);
});

test('las listas se parten de a 256', () => {
  const todos = Array.from({ length: 600 }, (_, i) => ({ numero: String(i) }));
  assert.deepEqual(enPartes(todos).map((p) => p.length), [256, 256, 88]);
  assert.deepEqual(enPartes([]), []);
});

test('los topes de envíos masivos dicen cuál ventana se agotó', () => {
  assert.deepEqual(revisarTopes({ dia: 0, semana: 0, mes: 0 }, 20), { ok: true, disponible: 20 });
  const r = revisarTopes({ dia: 15, semana: 15, mes: 15 }, 10);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /hoy solo puedes enviar 5/);
  assert.match(revisarTopes({ dia: 0, semana: 55, mes: 55 }, 10).mensaje, /esta semana solo puedes enviar 5/);
  assert.match(revisarTopes({ dia: 0, semana: 0, mes: 148 }, 5).mensaje, /este mes solo puedes enviar 2/);
  assert.equal(revisarTopes({ dia: 25, semana: 25, mes: 25 }, 1).disponible, 0);
});
