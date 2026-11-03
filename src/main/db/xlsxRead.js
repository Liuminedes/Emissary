// src/main/db/xlsxRead.js
// Lee la primera hoja de un .xlsx y la devuelve como filas (arreglos de valores). Módulo puro: solo necesita fflate.
// shortcut: no interpreta fechas (llegan como número de serie) ni fórmulas (usa el último valor calculado); suficiente para listas de precios.
import { unzipSync, strFromU8 } from 'fflate';

const unescapeXml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
});

const textOf = (xml) => unescapeXml([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

// "AB12" -> 27 (índice de columna desde 0)
const colIndex = (ref) => [...ref.replace(/[0-9]/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const attr = (attrs, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

export function readXlsxRows(buffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const get = (p) => (files[p] ? strFromU8(files[p]) : '');

  // La primera hoja según el libro (no siempre es sheet1.xml)
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(get('xl/workbook.xml'))?.[1];
  const tag = rid && new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`).exec(get('xl/_rels/workbook.xml.rels'))?.[0];
  const target = tag && attr(tag, 'Target');
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target}`) : 'xl/worksheets/sheet1.xml';
  const sheet = get(sheetPath);
  if (!sheet) throw new Error('El archivo no parece un Excel .xlsx válido');

  const shared = [...get('xl/sharedStrings.xml').matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((m) => textOf(m[1] || ''));

  const rows = [];
  for (const row of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const cells = [];
    for (const c of (row[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r');
      const type = attr(c[1], 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(c[2] || '')?.[1];
      let value = null;
      if (type === 'inlineStr') value = textOf(c[2] || '');
      else if (raw !== undefined) {
        if (type === 's') value = shared[Number(raw)] ?? null;
        else if (type === 'str') value = unescapeXml(raw);
        else if (type === 'b') value = raw === '1';
        else if (type !== 'e') value = Number(raw);
      }
      if (ref && value !== null) cells[colIndex(ref)] = value;
    }
    const n = Number(attr(row[1], 'r')) || rows.length + 1;
    rows[n - 1] = cells;
  }
  return Array.from(rows, (r) => r || []); // filas vacías intermedias quedan como []
}
