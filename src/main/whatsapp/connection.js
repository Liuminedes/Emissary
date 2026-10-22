// src/main/whatsapp/connection.js
import { EventEmitter } from 'events';
import { existsSync, mkdirSync } from 'fs';
import QRCode from 'qrcode';
import pino from 'pino';
import { AUTH_DIR } from '../util/paths.js';
import { handleIncomingMessage } from './flows/conversation.flow.js';
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
  error: (...args) => waEvents.emit('log', `Baileys Error: ${args.join(' ')}`),
  debug: () => {},
  trace: () => {},
  child: () => logger
};

let sock = null;
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
    let version = [2, 3000, 1015901307];
    try {
      const res = await fetchLatestWaWebVersion();
      if (res && res.version) version = res.version;
    } catch (err) {
      try {
        const bRes = await fetchLatestBaileysVersion();
        if (bRes && bRes.version) version = bRes.version;
      } catch (e2) {
        waEvents.emit('log', `Fallo al obtener versión de WA, usando fallback: ${e2.message}`);
      }
    }

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
          markOnlineOnConnect: true,
          logger,
        });

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
          if (qr) {
            try {
              const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
              setStatus({ status: 'qr', qrDataUrl });
            } catch (err) {
              setStatus({ status: 'error', error: 'Error generando imagen QR' });
            }
          }

          if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;
            setStatus({ status: 'disconnected', qrDataUrl: null });
            if (shouldReconnect && !reconnecting) {
              reconnecting = true;
              setTimeout(() => {
                reconnecting = false;
                connect();
              }, 3000);
            } else if (!shouldReconnect) {
              logoutWhatsApp();
            }
          }

          if (connection === 'open') {
            setStatus({ status: 'connected', qrDataUrl: null });
          }
        });

        sock.ev.on('creds.update', saveCreds);

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
    waEvents.emit('advisor-message', { clientUserId: clientJid });
    return;
  }

  const userId = normalizeJid(jid);
  if (isAdvisorJid(userId)) return;

  // Notificar al sistema
  waEvents.emit('lead-message', { userId, text, pushName });

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

  const replies = handleIncomingMessage({ userId, text, pushName });
  for (const reply of replies) {
    await sendText(userId, reply);
  }
}

export async function sendText(to, text) {
  if (currentStatus.status !== 'connected' || !sock) return false;
  try {
    let jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    if (jid.endsWith('@lid') && lidToJidMap.has(jid)) jid = lidToJidMap.get(jid);

    const identity = extractIdentity(jid);
    const key = `${identity}|${text.substring(0, 80)}`;
    botSentTexts.add(key);
    setTimeout(() => botSentTexts.delete(key), BOT_TEXT_TTL);

    const sentMsg = await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    waEvents.emit('log', `Error enviando mensaje: ${err.message}`);
    return false;
  }
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