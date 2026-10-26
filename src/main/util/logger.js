// src/main/util/logger.js
// Registro de errores en archivo, con rotación para que no crezca sin límite. Módulo puro (no importa Electron).
//
// Privacidad: se guardan errores y avisos del sistema, no el contenido de las conversaciones.
// Quien llama debe evitar pasar textos de clientes (el motor solo registra mensajes de error).
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { format } from 'node:util';

export const MAX_BYTES = 1024 * 1024; // 1 MB por archivo
export const KEEP = 3;                // emissary.log + 3 anteriores (emissary.log.1 … .3)
const MAX_LINE = 4000;

export function createFileLogger({ dir, name = 'emissary.log', maxBytes = MAX_BYTES, keep = KEEP, now = () => new Date() }) {
  const file = path.join(dir, name);

  // emissary.log.2 -> .3, .1 -> .2, actual -> .1 (el más viejo se borra)
  function rotate() {
    const old = (n) => `${file}.${n}`;
    if (existsSync(old(keep))) unlinkSync(old(keep));
    for (let n = keep - 1; n >= 1; n--) if (existsSync(old(n))) renameSync(old(n), old(n + 1));
    renameSync(file, old(1));
  }

  function write(level, args) {
    try {
      mkdirSync(dir, { recursive: true });
      if (existsSync(file) && statSync(file).size >= maxBytes) rotate();
      // Errores con su traza; el resto como console.log. Una línea de registro puede ocupar varias líneas físicas (la traza).
      const text = args.map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : format(a))).join(' ');
      appendFileSync(file, `${now().toISOString()} ${level.toUpperCase().padEnd(5)} ${text.slice(0, MAX_LINE)}\n`, 'utf8');
    } catch {
      // Un fallo al escribir el registro nunca debe tumbar la app ni crear un bucle de errores
    }
  }

  return {
    file,
    info: (...a) => write('info', a),
    warn: (...a) => write('warn', a),
    error: (...a) => write('error', a),
  };
}
