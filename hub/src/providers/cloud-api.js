// hub/src/providers/cloud-api.js
// Adaptador de canal para WhatsApp Cloud API (Meta directo o vía proveedor como 360dialog).
//
// Contrato de un canal (lo mismo implementará el adaptador de Baileys):
//   sendText(to, text)               -> { id }
//   sendTemplate(to, template)       -> { id }   template = { name, language, components? }
// `to` es el número en formato internacional, solo dígitos (ej. 573001234567).

const REQUEST_TIMEOUT_MS = 15000;

export class CloudApiProvider {
  constructor({ base, token, phoneNumberId, authStyle = 'bearer' }, fetchImpl = fetch) {
    if (!token) throw new Error('CLOUD_API_TOKEN es obligatorio para enviar mensajes');
    if (authStyle === 'bearer' && !phoneNumberId) throw new Error('CLOUD_PHONE_NUMBER_ID es obligatorio con Meta directo');
    this.base = base.replace(/\/$/, '');
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.authStyle = authStyle;
    this.fetch = fetchImpl;
  }

  get #url() {
    return this.authStyle === 'd360' ? `${this.base}/messages` : `${this.base}/${this.phoneNumberId}/messages`;
  }

  get #headers() {
    const auth = this.authStyle === 'd360' ? { 'D360-API-KEY': this.token } : { Authorization: `Bearer ${this.token}` };
    return { 'Content-Type': 'application/json', ...auth };
  }

  async #post(payload) {
    const res = await this.fetch(this.#url, {
      method: 'POST',
      headers: this.#headers,
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || JSON.stringify(data);
      throw new Error(`Cloud API ${res.status}: ${detail}`);
    }
    return { id: data?.messages?.[0]?.id || null };
  }

  sendText(to, text) {
    return this.#post({ to, type: 'text', text: { body: text } });
  }

  sendTemplate(to, { name, language = 'es', components }) {
    return this.#post({
      to,
      type: 'template',
      template: { name, language: { code: language }, ...(components ? { components } : {}) },
    });
  }
}
