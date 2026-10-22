// src/main/db/scoring.js
// Calificación de leads. Módulo puro: lo comparten el escritorio (SQLite local) y el Hub.

export const ETAPAS = ['nuevo', 'cotizando', 'negociacion', 'cerrado', 'perdido'];

export function calculateScore(dbLead) {
  let score = 0;
  
  if (dbLead.empleo && (dbLead.empleo.toLowerCase().includes('empleado') || dbLead.empleo.toLowerCase().includes('independiente'))) {
    score += 10;
  }
  
  if (dbLead.ingreso) {
    const ingresoNum = parseInt(dbLead.ingreso.replace(/[^0-9]/g, '')) || 0;
    if (ingresoNum > 3000000 || dbLead.ingreso.toLowerCase().includes('millones')) score += 15;
  }
  
  if (dbLead.presupuesto) {
    score += 10;
  }
  
  if (score >= 25) return '🔥 Caliente';
  if (score >= 10) return '🟡 Tibio';
  return '❄️ Frío';
}
