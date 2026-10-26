# Bitácora de estado: Emissary (26 oct 2026)

Versión de escritorio 1.2.1 (commit `eb11a12`) y Hub 0.1.0. Este documento separa lo **verificado** de lo **supuesto**.

## 1. Qué hay hoy

| Pieza | Estado | Evidencia |
|---|---|---|
| App de escritorio (Electron): login, checklist, flujo editable, catálogo, leads, inbox, métricas, masivos con interruptor, registro de errores | Funciona en pruebas | 88 pruebas pasan; scripts con Electron real; revisión visual con simulación del backend |
| Instalador Windows 1.2.1 | Generado, **sin firmar**, sin ícono | Probado desempaquetado; **no** instalado en otro PC |
| Hub (servidor multi-cliente, Cloud API, consentimiento, límites, costos, /admin) | Funciona en pruebas | 40 pruebas pasan (incluye webhook→respuesta→handoff simulados) |
| Conexión escritorio ↔ Hub | **No existe** | Ningún archivo de `src/` usa el Hub |
| Hub desplegado | **No** | Solo local |
| WhatsApp real (Baileys) de punta a punta con esta versión | **Nunca probado** | Solo bot con canal simulado |
| Cloud API / Coexistence con Meta real | **Nunca probado** | El formato de `message_echoes` es una suposición documentada en `hub/src/parse.js` |

## 2. Qué es "multi-cliente" hoy (importante)

Hay **dos modelos distintos** y hoy solo existe uno completo en cada lado:

- **Escritorio:** un cliente por instalación. Su base SQLite es local. No hay cuentas en la nube ni nada que compartir. Multi-cliente = vender muchos instaladores.
- **Hub:** ya es multi-cliente de verdad (`tenant_id` en todo, enrutado por `phone_number_id`), pero solo atiende por Cloud API, y usa **un único token** para todos (`hub/src/index.js`). No sirve para varios clientes reales hasta guardar el token de cada uno cifrado.

## 3. Tu idea: "registrar a alguien y que el cliente instale el programa"

Son dos servidores distintos y conviene no mezclarlos:

1. **Servidor de cuentas y licencias** (lo que describes). Registra al cliente, le da usuario, controla si pagó, deja suspenderlo. El programa sigue corriendo en su PC. Es pequeño, y es lo que hoy te falta para vender: sin él cualquiera copia el instalador.
2. **Hub de WhatsApp** (ya construido). El bot corre en tu servidor y el escritorio es solo la consola. Resuelve el problema de los baneos (Cloud API oficial), pero obliga a tener Tech Provider/BSP y cobra por conversación.

Recomendación: **hacer primero el 1**, pequeño, y dejar el 2 para cuando la prueba de Coexistence con Meta salga bien. No dependen entre sí.

Mínimo del servidor de cuentas (sin construirlo todavía):
- `POST /activar` con código de licencia → devuelve token firmado con vencimiento.
- La app lo revisa al arrancar y cada 24 h; si falla la red, tolera unos días (no dejar al cliente sin bot por un corte).
- Panel tuyo (admin) para crear, suspender y renovar clientes.
- No sube conversaciones ni leads: solo identidad y estado de pago. Eso evita responsabilidad de datos.

## 4. ¿Renta como microSaaS? Lo que no sé

- **Costo por cliente con Cloud API:** WhatsApp cobra por conversación; las tarifas para Colombia no están verificadas. Sin ese número no puedes fijar precio.
- **Costo de BSP/Tech Provider** y si Coexistence está disponible para tu caso: depende de la prueba con número secundario que sigue pendiente.
- **Con Baileys** el costo es ~0 pero no puedes prometer "no te banean". El cliente que ya perdió 3 números es justo el que más riesgo corre.
- **Soporte:** cada instalación en un PC distinto = problemas distintos (antivirus, SmartScreen, actualizaciones). No hay auto-actualización.

## 5. Riesgos conocidos

1. Prometer "sin baneos" con Baileys. No se puede garantizar. Decirlo por escrito.
2. Sin licencia: instalador copiable.
3. Sin respaldo ni cifrado de la base local (leads con teléfonos en claro).
4. Sin firma de código: Windows muestra advertencia.
5. Sin auto-actualización.
6. Fuga en la plantilla Restaurante: enlace fijo `http://localhost:5000/carta` (`src/main/whatsapp/flows/defaultFlow.js:148`).
7. Baileys depende de un protocolo no oficial: puede romperse cualquier día.

## 6. Orden sugerido

1. **Prueba real con número secundario** (Baileys): conectar, recibir, responder, handoff, reiniciar la app. Es la prueba que falta para entregar.
2. **Prueba de viabilidad Meta** (Coexistence): define si el Hub es el camino.
3. **Servidor de cuentas/licencias** (sección 3).
4. Arreglar el enlace de Restaurante; auto-actualización; firma e ícono.
5. Solo si 2 sale bien: guardar tokens cifrados por cliente, desplegar el Hub, conectar la consola.
