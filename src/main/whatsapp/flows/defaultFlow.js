// src/main/whatsapp/flows/defaultFlow.js
// Flujos por defecto para las distintas marcas

const BLANCO_NODES = [
  {
    id: 'welcome', type: 'messageNode', position: { x: 250, y: 300 },
    data: {
      label: 'Bienvenida',
      value: '👋 Hola, cómo estás? Te habla *{asesor}* 😊\n\n¿En qué te puedo ayudar hoy?',
      options: []
    }
  }
];
const BLANCO_EDGES = [];

const VOLKSWAGEN_NODES = [
  {
    id: 'welcome', type: 'messageNode', position: { x: 250, y: 300 },
    data: {
      label: 'Bienvenida y Menú',
      value: '👋 Hola, cómo estás? Te habla *{asesor}* 😊\n\nCuéntame, ¿qué necesitas hoy? 👇\n\n*1️⃣* 🚗 Ver el catálogo\n*2️⃣* 💰 Cotizar un vehículo\n*3️⃣* 💳 Opciones de financiación\n*4️⃣* 💬 Hablar directamente conmigo',
      options: [
        { id: 'opt_menu_1', keyword: '1' },
        { id: 'opt_menu_2', keyword: '2' },
        { id: 'opt_menu_3', keyword: '3' },
        { id: 'opt_menu_4', keyword: '4' }
      ]
    }
  },
  {
    id: 'catalogIntro', type: 'messageNode', position: { x: 850, y: -100 },
    data: { label: 'Catálogo', value: '{{catalogo}}', options: [] }
  },
  {
    id: 'askInterest', type: 'messageNode', position: { x: 850, y: 150 },
    data: { label: 'Preguntar Interés', value: 'Perfecto! 🙌 Dime el modelo en el que muestras interés', options: [] }
  },
  {
    id: 'askBudget', type: 'messageNode', position: { x: 1250, y: 150 },
    data: { label: 'Presupuesto', value: 'Para orientarte mejor, con qué presupuesto cuentas? 💵\n\n*1️⃣* Hasta $90M\n*2️⃣* $90M – $150M\n*3️⃣* $150M – $220M\n*4️⃣* Más de $220M', options: [] }
  },
  {
    id: 'askEmployment', type: 'messageNode', position: { x: 1650, y: 150 },
    data: { label: 'Actividad Laboral', value: 'Y cuál es tu actividad laboral? 💼\n\n*1️⃣* Empleado\n*2️⃣* Independiente\n*3️⃣* Pensionado', options: [] }
  },
  {
    id: 'askIncome', type: 'messageNode', position: { x: 2050, y: 150 },
    data: { label: 'Ingresos', value: 'Perfecto! Y cuánto son tus ingresos mensuales aproximadamente? 📊', options: [] }
  },
  {
    id: 'askCreditCheck', type: 'messageNode', position: { x: 2450, y: 150 },
    data: { label: 'Centrales', value: 'Cómo estás en centrales de riesgo? Esto nos ayuda a buscar la mejor opción de crédito 🏦\n\n*1️⃣* ✅ Sin reportes\n*2️⃣* ⚠️ Con reportes', options: [] }
  },
  {
    id: 'askLeadName', type: 'messageNode', position: { x: 2850, y: 150 },
    data: { label: 'Nombre', value: 'Ya casi! Cuál es tu nombre completo? ✍️', options: [] }
  },
  {
    id: 'askLeadPhone', type: 'messageNode', position: { x: 3250, y: 150 },
    data: { label: 'Teléfono', value: 'Y a qué número te puedo contactar? 📱', options: [] }
  },
  {
    id: 'handoff', type: 'messageNode', position: { x: 3650, y: 150 },
    data: { label: 'Despedida Lead', value: '¡Listo! 🏆 Recibí toda la info, muy pronto me pongo en contacto contigo. Si necesitas algo antes, escríbeme aquí mismo 😊', options: [] }
  },

  {
    id: 'handoffDirect', type: 'messageNode', position: { x: 850, y: 550 },
    data: { label: 'Contacto Directo', value: '¡Claro! 💬 Ya te atiendo personalmente, en un momento estoy contigo 🙌', options: [] }
  }
];

