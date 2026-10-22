// hub/src/index.js
import { loadConfig } from './config.js';
import { createServer } from './server.js';

const cfg = loadConfig();

// Por ahora solo registra los eventos. Siguiente paso: conectar el motor de flujos y responder con CloudApiProvider.
const onEvent = (event) => {
  console.log('[hub] evento', JSON.stringify(event));
};

createServer(cfg, onEvent).listen(cfg.port, () => {
  console.log(`[hub] escuchando en :${cfg.port} (POST/GET /webhook, GET /health)`);
});
