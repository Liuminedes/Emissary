# Emissary Hub

Servicio que recibe los webhooks de WhatsApp Cloud API (Meta directo o vía proveedor) y envía mensajes.
Sin dependencias: solo Node 22+.

```bash
cp .env.example .env   # completa los valores
node --env-file=.env src/index.js
npm test
```

- `GET /webhook`: verificación inicial de Meta (`WEBHOOK_VERIFY_TOKEN`).
- `POST /webhook`: exige firma `X-Hub-Signature-256` (`META_APP_SECRET`) o header `X-Webhook-Token` (`WEBHOOK_TOKEN`). Responde 200 de inmediato, deduplica y emite eventos `message`, `echo` y `status`.
- `src/providers/cloud-api.js`: `sendText` y `sendTemplate` (Meta y 360dialog).

## Modos

- **Escucha** (sin `CLOUD_API_TOKEN`): solo imprime los eventos recibidos. Úsalo para ver los payloads reales de Meta.
- **Bot** (con `CLOUD_API_TOKEN`): el motor de flujos del escritorio (`../src/main/whatsapp`) responde por Cloud API.

Arquitectura: `webhook → parse → canal (channel.js) → attachBot → motor → canal.sendText`.
El canal cumple el mismo contrato que Baileys en el escritorio, así el motor no cambia.

Estado: probado de extremo a extremo con un proveedor simulado. Pendiente: persistencia (hoy los repos son en memoria, ver `memory-repos.js`), aviso de handoff al escritorio, y confirmar la forma real de `message_echoes` con la prueba de viabilidad (`../docs/meta-viabilidad.md`).
