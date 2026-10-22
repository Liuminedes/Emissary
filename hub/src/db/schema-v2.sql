-- hub/src/db/schema-v2.sql
-- Fase 3: consentimiento, límites de envío, campañas y control de costos.

-- Ajustes por tenant. Las tarifas son ESTIMADAS y las pone el operador (0 = sin tarifa configurada):
-- Meta cambia sus precios y no se asume ninguno.
ALTER TABLE tenants ADD COLUMN limite_diario_max INTEGER DEFAULT 250;
ALTER TABLE tenants ADD COLUMN presupuesto_mensual_usd REAL DEFAULT 0;   -- 0 = sin tope
ALTER TABLE tenants ADD COLUMN tarifa_marketing_usd REAL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN tarifa_utility_usd REAL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN hora_inicio INTEGER DEFAULT 9;
ALTER TABLE tenants ADD COLUMN hora_fin INTEGER DEFAULT 19;
ALTER TABLE tenants ADD COLUMN zona_horaria TEXT DEFAULT 'America/Bogota';

-- Registro de consentimiento. Que un cliente escriba habilita responderle (ventana de servicio),
-- pero NO es consentimiento de marketing: ese solo se marca con marketing_opt_in.
CREATE TABLE IF NOT EXISTS contactos (
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL,
  marketing_opt_in  INTEGER DEFAULT 0,
  opt_in_at         INTEGER,
  opt_in_fuente     TEXT,
  opted_out         INTEGER DEFAULT 0,
  opted_out_at      INTEGER,
  last_inbound_at   INTEGER,
  last_campaign_at  INTEGER,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS campanas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  plantilla     TEXT NOT NULL,
  idioma        TEXT DEFAULT 'es',
  categoria     TEXT NOT NULL CHECK (categoria IN ('marketing', 'utility')),
  estado        TEXT NOT NULL DEFAULT 'borrador',  -- borrador | en_curso | pausada | completa
  motivo_pausa  TEXT,
  created_at    INTEGER NOT NULL,
  started_at    INTEGER
);

CREATE TABLE IF NOT EXISTS campana_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campana_id  INTEGER NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  estado      TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | enviado | fallido | omitido
  motivo      TEXT,
  message_id  TEXT,
  costo_usd   REAL DEFAULT 0,
  sent_at     INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_campana_user ON campana_items (campana_id, user_id);
CREATE INDEX IF NOT EXISTS idx_items_tenant_sent ON campana_items (tenant_id, sent_at);

-- Consumo por día y categoría (service = respuestas dentro de la ventana de 24 h)
CREATE TABLE IF NOT EXISTS uso (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dia        TEXT NOT NULL,                        -- YYYY-MM-DD en la zona horaria del tenant
  categoria  TEXT NOT NULL,                        -- service | marketing | utility
  cantidad   INTEGER DEFAULT 0,
  costo_usd  REAL DEFAULT 0,
  PRIMARY KEY (tenant_id, dia, categoria)
);