const VOLKSWAGEN_EDGES = [
  { id: 'e-menu-cat',   source: 'welcome', sourceHandle: 'opt_menu_1', target: 'catalogIntro',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-lead',  source: 'welcome', sourceHandle: 'opt_menu_2', target: 'askInterest',      animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-fin',   source: 'welcome', sourceHandle: 'opt_menu_3', target: 'askBudget',        animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-agent', source: 'welcome', sourceHandle: 'opt_menu_4', target: 'handoffDirect',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-interest-budget',     source: 'askInterest',   target: 'askBudget',      animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-budget-employment',   source: 'askBudget',     target: 'askEmployment',  animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-employment-income',   source: 'askEmployment', target: 'askIncome',      animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-income-credit',       source: 'askIncome',     target: 'askCreditCheck', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-credit-name',         source: 'askCreditCheck',target: 'askLeadName',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-name-phone',          source: 'askLeadName',   target: 'askLeadPhone',   animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-phone-handoff',       source: 'askLeadPhone',  target: 'handoff',        animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
];

const KIA_NODES = [
  {
    id: 'welcome', type: 'messageNode', position: { x: 250, y: 300 },
    data: {
      label: 'Bienvenida y Menú KIA',
      value: '👋 Hola, cómo estás? Te habla *{asesor}* tu asesor KIA 😊\n\nCuéntame, ¿qué modelo KIA te llama la atención hoy? 👇\n\n*1️⃣* 🚗 Ver catálogo completo\n*2️⃣* 💰 Cotizar un modelo\n*3️⃣* 💬 Hablar con un asesor',
      options: [
        { id: 'opt_menu_1', keyword: '1' },
        { id: 'opt_menu_2', keyword: '2' },
        { id: 'opt_menu_3', keyword: '3' }
      ]
    }
  },
  {
    id: 'catalogIntro', type: 'messageNode', position: { x: 850, y: -100 },
    data: { label: 'Catálogo KIA', value: '{{catalogo}}', options: [] }
  },
  {
    id: 'askInterest', type: 'messageNode', position: { x: 850, y: 150 },
    data: { label: 'Modelo KIA', value: '¡Excelente elección! 🤩 ¿Tienes algún KIA en mente? (Ej. Picanto, Sportage, K3, etc.)', options: [] }
  },
  {
    id: 'askLeadName', type: 'messageNode', position: { x: 1250, y: 150 },
    data: { label: 'Nombre', value: 'Para enviarte la información completa, ¿Me regalas tu nombre completo? ✍️', options: [] }
  },
  {
    id: 'handoff', type: 'messageNode', position: { x: 1650, y: 150 },
    data: { label: 'Despedida', value: '¡Listo! En unos minutos te estaré contactando con la cotización de tu KIA 🚗💨', options: [] }
  },
  {
    id: 'handoffDirect', type: 'messageNode', position: { x: 850, y: 550 },
    data: { label: 'Contacto Directo', value: '¡Claro! 💬 En un momento te atiendo de forma personal 🙌', options: [] }
  }
];

const KIA_EDGES = [
  { id: 'e-menu-cat',   source: 'welcome', sourceHandle: 'opt_menu_1', target: 'catalogIntro',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-lead',  source: 'welcome', sourceHandle: 'opt_menu_2', target: 'askInterest',      animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-agent', source: 'welcome', sourceHandle: 'opt_menu_3', target: 'handoffDirect',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-interest-name', source: 'askInterest', target: 'askLeadName', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-name-handoff', source: 'askLeadName', target: 'handoff', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
];

const RESTAURANT_NODES = [
  {
    id: 'welcome', type: 'messageNode', position: { x: 250, y: 300 },
    data: {
      label: 'Bienvenida Ivy Fast Food',
      value: '👋 ¡Hola! Bienvenido a *Ivy Burgers & Fast Food* 🍔🍟🔥\n\n¿Qué se te antoja pedir hoy? 👇\n\n*1️⃣* 📖 Ver Carta Virtual (Smash Burgers, Salchipapas, Alitas...)\n*2️⃣* 🛵 Hacer un Pedido a Domicilio\n*3️⃣* 📍 Horarios y Sedes\n*4️⃣* 💬 Hablar con un Asesor',
      options: [
        { id: 'opt_menu_1', keyword: '1' },
        { id: 'opt_menu_2', keyword: '2' },
        { id: 'opt_menu_3', keyword: '3' },
        { id: 'opt_menu_4', keyword: '4' }
      ]
    }
  },
  {
    id: 'catalogIntro', type: 'messageNode', position: { x: 850, y: -100 },
    data: {
      label: 'Carta Virtual',
      value: '✨ Explora nuestra carta interactiva en tiempo real con fotos, precios y carrito en vivo:\n\n👉 http://localhost:5000/carta\n\n¡Puedes seleccionar tus platos y enviar tu orden directo a nuestra cocina! 👨‍🍳🔥',
      options: []
    }
  },
  {
    id: 'askInterest', type: 'messageNode', position: { x: 850, y: 150 },
    data: {
      label: 'Toma de Pedido',
      value: '🛵 ¡Excelente elección! Escríbenos los platos de la carta que deseas ordenar y si tienes alguna nota especial (ej: término de la carne, sin salsas, etc.) ✍️',
      options: []
    }
  },
  {
    id: 'askAddress', type: 'messageNode', position: { x: 1250, y: 150 },
    data: {
      label: 'Dirección de Entrega',
      value: 'Perfecto 🙌 ¿A qué dirección te enviamos el pedido? (Incluye barrio y detalles de entrega si aplica) 📍',
      options: []
    }
  },
  {
    id: 'handoffOrder', type: 'messageNode', position: { x: 1650, y: 150 },
    data: {
      label: 'Confirmación',
      value: '¡Listo! Tu pedido ha sido registrado en nuestro sistema *IvyOS* y está en camino a cocina 🍔👨‍🍳 En breve te confirmamos el tiempo estimado de entrega.',
      options: []
    }
  },
  {
    id: 'infoRestaurante', type: 'messageNode', position: { x: 850, y: 400 },
    data: {
      label: 'Info & Ubicación',
      value: '📍 *Ubicación:* Zona Gourmet, Cra. 43A # 1-50\n🕒 *Horarios:* Martes a Domingo de 12:00 PM a 11:00 PM\n🍷 *Ambientes:* Salón climatizado, Terraza & Barra de Cócteles de autor\n\n¿Deseas reservar una mesa? Escríbenos *4* para coordinarlo.',
      options: []
    }
  },
  {
    id: 'handoffDirect', type: 'messageNode', position: { x: 850, y: 650 },
    data: {
      label: 'Contacto Directo',
      value: '¡Con gusto! 💬 Uno de nuestros anfitriones tomará tu conversación en un momento. ¡Gracias por preferirnos! 😊',
      options: []
    }
  }
];

const RESTAURANT_EDGES = [
  { id: 'e-menu-cat',   source: 'welcome', sourceHandle: 'opt_menu_1', target: 'catalogIntro',    animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-order', source: 'welcome', sourceHandle: 'opt_menu_2', target: 'askInterest',     animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-info',  source: 'welcome', sourceHandle: 'opt_menu_3', target: 'infoRestaurante', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-menu-agent', source: 'welcome', sourceHandle: 'opt_menu_4', target: 'handoffDirect',   animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-order-addr', source: 'askInterest', target: 'askAddress', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
  { id: 'e-addr-handoff', source: 'askAddress', target: 'handoffOrder', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 } },
];

export function getFlowTemplate(marca) {
  if (marca === 'Blanco') {
    return { nodes: BLANCO_NODES, edges: BLANCO_EDGES };
  } else if (marca === 'Restaurante' || marca === 'Gastronomia' || marca === 'IvyOS') {
    return { nodes: RESTAURANT_NODES, edges: RESTAURANT_EDGES };
  } else if (marca === 'KIA') {
    return { nodes: KIA_NODES, edges: KIA_EDGES };
  } else if (marca === 'Volkswagen' || marca === 'JAC') {
    // Antes caían en el flujo del restaurante: VOLKSWAGEN_NODES existía pero nunca se usaba
    return { nodes: VOLKSWAGEN_NODES, edges: VOLKSWAGEN_EDGES };
  } else {
    return { nodes: RESTAURANT_NODES, edges: RESTAURANT_EDGES };
  }
}

// Mantener compatibilidad exportando RESTAURANT por defecto
export const DEFAULT_NODES = RESTAURANT_NODES;
export const DEFAULT_EDGES = RESTAURANT_EDGES;

