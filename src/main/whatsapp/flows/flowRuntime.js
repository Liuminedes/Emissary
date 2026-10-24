// src/main/whatsapp/flows/flowRuntime.js
// Reglas del grafo de conversación que comparten el motor, el editor y el simulador. Módulo puro.
//
// Un bloque (node.data) puede traer:
//   value     texto del mensaje (admite variables como {asesor} y {{catalogo}})
//   options   [{ id, label, keywords?: string[], keyword? }]  alternativas (Plan A, B, C, D…)
//   menu      'letters' | 'numbers' | 'none'  cómo se listan las opciones bajo el mensaje
//   capture   campo del lead que llena la respuesta (interest, budget, name…)
//   action    'handoff' (avisa al asesor) | 'restart' (la próxima vez empieza de cero)
//   fallback  qué responder si no entiende la opción
//   isStart   bloque de inicio (por defecto el id 'welcome' o el primero)
import { normalize } from './keywords.js';

export const CAPTURE_FIELDS = {
  interest: 'Interés',
  budget: 'Presupuesto',
  employment: 'Ocupación',
  income: 'Ingresos',
  creditCheck: 'Centrales de riesgo',
  name: 'Nombre',
  phone: 'Teléfono',
};

export const ACTIONS = { handoff: 'Transferir a un asesor', restart: 'Reiniciar la conversación' };

export const DEFAULT_FALLBACK = 'Opción no válida. Elige una de las opciones indicadas 👆';

// Los flujos anteriores dependían de estos ids; se siguen respetando si el bloque no declara su propio `capture`
const LEGACY_CAPTURE = {
  askInterest: 'interest', askBudget: 'budget', askEmployment: 'employment',
  askIncome: 'income', askCreditCheck: 'creditCheck', askLeadName: 'name', askLeadPhone: 'phone',
};

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const KEYCAPS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const captureOf = (node) => node?.data?.capture || LEGACY_CAPTURE[node?.id] || null;
export const startNodeOf = (nodes) => nodes.find((n) => n.data?.isStart) || nodes.find((n) => n.id === 'welcome') || nodes[0];
export const handoffNodeOf = (nodes) => nodes.find((n) => n.data?.action === 'handoff') || nodes.find((n) => n.id === 'handoffDirect') || nodes.find((n) => n.id === 'handoff');
export const nodeByCapture = (nodes, field) => nodes.find((n) => captureOf(n) === field);

export const optionTag = (style, index) => (style === 'letters' ? `${LETTERS[index]})` : KEYCAPS[index] || `${index + 1}.`);

// Lista de opciones que se agrega bajo el mensaje; vacía si el bloque escribe su propio menú
export function menuText(node) {
  const style = node?.data?.menu;
  if (style !== 'letters' && style !== 'numbers') return '';
  return (node.data.options || [])
    .map((opt, i) => (opt.label ? `*${optionTag(style, i)}* ${opt.label}` : null))
    .filter(Boolean)
    .join('\n');
}

export function fullText(node) {
  const base = node?.data?.value || '';
  const menu = menuText(node);
  return menu ? `${base}${base ? '\n\n' : ''}${menu}` : base;
}

// Alternativa que corresponde a lo que escribió el cliente, o null.
// Orden: texto explícito (etiqueta o alias) → número de posición → letra de posición
export function matchOption(node, input) {
  const t = normalize(input);
  const options = node?.data?.options || [];
  if (!t || !options.length) return null;

  const explicit = options.find((opt) => {
    const names = [opt.label, opt.keyword, ...(opt.keywords || [])].map(normalize).filter(Boolean);
    return names.includes(t);
  });
  if (explicit) return explicit;

  if (/^\d+$/.test(t)) return options[Number(t) - 1] || null;
  if (node.data.menu === 'letters' && /^[a-z]$/.test(t)) return options[t.charCodeAt(0) - 97] || null;
  return null;
}

// Etiqueta legible de la alternativa elegida (lo que se guarda en el lead)
export const optionName = (opt) => opt.label || opt.keyword || '';
