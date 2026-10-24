// src/main/db/repositories/notas.repo.js
import { getDb } from '../db.js';

const MAX_NOTA = 1000;

export const NotasRepo = {
  list: (leadId) => getDb().prepare('SELECT id, texto, created_at FROM lead_notas WHERE lead_id = ? ORDER BY id DESC').all(leadId),

  add(leadId, texto) {
    const limpio = typeof texto === 'string' ? texto.trim() : '';
    if (!limpio) throw new Error('La nota está vacía');
    if (limpio.length > MAX_NOTA) throw new Error(`La nota no puede pasar de ${MAX_NOTA} caracteres`);
    const db = getDb();
    if (!db.prepare('SELECT 1 FROM leads WHERE id = ?').get(leadId)) throw new Error('Lead no encontrado');
    const info = db.prepare('INSERT INTO lead_notas (lead_id, texto, created_at) VALUES (?, ?, ?)').run(leadId, limpio, Date.now());
    return db.prepare('SELECT id, texto, created_at FROM lead_notas WHERE id = ?').get(info.lastInsertRowid);
  },

  delete: (id) => { getDb().prepare('DELETE FROM lead_notas WHERE id = ?').run(id); },

  // Para exportar: lead_id -> textos, de la más antigua a la más reciente
  allByLead() {
    const map = new Map();
    for (const r of getDb().prepare('SELECT lead_id, texto FROM lead_notas ORDER BY id').all()) {
      if (!map.has(r.lead_id)) map.set(r.lead_id, []);
      map.get(r.lead_id).push(r.texto);
    }
    return map;
  },
};
