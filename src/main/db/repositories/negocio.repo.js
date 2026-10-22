import { getDb } from '../db.js';

export const NegocioRepo = {
  get() {
    const db = getDb();
    return db.prepare('SELECT * FROM negocio WHERE id = 1').get();
  },

  save(data) {
    const db = getDb();
    const current = this.get();
    const merged = { ...current, ...data, updated_at: Date.now() };

    for (const key in merged) {
      if (typeof merged[key] === 'boolean') merged[key] = merged[key] ? 1 : 0;
      else if (merged[key] === undefined) merged[key] = null;
    }

    db.prepare(`
      UPDATE negocio SET
        marca = @marca,
        nombre_negocio = @nombre_negocio,
        nombre_asesor = @nombre_asesor,
        cargo = @cargo,
        telefono = @telefono,
        horario = @horario,
        portfolio_url = @portfolio_url,
        scrape_url = @scrape_url,
        scrape_selector = @scrape_selector,
        color_acento = @color_acento,
        logo_path = @logo_path,
        auto_launch = @auto_launch,
        setup_completo = @setup_completo,
        tour_completo = @tour_completo,
        updated_at = @updated_at
      WHERE id = 1
    `).run(merged);

    return this.get();
  },

  markSetupComplete() {
    return this.save({ setup_completo: 1 });
  },

  isSetupComplete() {
    const row = this.get();
    return !!(row && row.setup_completo);
  },
};
