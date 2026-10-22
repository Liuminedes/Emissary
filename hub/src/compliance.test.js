import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { openDb } from './db/db.js';
import { createTenant } from './db/tenants.js';
import { createConsent } from './compliance/consent.js';
import { createUsage } from './compliance/usage.js';
import { createCampaigns, CampaignError } from './campaigns.js';
import { dailyCap, inWindow, breakerReason, RAMP, MIN_GAP_MS, JITTER_MS } from './compliance/limits.js';
import { localDay, localHour } from './compliance/time.js';
import { createHub } from './app.js';
import { loadConfig } from './config.js';

const sign = (body, secret) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
const HOUR = 3600e3;
const DAY = 24 * HOUR;
// 2026-10-22 15:00 en Bogotá (UTC-5) = 20:00 UTC: dentro del horario 9-19? No, hora 15 sí.
const T0 = Date.parse('2026-10-22T20:00:00Z');

// Reloj controlable
function clock(start = T0) {
  const c = { t: start, now: () => c.t, advance(ms) { c.t += ms; } };
  return c;
}

function setup({ ajustes = {}, start = T0 } = {}) {
  const db = openDb(':memory:');
  const t = createTenant(db, { slug: 'uno', phone_number_id: 'PN1', nombre_negocio: 'Demo' });
  for (const [k, v] of Object.entries(ajustes)) db.prepare(`UPDATE tenants SET ${k} = ? WHERE id = ?`).run(v, t.id);
  const c = clock(start);
  const sent = [];
  const provider = { sendTemplate: async (to, tpl) => { sent.push({ to, ...tpl }); return { id: `wamid.${sent.length}` }; } };
  const campaigns = createCampaigns({ db, providerFor: () => provider, now: c.now, random: () => 0, log: { error() {} } });
  const consent = createConsent(db, t.id, { now: c.now, negocioNombre: () => 'Demo' });
  const usage = createUsage(db, t.id, { now: c.now });
  const optIn = (...nums) => nums.forEach((n) => consent.registerOptIn(`${n}@s.whatsapp.net`, 'formulario web'));
  const numeros = (n, base = 573000000000) => Array.from({ length: n }, (_, i) => ({ numero: String(base + i) }));
  // Corre ticks saltando el espaciado mínimo entre envíos
  const correr = async (veces) => { for (let i = 0; i < veces; i++) { await campaigns.tick(); c.advance(MIN_GAP_MS + JITTER_MS + 1000); } };
  return { db, t, c, sent, campaigns, consent, usage, optIn, numeros, correr };
}

// ---------- Reglas puras ----------

test('rampa: sube con los días y nunca pasa del máximo del tenant', () => {
  assert.equal(dailyCap(0, 250), RAMP[0]);
  assert.equal(dailyCap(3, 250), RAMP[3]);
  assert.equal(dailyCap(RAMP.length, 250), 250);
  assert.equal(dailyCap(0, 10), 10); // el máximo manda
});

test('horario y zona horaria: Bogotá no es UTC', () => {
  assert.equal(localHour(T0, 'America/Bogota'), 15);
  assert.equal(localDay(Date.parse('2026-10-23T03:00:00Z'), 'America/Bogota'), '2026-10-22'); // sigue siendo el 22 allá
  assert.ok(inWindow(9, 9, 19) && !inWindow(19, 9, 19) && !inWindow(8, 9, 19));
});

test('corte automático: por fallos y por bajas, y con poca muestra no corta', () => {
  assert.equal(breakerReason({ recent: ['enviado', 'enviado', 'enviado'], sentLast24h: 3, optOutsLast24h: 0 }), null);
  assert.equal(breakerReason({ recent: ['fallido', 'fallido', 'fallido', 'fallido'], sentLast24h: 0, optOutsLast24h: 0 }), null); // < 5 de muestra
  assert.match(breakerReason({ recent: ['fallido', 'enviado', 'enviado', 'enviado', 'enviado'], sentLast24h: 0, optOutsLast24h: 0 }), /fallaron/);
  assert.match(breakerReason({ recent: [], sentLast24h: 100, optOutsLast24h: 4 }), /bajas/);
  assert.equal(breakerReason({ recent: [], sentLast24h: 100, optOutsLast24h: 3 }), null);
});

