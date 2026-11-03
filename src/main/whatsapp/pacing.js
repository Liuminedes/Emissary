// src/main/whatsapp/pacing.js
// Ritmo "de persona" para el canal Baileys: pausa antes de responder, reconexión sin insistir y tope por chat. Módulo puro.

// Pausa antes de enviar: ~1 s más 30 ms por carácter (hasta 200), con ±25 % de variación, entre 1,2 y 6 s
export function replyDelayMs(text, rand = Math.random) {
  const base = 1000 + Math.min(String(text ?? '').length, 200) * 30;
  return Math.round(Math.min(6000, Math.max(1200, base * (0.75 + rand() * 0.5))));
}

// Espera entre reintentos de conexión: 3 s, 6 s, 12 s… hasta 60 s (insistir cada 3 s es lo que más delata a un bot)
export const reconnectDelayMs = (attempt) => Math.min(60_000, 3000 * 2 ** attempt);

export const MAX_RECONNECTS = 8;

// Tope de respuestas del bot por chat en una ventana: corta bucles con otros bots y ráfagas
export function createReplyLimiter({ max = 10, windowMs = 60_000, now = Date.now } = {}) {
  const sent = new Map(); // userId -> marcas de tiempo
  return (userId) => {
    const t = now();
    const recent = (sent.get(userId) || []).filter((x) => t - x < windowMs);
    if (recent.length >= max) { sent.set(userId, recent); return false; }
    recent.push(t);
    sent.set(userId, recent);
    if (sent.size > 500) sent.delete(sent.keys().next().value); // sin fugas de memoria
    return true;
  };
}
