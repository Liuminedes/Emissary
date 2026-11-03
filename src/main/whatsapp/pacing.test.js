import test from 'node:test';
import assert from 'node:assert/strict';
import { replyDelayMs, reconnectDelayMs, createReplyLimiter } from './pacing.js';

test('la pausa crece con el largo del mensaje y siempre queda entre 1,2 y 6 s', () => {
  const corto = replyDelayMs('Hola', () => 0.5);
  const largo = replyDelayMs('x'.repeat(300), () => 0.5);
  assert.ok(corto >= 1200 && corto < largo && largo <= 6000);
  assert.equal(replyDelayMs('x'.repeat(5000), () => 1), 6000);
  assert.equal(replyDelayMs('', () => 0), 1200);
});

test('la pausa varía de un envío a otro', () => {
  const valores = new Set(Array.from({ length: 20 }, () => replyDelayMs('Hola, ¿en qué te ayudo?')));
  assert.ok(valores.size > 5);
});

test('la reconexión espera cada vez más y se detiene en 60 s', () => {
  assert.deepEqual([0, 1, 2, 3, 10].map(reconnectDelayMs), [3000, 6000, 12000, 24000, 60000]);
});

test('el tope por chat corta la ráfaga y se libera con el tiempo', () => {
  let t = 0;
  const permitir = createReplyLimiter({ max: 3, windowMs: 1000, now: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => permitir('a')), [true, true, true, false]);
  assert.equal(permitir('b'), true, 'otro chat no se ve afectado');
  t = 1500;
  assert.equal(permitir('a'), true);
});
