// src/main/whatsapp/flows/conversation.flow.js
import { NegocioRepo } from '../../db/repositories/negocio.repo.js';
import { SesionesRepo } from '../../db/repositories/sesiones.repo.js';
import { LeadsRepo } from '../../db/repositories/leads.repo.js';
import { FlujoRepo } from '../../db/repositories/flujo.repo.js';
import { CatalogoRepo } from '../../db/repositories/catalogo.repo.js';
import { MSG, formatPrice } from './messages.js';
import { sendHandoffNotification } from '../../util/notifier.js';

const RESET_KEYWORDS = ['menu', 'inicio', 'reiniciar', 'opciones', 'empezar'];
const HANDOFF_KEYWORDS = ['asesor', 'hablar', 'agente', 'persona', 'humano'];

function isReset(text) {
  const t = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return RESET_KEYWORDS.some((k) => t === k || t.includes(k));
}

function isHandoff(text) {
  const t = text.trim().toLowerCase();
  return HANDOFF_KEYWORDS.some((k) => t.includes(k));
}

/**
 * Extrae el texto legible de una opción numerada en el mensaje del nodo.
 * Por ejemplo: "*1️⃣* Hasta $90M" con input "1" → "Hasta $90M"
 */
function extractOptionLabel(nodeValue, userInput) {
  if (!nodeValue) return userInput;
  const numericInput = parseInt(userInput);
  if (isNaN(numericInput)) return userInput;

  // Limpiar markdown y buscar líneas con patrón de opción numérica
  const lines = nodeValue.split('\n').map(l => l.replace(/\*/g, '').replace(/_/g, '').trim()).filter(Boolean);
  let optionCount = 0;

  for (const line of lines) {
    // Acepta: "1. text", "1) text", "1 text", "1️⃣ text", "1- text"
    const match = line.match(/^(\d+)[^\w\s]*\s+(.+)$/);
    if (match) {
      optionCount++;
      if (optionCount === numericInput) {
        return match[2].trim();
      }
    }
  }

  return userInput; // Si no encuentra, devuelve lo que escribió el usuario
}

// Interpola variables en el texto del nodo
function renderText(text, session, negocio) {
  if (!text) return '';
  let rendered = text
    .replaceAll('{asesor}', negocio?.nombre_asesor || '')
    .replaceAll('{negocio}', negocio?.nombre_negocio || '')
    .replaceAll('{marca}', negocio?.marca || '')
    .replaceAll('{horario}', negocio?.horario || '')
    .replaceAll('{cargo}', negocio?.cargo || '')
    .replaceAll('{nombre}', session.pushName || '')
    .replaceAll('{lead_name}', session.lead?.name || '')
    .replaceAll('{{nombre}}', session.pushName || '')
    .replaceAll('{portfolio_url}', negocio?.portfolio_url || '');

  if (rendered.includes('{{catalogo}}')) {
    const categories = CatalogoRepo.getCategories();
    if (categories.length > 1) {
      rendered = rendered.replace('{{catalogo}}', MSG.categoryList(categories));
    } else {
      const items = CatalogoRepo.listAll();
      rendered = rendered.replace('{{catalogo}}', MSG.itemList(items));
    }
  }

  return rendered;
}

/**
 * Motor de grafos: Procesa el mensaje del usuario navegando por los nodos (bloques)
 * y aristas (flechas) dibujadas en el lienzo de React Flow.
 */
