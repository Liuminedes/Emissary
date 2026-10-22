// hub/src/index.js
import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { createHub } from './app.js';
import { CloudApiProvider } from './providers/cloud-api.js';

const cfg = loadConfig();

let server;
if (cfg.cloud.token) {
  // Modo completo: el motor de flujos responde por Cloud API
  server = createHub({ cfg, provider: new CloudApiProvider(cfg.cloud) });
  console.log('[hub] modo bot: respondiendo por Cloud API');
} else {
  // Sin token de envío: solo registra los eventos (útil para inspeccionar los payloads reales de Meta)
  server = createServer(cfg, (event) => console.log('[hub] evento', JSON.stringify(event)));
  console.log('[hub] modo escucha: define CLOUD_API_TOKEN para responder');
}

server.listen(cfg.port, () => {
  console.log(`[hub] escuchando en :${cfg.port} (POST/GET /webhook, GET /health)`);
});
