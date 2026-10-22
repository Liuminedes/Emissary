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
import { applyAutoLaunch, isAutoLaunchEnabled } from '../autolaunch.js';

let cancelCampañaMasiva = false;
let campañaActiva = false;
const MAX_CONTACTOS_CAMPAÑA = 300;
const MAX_LARGO_PLANTILLA = 1000;

const esUserId = (v) => typeof v === 'string' && v.length > 0 && v.length < 100;

export function registerIpcHandlers({ inbox }) {
  // Negocio / configuración
  ipcMain.handle('negocio:get', () => NegocioRepo.get());
  ipcMain.handle('negocio:save', (_e, data) => NegocioRepo.save(data));
  ipcMain.handle('negocio:completeSetup', () => {
    const res = NegocioRepo.markSetupComplete();
    const negocio = NegocioRepo.get();
    if (negocio && negocio.marca) {
      if (negocio.marca !== 'Blanco') {
        CatalogoRepo.seedCatalog(negocio.marca);
        FlujoRepo.applyBrandTemplate(negocio.marca);
      }
    }
    return res;
  });
  // Estado de WhatsApp
  ipcMain.handle('wa:getStatus', () => getStatus());
  ipcMain.handle('wa:logout', () => logoutWhatsApp());

  // Catálogo
  ipcMain.handle('catalogo:list', () => CatalogoRepo.listAll());
  ipcMain.handle('catalogo:upsert', (_e, item) => CatalogoRepo.upsertItem(item));
  ipcMain.handle('catalogo:delete', (_e, id) => CatalogoRepo.deleteItem(id));
  ipcMain.handle('catalogo:scrape', async () => {
    const res = await scrapePrices();
    if (!res.ok) return res;
    return { ...res, actualizados: CatalogoRepo.applyScrapedPrices(res.items) };
  });

  // Mensajes y Flujos

  ipcMain.handle('mensajes:cancelMasivo', () => {
    cancelCampañaMasiva = true;
  });

  ipcMain.handle('mensajes:startMasivo', async (e, payload) => {
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

  ipcMain.handle('flujo:get', () => FlujoRepo.getFlow());
  ipcMain.handle('flujo:save', (_e, { nodes, edges }) => FlujoRepo.saveFlow(nodes, edges));
  ipcMain.handle('flujo:resetToTemplate', async () => {
    const negocio = NegocioRepo.get();
    const marca = negocio?.marca || 'Volkswagen';
    FlujoRepo.applyBrandTemplate(marca);
    return FlujoRepo.getFlow();
  });

  // Inbox: conversaciones y control del asesor
  ipcMain.handle('inbox:list', () => HistorialRepo.listConversations());
  ipcMain.handle('inbox:messages', (_e, userId) => (esUserId(userId) ? HistorialRepo.listMessages(userId) : []));
  ipcMain.handle('inbox:take', (_e, userId) => { if (esUserId(userId)) inbox.takeControl(userId); });
  ipcMain.handle('inbox:release', (_e, userId) => { if (esUserId(userId)) inbox.releaseControl(userId); });
  ipcMain.handle('inbox:send', async (_e, { userId, text } = {}) => {
    if (!esUserId(userId)) return { ok: false, error: 'Conversación inválida' };
    try {
      return await inbox.sendAsAdvisor(userId, text);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Leads / CRM
  ipcMain.handle('leads:list', () => LeadsRepo.listAll());
  ipcMain.handle('leads:updateEtapa', (_e, { id, etapa }) => LeadsRepo.updateEtapa(id, etapa));

  // Pausa global y exclusiones
  ipcMain.handle('bot:setGlobalPause', (_e, paused) => SesionesRepo.setGlobalPause(paused));
  ipcMain.handle('bot:isGloballyPaused', () => SesionesRepo.isGloballyPaused());
  ipcMain.handle('sesion:reset', (_e, userId) => SesionesRepo.delete(userId));

  // Ajustes de sistema
  ipcMain.handle('app:getAutoLaunch', () => isAutoLaunchEnabled());
  ipcMain.handle('app:setAutoLaunch', (_e, enabled) => applyAutoLaunch(enabled));
}