export function handleIncomingMessage({ userId, text, pushName }) {
  try {
    if (SesionesRepo.isGloballyPaused() || SesionesRepo.isExcluded(userId)) return [];

    const negocio = NegocioRepo.get();
    const session = SesionesRepo.get(userId);
    session.pushName = pushName || session.pushName;
    if (!session.lead) session.lead = {};
    if (!session.catalog) session.catalog = {};

    // Si el cliente escribe un comando de rescate (ej: menú), el bot despierta obligatoriamente
    if (isReset(text)) {
      session.handoffMode = false;
      session.advisorTook = false;
    }

    // Si el asesor ya tomó el control (sea por botón o porque escribió manualmente), el bot no interrumpe
    if (session.handoffMode || session.advisorTook) return [];

    const cleanPhone = userId.replace(/[@:][^\s]*/g, '').replace(/\D/g, '');
    const stepLower = (session.step || '').toLowerCase();

    // Captura temprana del Lead al primer contacto
    if (stepLower === 'welcome' || !session.step) {
      LeadsRepo.upsert({
        userId,
        nombre: session.lead.name || session.pushName || cleanPhone,
        telefono: session.lead.phone || cleanPhone,
        interes: session.lead.interest || '',
        presupuesto: session.lead.budget || '',
        empleo: session.lead.employment || '',
        ingreso: session.lead.income || '',
      });
    }

    const flow = FlujoRepo.getFlow();
    const nodes = flow.nodes || [];
    const edges = flow.edges || [];

    if (nodes.length === 0) {
      return ['El bot aún no tiene un flujo configurado. Configúralo en la pestaña Mensajes.'];
    }

    // SI LA CHARLA FUE INICIADA POR EL ASESOR (Mass messaging o inicio manual)
    if (session.advisorInitiated && !session.step) {
      session.advisorInitiated = false; // El bot toma el control desde ahora
      session.step = 'menu';
      SesionesRepo.save(session);
      
      const menuNode = nodes.find(n => n.id === 'menu') || nodes.find(n => n.id === 'welcome');
      return [menuNode ? renderText(menuNode.data.value, session, negocio) : 'Cuéntame, ¿qué necesitas hoy? 👇'];
    }

    // === Comandos globales ===
    if (isHandoff(text)) {
      session.handoffMode = true;
      session.catalog.dynamicState = null;
      SesionesRepo.save(session);
      sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
      const handoffNode = nodes.find(n => n.id === 'handoffDirect') || nodes.find(n => n.id === 'handoff');
      return [handoffNode ? renderText(handoffNode.data.value, session, negocio) : '¡Claro! Te conecto con el asesor ahora mismo 💬'];
    }

    if (isReset(text)) {
      session.handoffMode = false;
      session.catalog.dynamicState = null;
      // Priorizar el nodo 'menu', si no existe, caer a 'welcome'
      const menuNode = nodes.find(n => n.id === 'menu') || nodes.find(n => n.id === 'welcome') || nodes[0];
      if (menuNode) {
        session.step = menuNode.id;
        SesionesRepo.save(session);
        return [renderText(menuNode.data.value, session, negocio)];
      }
    }

    if (session.catalog.dynamicState === 'CATALOG_CATEGORIES') {
      const inputTrimmed = text.trim();
      
      if (inputTrimmed === '0') {
        session.catalog.dynamicState = 'CATALOG_BUDGET_PROMPT';
        SesionesRepo.save(session);
        return [MSG.budgetPrompt()];
      }

      const categories = CatalogoRepo.getCategories();
      const idx = parseInt(inputTrimmed) - 1;
      if (isNaN(idx) || idx < 0 || idx >= categories.length) {
        return [`No te entendí 😅 Escribe solo el número de la categoría (del 1 al ${categories.length}), o '0' para buscar por presupuesto.`];
      }
      const selectedCategory = categories[idx].name;
      session.catalog.dynamicState = 'CATALOG_LIST';
      session.catalog.selectedCategory = selectedCategory;
      session.catalog.budgetFilteredItems = null; // Clear any previous budget filter
      SesionesRepo.save(session);
      
      const items = CatalogoRepo.listAll().filter(it => it.categoria === selectedCategory);
      return [MSG.itemList(items)];
    }

    if (session.catalog.dynamicState === 'CATALOG_BUDGET_PROMPT') {
      const inputStr = text.toLowerCase();
      // Extract numbers, allowing dots/commas, and checking for 'millon' or 'm'
      const numMatch = inputStr.replace(/[^0-9.,m]/g, '').match(/[\d.,]+/);
      
      if (!numMatch) {
        return ['No pude identificar el monto 😅. Por favor, escribe un número, por ejemplo: 80000000 o "80 millones".'];
      }
      
      let amountStr = numMatch[0].replace(/[.,]/g, '');
      let amount = parseInt(amountStr);
      
      // If user wrote "80 millones" or "80m" or just 80 (meaning 80M)
      if (inputStr.includes('millon') || inputStr.includes('m') || amount < 1000) {
        if (amount < 1000) amount = amount * 1000000;
      }
      
      const items = CatalogoRepo.listAll();
      // Filter items where at least one variant is <= budget + 10%
      const threshold = amount * 1.10;
      const filtered = items.filter(it => {
        if (!it.variantes || it.variantes.length === 0) return false;
        const minPrice = Math.min(...it.variantes.map(v => v.precio || 999999999));
        return minPrice <= threshold;
      });

      if (filtered.length === 0) {
        return [`😔 Lo siento, no encontré vehículos que se ajusten a ese presupuesto (buscamos hasta ${formatPrice(threshold)}). Escribe *"menu"* para volver o intenta con otro monto.`];
      }

      session.catalog.dynamicState = 'CATALOG_LIST';
      session.catalog.selectedCategory = null;
      session.catalog.budgetFilteredItems = filtered.map(i => i.id);
      SesionesRepo.save(session);
      
      return [
        `¡Excelente! 🔎 Encontré estos vehículos que se ajustan a tu presupuesto (mostrando opciones hasta ${formatPrice(threshold)}):`,
        MSG.itemList(filtered)
      ];
    }

    if (session.catalog.dynamicState === 'CATALOG_LIST') {
      let items = [];
      if (session.catalog.budgetFilteredItems) {
        items = CatalogoRepo.listAll().filter(it => session.catalog.budgetFilteredItems.includes(it.id));
      } else {
        items = session.catalog.selectedCategory 
          ? CatalogoRepo.listAll().filter(it => it.categoria === session.catalog.selectedCategory)
          : CatalogoRepo.listAll();
      }
        
      const idx = parseInt(text.trim()) - 1;
      if (isNaN(idx) || idx < 0 || idx >= items.length) {
        return [`No te entendí 😅 Escribe solo el número del vehículo (del 1 al ${items.length})`];
      }
      const selectedItem = items[idx];
      session.catalog.dynamicState = 'CATALOG_DETAIL';
      session.catalog.selectedItemId = selectedItem.id;
      session.catalog.selectedItemName = selectedItem.nombre;
      SesionesRepo.save(session);
      return [MSG.itemDetail(selectedItem) + MSG.itemOptions(negocio)];
    }

    if (session.catalog.dynamicState === 'CATALOG_DETAIL') {
      const input = text.trim();

      if (input === '1') {
        // Cotizar — pre-llenar interés y saltar askInterest, ir directo a askBudget
        session.catalog.dynamicState = null;

        // Pre-llenar el interés con el modelo seleccionado del catálogo
        const itemName = session.catalog.selectedItemName;
        if (itemName) {
          session.lead.interest = itemName;
          LeadsRepo.upsert({
            userId,
            nombre: session.lead.name || session.pushName || cleanPhone,
            telefono: session.lead.phone || cleanPhone,
            interes: itemName,
            presupuesto: session.lead.budget || '',
            empleo: session.lead.employment || '',
            ingreso: session.lead.income || '',
          });
        }

        // Avanzar etapa del lead a "cotizando" automáticamente
        LeadsRepo.updateEtapaByUserId(userId, 'cotizando');

        // Ir directo a askBudget (sin pregunta redundante)
        session.step = 'askBudget';
        SesionesRepo.save(session);
        const askBudgetNode = nodes.find(n => n.id === 'askBudget');
        const budgetText = askBudgetNode ? renderText(askBudgetNode.data.value, session, negocio) : '¿En qué rango de inversión estás?';
        const intro = itemName
          ? `Perfecto, anotado! Te cotizo el *${itemName}* 🚗💨\n\n${budgetText}`
          : budgetText;
        return [intro];

      } else if (input === '2') {
        // Ver otros autos -> Volver a categorías
        const categories = CatalogoRepo.getCategories();
        if (categories.length > 1) {
          session.catalog.dynamicState = 'CATALOG_CATEGORIES';
          session.catalog.selectedCategory = null;
          session.catalog.selectedItemId = null;
          session.catalog.selectedItemName = null;
          SesionesRepo.save(session);
          return [MSG.categoryList(categories)];
        } else {
          session.catalog.dynamicState = 'CATALOG_LIST';
          session.catalog.selectedItemId = null;
          session.catalog.selectedItemName = null;
          SesionesRepo.save(session);
          const items = CatalogoRepo.listAll();
          return [MSG.itemList(items)];
        }

      } else if (input === '3') {
        // Vehículos Similares
        const items = CatalogoRepo.listAll();
        const currentItem = items.find(it => it.id === session.catalog.selectedItemId);
        
        if (!currentItem || !currentItem.variantes || currentItem.variantes.length === 0) {
          return ['No pude encontrar opciones similares en este momento 😅'];
        }

        const currentMinPrice = Math.min(...currentItem.variantes.map(v => v.precio || 999999999));
        
        // Similares: +- 25% de diferencia en el precio mínimo, excluyendo el ítem actual
        const minRange = currentMinPrice * 0.75;
        const maxRange = currentMinPrice * 1.25;

        const similares = items.filter(it => {
          if (it.id === currentItem.id) return false;
          if (!it.variantes || it.variantes.length === 0) return false;
          const minPrice = Math.min(...it.variantes.map(v => v.precio || 999999999));
          return minPrice >= minRange && minPrice <= maxRange;
        });

        if (similares.length === 0) {
          return [`No encontré alternativas en este rango de precios (${formatPrice(minRange)} - ${formatPrice(maxRange)}). Escribe *"menu"* para ver otras opciones.`];
        }

        // Shuffle y tomar hasta 3 opciones
        const shuffled = similares.sort(() => 0.5 - Math.random()).slice(0, 3);

        session.catalog.dynamicState = 'CATALOG_LIST';
        session.catalog.selectedCategory = null;
        session.catalog.budgetFilteredItems = shuffled.map(i => i.id);
        SesionesRepo.save(session);

        return [
          `Aquí tienes ${shuffled.length} ${shuffled.length === 1 ? 'alternativa similar' : 'alternativas similares'} por ese mismo rango de precios 🔄:\n`,
          MSG.itemList(shuffled)
        ];

      } else if (input === '4') {
        // Hablar con asesor
        session.catalog.dynamicState = null;
        session.handoffMode = true;
        SesionesRepo.save(session);
        sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
        const handoffNode = nodes.find(n => n.id === 'handoffDirect') || nodes.find(n => n.id === 'handoff');
        return [handoffNode ? renderText(handoffNode.data.value, session, negocio) : '¡Claro! Te conecto ahora mismo 💬'];

      } else {
        return ['Respóndeme con *1* para cotizar, *2* para volver, *3* para ver similares, o *4* para hablar conmigo 😊'];
      }
    }

    // === Flujo Normal de Grafo ===
    let currentNode = nodes.find(n => n.id === session.step);

    // Primer contacto o sesión sin estado válido → ir al welcome
    if (!currentNode) {
      currentNode = nodes.find(n => n.id === 'welcome') || nodes[0];
      session.step = currentNode.id;
      SesionesRepo.save(session);
      return [renderText(currentNode.data.value, session, negocio)];
    }

    const currentId = currentNode.id;
    const input = text.trim();
    let leadUpdated = false;

    // Captura progresiva de datos del Lead — guardar etiqueta legible, no el número crudo
    if (currentId === 'askInterest') {
      session.lead.interest = input; // Aquí el usuario escribe texto libre
      leadUpdated = true;
      LeadsRepo.updateEtapaByUserId(userId, 'cotizando');
    } else if (currentId === 'askBudget') {
      session.lead.budget = extractOptionLabel(currentNode.data.value, input);
      leadUpdated = true;
    } else if (currentId === 'askEmployment') {
      session.lead.employment = extractOptionLabel(currentNode.data.value, input);
      leadUpdated = true;
    } else if (currentId === 'askIncome') {
      session.lead.income = input; // Texto libre
      leadUpdated = true;
    } else if (currentId === 'askCreditCheck') {
      session.lead.creditCheck = extractOptionLabel(currentNode.data.value, input);
      leadUpdated = true;
    } else if (currentId === 'askLeadName') {
      session.lead.name = input;
      leadUpdated = true;
    } else if (currentId === 'askLeadPhone') {
      session.lead.phone = input;
      leadUpdated = true;
    }

    if (leadUpdated) {
      LeadsRepo.upsert({
        userId,
        nombre: session.lead.name || session.pushName || cleanPhone,
        telefono: session.lead.phone || cleanPhone,
        interes: session.lead.interest || '',
        presupuesto: session.lead.budget || '',
        empleo: session.lead.employment || '',
        ingreso: session.lead.income || '',
      });
    }

    // === Encontrar el siguiente nodo según las flechas ===
    let nextNodeId = null;
    const options = currentNode.data?.options || [];

    if (options.length > 0) {
      // Buscar por keyword exacto
      const matchedOption = options.find(opt =>
        opt.keyword && opt.keyword.toLowerCase() === input.toLowerCase()
      );

      if (matchedOption) {
        const edge = edges.find(e => e.source === currentId && e.sourceHandle === matchedOption.id);
        if (edge) nextNodeId = edge.target;
      }

      // Fallback: buscar por índice numérico (1, 2, 3...)
      if (!nextNodeId) {
        const numericInput = parseInt(input);
        if (!isNaN(numericInput) && numericInput >= 1 && numericInput <= options.length) {
          const optionByIndex = options[numericInput - 1];
          const edge = edges.find(e => e.source === currentId && e.sourceHandle === optionByIndex.id);
          if (edge) nextNodeId = edge.target;
        }
      }

      if (!nextNodeId) {
        return ['Opción no válida. Elige una de las opciones indicadas 👆'];
      }
    } else {
      // Nodo sin opciones: flujo lineal, seguir la única flecha
      const edge = edges.find(e => e.source === currentId);
      if (edge) nextNodeId = edge.target;
    }

    // Sin nodo destino (fin del flujo) → pausar bot para que el asesor continúe
    if (!nextNodeId) {
      session.handoffMode = true;
      SesionesRepo.save(session);
      return [];
    }

    const nextNode = nodes.find(n => n.id === nextNodeId);
    if (!nextNode) {
      console.error(`[Emissary] Nodo destino "${nextNodeId}" no encontrado en el flujo.`);
      return ['Disculpa, algo no salió bien 😅 Escribe *"menu"* para volver al inicio.'];
    }

    session.step = nextNode.id;
    const renderedNextText = renderText(nextNode.data.value, session, negocio);

    // Activar estado dinámico si el nodo contiene {{catalogo}}
    if (nextNode.data.value && nextNode.data.value.includes('{{catalogo}}')) {
      const categories = CatalogoRepo.getCategories();
      if (categories.length > 1) {
        session.catalog.dynamicState = 'CATALOG_CATEGORIES';
      } else {
        session.catalog.dynamicState = 'CATALOG_LIST';
      }
    } else {
      session.catalog.dynamicState = null;
    }

    SesionesRepo.save(session);
    return [renderedNextText];

  } catch (err) {
    console.error('[Emissary] Error en handleIncomingMessage:', err);
    return ['Ups, algo falló de mi lado 😅 Escribe *"menu"* para reiniciar.'];
  }
}