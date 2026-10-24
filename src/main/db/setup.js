// src/main/db/setup.js
// Configuración mínima para que el bot atienda clientes. Módulo puro.
// Sin esto el bot callaría con mensajes a medias ("Te habla *un asesor*") o le respondería al propio asesor.

const digits = (s) => String(s ?? '').replace(/\D/g, '');

// Cada paso del checklist del Dashboard sale de aquí
export function setupSteps(negocio) {
  return {
    negocio: Boolean(negocio?.nombre_negocio?.trim() && negocio?.marca),
    asesor: Boolean(negocio?.nombre_asesor?.trim() && digits(negocio?.telefono).length >= 10),
  };
}

export const isConfigured = (negocio) => Object.values(setupSteps(negocio)).every(Boolean);
