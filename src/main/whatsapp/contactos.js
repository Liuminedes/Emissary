// src/main/whatsapp/contactos.js
// Cruza los identificadores de WhatsApp: los contactos nuevos llegan como "123@lid" (id anónimo) y el teléfono solo se conoce
// cuando WhatsApp lo da (contacto guardado en el celular, número compartido o dato en el mensaje). Módulo puro.

const esLid = (jid) => typeof jid === 'string' && jid.endsWith('@lid');
const esTelefono = (jid) => typeof jid === 'string' && jid.endsWith('@s.whatsapp.net');
const digitos = (jid) => String(jid ?? '').replace(/[@:].*$/, '').replace(/\D/g, '');

// 15 dígitos es el máximo de un teléfono (E.164): un id anónimo no pasa por teléfono
const numeroValido = (jid) => { const d = digitos(jid); return esTelefono(jid) && d.length >= 8 && d.length <= 15 ? d : ''; };

/**
 * Convierte contactos de Baileys ({ id, lid, jid, name, notify }) en filas { userId, numero, nombre }.
 * Un contacto con id anónimo y teléfono genera dos filas (una por cada id con que puede llegar un chat).
 * `name` es como lo guardó el asesor en su celular; `notify` es el nombre que la persona se puso a sí misma.
 */
export function filasDeContactos(contactos = []) {
  const filas = [];
  for (const c of contactos) {
    if (!c?.id) continue;
    const lid = esLid(c.lid) ? c.lid : esLid(c.id) ? c.id : '';
    const pn = esTelefono(c.jid) ? c.jid : esTelefono(c.id) ? c.id : '';
    const numero = numeroValido(pn);
    const nombre = String(c.name || c.notify || c.verifiedName || '').trim().slice(0, 80);
    for (const userId of [lid, pn]) {
      if (userId && (numero || nombre)) filas.push({ userId, numero, nombre });
    }
  }
  return filas;
}

/** El par lid → teléfono que trae un mensaje o un aviso de "compartió su número" (sender_pn / participant_pn). */
export function filaDePar(lid, pn) {
  const numero = numeroValido(pn);
  return esLid(lid) && numero ? { userId: lid, numero, nombre: '' } : null;
}

/** Une dos filas del mismo contacto sin perder lo que ya se sabía (un dato vacío nunca borra uno lleno). */
export const unirFilas = (previa, nueva) => ({
  userId: nueva.userId,
  numero: nueva.numero || previa?.numero || '',
  nombre: nueva.nombre || previa?.nombre || '',
});

/** Cómo mostrar un contacto: nombre guardado, si no su número, y solo si no hay nada, que el número está oculto. */
export function etiquetaContacto({ nombre, numero, userId, user_id: idDeFila }) {
  const id = userId ?? idDeFila ?? ''; // las filas de la base usan user_id
  if (nombre && nombre !== id) return nombre;
  if (numero) return `+${numero}`;
  return esLid(id) ? 'Contacto sin número' : `+${digitos(id)}`;
}
