-- ══════════════════════════════════════════════════
-- ARETÉ — Script SQL para Supabase
-- Pega esto en: supabase.com → SQL Editor → Run
-- ══════════════════════════════════════════════════

-- 1. Registros diarios (sueño, estudio, gym)
CREATE TABLE IF NOT EXISTS registros (
  id         BIGSERIAL PRIMARY KEY,
  fecha      DATE UNIQUE NOT NULL,
  sueno      NUMERIC(3,1) NOT NULL DEFAULT 7,
  estudio    NUMERIC(3,1) NOT NULL DEFAULT 0,
  gym        BOOLEAN NOT NULL DEFAULT false,
  sensacion  SMALLINT CHECK (sensacion BETWEEN 1 AND 5),
  puntos     SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Log de gym por ejercicio
CREATE TABLE IF NOT EXISTS gym_log (
  id         BIGSERIAL PRIMARY KEY,
  fecha      DATE NOT NULL,
  ejercicio  TEXT NOT NULL,
  series     SMALLINT,
  reps       SMALLINT,
  peso       NUMERIC(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fecha, ejercicio)
);

-- 3. Elo semanal (se calcula cada viernes)
CREATE TABLE IF NOT EXISTS elo_semanal (
  id         BIGSERIAL PRIMARY KEY,
  semana     DATE UNIQUE NOT NULL,  -- fecha del viernes
  elo        SMALLINT NOT NULL,
  dias       SMALLINT,              -- días registrados esa semana
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════
-- PERMISOS (Row Level Security desactivado para uso personal)
-- Si quieres proteger con login, activa RLS y añade policies
-- ══════════════════════════════════════════════════
ALTER TABLE registros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_semanal ENABLE ROW LEVEL SECURITY;

-- Permite acceso total con anon key (solo tú tienes la URL)
CREATE POLICY "allow_all_registros"   ON registros   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_gym_log"     ON gym_log     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_elo_semanal" ON elo_semanal FOR ALL USING (true) WITH CHECK (true);
