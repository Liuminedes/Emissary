// src/renderer/ui/flow/model.js
// Lógica pura del editor de flujos (sin React): crear bloques, validar, ordenar y serializar.
// Comparte las reglas con el motor del bot a través de flowRuntime, así lo que se ve aquí es lo que ocurre en WhatsApp.
import { startNodeOf, captureOf, matchOption } from '../../../main/whatsapp/flows/flowRuntime.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let counter = 0;
export const newId = (prefix = 'b') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export const newOption = (index = 0) => ({ id: newId('o'), label: `Opción ${LETTERS[index] || index + 1}`, keywords: [] });

// Tipos de bloque que se pueden añadir con un clic
export const BLOCK_KINDS = [
  { id: 'mensaje', label: 'Mensaje', hint: 'Dice algo y sigue al siguiente bloque' },
  { id: 'menu', label: 'Menú de alternativas', hint: 'Plan A, B, C… cada una lleva a su camino' },
  { id: 'pregunta', label: 'Pregunta y guardar dato', hint: 'Pregunta y guarda la respuesta en el lead' },
  { id: 'asesor', label: 'Transferir a un asesor', hint: 'Avisa al asesor y el bot se pausa' },
  { id: 'reinicio', label: 'Reiniciar conversación', hint: 'La próxima vez empieza desde el inicio' },
];

export function createBlock(kind, position = { x: 0, y: 0 }) {
  const base = { id: newId(), type: 'messageNode', position };
  switch (kind) {
    case 'menu':
      return { ...base, data: { label: 'Menú de alternativas', value: '¿Cuál te interesa?', menu: 'letters', options: [newOption(0), newOption(1), newOption(2)] } };
    case 'pregunta':
      return { ...base, data: { label: 'Pregunta', value: '¿Cuál es tu nombre?', capture: 'name', options: [] } };
    case 'asesor':
      return { ...base, data: { label: 'Transferir a asesor', value: '¡Claro! 💬 Ya te atiendo personalmente, en un momento estoy contigo.', action: 'handoff', options: [] } };
    case 'reinicio':
      return { ...base, data: { label: 'Reiniciar', value: 'Gracias por escribirnos 🙌 Cuando quieras, aquí estoy.', action: 'restart', options: [] } };
    default:
      return { ...base, data: { label: 'Mensaje', value: '', options: [] } };
  }
}

// Guarda solo lo que el motor necesita: sin selección, medidas ni estado visual del lienzo
export function serialize(nodes, edges) {
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'messageNode', position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data: n.data })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}), animated: true, style: e.style })),
  };
}

// Primer lugar libre para conectar un bloque nuevo a continuación de `node`:
// la primera alternativa sin flecha, o la salida única si aún no tiene. undefined = sin lugar libre.
export function freeHandle(node, edges) {
  const out = edges.filter((e) => e.source === node.id);
  const options = node.data.options || [];
  if (options.length) {
    const libre = options.find((o) => !out.some((e) => e.sourceHandle === o.id));
    return libre ? { handle: libre.id } : undefined;
  }
  return out.length ? undefined : { handle: undefined };
}

// Quita las flechas que salían de alternativas que ya no existen
export const pruneEdges = (nodes, edges) => edges.filter((e) => {
  const src = nodes.find((n) => n.id === e.source);
  if (!src || !nodes.some((n) => n.id === e.target)) return false;
  if (!e.sourceHandle) return true;
  return (src.data.options || []).some((o) => o.id === e.sourceHandle);
});

// ---------- Validación ----------

const label = (n) => n.data.label || n.id;

