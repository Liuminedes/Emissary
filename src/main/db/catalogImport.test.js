import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogRows, planImport, buildOps } from './catalogImport.js';

const HEAD = ['Modelo', 'Especificaciones', 'Codigo', 'Version', 'Año Modelo', 'PRECIO LISTA SUGERIDO', 'BONO ANIVERSARIO', 'PRECIO VENTA SUGERIDO', 'Acción Adicional'];
const fila = (modelo, version, year, lista, bono, venta, nota = '') => [modelo, 'specs', 'COD', version, year, lista, bono, venta, nota];
const EXCEL = [
  [], ['Lista de Precios · Octubre'], HEAD,
  ['ICE'],
  fila('Picanto', 'Vibrant MT', 2027, 59990000, 1000000, 58990000, 'Telemetría gratis'),
  fila('Picanto', 'Zenith AT', 2027, 71990000, 2000000, 69990000),
  fila('K3 Sedan', 'Desire MT', 2027, 79990000, 7000000, 72990000),
  fila('Sportage HEV', 'Vibrant HEV', 2027, 151990000, 1000000, 150990000),
  ['Eléctrico'],
  fila('EV3 ', 'Air', 2027, 126990000, 2000000, 124990000),
  fila('Tasman', 'Desire', 2026, 191990000, 2000000, 189990000),
  fila('Tasman', 'Desire', 2027, 193990000, 1000000, 192990000),
  fila('Raro', 'Sin precio', 2027, '', '', ''),
  fila('Raro', '', 2027, 1, 1, 5),
];

test('detecta columnas, usa el precio de venta sugerido y agrupa por modelo', () => {
  const p = parseCatalogRows(EXCEL);
  assert.equal(p.columnas.precio, 'PRECIO VENTA SUGERIDO');
  assert.deepEqual(p.items.map((i) => i.nombre), ['Picanto', 'K3 Sedan', 'Sportage HEV', 'EV3', 'Tasman']);
  const picanto = p.items[0];
  assert.deepEqual(picanto.variantes.map((v) => [v.version, v.precio, v.year, v.nota]), [['Vibrant MT', 58990000, 2027, 'Telemetría gratis'], ['Zenith AT', 69990000, 2027, '']]);
  assert.equal(p.items[4].variantes.length, 2, 'misma versión en años distintos son dos versiones');
});

test('la categoría sale del título de sección y de HEV', () => {
  const cat = Object.fromEntries(parseCatalogRows(EXCEL).items.map((i) => [i.nombre, i.categoria]));
  assert.deepEqual(cat, { Picanto: 'Gasolina', 'K3 Sedan': 'Gasolina', 'Sportage HEV': 'Híbrido', EV3: 'Eléctrico', Tasman: 'Eléctrico' });
});

test('las filas sin versión o sin precio se omiten con su motivo', () => {
  const { omitidas } = parseCatalogRows(EXCEL);
  assert.deepEqual(omitidas.map((o) => [o.modelo, o.motivo]), [['Raro', 'No tiene precio'], ['Raro', 'No tiene versión']].map(([m, x]) => [m, x]));
});

test('precios como texto con símbolo y puntos, y error si faltan columnas', () => {
  const p = parseCatalogRows([['Modelo', 'Versión', 'Precio'], ['A', 'x', '$ 59.990.000']]);
  assert.equal(p.items[0].variantes[0].precio, 59990000);
  assert.match(parseCatalogRows([['Foo', 'Bar']]).error, /Modelo, Versión y Precio/);
});

const actual = () => [
  { id: 1, nombre: 'K3 SEDÁN', sort_order: 2, active: 1, specs: {}, variantes: [{ version: 'DESIRE MT', year: 2027, precio: 79990000, bono: 7000000, nota: '' }, { version: 'Viejo', year: 2020, precio: 1, bono: 0, nota: '' }] },
  { id: 2, nombre: 'Soluto', sort_order: 3, active: 1, specs: {}, variantes: [{ version: 'Emotion', year: 2027, precio: 5, bono: 0, nota: '' }] },
];

test('empareja por nombre sin tildes ni mayúsculas, quita el bono doble y propone lo nuevo', () => {
  const plan = planImport(actual(), parseCatalogRows(EXCEL));
  const k3 = plan.cambios.find((c) => c.modelo === 'K3 SEDÁN');
  assert.deepEqual([k3.tipo, k3.antes, k3.precio], ['precio', 79990000, 72990000]);
  assert.equal(plan.resumen.nuevas, 6); // Picanto 2 + Sportage + EV3 + Tasman 2; la del K3 es cambio de precio
  assert.deepEqual(plan.resumen.ausentes, 2); // 'Viejo' del K3 y el modelo Soluto
});

test('sin quitar ausentes se conservan; quitándolos se descartan y el modelo ausente se desactiva', () => {
  const plan = planImport(actual(), parseCatalogRows(EXCEL));
  const k3 = (ops) => ops.find((i) => i.id === 1);
  assert.deepEqual(k3(buildOps(plan, false)).variantes.map((v) => v.version).sort(), ['DESIRE MT', 'Viejo']);
  assert.equal(k3(buildOps(plan, false)).variantes.find((v) => v.version === 'DESIRE MT').bono, 0);
  const ops = buildOps(plan, true);
  assert.deepEqual(k3(ops).variantes.map((v) => v.version), ['DESIRE MT']);
  assert.equal(ops.find((i) => i.id === 2).active, 0);
  assert.equal(buildOps(plan, false).some((i) => i.id === 2), false);
});

test('importar dos veces el mismo archivo no cambia nada la segunda vez', () => {
  const parsed = parseCatalogRows(EXCEL);
  const aplicado = buildOps(planImport([], parsed)).map((it, i) => ({ ...it, id: i + 1, active: 1 }));
  const plan = planImport(aplicado, parsed);
  assert.deepEqual([plan.resumen.nuevas, plan.resumen.actualizadas, plan.resumen.ausentes], [0, 0, 0]);
  assert.equal(plan.resumen.sinCambios, 7);
});
