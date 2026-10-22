import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { openDb } from './db/db.js';
import { createTenant, ensureDefaultTenant, findTenantByPhoneNumberId } from './db/tenants.js';
import { createTenantRepos } from './db/repos.js';
import { createHub } from './app.js';
import { loadConfig } from './config.js';

const A = '573001112233@s.whatsapp.net';
const sign = (body, secret) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

function twoTenants() {
  const db = openDb(':memory:');
  const t1 = createTenant(db, { slug: 'uno', phone_number_id: 'PN1', marca: 'KIA', nombre_asesor: 'Ana' });
  const t2 = createTenant(db, { slug: 'dos', phone_number_id: 'PN2', marca: 'Volkswagen', nombre_asesor: 'Beto' });
  return { db, t1, t2, r1: createTenantRepos(db, t1.id), r2: createTenantRepos(db, t2.id) };
}

test('migraciones: user_version queda en 2 y reabrir no repite nada', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hub-'));
  try {
    const file = path.join(dir, 'sub', 'hub.db');
    let db = openDb(file);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    createTenant(db, { slug: 'x' });
    db.close();
    db = openDb(file);
    assert.equal(db.prepare('SELECT COUNT(*) c FROM tenants').get().c, 1);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('persistencia: la sesión y el historial sobreviven a un reinicio', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'hub-'));
  try {
    const file = path.join(dir, 'hub.db');
    let db = openDb(file);
    const t = createTenant(db, { slug: 'x' });
    let r = createTenantRepos(db, t.id);
    const s = r.SesionesRepo.get(A);
    s.step = 'catalogIntro'; s.handoffMode = true; s.lead = { name: 'Ana' };
    r.SesionesRepo.save(s);
    r.HistorialRepo.add(A, 'cliente', 'hola');
    db.close();

    db = openDb(file);
    r = createTenantRepos(db, t.id);
    const back = r.SesionesRepo.get(A);
    assert.deepEqual([back.step, back.handoffMode, back.lead.name], ['catalogIntro', true, 'Ana']);
    assert.equal(r.HistorialRepo.listMessages(A)[0].texto, 'hola');
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('aislamiento: un tenant no ve sesiones, leads, historial ni exclusiones de otro', () => {
  const { r1, r2 } = twoTenants();
  const s = r1.SesionesRepo.get(A); s.step = 'askBudget'; r1.SesionesRepo.save(s);
  r1.LeadsRepo.upsert({ userId: A, nombre: 'Cliente de Ana', empleo: 'empleado', ingreso: '5 millones', presupuesto: '90M' });
  r1.HistorialRepo.add(A, 'cliente', 'secreto del tenant 1');
  r1.SesionesRepo.addExcluded('573001112233');
  r1.SesionesRepo.setGlobalPause(true);

  assert.equal(r2.SesionesRepo.get(A).step, 'WELCOME');
  assert.equal(r2.LeadsRepo.listAll().length, 0);
  assert.equal(r2.HistorialRepo.listMessages(A).length, 0);
  assert.equal(r2.HistorialRepo.listConversations().length, 0);
  assert.equal(r2.SesionesRepo.isExcluded(A), false);
  assert.equal(r2.SesionesRepo.isGloballyPaused(), false);
  assert.equal(r1.SesionesRepo.isExcluded(A), true);
  assert.match(r1.LeadsRepo.listAll()[0].calificacion, /Caliente/);
  // un tenant tampoco puede mover etapas de leads ajenos
  const leadId = r1.LeadsRepo.listAll()[0].id;
  r2.LeadsRepo.updateEtapa(leadId, 'cerrado');
  assert.equal(r1.LeadsRepo.listAll()[0].etapa, 'nuevo');
});

test('catálogo y flujo se siembran por tenant según su marca', () => {
  const { r1, r2 } = twoTenants();
  const k = r1.CatalogoRepo.listAll();
  const v = r2.CatalogoRepo.listAll();
  assert.ok(k.length > 0 && v.length > 0);
  assert.notDeepEqual(k.map((i) => i.nombre), v.map((i) => i.nombre));
  assert.ok(k.every((i) => i.variantes.length > 0));
  assert.ok(r1.CatalogoRepo.getCategories().length > 0);
  assert.ok(r1.FlujoRepo.getFlow().nodes.length > 0);
});

test('leads: upsert fusiona datos y la etapa solo avanza', () => {
  const { r1 } = twoTenants();
  r1.LeadsRepo.upsert({ userId: A, nombre: 'Ana', interes: 'Picanto' });
  const l = r1.LeadsRepo.upsert({ userId: A, presupuesto: '80M' });
  assert.deepEqual([l.nombre, l.interes, l.presupuesto], ['Ana', 'Picanto', '80M']);
  assert.equal(r1.LeadsRepo.listAll().length, 1);
  r1.LeadsRepo.updateEtapaByUserId(A, 'negociacion');
  r1.LeadsRepo.updateEtapaByUserId(A, 'cotizando');
  assert.equal(r1.LeadsRepo.listAll()[0].etapa, 'negociacion');
});

test('historial: conversaciones con nombre y estado, y purga de lo antiguo', () => {
  const { db, t1, r1 } = twoTenants();
  r1.LeadsRepo.upsert({ userId: A, nombre: 'Ana Lead' });
  const s = r1.SesionesRepo.get(A); s.advisorTook = true; r1.SesionesRepo.save(s);
  r1.HistorialRepo.add(A, 'cliente', 'hola');
  r1.HistorialRepo.add(A, 'bot', 'bienvenido');
  r1.HistorialRepo.add(A, 'raro', 'se ignora');
  r1.HistorialRepo.add(A, 'cliente', '');
  db.prepare("INSERT INTO historial (tenant_id, user_id, origen, texto, created_at) VALUES (?, 'viejo', 'cliente', 'x', ?)").run(t1.id, Date.now() - 100 * 864e5);
  r1.HistorialRepo.purgeOld();
  const convs = r1.HistorialRepo.listConversations();
  assert.equal(convs.length, 1);
  assert.deepEqual([convs[0].nombre, convs[0].ultimo_origen, convs[0].advisor_took], ['Ana Lead', 'bot', 1]);
});

test('hub multi-tenant: cada webhook se enruta por phone_number_id y responde con su propio negocio', async () => {
  const cfg = loadConfig({ WEBHOOK_VERIFY_TOKEN: 'vt', META_APP_SECRET: 'sec' });
  const { db, t1, t2 } = twoTenants();
  const sent = [];
  const makeProvider = (tenant) => ({ sendText: async (to, text) => { sent.push({ tenant: tenant.slug, to, text }); return {}; } });
  const server = createHub({ cfg, db, makeProvider, log: { log() {}, error() {} } });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const hit = async (pn, from, text, id) => {
    const raw = JSON.stringify({ entry: [{ changes: [{ value: {
      metadata: { phone_number_id: pn },
      contacts: [{ wa_id: from, profile: { name: 'Cli' } }],
      messages: [{ id, from, type: 'text', timestamp: '1', text: { body: text } }],
    } }] }] });
    await fetch(`${base}/webhook`, { method: 'POST', body: raw, headers: { 'x-hub-signature-256': sign(raw, 'sec') } });
    await new Promise((r) => setTimeout(r, 60));
  };
  try {
    await hit('PN1', '573001112233', 'hola', 'w1');
    await hit('PN2', '573001112233', 'hola', 'w2'); // mismo cliente, otro negocio
    await hit('PN-DESCONOCIDO', '573009998877', 'hola', 'w3'); // con 2 tenants, no se adivina
    assert.deepEqual(sent.map((m) => m.tenant), ['uno', 'dos']);
    assert.match(sent[0].text, /Ana/);
    assert.match(sent[1].text, /Beto/);
    // cada negocio tiene su propia conversación del mismo cliente
    assert.equal(createTenantRepos(db, t1.id).HistorialRepo.listConversations().length, 1);
    assert.equal(createTenantRepos(db, t2.id).HistorialRepo.listConversations().length, 1);
    assert.equal(findTenantByPhoneNumberId(db, 'PN2').slug, 'dos');
  } finally { server.close(); }
});

test('modo un-solo-negocio: ensureDefaultTenant es idempotente', () => {
  const db = openDb(':memory:');
  const a = ensureDefaultTenant(db, { marca: 'KIA' }, 'PN9');
  const b = ensureDefaultTenant(db, { marca: 'KIA' }, 'PN9');
  assert.equal(a.id, b.id);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM tenants').get().c, 1);
});
