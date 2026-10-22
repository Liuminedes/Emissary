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

Estado: receptor y adaptador listos y probados con payloads simulados. Falta conectar el motor de flujos y confirmar la forma real de `message_echoes` con la prueba de viabilidad (`../docs/meta-viabilidad.md`).
