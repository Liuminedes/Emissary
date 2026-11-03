import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { qrToDataUrl, QR_OPTIONS } from './qr.js';

// Cadena con la forma de las de WhatsApp: ref, clave pública, clave de identidad y secreto, en base64 y separadas por comas
const payload = () => ['2@' + randomBytes(70).toString('base64'), ...[32, 32, 16].map((n) => randomBytes(n).toString('base64'))].join(',');

const decodePng = (dataUrl) => PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));

// Reduce la imagen como lo hace una pantalla al mostrarla más chica (promedio por bloques)
function shrink({ data, width, height }, to) {
  const out = new Uint8ClampedArray(to * to * 4);
  for (let y = 0; y < to; y++) for (let x = 0; x < to; x++) {
    const x0 = Math.floor((x * width) / to), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / to));
    const y0 = Math.floor((y * height) / to), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / to));
    const sum = [0, 0, 0, 0]; let n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { for (let c = 0; c < 4; c++) sum[c] += data[(yy * width + xx) * 4 + c]; n++; }
    for (let c = 0; c < 4; c++) out[(y * to + x) * 4 + c] = sum[c] / n;
  }
  return out;
}

test('el QR se lee tal cual y también reducido al tamaño en que se muestra', async () => {
  const text = payload();
  const img = decodePng(await qrToDataUrl(text));
  assert.equal(jsQR(img.data, img.width, img.height)?.data, text);
  for (const size of [256, 192]) {
    assert.equal(jsQR(shrink(img, size), size, size)?.data, text, `a ${size}px`);
  }
});

test('cada módulo mide un número entero de píxeles y hay 4 de margen', () => {
  const modulos = QRCode.create(payload(), { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel }).modules.size;
  assert.equal(QR_OPTIONS.margin, 4);
  assert.equal(Number.isInteger(QR_OPTIONS.scale), true);
  assert.ok((modulos + 2 * QR_OPTIONS.margin) * QR_OPTIONS.scale < 800, 'imagen de tamaño razonable');
});
