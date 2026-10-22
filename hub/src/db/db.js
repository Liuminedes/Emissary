// hub/src/db/db.js
// SQLite embebido de Node (node:sqlite): sin dependencias nativas que compilar. Requiere Node >= 22.13.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');

// Migraciones versionadas con PRAGMA user_version. Cada una corre una sola vez, en orden.
// Para cambiar el esquema: añadir un elemento al final (nunca editar los anteriores).
const MIGRATIONS = [
  (db) => db.exec(SCHEMA), // v1: esquema inicial
];

export function openDb(file = ':memory:') {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      MIGRATIONS[v](db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migración ${v + 1} falló: ${err.message}`);
    }
  }
  return db;
}
