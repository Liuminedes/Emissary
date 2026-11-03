// Tema claro/oscuro: respeta la preferencia guardada; sin preferencia arranca en claro (no sigue al sistema).
const KEY = 'emissary-theme';

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function initTheme() {
  const saved = read();
  applyTheme(saved === 'dark' ? 'dark' : 'light');
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* sin almacenamiento: se aplica solo a esta sesión */ }
  applyTheme(theme);
}
