import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './conversation.flow.js';
import { matchOption, menuText, fullText, captureOf, startNodeOf, optionTag } from './flowRuntime.js';

const plan = (menu = 'letters') => ({
  id: 'planes', data: {
    value: 'Elige tu plan', menu,
    options: [
      { id: 'o1', label: 'Plan A – Básico', keywords: ['basico', 'el mas barato'] },
      { id: 'o2', label: 'Plan B – Intermedio' },
      { id: 'o3', label: 'Plan C – Premium' },
      { id: 'o4', label: 'Plan D – A la medida' },
    ],
  },
});

// ---------- Reglas puras ----------

test('menú automático: letras, números y sin lista', () => {
  assert.equal(menuText(plan('letters')), '*A)* Plan A – Básico\n*B)* Plan B – Intermedio\n*C)* Plan C – Premium\n*D)* Plan D – A la medida');
  assert.match(menuText(plan('numbers')), /^\*1️⃣\* Plan A/);
  assert.equal(menuText(plan('none')), '');
  assert.equal(fullText(plan('letters')).startsWith('Elige tu plan\n\n*A)*'), true);
  assert.equal(optionTag('numbers', 11), '12.'); // más de 10 opciones: ya no hay emoji
});

test('elegir una alternativa: letra, número, etiqueta o alias, sin importar mayúsculas ni tildes', () => {
  const n = plan('letters');
  for (const [input, esperado] of [['A', 'o1'], ['b', 'o2'], ['3', 'o3'], ['plan d – a la medida', 'o4'], ['Plan C', null], ['BÁSICO', 'o1'], ['el más barato', 'o1'], [' c ', 'o3']]) {
    assert.equal(matchOption(n, input)?.id ?? null, esperado, input);
  }
  assert.equal(matchOption(n, 'e'), null);
  assert.equal(matchOption(n, '9'), null);
  assert.equal(matchOption(n, ''), null);
  assert.equal(matchOption(plan('numbers'), 'a'), null); // la letra solo vale si el menú es por letras
});

test('compatibilidad: opciones antiguas con "keyword" y sin etiqueta siguen funcionando', () => {
  const legacy = { id: 'welcome', data: { value: '1 Catálogo\n2 Asesor', options: [{ id: 'a', keyword: '1' }, { id: 'b', keyword: '2' }] } };
  assert.equal(matchOption(legacy, '2').id, 'b');
  assert.equal(menuText(legacy), '');
});

test('captura: la declarada manda y los ids antiguos siguen valiendo', () => {
  assert.equal(captureOf({ id: 'x', data: { capture: 'phone' } }), 'phone');
  assert.equal(captureOf({ id: 'askBudget', data: {} }), 'budget');
  assert.equal(captureOf({ id: 'askBudget', data: { capture: 'income' } }), 'income');
  assert.equal(captureOf({ id: 'otro', data: {} }), null);
});

test('bloque de inicio: marcado, "welcome" o el primero', () => {
  const nodes = [{ id: 'a', data: {} }, { id: 'welcome', data: {} }, { id: 'c', data: { isStart: true } }];
  assert.equal(startNodeOf(nodes).id, 'c');
  assert.equal(startNodeOf(nodes.slice(0, 2)).id, 'welcome');
  assert.equal(startNodeOf(nodes.slice(0, 1)).id, 'a');
});

// ---------- Motor con un flujo propio ----------

const edge = (source, target, sourceHandle) => ({ id: `${source}-${target}-${sourceHandle || ''}`, source, target, ...(sourceHandle ? { sourceHandle } : {}) });

const FLOW = {
  nodes: [
    { id: 'inicio', data: { label: 'Inicio', isStart: true, value: 'Hola, soy {asesor}. ¿Cuál plan te interesa?', menu: 'letters', fallback: 'No te entendí, responde A, B, C o D',
      options: [
        { id: 'oa', label: 'Plan A', keywords: ['basico'] }, { id: 'ob', label: 'Plan B' },
        { id: 'oc', label: 'Plan C' }, { id: 'od', label: 'Plan D' },
      ] } },
    { id: 'pideNombre', data: { value: '¿Cómo te llamas?', capture: 'name' } },
    { id: 'pideTel', data: { value: '¿A qué número te contactamos?', capture: 'phone' } },
    { id: 'gracias', data: { value: 'Listo, te contactamos.', action: 'handoff' } },
    { id: 'infoB', data: { value: 'El plan B incluye X.', action: 'restart' } },
    { id: 'infoC', data: { value: 'El plan C incluye Y.' } },
  ],
  edges: [
    edge('inicio', 'pideNombre', 'oa'), edge('inicio', 'infoB', 'ob'), edge('inicio', 'infoC', 'oc'), // 'od' queda sin destino a propósito
    edge('pideNombre', 'pideTel'), edge('pideTel', 'gracias'),
  ],
};

