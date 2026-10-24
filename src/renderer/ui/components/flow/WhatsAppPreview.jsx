import React from 'react';
import { fullText } from '../../../../main/whatsapp/flows/flowRuntime.js';

// Datos de muestra para ver cómo quedará el mensaje con las variables ya resueltas
export function sampleText(node, negocio) {
  return fullText(node)
    .replaceAll('{{catalogo}}', '📋 [Aquí se mostrará tu catálogo]')
    .replaceAll('{asesor}', negocio?.nombre_asesor || 'tu asesor')
    .replaceAll('{negocio}', negocio?.nombre_negocio || 'tu negocio')
    .replaceAll('{marca}', negocio?.marca || '')
    .replaceAll('{horario}', negocio?.horario || '')
    .replaceAll('{cargo}', negocio?.cargo || '')
    .replaceAll('{portfolio_url}', negocio?.portfolio_url || '')
    .replaceAll('{{nombre}}', 'Carlos')
    .replaceAll('{nombre}', 'Carlos')
    .replaceAll('{lead_name}', 'Carlos');
}

// *negrita*, _cursiva_ y ~tachado~ como en WhatsApp
export function formatWhatsApp(text) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) return <s key={i}>{part.slice(1, -1)}</s>;
    return part;
  });
}

export function Bubble({ text, from = 'bot' }) {
  const bot = from === 'bot';
  return (
    <div className={`max-w-[88%] px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap break-words shadow-sm rounded-2xl ${bot ? 'self-start bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-sm' : 'self-end bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100 rounded-tr-sm'}`}>
      {formatWhatsApp(text)}
    </div>
  );
}

// Fondo tipo chat para las vistas previas
export const chatBackground = 'bg-[#efeae2] dark:bg-[#0b141a]';
