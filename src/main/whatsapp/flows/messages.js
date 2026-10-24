// src/main/whatsapp/flows/messages.js
// Plantillas de mensajes para el catálogo dinámico.
// El motor las usa para armar listas y detalles; las palabras ("vehículo", "producto"…) vienen de terms.js.

import { catalogTerms } from './terms.js';

const firstName = (name) => name?.split(' ')[0] || name || '';

export function formatPrice(n) {
  if (!n) return 'Consultar';
  return `$${Number(n).toLocaleString('es-CO')}`;
}

export const MSG = {
  categoryList: (categories, terms = catalogTerms()) => {
    if (categories.length === 0) return `😔 En este momento no tengo ${terms.varios} disponibles. Escribe *"menu"* para volver.`;
    const lines = categories.map((cat, i) => {
      let emj = terms.emoji;
      if (terms.porPresupuesto) { // los emojis por tipo de motor solo tienen sentido con vehículos
        if (cat.name === 'Eléctrico') emj = '⚡';
        if (cat.name === 'Híbrido') emj = '🌱';
        if (cat.name === 'Gasolina') emj = '⛽';
        if (cat.name === 'Diésel') emj = '🚜';
      }
      return `*${i + 1}.* ${emj} ${cat.name || 'General'} — ${cat.count} ${cat.count === 1 ? terms.uno : terms.varios}`;
    });
    return (
      `¿Qué ${terms.categoria} te gustaría explorar? 👇\n\n` +
      lines.join('\n') +
      (terms.porPresupuesto ? `\n*0.* 🔎 Buscar por presupuesto` : '') +
      `\n\n_Escribe el número que te interesa${terms.porPresupuesto ? ", o '0' para buscar por tu presupuesto" : ''}_ 😊`
    );
  },

  budgetPrompt: () =>
    `Perfecto 🔎 Dime de cuánto es tu presupuesto estimado para la inversión:\n\n` +
    `_(Ej: "tengo 80 millones", "95.000.000", o "hasta 150M")_`,

  itemList: (items, terms = catalogTerms()) => {
    if (items.length === 0) return `😔 En este momento no tengo ${terms.varios} disponibles. Escribe *"menu"* para volver.`;
    const lines = items.map((it, i) => {
      const desde = it.variantes.length ? Math.min(...it.variantes.map((v) => v.precio)) : 0;
      return `*${i + 1}.* ${it.emoji || terms.emoji} *${it.nombre}* — desde ${formatPrice(desde)}`;
    });
    return (
      `Aquí tienes lo que tenemos disponible 👇\n\n` +
      lines.join('\n') +
      `\n\n_Escribe el número del que te interesa y te cuento más_ 😊`
    );
  },

  itemDetail: (item, terms = catalogTerms()) => {
    const specsStr = Object.entries(item.specs || {})
      .map(([k, val]) => `• *${k}:* ${val}`)
      .join('\n');
    const variantesStr = item.variantes.map((v) => {
      const bono = Number(v.bono) > 0 ? `\n  💚 Bono: ${formatPrice(v.bono)}` : '';
      return `▸ ${v.version}\n  💰 *${formatPrice(v.precio)}*${bono}`;
    }).join('\n\n');

    return (
      `${item.emoji || terms.emoji} *${item.nombre}*\n` +
      `${item.descripcion || ''}\n\n` +
      (specsStr ? `📋 *Detalles:*\n${specsStr}\n\n` : '') +
      `💵 *Opciones y precios:*\n${variantesStr}`
    );
  },

  itemOptions: (negocio, terms = catalogTerms()) =>
    `\n\n¿Qué te gustaría hacer?\n\n` +
    `*1️⃣* ${terms.quiero}\n` +
    `*2️⃣* Ver ${terms.otros} 🔙\n` +
    `*3️⃣* 🔄 Ver alternativas similares\n` +
    `*4️⃣* Hablar con ${firstName(negocio.nombre_asesor) || 'un asesor'} 💬`,
};