export function validateFlow(nodes, edges) {
  const issues = [];
  const add = (level, nodeId, text) => issues.push({ level, nodeId, text });
  if (!nodes.length) return [{ level: 'error', nodeId: null, text: 'El flujo está vacío: añade al menos un bloque.' }];

  const ids = new Set(nodes.map((n) => n.id));
  const start = startNodeOf(nodes);

  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) add('error', null, 'Hay una flecha que apunta a un bloque que ya no existe.');
  }

  // Alcanzables desde el inicio
  const seen = new Set([start.id]);
  const queue = [start.id];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of edges) if (e.source === cur && ids.has(e.target) && !seen.has(e.target)) { seen.add(e.target); queue.push(e.target); }
  }

  for (const n of nodes) {
    const options = n.data.options || [];
    const out = edges.filter((e) => e.source === n.id);
    const text = (n.data.value || '').trim();
    const action = n.data.action;

    if (!seen.has(n.id)) add('warn', n.id, `"${label(n)}" no se alcanza desde el inicio: ningún camino llega hasta él.`);
    if (!text && !options.length) add('error', n.id, `"${label(n)}" no tiene mensaje.`);

    for (const o of options) {
      if (!(o.label || '').trim() && !o.keyword) add('error', n.id, `"${label(n)}" tiene una alternativa sin texto.`);
      if (!out.some((e) => e.sourceHandle === o.id)) {
        add('error', n.id, `La alternativa "${o.label || o.keyword}" de "${label(n)}" no lleva a ningún bloque: si el cliente la elige, el bot se pausa.`);
      }
    }

    // Una respuesta que activaría dos alternativas a la vez (alias repetidos)
    if (options.length > 1) {
      const dueños = new Map();
      options.forEach((o) => [o.label, o.keyword, ...(o.keywords || [])].filter(Boolean).forEach((k) => {
        const hit = matchOption({ data: { options, menu: n.data.menu } }, k);
        if (hit && hit.id !== o.id && !dueños.has(`${o.id}|${hit.id}`)) {
          dueños.set(`${o.id}|${hit.id}`, true);
          add('warn', n.id, `En "${label(n)}", "${k}" también coincide con otra alternativa: se tomará la primera.`);
        }
      }));
    }

    if (!options.length && out.length === 0 && !action && !n.data.value?.includes('{{catalogo}}')) {
      add('info', n.id, `"${label(n)}" es un final de flujo: tras responder, el bot se pausa y avisa al asesor.`);
    }
    if (!options.length && out.length > 1) add('warn', n.id, `"${label(n)}" tiene varias flechas pero sin alternativas: solo se usa la primera.`);
    if (options.length && !(options.some((o) => o.label) || /\d/.test(text))) {
      add('info', n.id, `"${label(n)}" no muestra sus alternativas: escríbelas en el mensaje o activa el menú automático.`);
    }
    if (n.data.capture && !captureOf(n)) add('warn', n.id, `"${label(n)}" guarda un dato que Emissary no reconoce.`);
  }

  const order = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

// ---------- Orden automático ----------

// Columnas por profundidad desde el inicio; dentro de cada columna, apilado según el orden de las alternativas.
export function autoLayout(nodes, edges, sizeOf = () => ({ w: 340, h: 240 }), gap = { x: 160, y: 60 }) {
  const start = startNodeOf(nodes);
  const depth = new Map([[start.id, 0]]);
  const order = [start.id];
  for (let i = 0; i < order.length; i++) {
    const cur = nodes.find((n) => n.id === order[i]);
    const optionOrder = (cur.data.options || []).map((o) => o.id);
    const out = edges.filter((e) => e.source === cur.id)
      .sort((a, b) => optionOrder.indexOf(a.sourceHandle) - optionOrder.indexOf(b.sourceHandle));
    for (const e of out) {
      if (!depth.has(e.target) && nodes.some((n) => n.id === e.target)) { depth.set(e.target, depth.get(cur.id) + 1); order.push(e.target); }
    }
  }
  // Los bloques sueltos van al final, en su propia columna
  const extra = Math.max(...depth.values()) + 1;
  for (const n of nodes) if (!depth.has(n.id)) { depth.set(n.id, extra); order.push(n.id); }

  const columnX = [];
  const colWidth = (d) => Math.max(...nodes.filter((n) => depth.get(n.id) === d).map((n) => sizeOf(n).w));
  const maxDepth = Math.max(...depth.values());
  let x = 0;
  for (let d = 0; d <= maxDepth; d++) { columnX[d] = x; x += (isFinite(colWidth(d)) ? colWidth(d) : 340) + gap.x; }

  const cursor = new Map();
  const positions = new Map();
  for (const id of order) {
    const n = nodes.find((m) => m.id === id);
    const d = depth.get(id);
    const y = cursor.get(d) || 0;
    positions.set(id, { x: columnX[d], y });
    cursor.set(d, y + sizeOf(n).h + gap.y);
  }
  return nodes.map((n) => ({ ...n, position: positions.get(n.id) }));
}
