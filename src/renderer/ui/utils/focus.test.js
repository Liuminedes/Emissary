import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFocusIndex } from './focus.js';

test('Tab avanza y da la vuelta al final', () => {
  assert.equal(nextFocusIndex(0, 2), 1);
  assert.equal(nextFocusIndex(1, 2), 0);
});

test('Mayús+Tab retrocede y da la vuelta al inicio', () => {
  assert.equal(nextFocusIndex(1, 2, true), 0);
  assert.equal(nextFocusIndex(0, 2, true), 1);
});

test('foco fuera del diálogo entra por el primero o el último; sin elementos no hay destino', () => {
  assert.equal(nextFocusIndex(-1, 3), 0);
  assert.equal(nextFocusIndex(-1, 3, true), 2);
  assert.equal(nextFocusIndex(0, 1), 0);
  assert.equal(nextFocusIndex(0, 0), -1);
});
