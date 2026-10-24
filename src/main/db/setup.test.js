import test from 'node:test';
import assert from 'node:assert/strict';
import { setupSteps, isConfigured } from './setup.js';

const completo = { nombre_negocio: 'Demo', marca: 'KIA', nombre_asesor: 'Ana', telefono: '573001112233' };

test('configuración completa', () => {
  assert.deepEqual(setupSteps(completo), { negocio: true, asesor: true });
  assert.equal(isConfigured(completo), true);
});

test('falta cada dato: negocio, marca, asesor o teléfono válido', () => {
  assert.equal(isConfigured({ ...completo, nombre_negocio: '  ' }), false);
  assert.equal(setupSteps({ ...completo, marca: '' }).negocio, false);
  assert.equal(setupSteps({ ...completo, nombre_asesor: '' }).asesor, false);
  assert.equal(setupSteps({ ...completo, telefono: '12345' }).asesor, false);
  assert.equal(setupSteps({ ...completo, telefono: '+57 300 111 2233' }).asesor, true); // acepta formato con símbolos
  assert.equal(isConfigured(undefined), false);
  assert.equal(isConfigured({}), false);
});

test('"En blanco" cuenta como marca elegida', () => {
  assert.equal(isConfigured({ ...completo, marca: 'Blanco' }), true);
});
