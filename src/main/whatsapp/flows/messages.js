// src/main/whatsapp/flows/messages.js
// Plantillas de mensajes para el catálogo dinámico.
// El motor de flujo usa estas funciones para construir mensajes enriquecidos.

import { BUDGETS, EMPLOYMENTS } from './steps.js';

const firstName = (name) => name?.split(' ')[0] || name || '';

export function formatPrice(n) {
  if (!n) return 'Consultar';
  return `$${Number(n).toLocaleString('es-CO')}`;
}

export const MSG = {
  welcome: (negocio) =>
    `👋 Hola, cómo estás? Te habla *${negocio.nombre_asesor || 'un asesor'}*` +
    `${negocio.nombre_negocio ? `, de *${negocio.nombre_negocio}*` : ''} 😊\n\n` +
    `En qué te puedo ayudar hoy?`,

  menu: (negocio) =>
    `Cuéntame qué necesitas 👇\n\n` +
    `*1️⃣* 🚗 Ver el catálogo\n` +
    `*2️⃣* 💰 Cotizar un vehículo\n` +
    `*3️⃣* 💳 Opciones de financiación\n` +
    `*4️⃣* 💬 Hablar directamente con ${firstName(negocio.nombre_asesor) || 'un asesor'}`,

  invalidOption: () =>
    `No te entendí 😅 Escríbeme con *"menu"* para ver las opciones de nuevo.`,

  categoryList: (categories) => {
    if (categories.length === 0) return `😔 En este momento no tengo vehículos disponibles. Escribe *"menu"* para volver.`;
    const lines = categories.map((cat, i) => {
      let emj = '🚗';
      if (cat.name === 'Eléctrico') emj = '⚡';
      if (cat.name === 'Híbrido') emj = '🌱';
      if (cat.name === 'Gasolina') emj = '⛽';
      if (cat.name === 'Diésel') emj = '🚜';
      return `*${i + 1}.* ${emj} ${cat.name || 'General'} — ${cat.count} vehículo(s) tenemos`;
    });
    return (
      `¿Qué tipo de vehículo te gustaría explorar? 👇\n\n` +
      lines.join('\n') +
      `\n*0.* 🔎 Buscar por presupuesto\n\n` +
      `_Escribe el número de la categoría que te interesa, o '0' para buscar por tu presupuesto_ 😊`
    );
  },

  budgetPrompt: () => 
    `Perfecto 🔎 Dime de cuánto es tu presupuesto estimado para la inversión:\n\n` +
    `_(Ej: "tengo 80 millones", "95.000.000", o "hasta 150M")_`,

  itemList: (items) => {
    if (items.length === 0) return `😔 En este momento no tengo ítems disponibles. Escribe *"menu"* para volver.`;
    const lines = items.map((it, i) => {
      const desde = it.variantes.length ? Math.min(...it.variantes.map((v) => v.precio)) : 0;
      return `*${i + 1}.* ${it.emoji || '🚗'} *${it.nombre}* — desde ${formatPrice(desde)}`;
    });
    return (
      `Aquí tienes lo que tenemos disponible 👇\n\n` +
      lines.join('\n') +
      `\n\n_Escribe el número del que te interesa y te cuento más_ 😊`
    );
  },

  itemDetail: (item) => {
    const specsStr = Object.entries(item.specs || {})
      .map(([k, val]) => `• *${k}:* ${val}`)
      .join('\n');
    const variantesStr = item.variantes.map((v) => {
      const bono = Number(v.bono) > 0 ? `\n  💚 Bono: ${formatPrice(v.bono)}` : '';
      return `▸ ${v.version}\n  💰 *${formatPrice(v.precio)}*${bono}`;
    }).join('\n\n');

    return (
      `${item.emoji || '🚗'} *${item.nombre}*\n` +
      `${item.descripcion || ''}\n\n` +
      (specsStr ? `📋 *Detalles:*\n${specsStr}\n\n` : '') +
      `💵 *Opciones y precios:*\n${variantesStr}`
    );
  },

  itemOptions: (negocio) =>
    `\n\n¿Qué te gustaría hacer?\n\n` +
    `*1️⃣* Cotizar este ítem 💰\n` +
    `*2️⃣* Ver otros autos 🔙\n` +
    `*3️⃣* 🔄 Ver alternativas similares\n` +
    `*4️⃣* Hablar con ${firstName(negocio.nombre_asesor) || 'un asesor'} 💬`,

  askInterest: (negocio, name) =>
    `Perfecto${name ? `, *${firstName(name)}*` : ''}! 🙌 Ya tienes algún modelo en mente, ` +
    `o quieres que te oriente con el catálogo?`,

  askBudget: () =>
    `Para orientarte mejor, con qué presupuesto cuentas? 💵\n\n` +
    BUDGETS.map((b, i) => `*${i + 1}️⃣* ${b}`).join('\n'),

  askEmployment: () =>
    `Y cuál es tu actividad laboral? 💼\n\n` +
    EMPLOYMENTS.map((e, i) => `*${i + 1}️⃣* ${e}`).join('\n'),

  askIncome: () =>
    `Perfecto! Y cuánto son tus ingresos mensuales aproximadamente? 📊`,

  askLeadName: () =>
    `Ya casi terminamos 😊 Cuál es tu nombre completo? ✍️`,

  askLeadPhone: () =>
    `Y a qué número te puedo contactar? 📱`,

  closingSummary: (negocio, lead) =>
    `🎉 ¡Listo, *${firstName(lead.name)}*!\n\n` +
    `Recibí tu solicitud:\n` +
    `• Interés: ${lead.interest || 'Por definir'}\n` +
    `• Rango: ${lead.budget || 'Por definir'}\n\n` +
    `Muy pronto me pongo en contacto contigo. ` +
    `Si quieres hablar ya mismo, escríbeme *"asesor"* 😊`,

  handoff: (negocio) =>
    `¡Claro! 💬 Ya avisé a *${negocio.nombre_asesor || 'nuestro equipo'}* — te escriben en breve 🙌`,

  portfolioLink: (negocio) =>
    negocio.portfolio_url ? `🌐 Mira más en:\n*${negocio.portfolio_url}*` : '',
};
