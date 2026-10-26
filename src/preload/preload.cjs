// src/preload/preload.cjs
// CommonJS a propósito: los preload scripts de Electron son más predecibles en CJS,
// aunque el resto de la app (main) use ESM ("type": "module").
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emissary', {
  // Negocio
  getNegocio: () => ipcRenderer.invoke('negocio:get'),
  saveNegocio: (data) => ipcRenderer.invoke('negocio:save', data),
  applyBrand: (marca, ejemplo) => ipcRenderer.invoke('negocio:applyBrand', { marca, ejemplo }),

  // Sesión y usuarios
  authStatus: () => ipcRenderer.invoke('auth:status'),
  authSetup: (password) => ipcRenderer.invoke('auth:setup', { password }),
  authLogin: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  listUsers: () => ipcRenderer.invoke('auth:users'),
  createUser: (data) => ipcRenderer.invoke('auth:createUser', data),
  resetUserPassword: (id, password) => ipcRenderer.invoke('auth:resetPassword', { id, password }),
  deleteUser: (id) => ipcRenderer.invoke('auth:deleteUser', { id }),
  changePassword: (actual, nueva) => ipcRenderer.invoke('auth:changePassword', { actual, nueva }),

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

  // Inbox
  listConversations: () => ipcRenderer.invoke('inbox:list'),
  getConversation: (userId) => ipcRenderer.invoke('inbox:messages', userId),
  takeControl: (userId) => ipcRenderer.invoke('inbox:take', userId),
  releaseControl: (userId) => ipcRenderer.invoke('inbox:release', userId),
  sendInbox: (userId, text) => ipcRenderer.invoke('inbox:send', { userId, text }),
  onInboxUpdated: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('inbox:updated', listener);
    return () => ipcRenderer.removeListener('inbox:updated', listener);
  },

  // Leads
  listLeads: () => ipcRenderer.invoke('leads:list'),
  listLeadNotes: (leadId) => ipcRenderer.invoke('leads:notes', leadId),
  addLeadNote: (leadId, texto) => ipcRenderer.invoke('leads:addNote', { leadId, texto }),
  deleteLeadNote: (id) => ipcRenderer.invoke('leads:deleteNote', id),
  exportLeadsCsv: () => ipcRenderer.invoke('leads:exportCsv'),
  getMetricas: () => ipcRenderer.invoke('metricas:get'),
  updateLeadEtapa: (id, etapa) => ipcRenderer.invoke('leads:updateEtapa', { id, etapa }),
  resetSesion: (userId) => ipcRenderer.invoke('sesion:reset', userId),

  // Pausa global
  setGlobalPause: (paused) => ipcRenderer.invoke('bot:setGlobalPause', paused),
  isGloballyPaused: () => ipcRenderer.invoke('bot:isGloballyPaused'),

  // Soporte
  openLogs: () => ipcRenderer.invoke('app:openLogs'),
  logError: (mensaje) => ipcRenderer.invoke('log:renderer', String(mensaje)),

  // Sistema
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
});
