// src/main/whatsapp/waVersion.js
// Elige la versión de WhatsApp Web con la que se identifica la conexión. Módulo puro: los consultores llegan por parámetro.
//
// WhatsApp rechaza o corta (a veces recién al escanear el QR) a los clientes con una versión vieja. Baileys trae una versión
// de respaldo que envejece con cada mes, y sus funciones de consulta NO lanzan error si falla la red: devuelven { isLatest: false }
// con esa versión vieja. Por eso se prueba con dos fuentes y se registra cuál se usó.

/**
 * @param {{ fetchWeb: () => Promise<{version:number[], isLatest:boolean}>, fetchGithub: () => Promise<{version:number[], isLatest:boolean}>, fallback: number[] }} deps
 * @returns {Promise<{ version: number[], source: 'whatsapp-web' | 'github' | 'respaldo' }>}
 */
export async function resolveWaVersion({ fetchWeb, fetchGithub, fallback }) {
  for (const [source, fetcher] of [['whatsapp-web', fetchWeb], ['github', fetchGithub]]) {
    try {
      const res = await fetcher();
      if (res?.isLatest && Array.isArray(res.version) && res.version.length === 3) return { version: res.version, source };
    } catch { /* se prueba la siguiente fuente */ }
  }
  return { version: fallback, source: 'respaldo' };
}

export const versionText = (v) => v.join('.');
