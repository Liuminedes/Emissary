// src/main/db/repositories/catalogo.repo.js
import { getDb } from '../db.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { dirnameFromMeta } from '../../util/paths.js';

const __dirname = dirnameFromMeta(import.meta.url);

function attachVariantes(db, item) {
  const variantes = db.prepare(
    'SELECT * FROM catalogo_variantes WHERE item_id = ? ORDER BY precio ASC'
  ).all(item.id);
  return { ...item, specs: JSON.parse(item.specs_json || '{}'), variantes };
}

export const CatalogoRepo = {
  seedCatalog(marca) {
    if (!marca) return false;
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM catalogo_items').get().c;
    if (count > 0) return false; // Solo poblar si está vacío

    const filename = marca.toLowerCase() === 'volkswagen' ? 'vw.json' :
                     marca.toLowerCase() === 'jac' ? 'jac.json' :
                     marca.toLowerCase() === 'kia' ? 'kia.json' : null;
    if (!filename) return false;

    const seedPath = path.join(__dirname, '..', 'seeds', filename);
    if (!existsSync(seedPath)) return false;

    try {
      const data = JSON.parse(readFileSync(seedPath, 'utf8'));
      for (const item of data) {
        this.upsertItem(item);
      }
      return true;
    } catch (e) {
      console.error('Error seeding catalog:', e);
      return false;
    }
  },

  listAll() {
    const db = getDb();
    const items = db.prepare(
      'SELECT * FROM catalogo_items WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    ).all();
    return items.map((it) => attachVariantes(db, it));
  },

  getById(id) {
    const db = getDb();
    const item = db.prepare('SELECT * FROM catalogo_items WHERE id = ?').get(id);
    return item ? attachVariantes(db, item) : null;
  },

  upsertItem(item) {
    const db = getDb();
    const specs_json = JSON.stringify(item.specs || {});

    let itemId = item.id;
    if (itemId) {
      db.prepare(`
        UPDATE catalogo_items SET
          categoria = @categoria, nombre = @nombre, emoji = @emoji,
          descripcion = @descripcion, specs_json = @specs_json,
          sort_order = @sort_order, active = @active
        WHERE id = @id
      `).run({ ...item, specs_json, id: itemId });
    } else {
      const info = db.prepare(`
        INSERT INTO catalogo_items (categoria, nombre, emoji, descripcion, specs_json, sort_order, active)
        VALUES (@categoria, @nombre, @emoji, @descripcion, @specs_json, @sort_order, 1)
      `).run({ ...item, specs_json, sort_order: item.sort_order || 0 });
      itemId = info.lastInsertRowid;
    }

    // Reemplazar variantes completas (simple, suficiente para el editor)
    db.prepare('DELETE FROM catalogo_variantes WHERE item_id = ?').run(itemId);
    const insertVar = db.prepare(`
      INSERT INTO catalogo_variantes (item_id, version, precio, bono, nota, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const v of item.variantes || []) {
      insertVar.run(itemId, v.version, v.precio || 0, v.bono || 0, v.nota || '', v.year || 0);
    }

    return this.getById(itemId);
  },

  // Actualiza el precio de los ítems cuyo nombre coincide con el scrapeado y que tienen una sola variante.
  // shortcut: ítems con varias variantes se omiten (no hay forma de saber cuál precio es cuál), cuando haga falta, mapear por versión.
  applyScrapedPrices(scraped) {
    const db = getDb();
    const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const byName = new Map(scraped.filter((s) => s.precio > 0).map((s) => [norm(s.nombre), s.precio]));
    let actualizados = 0;
    for (const item of this.listAll()) {
      const precio = byName.get(norm(item.nombre));
      if (precio && item.variantes.length === 1 && item.variantes[0].precio !== precio) {
        db.prepare('UPDATE catalogo_variantes SET precio = ? WHERE id = ?').run(precio, item.variantes[0].id);
        actualizados++;
      }
    }
    return actualizados;
  },

  clearAll() {
    getDb().prepare('DELETE FROM catalogo_items').run(); // las variantes caen en cascada
  },

  deleteItem(id) {
    const db = getDb();
    db.prepare('DELETE FROM catalogo_items WHERE id = ?').run(id);
  },

  getCategories() {
    const items = this.listAll();
    const map = {};
    for (const it of items) map[it.categoria] = (map[it.categoria] || 0) + 1;
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  },
};
