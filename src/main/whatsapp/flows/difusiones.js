// src/main/whatsapp/flows/difusiones.js
// Mensajes sugeridos para las difusiones según el tipo de negocio (la plantilla elegida en la configuración).
// Módulo puro. {nombre} lo reemplaza el envío por cada contacto; {negocio} y {asesor} se llenan al cargar la plantilla.

const T = (id, label, texto) => ({ id, label, texto });

const NUEVOS = [
  T('bienvenida', 'Primer contacto', '¡Hola {nombre}! Soy {asesor} de {negocio}. Te escribo porque pediste información sobre uno de nuestros vehículos nuevos. ¿Te comparto las versiones y los precios disponibles?'),
  T('promo', 'Lista de precios del mes', 'Hola {nombre}, en {negocio} ya tenemos la lista de precios del mes con bonos y promociones en vehículos nuevos. ¿Quieres que te cuente cuáles aplican para ti? Responde SÍ y te atiendo. Si prefieres no recibir más mensajes, avísame y no te escribo más.'),
  T('seguimiento', 'Seguimiento de cotización', 'Hola {nombre}, soy {asesor} de {negocio}. Quería saber si pudiste revisar la cotización que te compartí. ¿Tienes alguna duda o quieres agendar una visita?'),
];

const USADOS = [
  T('bienvenida', 'Primer contacto', '¡Hola {nombre}! Soy {asesor} de {negocio}. Te escribo porque pediste información sobre uno de nuestros vehículos usados. ¿Te envío fotos, kilometraje y precio de los que tenemos disponibles?'),
  T('ingresos', 'Nuevos ingresos', 'Hola {nombre}, en {negocio} acaban de llegar nuevos vehículos usados. ¿Buscas alguna marca o presupuesto en particular? Respóndeme y te muestro las opciones. Si prefieres no recibir más mensajes, avísame y no te escribo más.'),
  T('retoma', 'Retoma y financiación', 'Hola {nombre}, soy {asesor} de {negocio}. Si estás pensando en cambiar de carro, podemos valorar el tuyo como parte de pago y mirar opciones de financiación. ¿Te cuento cómo funciona?'),
];

const RESTAURANTE = [
  T('bienvenida', 'Bienvenida con la carta', '¡Hola {nombre}! Somos {negocio}. Gracias por escribirnos: cuando quieras te mando la carta del día y tomamos tu pedido por aquí.'),
  T('promo', 'Promoción del día', 'Hola {nombre}, hoy en {negocio} tenemos una promoción especial. ¿Te cuento cuál es y te tomo el pedido? Si prefieres no recibir más mensajes, avísanos y no te escribimos más.'),
  T('reactivacion', 'Volver a visitarnos', 'Hola {nombre}, en {negocio} te extrañamos. ¿Te provoca algo hoy? Escríbenos y te atendemos de una vez.'),
];

const GENERAL = [
  T('bienvenida', 'Primer contacto', '¡Hola {nombre}! Soy {asesor} de {negocio}. Te escribo porque pediste información con nosotros. ¿En qué te puedo ayudar?'),
  T('seguimiento', 'Seguimiento', 'Hola {nombre}, soy {asesor} de {negocio}. Quería saber si pudiste revisar la información que te compartimos. ¿Tienes alguna duda?'),
  T('novedad', 'Novedad o promoción', 'Hola {nombre}, en {negocio} tenemos novedades que pueden interesarte. ¿Te cuento? Si prefieres no recibir más mensajes, avísame y no te escribo más.'),
];

const POR_MARCA = { Nuevos: NUEVOS, Volkswagen: NUEVOS, KIA: NUEVOS, JAC: NUEVOS, Usados: USADOS, Restaurante: RESTAURANTE };

/** Plantillas sugeridas para el tipo de negocio; las marcas sin plantilla propia (p. ej. «En blanco») usan las generales. */
export const difusionTemplates = (marca) => POR_MARCA[marca] || GENERAL;

/** Llena los datos del negocio y deja {nombre} para que lo reemplace cada envío. */
export function fillDifusion(texto, { negocio, asesor } = {}) {
  return texto
    .replaceAll('{negocio}', negocio?.trim() || 'nuestro negocio')
    .replaceAll('{asesor}', asesor?.trim() || 'tu asesor');
}
