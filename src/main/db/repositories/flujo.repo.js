import { getDb } from '../db.js';
import { DEFAULT_NODES, DEFAULT_EDGES } from '../../whatsapp/flows/defaultFlow.js';

export const FlujoRepo = {
  init() {
    const db = getDb();
    db.prepare(`
      CREATE TABLE IF NOT EXISTS flujo_visual (
        id TEXT PRIMARY KEY,
        nodes JSON NOT NULL,
        edges JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const exists = db.prepare(`SELECT id, nodes FROM flujo_visual WHERE id = 'default'`).get();
    if (!exists) {
      db.prepare(`INSERT INTO flujo_visual (id, nodes, edges) VALUES ('default', ?, ?)`).run(
        JSON.stringify(DEFAULT_NODES),
        JSON.stringify(DEFAULT_EDGES)
      );
    } else {
      // Si la fila existe pero tiene nodos vacíos (BD antigua), auto-seed
      try {
        const parsed = JSON.parse(exists.nodes);
        if (!parsed || parsed.length === 0) {
          db.prepare(`UPDATE flujo_visual SET nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'`).run(
            JSON.stringify(DEFAULT_NODES),
            JSON.stringify(DEFAULT_EDGES)
          );
        }
      } catch { /* ignorar errores de parse */ }
    }
  },

  getFlow() {
    const db = getDb();
    const row = db.prepare(`SELECT nodes, edges FROM flujo_visual WHERE id = 'default'`).get();
    if (!row) return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
    
    try {
      const nodes = JSON.parse(row.nodes);
      const edges = JSON.parse(row.edges);
      
      // Si la BD tiene arrays vacíos, devolver los defaults
      if (!nodes || nodes.length === 0) {
        return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
      }
      
      return { nodes, edges };
    } catch (e) {
      return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
    }
  },

  saveFlow(nodes, edges) {
    const db = getDb();
    const nodesJson = JSON.stringify(nodes);
    const edgesJson = JSON.stringify(edges);
    
    db.prepare(`
      UPDATE flujo_visual 
      SET nodes = ?, edges = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = 'default'
    `).run(nodesJson, edgesJson);
  },

  applyBrandTemplate(marca) {
    // Importación dinámica para evitar ciclos
    import('../../whatsapp/flows/defaultFlow.js').then(({ getFlowTemplate }) => {
      const template = getFlowTemplate(marca);
      this.saveFlow(template.nodes, template.edges);
    });
  }
};
