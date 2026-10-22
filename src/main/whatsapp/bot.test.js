import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { attachBot } from './bot.js';

// Canal falso: reemplaza a Baileys y a Cloud API en las pruebas
class FakeChannel {
  events = new EventEmitter();
  sent = [];
  async sendText(to, text) { this.sent.push({ to, text }); return true; }
  customer(userId, text) { this.events.emit('message', { userId, text, pushName: 'Cliente' }); }
  advisor(userId) { this.events.emit('echo', { userId }); }
}

const tick = () => new Promise((r) => setImmediate(r));

function setup(handle) {
  const channel = new FakeChannel();
  const saved = [];
  const SesionesRepo = {
    get: (userId) => ({ userId, advisorTook: false }),
    save: (s) => saved.push(s),
  };
  attachBot({ channel, engine: { handleIncomingMessage: handle }, SesionesRepo, log: { error() {} } });
  return { channel, saved };
}

test('cada respuesta del motor sale por el canal, en orden', async () => {
  const { channel } = setup(({ text }) => [`uno:${text}`, `dos:${text}`]);
  channel.customer('u1', 'hola');
  await tick(); await tick();
  assert.deepEqual(channel.sent, [{ to: 'u1', text: 'uno:hola' }, { to: 'u1', text: 'dos:hola' }]);
});

test('un eco del asesor marca advisorTook y se guarda', async () => {
  const { channel, saved } = setup(() => []);
  channel.advisor('u1');
  await tick();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].advisorTook, true);
});

test('un error del motor no tumba al bot ni a los mensajes siguientes', async () => {
  let n = 0;
  const { channel } = setup(() => { if (n++ === 0) throw new Error('boom'); return ['ok']; });
  channel.customer('u1', 'a');
  channel.customer('u1', 'b');
  await tick(); await tick(); await tick();
  assert.deepEqual(channel.sent, [{ to: 'u1', text: 'ok' }]);
});

test('el historial guarda cliente, bot y asesor, y avisa la actividad', async () => {
  const channel = new FakeChannel();
  const rows = [];
  const activity = [];
  attachBot({
    channel,
    engine: { handleIncomingMessage: () => ['respuesta'] },
    SesionesRepo: { get: (userId) => ({ userId }), save() {} },
    historial: { add: (...r) => rows.push(r) },
    onActivity: (u) => activity.push(u),
    log: { error() {} },
  });
  channel.customer('u1', 'hola');
  await tick(); await tick();
  channel.events.emit('echo', { userId: 'u1', text: 'te escribo yo' });
  await tick();
  assert.deepEqual(rows, [['u1', 'cliente', 'hola'], ['u1', 'bot', 'respuesta'], ['u1', 'asesor', 'te escribo yo']]);
  assert.equal(activity.length, 3);
});

test('si falla el historial, el bot igual responde', async () => {
  const channel = new FakeChannel();
  attachBot({
    channel,
    engine: { handleIncomingMessage: () => ['ok'] },
    SesionesRepo: { get: (userId) => ({ userId }), save() {} },
    historial: { add() { throw new Error('db caída'); } },
    log: { error() {} },
  });
  channel.customer('u1', 'hola');
  await tick(); await tick();
  assert.deepEqual(channel.sent, [{ to: 'u1', text: 'ok' }]);
});
