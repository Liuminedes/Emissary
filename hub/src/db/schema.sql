-- hub/src/db/schema.sql
-- Esquema multi-tenant del Hub. Deriva del esquema del escritorio (src/main/db/schema.sql):
-- cada tabla de datos lleva tenant_id y las claves primarias lo incluyen.

CREATE TABLE IF NOT EXISTS tenants (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  phone_number_id  TEXT UNIQUE,            -- id del número en Cloud API: enruta los webhooks al tenant
  marca            TEXT DEFAULT '',
  nombre_negocio   TEXT DEFAULT '',
  nombre_asesor    TEXT DEFAULT '',
  cargo            TEXT DEFAULT 'Asesor comercial',
  telefono         TEXT DEFAULT '',
  horario          TEXT DEFAULT 'L-V 8am-6pm',
  portfolio_url    TEXT DEFAULT '',
  created_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  step          TEXT DEFAULT 'WELCOME',
  push_name     TEXT DEFAULT '',
  advisor_took  INTEGER DEFAULT 0,
  handoff_mode  INTEGER DEFAULT 0,
  lead_json     TEXT DEFAULT '{}',
  catalog_json  TEXT DEFAULT '{}',
  created_at    INTEGER DEFAULT 0,
  updated_at    INTEGER DEFAULT 0,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  nombre        TEXT DEFAULT '',
  telefono      TEXT DEFAULT '',
  interes       TEXT DEFAULT '',
  presupuesto   TEXT DEFAULT '',
  empleo        TEXT DEFAULT '',
  ingreso       TEXT DEFAULT '',
  etapa         TEXT DEFAULT 'nuevo',
  calificacion  TEXT DEFAULT '❄️ Frío',
  created_at    INTEGER DEFAULT 0,
  updated_at    INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_user ON leads (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS excluidos (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telefono   TEXT NOT NULL,
  PRIMARY KEY (tenant_id, telefono)
);

CREATE TABLE IF NOT EXISTS config_global (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS flujo_visual (
  tenant_id   INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  nodes       TEXT NOT NULL,
  edges       TEXT NOT NULL,
  updated_at  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalogo_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categoria    TEXT DEFAULT 'General',
  nombre       TEXT NOT NULL,
  emoji        TEXT DEFAULT '',
  descripcion  TEXT DEFAULT '',
  specs_json   TEXT DEFAULT '{}',
  sort_order   INTEGER DEFAULT 0,
  active       INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_catalogo_tenant ON catalogo_items (tenant_id);

CREATE TABLE IF NOT EXISTS catalogo_variantes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id  INTEGER NOT NULL REFERENCES catalogo_items(id) ON DELETE CASCADE,
  version  TEXT NOT NULL,
  precio   REAL DEFAULT 0,
  bono     REAL DEFAULT 0,
  nota     TEXT DEFAULT '',
  year     INTEGER DEFAULT 0
);

-- origen: cliente | bot | asesor
CREATE TABLE IF NOT EXISTS historial (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  origen      TEXT NOT NULL,
  texto       TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_historial_tenant_user ON historial (tenant_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial (created_at);
