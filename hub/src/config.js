// hub/src/config.js
// Toda la configuración sale de variables de entorno. Falla al arrancar si falta algo de seguridad.

export function loadConfig(env = process.env) {
  const cfg = {
    port: Number(env.PORT) || 3000,
    verifyToken: env.WEBHOOK_VERIFY_TOKEN || '',
    // Meta firma cada POST con el app secret. Algunos proveedores (BSP) no firman: usan un token propio.
    appSecret: env.META_APP_SECRET || '',
    webhookToken: env.WEBHOOK_TOKEN || '',
    cloud: {
      // Meta directo: https://graph.facebook.com/v21.0 | 360dialog: https://waba-v2.360dialog.io
      base: env.CLOUD_API_BASE || 'https://graph.facebook.com/v21.0',
      token: env.CLOUD_API_TOKEN || '',
      phoneNumberId: env.CLOUD_PHONE_NUMBER_ID || '',
      // 'bearer' (Meta) | 'd360' (header D360-API-KEY)
      authStyle: env.CLOUD_AUTH_STYLE || 'bearer',
    },
    // Datos del negocio que el motor interpola en los mensajes ({asesor}, {negocio}, {horario}…)
    business: {
      marca: env.BUSINESS_BRAND || '', // Volkswagen | KIA | JAC | vacío = sin catálogo
      nombre_negocio: env.BUSINESS_NAME || '',
      nombre_asesor: env.ADVISOR_NAME || '',
      cargo: env.ADVISOR_ROLE || 'Asesor comercial',
      horario: env.BUSINESS_HOURS || 'L-V 8am-6pm',
      portfolio_url: env.PORTFOLIO_URL || '',
      telefono: (env.ADVISOR_PHONE || '').replace(/\D/g, ''),
    },
  };

  const errors = [];
  if (!cfg.verifyToken) errors.push('WEBHOOK_VERIFY_TOKEN es obligatorio');
  if (!cfg.appSecret && !cfg.webhookToken) errors.push('Define META_APP_SECRET o WEBHOOK_TOKEN: el webhook no puede quedar sin autenticar');
  if (!['bearer', 'd360'].includes(cfg.cloud.authStyle)) errors.push('CLOUD_AUTH_STYLE debe ser bearer o d360');
  if (errors.length) throw new Error(`Configuración inválida:\n- ${errors.join('\n- ')}`);
  return cfg;
}