function setup(flow = FLOW) {
  const sessions = new Map();
  const leads = [];
  const avisos = [];
  const engine = createEngine({
    NegocioRepo: { get: () => ({ nombre_asesor: 'Ana', nombre_negocio: 'Demo' }) },
    SesionesRepo: {
      isGloballyPaused: () => false, isExcluded: () => false,
      get: (u) => structuredClone(sessions.get(u)) || { userId: u, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false, lead: {}, catalog: {}, createdAt: Date.now(), updatedAt: Date.now() },
      save: (s) => { s.updatedAt = Date.now(); sessions.set(s.userId, structuredClone(s)); return s; },
    },
    LeadsRepo: { upsert: (l) => leads.push(l), updateEtapaByUserId() {} },
    FlujoRepo: { getFlow: () => flow },
    CatalogoRepo: { listAll: () => [], getCategories: () => [] },
    sendHandoffNotification: (u) => avisos.push(u),
  });
  const say = (text) => engine.handleIncomingMessage({ userId: 'u1@s.whatsapp.net', text, pushName: 'Cliente' });
  return { say, sessions, leads, avisos };
}

test('el primer mensaje muestra el inicio con el menú de planes ya armado', () => {
  const { say } = setup();
  const [msg] = say('hola');
  assert.match(msg, /Hola, soy Ana/);
  assert.match(msg, /\*A\)\* Plan A\n\*B\)\* Plan B\n\*C\)\* Plan C\n\*D\)\* Plan D$/);
});

test('cada alternativa lleva a su propio camino', () => {
  const a = setup(); a.say('hola');
  assert.match(a.say('A')[0], /cómo te llamas/i);
  const c = setup(); c.say('hola');
  assert.equal(c.say('plan c')[0], 'El plan C incluye Y.');
  const alias = setup(); alias.say('hola');
  assert.match(alias.say('Básico')[0], /cómo te llamas/i); // alias de la opción A
});

test('si no entiende, responde el mensaje propio del bloque y no avanza ni captura', () => {
  const { say, sessions, leads } = setup();
  say('hola');
  assert.deepEqual(say('quiero otra cosa'), ['No te entendí, responde A, B, C o D']);
  assert.equal(sessions.get('u1@s.whatsapp.net').step, 'inicio');
  assert.equal(leads.length, 1); // solo la captura temprana del primer contacto
});

test('un bloque con "capture" guarda la respuesta en el campo del lead, sin depender de su id', () => {
  const { say, sessions, leads } = setup();
  say('hola'); say('a');
  say('María Pérez');
  assert.equal(sessions.get('u1@s.whatsapp.net').lead.name, 'María Pérez');
  assert.equal(leads.at(-1).nombre, 'María Pérez');
  say('3001234567');
  assert.equal(sessions.get('u1@s.whatsapp.net').lead.phone, '3001234567');
});

test('acción "transferir": al llegar avisa al asesor y el bot calla', () => {
  const { say, sessions, avisos } = setup();
  say('hola'); say('a'); say('María');
  const r = say('3001234567');
  assert.equal(r[0], 'Listo, te contactamos.');
  assert.equal(sessions.get('u1@s.whatsapp.net').handoffMode, true);
  assert.deepEqual(avisos, ['u1@s.whatsapp.net']);
  assert.deepEqual(say('gracias'), []);
});

test('acción "reiniciar": el siguiente mensaje vuelve a empezar por el inicio', () => {
  const { say } = setup();
  say('hola');
  assert.equal(say('b')[0], 'El plan B incluye X.');
  assert.match(say('ok')[0], /Hola, soy Ana/);
});

test('una alternativa sin flecha pausa el bot y avisa al asesor en vez de quedar mudo', () => {
  const { say, sessions, avisos } = setup();
  say('hola');
  assert.deepEqual(say('d'), []);
  assert.equal(sessions.get('u1@s.whatsapp.net').handoffMode, true);
  assert.equal(avisos.length, 1);
});

test('el bloque final sin flechas también avisa al asesor (antes se perdía el lead)', () => {
  const { say, avisos } = setup();
  say('hola'); say('c'); // infoC no tiene salida
  say('gracias');
  assert.equal(avisos.length, 1);
});
