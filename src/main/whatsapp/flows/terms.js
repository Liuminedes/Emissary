// src/main/whatsapp/flows/terms.js
// Palabras con las que el bot y la pantalla de Catálogo hablan del catálogo según el tipo de negocio (plantilla elegida).
// Módulo puro: lo usan el motor, los mensajes y la interfaz.

const VEHICULOS = {
  uno: 'vehículo', varios: 'vehículos', otros: 'otros vehículos', emoji: '🚗',
  categoria: 'tipo de vehículo', quiero: 'Cotizar este vehículo 💰', verbo: 'cotizar',
  anotado: (nombre) => `Perfecto, anotado! Te cotizo el *${nombre}* 🚗💨`,
  porPresupuesto: true, // la búsqueda por presupuesto interpreta "80 millones", útil con precios altos
  ui: {
    subtitulo: 'Gestiona tu flota, modelos y precios dinámicos',
    agregar: 'Añadir Vehículo', buscar: 'Buscar por modelo, versión o categoría...',
    vacioTitulo: 'No hay vehículos registrados.', vacioHint: 'Añade tu primer vehículo para que el bot pueda ofrecerlo.',
    variantes: 'Versiones', eliminar: 'Eliminar vehículo', editar: 'Editar Vehículo', nuevo: 'Registrar Nuevo Vehículo',
    nombre: 'Nombre del Vehículo', nombreEj: 'Ej: Volkswagen Taos', descEj: 'Ej: La SUV más tecnológica del segmento...',
    variantesYPrecios: 'Versiones y Precios', agregarVariante: 'Añadir Versión', nombreVariante: 'Nombre de Versión',
    varianteEj: 'Ej: Comfortline AT', bono: 'Bono', bonoLabel: 'Bono Descuento ($)', guardar: 'Guardar Vehículo',
  },
};

const PRODUCTOS = {
  uno: 'producto', varios: 'productos', otros: 'otros productos', emoji: '🛍️',
  categoria: 'categoría', quiero: 'Me interesa este producto 💰', verbo: 'continuar',
  anotado: (nombre) => `Perfecto, anotado! *${nombre}* 🛍️`,
  porPresupuesto: false,
  ui: {
    subtitulo: 'Gestiona tus productos y precios',
    agregar: 'Añadir producto', buscar: 'Buscar por nombre o categoría...',
    vacioTitulo: 'No hay productos registrados.', vacioHint: 'Añade tu primer producto para que el bot pueda ofrecerlo.',
    variantes: 'Opciones', eliminar: 'Eliminar producto', editar: 'Editar producto', nuevo: 'Registrar nuevo producto',
    nombre: 'Nombre del producto', nombreEj: 'Ej: Camiseta básica', descEj: 'Ej: Algodón 100 %, disponible en varios colores...',
    variantesYPrecios: 'Opciones y precios', agregarVariante: 'Añadir opción', nombreVariante: 'Nombre de la opción',
    varianteEj: 'Ej: Talla M', bono: 'Descuento', bonoLabel: 'Descuento ($)', guardar: 'Guardar producto',
  },
};

const RESTAURANTE = {
  ...PRODUCTOS, emoji: '🍽️', quiero: 'Pedir este producto 🛵', verbo: 'pedirlo',
  anotado: (nombre) => `Perfecto, anotado! Pedimos *${nombre}* 🍽️`,
  ui: {
    ...PRODUCTOS.ui,
    subtitulo: 'Gestiona tu carta y tus precios',
    nombreEj: 'Ej: Smash Doble', descEj: 'Ej: Doble carne, queso cheddar y salsa de la casa...',
    variantes: 'Presentaciones', variantesYPrecios: 'Presentaciones y precios', agregarVariante: 'Añadir presentación',
    nombreVariante: 'Nombre de la presentación', varianteEj: 'Ej: Combo grande',
  },
};

const DE_VEHICULOS = ['Nuevos', 'Usados', 'Volkswagen', 'KIA', 'JAC'];
const DE_COMIDA = ['Restaurante', 'Gastronomia', 'IvyOS'];

export function catalogTerms(marca) {
  if (DE_VEHICULOS.includes(marca)) return VEHICULOS;
  if (DE_COMIDA.includes(marca)) return RESTAURANTE;
  return PRODUCTOS; // "En blanco" o sin elegir: palabras neutras
}
