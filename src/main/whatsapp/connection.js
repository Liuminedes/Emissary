// src/main/whatsapp/connection.js
import { EventEmitter } from 'events';
import { existsSync, mkdirSync } from 'fs';
import { qrToDataUrl } from './qr.js';
import { replyDelayMs, reconnectDelayMs, MAX_RECONNECTS } from './pacing.js';
import { resolveWaVersion, versionText } from './waVersion.js';
import { formatLogArgs } from '../util/formatLog.js';
import { filasDeContactos, filaDePar } from './contactos.js';
import { ContactosRepo } from '../db/repositories/contactos.repo.js';
import { AUTH_DIR } from '../util/paths.js';
import { NegocioRepo } from '../db/repositories/negocio.repo.js';
import { SesionesRepo } from '../db/repositories/sesiones.repo.js';

import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
} from '@whiskeysockets/baileys';

export const waEvents = new EventEmitter();


// Reemplazamos pino por un logger en memoria básico.
// Pino en Electron ASAR causa crashes severos al instanciar worker threads.
const logger = {
  level: 'silent',
  info: () => {},
  warn: () => {},
  error: (...args) => waEvents.emit('log', `Baileys Error: ${formatLogArgs(args)}`),
  debug: () => {},
  trace: () => {},
  child: () => logger
};

let sock = null;
let reconnectAttempts = 0;
let agendaPedida = false;
let reconnecting = false;
let currentStatus = { status: 'disconnected', qrDataUrl: null };

const botSentTexts = new Set();
const BOT_TEXT_TTL = 15_000;
const lidToJidMap = new Map();

function normalizeJid(jid) {
  if (!jid) return '';
  return jid.replace(/:[0-9]+@/, '@');
}

function extractIdentity(jid) {
  if (!jid) return '';
  return normalizeJid(jid).replace(/@.*$/, '');
}

function isAdvisorJid(jid) {
  const negocio = NegocioRepo.get();
  if (!negocio?.telefono || !jid) return false;
  return extractIdentity(jid) === negocio.telefono.replace(/\D/g, '');
}

function extractText(msg) {
  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.buttonsResponseMessage?.selectedDisplayText ||
    msg?.listResponseMessage?.title ||
    ''
  );
}

function setStatus(next) {
  currentStatus = { ...currentStatus, ...next };
  waEvents.emit('status', currentStatus);
}

export function getStatus() {
  return currentStatus;
}

