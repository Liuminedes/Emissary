// src/main/db/segmentos.js
// Segmentos de leads para difusiones y su exportación (vCard y CSV). Módulo puro: recibe los datos ya leídos.
import { ETAPAS } from './scoring.js';
import { escapeCell, BOM } from './leadsCsv.js';

export const CALIFICACIONES = { caliente: 'Caliente', tibio: 'Tibio', frio: 'Frío' };
export const MAX_POR_LISTA = 256; // tope de contactos de una lista de difusión de la app de WhatsApp Business
const DIA = 86_400_000;

/** Deja el filtro en su forma válida (lo que llega de la pantalla no se confía). */
export function normalizeFiltro(raw = {}) {
  const dias = Number.parseInt(raw.diasSinContacto, 10);
  return {
    etapas: (Array.isArray(raw.etapas) ? raw.etapas : []).filter((e) => ETAPAS.includes(e)),
    calificaciones: (Array.isArray(raw.calificaciones) ? raw.calificaciones : []).filter((c) => c in CALIFICACIONES),
    diasSinContacto: Number.isFinite(dias) ? Math.min(Math.max(dias, 0), 3650) : 0,
    interes: String(raw.interes ?? '').trim().slice(0, 80),
  };
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// El número sale del identificador de WhatsApp; si es un id oculto (@lid) se usa el teléfono que dio el cliente
function numeroDe(lead) {
  const [id, dominio] = String(lead.user_id ?? '').split('@');
  const delLead = String(lead.telefono ?? '').replace(/\D/g, '');
  // Un "teléfono" idéntico al id anónimo es un dato inventado, no el número de la persona
  const digitos = dominio === 's.whatsapp.net' ? id.replace(/\D/g, '') : delLead === id.replace(/\D/g, '') ? '' : delLead;
  return digitos.length >= 10 && digitos.length <= 15 ? digitos : '';
}

/**
 * @param {object[]} leads  filas de leads
 * @param {object} filtro   salida de normalizeFiltro
 * @param {{ bajas?: Set<string>, ultimoContacto?: Map<string, number>, now?: number }} ctx
 *   bajas: números (solo dígitos) y user_id de quienes pidieron no recibir difusiones
 * @returns {{ contactos: {nombre,numero,etapa,calificacion}[], sinNumero: number, enBaja: number }}
 */
export function applySegmento(leads, filtro, { bajas = new Set(), ultimoContacto = new Map(), now = Date.now() } = {}) {
  const f = normalizeFiltro(filtro);
  const contactos = [];
  const vistos = new Set();
  let sinNumero = 0;
  let enBaja = 0;
  for (const l of leads) {
    if (f.etapas.length && !f.etapas.includes(l.etapa)) continue;
    if (f.calificaciones.length && !f.calificaciones.some((c) => norm(l.calificacion).includes(norm(CALIFICACIONES[c])))) continue;
    if (f.interes && !norm(l.interes).includes(norm(f.interes))) continue;
    if (f.diasSinContacto) {
      const ultimo = ultimoContacto.get(l.user_id) ?? l.updated_at ?? 0;
      if (now - ultimo < f.diasSinContacto * DIA) continue;
    }
    const numero = numeroDe(l);
    if (!numero) { sinNumero++; continue; }
    if (bajas.has(numero) || bajas.has(l.user_id)) { enBaja++; continue; }
    if (vistos.has(numero)) continue; // un mismo número con dos leads se cuenta una vez
    vistos.add(numero);
    contactos.push({ nombre: String(l.nombre ?? '').trim(), numero, etapa: l.etapa, calificacion: l.calificacion });
  }
  return { contactos, sinNumero, enBaja };
}

const vcardText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, ' ').replace(/([,;])/g, '\\$1');

/** vCard 3.0: el celular lo importa como contactos, necesarios para que la difusión les llegue. */
export function toVcf(contactos) {
  return contactos
    .map((c) => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardText(c.nombre || `+${c.numero}`)}`, `TEL;TYPE=CELL:+${c.numero}`, 'END:VCARD'].join('\r\n'))
    .join('\r\n') + '\r\n';
}

export function toCsvContactos(contactos) {
  const sinEmoji = (s) => String(s ?? '').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const rows = contactos.map((c) => [escapeCell(c.nombre), `="${c.numero}"`, escapeCell(c.etapa), escapeCell(sinEmoji(c.calificacion))].join(';'));
  return BOM + ['Nombre;Teléfono;Etapa;Calificación', ...rows].join('\r\n') + '\r\n';
}

/** Reparte los contactos en partes de a lo sumo 256, que es lo que admite una lista de difusión. */
export function enPartes(contactos, tamano = MAX_POR_LISTA) {
  const partes = [];
  for (let i = 0; i < contactos.length; i += tamano) partes.push(contactos.slice(i, i + tamano));
  return partes;
}

// Topes de envíos masivos por Emissary (solo si un administrador los activó). Criterio prudente, no una regla de WhatsApp.
export const TOPES_MASIVOS = { dia: 20, semana: 60, mes: 150 };

/** @param {{dia:number,semana:number,mes:number}} usados  envíos masivos ya hechos en cada ventana */
export function revisarTopes(usados, pedidos, topes = TOPES_MASIVOS) {
  const libre = { dia: topes.dia - usados.dia, semana: topes.semana - usados.semana, mes: topes.mes - usados.mes };
  const disponible = Math.max(0, Math.min(libre.dia, libre.semana, libre.mes));
  if (pedidos <= disponible) return { ok: true, disponible };
  const limite = libre.dia <= libre.semana && libre.dia <= libre.mes ? 'hoy' : libre.semana <= libre.mes ? 'esta semana' : 'este mes';
  return { ok: false, disponible, mensaje: `Para cuidar tu número, ${limite} solo puedes enviar ${disponible} mensaje(s) más por envíos masivos (topes: ${topes.dia} al día, ${topes.semana} a la semana, ${topes.mes} al mes).` };
}
