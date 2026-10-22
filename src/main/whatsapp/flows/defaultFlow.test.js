import test from 'node:test';
import assert from 'node:assert/strict';
import { getFlowTemplate } from './defaultFlow.js';

const bienvenida = (marca) => getFlowTemplate(marca).nodes.find((n) => n.id === 'welcome').data.value;

test('cada marca de autos tiene su flujo y ninguna cae en el del restaurante', () => {
  for (const marca of ['Volkswagen', 'JAC', 'KIA']) {
    assert.doesNotMatch(bienvenida(marca), /Ivy|Burgers/, marca);
  }
  assert.match(bienvenida('Restaurante'), /Ivy/);
});

test('"Blanco" no trae mensajes de otro negocio', () => {
  assert.deepEqual(getFlowTemplate('Blanco').edges, []);
  assert.doesNotMatch(bienvenida('Blanco'), /Ivy|KIA|Volkswagen/);
});