export async function initWhatsApp() {
  try {
    const authDir = AUTH_DIR();
    if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    // shortcut: versión de respaldo fija (la vigente el 4/11/2026); envejece, pero solo se usa si no hay internet hacia WhatsApp Web ni GitHub.
    const { version, source } = await resolveWaVersion({
      fetchWeb: () => fetchLatestWaWebVersion({ timeout: 8000 }),
      fetchGithub: () => fetchLatestBaileysVersion({ timeout: 8000 }),
      fallback: [2, 3000, 1053070940],
    });
    waEvents.emit('info', `[whatsapp] versión ${versionText(version)} (fuente: ${source})${source === 'respaldo' ? ' — no se pudo consultar la versión actual; revisa la conexión a internet' : ''}`);

    function connect() {
      try {
        sock = makeWASocket({
          version,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
          },
          browser: Browsers.macOS('Desktop'),
          printQRInTerminal: false,
          syncFullHistory: false,
          markOnlineOnConnect: false, // no se muestra "en línea" todo el tiempo y el celular sigue avisando los mensajes
          logger,
        });

        let qrAvisado = false;
        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
          if (qr) {
            if (!qrAvisado) { qrAvisado = true; waEvents.emit('info', '[whatsapp] código QR generado'); }
            try {
              const qrDataUrl = await qrToDataUrl(qr);
              setStatus({ status: 'qr', qrDataUrl });
            } catch (err) {
              setStatus({ status: 'error', error: 'Error generando imagen QR' });
            }
          }

          if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const nombre = Object.entries(DisconnectReason).find(([, v]) => v === code)?.[0] ?? 'desconocido';
            waEvents.emit('info', `[whatsapp] conexión cerrada: código ${code ?? '?'} (${nombre}) ${lastDisconnect?.error?.message ?? ''}`.trim());
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            setStatus({ status: 'disconnected', qrDataUrl: null });
            if (shouldReconnect && !reconnecting) {
              if (reconnectAttempts >= MAX_RECONNECTS) {
                waEvents.emit('log', `La conexión con WhatsApp falló ${reconnectAttempts} veces seguidas; se detienen los reintentos. Reinicia Emissary o vuelve a vincular.`);
                setStatus({ status: 'error', error: 'No se pudo reconectar con WhatsApp. Reinicia Emissary o vuelve a vincular.' });
                return;
              }
              reconnecting = true;
              setTimeout(() => {
                reconnecting = false;
                connect();
              }, reconnectDelayMs(reconnectAttempts++));
            } else if (!shouldReconnect) {
              logoutWhatsApp();
            }
          }

          if (connection === 'open') {
            reconnectAttempts = 0;
            waEvents.emit('info', '[whatsapp] conectado');
            // Una sesión vinculada antes de esta versión no tiene la agenda guardada: se descarga una vez (la misma sincronización que hace WhatsApp al vincular)
            if (!agendaPedida && ContactosRepo.count() === 0) {
              agendaPedida = true;
              sock.resyncAppState(['critical_unblock_low'], true)
                .then(() => waEvents.emit('info', `[whatsapp] agenda sincronizada: ${ContactosRepo.count()} contactos`))
                .catch((err) => waEvents.emit('info', `[whatsapp] no se pudo sincronizar la agenda: ${err.message}`));
            }
            setStatus({ status: 'connected', qrDataUrl: null });
          }
        });

        sock.ev.on('creds.update', saveCreds);

        // Teléfono y nombre de cada contacto: llegan al vincular y cada vez que cambian (los ids @lid no traen el teléfono por sí solos)
        const guardarContactos = (filas) => {
          try {
            if (!filas.length) return;
            ContactosRepo.saveMany(filas);
            for (const f of filas) if (f.userId.endsWith('@lid') && f.numero) lidToJidMap.set(f.userId, `${f.numero}@s.whatsapp.net`);
          } catch (err) {
            waEvents.emit('log', `No se pudieron guardar los contactos: ${err.message}`);
          }
        };
        sock.ev.on('contacts.upsert', (contactos) => guardarContactos(filasDeContactos(contactos)));
        sock.ev.on('contacts.update', (contactos) => guardarContactos(filasDeContactos(contactos)));
        sock.ev.on('messaging-history.set', ({ contacts }) => guardarContactos(filasDeContactos(contacts)));
        sock.ev.on('chats.phoneNumberShare', ({ lid, jid }) => guardarContactos([filaDePar(lid, jid)].filter(Boolean)));

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
          if (type !== 'notify') return;
          for (const msg of messages) {
            try {
              await handleIncomingUpsert(msg);
            } catch (err) {
              waEvents.emit('log', `Error procesando mensaje: ${err.message}`);
            }
          }
        });
      } catch (err) {
        waEvents.emit('log', `Error interno en connect(): ${err.message}`);
        setStatus({ status: 'error', error: `Fallo al conectar: ${err.message}` });
      }
    }

    setStatus({ status: 'connecting', qrDataUrl: null });
    connect();
  } catch (globalErr) {
    waEvents.emit('log', `Error fatal en initWhatsApp: ${globalErr.message}`);
    setStatus({ status: 'error', error: `Error interno: ${globalErr.message}` });
  }
}

const processedMessages = new Set();

