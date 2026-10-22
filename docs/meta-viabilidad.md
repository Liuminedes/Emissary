# Prueba de viabilidad: Cloud API + Coexistence

Objetivo: confirmar, **antes de construir el Hub**, que el número real del cliente puede usar la app
WhatsApp Business en el celular **y** la Cloud API a la vez (Coexistence).

Fuente principal: [Meta, onboarding de usuarios de la app Business](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
Lo marcado con (verificar) no está confirmado en esa página.

## Hechos clave (según Meta)

- Quien implementa el alta debe ser **Solution Partner o Tech Provider**. Un negocio suelto no puede hacerlo por su cuenta.
- La app Business del cliente debe ser **2.24.17 o superior**.
- Se usa **Embedded Signup** con `featureType: whatsapp_business_app_onboarding` y `sessionInfoVersion: 3`.
- Webhooks necesarios: `account_update`, `history`, `smb_app_state_sync`, `smb_message_echoes`.
- Tras el alta hay **24 horas** para sincronizar contactos (`smb_app_state_sync`) e historial (`history`, hasta 180 días); cada sync corre una sola vez. Si se pasa la ventana, hay que desvincular y repetir.
- Los mensajes que el asesor escribe en el celular llegan a Emissary como `smb_message_echoes` (así se reemplaza el parche `botSentTexts`).
- Límite fijo de 20 mensajes/s con ambos canales activos.
- **No soportado / afectado en modo coexistence:** mensajes temporales, ver una vez, ubicación en vivo, llamadas, catálogos y pedidos, herramientas de marketing y respuestas rápidas, perfil de empresa, Canales. Las **listas de difusión pasan a solo lectura**. El alta **desvincula todos los dispositivos acompañantes** (WhatsApp para Windows no es compatible).
- Países soportados: no listados en esa página (verificar con Meta o con el proveedor).
- Embedded Signup v2 y v3 quedan obsoletos el 15-oct-2026: implementar sobre v4 o superior.

## Dos caminos

| | A. Vía proveedor (BSP) | B. Ser Tech Provider propio |
|---|---|---|
| Quién hace el alta | El proveedor (ej. 360dialog, Twilio, Gupshup) | Tú, con tu app de Meta |
| Tiempo | Días | Semanas (verificación de negocio + revisión de app) (verificar) |
| Costo | Suscripción o margen del proveedor | Solo tarifas de Meta |
| Control | Limitado a su API | Total |
| Recomendado para | **Esta prueba** y el primer cliente | Cuando haya varios clientes |

**Recomendación:** empezar por el camino A para validar. Confirmar con el proveedor, por escrito, que soporta
coexistence en Colombia y qué cuenta como "elegible".

## Prueba paso a paso (camino A)

1. **Número de prueba primero.** Usa un número secundario en la app WhatsApp Business (no el del cliente) con algo de historial real.
   Así, si algo sale mal no se pierde el número productivo.
2. Actualiza la app Business a 2.24.17+ en ese celular.
3. Crea cuenta en el proveedor y pide expresamente el flujo de **coexistence / onboarding de usuarios de la app Business**.
4. Completa el Embedded Signup desde el celular (escanear QR / confirmar en la app). Anota cualquier error de elegibilidad.
5. Configura el webhook del proveedor hacia una URL pública temporal (por ejemplo un túnel) y suscribe los 4 eventos.
6. Ejecuta las pruebas de aceptación.
7. Solo si todo pasa, repite con el número real del cliente.

## Pruebas de aceptación (go / no-go)

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Alta del número en modo coexistence | Termina sin error de elegibilidad |
| 2 | Cliente escribe al número | Llega el webhook a Emissary y se ve también en el celular |
| 3 | Respuesta enviada por API | Se ve en el celular del asesor |
| 4 | El asesor responde desde el celular | Llega `smb_message_echoes` a Emissary |
| 5 | Plantilla fuera de la ventana de 24 h | Se envía solo con plantilla aprobada |
| 6 | Sincronía de contactos e historial dentro de las 24 h | Ambos `smb_app_data` responden OK |
| 7 | Qué pierde la app del celular | Documentar (listas de difusión, respuestas rápidas, catálogo) y confirmar que el cliente lo acepta |
| 8 | Costos | Registrar el cobro real por categoría de mensaje en Colombia |

**Go:** pasan 1 a 6 y el cliente acepta lo de la prueba 7.
**No-go:** falla la 1 (no elegible). Plan B: número nuevo solo en API (el asesor pierde la app en ese número) o esperar y reintentar según el criterio de antigüedad/calidad que indique Meta.

## Riesgos a vigilar

- El cliente ya tuvo tres números baneados: su cuenta podría no ser elegible o tener mala calidad. La prueba 1 lo decide.
- La pérdida de funciones de la app (respuestas rápidas, listas de difusión) puede ser un problema comercial para el cliente. Decírselo antes.
- Los precios por plantilla cambian (hubo actualización en abril de 2026): consultar la tarifa oficial de Colombia antes de cotizar.
