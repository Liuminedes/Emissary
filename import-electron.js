import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';

app.whenReady().then(() => {
  const dbPath = path.join(process.env.APPDATA, 'Emissary', 'emissary.db');
  console.log('Opening DB at:', dbPath);

  const db = new Database(dbPath);

  db.prepare('DELETE FROM catalogo_variantes').run();
  db.prepare('DELETE FROM catalogo_items').run();

  const VEHICLES = [
    {
      id: 13,
      name: "Tiguan MHEV",
      year: "2026",
      category: "SUV",
      tag: "Híbrido",
      isNew: true,
      img: "https://www.volkswagen.co/dam/images/8c1512a53e28ba6012ca91759a43ff704785b555/af06aa7580a7aaa2313314a578f9760d/3f3911f3-f175-4f11-8bb1-ad058b23be51/crop:SMART/resize:3840:2160/Placa-nacar-carrusel",
      description: "El primer Volkswagen híbrido que llega a Cali. Fabricado en Wolfsburg, Alemania, con tecnología Mild-Hybrid eTSI de 48V, pantalla de 15\" y el ADN deportivo R-Line — la puerta de entrada a la era híbrida de VW en Colombia.",
      specs: {
        "Motor": "1.5L eTSI Turbo Mild-Hybrid 48V",
        "Potencia": "150 HP · 250 Nm",
        "Transmisión": "Automática DSG 7 vel.",
        "Combustible": "Gasolina + Mild-Hybrid",
        "Origen": "Wolfsburg, Alemania",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "R-Line 1.5 eTSI MHEV", year: 2026, precio: 166990000, bono: 1000000, nota: "Tecnología Mild-Hybrid (MHEV) 48V · IVA reducido 5%" },
      ]
    },
    {
      id: 1,
      name: "Polo Track",
      year: "2026",
      category: "Hatchback",
      tag: "Gasolina",
      description: "El punto de entrada a la familia VW. Polo Track 1.6L 113HP manual, diseño compacto y tecnología que supera su segmento. La opción más accesible con sello alemán.",
      specs: {
        "Motor": "1.6L 113 HP 5MT",
        "Transmisión": "Manual 5 velocidades",
        "Combustible": "Gasolina",
        "Carrocería": "Hatchback 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "Track 1.6L 5MT", year: 2026, precio: 66990000, bono: 1000000 },
      ]
    },
    {
      id: 2,
      name: "Polo",
      year: "2026",
      category: "Hatchback",
      tag: "Gasolina",
      description: "El Polo reinventado. Versiones 1.6L manual y 1.0L turbo automático con eficiencia superior, pantalla táctil, conectividad y el ADN deportivo de VW.",
      specs: {
        "Motor base": "1.6L 110 HP 5MT",
        "Motor PA": "1.0L Turbo AT",
        "Combustible": "Gasolina",
        "Carrocería": "Hatchback 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "Trendline 1.6L 5MT",    year: 2026, precio: 74990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "PA Comfortline 1.0L AT", year: 2026, precio: 77990000, bono: 1000000, bonoAliados: 1500000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "PA Highline 1.0L AT",    year: 2026, precio: 79990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    },
    {
      id: 3,
      name: "Virtus",
      year: "2026",
      category: "Sedán",
      tag: "Gasolina",
      description: "Sedán compacto con motor 1.0 TSI turbo y caja automática. Elegante, espacioso y tecnológico — el sedán que lo tiene todo a un precio competitivo.",
      specs: {
        "Motor": "1.0L TSI Turbo AT",
        "Potencia": "116 HP",
        "Combustible": "Gasolina",
        "Carrocería": "Sedán 4 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "PA Comfortline Select 1.0 TSI AT", year: 2026, precio: 90990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    },
    {
      id: 4,
      name: "Jetta",
      year: "2026",
      category: "Sedán",
      tag: "Gasolina",
      description: "El sedán de referencia de Volkswagen. Motor 250 TSI y la versión GLI 350 TSI para quienes buscan performance real. Diseño premium, interior sofisticado.",
      specs: {
        "Motor Highline": "250 TSI AT",
        "Motor GLI": "350 TSI 228 HP AT",
        "Combustible": "Gasolina",
        "Carrocería": "Sedán 4 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "PA Highline 250 TSI AT", year: 2026, precio: 111990000, bono: 1000000 },
        { version: "PA GLI 350 TSI AT",      year: 2026, precio: 159990000, bono: 1000000 },
      ]
    },
    {
      id: 5,
      name: "Tera",
      year: "2026",
      category: "SUV",
      tag: "Gasolina",
      description: "La nueva SUV compacta de VW diseñada para Latinoamérica. Robusta, versátil y con opciones 1.6L manual y 1.0L turbo automático. Hasta 5 versiones disponibles.",
      specs: {
        "Motor base": "1.6L 110 HP 5MT",
        "Motor alto": "1.0L Turbo AT",
        "Combustible": "Gasolina",
        "Carrocería": "SUV 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "Trend 1.6L MT",           year: 2026, precio: 77990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "Comfort 1.6L MT",          year: 2026, precio: 82990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "Comfort 1.0L AT",          year: 2026, precio: 86990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "High 1.0L AT",             year: 2026, precio: 95990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "High Black Edition 1.0AT", year: 2026, precio: 101990000, bono: 1000000, bonoAliados: 2000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    },
    {
      id: 6,
      name: "Nivus",
      year: "2027",
      category: "SUV",
      tag: "Gasolina",
      description: "SUV coupé con actitud. Motor 1.0L 200 TSI de alta eficiencia, caja automática de 6 velocidades y líneas de fastback que la hacen única en su segmento.",
      specs: {
        "Motor": "1.0L 200 TSI 6AT",
        "Potencia": "116 HP",
        "Combustible": "Gasolina",
        "Carrocería": "SUV Coupé",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "PA Comfortline 1.0L 200TSI 6AT",   year: 2027, precio: 87990000, bono: 1000000 },
        { version: "PA Highline 1.0L 200TSI 6AT",      year: 2027, precio: 96990000, bono: 1000000 },
        { version: "PA Black Edition 1.0L 200TSI 6AT", year: 2027, precio: 99990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    },
    {
      id: 7,
      name: "T-Cross",
      year: "2026",
      category: "SUV",
      tag: "Gasolina",
      description: "La SUV urbana por excelencia de VW. Motor 1.0L 200 TSI turbo, diseño moderno y conectividad total. Tres versiones para elegir según tu estilo de vida.",
      specs: {
        "Motor base": "170 TSI MT",
        "Motor alto": "1.0L 200 TSI 6AT",
        "Combustible": "Gasolina",
        "Carrocería": "SUV 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "PA Trendline 170 TSI MT",         year: 2026, precio: 86990000, bono: 1000000, bonoAliados: 1000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "PA Trendline ST 200 TSI AT",       year: 2026, precio: 94990000, bono: 1000000 },
        { version: "PA Comfortline 200 TSI 6AT",       year: 2026, precio: 109990000, bono: 1000000 },
      ]
    },
    {
      id: 8,
      name: "Taos",
      year: "2026",
      category: "SUV",
      tag: "Gasolina",
      description: "SUV mediana con motor 250 TSI de alto rendimiento y transmisión automática. Espacio premium, tecnología de vanguardia y carácter netamente alemán.",
      specs: {
        "Motor": "250 TSI AT",
        "Combustible": "Gasolina",
        "Carrocería": "SUV 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "Comfortline 250 TSI AT",  year: 2026, precio: 117990000, bono: 1000000 },
        { version: "Highline SE 250 TSI AT",  year: 2026, precio: 127990000, bono: 1000000 },
      ]
    },
    {
      id: 9,
      name: "Tiguan",
      year: "2026",
      category: "SUV",
      tag: "Gasolina",
      description: "El SUV insignia de Volkswagen, completamente renovado. Motor 250 TSI, versión R-Line con equipamiento deportivo exclusivo. Presencia y tecnología sin concesiones.",
      specs: {
        "Motor": "250 TSI Turbo",
        "Combustible": "Gasolina",
        "Carrocería": "SUV 5 puertas",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "NF Life 250 TSI",    year: 2026, precio: 146990000, bono: 1000000 },
        { version: "NF R-Line 250 TSI",  year: 2026, precio: 162990000, bono: 1000000 },
      ]
    },
    {
      id: 10,
      name: "Teramont",
      year: "2026",
      category: "SUV",
      tag: "Gasolina",
      description: "El SUV grande de 7 pasajeros de Volkswagen. Motor 2.0L 269HP, 3 filas de asientos, tecnología premium y el estándar más alto de la gama SUV de VW en Colombia.",
      specs: {
        "Motor": "2.0L 269 HP AT",
        "Pasajeros": "7",
        "Combustible": "Gasolina",
        "Carrocería": "SUV Grande 7 pax",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "PA Highline 2.0L 269HP", year: 2026, precio: 250990000, bono: 1000000, bonoAliados: 5000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    },
    {
      id: 11,
      name: "Saveiro",
      year: "2027",
      category: "Pick-Up",
      tag: "Gasolina",
      description: "La pickup compacta más versátil del mercado. Motor 1.6L con caja manual, ideal para trabajo y aventura. Confiabilidad alemana en formato utilitario.",
      specs: {
        "Motor": "1.6L 5MT",
        "Combustible": "Gasolina",
        "Carrocería": "Pick-Up Cabina Sencilla",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "Cabina Sencilla 1.6L MT", year: 2027, precio: 70990000, bono: 1000000 },
      ]
    },
    {
      id: 12,
      name: "Amarok",
      year: "2026",
      category: "Pick-Up",
      tag: "Diésel",
      description: "La pickup premium definitiva. Motor V6 4Motion con tracción 4x4 permanente y caja automática. Tres versiones: Comfortline, Highline y la exclusiva Extreme.",
      specs: {
        "Motor": "V6 Turbo Diésel 4Motion",
        "Tracción": "4x4 permanente AT",
        "Combustible": "Diésel",
        "Carrocería": "Pick-Up Doble Cabina",
        "Garantía": "3 años o 100.000 km",
      },
      trims: [
        { version: "V6 Comfortline 4x4 AT DC", year: 2026, precio: 220990000, bono: 1000000, bonoAliados: 5000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "V6 Highline 4x4 AT DC",    year: 2026, precio: 234990000, bono: 1000000, bonoAliados: 5000000, nota: "Bono aplica financiando con aliados PoMo" },
        { version: "V6 Extreme 4x4 AT DC",     year: 2026, precio: 247990000, bono: 1000000, bonoAliados: 5000000, nota: "Bono aplica financiando con aliados PoMo" },
      ]
    }
  ];

  let inserted = 0;
  for (const v of VEHICLES) {
    const item = {
      categoria: v.category,
      nombre: v.name,
      emoji: v.tag,
      descripcion: v.description,
      specs_json: JSON.stringify(v.specs),
      sort_order: v.id,
      variantes: v.trims.map(t => ({
        version: t.version,
        precio: t.precio,
        bono: t.bono || 0 + (t.bonoAliados || 0),
        nota: t.nota || '',
        year: t.year || parseInt(v.year) || 2026
      }))
    };

    const info = db.prepare(`
      INSERT INTO catalogo_items (categoria, nombre, emoji, descripcion, specs_json, sort_order, active)
      VALUES (@categoria, @nombre, @emoji, @descripcion, @specs_json, @sort_order, 1)
    `).run(item);

    const insertVar = db.prepare(`
      INSERT INTO catalogo_variantes (item_id, version, precio, bono, nota, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const t of item.variantes) {
      insertVar.run(info.lastInsertRowid, t.version, t.precio, t.bono, t.nota, t.year);
    }
    
    inserted++;
  }
  console.log('Importados ' + inserted + ' vehículos correctamente.');
  app.quit();
});
