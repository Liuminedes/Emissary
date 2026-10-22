import test from 'node:test';
import assert from 'node:assert/strict';
import { isReset, isHandoff } from './keywords.js';

test('reset: solo el mensaje completo', () => {
  assert.equal(isReset('menu'), true);
  assert.equal(isReset(' Menú! '), true);
  assert.equal(isReset('Inicio'), true);
  assert.equal(isReset('quiero ver el menu de opciones del carro'), false);
  assert.equal(isReset('como esta el precio de inicio'), false);
});

test('handoff: palabra completa en mensaje corto', () => {
  assert.equal(isHandoff('asesor'), true);
  assert.equal(isHandoff('Quiero hablar con un asesor'), true);
  assert.equal(isHandoff('necesito un humano'), true);
  assert.equal(isHandoff('quiero hablar del precio'), false);
  assert.equal(isHandoff('la persona que me atendió ayer'), false);
  assert.equal(isHandoff('asesores'), false);
  assert.equal(isHandoff('me gustaria saber si el asesor puede enviarme la ficha tecnica completa por favor'), false);
});
