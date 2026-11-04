import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLogArgs } from './formatLog.js';

test('un objeto del log de Baileys deja ver el motivo en vez de [object Object]', () => {
  const err = Object.assign(new Error('Stream Errored (restart required)'), { output: { statusCode: 515 } });
  const texto = formatLogArgs([{ err, node: { tag: 'stream:error', attrs: { code: '515' } } }, 'stream errored out']);
  assert.match(texto, /Stream Errored \(restart required\)/);
  assert.match(texto, /"statusCode":515/);
  assert.match(texto, /"code":"515"/);
  assert.match(texto, /stream errored out$/);
  assert.doesNotMatch(texto, /\[object Object\]/);
});

test('textos, errores sueltos y referencias circulares no rompen el registro', () => {
  assert.equal(formatLogArgs(['a', 2, null]), 'a 2 null');
  assert.equal(formatLogArgs([new TypeError('mala')]), 'TypeError: mala');
  const a = { n: 1 }; a.yo = a;
  assert.match(formatLogArgs([a]), /\[circular\]/);
});

test('los datos binarios no inundan el registro y las líneas largas se cortan', () => {
  assert.match(formatLogArgs([{ clave: Buffer.from('secreto') }]), /\[Buffer\]/);
  assert.ok(formatLogArgs(['x'.repeat(5000)]).length <= 601);
});
