import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, AuthError } from './auth.js';
import { hashPassword, verifyPassword, passwordError, usernameError } from './password.js';

function memoryRepo() {
  const rows = [];
  let id = 0;
  return {
    list: () => rows.map((r) => ({ ...r })),
    getById: (i) => rows.find((r) => r.id === i),
    getByUsername: (u) => rows.find((r) => r.username === u),
    create: ({ username, password_hash, role }) => rows.push({ id: ++id, username, password_hash, role, created_at: 1 }),
    setPassword: (i, h) => { rows.find((r) => r.id === i).password_hash = h; },
    delete: (i) => rows.splice(rows.findIndex((r) => r.id === i), 1),
  };
}

function setup() {
  const clock = { t: 1_000_000 };
  const repo = memoryRepo();
  const auth = createAuth({ repo, now: () => clock.t });
  return { auth, repo, clock };
}

test('hash: no guarda la contraseña en claro, usa sal distinta y verifica', () => {
  const a = hashPassword('secreto-largo');
  const b = hashPassword('secreto-largo');
  assert.notEqual(a, b);
  assert.ok(!a.includes('secreto-largo'));
  assert.ok(a.startsWith('scrypt$'));
  assert.equal(verifyPassword('secreto-largo', a), true);
  assert.equal(verifyPassword('otra-cosa', a), false);
  assert.equal(verifyPassword('x', ''), false);
  assert.equal(verifyPassword('x', 'basura'), false);
});

test('validaciones de contraseña y usuario', () => {
  assert.match(passwordError('corta'), /al menos 8/);
  assert.equal(passwordError('suficientemente-larga'), null);
  assert.match(passwordError('x'.repeat(200)), /no puede pasar/);
  assert.equal(usernameError('ana.perez'), null);
  assert.ok(usernameError('A B'));
  assert.ok(usernameError('ab'));
});

test('primer uso: no hay contraseña por defecto; el admin define la suya', () => {
  const { auth } = setup();
  assert.deepEqual(auth.status(), { needsSetup: true, user: null });
  assert.throws(() => auth.login('admin', 'admin'), AuthError); // no existe una cuenta por defecto
  assert.throws(() => auth.setupAdmin('corta'), /al menos 8/);
  const u = auth.setupAdmin('mi-clave-segura');
  assert.deepEqual([u.username, u.role], ['admin', 'admin']);
  assert.equal(auth.status().needsSetup, false);
  assert.throws(() => auth.setupAdmin('otra-clave-larga'), /ya está configurado/); // no se puede pisar al admin
});

test('login: correcto, incorrecto y logout; el hash nunca sale en la respuesta', () => {
  const { auth } = setup();
  auth.setupAdmin('mi-clave-segura');
  auth.logout();
  assert.equal(auth.current(), null);
  assert.throws(() => auth.login('admin', 'mala'), /incorrectos/);
  assert.equal(auth.login(' ADMIN ', 'mi-clave-segura').username, 'admin');
  assert.ok(!('password_hash' in auth.current()));
  assert.ok(auth.listUsers().every((x) => !('password_hash' in x)));
});

test('mismo mensaje para usuario inexistente y contraseña mala', () => {
  const { auth } = setup();
  auth.setupAdmin('mi-clave-segura');
  auth.logout();
  const msg = (u) => { try { auth.login(u, 'x'); } catch (e) { return e.message; } };
  assert.equal(msg('admin'), msg('fantasma'));
});

test('bloqueo temporal tras 5 intentos fallidos, y se libera con el tiempo', () => {
  const { auth, clock } = setup();
  auth.setupAdmin('mi-clave-segura');
  auth.logout();
  for (let i = 0; i < 5; i++) assert.throws(() => auth.login('admin', 'mala'), /incorrectos/);
  assert.throws(() => auth.login('admin', 'mi-clave-segura'), /Demasiados intentos/); // ni la correcta entra
  clock.t += 31_000;
  assert.equal(auth.login('admin', 'mi-clave-segura').username, 'admin');
});

test('solo el admin gestiona usuarios; el asesor no puede', () => {
  const { auth } = setup();
  auth.setupAdmin('mi-clave-segura');
  auth.createUser({ username: 'Ana', password: 'clave-de-ana-1', role: 'asesor' });
  assert.throws(() => auth.createUser({ username: 'ana', password: 'otra-clave-larga' }), /ya existe/);
  assert.throws(() => auth.createUser({ username: 'x', password: 'clave-larga-ok' }), /usuario debe tener/);
  assert.throws(() => auth.createUser({ username: 'luis', password: 'clave-larga-ok', role: 'root' }), /Rol inválido/);
  assert.deepEqual(auth.listUsers().map((u) => u.username), ['admin', 'ana']);

  auth.logout();
  auth.login('ana', 'clave-de-ana-1');
  assert.throws(() => auth.listUsers(), /Solo el administrador/);
  assert.throws(() => auth.createUser({ username: 'luis', password: 'clave-larga-ok' }), /Solo el administrador/);
  assert.throws(() => auth.deleteUser(1), /Solo el administrador/);
  assert.throws(() => auth.resetPassword(1, 'nueva-clave-larga'), /Solo el administrador/);
});

test('el admin restablece contraseñas, elimina usuarios y no puede dejar el sistema sin admin', () => {
  const { auth } = setup();
  const admin = auth.setupAdmin('mi-clave-segura');
  const ana = auth.createUser({ username: 'ana', password: 'clave-de-ana-1' });
  auth.resetPassword(ana.id, 'clave-nueva-ana');
  auth.logout();
  assert.throws(() => auth.login('ana', 'clave-de-ana-1'), /incorrectos/);
  assert.equal(auth.login('ana', 'clave-nueva-ana').username, 'ana');

  auth.logout();
  auth.login('admin', 'mi-clave-segura');
  assert.throws(() => auth.deleteUser(admin.id), /propia cuenta/);
  auth.deleteUser(ana.id);
  assert.deepEqual(auth.listUsers().map((u) => u.username), ['admin']);
  assert.throws(() => auth.deleteUser(999), /no encontrado/);
});

test('un segundo admin permite eliminar al primero, pero nunca al último', () => {
  const { auth } = setup();
  const a1 = auth.setupAdmin('mi-clave-segura');
  const a2 = auth.createUser({ username: 'socio', password: 'clave-del-socio', role: 'admin' });
  auth.logout();
  auth.login('socio', 'clave-del-socio');
  auth.deleteUser(a1.id);
  assert.throws(() => auth.deleteUser(a2.id), /propia cuenta/);
});

test('cambiar la propia contraseña exige la actual', () => {
  const { auth } = setup();
  auth.setupAdmin('mi-clave-segura');
  assert.throws(() => auth.changeOwnPassword('mala', 'nueva-clave-larga'), /actual no es correcta/);
  assert.throws(() => auth.changeOwnPassword('mi-clave-segura', 'corta'), /al menos 8/);
  auth.changeOwnPassword('mi-clave-segura', 'nueva-clave-larga');
  auth.logout();
  assert.equal(auth.login('admin', 'nueva-clave-larga').username, 'admin');
  auth.logout();
  assert.throws(() => auth.changeOwnPassword('a', 'b'), /No autenticado/);
});
