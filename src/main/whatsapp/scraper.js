// src/main/whatsapp/scraper.js
// Scraping bajo demanda (botón "Actualizar precios"), no corre en background.
// Genérico: el negocio configura una URL y un selector CSS; se espera una tabla
// o lista de elementos con nombre y precio. Este es un punto de partida —
// cada negocio probablemente necesita un pequeño ajuste de selectores.
import * as cheerio from 'cheerio';
import { NegocioRepo } from '../db/repositories/negocio.repo.js';

export async function scrapePrices() {
  const negocio = NegocioRepo.get();
  if (!negocio.scrape_url) {
    return { ok: false, error: 'No hay una URL de scraping configurada en Ajustes.' };
  }

  try {
    if (!/^https?:\/\//i.test(negocio.scrape_url)) throw new Error('La URL debe empezar con http:// o https://');
    const res = await fetch(negocio.scrape_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Emissary/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const selector = negocio.scrape_selector || '[data-item]';
    const found = [];

    $(selector).each((_, el) => {
      const nombre = $(el).find('[data-nombre]').first().text().trim()
        || $(el).attr('data-nombre')
        || $(el).text().trim().slice(0, 80);
      const precioRaw = $(el).find('[data-precio]').first().text().trim()
        || $(el).attr('data-precio') || '';
      const precio = parseFloat(precioRaw.replace(/[^\d.]/g, ''));
      if (nombre) found.push({ nombre, precio: Number.isFinite(precio) ? precio : 0 });
    });

    return { ok: true, count: found.length, items: found };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
