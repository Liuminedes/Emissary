import test from 'node:test';
import assert from 'node:assert/strict';
import { leadsToCsv, escapeCell, formatDate, HEADERS, SEPARATOR } from './leadsCsv.js';

const lead = (extra = {}) => ({
  id: 1, nombre: 'María Pérez', telefono: '+573001112233', interes: 'Sportage', presupuesto: '$80M – $120M', empleo: 'Empleado',
  ingreso: '5 millones', etapa: 'cotizando', calificacion: '🔥 Caliente', created_at: new Date(2026, 9, 22, 14, 5).getTime(), updated_at: new Date(2026, 9, 23, 9, 30).getTime(), ...extra,
});

test('encabezados y una fila por lead, con saltos CRLF y fin de línea', () => {
  const csv = leadsToCsv([lead(), lead({ id: 2, nombre: 'Luis' })]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], HEADERS.join(SEPARATOR));
  assert.equal(lines.length, 4); // encabezado + 2 filas + línea vacía final
  assert.equal(lines[3], '');
});

test('columnas: etapa en español, calificación sin emoji, fechas legibles y notas unidas', () => {
  const [, fila] = leadsToCsv([lead()], new Map([[1, ['Llamar el lunes', 'Pidió descuento']]])).split('\r\n');
  const c = fila.split(SEPARATOR);
  assert.equal(c[0], 'María Pérez');
  assert.equal(c[6], 'Cotizando');
  assert.equal(c[7], 'Caliente');
  assert.equal(c[8], '2026-10-22 14:05');
  assert.equal(c[9], '2026-10-23 09:30');
  assert.equal(c[10], 'Llamar el lunes | Pidió descuento');
});

test('teléfono como texto de solo dígitos para que Excel no lo pase a notación científica', () => {
  const [, fila] = leadsToCsv([lead({ telefono: '+57 300 111 2233' })]).split('\r\n');
  assert.equal(fila.split(SEPARATOR)[1], '="573001112233"');
  assert.equal(leadsToCsv([lead({ telefono: '' })]).split('\r\n')[1].split(SEPARATOR)[1], '');
  // un teléfono con intento de fórmula queda reducido a dígitos
  assert.equal(leadsToCsv([lead({ telefono: '=cmd|calc' })]).split('\r\n')[1].split(SEPARATOR)[1], '');
});

test('escapar: separador, comillas y saltos de línea no rompen la fila', () => {
  assert.equal(escapeCell('a;b'), '"a;b"');
  assert.equal(escapeCell('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(escapeCell('línea 1\nlínea 2'), 'línea 1 línea 2');
  assert.equal(escapeCell(null), '');
  const fila = leadsToCsv([lead({ nombre: 'Ana; "la jefa"' })]).split('\r\n')[1];
  assert.ok(fila.startsWith('"Ana; ""la jefa"""')); // la celda queda entrecomillada y con las comillas duplicadas
});

test('inyección de fórmulas: =, +, -, @ al inicio se neutralizan', () => {
  for (const peligro of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)']) {
    assert.ok(escapeCell(peligro).replace(/^"/, '').startsWith("'"), peligro);
  }
  assert.equal(escapeCell('Pérez - Gómez'), 'Pérez - Gómez'); // un guion en medio no se toca
});

test('fecha vacía y formato con ceros', () => {
  assert.equal(formatDate(0), '');
  assert.equal(formatDate(new Date(2026, 0, 5, 3, 7).getTime()), '2026-01-05 03:07');
});
