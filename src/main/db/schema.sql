-- src/main/db/schema.sql
-- Emissary — esquema local (SQLite). Una sola instalación = un solo negocio.

CREATE TABLE IF NOT EXISTS negocio (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  marca             TEXT DEFAULT '',          -- ej: 'KIA', 'Volkswagen', 'Clinica X', libre
  nombre_negocio    TEXT DEFAULT '',
  nombre_asesor     TEXT DEFAULT '',
  cargo             TEXT DEFAULT 'Asesor comercial',
  telefono          TEXT DEFAULT '',          -- número del asesor, para detectar sus propios mensajes
  horario           TEXT DEFAULT 'L-V 8am-6pm',
  portfolio_url     TEXT DEFAULT '',
  scrape_url        TEXT DEFAULT '',
  scrape_selector   TEXT DEFAULT '',
  color_acento      TEXT DEFAULT '#0C447C',
  logo_path         TEXT DEFAULT '',
  auto_launch       INTEGER DEFAULT 1,
  setup_completo    INTEGER DEFAULT 0,
  updated_at        INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS catalogo_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria     TEXT DEFAULT 'General',
  nombre        TEXT NOT NULL,
  emoji         TEXT DEFAULT '',
  descripcion   TEXT DEFAULT '',
  specs_json    TEXT DEFAULT '{}',
  sort_order    INTEGER DEFAULT 0,
  active        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS catalogo_variantes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES catalogo_items(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  precio        REAL DEFAULT 0,
  bono          REAL DEFAULT 0,
  nota          TEXT DEFAULT '',
  year          INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mensajes (
  step_key    TEXT PRIMARY KEY,
  contenido   TEXT NOT NULL,
  updated_at  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sesiones (
  user_id       TEXT PRIMARY KEY,
  step          TEXT DEFAULT 'WELCOME',
  push_name     TEXT DEFAULT '',
  advisor_took  INTEGER DEFAULT 0,
  handoff_mode  INTEGER DEFAULT 0,
  lead_json     TEXT DEFAULT '{}',
  catalog_json  TEXT DEFAULT '{}',
  created_at    INTEGER DEFAULT 0,
  updated_at    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS leads (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  nombre          TEXT DEFAULT '',
  telefono        TEXT DEFAULT '',
  interes         TEXT DEFAULT '',
  presupuesto     TEXT DEFAULT '',
  empleo          TEXT DEFAULT '',
  ingreso         TEXT DEFAULT '',
  etapa           TEXT DEFAULT 'nuevo',   -- nuevo | cotizando | negociacion | cerrado | perdido
  calificacion    TEXT DEFAULT '❄️ Frío',
  created_at      INTEGER DEFAULT 0,
  updated_at      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS excluidos (
  telefono TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS config_global (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS flujo_visual (
  id TEXT PRIMARY KEY,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  updated_at INTEGER DEFAULT 0
);

-- Historial de conversaciones. origen: cliente | bot | asesor
CREATE TABLE IF NOT EXISTS historial (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  origen      TEXT NOT NULL,
  texto       TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_historial_user ON historial (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial (created_at);

-- Cuentas locales (bloqueo de la interfaz). role: admin | asesor
CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'asesor',
  created_at     INTEGER DEFAULT 0
);
