// src/main/ipc/handlers.js
import { ipcMain } from 'electron';
import { NegocioRepo } from '../db/repositories/negocio.repo.js';
import { CatalogoRepo } from '../db/repositories/catalogo.repo.js';
import { FlujoRepo } from '../db/repositories/flujo.repo.js';
import { HistorialRepo } from '../db/repositories/historial.repo.js';
import { LeadsRepo } from '../db/repositories/leads.repo.js';
import { SesionesRepo } from '../db/repositories/sesiones.repo.js';
import { getStatus, logoutWhatsApp, sendText } from '../whatsapp/connection.js';
import { scrapePrices } from '../whatsapp/scraper.js';
import { AuthError } from '../auth/auth.js';
import { applyAutoLaunch, isAutoLaunchEnabled } from '../autolaunch.js';

let cancelCampañaMasiva = false;
let campañaActiva = false;
const MAX_CONTACTOS_CAMPAÑA = 300;
const MAX_LARGO_PLANTILLA = 1000;

const esUserId = (v) => typeof v === 'string' && v.length > 0 && v.length < 100;

// Marcas/plantillas que se pueden aplicar desde la interfaz
export const MARCAS = ['Volkswagen', 'KIA', 'JAC', 'Restaurante', 'Blanco'];

// Convierte los errores de autenticación en { ok: false, error } para mostrarlos tal cual en la pantalla
const attempt = (fn) => {
  try { return { ok: true, data: fn() }; } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
};

