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

## Protección del número (Fase 3)

Ninguna campaña sale sin pasar por estas guardas (`src/campaigns.js`, reglas puras en `src/compliance/limits.js`):

1. **Consentimiento:** las campañas de *marketing* solo van a contactos con `marketing_opt_in` y una fuente registrada. Que un cliente escriba habilita responderle, pero no es consentimiento de marketing.
2. **Baja automática:** si el mensaje entero es `BAJA`, `STOP`, `CANCELAR`… el contacto queda excluido de toda campaña y recibe confirmación; `ALTA` lo reactiva. Se revalida en cada envío, no solo al crear la campaña.
3. **Frecuencia:** un contacto no recibe dos campañas en menos de 3 días.
4. **Horario** del tenant (por defecto 9 a 19, `America/Bogota`).
5. **Tope diario con rampa de calentamiento** (20, 30, 50, 80, 120, 200 y luego el máximo del tenant) y **espaciado aleatorio** de 20 a 60 s entre envíos.
6. **Presupuesto mensual:** pausa la campaña al agotarse. Exige tener configurada la tarifa; un tope sin tarifa no protege nada.
7. **Corte automático:** pausa si fallan 20 % de los últimos envíos (mínimo 5) o si las bajas pasan de 3 % de los envíos de 24 h (mínimo 30).

Las tarifas **no están precargadas**: las configura el operador con las de Meta vigentes, y el panel las marca como estimadas.

### API de administración (`ADMIN_TOKEN`, header `Authorization: Bearer …`)

| Método y ruta | Qué hace |
|---|---|
| `GET /admin/costos?mes=YYYY-MM` | Panel: consumo y costo estimado por categoría y campaña, presupuesto restante, costo por lead |
| `GET /admin/salud` | Tope de hoy, enviados, día de calentamiento, horario, corte activo, gasto del mes |
| `POST /admin/config` | `limite_diario_max`, `presupuesto_mensual_usd`, `tarifa_marketing_usd`, `tarifa_utility_usd`, `hora_inicio`, `hora_fin` |
| `POST /admin/consentimientos` | `{ contactos: [{ numero, fuente }] }` registra opt-in con su evidencia |
| `POST /admin/campanas` | Crea la campaña y devuelve elegibles, omitidos con motivo y costo estimado |
| `POST /admin/campanas/:id/iniciar` · `/pausar` · `GET /admin/campanas/:id` | Controla y consulta |

Con varios tenants se indica `?tenant=<slug>` (o `tenant` en el cuerpo).

Estado: probado de extremo a extremo con un proveedor simulado, dos tenants y reloj controlado. Pendiente: aviso de handoff al escritorio, pantalla para el panel, secretos por tenant cifrados, plantillas aprobadas por Meta (hay que crearlas en su panel), y confirmar la forma real de `message_echoes` con la prueba de viabilidad (`../docs/meta-viabilidad.md`).
