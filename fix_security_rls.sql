-- ==========================================
-- SADA — FIX DE SEGURIDAD: Habilitar RLS
-- Ejecutar COMPLETO en SQL Editor de Supabase
-- Fecha: 2026-04-16
-- ==========================================
-- 
-- ¿Qué hace este script?
--   1. Habilita Row Level Security (RLS) en TODAS las tablas
--   2. Crea políticas que SOLO permiten INSERT/UPDATE desde "anon"
--   3. NADIE puede leer (SELECT) ni borrar (DELETE) datos vía API
--   4. Tú sigues viendo todo desde el Dashboard de Supabase (rol "postgres")
--   5. La app sigue funcionando normalmente
--
-- ⚠️  IMPORTANTE: Ejecuta TODO el script de una sola vez.
-- ==========================================


-- ──────────────────────────────────────────
-- 1. TABLA: visitors
--    Operación: INSERT (upsert por id)
-- ──────────────────────────────────────────

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas viejas si existen
DROP POLICY IF EXISTS "anon_insert_visitors" ON visitors;
DROP POLICY IF EXISTS "anon_update_visitors" ON visitors;

-- Permitir INSERT desde anon (para registrar visitantes)
CREATE POLICY "anon_insert_visitors"
  ON visitors FOR INSERT
  TO anon
  WITH CHECK (true);

-- Permitir UPDATE desde anon (para upsert de last_seen)
CREATE POLICY "anon_update_visitors"
  ON visitors FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- SELECT y DELETE: NO se crean políticas → BLOQUEADOS para anon ✓


-- ──────────────────────────────────────────
-- 2. TABLA: sessions
--    Operación: INSERT + UPDATE (cerrar sesión)
-- ──────────────────────────────────────────

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
DROP POLICY IF EXISTS "anon_update_sessions" ON sessions;

CREATE POLICY "anon_insert_sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Permitir UPDATE para cerrar sesión (ended_at, duration_sec, mode_used)
CREATE POLICY "anon_update_sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


-- ──────────────────────────────────────────
-- 3. TABLA: events
--    Operación: INSERT (solo insertar eventos)
-- ──────────────────────────────────────────

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_events" ON events;

CREATE POLICY "anon_insert_events"
  ON events FOR INSERT
  TO anon
  WITH CHECK (true);


-- ──────────────────────────────────────────
-- 4. TABLA: schedule_snapshots
--    Operación: INSERT (guardar horarios)
-- ──────────────────────────────────────────

ALTER TABLE schedule_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_snapshots" ON schedule_snapshots;

CREATE POLICY "anon_insert_snapshots"
  ON schedule_snapshots FOR INSERT
  TO anon
  WITH CHECK (true);


-- ──────────────────────────────────────────
-- 5. TABLA: generated_schedules
--    Operación: INSERT (registrar generaciones)
-- ──────────────────────────────────────────

ALTER TABLE generated_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_generated" ON generated_schedules;

CREATE POLICY "anon_insert_generated"
  ON generated_schedules FOR INSERT
  TO anon
  WITH CHECK (true);


-- ──────────────────────────────────────────
-- 6. TABLA: professor_stats
--    Operación: INSERT + UPDATE (vía RPC upsert)
-- ──────────────────────────────────────────

ALTER TABLE professor_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_prof_stats" ON professor_stats;
DROP POLICY IF EXISTS "anon_update_prof_stats" ON professor_stats;

CREATE POLICY "anon_insert_prof_stats"
  ON professor_stats FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_prof_stats"
  ON professor_stats FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


-- ──────────────────────────────────────────
-- 7. TABLA: materia_stats (si existe, por el RPC increment_materia_stat)
--    Operación: INSERT + UPDATE (vía RPC upsert)
-- ──────────────────────────────────────────

-- Nota: Si esta tabla no existe, estas líneas darán error y puedes ignorarlas.
-- Si sí existe, se protege igual que professor_stats.

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materia_stats') THEN
    EXECUTE 'ALTER TABLE materia_stats ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "anon_insert_materia_stats" ON materia_stats';
    EXECUTE 'DROP POLICY IF EXISTS "anon_update_materia_stats" ON materia_stats';
    EXECUTE 'CREATE POLICY "anon_insert_materia_stats" ON materia_stats FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "anon_update_materia_stats" ON materia_stats FOR UPDATE TO anon USING (true) WITH CHECK (true)';
    RAISE NOTICE 'materia_stats: RLS habilitado ✓';
  ELSE
    RAISE NOTICE 'materia_stats: tabla no encontrada, omitida.';
  END IF;
END $$;


-- ──────────────────────────────────────────
-- 8. FUNCIONES RPC: Asegurar que usen SECURITY DEFINER
--    Esto permite que las funciones RPC ejecuten con 
--    permisos de "postgres" (bypass RLS), necesario para 
--    el upsert en professor_stats y materia_stats.
-- ──────────────────────────────────────────

-- Recrear increment_prof_stat como SECURITY DEFINER
CREATE OR REPLACE FUNCTION increment_prof_stat(
    p_semester TEXT,
    p_materia TEXT,
    p_profesor TEXT,
    p_grupo TEXT,
    p_clave TEXT,
    p_field TEXT
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ──────────────────────────────────────────
-- 9. VERIFICACIÓN: Comprobar que RLS está activo
-- ──────────────────────────────────────────

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;


-- ==========================================
-- ¡LISTO! Después de ejecutar:
-- ✅ RLS habilitado en todas las tablas
-- ✅ Solo INSERT/UPDATE permitido vía API
-- ✅ SELECT/DELETE bloqueados para usuarios anónimos
-- ✅ Tú ves todo en el Dashboard de Supabase
-- ✅ La app sigue funcionando normalmente
-- ==========================================
