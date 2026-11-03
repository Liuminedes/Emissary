// src/main/db/catalogImport.js
// Importar un catálogo desde las filas de un Excel: detecta las columnas, agrupa por modelo y calcula qué cambiaría.
// Módulo puro (sin Electron ni SQLite): recibe el catálogo actual y devuelve lo que hay que guardar.

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Nombres de columna aceptados, en orden de prioridad (por eso "venta sugerido" gana a "precio lista")
const COLS = {
  modelo: ['modelo', 'linea', 'producto', 'nombre', 'referencia'],
  version: ['version'],
  year: ['ano modelo', 'ano'],
  precio: ['venta sugerido', 'precio venta', 'precio de venta', 'pvp', 'precio'],
  nota: ['accion adicional', 'nota', 'promocion', 'observacion'],
  categoria: ['categoria', 'segmento', 'tipo'],
};

function findColumn(heads, names) {
  for (const n of names) {
    let i = heads.indexOf(n);
    if (i < 0) i = heads.findIndex((h) => h && ` ${h} `.includes(` ${n} `));
    if (i >= 0) return i;
  }
  return -1;
}

function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const heads = (rows[r] || []).map(norm);
    const cols = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, findColumn(heads, names)]));
    if (cols.modelo >= 0 && cols.version >= 0 && cols.precio >= 0) return { row: r, cols, heads: rows[r] };
  }
  return null;
}

// shortcut: se leen solo los dígitos ("$ 59.990.000" -> 59990000); no soporta decimales, que en precios de este tipo no se usan
function parsePrice(v) {
  if (typeof v === 'number') return Math.round(v);
  return Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;
}

const SECCIONES = { ice: 'Gasolina', gasolina: 'Gasolina', electrico: 'Eléctrico', electricos: 'Eléctrico', hibrido: 'Híbrido', hibridos: 'Híbrido', diesel: 'Diésel' };
function categoriaDe(seccion, modelo, version) {
  if (/\bhev\b|hibrid/i.test(`${modelo} ${version}`)) return 'Híbrido';
  return SECCIONES[norm(seccion)] || clean(seccion) || 'General';
}

/** Filas del Excel -> { items, omitidas, columnas } o { error } */
export function parseCatalogRows(rows) {
  const header = findHeader(rows || []);
  if (!header) return { error: 'No encontré las columnas Modelo, Versión y Precio. Revisa que la primera hoja las tenga en una fila de títulos.' };
  const { cols } = header;
  const items = new Map();
  const omitidas = [];
  let seccion = '';
  let duplicadas = 0;

  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const modelo = clean(row[cols.modelo]);
    if (!modelo) continue;
    const version = clean(row[cols.version]);
    const precio = parsePrice(row[cols.precio]);
    if (!version && !precio) { seccion = modelo; continue; } // fila de título de sección ("Eléctrico", "Taxis"…)
    if (!version) { omitidas.push({ fila: r + 1, modelo, motivo: 'No tiene versión' }); continue; }
    if (precio <= 0) { omitidas.push({ fila: r + 1, modelo, version, motivo: 'No tiene precio' }); continue; }

    const year = cols.year >= 0 && /^\d{4}$/.test(clean(row[cols.year])) ? Number(clean(row[cols.year])) : 0;
    const categoria = (cols.categoria >= 0 && clean(row[cols.categoria])) || categoriaDe(seccion, modelo, version);
    const key = norm(modelo);
    if (!items.has(key)) items.set(key, { nombre: modelo, categoria, variantes: [] });
    const item = items.get(key);
    const variante = { version, year, precio, nota: cols.nota >= 0 ? clean(row[cols.nota]) : '' };
    const dup = item.variantes.findIndex((v) => vkey(v) === vkey(variante));
    if (dup >= 0) { item.variantes[dup] = variante; duplicadas++; } else item.variantes.push(variante);
  }

  const nombre = (i) => (i >= 0 && header.heads[i]) || '';
  return {
    items: [...items.values()],
    omitidas,
    duplicadas,
    columnas: { modelo: nombre(cols.modelo), version: nombre(cols.version), precio: nombre(cols.precio), year: nombre(cols.year), nota: nombre(cols.nota) },
  };
}

