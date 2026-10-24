// src/main/auth/auth.js
// Cuentas locales de Emissary: la cuenta `admin` administra a los demás usuarios.
// Módulo puro: recibe el repositorio, así se prueba sin Electron ni SQLite.
//
// shortcut: es un bloqueo local de la interfaz (la base y la sesión de WhatsApp siguen en disco sin cifrar).
// Se reemplaza por el login contra el Hub cuando el escritorio se conecte a él.
import { hashPassword, verifyPassword, passwordError, normalizeUsername, usernameError } from './password.js';

export const ADMIN_USER = 'admin';
export const ROLES = ['admin', 'asesor'];

const MAX_FAILS = 5;
const LOCK_MS = 30_000;
// Hash falso para que un usuario inexistente tarde lo mismo en responder que uno real
const DUMMY_HASH = hashPassword('no-existe-este-usuario');

export class AuthError extends Error {}

export function createAuth({ repo, now = Date.now }) {
  let current = null;                // { id, username, role }
  const attempts = new Map();        // username -> { fails, until }

  const pub = (u) => ({ id: u.id, username: u.username, role: u.role });
  const requireAdmin = () => {
    if (current?.role !== 'admin') throw new AuthError('Solo el administrador puede hacer esto');
  };
  const adminCount = () => repo.list().filter((u) => u.role === 'admin').length;

  return {
    current: () => current,

    // needsSetup: aún no hay contraseña de admin. Nunca se entrega una contraseña por defecto.
    status: () => ({ needsSetup: !repo.getByUsername(ADMIN_USER), user: current }),

    setupAdmin(password) {
      if (repo.getByUsername(ADMIN_USER)) throw new AuthError('El administrador ya está configurado');
      const err = passwordError(password);
      if (err) throw new AuthError(err);
      repo.create({ username: ADMIN_USER, password_hash: hashPassword(password), role: 'admin' });
      current = pub(repo.getByUsername(ADMIN_USER));
      return current;
    },

    login(username, password) {
      const name = normalizeUsername(username);
      const state = attempts.get(name) || { fails: 0, until: 0 };
      if (state.until > now()) {
        throw new AuthError(`Demasiados intentos. Espera ${Math.ceil((state.until - now()) / 1000)} s`);
      }
      const user = repo.getByUsername(name);
      const ok = verifyPassword(String(password ?? ''), user?.password_hash || DUMMY_HASH) && Boolean(user);
      if (!ok) {
        state.fails += 1;
        if (state.fails >= MAX_FAILS) { state.fails = 0; state.until = now() + LOCK_MS; }
        attempts.set(name, state);
        throw new AuthError('Usuario o contraseña incorrectos'); // mismo mensaje exista o no el usuario
      }
      attempts.delete(name);
      current = pub(user);
      return current;
    },

    logout() { current = null; },

    // --- Administración de usuarios (solo admin) ---
    listUsers() {
      requireAdmin();
      return repo.list().map((u) => ({ ...pub(u), created_at: u.created_at }));
    },

    createUser({ username, password, role = 'asesor' }) {
      requireAdmin();
      const name = normalizeUsername(username);
      const err = usernameError(name) || passwordError(password);
      if (err) throw new AuthError(err);
      if (!ROLES.includes(role)) throw new AuthError('Rol inválido');
      if (repo.getByUsername(name)) throw new AuthError('Ese usuario ya existe');
      repo.create({ username: name, password_hash: hashPassword(password), role });
      return pub(repo.getByUsername(name));
    },

    resetPassword(id, password) {
      requireAdmin();
      const err = passwordError(password);
      if (err) throw new AuthError(err);
      if (!repo.getById(id)) throw new AuthError('Usuario no encontrado');
      repo.setPassword(id, hashPassword(password));
    },

    deleteUser(id) {
      requireAdmin();
      const u = repo.getById(id);
      if (!u) throw new AuthError('Usuario no encontrado');
      if (u.id === current.id) throw new AuthError('No puedes eliminar tu propia cuenta');
      if (u.role === 'admin' && adminCount() <= 1) throw new AuthError('Debe quedar al menos un administrador');
      repo.delete(id);
    },

    changeOwnPassword(actual, nueva) {
      if (!current) throw new AuthError('No autenticado');
      const u = repo.getById(current.id);
      if (!verifyPassword(String(actual ?? ''), u.password_hash)) throw new AuthError('La contraseña actual no es correcta');
      const err = passwordError(nueva);
      if (err) throw new AuthError(err);
      repo.setPassword(current.id, hashPassword(nueva));
    },
  };
}
