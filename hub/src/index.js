// hub/src/index.js
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { createHub } from './app.js';
import { openDb } from './db/db.js';
import { ensureDefaultTenant } from './db/tenants.js';
import { CloudApiProvider } from './providers/cloud-api.js';

const cfg = loadConfig();

let server;
if (cfg.cloud.token) {
  // Modo bot: el motor de flujos responde por Cloud API, con datos persistidos en SQLite
  const db = openDb(cfg.dbPath);
  ensureDefaultTenant(db, cfg.business, cfg.cloud.phoneNumberId);
  // shortcut: un solo token para todos los tenants (variable de entorno). Para varios clientes hace falta
  // guardar el token de cada uno cifrado; no se guardan secretos en la base hasta tener ese cifrado.
  const makeProvider = (tenant) => new CloudApiProvider({ ...cfg.cloud, phoneNumberId: tenant.phone_number_id || cfg.cloud.phoneNumberId });
  server = createHub({ cfg, db, makeProvider });
  console.log(`[hub] modo bot: respondiendo por Cloud API (datos en ${cfg.dbPath})`);
} else {
  // Sin token de envío: solo registra los eventos (útil para inspeccionar los payloads reales de Meta)
  server = createServer(cfg, (event) => console.log('[hub] evento', JSON.stringify(event)));
  console.log('[hub] modo escucha: define CLOUD_API_TOKEN para responder');
}

server.listen(cfg.port, () => {
  console.log(`[hub] escuchando en :${cfg.port} (POST/GET /webhook, GET /health)`);
});
