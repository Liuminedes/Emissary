// src/main/util/formatLog.js
// Convierte los argumentos de un log en una línea de texto legible. Baileys registra objetos ({ err, node, ... }) y
// `args.join(' ')` los dejaba como "[object Object]", sin el motivo del error. Módulo puro.

function serialize(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Error) return { name: v.name, message: v.message, ...(v.output?.statusCode ? { statusCode: v.output.statusCode } : {}) };
    if (typeof v === 'bigint') return String(v);
    if (v && typeof v === 'object') {
      if (v.type === 'Buffer') return '[Buffer]';
      if (seen.has(v)) return '[circular]';
      seen.add(v);
    }
    return v;
  });
}

export function formatLogArgs(args, max = 600) {
  const text = args.map((a) => {
    if (a instanceof Error) return `${a.name}: ${a.message}`;
    if (a && typeof a === 'object') { try { return serialize(a); } catch { return String(a); } }
    return String(a);
  }).join(' ');
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