export function registerIpcHandlers({ inbox, auth }) {
  // Todo lo que no sea iniciar sesión exige una sesión abierta (el bot sigue funcionando sin ella)
  const secure = (channel, fn) => ipcMain.handle(channel, (e, ...args) => {
    if (!auth.current()) throw new Error('No autenticado');
    return fn(e, ...args);
  });

  // Sesión y usuarios
  ipcMain.handle('auth:status', () => auth.status());
  ipcMain.handle('auth:setup', (_e, { password } = {}) => attempt(() => auth.setupAdmin(password)));
  ipcMain.handle('auth:login', (_e, { username, password } = {}) => attempt(() => auth.login(username, password)));
  ipcMain.handle('auth:logout', () => auth.logout());
  secure('auth:users', () => attempt(() => auth.listUsers()));
  secure('auth:createUser', (_e, data = {}) => attempt(() => auth.createUser(data)));
  secure('auth:resetPassword', (_e, { id, password } = {}) => attempt(() => auth.resetPassword(id, password)));
  secure('auth:deleteUser', (_e, { id } = {}) => attempt(() => auth.deleteUser(id)));
  secure('auth:changePassword', (_e, { actual, nueva } = {}) => attempt(() => auth.changeOwnPassword(actual, nueva)));

  // Negocio / configuración
  secure('negocio:get', () => NegocioRepo.get());
  secure('negocio:save', (_e, data) => NegocioRepo.save(data));
  // Cambiar de marca reemplaza el flujo y el catálogo (la interfaz pide confirmación antes)
  secure('negocio:applyBrand', (_e, { marca } = {}) => {
    if (!MARCAS.includes(marca)) throw new Error('Marca no válida');
    NegocioRepo.save({ marca });
    CatalogoRepo.clearAll();
    CatalogoRepo.seedCatalog(marca);
    FlujoRepo.applyBrandTemplate(marca);
    return NegocioRepo.get();
  });
  // Estado de WhatsApp
  secure('wa:getStatus', () => getStatus());
  secure('wa:logout', () => logoutWhatsApp());

  // Catálogo
  secure('catalogo:list', () => CatalogoRepo.listAll());
  secure('catalogo:upsert', (_e, item) => CatalogoRepo.upsertItem(item));
  secure('catalogo:delete', (_e, id) => CatalogoRepo.deleteItem(id));
  secure('catalogo:scrape', async () => {
    const res = await scrapePrices();
    if (!res.ok) return res;
    return { ...res, actualizados: CatalogoRepo.applyScrapedPrices(res.items) };
  });

  // Mensajes y Flujos

  secure('mensajes:cancelMasivo', () => {
    cancelCampañaMasiva = true;
  });

  secure('mensajes:startMasivo', async (e, payload) => {
    if (campañaActiva) return { success: false, message: 'Ya hay una campaña en curso' };

    const { contactos: crudos, plantilla } = payload || {};
    if (typeof plantilla !== 'string' || !plantilla.trim() || plantilla.length > MAX_LARGO_PLANTILLA) {
      return { success: false, message: 'Plantilla inválida' };
    }
    if (!Array.isArray(crudos) || crudos.length === 0 || crudos.length > MAX_CONTACTOS_CAMPAÑA) {
      return { success: false, message: `La campaña admite de 1 a ${MAX_CONTACTOS_CAMPAÑA} contactos` };
    }
    // Solo números válidos y sin repetir
    const vistos = new Set();
    const contactos = crudos.filter((c) => {
      const digitos = typeof c?.numero === 'string' ? c.numero.replace(/\D/g, '') : '';
      if (digitos.length < 10 || vistos.has(digitos)) return false;
      vistos.add(digitos);
      return true;
    });
    if (contactos.length === 0) return { success: false, message: 'Ningún número válido' };

    campañaActiva = true;
    cancelCampañaMasiva = false;

    const runCampaign = async () => {
      let enviados = 0;
      for (let i = 0; i < contactos.length; i++) {
        if (cancelCampañaMasiva) break;
        
        const contacto = contactos[i];
        let telefono = contacto.numero.replace(/[^\d+]/g, '');
        if (!telefono.startsWith('+')) {
          telefono = telefono.replace(/\D/g, '');
          if (telefono.length === 10) telefono = '57' + telefono;
        } else {
          telefono = telefono.replace(/\D/g, '');
        }
        
        const userId = `${telefono}@s.whatsapp.net`;
        
        let mensajeFinal = plantilla;
        if (contacto.nombre) {
          mensajeFinal = mensajeFinal.replace(/\{nombre\}/gi, contacto.nombre.trim());
        } else {
          mensajeFinal = mensajeFinal.replace(/\{nombre\}/gi, '');
        }
        
        try {
          const success = await sendText(userId, mensajeFinal.trim());
          if (success) {
            enviados++;
            LeadsRepo.upsert({
              userId,
              telefono: `+${telefono}`,
              nombre: contacto.nombre ? contacto.nombre.trim() : 'Lead Masivo',
              interes: 'Campaña de Bienvenida'
            });
          }
        } catch (err) {
          console.error('[Emissary] Error masivo:', err);
        }
        
        if (!e.sender.isDestroyed()) {
          e.sender.send('masivo:progress', {
            total: contactos.length,
            enviados,
            currentNumber: telefono,
            currentName: contacto.nombre || ''
          });
        }
        
        if (i < contactos.length - 1 && !cancelCampañaMasiva) {
          const delay = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!e.sender.isDestroyed()) {
        e.sender.send('masivo:done', { enviados, total: contactos.length });
      }
    };
    
    // Start without awaiting so the UI is freed immediately
    runCampaign().finally(() => { campañaActiva = false; });

    return { success: true, message: 'started' };
  });

  secure('flujo:get', () => FlujoRepo.getFlow());
  secure('flujo:save', (_e, { nodes, edges }) => FlujoRepo.saveFlow(nodes, edges));
  secure('flujo:resetToTemplate', async () => {
    const negocio = NegocioRepo.get();
    const marca = negocio?.marca || 'Volkswagen';
    FlujoRepo.applyBrandTemplate(marca);
    return FlujoRepo.getFlow();
  });

  // Inbox: conversaciones y control del asesor
  secure('inbox:list', () => HistorialRepo.listConversations());
  secure('inbox:messages', (_e, userId) => (esUserId(userId) ? HistorialRepo.listMessages(userId) : []));
  secure('inbox:take', (_e, userId) => { if (esUserId(userId)) inbox.takeControl(userId); });
  secure('inbox:release', (_e, userId) => { if (esUserId(userId)) inbox.releaseControl(userId); });
  secure('inbox:send', async (_e, { userId, text } = {}) => {
    if (!esUserId(userId)) return { ok: false, error: 'Conversación inválida' };
    try {
      return await inbox.sendAsAdvisor(userId, text);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Leads / CRM
  secure('leads:list', () => LeadsRepo.listAll());
  secure('leads:updateEtapa', (_e, { id, etapa }) => LeadsRepo.updateEtapa(id, etapa));

  // Pausa global y exclusiones
  secure('bot:setGlobalPause', (_e, paused) => SesionesRepo.setGlobalPause(paused));
  secure('bot:isGloballyPaused', () => SesionesRepo.isGloballyPaused());
  secure('sesion:reset', (_e, userId) => SesionesRepo.delete(userId));

  // Ajustes de sistema
  secure('app:getAutoLaunch', () => isAutoLaunchEnabled());
  secure('app:setAutoLaunch', (_e, enabled) => applyAutoLaunch(enabled));
}
