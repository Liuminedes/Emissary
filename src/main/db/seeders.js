import { getDb } from './db.js';
import { CatalogoRepo } from './repositories/catalogo.repo.js';

const KIA_VEHICLES = [
  { id: 1, name: "The Kia Soluto", year: 2026, category: "Sedán", tag: "Gasolina", description: "Kia Soluto con diseño eficiente.", specs: { "Motor": "1.4L" }, trims: [{ version: "Soluto 1.4L", precio: 66990000 }] },
  { id: 2, name: "The all-new K3 Sedán", year: 2025, category: "Sedán", tag: "Gasolina", description: "El nuevo K3 Sedán.", specs: { "Motor": "1.6L" }, trims: [{ version: "K3 Sedán", precio: 79990000 }] },
  { id: 3, name: "The all-new Kia K3 Cross", year: 2025, category: "Crossover", tag: "Gasolina", description: "K3 versión Cross.", specs: { "Motor": "1.6L" }, trims: [{ version: "K3 Cross", precio: 80990000 }] },
  { id: 4, name: "The Kia K4", year: 2025, category: "Sedán", tag: "Gasolina", description: "Kia K4 avanzado.", specs: { "Motor": "2.0L" }, trims: [{ version: "K4", precio: 129990000 }] },
  { id: 5, name: "The New Kia Picanto", year: 2025, category: "Hatchback", tag: "Gasolina", description: "Nuevo Kia Picanto.", specs: { "Motor": "1.0L / 1.2L" }, trims: [{ version: "Picanto", precio: 58990000 }] },
  { id: 6, name: "The New Kia Stonic", year: 2025, category: "SUV", tag: "Híbrido", description: "Kia Stonic Híbrido MHEV.", specs: { "Motor": "1.0L Turbo MHEV" }, trims: [{ version: "Stonic Híbrida", precio: 86990000 }] },
  { id: 7, name: "The New Kia Niro", year: 2025, category: "SUV", tag: "Híbrido", description: "Kia Niro Híbrido.", specs: { "Motor": "1.6L Híbrido" }, trims: [{ version: "Niro Híbrida", precio: 116990000 }] },
  { id: 8, name: "The all-new Kia Seltos", year: 2025, category: "SUV", tag: "Gasolina", description: "Kia Seltos.", specs: { "Motor": "2.0L" }, trims: [{ version: "Seltos", precio: 119990000 }] },
  { id: 9, name: "The Kia Sonet", year: 2025, category: "SUV", tag: "Gasolina", description: "Kia Sonet.", specs: { "Motor": "1.5L" }, trims: [{ version: "Sonet", precio: 89990000 }] },
  { id: 10, name: "The New Kia Sportage", year: 2026, category: "SUV", tag: "Gasolina", description: "Nueva Kia Sportage.", specs: { "Motor": "2.0L" }, trims: [{ version: "Sportage", precio: 130990000 }] },
  { id: 11, name: "The New Kia Sorento", year: 2025, category: "SUV", tag: "Gasolina", description: "Kia Sorento familiar.", specs: { "Motor": "2.5L" }, trims: [{ version: "Sorento", precio: 230990000 }] },
  { id: 12, name: "The Kia Carnival Hibrida", year: 2025, category: "Van", tag: "Híbrido", description: "Carnival Híbrida.", specs: { "Motor": "1.6L Turbo Híbrido" }, trims: [{ version: "Carnival Híbrida", precio: 270990000 }] },
  { id: 13, name: "The Kia Tasman", year: 2025, category: "Pick-Up", tag: "Diésel", description: "Kia Tasman pickup.", specs: { "Motor": "2.2L Diésel" }, trims: [{ version: "Tasman", precio: 190990000 }] },
  { id: 14, name: "The Kia EV2", year: 2025, category: "SUV", tag: "Eléctrico", description: "Kia EV2 100% Eléctrico.", specs: { "Motor": "Eléctrico" }, trims: [{ version: "EV2", precio: 109990000 }] },
  { id: 15, name: "The Kia EV3", year: 2025, category: "SUV", tag: "Eléctrico", description: "Kia EV3 Eléctrico.", specs: { "Motor": "Eléctrico" }, trims: [{ version: "EV3", precio: 125990000 }] },
  { id: 16, name: "The Kia EV5", year: 2025, category: "SUV", tag: "Eléctrico", description: "Kia EV5 Eléctrico.", specs: { "Motor": "Eléctrico" }, trims: [{ version: "EV5", precio: 140990000 }] },
  { id: 17, name: "The New Kia EV6", year: 2025, category: "SUV", tag: "Eléctrico", description: "Nuevo Kia EV6 Eléctrico.", specs: { "Motor": "Eléctrico" }, trims: [{ version: "EV6", precio: 252990000 }] },
  { id: 18, name: "The Kia EV9", year: 2025, category: "SUV", tag: "Eléctrico", description: "Kia EV9 Eléctrico 3 filas.", specs: { "Motor": "Eléctrico" }, trims: [{ version: "EV9", precio: 360990000 }] }
];