// ---------- Consentimiento y bajas ----------

test('BAJA / ALTA: solo el mensaje entero, confirma y bloquea las campañas', () => {
  const { consent } = setup();
  const u = '573001112233@s.whatsapp.net';
  assert.equal(consent.handleInbound({ userId: u, text: 'hola, quiero la baja de mi cita' }), null); // no es un comando
  assert.equal(consent.handleInbound({ userId: u, text: 'cuál es el precio' }), null);
  consent.registerOptIn(u, 'formulario');
  assert.equal(consent.canReceiveCampaign(u, 'marketing').ok, true);

  const r = consent.handleInbound({ userId: u, text: ' Baja! ' });
  assert.match(r[0], /no volverás a recibir/);
  assert.match(r[0], /Demo/);
  assert.deepEqual(consent.canReceiveCampaign(u, 'marketing'), { ok: false, motivo: 'dio de baja' });
  assert.equal(consent.canReceiveCampaign(u, 'utility').ok, false); // la baja aplica a toda campaña

  assert.match(consent.handleInbound({ userId: u, text: 'ALTA' })[0], /suscrito/);
  assert.equal(consent.canReceiveCampaign(u, 'marketing').ok, true);
});

test('escribirnos no es consentimiento de marketing; sí exige fuente para registrarlo', () => {
  const { consent } = setup();
  const u = '573001112233@s.whatsapp.net';
  consent.handleInbound({ userId: u, text: 'hola' });
  assert.equal(consent.get(u).last_inbound_at > 0, true);
  assert.deepEqual(consent.canReceiveCampaign(u, 'marketing'), { ok: false, motivo: 'sin consentimiento de marketing' });
  assert.equal(consent.canReceiveCampaign(u, 'utility').ok, true); // transaccional: solo exige no haber dado de baja
  assert.throws(() => consent.registerOptIn(u, ''), /fuente/);
});

// ---------- Campañas ----------

test('crear campaña: estima, omite sin consentimiento y números inválidos, y no se salta a nadie por error', () => {
  const { campaigns, optIn, numeros, usage, db } = setup({ ajustes: { tarifa_marketing_usd: 0.02 } });
  optIn(573000000000, 573000000001);
  const r = campaigns.crear(1, { nombre: 'Octubre', plantilla: 'promo_octubre', contactos: [...numeros(3), { numero: '123' }, { numero: '573000000000' }] });
  assert.equal(r.elegibles, 2);
  assert.deepEqual(r.omitidos, { 'sin consentimiento de marketing': 1, 'número inválido': 1, duplicado: 1 });
  assert.equal(r.tarifa_configurada, true);
  assert.equal(r.costo_estimado_usd, 0.04);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM campana_items WHERE campana_id = ?').get(r.id).c, 3); // el duplicado no se repite
  assert.equal(usage.rateOf('service'), 0);
});

test('validación de campañas', () => {
  const { campaigns, numeros } = setup();
  const base = { nombre: 'x', plantilla: 'promo', contactos: numeros(1) };
  assert.throws(() => campaigns.crear(1, { ...base, plantilla: 'Con Espacios' }), CampaignError);
  assert.throws(() => campaigns.crear(1, { ...base, categoria: 'otra' }), CampaignError);
  assert.throws(() => campaigns.crear(1, { ...base, contactos: [] }), CampaignError);
  assert.throws(() => campaigns.crear(1, { ...base, nombre: ' ' }), CampaignError);
});

