// src/main/db/repositories/usuarios.repo.js
import { getDb } from '../db.js';

export const UsuariosRepo = {
  list: () => getDb().prepare('SELECT * FROM usuarios ORDER BY id').all(),
  getById: (id) => getDb().prepare('SELECT * FROM usuarios WHERE id = ?').get(id),
  getByUsername: (username) => getDb().prepare('SELECT * FROM usuarios WHERE username = ?').get(username),
  create: ({ username, password_hash, role }) =>
    getDb().prepare('INSERT INTO usuarios (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)').run(username, password_hash, role, Date.now()),
  setPassword: (id, hash) => getDb().prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(hash, id),
  delete: (id) => getDb().prepare('DELETE FROM usuarios WHERE id = ?').run(id),
};