async function handleIncomingUpsert(msg) {
  if (!msg.message || !msg.key || !msg.key.id) return;
  
  // Deduplicación vital: Baileys a veces emite el mismo mensaje varias veces
  if (processedMessages.has(msg.key.id)) return;
  processedMessages.add(msg.key.id);
  // Limpiar set para evitar fugas de memoria
  if (processedMessages.size > 1000) {
    const iterator = processedMessages.values();
    for (let i = 0; i < 500; i++) processedMessages.delete(iterator.next().value);
  }

  const jid = msg.key.remoteJid || '';

  if (
    jid.endsWith('@g.us') ||
    jid.endsWith('@newsletter') ||
    jid.endsWith('@broadcast') ||
    jid === 'status@broadcast'
  ) return;

  if (msg.message.protocolMessage) return;

  const text = extractText(msg.message);
  if (!text) return;

  const pushName = msg.pushName || '';

  if (jid.endsWith('@lid')) {
    const realJid = msg.key.senderPn || msg.key.participantPn;
    if (realJid?.endsWith('@s.whatsapp.net')) lidToJidMap.set(jid, realJid);
    const fila = filaDePar(jid, realJid) || (pushName && !msg.key.fromMe ? { userId: jid, numero: '', nombre: pushName } : null);
    if (fila) { try { ContactosRepo.saveMany([fila]); } catch { /* el mensaje se atiende igual */ } }
  }

  if (msg.key.fromMe) {
    const clientJid = normalizeJid(jid);
    if (isAdvisorJid(clientJid)) return;

    const identity = extractIdentity(clientJid);
    const key = `${identity}|${text.substring(0, 80)}`;
    if (botSentTexts.has(key)) {
      botSentTexts.delete(key);
      return; // era el bot
    }
    // El asesor escribió manualmente -> pausar bot para ese cliente
    waEvents.emit('echo', { userId: clientJid, text });
    return;
  }

  const userId = normalizeJid(jid);
  if (isAdvisorJid(userId)) return;

  // El bot (attachBot) escucha este evento y responde por el canal
  waEvents.emit('message', { userId, text, pushName });

  const { Notification } = await import('electron');
  if (Notification.isSupported()) {
    import('path').then(({ default: path }) => {
      import('../util/paths.js').then(({ dirnameFromMeta }) => {
        const _dir = dirnameFromMeta(import.meta.url);
        new Notification({
          title: pushName ? `Nuevo mensaje de ${pushName}` : 'Nuevo prospecto',
          body: text.length > 60 ? text.substring(0, 60) + '...' : text,
          icon: path.join(_dir, '..', '..', 'renderer', 'assets', 'logo.png'),
          silent: false
        }).show();
      });
    });
  }
}

// Canal Baileys según el contrato de bot.js (el de Cloud API implementará lo mismo)
export const channel = { events: waEvents, sendText: (to, text) => sendText(to, text) };

export async function sendText(to, text) {
  if (currentStatus.status !== 'connected' || !sock) return false;
  try {
    let jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    if (jid.endsWith('@lid')) {
      const numero = ContactosRepo.numeroDe(jid);
      const real = lidToJidMap.get(jid) || (numero ? `${numero}@s.whatsapp.net` : '');
      if (real) jid = real;
    }

    const identity = extractIdentity(jid);
    const key = `${identity}|${text.substring(0, 80)}`;
    botSentTexts.add(key);
    setTimeout(() => botSentTexts.delete(key), BOT_TEXT_TTL);

    // Como una persona: aparece "escribiendo…" y se espera según el largo del mensaje antes de enviarlo
    try {
      await sock.presenceSubscribe(jid);
      await sock.sendPresenceUpdate('composing', jid);
      await new Promise((r) => setTimeout(r, replyDelayMs(text)));
      await sock.sendPresenceUpdate('paused', jid);
    } catch { /* si falla la presencia, el mensaje igual se envía */ }

    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    waEvents.emit('log', `Error enviando mensaje: ${err.message}`);
    return false;
  }
}

// Alternativa al QR: el celular muestra un código de 8 caracteres que se escribe en "Vincular con número de teléfono"
export async function requestPairingCode(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('Escribe el número con código de país, por ejemplo 573001234567');
  if (!sock || sock.authState?.creds?.registered) throw new Error('La conexión aún no está lista o ya hay un WhatsApp vinculado');
  return sock.requestPairingCode(digits);
}

export async function logoutWhatsApp() {
  setStatus({ status: 'disconnected', qrDataUrl: null });
  if (sock) {
    try { await sock.logout(); } catch { /* noop */ }
    try { sock.ws?.close(); } catch { /* noop */ }
    sock = null;
  }
  
  // Wait a tiny bit to ensure files are released by Baileys before deleting
  setTimeout(async () => {
    const authDir = AUTH_DIR();
    if (existsSync(authDir)) {
      try {
        const fs = await import('fs');
        fs.rmSync(authDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
      } catch (err) {
        waEvents.emit('log', `Error borrando auth: ${err.message}`);
      }
    }
    
    // Now restart the connection safely
    await initWhatsApp();
  }, 1000);
}