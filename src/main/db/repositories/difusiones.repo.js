// src/main/db/repositories/difusiones.repo.js
// Segmentos guardados, bajas de difusiones y registro de lo enviado.
import { getDb } from '../db.js';
import { normalizeFiltro } from '../segmentos.js';

const DIA = 86_400_000;

// El número solo se conoce si el identificador es de teléfono (los @lid no lo traen)
const numeroDeJid = (userId) => {
  const [id, dominio] = String(userId).split('@');
  return dominio === 's.whatsapp.net' ? id.replace(/\D/g, '') : '';
};

export const SegmentosRepo = {
  list() {
    return getDb().prepare('SELECT id, nombre, filtro_json FROM segmentos ORDER BY nombre COLLATE NOCASE').all()
      .map((r) => ({ id: r.id, nombre: r.nombre, filtro: normalizeFiltro(JSON.parse(r.filtro_json || '{}')) }));
  },

  save({ id, nombre, filtro }) {
    const db = getDb();
    const name = String(nombre ?? '').trim().slice(0, 60);
    if (!name) throw new Error('Ponle un nombre al segmento');
    const json = JSON.stringify(normalizeFiltro(filtro));
    if (id) {
      db.prepare('UPDATE segmentos SET nombre = ?, filtro_json = ? WHERE id = ?').run(name, json, id);
      return id;
    }
    return Number(db.prepare('INSERT INTO segmentos (nombre, filtro_json, created_at) VALUES (?, ?, ?)').run(name, json, Date.now()).lastInsertRowid);
  },

  delete(id) {
    getDb().prepare('DELETE FROM segmentos WHERE id = ?').run(id);
  },
};

export const BajasRepo = {
  add(userId) {
    getDb().prepare('INSERT OR REPLACE INTO bajas (user_id, numero, created_at) VALUES (?, ?, ?)').run(userId, numeroDeJid(userId), Date.now());
  },

  addNumero(numero) {
    const digitos = String(numero ?? '').replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 15) throw new Error('Escribe el número con código de país, por ejemplo 573001234567');
    this.add(`${digitos}@s.whatsapp.net`);
  },

  remove(userId) {
    getDb().prepare('DELETE FROM bajas WHERE user_id = ?').run(userId);
  },

  list() {
    return getDb().prepare('SELECT user_id, numero, created_at FROM bajas ORDER BY created_at DESC').all();
  },

  // Identificadores y números juntos: un lead puede estar guardado con cualquiera de los dos
  asSet() {
    const set = new Set();
    for (const b of this.list()) { set.add(b.user_id); if (b.numero) set.add(b.numero); }
    return set;
  },
};

export const DifusionesRepo = {
  log({ canal, segmento = '', cantidad, nota = '' }) {
    const n = Math.trunc(Number(cantidad));
    if (!['manual', 'masivo'].includes(canal) || !(n > 0)) throw new Error('Registro de difusión inválido');
    getDb().prepare('INSERT INTO difusiones (canal, segmento, cantidad, nota, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(canal, String(segmento).slice(0, 60), n, String(nota).slice(0, 200), Date.now());
  },

  recent(limit = 30) {
    return getDb().prepare('SELECT id, canal, segmento, cantidad, nota, created_at FROM difusiones ORDER BY created_at DESC LIMIT ?').all(limit);
  },

  // Cuántos mensajes (o cuántas difusiones, según el canal que se mire) hubo en las últimas 24 h, 7 días y 30 días
  usados(canal, now = Date.now()) {
    const q = getDb().prepare('SELECT COALESCE(SUM(cantidad), 0) AS n FROM difusiones WHERE canal = ? AND created_at >= ?');
    return { dia: q.get(canal, now - DIA).n, semana: q.get(canal, now - 7 * DIA).n, mes: q.get(canal, now - 30 * DIA).n };
  },

  // Cuántas difusiones manuales se registraron en los últimos 7 días (no cuántos contactos)
  difusionesSemana(now = Date.now()) {
    return getDb().prepare("SELECT COUNT(*) AS n FROM difusiones WHERE canal = 'manual' AND created_at >= ?").get(now - 7 * DIA).n;
  },

  // Último mensaje de cada chat, para "sin contacto hace X días"
  ultimoContacto() {
    return new Map(getDb().prepare('SELECT user_id, MAX(created_at) AS m FROM historial GROUP BY user_id').all().map((r) => [r.user_id, r.m]));
  },
};
