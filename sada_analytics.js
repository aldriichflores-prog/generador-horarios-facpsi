// ==========================================
// SADA — Generador de Horarios FACPSI UNAM
// sada_analytics.js v2 — Analíticas completas
// ==========================================
 
window.SadaAnalytics = (function () {
 
    const SUPABASE_URL = 'https://qxfsjplcehcjqmsquahz.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4ZnNqcGxjZWhjanFtc3F1YWh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjcxNjUsImV4cCI6MjA4OTM0MzE2NX0.cDI-yLHUfATuUccJFbWDcaQntune2k337guQo-MFXaM';
 
    let _visitorId = null;
    let _sessionId = null;
    let _sessionStart = null;
    let _initialized = false;
    let _queue = [];
    let _flushTimer = null;
    let _modesUsed = new Set();
    let _toolsUsed = new Set();
    let _lastSnapshotHash = '';
    const FLUSH_INTERVAL = 10000;
    const MAX_QUEUE = 50;
 
    // ══════════════════════════════════════════
    // SUPABASE REST CLIENT
    // ══════════════════════════════════════════
 
    async function supabaseInsert(table, data, upsertColumn) {
        try {
            const url = upsertColumn
                ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${upsertColumn}`
                : `${SUPABASE_URL}/rest/v1/${table}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': upsertColumn ? 'return=minimal,resolution=merge-duplicates' : 'return=minimal'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) { console.warn(`[SADA] Insert ${table}:`, await res.text()); return null; }
            return true;
        } catch (e) { console.warn(`[SADA] Net error (${table}):`, e.message); return null; }
    }
 
    async function supabaseUpdate(table, match, data) {
        try {
            const params = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join('&');
            await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify(data)
            });
        } catch (e) { /* silenciar */ }
    }
 
    async function supabaseRPC(fnName, params) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify(params)
            });
        } catch (e) { /* silenciar */ }
    }
 
    // ══════════════════════════════════════════
    // IDENTIFICACIÓN ANÓNIMA
    // ══════════════════════════════════════════
 
    function generateFingerprint() {
        const str = [
            navigator.userAgent, `${screen.width}x${screen.height}`,
            Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language,
            screen.colorDepth, navigator.hardwareConcurrency || 0,
            navigator.maxTouchPoints || 0, new Date().getTimezoneOffset()
        ].join('|');
        let hash = 0;
        for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
        return 'fp_' + Math.abs(hash).toString(36);
    }
 
    function fingerprintToUUID(fp) {
        let h1 = 0, h2 = 0, h3 = 0, h4 = 0;
        for (let i = 0; i < fp.length; i++) {
            const c = fp.charCodeAt(i);
            h1 = ((h1 << 5) - h1 + c) | 0; h2 = ((h2 << 7) - h2 + c) | 0;
            h3 = ((h3 << 11) - h3 + c) | 0; h4 = ((h4 << 13) - h4 + c) | 0;
        }
        const hex = (n) => (Math.abs(n) % 0xFFFF).toString(16).padStart(4, '0');
        return `${hex(h1)}${hex(h2)}-${hex(h3)}-4${hex(h4).slice(1)}-a${hex(h1^h3).slice(1)}-${hex(h2^h4)}${hex(h1^h4)}${hex(h2^h3)}`.toLowerCase();
    }
 
    function getOrCreateVisitorId() {
        const fp = generateFingerprint();
        const id = fingerprintToUUID(fp);
        localStorage.setItem('sada_visitor_id', id);
        localStorage.setItem('sada_fingerprint', fp);
        return id;
    }
 
    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
        if (/mobile|iphone|ipod|android.*mobile|opera m(ob|in)/i.test(ua)) return 'mobile';
        return 'desktop';
    }
 
    function getUTMParams() {
        const p = new URLSearchParams(window.location.search);
        return { utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'), utm_campaign: p.get('utm_campaign') };
    }
 
    function localISO() {
        const d = new Date();
        const offset = -d.getTimezoneOffset();
        const sign = offset >= 0 ? '+' : '-';
        const pad = (n) => String(Math.abs(n)).padStart(2, '0');
        const tz = `${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
        const iso = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + tz;
        return iso;
    }
 
    // ══════════════════════════════════════════
    // INICIALIZACIÓN
    // ══════════════════════════════════════════
 
    async function init() {
        if (_initialized) return;
        try {
            _visitorId = getOrCreateVisitorId();
            _sessionId = crypto.randomUUID();
            _sessionStart = new Date();
 
            await supabaseInsert('visitors', {
                id: _visitorId, fingerprint: localStorage.getItem('sada_fingerprint'),
                device_type: getDeviceType(), screen_width: screen.width, screen_height: screen.height,
                user_agent: navigator.userAgent.substring(0, 500),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language, last_seen: localISO()
            }, 'id');
 
            const utm = getUTMParams();
            await supabaseInsert('sessions', {
                id: _sessionId, visitor_id: _visitorId, referrer: document.referrer || null,
                utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign,
                landing_page: window.location.pathname, started_at: localISO()
            });
 
            _flushTimer = setInterval(flushQueue, FLUSH_INTERVAL);
 
            window.addEventListener('beforeunload', () => {
                flushQueue(true);
                closeSession();
            });
 
            document.addEventListener('visibilitychange', () => { if (document.hidden) flushQueue(true); });
 
            _initialized = true;
            console.log('[SADA Analytics] Inicializado ✓', { visitor: _visitorId.slice(0, 8), session: _sessionId.slice(0, 8) });
        } catch (e) {
            console.warn('[SADA Analytics] Init error:', e.message);
        }
    }
 
    // ══════════════════════════════════════════
    // COLA DE EVENTOS
    // ══════════════════════════════════════════
 
    function enqueueEvent(type, data) {
        if (!_initialized) return;
        _queue.push({ session_id: _sessionId, visitor_id: _visitorId, event_type: type, event_data: data || {}, created_at: localISO() });
        if (_queue.length >= MAX_QUEUE) flushQueue();
    }
 
    async function flushQueue(sync) {
        if (_queue.length === 0) return;
        const batch = [..._queue]; _queue = [];
        if (sync) {
            try { fetch(`${SUPABASE_URL}/rest/v1/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' }, body: JSON.stringify(batch), keepalive: true }); } catch (e) {}
        } else { await supabaseInsert('events', batch); }
    }
 
    function closeSession() {
        try {
            fetch(`${SUPABASE_URL}/rest/v1/sessions?id=eq.${_sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    ended_at: localISO(),
                    duration_sec: Math.round((Date.now() - _sessionStart.getTime()) / 1000),
                    mode_used: _modesUsed.size > 0 ? Array.from(_modesUsed) : null
                }),
                keepalive: true
            });
        } catch (e) {}
    }
 
    // ══════════════════════════════════════════
    // TRACKING: NAVEGACIÓN
    // ══════════════════════════════════════════
 
    function trackEntrarWorkspace(semestre) {
        enqueueEvent('enter_workspace', { semester: semestre });
        supabaseUpdate('sessions', { id: _sessionId }, { semester_used: semestre });
    }
 
    function trackCambiarSemestre(val) { enqueueEvent('change_semester', { semester: val }); }
 
    function trackCambiarModo(modo) {
        _modesUsed.add(modo);
        enqueueEvent('change_mode', { mode: modo });
    }
 
    // ══════════════════════════════════════════
    // TRACKING: MATERIAS Y CURSOS
    // ══════════════════════════════════════════
 
    function trackBuscarMateria(query, resultados, modo) {
        enqueueEvent('search_materia', { query, results_count: resultados, mode: modo });
    }
 
    function trackAgregarCurso(curso) {
        enqueueEvent('add_course', {
            materia: curso.asignatura, clave: curso.clave, grupo: curso.grupo,
            profesor: curso.profesor, semestre: curso.semestre, creditos: curso.creditos
        });
        supabaseRPC('increment_materia_stat', { p_semester: String(curso.semestre), p_materia: curso.asignatura, p_clave: curso.clave || '', p_field: 'selected' });
        supabaseRPC('increment_prof_stat', { p_semester: String(curso.semestre), p_materia: curso.asignatura, p_profesor: curso.profesor, p_grupo: curso.grupo, p_clave: curso.clave || '', p_field: 'selected' });
    }
 
    function trackEliminarCurso(curso) {
        enqueueEvent('remove_course', { materia: curso.asignatura, grupo: curso.grupo, profesor: curso.profesor });
    }
 
    function trackAgregarBolsa(materia, gruposCount, curso) {
        enqueueEvent('add_to_bolsa', {
            materia: materia, grupos_count: gruposCount,
            grupo: curso ? curso.grupo : '', profesor: curso ? curso.profesor : '',
            clave: curso ? curso.clave : ''
        });
    }
 
    // ══════════════════════════════════════════
    // TRACKING: HERRAMIENTAS
    // ══════════════════════════════════════════
 
    function trackHerramienta(tool, data) {
        _toolsUsed.add(tool);
        enqueueEvent('use_tool', { tool, ...(data || {}) });
    }
 
    // ══════════════════════════════════════════
    // TRACKING: GENERADOR
    // ══════════════════════════════════════════
 
    function trackGenerarCombinaciones(params) {
        enqueueEvent('generate_combinations', {
            materias_count: params.materiasCount, materias: params.materias,
            total_posibilidades: params.totalPosibilidades, resultados_validos: params.resultadosValidos,
            tiempo_ms: params.tiempoMs, cancelado: params.cancelado || false
        });
        supabaseInsert('generated_schedules', {
            session_id: _sessionId, visitor_id: _visitorId, mode: 'auto',
            semester: params.semestre, materias: params.materias,
            total_creditos: params.totalCreditos || 0, total_materias: params.materiasCount,
            combinations_found: params.resultadosValidos,
            combinations_shown: Math.min(params.resultadosValidos, 50),
            generation_time_ms: params.tiempoMs
        });
    }
 
    function trackAbrirCombinacion(idx, cursos) {
        enqueueEvent('open_combination', {
            index: idx,
            cursos: cursos.map(c => ({ materia: c.asignatura, profesor: c.profesor, grupo: c.grupo }))
        });
    }
 
    // ══════════════════════════════════════════
    // TRACKING: EXPORTACIÓN Y TRANSFERENCIA
    // ══════════════════════════════════════════
 
    function trackExportar(formato, datos) {
        datos = datos || {};
        enqueueEvent('export_schedule', { format: formato, mode: datos.modo || 'manual', materias_count: datos.materiasCount || 0, creditos_total: datos.creditosTotal || 0 });
    }
 
    function trackTransferir(idx, cursos) {
        enqueueEvent('transfer_to_manual', { combination_index: idx, materias_count: cursos.length, materias: cursos.map(c => c.asignatura) });
    }
 
    function trackFiltro(tipo, valor) { enqueueEvent('apply_filter', { filter_type: tipo, filter_value: valor }); }
    function trackPerfilSADA(accion, datos) { enqueueEvent('sada_profile', { action: accion, ...(datos || {}) }); }
    function trackCustom(name, data) { enqueueEvent(name, data || {}); }
 
    // ══════════════════════════════════════════
    // SNAPSHOTS DE HORARIO FINAL
    // ══════════════════════════════════════════
 
    function saveSnapshot(cursos, actividades, semester, mode, confirmed) {
        if (!_initialized || !cursos || cursos.length === 0) return;
 
        const hash = JSON.stringify(cursos.map(c => c.id_unico).sort());
        if (hash === _lastSnapshotHash && !confirmed) return;
        _lastSnapshotHash = hash;
 
        const cursosData = cursos.map(c => ({
            asignatura: c.asignatura, profesor: c.profesor, grupo: c.grupo,
            clave: c.clave, creditos: c.creditos, area: c.area || '',
            sesiones: c.sesiones.map(s => ({ dia: s.dia, inicio: s.inicio, fin: s.fin }))
        }));
        const actData = (actividades || []).map(a => ({
            nombre: a.asignatura, sesiones: a.sesiones.map(s => ({ dia: s.dia, inicio: s.inicio, fin: s.fin }))
        }));
        const totalCr = cursos.reduce((s, c) => s + (c.creditos || 0), 0);
 
        // Métricas precalculadas para análisis estadístico
        const allSesiones = cursos.flatMap(c => c.sesiones || []);
        const diasUnicos = new Set(allSesiones.map(s => s.dia));
        const minInicios = allSesiones.map(s => s.min_inicio).filter(v => v > 0);
        const maxFines = allSesiones.map(s => s.min_fin).filter(v => v > 0);
        const horaIniMin = minInicios.length > 0 ? Math.min(...minInicios) : null;
        const horaFinMax = maxFines.length > 0 ? Math.max(...maxFines) : null;
        let turno = null;
        if (horaIniMin !== null && horaFinMax !== null) {
            if (horaFinMax <= 840) turno = 'matutino';        // termina antes de 14:00
            else if (horaIniMin >= 780) turno = 'vespertino';  // inicia desde 13:00
            else turno = 'mixto';
        }
 
        supabaseInsert('schedule_snapshots', {
            session_id: _sessionId, visitor_id: _visitorId, mode: mode || 'manual',
            semester: semester || '', confirmed: confirmed, cursos: cursosData,
            total_creditos: totalCr, total_materias: cursos.length,
            actividades: actData, created_at: localISO(),
            dias_asistencia: diasUnicos.size,
            hora_inicio_min: horaIniMin,
            hora_fin_max: horaFinMax,
            turno: turno
        });
 
        enqueueEvent(confirmed ? 'confirm_final_schedule' : 'auto_snapshot', {
            mode, semester, total_materias: cursos.length, total_creditos: totalCr,
            cursos: cursosData.map(c => ({ materia: c.asignatura, profesor: c.profesor, grupo: c.grupo }))
        });
 
        if (confirmed) {
            cursosData.forEach(c => {
                supabaseRPC('increment_prof_stat', { p_semester: String(semester || ''), p_materia: c.asignatura, p_profesor: c.profesor, p_grupo: c.grupo, p_clave: c.clave || '', p_field: 'final' });
            });
            console.log('[SADA Analytics] Horario confirmado ✓');
        }
    }
 
    function saveExitSnapshot(cursos, actividades, semester, mode) {
        if (!_initialized || !cursos || cursos.length === 0) return;
        const cursosData = cursos.map(c => ({
            asignatura: c.asignatura, profesor: c.profesor, grupo: c.grupo, clave: c.clave, creditos: c.creditos, area: c.area || '',
            sesiones: c.sesiones.map(s => ({ dia: s.dia, inicio: s.inicio, fin: s.fin }))
        }));
        try {
            fetch(`${SUPABASE_URL}/rest/v1/schedule_snapshots`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    session_id: _sessionId, visitor_id: _visitorId, mode: mode || 'manual',
                    semester: semester || '', confirmed: false, cursos: cursosData,
                    total_creditos: cursos.reduce((s, c) => s + (c.creditos || 0), 0),
                    total_materias: cursos.length,
                    actividades: (actividades || []).map(a => ({ nombre: a.asignatura, sesiones: a.sesiones.map(s => ({ dia: s.dia, inicio: s.inicio, fin: s.fin })) })),
                    created_at: localISO()
                }),
                keepalive: true
            });
        } catch (e) {}
    }
 
    // ══════════════════════════════════════════
    // API PÚBLICA
    // ══════════════════════════════════════════
 
    function getVisitorId() { return _visitorId; }
    function getSessionId() { return _sessionId; }
    function isReady() { return _initialized; }
 
    function updateSatisfaction(rating) {
        if (!_initialized || !_sessionId) return;
        try {
            fetch(`${SUPABASE_URL}/rest/v1/schedule_snapshots?session_id=eq.${_sessionId}&confirmed=eq.true&satisfaction=is.null`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ satisfaction: rating })
            });
            enqueueEvent('satisfaction_rating', { rating });
        } catch (e) { /* silenciar */ }
    }
 
    return {
        init,
        trackEntrarWorkspace, trackCambiarSemestre, trackCambiarModo,
        trackBuscarMateria, trackAgregarCurso, trackEliminarCurso, trackAgregarBolsa,
        trackHerramienta,
        trackGenerarCombinaciones, trackAbrirCombinacion,
        trackExportar, trackTransferir, trackFiltro, trackPerfilSADA, trackCustom,
        saveSnapshot, saveExitSnapshot, updateSatisfaction,
        getVisitorId, getSessionId, isReady
    };
})();
 
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.SadaAnalytics.init());
} else {
    window.SadaAnalytics.init();
}
