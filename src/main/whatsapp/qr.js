// src/main/whatsapp/qr.js
// Imagen del QR de vinculación. Módulo puro (sin Electron ni Baileys) para poder probar que se puede leer.
import QRCode from 'qrcode';

// Negro puro sobre blanco, 4 módulos de margen (lo que pide el estándar) y cada módulo de un número entero de píxeles:
// los lectores de iPhone son más exigentes que los de Android con QR chicos, borrosos o con poco margen.
export const QR_OPTIONS = { margin: 4, scale: 8, errorCorrectionLevel: 'L', color: { dark: '#000000', light: '#ffffff' } };

export const qrToDataUrl = (text) => QRCode.toDataURL(text, QR_OPTIONS);
