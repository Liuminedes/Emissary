// hub/src/security.js
import { createHmac, timingSafeEqual } from 'node:crypto';

// Comparación en tiempo constante; false si las longitudes difieren
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Valida el header "X-Hub-Signature-256: sha256=<hmac del cuerpo crudo>" que envía Meta
export function verifySignature(rawBody, header, appSecret) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(header.slice(7), expected);
}
