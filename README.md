# Emissary

Plataforma de automatización de mensajes de WhatsApp para negocios, 100% local — sin Railway, sin Redis, sin Supabase. Por **Vyntra Orbit**.

## Qué es esto ahora mismo

Este es el **esqueleto funcional**: la conexión de WhatsApp (Baileys), la base de datos local (SQLite), el motor del flujo conversacional, y las 6 pantallas del frontend en HTML/JS plano (sin diseño final — eso lo va a resolver el prompt de Gemini que ya tienen, integrando componentes React+Tailwind sobre esta misma base funcional).

## Requisitos

- Windows 10/11 (o cualquier SO para desarrollo/pruebas)
- Node.js 20 o superior
- Un número de WhatsApp para vincular como número de negocio

## Instalación

```bash
npm install
```

Esto instala Electron, Baileys, better-sqlite3, etc. `better-sqlite3` es un módulo nativo — el script `postinstall` ya corre `electron-builder install-app-deps` para recompilarlo contra la versión de Electron correcta. Si falla, correr manualmente:

```bash
npx electron-builder install-app-deps
```

## Ejecutar en desarrollo

```bash
npm start
```

Al abrir por primera vez verás el **wizard de setup** (nombre del negocio, asesor, teléfono, horario). Al completarlo, se te muestra el **QR de WhatsApp** en el Dashboard — escanéalo desde el celular del asesor (WhatsApp > Dispositivos vinculados) y ya el bot queda respondiendo.

La sesión de WhatsApp y la base de datos quedan guardadas en la carpeta de datos de usuario de Windows (`%APPDATA%/Emissary`), no en la carpeta del proyecto — así sobreviven actualizaciones.

## Empaquetar el instalador de Windows

```bash
npm run dist
```

Genera el `.exe` en `dist/`. **Antes de esto**, reemplaza `assets/icon.ico` y `assets/tray-icon.png` con los íconos reales de Emissary (los que dejé son solo referencias de ruta, no hay archivos binarios todavía).

## Qué falta (siguiente iteración)

- Reemplazar el frontend plano por los componentes React+Tailwind que salgan del prompt de Gemini, conectándolos a la misma API de `window.emissary` que ya expone el `preload.cjs` — no hay que tocar el backend para esto.
- Sonner para las notificaciones toast del frontend nuevo.
- Ajustar el scraper (`src/main/whatsapp/scraper.js`) por negocio según la estructura real de su página (selectores CSS).
- Sistema de licenciamiento/activación antes de distribuir a clientes.
- Iconos reales para el instalador y la bandeja del sistema.

## Estructura

Ver el árbol completo de carpetas en la conversación — resumen rápido:

- `src/main/` — proceso principal de Electron: conexión Baileys, base de datos, flujo conversacional, IPC.
- `src/preload/preload.cjs` — puente seguro entre el backend y el frontend (`window.emissary.*`).
- `src/renderer/` — frontend actual (funcional, sin diseño final).