test('envío: solo a quienes consintieron, de a uno por tick y respetando el espaciado', async () => {
  const { campaigns, optIn, numeros, sent, c } = setup();
  optIn(573000000000, 573000000001, 573000000002);
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: numeros(4) });
  campaigns.iniciar(1, id);

  await campaigns.tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, '573000000000');
  assert.deepEqual([sent[0].name, sent[0].language], ['promo', 'es']);
  await campaigns.tick(); // sin avanzar el reloj: el espaciado lo impide
  assert.equal(sent.length, 1);
  c.advance(MIN_GAP_MS + 1);
  await campaigns.tick();
  assert.equal(sent.length, 2);
  c.advance(MIN_GAP_MS + 1);
  await campaigns.tick();
  assert.equal(sent.length, 3);
  c.advance(MIN_GAP_MS + 1);
  await campaigns.tick(); // el cuarto contacto no tenía consentimiento: la campaña termina sin enviarle
  assert.equal(sent.length, 3);
  assert.equal(campaigns.estado(1, id).estado, 'completa');
});

test('una baja posterior a la creación se respeta al momento de enviar', async () => {
  const { campaigns, optIn, numeros, sent, consent } = setup();
  optIn(573000000000, 573000000001);
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: numeros(2) });
  campaigns.iniciar(1, id);
  consent.handleInbound({ userId: '573000000000@s.whatsapp.net', text: 'BAJA' });
  await campaigns.tick();
  assert.deepEqual(sent.map((m) => m.to), ['573000000001']);
  assert.equal(campaigns.estado(1, id).items.omitido, 1);
});

test('frecuencia: nadie recibe dos campañas en menos de 3 días', async () => {
  const { campaigns, optIn, numeros, sent, correr, c } = setup();
  optIn(573000000000);
  const a = campaigns.crear(1, { nombre: 'a', plantilla: 'promo', contactos: numeros(1) });
  campaigns.iniciar(1, a.id);
  await correr(2);
  assert.equal(sent.length, 1);
  const b = campaigns.crear(1, { nombre: 'b', plantilla: 'promo', contactos: numeros(1) });
  assert.equal(b.elegibles, 0);
  assert.equal(b.omitidos['recibió una campaña hace poco'], 1);
  c.advance(3 * DAY + HOUR); // 3 días después, ya puede
  const d = campaigns.crear(1, { nombre: 'd', plantilla: 'promo', contactos: numeros(1) });
  assert.equal(d.elegibles, 1);
});

test('tope diario con rampa: no envía más del límite y retoma al día siguiente', async () => {
  const { campaigns, optIn, numeros, sent, correr, c } = setup({ ajustes: { limite_diario_max: 5 } });
  const lista = numeros(8);
  optIn(...lista.map((x) => x.numero));
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: lista });
  campaigns.iniciar(1, id);
  await correr(8);
  assert.equal(sent.length, 5);
  assert.equal(campaigns.salud(1).enviados_hoy, 5);
  c.advance(DAY); // mismo horario, día siguiente
  await correr(4);
  assert.equal(sent.length, 8);
  assert.equal(campaigns.estado(1, id).estado, 'completa');
});

test('el primer día aplica la rampa de calentamiento (no el máximo del tenant)', () => {
  const { campaigns } = setup({ ajustes: { limite_diario_max: 250 } });
  const s = campaigns.salud(1);
  assert.deepEqual([s.tope_diario, s.dia_de_calentamiento], [RAMP[0], 1]);
});

test('fuera del horario del tenant no se envía; dentro, sí', async () => {
  // 02:00 en Bogotá
  const { campaigns, optIn, numeros, sent, c } = setup({ start: Date.parse('2026-10-22T07:00:00Z') });
  optIn(573000000000);
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: numeros(1) });
  campaigns.iniciar(1, id);
  await campaigns.tick();
  assert.equal(sent.length, 0);
  assert.equal(campaigns.salud(1).ventana_abierta, false);
  c.advance(10 * HOUR); // 12:00
  await campaigns.tick();
  assert.equal(sent.length, 1);
});