const VW_VEHICLES = [
  { id: 1, name: "Polo Track", year: 2026, category: "Hatchback", tag: "Gasolina", description: "Polo Track 1.6L.", specs: { "Motor": "1.6L 113 HP 5MT" }, trims: [{ version: "Track 1.6L 5MT", precio: 66990000 }] },
  { id: 2, name: "Polo", year: 2026, category: "Hatchback", tag: "Gasolina", description: "El Polo reinventado.", specs: { "Motor base": "1.6L 110 HP" }, trims: [{ version: "Trendline 1.6L 5MT", precio: 74990000 }, { version: "PA Highline 1.0L AT", precio: 79990000 }] },
  { id: 3, name: "Virtus", year: 2026, category: "Sedán", tag: "Gasolina", description: "Sedán compacto 1.0 TSI.", specs: { "Motor": "1.0L TSI Turbo AT" }, trims: [{ version: "PA Comfortline Select 1.0 TSI AT", precio: 90990000 }] },
  { id: 4, name: "Jetta", year: 2026, category: "Sedán", tag: "Gasolina", description: "Sedán de referencia.", specs: { "Motor": "250 TSI AT" }, trims: [{ version: "PA Highline 250 TSI AT", precio: 111990000 }, { version: "PA GLI 350 TSI AT", precio: 159990000 }] },
  { id: 5, name: "Tera", year: 2026, category: "SUV", tag: "Gasolina", description: "Nueva SUV compacta.", specs: { "Motor base": "1.6L" }, trims: [{ version: "Trend 1.6L MT", precio: 77990000 }, { version: "High Black Edition 1.0AT", precio: 101990000 }] },
  { id: 6, name: "Nivus", year: 2027, category: "SUV", tag: "Gasolina", description: "SUV coupé con actitud.", specs: { "Motor": "1.0L 200 TSI 6AT" }, trims: [{ version: "PA Comfortline", precio: 87990000 }, { version: "PA Highline", precio: 96990000 }] },
  { id: 7, name: "T-Cross", year: 2026, category: "SUV", tag: "Gasolina", description: "SUV urbana por excelencia.", specs: { "Motor": "1.0L 200 TSI 6AT" }, trims: [{ version: "Trendline 170 TSI MT", precio: 86990000 }, { version: "Comfortline 200 TSI 6AT", precio: 109990000 }] },
  { id: 8, name: "Taos", year: 2026, category: "SUV", tag: "Gasolina", description: "SUV mediana.", specs: { "Motor": "250 TSI AT" }, trims: [{ version: "Comfortline", precio: 117990000 }, { version: "Highline", precio: 127990000 }] },
  { id: 9, name: "Tiguan", year: 2026, category: "SUV", tag: "Gasolina", description: "SUV insignia.", specs: { "Motor": "250 TSI Turbo" }, trims: [{ version: "NF Life 250 TSI", precio: 146990000 }, { version: "NF R-Line 250 TSI", precio: 162990000 }] },
  { id: 10, name: "Tiguan MHEV", year: 2026, category: "SUV", tag: "Híbrido", description: "Primer VW híbrido.", specs: { "Motor": "1.5L eTSI Turbo Mild-Hybrid 48V" }, trims: [{ version: "R-Line 1.5 eTSI MHEV", precio: 166990000 }] },
  { id: 11, name: "Teramont", year: 2026, category: "SUV", tag: "Gasolina", description: "SUV grande 7 pasajeros.", specs: { "Motor": "2.0L 269 HP AT" }, trims: [{ version: "PA Highline 2.0L 269HP", precio: 250990000 }] },
  { id: 12, name: "Saveiro", year: 2027, category: "Pick-Up", tag: "Gasolina", description: "Pickup compacta.", specs: { "Motor": "1.6L 5MT" }, trims: [{ version: "Cabina Sencilla", precio: 70990000 }] },
  { id: 13, name: "Amarok", year: 2026, category: "Pick-Up", tag: "Diésel", description: "Pickup premium definitiva.", specs: { "Motor": "V6 Turbo Diésel" }, trims: [{ version: "V6 Comfortline", precio: 220990000 }, { version: "V6 Extreme", precio: 247990000 }] }
];

export function seedCatalog(marca) {
  const db = getDb();
  
  // Borrar catálogo actual para inyectar el nuevo
  db.prepare('DELETE FROM catalogo_items').run();
  
  let vehiclesToSeed = [];
  if (marca === 'KIA') {
    vehiclesToSeed = KIA_VEHICLES;
  } else if (marca === 'Volkswagen') {
    vehiclesToSeed = VW_VEHICLES;
  }
  
  for (const v of vehiclesToSeed) {
    const item = {
      categoria: v.category,
      nombre: v.name,
      emoji: v.tag,
      descripcion: v.description,
      specs: v.specs,
      sort_order: v.id,
      variantes: v.trims.map(t => ({
        version: t.version,
        precio: t.precio,
        bono: 0,
        nota: '',
        year: v.year
      }))
    };
    CatalogoRepo.upsertItem(item);
  }
}
