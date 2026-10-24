// src/main/db/repositories/leads.repo.js
import { getDb } from '../db.js';
import { calculateScore } from '../scoring.js';

export const LeadsRepo = {
  listAll() {
    const db = getDb();
    return db.prepare(
      'SELECT l.*, (SELECT COUNT(*) FROM lead_notas n WHERE n.lead_id = l.id) AS notas FROM leads l ORDER BY l.updated_at DESC'
    ).all();
  },

  create(lead) {
    const db = getDb();
    const now = Date.now();
    const calificacion = calculateScore(lead);
    const info = db.prepare(`
      INSERT INTO leads (user_id, nombre, telefono, interes, presupuesto, empleo, ingreso, etapa, calificacion, created_at, updated_at)
      VALUES (@userId, @nombre, @telefono, @interes, @presupuesto, @empleo, @ingreso, 'nuevo', @calificacion, @now, @now)
    `).run({ ...lead, calificacion, now });
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  },

  updateEtapa(id, etapa) {
    const db = getDb();
    db.prepare('UPDATE leads SET etapa = ?, updated_at = ? WHERE id = ?').run(etapa, Date.now(), id);
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  },

  updateEtapaByUserId(userId, etapa) {
    const db = getDb();
    const existing = db.prepare('SELECT id, etapa FROM leads WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    const ORDER = ['nuevo', 'cotizando', 'negociacion', 'cerrado', 'perdido'];
    if (existing) {
      const current = ORDER.indexOf(existing.etapa || 'nuevo');
      const next = ORDER.indexOf(etapa);
      if (next > current) {
        db.prepare('UPDATE leads SET etapa = ?, updated_at = ? WHERE id = ?').run(etapa, Date.now(), existing.id);
      }
    }
  },

  upsert(lead) {
    const db = getDb();
    const now = Date.now();
    const existing = db.prepare('SELECT * FROM leads WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(lead.userId);
    
    if (existing) {
      const mergedLead = {
        ...existing,
        nombre: lead.nombre || existing.nombre,
        telefono: lead.telefono || existing.telefono,
        interes: lead.interes || existing.interes,
        presupuesto: lead.presupuesto || existing.presupuesto,
        empleo: lead.empleo || existing.empleo,
        ingreso: lead.ingreso || existing.ingreso
      };
      const calificacion = calculateScore(mergedLead);

      db.prepare(`
        UPDATE leads 
        SET nombre = ?, 
            telefono = ?, 
            interes = ?, 
            presupuesto = ?, 
            empleo = ?, 
            ingreso = ?,
            calificacion = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        mergedLead.nombre || null, 
        mergedLead.telefono || null, 
        mergedLead.interes || null, 
        mergedLead.presupuesto || null, 
        mergedLead.empleo || null, 
        mergedLead.ingreso || null,
        calificacion,
        now, 
        existing.id
      );
      return db.prepare('SELECT * FROM leads WHERE id = ?').get(existing.id);
    } else {
      return this.create(lead);
    }
  },
};
