// src/main/db/repositories/historial.repo.js
import { getDb } from '../db.js';
import { telefonoValido } from '../../whatsapp/contactos.js';

const ORIGENES = ['cliente', 'bot', 'asesor'];
const RETENCION_DIAS = 90;

export const HistorialRepo = {
  add(userId, origen, texto) {
    if (!ORIGENES.includes(origen) || !texto) return;
    getDb()
      .prepare('INSERT INTO historial (user_id, origen, texto, created_at) VALUES (?, ?, ?, ?)')
      .run(userId, origen, texto, Date.now());
  },

  // Una fila por conversación: último mensaje + estado de control + nombre del lead
  listConversations() {
    return getDb().prepare(`
      SELECT h.user_id, h.origen AS ultimo_origen, h.texto AS ultimo_texto, h.created_at AS ultimo_at,
             COALESCE(NULLIF(l.nombre, ''), NULLIF(c.nombre, ''), NULLIF(s.push_name, ''), h.user_id) AS nombre,
             COALESCE(c.numero, '') AS numero, l.telefono AS lead_telefono,
             COALESCE(s.advisor_took, 0) AS advisor_took, COALESCE(s.handoff_mode, 0) AS handoff_mode
      FROM historial h
      JOIN (SELECT user_id, MAX(id) AS max_id FROM historial GROUP BY user_id) u ON u.max_id = h.id
      LEFT JOIN sesiones s ON s.user_id = h.user_id
      LEFT JOIN contactos c ON c.user_id = h.user_id
      LEFT JOIN leads l ON l.id = (SELECT MAX(id) FROM leads WHERE user_id = h.user_id)
      ORDER BY h.id DESC
      LIMIT 200
    `).all().map(({ lead_telefono, ...c }) => ({ ...c, numero: c.numero || telefonoValido(lead_telefono, c.user_id) })); // sin dato de WhatsApp, el teléfono que dio el cliente
  },

  listMessages(userId, limit = 300) {
    return getDb()
      .prepare('SELECT * FROM (SELECT * FROM historial WHERE user_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC')
      .all(userId, limit);
  },

  // Privacidad: no se guardan conversaciones indefinidamente
  purgeOld(dias = RETENCION_DIAS) {
    getDb().prepare('DELETE FROM historial WHERE created_at < ?').run(Date.now() - dias * 24 * 60 * 60 * 1000);
  },
};
