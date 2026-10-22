// hub/src/compliance/limits.js
// Reglas puras de envío (sin DB ni reloj) para poder probarlas con números.

// Rampa de calentamiento: envíos máximos por día según los días que el tenant lleva enviando campañas.
// Son valores conservadores propios, no los de Meta (que dependen de la calidad del número).
export const RAMP = [20, 30, 50, 80, 120, 200];
export const MIN_GAP_MS = 20_000;         // separación mínima entre dos envíos de campaña
export const JITTER_MS = 40_000;          // + hasta este tiempo aleatorio, para no enviar a ritmo de máquina
export const MIN_DAYS_BETWEEN = 3;        // un mismo contacto no recibe campañas más seguido
export const BREAKER = { window: 20, minSample: 5, maxFailRatio: 0.2, minSent24h: 30, maxOptOutRatio: 0.03 };

export function dailyCap(ageDays, max) {
  const step = ageDays >= RAMP.length ? max : RAMP[ageDays];
  return Math.min(step, max);
}

export const inWindow = (hour, inicio, fin) => hour >= inicio && hour < fin;

// Devuelve el motivo del corte automático, o null si se puede seguir enviando
export function breakerReason({ recent, sentLast24h, optOutsLast24h }) {
  const fallos = recent.filter((e) => e === 'fallido').length;
  if (recent.length >= BREAKER.minSample && fallos / recent.length >= BREAKER.maxFailRatio) {
    return `corte automático: ${fallos} de los últimos ${recent.length} envíos fallaron`;
  }
  if (sentLast24h >= BREAKER.minSent24h && optOutsLast24h / sentLast24h > BREAKER.maxOptOutRatio) {
    return `corte automático: ${optOutsLast24h} bajas por ${sentLast24h} envíos en 24 h`;
  }
  return null;
}
