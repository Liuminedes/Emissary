// src/main/whatsapp/flows/keywords.js
// Detección de comandos globales. Módulo puro (sin DB ni Electron) para poder testearlo.

const RESET_KEYWORDS = ['menu', 'inicio', 'reiniciar', 'opciones', 'empezar'];
const HANDOFF_KEYWORDS = ['asesor', 'asesora', 'agente', 'humano', 'persona real', 'hablar con alguien', 'hablar con una persona'];

// Mensajes largos son conversación normal, no un comando
const MAX_COMMAND_WORDS = 6;

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// El reset solo cuenta si el mensaje ENTERO es la palabra clave ("menú", "Inicio!")
export function isReset(text) {
  return RESET_KEYWORDS.includes(normalize(text));
}

// El handoff acepta la palabra clave como palabra completa dentro de un mensaje corto
export function isHandoff(text) {
  const t = normalize(text);
  if (!t || t.split(' ').length > MAX_COMMAND_WORDS) return false;
  return HANDOFF_KEYWORDS.some((k) => ` ${t} `.includes(` ${k} `));
}