test('presupuesto mensual: exige tarifa para activarlo y pausa la campaña al agotarse', async () => {
  const sin = setup({ ajustes: { presupuesto_mensual_usd: 1 } });
  sin.optIn(573000000000);
  const c0 = sin.campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: sin.numeros(1) });
  assert.throws(() => sin.campaigns.iniciar(1, c0.id), /tarifa/); // un tope sin tarifa es un tope falso

  const { campaigns, optIn, numeros, sent, correr, usage } = setup({ ajustes: { presupuesto_mensual_usd: 0.05, tarifa_marketing_usd: 0.02 } });
  const lista = numeros(5);
  optIn(...lista.map((x) => x.numero));
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: lista });
  campaigns.iniciar(1, id);
  await correr(6);
  assert.equal(sent.length, 2); // 0.02 + 0.02 = 0.04; un tercero pasaría de 0.05
  const e = campaigns.estado(1, id);
  assert.deepEqual([e.estado, e.motivo_pausa], ['pausada', 'presupuesto mensual agotado']);
  assert.equal(usage.monthSpent(), 0.04);
});

test('corte automático: tras varios fallos pausa la campaña y no sigue quemando el número', async () => {
  const { optIn, numeros, db, c } = setup();
  const lista = numeros(10);
  optIn(...lista.map((x) => x.numero));
  const fallando = createCampaigns({
    db, now: c.now, random: () => 0, log: { error() {} },
    providerFor: () => ({ sendTemplate: async () => { throw new Error('131026 número no válido'); } }),
  });
  const { id } = fallando.crear(1, { nombre: 'x', plantilla: 'promo', contactos: lista });
  fallando.iniciar(1, id);
  for (let i = 0; i < 8; i++) { await fallando.tick(); c.advance(MIN_GAP_MS + 1); }
  const e = fallando.estado(1, id);
  assert.equal(e.estado, 'pausada');
  assert.match(e.motivo_pausa, /fallaron/);
  assert.ok(e.items.fallido >= 5 && e.items.fallido < 10);
});

test('corte automático por bajas: demasiadas bajas en 24 h detienen los envíos', async () => {
  const { campaigns, optIn, numeros, consent, c, db, t } = setup({ ajustes: { limite_diario_max: 1000 } });
  const lista = numeros(40);
  optIn(...lista.map((x) => x.numero));
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: lista });
  // 32 enviados hoy (simulados) y 4 bajas: 12 % > 3 %
  const ins = db.prepare("INSERT INTO campana_items (campana_id, tenant_id, user_id, estado, sent_at) VALUES (?, ?, ?, 'enviado', ?)");
  for (let i = 0; i < 32; i++) ins.run(id, t.id, `extra${i}@s.whatsapp.net`, c.now() - HOUR);
  for (let i = 0; i < 4; i++) consent.handleInbound({ userId: `extra${i}@s.whatsapp.net`, text: 'STOP' });
  campaigns.iniciar(1, id);
  await campaigns.tick();
  const e = campaigns.estado(1, id);
  assert.equal(e.estado, 'pausada');
  assert.match(e.motivo_pausa, /bajas/);
});

