// src/main/db/repositories/mensajes.repo.js
import { getDb } from '../db.js';

export const MensajesRepo = {
  listAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM mensajes').all();
  },

  get(stepKey) {
    const db = getDb();
    return db.prepare('SELECT * FROM mensajes WHERE step_key = ?').get(stepKey);
  },

  // Devuelve el override si existe, o null si el negocio no lo ha personalizado
  getOverride(stepKey) {
    const row = this.get(stepKey);
    return row ? row.contenido : null;
  },

  save(stepKey, contenido) {
    const db = getDb();
    db.prepare(`
      INSERT INTO mensajes (step_key, contenido, updated_at)
      VALUES (@stepKey, @contenido, @updatedAt)
      ON CONFLICT(step_key) DO UPDATE SET contenido = @contenido, updated_at = @updatedAt
    `).run({ stepKey, contenido, updatedAt: Date.now() });
    return this.get(stepKey);
  },

  reset(stepKey) {
    const db = getDb();
    db.prepare('DELETE FROM mensajes WHERE step_key = ?').run(stepKey);
  },
};
