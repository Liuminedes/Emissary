// src/main/db/repositories/sesiones.repo.js
import { getDb } from '../db.js';

function defaultSession(userId) {
  return {
    userId,
    step: 'WELCOME',
    pushName: '',
    advisorTook: false,
    handoffMode: false,
    lead: {
      name: null, phone: null, interest: null, budget: null,
      employment: null, income: null, creditStatus: null,
    },
    catalog: { category: null, itemId: null },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function rowToSession(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    step: row.step,
    pushName: row.push_name,
    advisorTook: !!row.advisor_took,
    handoffMode: !!row.handoff_mode,
    lead: JSON.parse(row.lead_json || '{}'),
    catalog: JSON.parse(row.catalog_json || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const SesionesRepo = {
  get(userId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sesiones WHERE user_id = ?').get(userId);
    return rowToSession(row) || defaultSession(userId);
  },

  save(session) {
    const db = getDb();
    session.updatedAt = Date.now();
    db.prepare(`
      INSERT INTO sesiones (user_id, step, push_name, advisor_took, handoff_mode, lead_json, catalog_json, created_at, updated_at)
      VALUES (@userId, @step, @pushName, @advisorTook, @handoffMode, @leadJson, @catalogJson, @createdAt, @updatedAt)
      ON CONFLICT(user_id) DO UPDATE SET
        step = @step, push_name = @pushName, advisor_took = @advisorTook,
        handoff_mode = @handoffMode, lead_json = @leadJson, catalog_json = @catalogJson,
        updated_at = @updatedAt
    `).run({
      userId: session.userId,
      step: session.step,
      pushName: session.pushName || '',
      advisorTook: session.advisorTook ? 1 : 0,
      handoffMode: session.handoffMode ? 1 : 0,
      leadJson: JSON.stringify(session.lead || {}),
      catalogJson: JSON.stringify(session.catalog || {}),
      createdAt: session.createdAt || Date.now(),
      updatedAt: session.updatedAt,
    });
    return session;
  },

  delete(userId) {
    const db = getDb();
    db.prepare('DELETE FROM sesiones WHERE user_id = ?').run(userId);
  },

  isExcluded(userId) {
    const db = getDb();
    const phone = userId.replace(/[@:][^\s]*/g, '').replace(/\D/g, '');
    const row = db.prepare('SELECT telefono FROM excluidos WHERE telefono = ?').get(phone);
    return !!row;
  },

  addExcluded(phone) {
    const db = getDb();
    const clean = phone.replace(/\D/g, '');
    db.prepare('INSERT OR IGNORE INTO excluidos (telefono) VALUES (?)').run(clean);
  },

  removeExcluded(phone) {
    const db = getDb();
    const clean = phone.replace(/\D/g, '');
    db.prepare('DELETE FROM excluidos WHERE telefono = ?').run(clean);
  },

  isGloballyPaused() {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config_global WHERE key = 'global_paused'").get();
    return row?.value === '1';
  },

  setGlobalPause(paused) {
    const db = getDb();
    db.prepare(`
      INSERT INTO config_global (key, value) VALUES ('global_paused', ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `).run(paused ? '1' : '0', paused ? '1' : '0');
  },
};
