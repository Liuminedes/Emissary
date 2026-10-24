// src/main/db/leadsCsv.js
// Exportación de leads a CSV. Módulo puro.
//
// - Separador ";" y BOM UTF-8: Excel con configuración regional de Colombia/España usa ";" y,
//   con "," abriría todo en una sola columna; el BOM evita que se rompan las tildes.
// - Protección contra inyección de fórmulas: un texto que empieza por = + - @ se prefija con "'".
// - El teléfono se escribe como ="573001112233": así Excel lo muestra completo (sin 5,73E+11) y,
//   como solo contiene dígitos, no puede ejecutar nada.

export const SEPARATOR = ';';
export const BOM = '﻿';

const ETAPAS = { nuevo: 'Nuevo', cotizando: 'Cotizando', negociacion: 'Negociación', cerrado: 'Cerrado', perdido: 'Perdido' };
export const HEADERS = ['Nombre', 'Teléfono', 'Interés', 'Presupuesto', 'Ocupación', 'Ingresos', 'Etapa', 'Calificación', 'Fecha de registro', 'Última actualización', 'Notas'];

const pad = (n) => String(n).padStart(2, '0');
export const formatDate = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function escapeCell(value) {
  let s = String(value ?? '').replace(/\r\n|\r|\n/g, ' ').trim();
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const phoneCell = (tel) => {
  const digits = String(tel ?? '').replace(/\D/g, '');
  return digits ? `="${digits}"` : '';
};

// Quita los emojis de la calificación ("🔥 Caliente" -> "Caliente")
const plain = (s) => String(s ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();

/**
 * @param {object[]} leads             filas de la tabla leads
 * @param {Map<number,string[]>} notas  notas por id de lead
 */
export function leadsToCsv(leads, notas = new Map()) {
  const rows = leads.map((l) => [
    escapeCell(l.nombre), phoneCell(l.telefono), escapeCell(l.interes), escapeCell(l.presupuesto),
    escapeCell(l.empleo), escapeCell(l.ingreso), escapeCell(ETAPAS[l.etapa] || l.etapa),
    escapeCell(plain(l.calificacion)), formatDate(l.created_at), formatDate(l.updated_at),
    escapeCell((notas.get(l.id) || []).join(' | ')),
  ].join(SEPARATOR));
  return [HEADERS.join(SEPARATOR), ...rows].join('\r\n') + '\r\n';
}
