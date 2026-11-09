// src/main/db/repositories/contactos.repo.js
// Nombre y teléfono de los contactos de WhatsApp (ver tabla contactos).
import { getDb } from '../db.js';
import { unirFilas } from '../../whatsapp/contactos.js';

export const ContactosRepo = {
  get(userId) {
    return getDb().prepare('SELECT user_id AS userId, numero, nombre FROM contactos WHERE user_id = ?').get(userId);
  },

  numeroDe(userId) {
    return this.get(userId)?.numero || '';
  },

  count() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM contactos').get().n;
  },

  // Guarda varias filas juntas; un dato vacío nunca pisa uno que ya se conocía
  saveMany(filas) {
    const db = getDb();
    const up = db.prepare('INSERT OR REPLACE INTO contactos (user_id, numero, nombre, updated_at) VALUES (@userId, @numero, @nombre, @now)');
    db.transaction(() => {
      for (const f of filas) up.run({ ...unirFilas(this.get(f.userId), f), now: Date.now() });
    })();
  },
};
