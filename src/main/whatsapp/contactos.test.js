import test from 'node:test';
import assert from 'node:assert/strict';
import { filasDeContactos, filaDePar, unirFilas, etiquetaContacto, telefonoValido } from './contactos.js';

test('un contacto guardado con id anónimo y teléfono genera una fila por cada id', () => {
  const filas = filasDeContactos([{ id: '573001112233@s.whatsapp.net', lid: '43817373835372@lid', name: 'Alex Pérez' }]);
  assert.deepEqual(filas, [
    { userId: '43817373835372@lid', numero: '573001112233', nombre: 'Alex Pérez' },
    { userId: '573001112233@s.whatsapp.net', numero: '573001112233', nombre: 'Alex Pérez' },
  ]);
});

test('el nombre guardado gana al que la persona se puso, y el id anónimo con jid también se resuelve', () => {
  const [fila] = filasDeContactos([{ id: '1@lid', jid: '573004445566@s.whatsapp.net', name: 'Mi cliente', notify: 'Cli' }]);
  assert.deepEqual(fila, { userId: '1@lid', numero: '573004445566', nombre: 'Mi cliente' });
  assert.equal(filasDeContactos([{ id: '2@lid', notify: 'Solo apodo' }])[0].nombre, 'Solo apodo');
});

test('lo que no aporta nada, o no es un teléfono, se descarta', () => {
  assert.deepEqual(filasDeContactos([{ id: '3@lid' }, {}, null, { id: '120363@g.us', name: 'Grupo' }]), []);
  assert.equal(filasDeContactos([{ id: '9@lid', jid: '1234567890123456789@s.whatsapp.net', name: 'X' }])[0].numero, '', 'un "teléfono" de 19 dígitos no es un teléfono');
});

test('el par que trae un mensaje solo vale con un id anónimo y un teléfono real', () => {
  assert.deepEqual(filaDePar('7@lid', '573009998877:12@s.whatsapp.net'), { userId: '7@lid', numero: '573009998877', nombre: '' });
  assert.equal(filaDePar('573@s.whatsapp.net', '573009998877@s.whatsapp.net'), null);
  assert.equal(filaDePar('7@lid', undefined), null);
});

test('unir filas nunca borra un dato conocido con uno vacío', () => {
  const previa = { userId: '7@lid', numero: '573009998877', nombre: 'Ana' };
  assert.deepEqual(unirFilas(previa, { userId: '7@lid', numero: '', nombre: '' }), previa);
  assert.equal(unirFilas(previa, { userId: '7@lid', numero: '', nombre: 'Ana López' }).nombre, 'Ana López');
  assert.deepEqual(unirFilas(undefined, { userId: '7@lid', numero: '1', nombre: '' }), { userId: '7@lid', numero: '1', nombre: '' });
});

test('la etiqueta nunca muestra un id anónimo como si fuera un teléfono', () => {
  assert.equal(etiquetaContacto({ nombre: 'Ana', numero: '5730', userId: '1@lid' }), 'Ana');
  assert.equal(etiquetaContacto({ nombre: '', numero: '573001112233', userId: '1@lid' }), '+573001112233');
  assert.equal(etiquetaContacto({ nombre: '43817373835372@lid', numero: '', userId: '43817373835372@lid' }), 'Contacto sin número');
  assert.equal(etiquetaContacto({ nombre: '', numero: '', userId: '573001112233@s.whatsapp.net' }), '+573001112233');
});

test('también entiende las filas de la base (user_id) cuyo nombre es el propio id', () => {
  const id = '43817373835372@lid';
  assert.equal(etiquetaContacto({ nombre: id, numero: '', user_id: id }), 'Contacto sin número');
  assert.equal(etiquetaContacto({ nombre: id, numero: '573004445566', user_id: id }), '+573004445566');
  assert.equal(etiquetaContacto({ nombre: 'Alex', numero: '', user_id: id }), 'Alex');
});

test('telefonoValido acepta formatos de persona y rechaza lo que no es un teléfono', () => {
  assert.equal(telefonoValido('+57 300 111-2233'), '573001112233');
  assert.equal(telefonoValido('300'), '');
  assert.equal(telefonoValido('hola'), '');
  assert.equal(telefonoValido('43817373835372', '43817373835372@lid'), '', 'no es el id anónimo disfrazado');
});
