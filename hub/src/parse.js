// hub/src/parse.js
// Convierte el payload de webhook de WhatsApp Cloud API en eventos simples y neutrales al canal:
//   { type: 'message', id, from, name, text, kind, timestamp }   cliente -> negocio
//   { type: 'echo',    id, to, text, kind, timestamp }           asesor escribió desde la app del celular (Coexistence)
//   { type: 'status',  id, status, recipient, timestamp }        sent | delivered | read | failed
//
// shortcut: la forma de `message_echoes` (campo smb_message_echoes) sale de la documentación de Meta
// pero no está probada con un payload real; confirmar con la prueba de viabilidad y ajustar aquí.

function textOf(m) {
  switch (m.type) {
    case 'text': return m.text?.body || '';
    case 'button': return m.button?.text || '';
    case 'interactive': return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || '';
    default: return '';
  }
}

export function parseWebhook(body) {
  const events = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const names = new Map((v.contacts || []).map((c) => [c.wa_id, c.profile?.name || '']));

      for (const m of v.messages || []) {
        events.push({
          type: 'message', id: m.id, from: m.from, name: names.get(m.from) || '',
          text: textOf(m), kind: m.type, timestamp: Number(m.timestamp) || 0,
        });
      }
      for (const m of v.message_echoes || []) {
        events.push({
          type: 'echo', id: m.id, to: m.to, text: textOf(m), kind: m.type,
          timestamp: Number(m.timestamp) || 0,
        });
      }
      for (const s of v.statuses || []) {
        events.push({
          type: 'status', id: s.id, status: s.status, recipient: s.recipient_id,
          timestamp: Number(s.timestamp) || 0,
        });
      }
    }
  }
  return events;
}
