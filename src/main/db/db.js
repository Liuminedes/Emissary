// src/main/db/db.js
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { DB_FILE, dirnameFromMeta } from '../util/paths.js';

const __dirname = dirnameFromMeta(import.meta.url);

let db = null;

export function getDb() {
  if (db) return db;

  const dbPath = DB_FILE();
  const dbDir = path.dirname(dbPath);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Migraciones automáticas (por si la BD ya existía y no tiene nuevas columnas)
  try {
    db.exec('ALTER TABLE negocio ADD COLUMN tour_completo INTEGER DEFAULT 0');
  } catch (err) {}
  try {
    db.exec("ALTER TABLE leads ADD COLUMN calificacion TEXT DEFAULT '❄️ Frío'");
  } catch (err) {}

  // Fila única de negocio, si no existe
  const row = db.prepare('SELECT id FROM negocio WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO negocio (id, updated_at) VALUES (1, ?)').run(Date.now());
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
