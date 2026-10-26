import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFileLogger } from './logger.js';

const conDir = (fn) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'emissary-log-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};
const fixedNow = () => new Date('2026-10-26T15:04:05.000Z');

test('escribe una línea por registro con fecha, nivel y mensaje; crea la carpeta si no existe', () => conDir((dir) => {
  const log = createFileLogger({ dir: path.join(dir, 'logs', 'sub'), now: fixedNow });
  log.error('algo falló', 42);
  log.warn('aviso');
  log.info({ a: 1 });
  const lines = readFileSync(log.file, 'utf8').trim().split('\n');
  assert.equal(lines[0], '2026-10-26T15:04:05.000Z ERROR algo falló 42');
  assert.equal(lines[1], '2026-10-26T15:04:05.000Z WARN  aviso');
  assert.match(lines[2], /INFO  \{ a: 1 \}/);
}));

test('un Error se guarda con su traza', () => conDir((dir) => {
  const log = createFileLogger({ dir, now: fixedNow });
  log.error('[bot] error:', new Error('boom'));
  const texto = readFileSync(log.file, 'utf8');
  assert.match(texto, /ERROR \[bot\] error: Error: boom/);
  assert.match(texto, /at /); // trae la traza
}));

test('rotación: al pasar el tamaño máximo se archiva y solo se conservan N anteriores', () => conDir((dir) => {
  const log = createFileLogger({ dir, maxBytes: 200, keep: 2, now: fixedNow });
  for (let i = 0; i < 12; i++) log.error(`registro numero ${i} ` + 'x'.repeat(60));
  const archivos = readdirSync(dir).sort();
  assert.deepEqual(archivos, ['emissary.log', 'emissary.log.1', 'emissary.log.2']); // nunca más de keep + 1
  // el más reciente está en el archivo actual y lo más viejo ya se descartó
  assert.match(readFileSync(path.join(dir, 'emissary.log'), 'utf8'), /numero 11/);
  const todo = archivos.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('');
  assert.doesNotMatch(todo, /numero 0 /);
}));

test('una línea gigante se recorta', () => conDir((dir) => {
  const log = createFileLogger({ dir, now: fixedNow });
  log.error('y'.repeat(50_000));
  assert.ok(readFileSync(log.file, 'utf8').length < 4200);
}));

test('si no se puede escribir, no lanza (el registro nunca tumba la app)', () => conDir((dir) => {
  const bloqueo = path.join(dir, 'es-un-archivo');
  writeFileSync(bloqueo, 'x');
  const log = createFileLogger({ dir: path.join(bloqueo, 'logs') }); // la "carpeta" cuelga de un archivo: no se puede crear
  assert.doesNotThrow(() => log.error('no se podrá guardar'));
  assert.equal(existsSync(path.join(bloqueo, 'logs')), false);
}));