test('costos: resumen por categoría, por campaña y costo por lead', async () => {
  const { campaigns, optIn, numeros, correr, usage, db, t, c } = setup({ ajustes: { tarifa_marketing_usd: 0.02, presupuesto_mensual_usd: 10 } });
  optIn(573000000000, 573000000001);
  const { id } = campaigns.crear(1, { nombre: 'Octubre', plantilla: 'promo', contactos: numeros(2) });
  campaigns.iniciar(1, id);
  await correr(3);
  usage.record('service', 7); // respuestas dentro de la ventana de 24 h
  db.prepare("INSERT INTO leads (tenant_id, user_id, created_at) VALUES (?, 'a', ?)").run(t.id, c.now());
  const r = usage.summary();
  assert.equal(r.mes, '2026-10');
  assert.equal(r.estimado, true);
  assert.equal(r.tarifas_configuradas, true);
  assert.deepEqual(r.por_categoria.map((x) => [x.categoria, x.mensajes, x.costo_usd]), [['marketing', 2, 0.04], ['service', 7, 0]]);
  assert.equal(r.costo_total_usd, 0.04);
  assert.equal(r.presupuesto_restante_usd, 9.96);
  assert.equal(r.costo_por_lead_usd, 0.04);
  assert.deepEqual([r.campanas[0].nombre, r.campanas[0].enviados, r.campanas[0].costo_usd], ['Octubre', 2, 0.04]);
  assert.equal(usage.summary('2026-09').costo_total_usd, 0);
});

test('sin tarifa configurada el panel lo dice y no inventa costos', async () => {
  const { campaigns, optIn, numeros, correr, usage } = setup();
  optIn(573000000000);
  const { id } = campaigns.crear(1, { nombre: 'x', plantilla: 'promo', contactos: numeros(1) });
  campaigns.iniciar(1, id);
  await correr(2);
  const r = usage.summary();
  assert.equal(r.tarifas_configuradas, false);
  assert.equal(r.costo_total_usd, 0);
  assert.equal(r.por_categoria[0].mensajes, 1);
});

// ---------- Hub completo: webhook + API de administración ----------

async function hubConAdmin() {
  const cfg = loadConfig({ WEBHOOK_VERIFY_TOKEN: 'vt', META_APP_SECRET: 'sec', ADMIN_TOKEN: 'admin-secreto', BUSINESS_NAME: 'Demo', BUSINESS_BRAND: 'KIA', ADVISOR_NAME: 'Ana' });
  const db = openDb(':memory:');
  createTenant(db, { slug: 'default', ...cfg.business, phone_number_id: 'PN1' });
  const c = clock();
  const sentText = [];
  const sentTpl = [];
  const provider = {
    sendText: async (to, text) => { sentText.push({ to, text }); return {}; },
    sendTemplate: async (to, tpl) => { sentTpl.push({ to, ...tpl }); return { id: 'w' }; },
  };
  const server = createHub({ cfg, db, makeProvider: () => provider, now: c.now, log: { log() {}, error() {} } });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = (method, path, body, token = 'admin-secreto') => fetch(`${base}${path}`, {
    method, body: body ? JSON.stringify(body) : undefined, headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  let n = 0;
  const cliente = async (from, text) => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: {
      metadata: { phone_number_id: 'PN1' }, contacts: [{ wa_id: from, profile: { name: 'Cli' } }],
      messages: [{ id: `w${++n}`, from, type: 'text', timestamp: '1', text: { body: text } }],
    } }] }] });
    await fetch(`${base}/webhook`, { method: 'POST', body: raw, headers: { 'x-hub-signature-256': sign(raw, 'sec') } });
    await new Promise((r) => setTimeout(r, 60));
  };
  return { db, server, admin, cliente, sentText, sentTpl, c, close: () => server.close() };
}

test('API admin: exige token en el header, no en la URL', async () => {
  const h = await hubConAdmin();
  try {
    assert.equal((await h.admin('GET', '/admin/costos', null, null)).status, 401);
    assert.equal((await h.admin('GET', '/admin/costos', null, 'otro')).status, 401);
    assert.equal((await h.admin('GET', '/admin/costos?token=admin-secreto', null, null)).status, 401);
    assert.equal((await h.admin('GET', '/admin/costos')).status, 200);
    assert.equal((await h.admin('GET', '/admin/costos?tenant=no-existe')).status, 404);
  } finally { h.close(); }
});

