import test from 'node:test';
import assert from 'node:assert/strict';
import { createInbox } from './inbox.js';

function setup({ connected = true } = {}) {
  const sessions = new Map();
  const rows = [];
  const sent = [];
  const SesionesRepo = {
    get: (userId) => sessions.get(userId) || { userId, advisorTook: false, handoffMode: true },
    save: (s) => sessions.set(s.userId, { ...s }),
  };
  const inbox = createInbox({
    SesionesRepo,
    historial: { add: (...r) => rows.push(r) },
    channel: { sendText: async (to, text) => { if (connected) sent.push([to, text]); return connected; } },
  });
  return { inbox, sessions, rows, sent };
}

test('tomar control calla al bot; soltar lo devuelve y limpia el handoff', () => {
  const { inbox, sessions } = setup();
  inbox.takeControl('u1');
  assert.deepEqual([sessions.get('u1').advisorTook, sessions.get('u1').handoffMode], [true, false]);
  inbox.releaseControl('u1');
  assert.deepEqual([sessions.get('u1').advisorTook, sessions.get('u1').handoffMode], [false, false]);
});

test('responder desde la app envía, guarda en historial y toma el control', async () => {
  const { inbox, sessions, rows, sent } = setup();
  await inbox.sendAsAdvisor('u1', '  Hola, soy Ana  ');
  assert.deepEqual(sent, [['u1', 'Hola, soy Ana']]);
  assert.deepEqual(rows, [['u1', 'asesor', 'Hola, soy Ana']]);
  assert.equal(sessions.get('u1').advisorTook, true);
});

test('rechaza texto vacío, enorme o sin conexión, sin guardar nada', async () => {
  const { inbox, rows } = setup();
  await assert.rejects(inbox.sendAsAdvisor('u1', '   '), /vacío/);
  await assert.rejects(inbox.sendAsAdvisor('u1', 'x'.repeat(5000)), /largo/);
  const off = setup({ connected: false });
  await assert.rejects(off.inbox.sendAsAdvisor('u1', 'hola'), /no está conectado/);
  assert.equal(rows.length + off.rows.length, 0);
  assert.equal(off.sessions.size, 0);
});
