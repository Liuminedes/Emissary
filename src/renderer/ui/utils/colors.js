/**
 * Convierte un color HEX a formato HSL compatible con Tailwind
 * @param {string} hex Color en formato HEX (#RRGGBB)
 * @returns {{ h: number, s: number, l: number }} Objeto HSL
 */
export function hexToHSL(hex) {
  // Remover el hash si existe
  hex = hex.replace(/^#/, '');

  // Parsear r, g, b
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Inyecta el color de acento en el DOM como variables CSS
 * @param {string} hexColor Color HEX (ej. #FF5733)
 */
export function applyAccentColor(hexColor) {
  if (!hexColor) return;
  const { h, s, l } = hexToHSL(hexColor);
  
  // Asignamos el color principal
  document.documentElement.style.setProperty('--primary', `${h} ${s}% ${l}%`);
  // Calculamos un hover un poco más oscuro o claro
  const hoverL = l > 50 ? l - 10 : l + 10;
  document.documentElement.style.setProperty('--primary-hover', `${h} ${s}% ${hoverL}%`);
  
  // Calcular luminancia YIQ para determinar el color de texto óptimo
  const cleanHex = hexColor.replace(/^#/, '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // Si el color es percibido como claro (YIQ >= 150), texto oscuro. Si no, texto blanco.
  // Usamos un umbral de 150 (en vez del tradicional 128) para que colores fríos y medios como el morado 
  // mantengan el texto blanco (ya que estéticamente el negro sobre morado medio se ve feo).
  const fgL = (yiq >= 150) ? 10 : 98;
  
  document.documentElement.style.setProperty('--primary-foreground', `0 0% ${fgL}%`);
}