const vkey = (v) => `${norm(v.version)}|${Number(v.year) || 0}`;

/** Compara lo importado con el catálogo actual. Los modelos se emparejan por nombre y las versiones por nombre + año. */
export function planImport(current, parsed) {
  const byName = new Map(current.map((it) => [norm(it.nombre), it]));
  const seen = new Set();
  const cambios = [];
  const ops = []; // { item, ausentes } listos para guardar
  let sinCambios = 0;
  let orden = Math.max(0, ...current.map((it) => it.sort_order || 0));

  for (const nuevo of parsed.items) {
    const actual = byName.get(norm(nuevo.nombre));
    if (!actual) {
      for (const v of nuevo.variantes) cambios.push({ tipo: 'nueva', modelo: nuevo.nombre, version: v.version, year: v.year, precio: v.precio });
      ops.push({ item: { categoria: nuevo.categoria, nombre: nuevo.nombre, emoji: '', descripcion: '', specs: {}, sort_order: ++orden, variantes: nuevo.variantes.map((v) => ({ ...v, bono: 0 })) }, ausentes: [] });
      continue;
    }
    seen.add(actual.id);
    const previas = new Map(actual.variantes.map((v) => [vkey(v), v]));
    const variantes = [];
    for (const v of nuevo.variantes) {
      const vieja = previas.get(vkey(v));
      previas.delete(vkey(v));
      if (!vieja) {
        cambios.push({ tipo: 'nueva', modelo: actual.nombre, version: v.version, year: v.year, precio: v.precio });
        variantes.push({ ...v, bono: 0 });
      // El precio de venta sugerido ya incluye el bono: si había un bono aparte se quita para no descontarlo dos veces
      } else if (vieja.precio !== v.precio || Number(vieja.bono) > 0 || (v.nota && vieja.nota !== v.nota)) {
        if (vieja.precio !== v.precio) cambios.push({ tipo: 'precio', modelo: actual.nombre, version: vieja.version, year: v.year, antes: vieja.precio, precio: v.precio });
        variantes.push({ ...vieja, precio: v.precio, bono: 0, nota: v.nota || vieja.nota });
      } else {
        sinCambios++;
        variantes.push(vieja);
      }
    }
    ops.push({ item: { ...actual, variantes }, ausentes: [...previas.values()] });
  }

  const ausentes = [
    ...ops.flatMap((o) => o.ausentes.map((v) => ({ modelo: o.item.nombre, version: v.version }))),
    ...current.filter((it) => !seen.has(it.id)).flatMap((it) => it.variantes.map((v) => ({ modelo: it.nombre, version: v.version, modeloCompleto: true }))),
  ];
  const sinArchivo = current.filter((it) => !seen.has(it.id));

  return {
    resumen: {
      modelos: parsed.items.length,
      nuevas: cambios.filter((c) => c.tipo === 'nueva').length,
      actualizadas: cambios.filter((c) => c.tipo === 'precio').length,
      sinCambios,
      ausentes: ausentes.length,
    },
    cambios,
    ausentes,
    ops,
    sinArchivo,
  };
}

/** Lo que hay que guardar. Con quitarAusentes se descartan las versiones y los modelos que no vienen en el archivo. */
export function buildOps(plan, quitarAusentes = false) {
  const out = plan.ops.map(({ item, ausentes }) => ({
    ...item,
    variantes: quitarAusentes ? item.variantes : [...item.variantes, ...ausentes],
  }));
  if (quitarAusentes) for (const it of plan.sinArchivo) out.push({ ...it, active: 0 }); // se desactivan, no se borran
  return out;
}