test('API admin desactivada sin ADMIN_TOKEN', async () => {
  const cfg = loadConfig({ WEBHOOK_VERIFY_TOKEN: 'vt', META_APP_SECRET: 'sec' });
  const db = openDb(':memory:');
  createTenant(db, { slug: 'default' });
  const server = createHub({ cfg, db, makeProvider: () => ({}), log: { log() {}, error() {} } });
  await new Promise((r) => server.listen(0, r));
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/admin/costos`, { headers: { Authorization: 'Bearer ' } });
    assert.equal(r.status, 404);
  } finally { server.close(); }
});

test('API admin: ajustes validados, consentimientos, campaña de punta a punta y panel', async () => {
  const h = await hubConAdmin();
  try {
    assert.equal((await h.admin('POST', '/admin/config', { limite_diario_max: -3 })).status, 400);
    assert.equal((await h.admin('POST', '/admin/config', { hora_inicio: 20, hora_fin: 10 })).status, 400);
    assert.equal((await h.admin('POST', '/admin/config', { tarifa_marketing_usd: 0.02, presupuesto_mensual_usd: 5 })).status, 200);

    const consent = await h.admin('POST', '/admin/consentimientos', { contactos: [
      { numero: '573000000000', fuente: 'formulario web' }, { numero: '573000000001' }, { numero: '12', fuente: 'x' },
    ] });
    assert.deepEqual(consent.body, { registrados: 1, descartados: 2 }); // sin fuente o inválido no cuenta

    const camp = await h.admin('POST', '/admin/campanas', { nombre: 'Prueba', plantilla: 'promo', contactos: [{ numero: '573000000000' }, { numero: '573000000001' }] });
    assert.equal(camp.status, 201);
    assert.equal(camp.body.elegibles, 1);
    assert.equal(camp.body.costo_estimado_usd, 0.02);

    assert.equal((await h.admin('POST', `/admin/campanas/${camp.body.id}/iniciar`)).status, 200);
    await h.server.campaigns.tick();
    assert.equal(h.sentTpl.length, 1);
    assert.equal(h.sentTpl[0].to, '573000000000');

    const st = await h.admin('GET', `/admin/campanas/${camp.body.id}`);
    assert.deepEqual([st.body.estado, st.body.items.enviado, st.body.items.omitido], ['en_curso', 1, 1]);
    assert.equal((await h.admin('POST', `/admin/campanas/${camp.body.id}/pausar`)).status, 200);
    assert.equal((await h.admin('POST', `/admin/campanas/${camp.body.id}/pausar`)).status, 400); // ya no está en curso

    const costos = await h.admin('GET', '/admin/costos');
    assert.equal(costos.body.costo_total_usd, 0.02);
    const salud = await h.admin('GET', '/admin/salud');
    assert.equal(salud.body.enviados_hoy, 1);
  } finally { h.close(); }
});

test('Hub: BAJA por WhatsApp excluye al cliente de las campañas; las respuestas del bot cuentan como servicio', async () => {
  const h = await hubConAdmin();
  try {
    await h.admin('POST', '/admin/consentimientos', { contactos: [{ numero: '573000000000', fuente: 'formulario' }] });
    await h.cliente('573000000000', 'hola');
    assert.ok(h.sentText.length >= 1); // el bot responde normal
    await h.cliente('573000000000', 'BAJA');
    assert.match(h.sentText.at(-1).text, /no volverás a recibir/);

    const camp = await h.admin('POST', '/admin/campanas', { nombre: 'x', plantilla: 'promo', contactos: [{ numero: '573000000000' }] });
    assert.equal(camp.body.elegibles, 0);
    assert.equal(camp.body.omitidos['dio de baja'], 1);

    const costos = await h.admin('GET', '/admin/costos');
    const servicio = costos.body.por_categoria.find((x) => x.categoria === 'service');
    assert.equal(servicio.mensajes, h.sentText.length);
    assert.equal(servicio.costo_usd, 0);
  } finally { h.close(); }
});

