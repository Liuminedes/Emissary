// hub/src/db/tenants.js
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getFlowTemplate } from '../../../src/main/whatsapp/flows/defaultFlow.js';
import { createTenantRepos } from './repos.js';

const SEEDS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../src/main/db/seeds');
const SEED_FILES = { volkswagen: 'vw.json', kia: 'kia.json', jac: 'jac.json' };

const CAMPOS = ['phone_number_id', 'marca', 'nombre_negocio', 'nombre_asesor', 'cargo', 'telefono', 'horario', 'portfolio_url'];

export function createTenant(db, { slug, ...datos }) {
  if (!slug) throw new Error('slug obligatorio');
  const v = Object.fromEntries(CAMPOS.map((k) => [k, datos[k] || null]));
  const info = db.prepare(`
    INSERT INTO tenants (slug, phone_number_id, marca, nombre_negocio, nombre_asesor, cargo, telefono, horario, portfolio_url, created_at)
    VALUES (@slug, @phone_number_id, @marca, @nombre_negocio, @nombre_asesor, @cargo, @telefono, @horario, @portfolio_url, @now)
  `).run({
    slug,
    phone_number_id: v.phone_number_id,
    marca: v.marca || '',
    nombre_negocio: v.nombre_negocio || '',
    nombre_asesor: v.nombre_asesor || '',
    cargo: v.cargo || 'Asesor comercial',
    telefono: v.telefono || '',
    horario: v.horario || 'L-V 8am-6pm',
    portfolio_url: v.portfolio_url || '',
    now: Date.now(),
  });
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(info.lastInsertRowid);
  seedTenant(db, tenant);
  return tenant;
}

// Flujo de la marca y catálogo de los seeds
function seedTenant(db, tenant) {
  const repos = createTenantRepos(db, tenant.id);
  const template = getFlowTemplate(tenant.marca);
  repos.FlujoRepo.saveFlow(template.nodes, template.edges);

  const file = SEED_FILES[String(tenant.marca).toLowerCase()];
  const full = file && path.join(SEEDS_DIR, file);
  if (full && existsSync(full)) {
    JSON.parse(readFileSync(full, 'utf8')).forEach((item, i) => repos.CatalogoRepo.upsertItem({ ...item, sort_order: item.sort_order ?? i }));
  }
}

export const findTenantByPhoneNumberId = (db, id) =>
  (id ? db.prepare('SELECT * FROM tenants WHERE phone_number_id = ?').get(String(id)) : undefined);

export const listTenants = (db) => db.prepare('SELECT * FROM tenants ORDER BY id').all();

// Modo un-solo-negocio: crea el tenant "default" a partir de variables de entorno si aún no existe
export function ensureDefaultTenant(db, business, phoneNumberId) {
  return db.prepare("SELECT * FROM tenants WHERE slug = 'default'").get()
    || createTenant(db, { slug: 'default', ...business, phone_number_id: phoneNumberId || null });
}
