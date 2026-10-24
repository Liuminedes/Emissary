// src/main/auth/password.js
// Hash de contraseñas con scrypt (incluido en Node, sin dependencias). Formato:
//   scrypt$N$r$p$<sal base64>$<hash base64>
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, KEYLEN = 64;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: +n, r: +r, p: +p });
  return timingSafeEqual(actual, expected);
}

// Devuelve el mensaje de error o null si es válida
export function passwordError(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX) return `La contraseña no puede pasar de ${PASSWORD_MAX} caracteres`;
  return null;
}

export const normalizeUsername = (u) => String(u || '').trim().toLowerCase();
export const usernameError = (u) => (/^[a-z0-9._-]{3,32}$/.test(u) ? null : 'El usuario debe tener de 3 a 32 caracteres: letras, números, punto, guion o guion bajo');
