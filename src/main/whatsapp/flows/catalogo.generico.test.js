import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './conversation.flow.js';
import { getFlowTemplate } from './defaultFlow.js';
import { catalogTerms } from './terms.js';

const COMIDA = [
  { id: 1, categoria: 'Hamburguesas', nombre: 'Smash Doble', emoji: '🍔', descripcion: 'Doble carne', specs: {}, variantes: [{ id: 1, version: 'Sola', precio: 18000, bono: 0 }, { id: 2, version: 'Combo', precio: 24000, bono: 0 }] },
  { id: 2, categoria: 'Hamburguesas', nombre: 'Clásica', emoji: '🍔', descripcion: '', specs: {}, variantes: [{ id: 3, version: 'Sola', precio: 15000, bono: 0 }] },
  { id: 3, categoria: 'Bebidas', nombre: 'Limonada', emoji: '🥤', descripcion: '', specs: {}, variantes: [{ id: 4, version: '12 oz', precio: 7000, bono: 0 }] },
];
const AUTOS = [
  { id: 1, categoria: 'SUV', nombre: 'Sportage', emoji: '🚙', descripcion: '', specs: {}, variantes: [{ id: 1, version: 'LX', precio: 130000000, bono: 0 }] },
  { id: 2, categoria: 'Sedán', nombre: 'K3', emoji: '🚗', descripcion: '', specs: {}, variantes: [{ id: 2, version: 'EX', precio: 80000000, bono: 0 }] },
];

// Flujo propio de un negocio que usa el catálogo: menú -> carta -> pedido (guarda interés) -> dirección
const FLUJO_PEDIDOS = {
  nodes: [
    { id: 'welcome', data: { value: 'Hola, ¿qué quieres hacer?', menu: 'numbers', options: [{ id: 'o1', label: 'Ver la carta' }] } },
    { id: 'carta', data: { value: '{{catalogo}}', options: [] } },
    { id: 'pedido', data: { value: '¿Qué quieres pedir?', capture: 'interest', options: [] } },
    { id: 'direccion', data: { value: '¿A qué dirección lo enviamos?', options: [] } },
  ],
  edges: [{ id: 'e1', source: 'welcome', target: 'carta', sourceHandle: 'o1' }, { id: 'e2', source: 'pedido', target: 'direccion' }],
};

function bot(marca, flow, catalogo) {
  const sessions = new Map();
  const avisos = [];
  const todo = [];
  const engine = createEngine({
    NegocioRepo: { get: () => ({ marca, nombre_asesor: 'Ana', nombre_negocio: 'Demo' }) },
    SesionesRepo: {
      isGloballyPaused: () => false, isExcluded: () => false,
      get: (u) => structuredClone(sessions.get(u)) || { userId: u, step: 'WELCOME', pushName: 'Cli', advisorTook: false, handoffMode: false, lead: {}, catalog: {}, createdAt: 1, updatedAt: 1 },
      save: (s) => { sessions.set(s.userId, structuredClone(s)); return s; },
    },
    LeadsRepo: { upsert() {}, updateEtapaByUserId() {} },
    FlujoRepo: { getFlow: () => flow },
    CatalogoRepo: {
      listAll: () => catalogo,
      getCategories: () => Object.entries(catalogo.reduce((m, i) => ({ ...m, [i.categoria]: (m[i.categoria] || 0) + 1 }), {})).map(([name, count]) => ({ name, count })),
    },
    sendHandoffNotification: (u) => avisos.push(u),
  });
  const say = (text) => { const r = engine.handleIncomingMessage({ userId: 'u@s.whatsapp.net', text, pushName: 'Cli' }); todo.push(...r); return r; };
  return { say, todo, avisos, session: () => sessions.get('u@s.whatsapp.net') };
}

const DE_AUTOS = /veh[ií]culo|autos?\b|🚗|presupuesto|cotiz/i;

test('términos por tipo de negocio', () => {
  assert.equal(catalogTerms('Nuevos').varios, 'vehículos');
  assert.equal(catalogTerms('Usados').uno, 'vehículo');
  assert.equal(catalogTerms('KIA').porPresupuesto, true); // instalaciones anteriores
  assert.equal(catalogTerms('Restaurante').emoji, '🍽️');
  assert.equal(catalogTerms('Blanco').varios, 'productos');
  assert.equal(catalogTerms(undefined).porPresupuesto, false);
});

