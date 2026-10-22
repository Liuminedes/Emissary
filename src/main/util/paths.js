// src/main/util/paths.js
import { fileURLToPath } from 'url';
import path from 'path';
import { app } from 'electron';

export function dirnameFromMeta(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl));
}

// Carpeta de datos persistentes del usuario (fuera del instalador, sobrevive updates)
export function userDataPath(...segments) {
  return path.join(app.getPath('userData'), ...segments);
}

export const AUTH_DIR = () => userDataPath('wa-auth');
export const DB_FILE = () => userDataPath('emissary.db');
export const UPLOADS_DIR = () => userDataPath('uploads');
