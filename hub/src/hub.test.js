import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { loadConfig } from './config.js';
import { parseWebhook } from './parse.js';
import { verifySignature } from './security.js';
import { createServer } from './server.js';
import { CloudApiProvider } from './providers/cloud-api.js';

const sign = (body, secret) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

const incoming = {
  entry: [{ changes: [{ value: {
    contacts: [{ wa_id: '573001112233', profile: { name: 'Ana' } }],
    messages: [{ id: 'wamid.1', from: '573001112233', type: 'text', timestamp: '1700000000', text: { body: 'Hola' } }],
    statuses: [{ id: 'wamid.0', status: 'read', recipient_id: '573001112233', timestamp: '1700000001' }],
  } }] }],
};

test('config: exige autenticación del webhook', () => {
  assert.throws(() => loadConfig({ WEBHOOK_VERIFY_TOKEN: 'x' }), /META_APP_SECRET o WEBHOOK_TOKEN/);
  assert.throws(() => loadConfig({ META_APP_SECRET: 's' }), /WEBHOOK_VERIFY_TOKEN/);
  assert.equal(loadConfig({ WEBHOOK_VERIFY_TOKEN: 'x', WEBHOOK_TOKEN: 't' }).port, 3000);
});

test('firma: válida, alterada y ausente', () => {
  const raw = Buffer.from('{"a":1}');
  assert.equal(verifySignature(raw, sign(raw, 's3'), 's3'), true);
  assert.equal(verifySignature(raw, sign(raw, 'otro'), 's3'), false);
  assert.equal(verifySignature(raw, undefined, 's3'), false);
  assert.equal(verifySignature(Buffer.from('{"a":2}'), sign(raw, 's3'), 's3'), false);
});

test('parse: mensaje, estado y eco', () => {
  const ev = parseWebhook(incoming);
  assert.deepEqual(ev.map((e) => e.type), ['message', 'status']);
  assert.equal(ev[0].text, 'Hola');
  assert.equal(ev[0].name, 'Ana');
  const echo = parseWebhook({ entry: [{ changes: [{ value: { message_echoes: [{ id: 'e1', to: '573009998877', type: 'text', text: { body: 'Hola desde el celular' } }] } }] }] });
  assert.deepEqual([echo[0].type, echo[0].to, echo[0].text], ['echo', '573009998877', 'Hola desde el celular']);
  assert.deepEqual(parseWebhook({}), []);
});

async function withServer(cfg, fn) {
  const events = [];
  const server = createServer(cfg, (e) => { events.push(e); }, { error() {} });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, events); } finally { server.close(); }
}

test('server: verificación GET y POST firmado con deduplicación', async () => {
  const cfg = loadConfig({ WEBHOOK_VERIFY_TOKEN: 'vt', META_APP_SECRET: 'sec' });
  await withServer(cfg, async (base, events) => {
    assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42`)).status, 200);
    assert.equal((await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42`)).status, 403);

    const raw = JSON.stringify(incoming);
    const post = (headers) => fetch(`${base}/webhook`, { method: 'POST', body: raw, headers });
    assert.equal((await post({})).status, 401);
    assert.equal((await post({ 'x-hub-signature-256': 'sha256=00' })).status, 401);
    assert.equal((await post({ 'x-hub-signature-256': sign(raw, 'sec') })).status, 200);
    assert.equal((await post({ 'x-hub-signature-256': sign(raw, 'sec') })).status, 200); // reintento de Meta
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(events.length, 2); // message + status, sin duplicar
  });
});

test('server: modo token (proveedor sin firma)', async () => {
  const cfg = loadConfig({ WEBHOOK_VERIFY_TOKEN: 'vt', WEBHOOK_TOKEN: 'tok' });
  await withServer(cfg, async (base) => {
    const raw = JSON.stringify(incoming);
    assert.equal((await fetch(`${base}/webhook`, { method: 'POST', body: raw })).status, 401);
    assert.equal((await fetch(`${base}/webhook`, { method: 'POST', body: raw, headers: { 'x-webhook-token': 'tok' } })).status, 200);
  });
});

test('cloud-api: arma la petición para Meta y para 360dialog', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ messages: [{ id: 'wamid.X' }] }) }; };

  const meta = new CloudApiProvider({ base: 'https://graph.facebook.com/v21.0/', token: 'T', phoneNumberId: '123' }, fake);
  assert.deepEqual(await meta.sendText('573001112233', 'Hola'), { id: 'wamid.X' });
  assert.equal(calls[0].url, 'https://graph.facebook.com/v21.0/123/messages');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer T');
  assert.equal(JSON.parse(calls[0].init.body).text.body, 'Hola');

  const d360 = new CloudApiProvider({ base: 'https://waba-v2.360dialog.io', token: 'K', authStyle: 'd360' }, fake);
  await d360.sendTemplate('573001112233', { name: 'saludo' });
  assert.equal(calls[1].url, 'https://waba-v2.360dialog.io/messages');
  assert.equal(calls[1].init.headers['D360-API-KEY'], 'K');
  assert.deepEqual(JSON.parse(calls[1].init.body).template, { name: 'saludo', language: { code: 'es' } });

  const failing = new CloudApiProvider({ base: 'x', token: 'T', phoneNumberId: '1' }, async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'mal' } }) }));
  await assert.rejects(failing.sendText('1', 'a'), /400: mal/);
});