test('restaurante: recorrer el catálogo no menciona vehículos, autos ni presupuesto', () => {
  const b = bot('Restaurante', FLUJO_PEDIDOS, COMIDA);
  b.say('hola');
  const categorias = b.say('1')[0];
  assert.match(categorias, /Hamburguesas — 2 productos/);
  assert.match(categorias, /Bebidas — 1 producto\b/);
  assert.match(categorias, /categoría te gustaría explorar/);
  assert.match(b.say('1')[0], /🍔 \*Smash Doble\* — desde \$18\.000/);
  const detalle = b.say('1')[0];
  assert.match(detalle, /Pedir este producto 🛵/);
  assert.match(detalle, /Ver otros productos 🔙/);
  const pedir = b.say('1')[0]; // sigue el flujo del negocio: lo que viene tras la pregunta de interés
  assert.match(pedir, /Perfecto, anotado! Pedimos \*Smash Doble\* 🍽️/);
  assert.match(pedir, /¿A qué dirección lo enviamos\?/);
  assert.equal(b.session().lead.interest, 'Smash Doble'); // el producto queda como interés del lead
  for (const m of b.todo) assert.doesNotMatch(m, DE_AUTOS, m.slice(0, 60));
});

test('restaurante: "0" no abre una búsqueda por presupuesto que no existe', () => {
  const b = bot('Restaurante', FLUJO_PEDIDOS, COMIDA);
  b.say('hola'); b.say('1');
  const r = b.say('0')[0];
  assert.match(r, /Escribe solo el número de la opción \(del 1 al 2\)\.$/);
  assert.doesNotMatch(r, /presupuesto/i);
  assert.notEqual(b.session().catalog.dynamicState, 'CATALOG_BUDGET_PROMPT');
});

test('restaurante: un número inválido al elegir habla de productos', () => {
  const b = bot('Restaurante', FLUJO_PEDIDOS, COMIDA);
  b.say('hola'); b.say('1'); b.say('1');
  assert.match(b.say('9')[0], /número del producto \(del 1 al 2\)/);
});

test('vehículos: se conservan las palabras y la búsqueda por presupuesto', () => {
  const b = bot('Nuevos', getFlowTemplate('Nuevos'), AUTOS);
  b.say('hola');
  const categorias = b.say('1')[0];
  assert.match(categorias, /SUV — 1 vehículo\b/);
  assert.match(categorias, /\*0\.\* 🔎 Buscar por presupuesto/);
  assert.match(b.say('0')[0], /presupuesto estimado/i);
  const encontrados = b.say('90 millones');
  assert.match(encontrados[0], /Encontré estos vehículos/);
  assert.match(encontrados[1], /K3/);
  const detalle = b.say('1')[0];
  assert.match(detalle, /Cotizar este vehículo 💰/);
  assert.match(detalle, /Ver otros vehículos 🔙/);
  assert.match(b.say('1')[0], /Te cotizo el \*K3\* 🚗💨/);
});

test('un catálogo en el bloque de inicio entiende las respuestas (antes no las interpretaba)', () => {
  const flow = { nodes: [{ id: 'welcome', data: { value: '{{catalogo}}', options: [] } }], edges: [] };
  const b = bot('Blanco', flow, COMIDA);
  assert.match(b.say('hola')[0], /Hamburguesas — 2 productos/);
  assert.match(b.say('1')[0], /Smash Doble/); // la respuesta se toma como categoría, no se ignora
});

test('si el flujo no sabe a dónde seguir tras elegir un producto, pasa con el asesor', () => {
  const flow = { nodes: [{ id: 'welcome', data: { value: '{{catalogo}}', options: [] } }], edges: [] };
  const b = bot('Blanco', flow, COMIDA.slice(2)); // una sola categoría: lista directa
  b.say('hola');
  b.say('1'); // detalle de Limonada
  const r = b.say('1');
  assert.match(r[0], /Perfecto, anotado! \*Limonada\* 🛍️/);
  assert.match(r[0], /conecto|atiendo/i);
  assert.equal(b.session().handoffMode, true);
  assert.deepEqual(b.avisos, ['u@s.whatsapp.net']);
});
