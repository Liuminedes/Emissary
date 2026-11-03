import test from 'node:test';
import assert from 'node:assert/strict';
import { difusionTemplates, fillDifusion } from './difusiones.js';

test('cada tipo de negocio tiene plantillas y las marcas sin propia usan las generales', () => {
  for (const marca of ['Nuevos', 'Usados', 'Restaurante', 'Blanco', 'Volkswagen', undefined]) {
    assert.ok(difusionTemplates(marca).length >= 3, String(marca));
  }
  assert.equal(difusionTemplates('KIA'), difusionTemplates('Nuevos'));
  assert.notEqual(difusionTemplates('Restaurante'), difusionTemplates('Usados'));
});

test('ninguna plantilla promete algo que Emissary no hace ni deja marcadores sin reemplazar', () => {
  const marcas = ['Nuevos', 'Usados', 'Restaurante', 'Blanco'];
  for (const m of marcas) for (const t of difusionTemplates(m)) {
    const lleno = fillDifusion(t.texto, { negocio: 'Autos del Valle', asesor: 'Ana' }).replaceAll('{nombre}', 'Luis');
    assert.doesNotMatch(lleno, /[{}]/, `${m}/${t.id}`);
    assert.ok(lleno.length < 400, `${m}/${t.id} es largo`);
    assert.doesNotMatch(t.texto, /\bBAJA\b/, 'no hay baja automática en esta versión');
  }
});

test('fillDifusion deja {nombre} y usa un texto neutro si faltan los datos', () => {
  assert.equal(fillDifusion('Hola {nombre}, {asesor} de {negocio}', {}), 'Hola {nombre}, tu asesor de nuestro negocio');
});
