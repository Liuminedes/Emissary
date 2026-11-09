import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './conversation.flow.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from './defaultFlow.js';

const HOUR = 60 * 60 * 1000;

// Dependencias en memoria: el motor se prueba sin Electron, SQLite ni WhatsApp
function setup({ paused = false, excluded = false } = {}) {
  const sessions = new Map();
  const leads = [];
  const handoffs = [];
  const SesionesRepo = {
    isGloballyPaused: () => paused,
    isExcluded: () => excluded,
    get: (userId) => structuredClone(sessions.get(userId)) || {
      userId, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false,
      lead: {}, catalog: {}, createdAt: Date.now(), updatedAt: Date.now(),
    },
    save: (s) => { s.updatedAt = Date.now(); sessions.set(s.userId, structuredClone(s)); return s; },
  };
  const engine = createEngine({
    NegocioRepo: { get: () => ({ nombre_asesor: 'Ana', nombre_negocio: 'Demo', portfolio_url: '' }) },
    SesionesRepo,
    LeadsRepo: { upsert: (l) => leads.push(l), updateEtapaByUserId() {} },
    FlujoRepo: { getFlow: () => ({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }) },
    CatalogoRepo: { listAll: () => [], getCategories: () => [] },
    sendHandoffNotification: (userId) => handoffs.push(userId),
  });
  const say = (text, userId = '573001112233@s.whatsapp.net') => engine.handleIncomingMessage({ userId, text, pushName: 'Cliente' });
  return { say, sessions, leads, handoffs, SesionesRepo };
}

const USER = '573001112233@s.whatsapp.net';

test('primer mensaje: responde la bienvenida y captura el lead', () => {
  const { say, leads } = setup();
  const replies = say('hola');
  assert.equal(replies.length, 1);
  assert.match(replies[0], /Bienvenido/);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].userId, USER);
});

test('navegación: elegir la opción 1 avanza por la flecha del grafo', () => {
  const { say, sessions } = setup();
  say('hola');
  say('1');
  assert.equal(sessions.get(USER).step, 'catalogIntro');
});

test('opción inválida no avanza de nodo', () => {
  const { say, sessions } = setup();
  say('hola');
  const replies = say('9');
  assert.match(replies[0], /no válida/i);
  assert.equal(sessions.get(USER).step, 'welcome');
});

test('handoff: avisa al asesor y el bot calla después', () => {
  const { say, handoffs, sessions } = setup();
  say('hola');
  const replies = say('quiero hablar con un asesor');
  assert.equal(replies.length, 1);
  assert.deepEqual(handoffs, [USER]);
  assert.equal(sessions.get(USER).handoffMode, true);
  assert.deepEqual(say('gracias'), []);
});

test('"menu" despierta al bot tras un handoff', () => {
  const { say, sessions } = setup();
  say('hola');
  say('asesor');
  assert.deepEqual(say('gracias'), []);
  const replies = say('menu');
  assert.equal(replies.length, 1);
  assert.equal(sessions.get(USER).handoffMode, false);
});

test('una frase con "menu" no reinicia ni interrumpe', () => {
  const { say, sessions } = setup();
  say('hola');
  say('1');
  say('quiero ver el menu completo');
  assert.notEqual(sessions.get(USER).step, 'welcome');
});

test('el asesor activo conserva el chat: "menu" no lo quita', () => {
  const { say, sessions, SesionesRepo } = setup();
  say('hola');
  const s = SesionesRepo.get(USER);
  s.advisorTook = true;
  SesionesRepo.save(s);
  assert.deepEqual(say('menu'), []);
  assert.equal(sessions.get(USER).advisorTook, true);
});

test('el control del asesor expira tras 12 h sin intervenir', () => {
  const { say, sessions, SesionesRepo } = setup();
  say('hola');
  const s = SesionesRepo.get(USER);
  s.advisorTook = true;
  SesionesRepo.save(s);
  sessions.get(USER).updatedAt = Date.now() - 13 * HOUR;
  const replies = say('hola otra vez');
  assert.ok(replies.length > 0);
  assert.equal(sessions.get(USER).advisorTook, false);
});

test('pausa global y excluidos: el bot no responde', () => {
  assert.deepEqual(setup({ paused: true }).say('hola'), []);
  assert.deepEqual(setup({ excluded: true }).say('hola'), []);
});

test('un id anónimo (@lid) no se convierte en teléfono ni en nombre del lead', () => {
  const { say, leads } = setup();
  const LID = '43817373835372@lid';
  say('hola', LID);
  assert.equal(leads[0].telefono, '', 'los dígitos del id anónimo no son un teléfono');
  assert.equal(leads[0].nombre, 'Cliente', 'se usa el nombre del perfil');
});

test('sin nombre de perfil, el lead anónimo queda sin nombre en vez de con el id', () => {
  const { sessions, leads } = setup();
  const motor = createEngine({
    NegocioRepo: { get: () => ({ nombre_asesor: 'Ana', nombre_negocio: 'Demo', portfolio_url: '' }) },
    SesionesRepo: {
      isGloballyPaused: () => false, isExcluded: () => false,
      get: (userId) => ({ userId, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false, lead: {}, catalog: {}, createdAt: Date.now(), updatedAt: Date.now() }),
      save: (s) => s,
    },
    LeadsRepo: { upsert: (l) => leads.push(l), updateEtapaByUserId() {} },
    FlujoRepo: { getFlow: () => ({ nodes: DEFAULT_NODES, edges: DEFAULT_EDGES }) },
    CatalogoRepo: { listAll: () => [], getCategories: () => [] },
    sendHandoffNotification() {},
    telefonoDe: (id) => (id === '77@lid' ? '573004445566' : ''),
  });
  motor.handleIncomingMessage({ userId: '43817373835372@lid', text: 'hola', pushName: '' });
  assert.deepEqual([leads[0].nombre, leads[0].telefono], ['', '']);
  motor.handleIncomingMessage({ userId: '77@lid', text: 'hola', pushName: '' });
  assert.equal(leads[1].telefono, '573004445566', 'si el teléfono ya se conoce, se usa');
  assert.equal(sessions.size, 0);
});
