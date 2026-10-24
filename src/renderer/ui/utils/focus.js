// Siguiente elemento al que va el foco dentro de un diálogo (Tab / Mayús+Tab), dando la vuelta en los extremos.
export function nextFocusIndex(current, count, backwards = false) {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0; // el foco estaba fuera del diálogo
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}
