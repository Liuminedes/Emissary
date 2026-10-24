# Emissary

Plataforma de automatización de mensajes de WhatsApp para negocios y asesores. Por **Vyntra Orbit**.

## Estado

- **App de escritorio** (Electron + React + SQLite): conexión por Baileys, motor de flujos con editor visual, inbox de conversaciones, leads, catálogo, envíos masivos, login con usuarios y checklist de configuración.
- **Hub** (`hub/`): servicio para WhatsApp Cloud API (webhooks, consentimiento, límites de envío, costos, multi-tenant). Ver [hub/README.md](hub/README.md).
- Plan y decisiones: [docs/meta-viabilidad.md](docs/meta-viabilidad.md).

## Requisitos

- Windows 10/11
- Node.js 22.13 o superior
- Un número de WhatsApp para vincular como número de atención

## Instalación y ejecución

```bash
npm install
npm start
npm test
```

`better-sqlite3` es un módulo nativo: el script `postinstall` lo recompila contra la versión de Electron. Si falla: `npx electron-builder install-app-deps`.

## Primer uso

1. **Crear la contraseña del administrador.** La cuenta `admin` existe desde el inicio, pero **no hay contraseña por defecto**: se define en el primer arranque.
2. **Completar el checklist del Dashboard:** datos del negocio y plantilla, asesor con su WhatsApp, y escanear el QR (WhatsApp > Dispositivos vinculados). El bot no responde a clientes hasta completar los dos primeros pasos.
3. **Crear usuarios** desde Ajustes > Usuarios (solo el administrador). Roles: `admin` y `asesor`.

Notas de seguridad: el login es un **bloqueo local de la interfaz** (contraseñas con scrypt, bloqueo de 30 s tras 5 intentos fallidos). La base de datos y la sesión de WhatsApp siguen en disco sin cifrar, así que no es una protección fuerte de los datos. El bot sigue funcionando en segundo plano aunque la sesión esté cerrada.

Los datos viven en `%APPDATA%/Emissary` (base de datos y sesión de WhatsApp), fuera de la carpeta del proyecto.

## Empaquetar el instalador de Windows

```bash
npm run dist
```

Genera el instalador en `build_out/`. Si falla con *Cannot create symbolic link* (descarga de `winCodeSign`), activa el **Modo desarrollador** de Windows, o genera sin firma de código:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win -c.win.signAndEditExecutable=false
```

Ese camino no incrusta el ícono en el `.exe` ni firma el instalador: Windows SmartScreen avisará al instalarlo.

## Pendiente

- Conectar el escritorio con el Hub (login contra el Hub en lugar del bloqueo local, aviso de handoff, pantallas de campañas y costos).
- Prueba de viabilidad de Cloud API + Coexistence con Meta.
- Licenciamiento, firma de código y auto-update.
- Editor de flujos con tipos de nodo en lugar de IDs fijos (`askBudget`, etc.).
