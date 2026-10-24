import test from 'node:test';
import assert from 'node:assert/strict';
import { getFlowTemplate } from './defaultFlow.js';
import { createEngine } from './conversation.flow.js';

const PLANTILLAS = ['Nuevos', 'Usados', 'Restaurante', 'Blanco', 'Volkswagen', 'KIA', 'JAC'];

test('cada plantilla es un grafo coherente: las flechas apuntan a bloques que existen', () => {
  for (const marca of PLANTILLAS) {
    const { nodes, edges } = getFlowTemplate(marca);
    const ids = new Set(nodes.map((n) => n.id));
    assert.equal(ids.size, nodes.length, `${marca}: ids repetidos`);
    for (const e of edges) {
      assert.ok(ids.has(e.source) && ids.has(e.target), `${marca}: flecha ${e.id} rota`);
    }
  }
});

test('en las plantillas nuevas toda alternativa lleva a algún bloque', () => {
  const { nodes, edges } = getFlowTemplate('Usados');
  for (const n of nodes) {
    for (const o of n.data.options || []) {
      assert.ok(edges.some((e) => e.source === n.id && e.sourceHandle === o.id), `${n.id}/${o.id} sin destino`);
    }
  }
});

test('"Nuevos" y "Usados" son flujos de concesionario, no el del restaurante', () => {
  for (const marca of ['Nuevos', 'Usados']) {
    const inicio = getFlowTemplate(marca).nodes.find((n) => n.id === 'welcome').data.value;
    assert.doesNotMatch(inicio, /Ivy|Burgers/);
  }
  assert.notDeepEqual(getFlowTemplate('Nuevos').nodes, getFlowTemplate('Usados').nodes);
});

test('recorrido completo de "Usados": cotizar, presupuesto, retoma, datos y aviso al asesor', () => {
  const flow = getFlowTemplate('Usados');
  const sessions = new Map();
  const leads = [];
  const avisos = [];
  const engine = createEngine({
    NegocioRepo: { get: () => ({ nombre_asesor: 'Ana', nombre_negocio: 'Autos Demo' }) },
    SesionesRepo: {
      isGloballyPaused: () => false, isExcluded: () => false,
      get: (u) => structuredClone(sessions.get(u)) || { userId: u, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false, lead: {}, catalog: {}, createdAt: 1, updatedAt: 1 },
      save: (s) => { sessions.set(s.userId, structuredClone(s)); return s; },
    },
    LeadsRepo: { upsert: (l) => leads.push(l), updateEtapaByUserId() {} },
    FlujoRepo: { getFlow: () => flow },
    CatalogoRepo: { listAll: () => [], getCategories: () => [] },
    sendHandoffNotification: (u) => avisos.push(u),
  });
  const say = (text) => engine.handleIncomingMessage({ userId: 'u@s.whatsapp.net', text, pushName: 'Cli' });

  const [bienvenida] = say('hola');
  assert.match(bienvenida, /Ana de \*Autos Demo\*|Ana.*Autos Demo|Te habla \*Ana\* de \*Autos Demo\*/);
  assert.match(bienvenida, /1️⃣\* 🚗 Ver vehículos disponibles/);
  assert.match(say('2')[0], /qué vehículo buscas/i);
  assert.match(say('SUV familiar')[0], /A\)\* Hasta \$40M/);
  assert.match(say('c')[0], /parte de pago/);       // presupuesto: alternativa C
  assert.match(say('2')[0], /nombre completo/i);    // sin retoma
  say('María Pérez');
  assert.match(say('3001234567')[0], /Recibí tu información/);

  const lead = sessions.get('u@s.whatsapp.net').lead;
  assert.deepEqual([lead.interest, lead.budget, lead.name, lead.phone], ['SUV familiar', '$80M – $120M', 'María Pérez', '3001234567']);
  assert.deepEqual(avisos, ['u@s.whatsapp.net']);
  assert.deepEqual(say('gracias'), []);
});
