// src/main/whatsapp/flows/conversation.flow.js
import { MSG, formatPrice } from './messages.js';
import { isReset, isHandoff } from './keywords.js';
import { catalogTerms } from './terms.js';
import { captureOf, startNodeOf, handoffNodeOf, nodeByCapture, matchOption, optionName, fullText, DEFAULT_FALLBACK } from './flowRuntime.js';

// Si el asesor escribió a mano y lleva este tiempo sin intervenir, el bot retoma el chat
const ADVISOR_TAKEOVER_TTL_MS = 12 * 60 * 60 * 1000;

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

/**
 * Fábrica del motor: recibe sus dependencias (repos y notificador) para poder probarlo sin Electron ni SQLite.
 */
// Bloque al que se pasa tras elegir un ítem del catálogo: el de presupuesto, o el que sigue a la pregunta de interés
function nextAfterItem(nodes, edges) {
  const presupuesto = nodeByCapture(nodes, 'budget');
  if (presupuesto) return presupuesto;
  const interes = nodeByCapture(nodes, 'interest');
  if (!interes) return null;
  const salida = edges.find((e) => e.source === interes.id);
  return nodes.find((n) => n.id === salida?.target) || null;
}

export function createEngine({ NegocioRepo, SesionesRepo, LeadsRepo, FlujoRepo, CatalogoRepo, sendHandoffNotification }) {
  // Texto de un bloque: su mensaje más el menú automático de alternativas, con las variables ya resueltas
  const renderNode = (node, session, negocio) => renderText(fullText(node), session, negocio);

  // Si el bloque muestra el catálogo, las próximas respuestas del cliente (números) se interpretan sobre él
  const catalogState = (node) => {
    if (!node.data?.value?.includes('{{catalogo}}')) return null;
    return CatalogoRepo.getCategories().length > 1 ? 'CATALOG_CATEGORIES' : 'CATALOG_LIST';
  };

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
      const terms = catalogTerms(negocio?.marca);
      const categories = CatalogoRepo.getCategories();
      if (categories.length > 1) {
        rendered = rendered.replace('{{catalogo}}', MSG.categoryList(categories, terms));
      } else {
        const items = CatalogoRepo.listAll();
        rendered = rendered.replace('{{catalogo}}', MSG.itemList(items, terms));
      }
    }

    return rendered;
  }

  /**
   * Motor de grafos: Procesa el mensaje del usuario navegando por los nodos (bloques)
   * y aristas (flechas) dibujadas en el lienzo de React Flow.
   */
  function handleIncomingMessage({ userId, text, pushName }) {
    try {
      if (SesionesRepo.isGloballyPaused() || SesionesRepo.isExcluded(userId)) return [];

      const negocio = NegocioRepo.get();
      const session = SesionesRepo.get(userId);
      session.pushName = pushName || session.pushName;
      if (!session.lead) session.lead = {};
      if (!session.catalog) session.catalog = {};

      // updatedAt solo se mueve cuando el asesor interviene (el bot calla y no guarda mientras tanto)
      if (session.advisorTook && Date.now() - session.updatedAt > ADVISOR_TAKEOVER_TTL_MS) {
        session.advisorTook = false;
        SesionesRepo.save(session);
      }

      // "menu" despierta al bot tras un handoff, pero nunca le quita el chat a un asesor activo
      if (isReset(text) && !session.advisorTook) {
        session.handoffMode = false;
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

      const terms = catalogTerms(negocio?.marca);
      const flow = FlujoRepo.getFlow();
      const nodes = flow.nodes || [];
      const edges = flow.edges || [];

      if (nodes.length === 0) {
        return ['El bot aún no tiene un flujo configurado. Configúralo en la pestaña Mensajes.'];
      }

      // === Comandos globales ===
      if (isHandoff(text)) {
        session.handoffMode = true;
        session.catalog.dynamicState = null;
        SesionesRepo.save(session);
        sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
        const handoffNode = handoffNodeOf(nodes);
        return [handoffNode ? renderNode(handoffNode, session, negocio) : '¡Claro! Te conecto con el asesor ahora mismo 💬'];
      }

      if (isReset(text)) {
        session.handoffMode = false;
        session.catalog.dynamicState = null;
        // Priorizar el nodo 'menu', si no existe, caer a 'welcome'
        const menuNode = nodes.find(n => n.id === 'menu') || startNodeOf(nodes);
        if (menuNode) {
          session.step = menuNode.id;
          session.catalog.dynamicState = catalogState(menuNode);
          SesionesRepo.save(session);
          return [renderNode(menuNode, session, negocio)];
        }
      }

      if (session.catalog.dynamicState === 'CATALOG_CATEGORIES') {
        const inputTrimmed = text.trim();
        
        if (inputTrimmed === '0' && terms.porPresupuesto) {
          session.catalog.dynamicState = 'CATALOG_BUDGET_PROMPT';
          SesionesRepo.save(session);
          return [MSG.budgetPrompt()];
        }

        const categories = CatalogoRepo.getCategories();
        const idx = parseInt(inputTrimmed) - 1;
        if (isNaN(idx) || idx < 0 || idx >= categories.length) {
          return [`No te entendí 😅 Escribe solo el número de la opción (del 1 al ${categories.length})${terms.porPresupuesto ? ", o '0' para buscar por presupuesto" : ''}.`];
        }
        const selectedCategory = categories[idx].name;
        session.catalog.dynamicState = 'CATALOG_LIST';
        session.catalog.selectedCategory = selectedCategory;
        session.catalog.budgetFilteredItems = null; // Clear any previous budget filter
        SesionesRepo.save(session);
        
        const items = CatalogoRepo.listAll().filter(it => it.categoria === selectedCategory);
        return [MSG.itemList(items, terms)];
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
          return [`😔 Lo siento, no encontré ${terms.varios} que se ajusten a ese presupuesto (buscamos hasta ${formatPrice(threshold)}). Escribe *"menu"* para volver o intenta con otro monto.`];
        }

        session.catalog.dynamicState = 'CATALOG_LIST';
        session.catalog.selectedCategory = null;
        session.catalog.budgetFilteredItems = filtered.map(i => i.id);
        SesionesRepo.save(session);
        
        return [
          `¡Excelente! 🔎 Encontré estos ${terms.varios} que se ajustan a tu presupuesto (mostrando opciones hasta ${formatPrice(threshold)}):`,
          MSG.itemList(filtered, terms)
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
          return [`No te entendí 😅 Escribe solo el número del ${terms.uno} (del 1 al ${items.length})`];
        }
        const selectedItem = items[idx];
        session.catalog.dynamicState = 'CATALOG_DETAIL';
        session.catalog.selectedItemId = selectedItem.id;
        session.catalog.selectedItemName = selectedItem.nombre;
        SesionesRepo.save(session);
        return [MSG.itemDetail(selectedItem, terms) + MSG.itemOptions(negocio, terms)];
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

          // Sigue el flujo del negocio sin repetir la pregunta de interés: el presupuesto si existe, o lo que sigue a la pregunta de interés
          const nextNode = nextAfterItem(nodes, edges);
          const intro = itemName ? terms.anotado(itemName) : '';
          if (!nextNode) {
            // El flujo no tiene a dónde seguir: se pasa con el asesor
            session.handoffMode = true;
            SesionesRepo.save(session);
            sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
            const handoffNode = handoffNodeOf(nodes);
            return [[intro, handoffNode ? renderNode(handoffNode, session, negocio) : '¡Claro! Te conecto ahora mismo 💬'].filter(Boolean).join('\n\n')];
          }
          session.step = nextNode.id;
          SesionesRepo.save(session);
          return [[intro, renderNode(nextNode, session, negocio)].filter(Boolean).join('\n\n')];

        } else if (input === '2') {
          // Ver otros autos -> Volver a categorías
          const categories = CatalogoRepo.getCategories();
          if (categories.length > 1) {
            session.catalog.dynamicState = 'CATALOG_CATEGORIES';
            session.catalog.selectedCategory = null;
            session.catalog.selectedItemId = null;
            session.catalog.selectedItemName = null;
            SesionesRepo.save(session);
            return [MSG.categoryList(categories, terms)];
          } else {
            session.catalog.dynamicState = 'CATALOG_LIST';
            session.catalog.selectedItemId = null;
            session.catalog.selectedItemName = null;
            SesionesRepo.save(session);
            const items = CatalogoRepo.listAll();
            return [MSG.itemList(items, terms)];
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
            MSG.itemList(shuffled, terms)
          ];

        } else if (input === '4') {
          // Hablar con asesor
          session.catalog.dynamicState = null;
          session.handoffMode = true;
          SesionesRepo.save(session);
          sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
          const handoffNode = handoffNodeOf(nodes);
          return [handoffNode ? renderNode(handoffNode, session, negocio) : '¡Claro! Te conecto ahora mismo 💬'];

        } else {
          return [`Respóndeme con *1* para ${terms.verbo}, *2* para volver, *3* para ver similares, o *4* para hablar conmigo 😊`];
        }
      }

      // === Flujo Normal de Grafo ===
      let currentNode = nodes.find(n => n.id === session.step);

      // Primer contacto o sesión sin estado válido → ir al welcome
      if (!currentNode) {
        currentNode = startNodeOf(nodes);
        session.step = currentNode.id;
        session.catalog.dynamicState = catalogState(currentNode); // antes, un catálogo en el inicio no entendía las respuestas
        SesionesRepo.save(session);
        return [renderNode(currentNode, session, negocio)];
      }

      const currentId = currentNode.id;
      const input = text.trim();
      const options = currentNode.data?.options || [];

      // Con alternativas, la respuesta debe ser una de ellas (etiqueta, alias, número o letra)
      const matched = options.length ? matchOption(currentNode, input) : null;
      if (options.length && !matched) return [currentNode.data.fallback || DEFAULT_FALLBACK];

      // Captura progresiva de datos del Lead: el bloque declara qué campo llena (antes dependía de su id)
      const field = captureOf(currentNode);
      if (field) {
        session.lead[field] = matched ? optionName(matched) : extractOptionLabel(currentNode.data.value, input);
        if (field === 'interest') LeadsRepo.updateEtapaByUserId(userId, 'cotizando');
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

      // Siguiente bloque según las flechas: la de la alternativa elegida o la única que sale del bloque
      const edge = matched
        ? edges.find(e => e.source === currentId && e.sourceHandle === matched.id)
        : edges.find(e => e.source === currentId);
      const nextNodeId = edge?.target;

      // Sin bloque destino (fin del flujo) → pausar el bot y avisar al asesor para que continúe
      if (!nextNodeId) {
        session.handoffMode = true;
        SesionesRepo.save(session);
        sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
        return [];
      }

      const nextNode = nodes.find(n => n.id === nextNodeId);
      if (!nextNode) {
        console.error(`[Emissary] Nodo destino "${nextNodeId}" no encontrado en el flujo.`);
        return ['Disculpa, algo no salió bien 😅 Escribe *"menu"* para volver al inicio.'];
      }

      session.step = nextNode.id;
      const renderedNextText = renderNode(nextNode, session, negocio);

      session.catalog.dynamicState = catalogState(nextNode);

      // Acciones del bloque al llegar a él
      if (nextNode.data.action === 'handoff') {
        session.handoffMode = true;
        sendHandoffNotification(userId, session.lead?.name || session.pushName || 'Un prospecto');
      } else if (nextNode.data.action === 'restart') {
        session.step = ''; // el próximo mensaje vuelve a empezar por el bloque de inicio
      }

      SesionesRepo.save(session);
      return [renderedNextText];

    } catch (err) {
      console.error('[Emissary] Error en handleIncomingMessage:', err);
      return ['Ups, algo falló de mi lado 😅 Escribe *"menu"* para reiniciar.'];
    }
  }

  return { handleIncomingMessage };
}
