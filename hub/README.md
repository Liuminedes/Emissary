# Emissary Hub

Servicio que recibe los webhooks de WhatsApp Cloud API (Meta directo o vía proveedor) y envía mensajes.
Sin dependencias: solo Node 22.13+.

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

## Datos y multi-cliente

- SQLite embebido de Node (`node:sqlite`, requiere Node ≥ 22.13), en `HUB_DB_PATH` (por defecto `data/hub.db`).
- Esquema en `src/db/schema.sql` con **`tenant_id` en todas las tablas**; migraciones versionadas con `PRAGMA user_version` (`src/db/db.js`: añadir al final, nunca editar las anteriores).
- `createTenantRepos(db, tenantId)` cierra el tenant en cada repositorio: ninguna consulta puede olvidar el filtro.
- Cada webhook se enruta al tenant por el `phone_number_id` del payload. Con un único tenant se tolera un id desconocido; con varios, el evento se descarta.
- Sin token en la base: el token de envío viene de variables de entorno (ver `shortcut` en `src/index.js`).

Estado: probado de extremo a extremo con un proveedor simulado y con dos tenants. Pendiente: aviso de handoff al escritorio, API para administrar tenants, secretos por tenant cifrados, y confirmar la forma real de `message_echoes` con la prueba de viabilidad (`../docs/meta-viabilidad.md`).
