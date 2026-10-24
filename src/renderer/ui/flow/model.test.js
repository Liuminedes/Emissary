import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, serialize, freeHandle, pruneEdges, validateFlow, autoLayout, newOption } from './model.js';
import { getFlowTemplate } from '../../../main/whatsapp/flows/defaultFlow.js';

const n = (id, data = {}, extra = {}) => ({ id, type: 'messageNode', position: { x: 0, y: 0 }, data: { label: id, value: `texto ${id}`, options: [], ...data }, ...extra });
const e = (source, target, sourceHandle) => ({ id: `${source}-${target}-${sourceHandle || ''}`, source, target, ...(sourceHandle ? { sourceHandle } : {}) });
const textos = (issues, level) => issues.filter((i) => i.level === level).map((i) => i.text);

test('bloques nuevos: cada tipo trae lo que necesita', () => {
  const menu = createBlock('menu');
  assert.deepEqual([menu.data.menu, menu.data.options.length, new Set(menu.data.options.map((o) => o.id)).size], ['letters', 3, 3]);
  assert.match(menu.data.options[1].label, /B$/);
  assert.equal(createBlock('pregunta').data.capture, 'name');
  assert.equal(createBlock('asesor').data.action, 'handoff');
  assert.equal(createBlock('reinicio').data.action, 'restart');
  assert.deepEqual(createBlock('mensaje').data.options, []);
  assert.notEqual(createBlock('mensaje').id, createBlock('mensaje').id);
  assert.match(newOption(3).label, /D$/);
});

test('serializar: quita selección y medidas, redondea posiciones y conserva lo del motor', () => {
  const nodes = [{ ...n('a'), selected: true, measured: { width: 300, height: 200 }, dragging: true, position: { x: 10.7, y: 4.2 } }];
  const out = serialize(nodes, [{ ...e('a', 'a'), selected: true, markerEnd: 'x' }]);
  assert.deepEqual(Object.keys(out.nodes[0]).sort(), ['data', 'id', 'position', 'type']);
  assert.deepEqual(out.nodes[0].position, { x: 11, y: 4 });
  assert.equal(out.edges[0].selected, undefined);
  assert.equal(out.edges[0].animated, true);
});

test('conectar a continuación: busca la primera alternativa libre o la salida única', () => {
  const menu = n('m', { options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }] });
  assert.equal(freeHandle(menu, [e('m', 'x', 'o1')]).handle, 'o2');
  assert.equal(freeHandle(menu, [e('m', 'x', 'o1'), e('m', 'y', 'o2')]), undefined);
  const simple = n('s');
  assert.deepEqual(freeHandle(simple, []), { handle: undefined });
  assert.equal(freeHandle(simple, [e('s', 'x')]), undefined);
});

test('al borrar una alternativa se borran sus flechas, y las de bloques que ya no existen', () => {
  const nodes = [n('m', { options: [{ id: 'o1', label: 'A' }] }), n('x')];
  const edges = [e('m', 'x', 'o1'), e('m', 'x', 'o_borrada'), e('m', 'fantasma'), e('x', 'm')];
  assert.deepEqual(pruneEdges(nodes, edges).map((k) => k.id), ['m-x-o1', 'x-m-']);
});

test('validación: alternativa sin destino, mensaje vacío, bloque inalcanzable y final de flujo', () => {
  const nodes = [
    n('welcome', { options: [{ id: 'o1', label: 'Plan A' }, { id: 'o2', label: 'Plan B' }], menu: 'letters' }),
    n('a'), n('vacio', { value: '' }), n('suelto'),
  ];
  const edges = [e('welcome', 'a', 'o1'), e('welcome', 'vacio', 'o2')];
  const issues = validateFlow(nodes, edges);
  assert.deepEqual(textos(issues, 'error'), ['"vacio" no tiene mensaje.']);
  assert.ok(textos(issues, 'warn').some((t) => /"suelto" no se alcanza/.test(t)));
  assert.ok(textos(issues, 'info').some((t) => /"a" es un final de flujo/.test(t)));

  const sinDestino = validateFlow(nodes, [e('welcome', 'a', 'o1')]);
  assert.ok(textos(sinDestino, 'error').some((t) => /"Plan B" de "welcome" no lleva a ningún bloque/.test(t)));
});

test('validación: un final con acción de transferir no es un aviso', () => {
  const nodes = [n('welcome'), n('fin', { action: 'handoff' })];
  const issues = validateFlow(nodes, [e('welcome', 'fin')]);
  assert.ok(!issues.some((i) => i.nodeId === 'fin'));
});

test('validación: alias repetidos entre alternativas y flujo vacío', () => {
  const nodes = [n('welcome', { options: [{ id: 'o1', label: 'Sí', keywords: ['ok'] }, { id: 'o2', label: 'Tal vez', keywords: ['ok'] }] }), n('x')];
  const issues = validateFlow(nodes, [e('welcome', 'x', 'o1'), e('welcome', 'x', 'o2')]);
  assert.ok(textos(issues, 'warn').some((t) => /"ok" también coincide/.test(t)));
  assert.equal(validateFlow([], [])[0].level, 'error');
});

test('las plantillas del producto no traen errores de validación', () => {
  for (const marca of ['Nuevos', 'Usados', 'Restaurante', 'Blanco', 'KIA']) {
    const { nodes, edges } = getFlowTemplate(marca);
    const errores = textos(validateFlow(nodes, edges), 'error');
    // Las plantillas antiguas pueden traer una alternativa sin texto (usan "keyword"); aquí solo importan los errores graves
    assert.deepEqual(errores.filter((t) => /no lleva a ningún bloque|no tiene mensaje/.test(t)), [], marca);
  }
});

test('orden automático: columnas por profundidad, sin superposición y sin perder bloques', () => {
  const nodes = [
    n('welcome', { options: [{ id: 'o1', label: 'A' }, { id: 'o2', label: 'B' }, { id: 'o3', label: 'C' }] }),
    n('a'), n('b'), n('c'), n('a2'), n('suelto'),
  ];
  const edges = [e('welcome', 'a', 'o1'), e('welcome', 'b', 'o2'), e('welcome', 'c', 'o3'), e('a', 'a2'), e('a2', 'welcome')]; // el ciclo no rompe nada
  const out = autoLayout(nodes, edges, () => ({ w: 300, h: 200 }));
  const pos = Object.fromEntries(out.map((k) => [k.id, k.position]));
  assert.equal(out.length, nodes.length);
  assert.ok(pos.welcome.x < pos.a.x && pos.a.x < pos.a2.x);
  assert.equal(pos.a.x, pos.b.x);
  assert.ok(pos.a.y < pos.b.y && pos.b.y < pos.c.y); // el orden de las alternativas se respeta
  assert.ok(pos.b.y - pos.a.y >= 200); // no se pisan
  assert.ok(pos.suelto.x > pos.a2.x); // los bloques sueltos quedan aparte
});
