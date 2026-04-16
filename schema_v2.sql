-- ==========================================
-- SADA Analytics v2 — Mejoras de tracking
-- Ejecutar en SQL Editor de Supabase
-- ==========================================

-- 1. Tabla de snapshots de horarios finales
CREATE TABLE IF NOT EXISTS schedule_snapshots (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE,
    visitor_id      UUID,
    mode            TEXT CHECK (mode IN ('manual', 'auto')),
    semester        TEXT,
    confirmed       BOOLEAN DEFAULT FALSE,      -- true = botón confirmado, false = auto-capture
    cursos          JSONB NOT NULL,              -- Array completo: asignatura, profesor, grupo, clave, sesiones
    total_creditos  INT,
    total_materias  INT,
    actividades     JSONB DEFAULT '[]',          -- Actividades extra del usuario
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_snapshots DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE ON schedule_snapshots TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

CREATE INDEX idx_snapshots_visitor ON schedule_snapshots(visitor_id);
CREATE INDEX idx_snapshots_confirmed ON schedule_snapshots(confirmed);

-- 2. Tabla de popularidad de profesores (detallada)
CREATE TABLE IF NOT EXISTS professor_stats (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    semester        TEXT NOT NULL,
    materia_name    TEXT NOT NULL,
    profesor        TEXT NOT NULL,
    grupo           TEXT,
    clave           TEXT,
    times_selected  INT DEFAULT 0,
    times_in_final  INT DEFAULT 0,              -- Veces que terminó en horario confirmado
    last_used       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(semester, materia_name, profesor)
);

ALTER TABLE professor_stats DISABLE ROW LEVEL SECURITY;
GRANT INSERT, UPDATE ON professor_stats TO anon;

CREATE INDEX idx_prof_stats_semester ON professor_stats(semester);

-- 3. Función RPC para incrementar professor_stats
CREATE OR REPLACE FUNCTION increment_prof_stat(
    p_semester TEXT,
    p_materia TEXT,
    p_profesor TEXT,
    p_grupo TEXT,
    p_clave TEXT,
    p_field TEXT  -- 'selected' o 'final'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO professor_stats (semester, materia_name, profesor, grupo, clave, times_selected, times_in_final)
    VALUES (p_semester, p_materia, p_profesor, p_grupo, p_clave,
        CASE WHEN p_field = 'selected' THEN 1 ELSE 0 END,
        CASE WHEN p_field = 'final' THEN 1 ELSE 0 END
    )
    ON CONFLICT (semester, materia_name, profesor)
    DO UPDATE SET
        times_selected = professor_stats.times_selected + CASE WHEN p_field = 'selected' THEN 1 ELSE 0 END,
        times_in_final = professor_stats.times_in_final + CASE WHEN p_field = 'final' THEN 1 ELSE 0 END,
        last_used = NOW(),
        grupo = COALESCE(NULLIF(p_grupo, ''), professor_stats.grupo),
        clave = COALESCE(NULLIF(p_clave, ''), professor_stats.clave);
END;
$$ LANGUAGE plpgsql;

-- 4. Queries útiles con hora local México
-- Visitas hoy (hora México):
-- SELECT * FROM sessions WHERE started_at AT TIME ZONE 'America/Mexico_City' >= CURRENT_DATE;

-- Horarios confirmados con detalle de profesores:
-- SELECT 
--   s.created_at AT TIME ZONE 'America/Mexico_City' as hora_local,
--   s.semester,
--   elem->>'asignatura' as materia,
--   elem->>'profesor' as profesor,
--   elem->>'grupo' as grupo
-- FROM schedule_snapshots s, jsonb_array_elements(s.cursos) as elem
-- WHERE s.confirmed = true
-- ORDER BY s.created_at DESC;

-- Top profesores elegidos en horarios finales:
-- SELECT profesor, materia_name, times_in_final, times_selected
-- FROM professor_stats
-- WHERE semester = '6'
-- ORDER BY times_in_final DESC;
