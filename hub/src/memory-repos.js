// hub/src/memory-repos.js
// Repositorios en memoria con la misma interfaz que los de SQLite (los que usa createEngine).
// shortcut: todo se pierde al reiniciar el Hub y sirve a un solo negocio. Reemplazar por Postgres
// con tenant_id cuando se construya el multi-cliente.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getFlowTemplate } from '../../src/main/whatsapp/flows/defaultFlow.js';

const SEEDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/main/db/seeds');
const SEED_FILES = { volkswagen: 'vw.json', kia: 'kia.json', jac: 'jac.json' };

function loadCatalog(marca) {
  const file = SEED_FILES[String(marca || '').toLowerCase()];
  const full = file && path.join(SEEDS_DIR, file);
  if (!full || !existsSync(full)) return [];
  return JSON.parse(readFileSync(full, 'utf8')).map((item, i) => ({
    ...item,
    id: i + 1,
    sort_order: item.sort_order || i,
    variantes: (item.variantes || []).map((v, j) => ({ id: (i + 1) * 1000 + j, ...v })).sort((a, b) => a.precio - b.precio),
  }));
}

const ETAPAS = ['nuevo', 'cotizando', 'negociacion', 'cerrado', 'perdido'];

export function createMemoryRepos(negocio) {
  const sessions = new Map();
  const leads = new Map(); // userId -> lead
  const catalog = loadCatalog(negocio.marca);
  const flow = getFlowTemplate(negocio.marca);
  let paused = false;

  return {
    NegocioRepo: { get: () => negocio },

    SesionesRepo: {
      isGloballyPaused: () => paused,
      isExcluded: () => false,
      get: (userId) => structuredClone(sessions.get(userId)) || {
        userId, step: 'WELCOME', pushName: '', advisorTook: false, handoffMode: false,
        lead: {}, catalog: {}, createdAt: Date.now(), updatedAt: Date.now(),
      },
      save: (s) => { s.updatedAt = Date.now(); sessions.set(s.userId, structuredClone(s)); return s; },
    },

    LeadsRepo: {
      upsert: (lead) => {
        const prev = leads.get(lead.userId) || { etapa: 'nuevo', createdAt: Date.now() };
        const next = { ...prev, ...Object.fromEntries(Object.entries(lead).filter(([, v]) => v)) };
        leads.set(lead.userId, next);
        return next;
      },
      updateEtapaByUserId: (userId, etapa) => {
        const l = leads.get(userId);
        if (l && ETAPAS.indexOf(etapa) > ETAPAS.indexOf(l.etapa)) l.etapa = etapa;
      },
    },

    FlujoRepo: { getFlow: () => flow },

    CatalogoRepo: {
      listAll: () => catalog,
      getCategories: () => {
        const count = {};
        for (const it of catalog) count[it.categoria] = (count[it.categoria] || 0) + 1;
        return Object.entries(count).map(([name, n]) => ({ name, count: n }));
      },
    },
  };
}
