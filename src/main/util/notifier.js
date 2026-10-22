import { Notification } from 'electron';
import path from 'path';
import { dirnameFromMeta } from './paths.js';
import { getDb } from '../db/db.js';

const __dirname = dirnameFromMeta(import.meta.url);

export function sendHandoffNotification(userId, fallbackName = 'Un prospecto') {
  if (Notification.isSupported()) {
    const iconPath = path.join(__dirname, '../../renderer/assets/logo.png');
    
    // Look up the lead to get its CRM Score (calificacion)
    let lead = null;
    try {
      const db = getDb();
      lead = db.prepare('SELECT nombre, calificacion FROM leads WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    } catch (e) {
      // Ignorar si db no está inicializada o error
    }

    const clientName = lead?.nombre || fallbackName;
    const score = lead?.calificacion || '❄️ Frío';
    const title = score.includes('Caliente') ? `🔥 Lead Caliente: ${clientName}` : 
                  score.includes('Tibio') ? `🟡 Lead Tibio: ${clientName}` : 
                  `❄️ Lead Frío: ${clientName}`;

    new Notification({
      title: title,
      body: `${clientName} está solicitando hablar con un asesor.`,
      icon: iconPath,
      urgency: 'critical'
    }).show();
  }
}
