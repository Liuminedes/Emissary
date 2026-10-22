// src/preload/preload.cjs
// CommonJS a propósito: los preload scripts de Electron son más predecibles en CJS,
// aunque el resto de la app (main) use ESM ("type": "module").
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emissary', {
  // Negocio
  getNegocio: () => ipcRenderer.invoke('negocio:get'),
  saveNegocio: (data) => ipcRenderer.invoke('negocio:save', data),
  completeSetup: () => ipcRenderer.invoke('negocio:completeSetup'),

  // WhatsApp
  getWaStatus: () => ipcRenderer.invoke('wa:getStatus'),
  logoutWa: () => ipcRenderer.invoke('wa:logout'),
  onWaStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('wa:status', listener);
    return () => ipcRenderer.removeListener('wa:status', listener);
  },

  // Catálogo
  listCatalogo: () => ipcRenderer.invoke('catalogo:list'),
  upsertCatalogoItem: (item) => ipcRenderer.invoke('catalogo:upsert', item),
  deleteCatalogoItem: (id) => ipcRenderer.invoke('catalogo:delete', id),
  scrapeCatalogo: () => ipcRenderer.invoke('catalogo:scrape'),

  // Mensajes y Flujos
  getFlujo: () => ipcRenderer.invoke('flujo:get'),
  saveFlujo: (nodes, edges) => ipcRenderer.invoke('flujo:save', { nodes, edges }),
  resetFlujoToTemplate: () => ipcRenderer.invoke('flujo:resetToTemplate'),
  startMasivo: (payload) => ipcRenderer.invoke('mensajes:startMasivo', payload),
  cancelMasivo: () => ipcRenderer.invoke('mensajes:cancelMasivo'),
  onMasivoProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('masivo:progress', listener);
    return () => ipcRenderer.removeListener('masivo:progress', listener);
  },
  onMasivoDone: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('masivo:done', listener);
    return () => ipcRenderer.removeListener('masivo:done', listener);
  },

  // Leads
  listLeads: () => ipcRenderer.invoke('leads:list'),
  updateLeadEtapa: (id, etapa) => ipcRenderer.invoke('leads:updateEtapa', { id, etapa }),
  resetSesion: (userId) => ipcRenderer.invoke('sesion:reset', userId),

  // Pausa global
  setGlobalPause: (paused) => ipcRenderer.invoke('bot:setGlobalPause', paused),
  isGloballyPaused: () => ipcRenderer.invoke('bot:isGloballyPaused'),

  // Sistema
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
});
