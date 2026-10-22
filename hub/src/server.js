// hub/src/server.js
import http from 'node:http';
import { URL } from 'node:url';
import { parseWebhook } from './parse.js';
import { safeEqual, verifySignature } from './security.js';

const MAX_BODY_BYTES = 1024 * 1024;
const SEEN_LIMIT = 5000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload demasiado grande'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function isAuthentic(req, url, raw, cfg) {
  if (cfg.appSecret) return verifySignature(raw, req.headers['x-hub-signature-256'], cfg.appSecret);
  const token = req.headers['x-webhook-token'] || url.searchParams.get('token') || '';
  return safeEqual(token, cfg.webhookToken);
}

/**
 * @param {object} cfg  resultado de loadConfig()
 * @param {(event: object) => Promise<void>|void} onEvent  se llama una vez por evento (deduplicado)
 */
export function createServer(cfg, onEvent, log = console) {
  // shortcut: deduplicación en memoria; se pierde al reiniciar. Pasar a Redis/DB cuando el Hub sea multiinstancia.
  const seen = new Set();
  const isDuplicate = (e) => {
    const key = `${e.type}:${e.id}:${e.status || ''}`;
    if (seen.has(key)) return true;
    seen.add(key);
    if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value);
    return false;
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body = '') => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(body); };

    try {
      if (url.pathname === '/health') return send(200, 'ok');
      if (url.pathname !== '/webhook') return send(404);

      // Verificación inicial que hace Meta al registrar el webhook
      if (req.method === 'GET') {
        const ok = url.searchParams.get('hub.mode') === 'subscribe'
          && safeEqual(url.searchParams.get('hub.verify_token') || '', cfg.verifyToken);
        return ok ? send(200, url.searchParams.get('hub.challenge') || '') : send(403);
      }

      if (req.method !== 'POST') return send(405);

      const raw = await readBody(req);
      if (!isAuthentic(req, url, raw, cfg)) return send(401);

      let body;
      try { body = JSON.parse(raw.toString('utf8')); } catch { return send(400); }

      // Meta reintenta si no recibe 200 rápido: respondemos primero y procesamos después
      send(200);
      for (const event of parseWebhook(body)) {
        if (isDuplicate(event)) continue;
        try { await onEvent(event); } catch (err) { log.error('[hub] error procesando evento', event.type, event.id, err.message); }
      }
    } catch (err) {
      if (!res.headersSent) send(err.status || 500);
      log.error('[hub] error en request:', err.message);
    }
  });
}
