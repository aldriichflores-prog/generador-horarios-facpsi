// ==========================================
// SADA — Generador de Horarios FACPSI UNAM
// app.js — Lógica principal de la aplicación
// ==========================================

// Fallback si sada_analytics.js no cargó
if (!window.SadaAnalytics) {
    window.SadaAnalytics = { trackEntrarWorkspace(){}, trackCambiarSemestre(){}, trackCambiarModo(){}, trackBuscarMateria(){}, trackAgregarCurso(){}, trackEliminarCurso(){}, trackAgregarBolsa(){}, trackGenerarCombinaciones(){}, trackAbrirCombinacion(){}, trackExportar(){}, trackTransferir(){}, trackFiltro(){}, trackPerfilSADA(){}, trackCustom(){}, trackHerramienta(){}, saveSnapshot(){}, saveExitSnapshot(){}, updateSatisfaction(){}, init(){} };
}
var SadaAnalytics = window.SadaAnalytics;

// ==========================================
// 1. CONSTANTES Y CONFIGURACIÓN GLOBAL
// ==========================================

// --- Bases de Datos ---
let BD_CRUDA = [];      // Datos tal cual llegan del JSON
let BD_AGRUPADA = [];   // Datos procesados y limpios con clave y estructura unificada

// --- Estado del Usuario (Modo Manual) ---
let miHorario = [];     // Lista de cursos seleccionados actualmente
let historial = [];     // Pila para Undo
let futuro = [];        // Pila para Redo
let materiasPendientes = []; // Materias en previsualización (hover/condicionales)
let materiaSeleccionadaActual = null; // Materia activa en el panel izquierdo (Manual)

// --- Estado del Modo Explorador (Automático) ---
let bolsa = {};         // Materias candidatas seleccionadas { "Calculo": [grupo1, grupo2] }
let materiaSeleccionadaAuto = null; // Materia activa en el panel izquierdo (Auto)
let RESULTADOS_GLOBALES = [];    // Todas las combinaciones generadas
let RESULTADOS_MOSTRADOS = [];   // Combinaciones filtradas que se muestran
let OFFSET_MOSTRADOS = 0;        // Paginación de resultados visualizados
const BATCH_SIZE = 50;           // Cantidad de resultados por página

// --- Configuración Visual y Sistema ---
let configVisual = { prof: true, grupo: true, horas: true }; // Que mostrar en los bloques visuales
let MAPA_COLORES_ASIGNADOS = {}; // Cache de colores por ID de materia
let OFFSET_RECOLOR = 0;          // Desplazamiento de colores (Manual)
let OFFSET_RECOLOR_AUTO = 0;     // Desplazamiento de colores (Auto)
let horariosGuardados = {};      // Persistencia de múltiples horarios
let activeScheduleId = "default";
let actividadesExtra = [];       // Actividades extracurriculares del usuario

const DB_FILE = 'Horarios_Completo_UNAM.json';

// Paleta de colores pastel para los bloques
const PALETA_ENTERA = [
    '#FFF9C4', '#F5F5DC', '#E3F2FD', '#F3E5F5', '#E0F2F1', '#FFF3E0', '#FBE9E7', '#FAFAFA',
    '#ECEFF1', '#F9FBE7', '#FFF4F0', '#FFF4DC', '#F1F3FF', '#FFECF0', '#DCF2DD', '#D0F3CB',
    '#DAEDAF', '#FFE8DC', '#E9F8FF', '#FAD2D2', '#FFD9E4', '#D1F3FF', '#CBE6F1', '#EADFFF',
    '#D2DADD', '#FFFAC7', '#B0E0E0', '#B1CAFF', '#B7DAFF', '#FEDBD7', '#FFCCEA', '#FBC6F0',
    '#FFE2C8', '#99DAFF', '#FFA79F', '#82E9E6', '#C3ADFF', '#FFC7BA'
];
let PALETA_ORDENADA = []; // Se llena onload ordenando por luminancia

// ==========================================
// 2. UTILIDADES Y HELPERS
// ==========================================

/** Calcula la luminancia de un color Hex para ordenar la paleta */
function getLuminance(hex) { let c = hex.substring(1); let rgb = parseInt(c, 16); let r = (rgb >> 16) & 0xff; let g = (rgb >> 8) & 0xff; let b = (rgb >> 0) & 0xff; return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

/** Convierte hora "HH:MM" a minutos desde las 00:00 */
function convertirMinutos(horaStr) { if (!horaStr || typeof horaStr !== 'string') return 0; const [h, m] = horaStr.split(':').map(Number); return (h * 60) + m; }

/** Convierte minutos a formato "HH:MM" */
function minutosAHora(minutos) { let h = Math.floor(minutos / 60); let m = minutos % 60; return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; }

/** Asigna un color fijo a una materia basado en su ID si no tiene uno */
function asignarColorFijo(id_unico) { if (MAPA_COLORES_ASIGNADOS[id_unico]) return; let count = Object.keys(MAPA_COLORES_ASIGNADOS).length; let color = PALETA_ORDENADA[count % PALETA_ORDENADA.length]; MAPA_COLORES_ASIGNADOS[id_unico] = color; }

// ==========================================
// 3. GESTIÓN DEL ESTADO (UNDO/REDO)
// ==========================================

function registrarEstado() {
    historial.push(JSON.parse(JSON.stringify(miHorario)));
    futuro = [];
    actualizarBotonesUndo();
}

function undo() {
    if (historial.length === 0) return;
    SadaAnalytics.trackHerramienta('undo');
    futuro.push(JSON.parse(JSON.stringify(miHorario)));
    miHorario = historial.pop();
    materiasPendientes = [];
    guardarEstado();
    actualizarUICompleta();
    actualizarBotonesUndo();
}

function redo() {
    if (futuro.length === 0) return;
    SadaAnalytics.trackHerramienta('redo');
    historial.push(JSON.parse(JSON.stringify(miHorario)));
    miHorario = futuro.pop();
    materiasPendientes = [];
    guardarEstado();
    actualizarUICompleta();
    actualizarBotonesUndo();
}

function actualizarBotonesUndo() {
    document.getElementById('btn-undo').disabled = (historial.length === 0);
    document.getElementById('btn-redo').disabled = (futuro.length === 0);
}

function actualizarUICompleta() {
    actualizarTablaHorario();
    renderizarHorarioVisual();
    if (materiaSeleccionadaActual) cargarPanelGrupos(materiaSeleccionadaActual);
    filtrarMaterias();
}

// ==========================================
// 4. LÓGICA DE COLORES Y CHOQUES
// ==========================================

/** Cambia los colores de las materias del Modo Manual cíclicamente */
function recolorearInteligente() {
    SadaAnalytics.trackHerramienta('recolor');
    OFFSET_RECOLOR++;
    let materiasOrdenadas = [...miHorario].sort((a, b) => { if (a.creditos !== b.creditos) return a.creditos - b.creditos; return a.asignatura.localeCompare(b.asignatura); });
    let totalMaterias = materiasOrdenadas.length;
    let totalColores = PALETA_ORDENADA.length;
    if (totalMaterias > 0) {
        let step = totalColores / totalMaterias;
        materiasOrdenadas.forEach((mat, i) => {
            let baseIndex = Math.floor(i * step);
            let nextIndex = Math.floor((i + 1) * step);
            let sectionSize = Math.max(1, nextIndex - baseIndex);
            let indexWithin = OFFSET_RECOLOR % sectionSize;
            let finalIndex = baseIndex + indexWithin;
            if (finalIndex >= totalColores) finalIndex = totalColores - 1;
            MAPA_COLORES_ASIGNADOS[mat.id_unico] = PALETA_ORDENADA[finalIndex];
        });
    }
    guardarEstado();
    renderizarHorarioVisual();
}

/** Cambia los colores de los Resultados Automáticos */
function recolorearAuto() {
    SadaAnalytics.trackHerramienta('auto_recolor');
    OFFSET_RECOLOR_AUTO++;
    RESULTADOS_MOSTRADOS.forEach((res, i) => {
        let switchVis = document.getElementById(`switch-auto-${i}`);
        if (switchVis && switchVis.checked) {
            let visualDiv = document.getElementById(`res-visual-${i}`);
            if (visualDiv) {
                visualDiv.innerHTML = generarHTMLGridVisual(`auto-${i}`);
                renderizarBloquesEnGrid(res.cursos, `auto-${i}`);
            }
        }
    });
}

/** Detecta conflictos de horario entre un curso 'c1' y una lista de cursos */
function obtenerChoques(c1, lista) {
    let conflictos = [];
    if (!c1 || !lista) return conflictos;
    for (let c2 of lista) {
        let choca = false;
        for (let s1 of c1.sesiones) {
            for (let s2 of c2.sesiones) {
                if (s1.dia === s2.dia) {
                    if (s1.min_inicio < s2.min_fin && s2.min_inicio < s1.min_fin) {
                        choca = true; break;
                    }
                }
            }
            if (choca) break;
        }
        if (choca) conflictos.push(c2);
    }
    return conflictos;
}

function hayChoque(c1, lista) { return obtenerChoques(c1, lista).length > 0; }

/** Verifica si hay algún choque interno en una lista de cursos (para el generador) */
function hayChoqueCombo(lista) {
    let listaCompleta = [...lista, ...actividadesExtra];
    for (let i = 0; i < listaCompleta.length; i++) { for (let j = i + 1; j < listaCompleta.length; j++) { if (hayChoque(listaCompleta[i], [listaCompleta[j]])) return true; } } return false;
}

function actualizarConfigVisual() {
    configVisual.prof = document.getElementById('chk-prof').checked;
    configVisual.grupo = document.getElementById('chk-grupo').checked;
    configVisual.horas = document.getElementById('chk-horas').checked;
    renderizarHorarioVisual();
    if (document.getElementById('vista-auto').style.display === 'block') {
        RESULTADOS_MOSTRADOS.forEach((r, i) => {
            let vis = document.getElementById(`res-visual-${i}`);
            if (vis && vis.style.display === 'block') {
                vis.innerHTML = generarHTMLGridVisual(`auto-${i}`);
                renderizarBloquesEnGrid(r.cursos, `auto-${i}`);
            }
        });
    }
}

// ==========================================
// 5. INICIALIZACIÓN Y CARGA DE DATOS
// ==========================================

// Se eliminó toggleFijarPanel por petición del usuario

window.onload = function () {
    // Ordenar paleta por brillo para contraste
    PALETA_ORDENADA = [...PALETA_ENTERA].sort((a, b) => getLuminance(b) - getLuminance(a));

    fetch(DB_FILE)
        .then(res => { if (!res.ok) throw new Error("Error JSON"); return res.json(); })
        .then(data => {
            BD_CRUDA = data;
            procesarDatosCrudos();
            crearGridVisualVacia();
            cargarEstado();
            // Restaurar semestre si estaba seleccionado
            let semSelect = document.getElementById('semestre-selector');
            if (semSelect.value) cambiarSemestre(false);

            // ── Módulos SADA eliminados temporalmente ──

            // ── Toggle visual para botones de día (actividades extra) ──
            document.querySelectorAll('.act-dia-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    let chk = this.querySelector('input[type="checkbox"]');
                    chk.checked = !chk.checked;
                    this.classList.toggle('active', chk.checked);
                });
            });
        })
        .catch(err => { console.error(err); alert("Error cargando datos: " + err.message); });
};

// Snapshot al salir de la página (fallback)
window.addEventListener('beforeunload', function () {
    if (miHorario && miHorario.length > 0) {
        SadaAnalytics.saveExitSnapshot(miHorario, actividadesExtra, document.getElementById('semestre-selector').value, 'manual');
    }
});

/** 
 * Procesa el JSON crudo a objetos utilizables.
 * - Genera ID único si no existe
 * - Normaliza campos
 * - Agrupa sesiones
 * - EXTRAE LA CLAVE (Nuevo Recquerimiento)
 */
function procesarDatosCrudos() {
    let temp = {};
    BD_CRUDA.forEach(fila => {
        let sem = parseInt(fila.semestre || 0);
        let asig = (fila.asignatura || "SIN NOMBRE").toString().trim();
        let prof = (fila.profesor || "POR ASIGNAR").toString().trim();
        let gpo = (fila.grupo || "0").toString();
        let area = (fila.area || "GENERAL").toString().trim();
        if (area === "") area = "GENERAL";

        // Clave única para agrupar sesiones del mismo grupo
        let key = `${sem}-${asig}-${gpo}`;

        if (!temp[key]) {
            temp[key] = {
                id_unico: (fila.id_unico != null && fila.id_unico !== "") ? fila.id_unico : key,
                semestre: sem,
                asignatura: asig,
                profesor: prof,
                grupo: gpo,
                creditos: parseInt(fila.creditos || 0),
                observaciones: fila.observaciones || "",
                clave: fila.clave || "", // INTEGRACIÓN DE CLAVE
                area: area,
                sesiones: []
            };
        }

        let d = fila.dia || "POR ASIGNAR";
        let i = fila.hora_inicio || "00:00";
        let f = fila.hora_fin || "00:00";

        if (d !== "POR ASIGNAR" && i !== "00:00") {
            temp[key].sesiones.push({
                dia: d, inicio: i, fin: f,
                min_inicio: convertirMinutos(i),
                min_fin: convertirMinutos(f)
            });
        }
    });
    BD_AGRUPADA = Object.values(temp);
}

// ==========================================
// 6. PERSISTENCIA Y GESTIÓN DE HORARIOS
// ==========================================

function guardarEstado() {
    horariosGuardados[activeScheduleId].cursos = miHorario;
    localStorage.setItem('unam_schedules_v3', JSON.stringify(horariosGuardados));
    localStorage.setItem('unam_active_id_v3', activeScheduleId);
    localStorage.setItem('unam_b_v3', JSON.stringify(bolsa));
    localStorage.setItem('unam_colors_v3', JSON.stringify(MAPA_COLORES_ASIGNADOS));
    mostrarToast();
}

function cargarEstado() {
    try {
        let savedSchedules = localStorage.getItem('unam_schedules_v3');
        if (savedSchedules) {
            horariosGuardados = JSON.parse(savedSchedules);
        } else {
            horariosGuardados = { "default": { nombre: "Mi Horario 1", cursos: [] } };
        }
    } catch (e) {
        console.warn('Estado de horarios corrupto, reiniciando.', e);
        horariosGuardados = { "default": { nombre: "Mi Horario 1", cursos: [] } };
        localStorage.removeItem('unam_schedules_v3');
    }

    let savedId = localStorage.getItem('unam_active_id_v3');
    if (savedId && horariosGuardados[savedId]) {
        activeScheduleId = savedId;
    } else {
        // Fallback si el ID guardado no existe
        activeScheduleId = Object.keys(horariosGuardados)[0];
    }

    try {
        let b = localStorage.getItem('unam_b_v3');
        let c = localStorage.getItem('unam_colors_v3');
        if (b) bolsa = JSON.parse(b);
        if (c) MAPA_COLORES_ASIGNADOS = JSON.parse(c);
    } catch (e) {
        console.warn('Bolsa o colores corruptos, reiniciando.', e);
        bolsa = {};
        MAPA_COLORES_ASIGNADOS = {};
        localStorage.removeItem('unam_b_v3');
        localStorage.removeItem('unam_colors_v3');
    }

    miHorario = horariosGuardados[activeScheduleId].cursos || [];

    historial = [];
    futuro = [];
    actualizarBotonesUndo();

    actualizarUIHorarios();
    actualizarTablaHorario();
    renderBolsa();
}

function actualizarUIHorarios() {
    let selector = document.getElementById('selector-horarios');
    if (selector) {
        selector.innerHTML = '';
        Object.keys(horariosGuardados).forEach(id => {
            let opt = document.createElement('option');
            opt.value = id;
            opt.text = horariosGuardados[id].nombre;
            if (id === activeScheduleId) opt.selected = true;
            selector.appendChild(opt);
        });
    }
    let nombreInput = document.getElementById('nombre-horario-actual');
    if (nombreInput) nombreInput.value = horariosGuardados[activeScheduleId].nombre;
}

function cambiarHorarioActivo() {
    activeScheduleId = document.getElementById('selector-horarios').value;
    miHorario = horariosGuardados[activeScheduleId].cursos || [];
    localStorage.setItem('unam_active_id_v3', activeScheduleId);
    document.getElementById('nombre-horario-actual').value = horariosGuardados[activeScheduleId].nombre;

    // Resetear estados temporales
    materiasPendientes = [];
    historial = []; futuro = []; actualizarBotonesUndo();

    actualizarTablaHorario();
    renderizarHorarioVisual();
    materiaSeleccionadaActual = null;
    limpiarPanelGrupos();
    filtrarMaterias();
}

function crearNuevoHorario() {
    let newId = 'sched_' + Date.now();
    let count = Object.keys(horariosGuardados).length + 1;
    horariosGuardados[newId] = { nombre: `Nuevo Horario ${count}`, cursos: [] };
    activeScheduleId = newId;
    miHorario = [];

    materiasPendientes = [];
    historial = []; futuro = []; actualizarBotonesUndo();

    guardarEstado();
    actualizarUIHorarios();
    actualizarTablaHorario();
    renderizarHorarioVisual();
    materiaSeleccionadaActual = null;
    limpiarPanelGrupos();
    filtrarMaterias();
}

function guardarNombreHorario() {
    let nuevoNombre = document.getElementById('nombre-horario-actual').value.trim();
    if (!nuevoNombre) return alert("El nombre no puede estar vacío");
    horariosGuardados[activeScheduleId].nombre = nuevoNombre;
    guardarEstado();
    actualizarUIHorarios();
}

function eliminarHorarioActual() {
    if (Object.keys(horariosGuardados).length <= 1) return alert("Debes tener al menos un horario.");
    if (!confirm(`¿Eliminar "${horariosGuardados[activeScheduleId].nombre}" permanentemente?`)) return;

    delete horariosGuardados[activeScheduleId];
    activeScheduleId = Object.keys(horariosGuardados)[0];
    miHorario = horariosGuardados[activeScheduleId].cursos;

    materiasPendientes = [];
    historial = []; futuro = []; actualizarBotonesUndo();

    guardarEstado();
    actualizarUIHorarios();
    actualizarTablaHorario();
    renderizarHorarioVisual();
}

function mostrarToast() { document.getElementById('toast-guardado').style.display = 'block'; setTimeout(() => document.getElementById('toast-guardado').style.display = 'none', 1500); }

// ==========================================
// 7. INTERFAZ: VISUALIZACIÓN Y HELPERS
// ==========================================

function toggleVistaVisual() {
    let isVisual = document.getElementById('switch-vista').checked;
    SadaAnalytics.trackHerramienta(isVisual ? 'visual_on' : 'visual_off');
    document.getElementById('vista-lista-container').style.display = isVisual ? 'none' : 'block';
    document.getElementById('vista-visual-container').style.display = isVisual ? 'block' : 'none';
    document.getElementById('btn-recolorear').style.display = isVisual ? 'inline-block' : 'none';

    if (isVisual) renderizarHorarioVisual();
}

/** Genera la estructura HTML vacía del horario gráfico */
function crearGridVisualVacia() {
    let tbody = document.getElementById('grid-horario-visual');
    tbody.innerHTML = '';
    let startMin = 7 * 60;
    let endMin = 21 * 60;
    for (let m = startMin; m < endMin; m += 30) {
        let tr = document.createElement('tr');
        let horaStr = minutosAHora(m);
        let idHora = m;
        let tdHora = document.createElement('td');
        tdHora.className = 'hora-col';
        tdHora.innerText = horaStr;
        tr.appendChild(tdHora);
        ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].forEach(dia => {
            let td = document.createElement('td');
            td.id = `grid-${dia}-${idHora}`;
            td.dataset.dia = dia;
            td.dataset.min = idHora;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }
}

function resaltarMateria(idUnico) {
    let bloques = document.querySelectorAll(`.bloque-${idUnico}`);
    bloques.forEach(b => b.classList.add('bloque-resaltado'));
}
function quitarResaltado(idUnico) {
    let bloques = document.querySelectorAll(`.bloque-${idUnico}`);
    bloques.forEach(b => b.classList.remove('bloque-resaltado'));
}

function renderizarHorarioVisual() {
    document.querySelectorAll('#grid-horario-visual .bloque-materia').forEach(el => el.remove());

    miHorario.forEach(curso => {
        if (!MAPA_COLORES_ASIGNADOS[curso.id_unico]) asignarColorFijo(curso.id_unico);
        let color = MAPA_COLORES_ASIGNADOS[curso.id_unico];
        insertarBloque(curso, color, false);
    });

    actividadesExtra.forEach(act => {
        insertarBloque(act, '#FFE0B2', false);
    });

    materiasPendientes.forEach(item => {
        insertarBloque(item.curso, 'transparent', true);
    });
}

/** Inserta un bloque visual en el grid */
function insertarBloque(curso, color, esTraslape) {
    let horasStr = curso.sesiones.map(s => `${s.dia.substr(0, 3)} ${s.inicio}-${s.fin}`).join('\n');
    curso.sesiones.forEach(sesion => {
        let diaNorm = sesion.dia.toUpperCase().replace('É', 'E');
        let inicio = sesion.min_inicio;
        let fin = sesion.min_fin;
        let duration = fin - inicio;
        let cellInicio = document.getElementById(`grid-${diaNorm}-${inicio}`);
        if (cellInicio) {
            let bloque = document.createElement('div');
            bloque.className = `bloque-materia bloque-${curso.id_unico}`;

            if (!configVisual.prof) bloque.classList.add('hide-prof');
            if (!configVisual.grupo) bloque.classList.add('hide-group');
            if (!configVisual.horas) bloque.classList.add('hide-time');

            if (esTraslape) {
                bloque.classList.add('bloque-traslape');
            } else {
                bloque.style.backgroundColor = color;
                bloque.onmouseenter = () => resaltarMateria(curso.id_unico);
                bloque.onmouseleave = () => quitarResaltado(curso.id_unico);
            }

            let slots = duration / 30;
            let heightPx = (slots * 31) - 1;
            bloque.style.height = `${heightPx}px`;
            if (!esTraslape) {
                bloque.onclick = (e) => { e.stopPropagation(); mostrarDetallesMateria(curso.id_unico); };
            }

            let htmlContent = `<div class="materia-nombre">${curso.asignatura}</div>`;
            // CLAVE INTEGRADA
            htmlContent += `<div class="materia-grupo">Gpo: ${curso.grupo} <span style="font-weight:normal; opacity:0.8;">| Clave: ${curso.clave}</span></div>`;
            htmlContent += `<div class="materia-profe">${curso.profesor}</div>`;
            htmlContent += `<div class="materia-horas">${horasStr}</div>`;

            if (esTraslape) {
                htmlContent += `<div class="label-traslape">TRASLAPE</div>`;
            }

            bloque.innerHTML = htmlContent;
            cellInicio.appendChild(bloque);
        }
    });
}

// ==========================================
// 8. INTERACCIONES MODALES
// ==========================================

function mostrarDetallesMateria(id) {
    let curso = miHorario.find(c => c.id_unico === id);
    if (!curso) return;
    document.getElementById('tituloMateriaModal').innerText = curso.asignatura;
    document.getElementById('profeMateriaModal').innerText = curso.profesor || "Profesor no asignado";
    let obs = curso.observaciones ? curso.observaciones : "Sin observaciones registradas para este grupo.";
    document.getElementById('obsMateriaModal').innerText = obs;
    let btnEliminar = document.getElementById('btnEliminarDesdeModal');
    btnEliminar.onclick = () => eliminarDesdeModal(id);
    let modal = new bootstrap.Modal(document.getElementById('modalDetallesMateria'));
    modal.show();
}

function eliminarDesdeModal(id) {
    if (!confirm("¿Estás seguro de eliminar esta materia?")) return;
    registrarEstado();
    let idx = miHorario.findIndex(c => c.id_unico === id);
    if (idx > -1) {
        let borrada = miHorario[idx];
        miHorario.splice(idx, 1);
        delete MAPA_COLORES_ASIGNADOS[id];
        guardarEstado();
        actualizarTablaHorario();
        filtrarMaterias();
        if (materiaSeleccionadaActual === borrada.asignatura) cargarPanelGrupos(borrada.asignatura);
        let modalEl = document.getElementById('modalDetallesMateria');
        let modal = bootstrap.Modal.getInstance(modalEl);
        modal.hide();
    }
}

// ==========================================
// 9. LÓGICA DE FILTRADO Y NAVEGACIÓN
// ==========================================

function obtenerMateriasActivas() {
    const selector = document.getElementById('semestre-selector');
    const valor = selector.value;
    if (valor === 'adicional') {
        const filtroSistema = document.getElementById('filtro-sistema');
        const sistema = filtroSistema ? filtroSistema.value : 'escolarizado';
        return BD_AGRUPADA.filter(c => {
            if (c.semestre !== 6 && c.semestre !== 8) return false;
            const grupoNum = parseInt(c.grupo);
            const esSUA = grupoNum >= 9000;
            if (sistema === 'escolarizado' && esSUA) return false;
            if (sistema === 'sua' && !esSUA) return false;
            return true;
        });
    } else {
        const sem = parseInt(valor);
        // Mostrar materias del semestre seleccionado, o "PRINCIPIOS..." si estamos en 6to (ya que es de 8vo pero se abre a 6to)
        return BD_AGRUPADA.filter(c => c.semestre === sem || (c.asignatura === "PRINCIPIOS DE SUSTENTABILIDAD" && sem === 6));
    }
}

function cambiarSemestre(resetear = true) {
    let val = document.getElementById('semestre-selector').value;
    let sem = parseInt(val);
    SadaAnalytics.trackCambiarSemestre(val);
    if (resetear) {
        miHorario = [];
        bolsa = {};
        MAPA_COLORES_ASIGNADOS = {};
        horariosGuardados = { "default": { nombre: "Mi Horario 1", cursos: [] } };
        activeScheduleId = "default";
        materiasPendientes = [];
        historial = []; futuro = []; actualizarBotonesUndo();
        guardarEstado();
        actualizarUIHorarios();
        actualizarTablaHorario();
        renderBolsa();
    }
    document.getElementById('buscador').value = '';
    document.getElementById('buscador-auto').value = '';
    materiaSeleccionadaActual = null;
    materiaSeleccionadaAuto = null;
    limpiarPanelGrupos();
    limpiarPanelGruposAuto();

    let divAlerta = document.getElementById('alerta-semestre');
    divAlerta.innerHTML = '';
    if (val === 'adicional') {
        divAlerta.innerHTML = `<div class="alert alert-info shadow-sm" role="alert"><div class="d-flex align-items-center mb-2"><i class="bi bi-info-circle-fill fs-4 me-2 text-primary"></i><h5 class="alert-heading fw-bold mb-0">Semestre Adicional: Reglas de Selección</h5></div><hr class="my-2"><div class="row align-items-center"><div class="col-md-8"><p class="small mb-1"><strong><i class="bi bi-card-checklist"></i> Requisitos Académicos:</strong></p><ul class="small mb-2 ps-3"><li>Elige asignaturas de <strong>6° y 8° semestre</strong> de la oferta vigente.</li><li>Propón asignaturas que <strong>no hayas inscrito previamente</strong>.</li><li>Rango de créditos obligatorio: <strong>Mínimo 31 - Máximo 41</strong>.</div><div class="col-md-4 mt-2 mt-md-0"><div class="bg-white p-3 rounded border border-primary"><label class="form-label fw-bold text-primary small mb-1">Sistema de Pertenencia:</label><select id="filtro-sistema" class="form-select form-select-sm border-primary" onchange="filtrarMaterias(); filtrarMateriasAuto();"><option value="escolarizado">Escolarizado (Gpos. 6000-8000)</option><option value="sua">SUA (Gpos. 9000)</option></select><small class="text-danger fw-bold d-block mt-1"><i`;
    }
    else if (sem === 2) {
        divAlerta.innerHTML = `<div class="alert alert-info alert-dismissible fade show shadow-sm" role="alert"><h5 class="alert-heading"><i class="bi bi-people-fill"></i> ¡Hola, estudiante de Segundo Semestre!</h5><p class="small mb-1">Sabemos que en 2do semestre los horarios funcionan por grupos completos. Por lo que te recomendamos tener en cuenta lo siguiente:</p><ul class="small mb-2"><li><strong>¿Qué son los Grupos Espejo?:</strong> Son dos o más grupos que se imparten exactamente en el mismo horario, pero con diferente profesor. <li><strong>¿Cuáles son los Grupos Espejo?:</strong> El grupo 2001 y 2002. 2003 y 2004. 2005 y 2006. 2007 y 2008. 2010 y 2011.  </li><li><strong>Recomendación:</strong> Usa el <strong>Modo Manual</strong>. Elige un grupo base (ej. 2003) y si un profe no te gusta, cámbialo por el del grupo espejo.</li><li>Si quieres usar el modo exploratorio, usa los filtros, te serán de ayuda para ver otras combinaciones.</li></ul><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
    }
    else if (sem === 4) {
        divAlerta.innerHTML = `<div class="alert alert-info alert-dismissible fade show shadow-sm" role="alert"><h5 class="alert-heading fw-bold"><i class="bi bi-people-fill"></i> ¡Hola, estudiante de Cuarto Semestre!</h5><p class="small mb-2">Sabemos que en 4to semestre los horarios funcionan por grupos completos. Por lo que te recomendamos tener en cuenta los siguiente:</p><ul class="small mb-0"><li class="mb-1"><strong>Grupos Espejo:</strong> Grupos: 4001 y 4002. 4003 y 4004. 4005 y 4006. 4007 - 4008 y 4009. 4011 y 4012 tienen las mismas horas. Es fácil intercambiar profesores entre ellos.</li><li class="mb-1"><strong>Recomendación:</strong> Usa el <strong>Modo Manual</strong>. Elige un grupo base (ej. 4003) y si un profe no te gusta, cámbialo por el del grupo espejo.</li><li class="mb-2">Si quieres usar el modo exploratorio, usa los filtros, te serán de ayuda para ver otras combinaciones.</li><li class="mt-2 p-2 bg-warning bg-opacity-10 border border-warning rounded text-dark"><strong><i class="bi bi-exclamation-triangle-fill"></i> IMPORTANTE ACA III:</strong> Por cada grupo de <em>APRENDIZAJE Y CONDUCTA ADAPTAT. III</em> le corresponden 2 grupos de (Práctica). Asegúrate de elegir el grupo correspondiente de prácticas acorde a lo que dicen las <strong>observaciones</strong> del grupo de Teoría.</li></ul><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
    }

    filtrarMaterias();
    filtrarMateriasAuto();
}

let _bannerMostrado = false;

function activarModo(modo) {
    cambiarModo(modo);
    // Mostrar banner de consentimiento (1 vez por sesión)
    if (!_bannerMostrado) {
        let banner = document.getElementById('banner-consentimiento');
        if (banner) { banner.style.display = 'block'; _bannerMostrado = true; }
    }
    setTimeout(() => {
        let destino = _bannerMostrado ? 'banner-consentimiento' : (modo === 'manual' ? 'vista-manual' : 'vista-auto');
        let elemento = document.getElementById(destino);
        if (elemento) {
            const yOffset = -20;
            const y = elemento.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 100);
}

function aceptarConsentimiento(acepto) {
    document.getElementById('banner-consentimiento').style.display = 'none';
    SadaAnalytics.trackCustom('consent', { accepted: acepto });
}

function cambiarModo(m) {
    SadaAnalytics.trackCambiarModo(m);
    let vistaManual = document.getElementById('vista-manual');
    let vistaAuto = document.getElementById('vista-auto');
    if (vistaManual) {
        vistaManual.style.display = (m === 'manual') ? 'flex' : 'none';
    }
    if (vistaAuto) {
        vistaAuto.style.display = (m === 'auto') ? 'block' : 'none';
    }
}

// ==========================================
// 10. MODO MANUAL: SELECCIÓN Y PANELES
// ==========================================

function filtrarMaterias() {
    let txt = document.getElementById('buscador').value.toUpperCase();
    let lista = document.getElementById('lista-materias'); lista.innerHTML = '';
    let matSem = obtenerMateriasActivas();
    if (matSem.length === 0) { lista.innerHTML = '<div class="p-3 text-muted small text-center">No hay datos disponibles para esta selección.</div>'; return; }

    let areas = [...new Set(matSem.map(c => c.area))].sort();

    let semVal = parseInt(document.getElementById('semestre-selector').value);
    let teoriaACA = "APRENDIZAJE Y CONDUCTA ADAPTAT. III";
    let practicaACA = "APRENDIZAJE Y CONDUCTA ADAPTAT. III (PRACTICA)";

    areas.forEach(area => {
        let matsEnArea = [...new Set(matSem.filter(c => c.area === area).map(c => c.asignatura))].sort();
        let matsFiltradas = matsEnArea.filter(m => m.toUpperCase().includes(txt));

        if (matsFiltradas.length > 0) {
            let header = document.createElement('div');
            header.className = 'area-header area-toggle';
            header.innerHTML = `<i class="bi bi-chevron-right area-arrow"></i> ${area} <span class="badge bg-secondary rounded-pill ms-1">${matsFiltradas.length}</span>`;
            header.style.cursor = 'pointer';

            let grupo = document.createElement('div');
            grupo.className = 'area-group';
            grupo.style.display = 'none';

            let tieneActiva = matsFiltradas.includes(materiaSeleccionadaActual);
            let hayBusqueda = txt.length >= 2;
            if (tieneActiva || hayBusqueda) {
                grupo.style.display = 'block';
                header.querySelector('.area-arrow').classList.add('area-arrow-open');
            }

            header.onclick = () => {
                let abierto = grupo.style.display === 'block';
                grupo.style.display = abierto ? 'none' : 'block';
                header.querySelector('.area-arrow').classList.toggle('area-arrow-open');
            };

            lista.appendChild(header);

            matsFiltradas.forEach(nom => {
                let inscrita = miHorario.some(c => c.asignatura === nom);
                let active = materiaSeleccionadaActual === nom ? 'active-item' : '';

                let htmlAviso = '';
                let claseExtra = '';

                if (semVal === 4) {
                    if (nom === teoriaACA) {
                        let tengoPractica = miHorario.some(c => c.asignatura === practicaACA);
                        if (tengoPractica && !inscrita) {
                            htmlAviso = '<span class="aviso-requerido">Necesaria inscribir</span>';
                            claseExtra = 'item-requerido';
                        }
                    } else if (nom === practicaACA) {
                        let tengoTeoria = miHorario.some(c => c.asignatura === teoriaACA);
                        if (tengoTeoria && !inscrita) {
                            htmlAviso = '<span class="aviso-requerido">Necesaria inscribir</span>';
                            claseExtra = 'item-requerido';
                        }
                    }
                }

                let item = document.createElement('div');
                item.className = `list-group-item materia-item px-3 py-2 ${inscrita ? 'inscrita-item' : ''} ${active} ${claseExtra}`;

                // ── Badge SADA: score de recomendación si el perfil está activo ──
                let badgeSADA = '';
                const tienePerfilActivo = typeof SADA_PERFIL !== 'undefined' &&
                    SADA_PERFIL.completado === true;
                if (tienePerfilActivo && typeof sadaRecomendarCursos === 'function') {
                    const semActual = parseInt(document.getElementById('semestre-selector').value);
                    const cursosNom = BD_AGRUPADA.filter(c => c.asignatura === nom && c.semestre === semActual);
                    if (cursosNom.length > 0) {
                        const cursoConScore = sadaRecomendarCursos(semActual).find(c => c.asignatura === nom);
                        if (cursoConScore && cursoConScore.sada.recomendado) {
                            badgeSADA = `<span class="badge ms-1"
                                style="background:#e8f0fe; color:#002B7A; font-size:0.65rem; font-weight:600;"
                                title="Recomendado por SADA (score: ${cursoConScore.sada.score})">
                                ★ SADA
                            </span>`;
                        }
                    }
                }

                item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <span class="${inscrita ? 'fw-bold text-success' : ''}">${nom} ${badgeSADA}</span>
            ${inscrita ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}
        </div>
        ${htmlAviso}
    `;

                item.onclick = () => {
                    materiaSeleccionadaActual = nom;
                    filtrarMaterias();
                    cargarPanelGrupos(nom);
                };
                grupo.appendChild(item);
            });

            lista.appendChild(grupo);
        }
    });
}

function limpiarPanelGrupos() {
    document.getElementById('titulo-seleccion').innerHTML = '<i class="bi bi-arrow-left-circle"></i> 2. Selecciona un Profesor';
    document.getElementById('info-seleccion').innerText = 'Esperando...';
    document.getElementById('contenedor-grupos').innerHTML = '<div class="text-center text-muted py-5 w-100"><i class="bi bi-hand-index-thumb display-1 opacity-25"></i><p class="mt-3 lead">Selecciona una materia a la izquierda.</p></div>';
    materiasPendientes = [];
    renderizarHorarioVisual();
}

function cargarPanelGrupos(asignatura) {
    let semVal = document.getElementById('semestre-selector').value;
    let sem = parseInt(semVal);
    document.getElementById('titulo-seleccion').innerHTML = `<i class="bi bi-book"></i> ${asignatura}`;
    let cursos = obtenerMateriasActivas().filter(c => c.asignatura === asignatura).sort((a, b) => a.grupo.localeCompare(b.grupo));

    let gA = parseInt(cursos[0]?.grupo), gB = parseInt(cursos[1]?.grupo);
    if (!isNaN(gA) && !isNaN(gB)) {
        cursos.sort((a, b) => parseInt(a.grupo) - parseInt(b.grupo));
    }

    document.getElementById('info-seleccion').innerText = `${cursos.length} Grupos`;
    let contenedor = document.getElementById('contenedor-grupos'); contenedor.innerHTML = '';
    if (cursos.length === 0) { contenedor.innerHTML = '<div class="alert alert-warning text-center w-100">No se encontraron grupos.</div>'; return; }

    let materiaPadreInscrita = null;
    let materiaHijoInscrita = null;

    if (sem === 4) {
        if (asignatura.includes("APRENDIZAJE Y CONDUCTA ADAPTAT. III (PRACTICA)")) {
            materiaPadreInscrita = miHorario.find(m => m.asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III");
        }
        else if (asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III") {
            materiaHijoInscrita = miHorario.find(m => m.asignatura.includes("(PRACTICA)"));
        }
    }

    let horarioSinMateriaActual = miHorario.filter(h => h.asignatura !== asignatura);

    cursos.forEach(c => {
        let conflictos = obtenerChoques(c, [...horarioSinMateriaActual, ...actividadesExtra]);
        let choca = conflictos.length > 0;
        let yaInscrita = miHorario.some(h => h.id_unico === c.id_unico);
        let esPrevisualizada = materiasPendientes.some(p => p.curso.id_unico === c.id_unico);
        let bloqueadoPorACA = false;

        if (materiaPadreInscrita && !materiaPadreInscrita.observaciones.includes(c.grupo)) {
            bloqueadoPorACA = true;
        }
        if (materiaHijoInscrita && !c.observaciones.includes(materiaHijoInscrita.grupo)) {
            bloqueadoPorACA = true;
        }

        let horario = c.sesiones.map(s => `<div><span class="fw-bold">${s.dia.substr(0, 3)}</span> ${s.inicio}-${s.fin}</div>`).join('') || "<i>Sin horario</i>";
        let obsBtn = c.observaciones.length > 5 ? `<button class="btn-ver-obs" onclick="event.stopPropagation(); verObs('obs-${c.id_unico}')">Ver Obs</button>` : '';
        let obsBox = c.observaciones.length > 5 ? `<div id="obs-${c.id_unico}" class="obs-box">${c.observaciones}</div>` : '';

        let claseEstado = '';
        let botonAccion = '';
        let clickEvent = '';

        if (yaInscrita) {
            claseEstado = 'inscrita';
            botonAccion = '<div class="mt-2 text-center text-success fw-bold small"><i class="bi bi-check-circle-fill"></i> Seleccionado</div>';
            clickEvent = `toggleSeleccionManual(${c.id_unico}, '${asignatura}')`;
        }
        else if (bloqueadoPorACA) {
            claseEstado = 'choque';
            botonAccion = '<div class="mt-2 text-center text-danger fw-bold small"><i class="bi bi-slash-circle"></i> Gpo Incorrecto</div>';
        }
        else if (esPrevisualizada) {
            claseEstado = 'previsualizacion';
            let pendiente = materiasPendientes.find(p => p.curso.id_unico === c.id_unico);
            let listaNombresConflictos = pendiente.conflictos.map(cf => cf.asignatura).join(', ');

            botonAccion = `
    <div class="mt-2 text-center small">
        <div class="text-danger fw-bold mb-1" style="font-size:0.65rem;">SE ELIMINARÁ: ${listaNombresConflictos}</div>
        <button class="btn btn-sm btn-danger w-100 fw-bold" onclick="event.stopPropagation(); confirmarTraslape(${c.id_unico})">CONFIRMAR CAMBIO</button>
        <button class="btn btn-sm btn-link text-muted p-0 mt-1" onclick="event.stopPropagation(); cancelarTraslape(${c.id_unico}, '${asignatura}')">Cancelar</button>
    </div>`;
        }
        else if (choca) {
            claseEstado = 'choque';
            botonAccion = '<div class="mt-2 text-center text-danger fw-bold small">TRASLAPE (Click para ver)</div>';
            clickEvent = `previsualizarTraslape(${c.id_unico}, '${asignatura}')`;
        }
        else {
            botonAccion = '<div class="mt-2 text-center text-primary fw-bold small opacity-0 btn-add">Seleccionar</div>';
            clickEvent = `toggleSeleccionManual(${c.id_unico}, '${asignatura}')`;
        }

        let col = document.createElement('div'); col.className = 'col-auto'; col.style.width = '300px'; col.style.flexShrink = '0';
        col.innerHTML = `<div class="grupo-card p-3 d-flex flex-column ${claseEstado}" onclick="${clickEvent}"><div class="d-flex justify-content-between mb-2"><span class="badge bg-primary">Gpo ${c.grupo}</span><span class="text-muted small">${c.creditos} Cr</span></div><div class="mb-1 text-center"><span class="badge bg-light text-dark border">Clave: ${c.clave}</span></div><h6 class="card-title text-primary small text-uppercase fw-bold mb-2" style="min-height:2.5em;">${c.profesor}</h6><div class="small text-muted flex-grow-1 border-top pt-2">${horario}</div> ${obsBtn} ${obsBox} ${botonAccion}</div>`;
        contenedor.appendChild(col);
    });
}

function verObs(id) { let el = document.getElementById(id); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }

function previsualizarTraslape(idNuevo, asignatura) {
    let cursoNuevo = BD_AGRUPADA.find(c => c.id_unico === idNuevo);
    let horarioActual = miHorario.filter(h => h.asignatura !== asignatura);
    let conflictos = obtenerChoques(cursoNuevo, [...horarioActual, ...actividadesExtra]);

    if (!materiasPendientes.some(p => p.curso.id_unico === idNuevo)) {
        materiasPendientes.push({
            curso: cursoNuevo,
            conflictos: conflictos
        });
    }

    renderizarHorarioVisual();
    cargarPanelGrupos(asignatura);
}

function confirmarTraslape(idUnicoConfirmar) {
    registrarEstado();
    let pendiente = materiasPendientes.find(p => p.curso.id_unico === idUnicoConfirmar);
    if (!pendiente) return;
    let nuevo = pendiente.curso;
    let conflictoIds = pendiente.conflictos.map(c => c.id_unico);
    miHorario = miHorario.filter(c => !conflictoIds.includes(c.id_unico) && c.asignatura !== nuevo.asignatura);
    miHorario.push(nuevo);
    SadaAnalytics.trackAgregarCurso(nuevo);
    materiasPendientes = materiasPendientes.filter(p => p.curso.id_unico !== idUnicoConfirmar);
    ordenarMiHorario();
    guardarEstado();
    actualizarTablaHorario();
    renderizarHorarioVisual();
    filtrarMaterias();
    cargarPanelGrupos(nuevo.asignatura);
}

function cancelarTraslape(idUnicoCancelar, asignatura) {
    materiasPendientes = materiasPendientes.filter(p => p.curso.id_unico !== idUnicoCancelar);
    renderizarHorarioVisual();
    cargarPanelGrupos(asignatura);
}

// ==========================================
// 11. GESTIÓN DE MI HORARIO Y TABLA
// ==========================================

function toggleSeleccionManual(id, asignatura) {
    registrarEstado();
    if (materiasPendientes.some(p => p.curso.id_unico === id)) {
        materiasPendientes = materiasPendientes.filter(p => p.curso.id_unico !== id);
    }
    let yaEsta = miHorario.some(c => c.id_unico === id);
    if (yaEsta) {
        let cursoEliminado = miHorario.find(c => c.id_unico === id);
        SadaAnalytics.trackEliminarCurso(cursoEliminado);
        miHorario = miHorario.filter(c => c.id_unico !== id);
    } else {
        miHorario = miHorario.filter(c => c.asignatura !== asignatura);
        let curso = BD_AGRUPADA.find(c => c.id_unico === id);
        SadaAnalytics.trackAgregarCurso(curso);
        miHorario.push(curso);
    }
    ordenarMiHorario();
    guardarEstado();
    actualizarTablaHorario();
    renderizarHorarioVisual();
    filtrarMaterias();
    cargarPanelGrupos(asignatura);
}

function ordenarMiHorario(criterioInput = null) {
    let criterio = criterioInput;
    if (!criterio) {
        let el = document.getElementById('sort-manual');
        if (el) criterio = el.value;
    }
    if (!criterio) return;

    // Actualizar UI del selector si existe (para sincronizar)
    let elSelect = document.getElementById('sort-manual');
    if (elSelect && criterioInput) elSelect.value = criterioInput;

    // Actualizar texto del botón si existe
    let btnLabel = document.getElementById('btn-sort-label');
    if (btnLabel) {
        const labels = {
            'materia': 'Materia',
            'profesor': 'Profesor',
            'grupo': 'Grupo',
            'horas': 'Duración',
            'cronologico': 'Cronológico'
        };
        btnLabel.innerText = labels[criterio] || 'Ordenar';
    }
    const mapaDias = { 'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5 };
    miHorario.sort((a, b) => {
        switch (criterio) {
            case 'materia': return a.asignatura.localeCompare(b.asignatura);
            case 'profesor': return a.profesor.localeCompare(b.profesor);
            case 'grupo':
                let gA = parseInt(a.grupo); let gB = parseInt(b.grupo);
                if (!isNaN(gA) && !isNaN(gB)) return gA - gB;
                return a.grupo.localeCompare(b.grupo);
            case 'horas':
                let durA = a.sesiones.reduce((sum, s) => sum + (s.min_fin - s.min_inicio), 0);
                let durB = b.sesiones.reduce((sum, s) => sum + (s.min_fin - s.min_inicio), 0);
                return durB - durA;
            case 'cronologico':
                let getEarliest = (curso) => {
                    if (curso.sesiones.length === 0) return 999999;
                    return Math.min(...curso.sesiones.map(s => {
                        let diaIdx = mapaDias[s.dia] !== undefined ? mapaDias[s.dia] : 9;
                        return (diaIdx * 10000) + s.min_inicio;
                    }));
                };
                return getEarliest(a) - getEarliest(b);
            default: return 0;
        }
    });
    guardarEstado();
    actualizarTablaHorario();
    renderizarHorarioVisual();
}

function actualizarTablaHorario() {
    let tbody = document.getElementById('tabla-mi-horario');
    if (!tbody) return;
    tbody.innerHTML = '';
    let total = 0;
    let btnLimpiar = document.getElementById('btn-limpiar-manual');
    if (btnLimpiar) btnLimpiar.style.display = miHorario.length ? 'inline-block' : 'none';
    if (!miHorario.length && !actividadesExtra.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">No has agregado materias aún.</td></tr>';
    } else {
        miHorario.forEach((c, idx) => {
            total += c.creditos;
            tbody.innerHTML += generarFilaSIAE(c, idx);
        });
        actividadesExtra.forEach(act => {
            tbody.innerHTML += generarFilaSIAE(act, null, false);
        });
    }

    // --- LOGICA AJUSTADA DE CREDITOS ---
    let semVal = parseInt(document.getElementById('semestre-selector').value);
    let badge = document.getElementById('creditos-badge');
    badge.innerText = `${total} Créditos`;
    badge.className = 'badge me-3';

    let minIdeal = 37;
    let maxIdeal = 41;

    if (semVal === 2) { minIdeal = 40; maxIdeal = 40; }
    if (semVal === 4) { minIdeal = 44; maxIdeal = 44; }

    if (total === 0) {
        badge.classList.add('bg-secondary');
    } else if (total < minIdeal) {
        badge.classList.add('bg-warning', 'text-dark');
        badge.innerText += " (Faltan)";
    } else if (total > maxIdeal) {
        badge.classList.add('bg-danger');
        badge.innerText += " (Exceso)";
    } else {
        badge.classList.add('bg-success');
        badge.innerText += " (¡Perfecto!)";
        // Auto-snapshot silencioso al llegar a créditos ideales
        SadaAnalytics.saveSnapshot(miHorario, actividadesExtra, document.getElementById('semestre-selector').value, 'manual', false);
    }

    if (document.getElementById('switch-vista').checked) renderizarHorarioVisual();
}

function generarFilaSIAE(c, idx = null, showDelete = true) {
    let d = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };
    c.sesiones.forEach(s => { let k = s.dia.toUpperCase().replace('É', 'E'); if (d.hasOwnProperty(k)) d[k] = `${s.inicio}-${s.fin}`; });
    let btn = showDelete ? `<button onclick="borrar(${idx})" class="btn btn-sm text-danger p-0"><i class="bi bi-x-circle-fill"></i></button>` : '';
    let obsCell = '';
    if (c.observaciones && c.observaciones.length > 5) {
        let rndId = 'obs-auto-' + Math.random().toString(36).substr(2, 6);
        obsCell = `<button class="btn-ver-obs" onclick="verObs('${rndId}')">Ver Obs</button><div id="${rndId}" class="obs-box text-start mt-1" style="display:none; min-width: 150px;">${c.observaciones}</div>`;
    }
    return `<tr><td class="text-start small fw-bold text-primary text-truncate" style="max-width:150px;" title="${c.asignatura}">${c.asignatura} <span class="text-muted fw-normal">(${c.clave})</span></td><td>${c.grupo}</td><td class="text-start small text-uppercase text-truncate" style="max-width:150px;" title="${c.profesor}">${c.profesor}</td><td>${d.LUNES}</td><td>${d.MARTES}</td><td>${d.MIERCOLES}</td><td>${d.JUEVES}</td><td>${d.VIERNES}</td><td>${d.SABADO}</td><td>${c.creditos}</td><td>${obsCell}</td><td>${btn}</td></tr>`;
}

function borrar(idx) {
    registrarEstado();
    let borrada = miHorario[idx];
    SadaAnalytics.trackEliminarCurso(borrada);
    miHorario.splice(idx, 1);
    guardarEstado();
    actualizarTablaHorario();
    filtrarMaterias();
    if (materiaSeleccionadaActual === borrada.asignatura) cargarPanelGrupos(borrada.asignatura);
}
function limpiarTodoManual() {
    if (confirm("¿Borrar todo?")) {
        SadaAnalytics.trackHerramienta('clear_all');
        registrarEstado();
        miHorario = [];
        materiasPendientes = [];
        guardarEstado();
        limpiarPanelGrupos();
        filtrarMaterias();
        actualizarTablaHorario();
    }
}

// --- NUEVAS FUNCIONES DE DESCARGA (CORRIGEN MÓVIL/VERTICAL) ---
// ==========================================
// 12. FUNCIONES DE EXPORTACIÓN
// ==========================================

// --- NUEVAS FUNCIONES DE DESCARGA (CORRIGEN MÓVIL/VERTICAL) ---
async function descargarPDF() {
    const { jsPDF } = window.jspdf;

    // 1. Clonar contenido a un contenedor oculto con ancho fijo
    let isVisual = document.getElementById('switch-vista').checked;
    let sourceId = isVisual ? 'vista-visual-container' : 'vista-lista-container';
    let source = document.getElementById(sourceId);

    let container = document.getElementById('capture-container');
    container.innerHTML = ''; // Limpiar

    let wrapper = document.createElement('div');
    wrapper.style.width = '1300px'; // Forzar ancho escritorio
    wrapper.style.padding = '20px';
    wrapper.style.backgroundColor = '#ffffff';

    let clone = source.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';

    wrapper.appendChild(clone);
    container.appendChild(wrapper);

    // 2. Capturar desde el contenedor oculto
    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, scrollY: 0 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const ratio = imgProps.width / imgProps.height;

    let w = pdfWidth - 20;
    let h = w / ratio;
    if (h > pdfHeight - 20) { h = pdfHeight - 20; w = h * ratio; }

    let x = (pdfWidth - w) / 2;
    let y = (pdfHeight - h) / 2;

    pdf.addImage(imgData, 'PNG', x, y, w, h);
    pdf.save('Horario_FacPsi_UNAM.pdf');
    SadaAnalytics.trackExportar('pdf', { modo: 'manual', materiasCount: miHorario.length, creditosTotal: miHorario.reduce((a, b) => a + b.creditos, 0), semestre: document.getElementById('semestre-selector').value, materias: miHorario.map(c => ({ nombre: c.asignatura, clave: c.clave })) });

    container.innerHTML = ''; // Limpiar
}

async function descargarImagen() {
    // 1. Clonar contenido a un contenedor oculto con ancho fijo
    let isVisual = document.getElementById('switch-vista').checked;
    let sourceId = isVisual ? 'vista-visual-container' : 'vista-lista-container';
    let source = document.getElementById(sourceId);

    let container = document.getElementById('capture-container');
    container.innerHTML = '';

    let wrapper = document.createElement('div');
    wrapper.style.width = '1300px'; // Forzar ancho escritorio
    wrapper.style.padding = '20px';
    wrapper.style.backgroundColor = '#ffffff';

    let clone = source.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';

    wrapper.appendChild(clone);
    container.appendChild(wrapper);

    // 2. Capturar
    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, scrollY: 0 });
    const link = document.createElement('a');
    link.download = 'Horario_FacPsi_UNAM.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    SadaAnalytics.trackExportar('png', { modo: 'manual', materiasCount: miHorario.length, creditosTotal: miHorario.reduce((a, b) => a + b.creditos, 0), semestre: document.getElementById('semestre-selector').value, materias: miHorario.map(c => ({ nombre: c.asignatura, clave: c.clave })) });

    container.innerHTML = '';
}

function descargarCSV() {
    if (miHorario.length === 0) return alert("No hay horario para exportar.");
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Materia,Clave,Grupo,Profesor,Lunes,Martes,Miercoles,Jueves,Viernes,Sabado,Creditos,Observaciones\n";
    miHorario.forEach(c => {
        let d = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };
        c.sesiones.forEach(s => { let k = s.dia.toUpperCase().replace('É', 'E'); if (d.hasOwnProperty(k)) d[k] = `${s.inicio}-${s.fin}`; });
        let asig = c.asignatura.replace(/,/g, '');
        let prof = c.profesor.replace(/,/g, '');
        let obs = (c.observaciones || "").replace(/,/g, ' ').replace(/\n/g, ' ');
        let row = `${asig},${c.clave},${c.grupo},${prof},${d.LUNES},${d.MARTES},${d.MIERCOLES},${d.JUEVES},${d.VIERNES},${d.SABADO},${c.creditos},${obs}`;
        csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Horario_FacPsi_UNAM.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    SadaAnalytics.trackExportar('csv', { modo: 'manual', materiasCount: miHorario.length, creditosTotal: miHorario.reduce((a, b) => a + b.creditos, 0), semestre: document.getElementById('semestre-selector').value, materias: miHorario.map(c => ({ nombre: c.asignatura, clave: c.clave })) });
}

function descargarExcel() {
    if (miHorario.length === 0) return alert("No hay horario para exportar.");

    const headers = ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const diasKeys = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];

    let ws_data = [headers];
    let startMin = 7 * 60;
    let endMin = 21 * 60;
    let step = 30;

    let rowMap = {};
    let rowIndex = 1;

    for (let m = startMin; m < endMin; m += step) {
        let horaLabel = minutosAHora(m) + " - " + minutosAHora(m + 30);
        let row = [horaLabel, "", "", "", "", "", ""];
        ws_data.push(row);
        rowMap[m] = rowIndex;
        rowIndex++;
    }

    let merges = [];

    miHorario.forEach(curso => {
        let textoCelda = `${curso.asignatura} (${curso.clave})\n(${curso.profesor})\nGpo: ${curso.grupo}`;
        curso.sesiones.forEach(sesion => {
            let diaNormal = sesion.dia.toUpperCase().replace("É", "E");
            let colIndex = diasKeys.indexOf(diaNormal) + 1;
            if (colIndex > 0) {
                let startM = sesion.min_inicio;
                let endM = sesion.min_fin;
                if (startM < startMin) startM = startMin;
                let rStart = rowMap[startM];
                if (rStart !== undefined) {
                    let durationMins = endM - startM;
                    let rowSpan = Math.ceil(durationMins / 30);
                    ws_data[rStart][colIndex] = textoCelda;
                    if (rowSpan > 1) {
                        merges.push({
                            s: { r: rStart, c: colIndex },
                            e: { r: rStart + rowSpan - 1, c: colIndex }
                        });
                    }
                }
            }
        });
    });

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet(ws_data);
    if (merges.length > 0) ws['!merges'] = merges;
    var wscols = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
    ws['!cols'] = wscols;
    XLSX.utils.book_append_sheet(wb, ws, "Horario Visual");
    XLSX.writeFile(wb, "Horario_FacPsi_UNAM.xlsx");
    SadaAnalytics.trackExportar('excel', { modo: 'manual', materiasCount: miHorario.length, creditosTotal: miHorario.reduce((a, b) => a + b.creditos, 0), semestre: document.getElementById('semestre-selector').value, materias: miHorario.map(c => ({ nombre: c.asignatura, clave: c.clave })) });
}

// ==========================================
// 12.5. ACTIVIDADES EXTRACURRICULARES
// ==========================================

function agregarActividad(source) {
    let suffix = source === 'auto' ? '-auto' : '';
    let nombre = document.getElementById('act-nombre' + suffix).value.trim();
    let inicio = document.getElementById('act-inicio' + suffix).value;
    let fin = document.getElementById('act-fin' + suffix).value;
    let diasChecks = document.querySelectorAll('.act-dia-chk' + suffix + ':checked');
    let dias = Array.from(diasChecks).map(c => c.value);

    if (!nombre) return alert('Escribe un nombre para la actividad.');
    if (dias.length === 0) return alert('Selecciona al menos un día.');
    if (!inicio || !fin) return alert('Selecciona hora de inicio y fin.');
    if (convertirMinutos(inicio) >= convertirMinutos(fin)) return alert('La hora de inicio debe ser antes que la de fin.');

    let id = 'act_' + Date.now();
    let sesiones = dias.map(dia => ({
        dia: dia, inicio: inicio, fin: fin,
        min_inicio: convertirMinutos(inicio), min_fin: convertirMinutos(fin)
    }));

    let actividad = {
        id_unico: id, asignatura: '⚡ ' + nombre, profesor: 'Actividad Extra',
        grupo: '-', creditos: 0, clave: '-', observaciones: '', semestre: 0,
        area: 'EXTRA', sesiones: sesiones, esActividad: true
    };

    let conflictos = obtenerChoques(actividad, [...miHorario, ...actividadesExtra]);
    if (conflictos.length > 0) {
        let nombres = conflictos.map(c => c.asignatura).join(', ');
        if (!confirm('Esta actividad choca con: ' + nombres + '.\n¿Agregarla de todas formas?')) return;
    }

    actividadesExtra.push(actividad);
    renderActividades();
    renderizarHorarioVisual();
    actualizarTablaHorario();

    document.getElementById('act-nombre' + suffix).value = '';
    document.querySelectorAll('.act-dia-chk' + suffix).forEach(c => { c.checked = false; c.parentElement.classList.remove('active'); });

    SadaAnalytics.trackCustom('add_activity', { name: nombre, dias: dias, inicio: inicio, fin: fin });
}

function eliminarActividad(id) {
    actividadesExtra = actividadesExtra.filter(a => a.id_unico !== id);
    renderActividades();
    renderizarHorarioVisual();
    actualizarTablaHorario();
    if (materiaSeleccionadaActual) cargarPanelGrupos(materiaSeleccionadaActual);
}

function renderActividades() {
    let count = actividadesExtra.length;
    ['', '-auto'].forEach(suffix => {
        let lista = document.getElementById('lista-actividades' + suffix);
        let badge = document.getElementById('badge-actividades' + suffix);
        if (badge) { badge.style.display = count > 0 ? 'inline-block' : 'none'; badge.textContent = count; }
        if (!lista) return;
        lista.innerHTML = '';
        actividadesExtra.forEach(act => {
            let diasStr = act.sesiones.map(s => s.dia.substr(0, 3)).join(', ');
            let horaStr = act.sesiones[0] ? act.sesiones[0].inicio + '-' + act.sesiones[0].fin : '';
            let nombre = act.asignatura.replace('⚡ ', '');
            let item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center py-1 px-2';
            item.innerHTML = '<div class="small"><span class="fw-bold" style="color: #e65100;">' + nombre + '</span><br><span class="text-muted" style="font-size:0.7rem;">' + diasStr + ' · ' + horaStr + '</span></div><button class="btn btn-sm text-danger p-0" onclick="eliminarActividad(\'' + act.id_unico + '\')" title="Eliminar"><i class="bi bi-x-circle"></i></button>';
            lista.appendChild(item);
        });
    });
}

// ==========================================
// 13. MODO EXPLORADOR: SELECCIÓN Y GENERACIÓN
// ==========================================

function filtrarMateriasAuto() {
    let txt = document.getElementById('buscador-auto').value.toUpperCase();
    let lista = document.getElementById('lista-materias-auto'); lista.innerHTML = '';
    let matSem = obtenerMateriasActivas();
    if (matSem.length === 0) { lista.innerHTML = '<div class="p-3 text-muted small text-center">No hay datos.</div>'; return; }
    let areas = [...new Set(matSem.map(c => c.area))].sort();

    areas.forEach(area => {
        let matsEnArea = [...new Set(matSem.filter(c => c.area === area).map(c => c.asignatura))].sort();
        let matsFiltradas = matsEnArea.filter(m => m.toUpperCase().includes(txt));

        if (matsFiltradas.length > 0) {
            let header = document.createElement('div');
            header.className = 'area-header area-toggle';
            header.innerHTML = `<i class="bi bi-chevron-right area-arrow"></i> ${area} <span class="badge bg-secondary rounded-pill ms-1">${matsFiltradas.length}</span>`;
            header.style.cursor = 'pointer';

            let grupo = document.createElement('div');
            grupo.className = 'area-group';
            grupo.style.display = 'none';

            let tieneActiva = matsFiltradas.includes(materiaSeleccionadaAuto);
            let hayBusqueda = txt.length >= 2;
            if (tieneActiva || hayBusqueda) {
                grupo.style.display = 'block';
                header.querySelector('.area-arrow').classList.add('area-arrow-open');
            }

            header.onclick = () => {
                let abierto = grupo.style.display === 'block';
                grupo.style.display = abierto ? 'none' : 'block';
                header.querySelector('.area-arrow').classList.toggle('area-arrow-open');
            };

            lista.appendChild(header);

            matsFiltradas.forEach(nom => {
                let enBolsa = bolsa[nom] && bolsa[nom].length > 0;
                let active = materiaSeleccionadaAuto === nom ? 'active-item' : '';
                let item = document.createElement('div');
                item.className = `list-group-item materia-item px-3 py-2 ${enBolsa ? 'candidata-item' : ''} ${active}`;
                item.innerHTML = `<div class="d-flex justify-content-between align-items-center"><span class="${enBolsa ? 'fw-bold text-dark' : ''}">${nom}</span>${enBolsa ? '<i class="bi bi-star-fill text-warning"></i>' : ''}</div>`;
                item.onclick = () => {
                    materiaSeleccionadaAuto = nom;
                    filtrarMateriasAuto();
                    cargarPanelGruposAuto(nom);
                };
                grupo.appendChild(item);
            });

            lista.appendChild(grupo);
        }
    });
}

function limpiarPanelGruposAuto() {
    document.getElementById('titulo-seleccion-auto').innerHTML = '<i class="bi bi-arrow-left-circle"></i> 2. Selecciona tus Profesores';
    document.getElementById('info-seleccion-auto').innerText = 'Esperando...';
    document.getElementById('contenedor-grupos-auto').innerHTML = '<div class="text-center text-muted py-5 w-100"><i class="bi bi-hand-index-thumb display-1 opacity-25"></i><p class="mt-3 lead">Selecciona una materia a la izquierda.</p></div>';
}

function cargarPanelGruposAuto(asignatura) {
    document.getElementById('titulo-seleccion-auto').innerHTML = `<i class="bi bi-book"></i> ${asignatura}`;
    let cursos = obtenerMateriasActivas().filter(c => c.asignatura === asignatura).sort((a, b) => a.grupo.localeCompare(b.grupo));
    document.getElementById('info-seleccion-auto').innerText = `${cursos.length} Grupos`;

    let contenedor = document.getElementById('contenedor-grupos-auto'); contenedor.innerHTML = '';
    if (cursos.length === 0) { contenedor.innerHTML = '<div class="alert alert-warning text-center w-100">No se encontraron grupos.</div>'; return; }

    let idsEnBolsa = [];
    if (bolsa[asignatura]) {
        idsEnBolsa = bolsa[asignatura].map(c => c.id_unico);
    }

    cursos.forEach(c => {
        let seleccionado = idsEnBolsa.includes(c.id_unico);
        let horario = c.sesiones.map(s => `<div><span class="fw-bold">${s.dia.substr(0, 3)}</span> ${s.inicio}-${s.fin}</div>`).join('') || "<i>Sin horario</i>";
        let obsBtn = c.observaciones.length > 5 ? `<button class="btn-ver-obs" onclick="event.stopPropagation(); verObs('obs-auto-${c.id_unico}')">Ver Obs</button>` : '';
        let obsBox = c.observaciones.length > 5 ? `<div id="obs-auto-${c.id_unico}" class="obs-box">${c.observaciones}</div>` : '';

        let claseEstado = seleccionado ? 'candidato-seleccionado' : '';
        let textoEstado = seleccionado ? '<div class="mt-2 text-center text-dark fw-bold small"><i class="bi bi-check-circle-fill text-warning"></i> Seleccionado</div>' : '<div class="mt-2 text-center text-primary fw-bold small opacity-0 btn-add">Agregar</div>';

        let col = document.createElement('div'); col.className = 'col-auto'; col.style.width = '280px'; col.style.flexShrink = '0';
        col.innerHTML = `
<div class="grupo-card p-3 d-flex flex-column ${claseEstado}" onclick="toggleCandidato(${c.id_unico}, '${asignatura}')">
    <div class="d-flex justify-content-between mb-2">
        <span class="badge bg-secondary">Gpo ${c.grupo}</span>
        <span class="text-muted small">${c.creditos} Cr</span>
    </div>
    <div class="mb-1 text-center"><span class="badge bg-light text-dark border">Clave: ${c.clave}</span></div>
    <h6 class="card-title text-primary small text-uppercase fw-bold mb-2" style="min-height:2.5em;">${c.profesor}</h6>
    <div class="small text-muted flex-grow-1 border-top pt-2">${horario}</div> 
    ${obsBtn} ${obsBox} ${textoEstado}
</div>`;
        contenedor.appendChild(col);
    });
}

function toggleCandidato(id, asignatura) {
    if (!bolsa[asignatura]) bolsa[asignatura] = [];
    let index = bolsa[asignatura].findIndex(c => c.id_unico === id);
    if (index > -1) {
        bolsa[asignatura].splice(index, 1);
        if (bolsa[asignatura].length === 0) delete bolsa[asignatura];
    } else {
        let curso = BD_AGRUPADA.find(c => c.id_unico === id);
        bolsa[asignatura].push(curso);
        SadaAnalytics.trackAgregarBolsa(asignatura, bolsa[asignatura].length, curso);
    }
    guardarEstado();
    renderBolsa();
    filtrarMateriasAuto();
    cargarPanelGruposAuto(asignatura);
}

function renderBolsa() {
    let ul = document.getElementById('lista-bolsa'); ul.innerHTML = '';
    let keys = Object.keys(bolsa);
    if (keys.length === 0) { ul.innerHTML = '<li class="list-group-item text-muted text-center py-3">Vacío</li>'; return; }
    keys.forEach(k => {
        let li = document.createElement('li'); li.className = 'list-group-item d-flex justify-content-between align-items-center py-1';
        li.innerHTML = `<div><span class="fw-bold d-block text-truncate small" style="max-width:140px;" title="${k}">${k}</span></div><div><span class="badge bg-secondary rounded-pill me-2">${bolsa[k].length}</span><i class="bi bi-x-circle text-danger cursor-pointer" onclick="delBolsa('${k}')"></i></div>`;
        ul.appendChild(li);
    });
}

function delBolsa(k) { delete bolsa[k]; guardarEstado(); renderBolsa(); filtrarMateriasAuto(); limpiarPanelGruposAuto(); }
function limpiarBolsa() {
    if (confirm("¿Limpiar todo? Se borrarán las selecciones y todas las combinaciones generadas.")) {
        bolsa = {};
        RESULTADOS_MOSTRADOS = [];
        OFFSET_MOSTRADOS = 0;
        guardarEstado();
        renderBolsa();
        filtrarMateriasAuto();
        limpiarPanelGruposAuto();
        let resDiv = document.getElementById('resultados-auto');
        if (resDiv) resDiv.innerHTML = '<div class="text-center text-muted py-5"><p class="small">Configura tus profesores arriba y genera horarios.</p></div>';
        let panelFiltros = document.getElementById('panel-filtros-resultados');
        if (panelFiltros) panelFiltros.style.display = 'none';
        let conteo = document.getElementById('conteo-resultados');
        if (conteo) conteo.innerText = '0 opciones';
    }
}

function esCombinacionValida(comb) {
    let teoria = comb.find(c => c.asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III");
    let practica = comb.find(c => c.asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III (PRACTICA)");
    if (teoria && practica) { if (!teoria.observaciones.includes(practica.grupo)) return false; }
    return true;
}

// ==========================================
// 14. ALGORITMOS DE GENERACIÓN
// ==========================================

async function generarCombinaciones() {
    let resDiv = document.getElementById('resultados-auto');

    resDiv.innerHTML = `
            <div class="text-center py-5">
<div class="spinner-border text-primary mb-2" role="status"></div>
<h6 class="fw-bold text-primary">Analizando combinaciones...</h6>
<p class="small text-muted" id="progress-text">Iniciando motor...</p>
<div class="progress w-50 mx-auto" style="height: 5px;">
    <div id="progress-bar-inner" class="progress-bar" role="progressbar" style="width: 0%"></div>
</div>
<button class="btn btn-sm btn-outline-danger mt-3" onclick="window.detenerGeneracion = true">Cancelar</button>
            </div>`;

    window.detenerGeneracion = false;
    await new Promise(r => setTimeout(r, 100));

    try {
        let nombresMaterias = Object.keys(bolsa);
        let listas = Object.values(bolsa);

        if (!listas.length) { throw new Error("Agrega materias primero."); }

        for (let i = 0; i < nombresMaterias.length; i++) {
            if (!listas[i] || listas[i].length === 0) throw new Error(`La materia "${nombresMaterias[i]}" está en tu lista pero no tiene grupos seleccionados.`);
        }

        let totalPosibilidades = listas.reduce((acc, lista) => acc * lista.length, 1);

        if (totalPosibilidades > 2000000) {
            if (!confirm(`Se han detectado ${totalPosibilidades.toLocaleString()} combinaciones posibles. Esto podría tardar. ¿Continuar?`)) {
                resDiv.innerHTML = '<div class="text-center py-4 text-muted">Cancelado por el usuario.</div>';
                return;
            }
        }

        RESULTADOS_GLOBALES = [];
        let indices = new Array(listas.length).fill(0);
        let combinacionesProcesadas = 0;
        let combinacionesValidas = 0;
        let startTimestamp = Date.now();

        while (true) {
            if (window.detenerGeneracion) {
                resDiv.innerHTML = '<div class="alert alert-warning text-center">Cálculo detenido.</div>';
                return;
            }

            let comb = [];
            for (let i = 0; i < listas.length; i++) {
                comb.push(listas[i][indices[i]]);
            }

            if (!hayChoqueCombo(comb) && esCombinacionValida(comb)) {
                let creds = comb.reduce((a, b) => a + b.creditos, 0);
                let diasSet = new Set(comb.flatMap(c => c.sesiones.map(s => s.dia)));
                let huecos = calcularHuecos(comb);

                RESULTADOS_GLOBALES.push({
                    cursos: [...comb],
                    creditos: creds,
                    dias: diasSet.size,
                    huecos: huecos
                });
                combinacionesValidas++;
            }

            combinacionesProcesadas++;

            if (combinacionesProcesadas % 500 === 0) {
                let now = Date.now();
                if (now - startTimestamp > 100) {
                    let porcentaje = Math.min(100, Math.round((combinacionesProcesadas / totalPosibilidades) * 100));
                    let elTexto = document.getElementById('progress-text');
                    let elBarra = document.getElementById('progress-bar-inner');

                    if (elTexto) elTexto.innerText = `Analizando... (${combinacionesValidas} válidas)`;
                    if (elBarra) elBarra.style.width = `${porcentaje}%`;

                    await new Promise(r => setTimeout(r, 0));
                    startTimestamp = now;
                }
            }

            if (combinacionesValidas >= 5000) break;

            let nextIndex = listas.length - 1;
            while (nextIndex >= 0) {
                indices[nextIndex]++;
                if (indices[nextIndex] < listas[nextIndex].length) {
                    break;
                } else {
                    indices[nextIndex] = 0;
                    nextIndex--;
                }
            }
            if (nextIndex < 0) break;
        }

        if (RESULTADOS_GLOBALES.length > 0) {
            SadaAnalytics.trackGenerarCombinaciones({
                materiasCount: nombresMaterias.length,
                materias: nombresMaterias,
                totalPosibilidades: totalPosibilidades,
                resultadosValidos: RESULTADOS_GLOBALES.length,
                tiempoMs: Date.now() - startTimestamp,
                semestre: document.getElementById('semestre-selector').value,
                totalCreditos: RESULTADOS_GLOBALES[0] ? RESULTADOS_GLOBALES[0].creditos : 0,
                cancelado: false
            });
            renderizarFiltroProfesores();
            actualizarFiltrosUI();
            document.getElementById('panel-filtros-resultados').style.display = 'block';
            aplicarOrdenYFiltro();
        } else {
            ejecutarDetectiveDeConflictos(nombresMaterias, resDiv);
        }
    } catch (error) {
        console.error(error);
        resDiv.innerHTML = `<div class="alert alert-danger text-center"><i class="bi bi-exclamation-triangle-fill"></i> ${error.message}</div>`;
    }
}

function ejecutarDetectiveDeConflictos(nombresMaterias, contenedor) {
    document.getElementById('panel-filtros-resultados').style.display = 'none';
    let resDiv = document.getElementById('resultados-auto');

    resDiv.innerHTML = `
        <div class="card border-0 shadow-sm mx-auto mt-4" style="max-width: 600px;">
            <div class="card-body text-center p-5">
                <div class="mb-4">
                    <i class="bi bi-puzzle display-1 text-muted opacity-50"></i>
                </div>
                <h4 class="fw-bold text-dark mb-3">No existen horarios posibles</h4>
                <p class="text-muted mb-4">
                    El sistema ha explorado todas las opciones pero no encontró combinaciones válidas. 
                    Esto suele ocurrir cuando hay <strong>traslapes inevitables</strong> entre materias obligatorias 
                    o cuando se exceden los límites de tiempo.
                </p>
                <div class="alert alert-light border small text-muted mb-4">
                    <i class="bi bi-info-circle me-2"></i> No es un error del estudiante ni una falla del sistema. Es un rompecabezas complejo que requiere ajustes.
                </div>
                <button class="btn btn-primary rounded-pill px-4 py-2 shadow-sm" onclick="iniciarAnalisisProfundo()">
                    <i class="bi bi-search me-2"></i> Identificar materia en conflicto
                </button>
            </div>
        </div>
    `;
}

async function iniciarAnalisisProfundo() {
    let resDiv = document.getElementById('resultados-auto');
    resDiv.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <h5 class="fw-bold">Analizando conflictos...</h5>
            <p class="text-muted small">Simulando escenarios alternativos...</p>
        </div>
    `;

    await new Promise(r => setTimeout(r, 800)); // UX delay

    let reportes = [];
    let nombres = Object.keys(bolsa);

    for (let materiaIgnorada of nombres) {
        // Crear bolsa temporal sin esta materia
        let listasTemp = [];
        for (let m of nombres) {
            if (m !== materiaIgnorada) {
                listasTemp.push(bolsa[m]);
            }
        }

        let sim = simularGeneracion(listasTemp);
        if (sim.validas > 0) {
            reportes.push({
                ignorada: materiaIgnorada,
                validas: sim.validas,
                creditos: sim.avgCreditos,
                maxCreditos: sim.maxCreditos
            });
        }
    }

    // Ordenar por quién desbloquea más opciones
    reportes.sort((a, b) => b.validas - a.validas);

    // Renderizar Reporte
    let html = `<div class="container py-4" style="max-width:800px;">
        <div class="d-flex align-items-center mb-4">
            <button class="btn btn-sm btn-outline-secondary me-3" onclick="generarCombinaciones()"><i class="bi bi-arrow-clockwise"></i> Reintentar</button>
            <h4 class="fw-bold mb-0">Reporte de Conflictos</h4>
        </div>`;

    if (reportes.length === 0) {
        html += `<div class="alert alert-warning text-center shadow-sm">
            <h5 class="fw-bold"><i class="bi bi-exclamation-triangle"></i> Conflicto Complejo</h5>
            <p>Incluso quitando una materia a la vez, no se encontraron soluciones válidas.</p>
            <p class="small text-muted mb-0">Esto indica que hay múltiples choques simultáneos. Prueba reduciendo tu carga académica eliminando 2 o más materias manualmente.</p>
        </div>`;
    } else {
        html += `<p class="alert alert-info border-0 shadow-sm mb-4"><i class="bi bi-lightbulb-fill me-2"></i>Se detectó que las siguientes materias están bloqueando tu horario. Te sugerimos empezar evaluando la primera opción.</p>`;

        reportes.forEach((rep, idx) => {
            let isBest = idx === 0;
            let badgeCreditos = rep.maxCreditos > 41 ?
                `<span class="badge bg-warning text-dark border border-warning ms-2"><i class="bi bi-exclamation-circle"></i> Excede Créditos (${rep.maxCreditos})</span>` :
                (rep.maxCreditos < 30 ? `<span class="badge bg-light text-muted border ms-2">Baja Carga (${rep.maxCreditos} Cr)</span>` : '');

            html += `
            <div class="card mb-3 ${isBest ? 'border-primary shadow-sm' : 'border-light shadow-sm'}">
                <div class="card-body d-flex justify-content-between align-items-center flex-wrap">
                    <div>
                        ${isBest ? '<div class="text-uppercase text-primary fw-bold mb-1" style="font-size:0.7rem; letter-spacing:1px;">Mejor Solución</div>' : ''}
                        <h5 class="fw-bold mb-1">Si eliminas: <span class="text-danger">${rep.ignorada}</span></h5>
                        <p class="mb-0 text-muted small">Se desbloquean <strong>${rep.validas}${rep.validas >= 100 ? '+' : ''} combinaciones</strong> posibles.</p>
                    </div>
                    <div class="text-end mt-2 mt-sm-0">
                        ${badgeCreditos}
                    </div>
                </div>
            </div>`;
        });
    }
    html += `</div>`;
    resDiv.innerHTML = html;
}

function simularGeneracion(listas) {
    let indices = new Array(listas.length).fill(0);
    let validas = 0;
    let sumaCreditos = 0;
    let maxCreditos = 0;
    let count = 0;

    while (true) {
        let comb = [];
        for (let i = 0; i < listas.length; i++) comb.push(listas[i][indices[i]]);

        if (!hayChoqueCombo(comb) && esCombinacionValida(comb)) {
            validas++;
            let c = comb.reduce((a, b) => a + b.creditos, 0);
            sumaCreditos += c;
            if (c > maxCreditos) maxCreditos = c;
        }

        count++;
        if (validas >= 100 || count >= 2000) break; // Limite para velocidad

        let next = listas.length - 1;
        while (next >= 0) {
            indices[next]++;
            if (indices[next] < listas[next].length) break;
            indices[next] = 0;
            next--;
        }
        if (next < 0) break;
    }

    return {
        validas,
        avgCreditos: validas ? Math.round(sumaCreditos / validas) : 0,
        maxCreditos
    };
}


// ==========================================
// 15. RENDERIZADO DE RESULTADOS Y UTILIDADES
// ==========================================

function renderizarFiltroProfesores() {
    let container = document.getElementById('lista-profes-filtro-resultados');
    if (!container) return;
    container.innerHTML = '';

    let todosLosProfes = new Set();
    RESULTADOS_GLOBALES.forEach(r => {
        r.cursos.forEach(c => todosLosProfes.add(c.profesor));
    });

    let listaOrdenada = Array.from(todosLosProfes).sort();

    if (listaOrdenada.length === 0) {
        container.innerHTML = '<div class="text-muted small text-center p-2">No hay profesores para filtrar.</div>';
        return;
    }

    listaOrdenada.forEach(profe => {
        let div = document.createElement('div'); div.className = 'form-check mb-1';
        // Generar ID seguro
        let safeId = 'chk-prof-' + profe.replace(/[^a-zA-Z0-9]/g, '');
        let safeVal = profe.replace(/"/g, '&quot;');
        div.innerHTML = `<input class="form-check-input chk-filtro-profe" type="checkbox" value="${safeVal}" id="${safeId}" onchange="aplicarOrdenYFiltro()">
                         <label class="form-check-label small text-truncate d-block" for="${safeId}" title="${profe}">${profe}</label>`;
        container.appendChild(div);
    });
}

function filtrarListaProfesResultados(input) {
    let txt = input.value.toUpperCase();
    document.querySelectorAll('.chk-filtro-profe').forEach(chk => {
        let label = chk.nextElementSibling.innerText.toUpperCase();
        chk.parentElement.style.display = label.includes(txt) ? 'block' : 'none';
    });
}

function toggleAllProfesResultados(state) {
    document.querySelectorAll('.chk-filtro-profe').forEach(chk => {
        if (chk.parentElement.style.display !== 'none') chk.checked = state;
    });
    aplicarOrdenYFiltro();
}

function calcularHuecos(comb) {
    let agenda = {}; comb.forEach(c => c.sesiones.forEach(s => { if (!agenda[s.dia]) agenda[s.dia] = []; agenda[s.dia].push([s.min_inicio, s.min_fin]); }));
    let huecos = 0;
    for (let dia in agenda) {
        let bloq = agenda[dia].sort((a, b) => a[0] - b[0]);
        for (let i = 0; i < bloq.length - 1; i++) { let diff = bloq[i + 1][0] - bloq[i][1]; if (diff > 0) huecos += diff; }
    }
    return Math.round(huecos / 60);
}

function aplicarOrdenYFiltro() {
    let crit = document.getElementById('sort-resultados').value;
    let tFiltro = document.getElementById('filtro-turno').value;
    let diasLibres = Array.from(document.querySelectorAll('.chk-filtro-dia:checked')).map(c => c.value);
    let textoBotonDia = document.getElementById('btn-filtro-dia');
    textoBotonDia.innerText = diasLibres.length > 0 ? `${diasLibres.length} seleccionados` : "Ninguno";
    let profesSeleccionados = Array.from(document.querySelectorAll('.chk-filtro-profe:checked')).map(c => c.value);
    let textoBotonProfe = document.getElementById('btn-filtro-profe');
    textoBotonProfe.innerText = profesSeleccionados.length > 0 ? (profesSeleccionados.length === 1 ? profesSeleccionados[0] : `${profesSeleccionados.length} seleccionados`) : "Todos";

    // Tracking de filtros usados
    SadaAnalytics.trackHerramienta('auto_filter', { sort: crit, turno: tFiltro, dias_libres: diasLibres, profesores_filtrados: profesSeleccionados });

    let filtrados = RESULTADOS_GLOBALES.filter(r => {
        if (profesSeleccionados.length > 0) {
            // LOGICA STRICT AND: El horario debe tener TODOS los profesores seleccionados
            let cumpleTodos = profesSeleccionados.every(profeSel =>
                r.cursos.some(c => c.profesor === profeSel)
            );
            if (!cumpleTodos) return false;
        }
        if (diasLibres.length > 0) {
            let ocupaDiaLibre = r.cursos.some(c => c.sesiones.some(s => diasLibres.includes(s.dia)));
            if (ocupaDiaLibre) return false;
        }
        if (tFiltro) {
            let incios = r.cursos.flatMap(c => c.sesiones.map(s => s.inicio));
            if (tFiltro === 'matutino' && incios.some(h => parseInt(h) >= 14)) return false;
            if (tFiltro === 'vespertino' && incios.some(h => parseInt(h) < 13)) return false;
        }
        return true;
    });

    if (crit === 'dias') filtrados.sort((a, b) => a.dias - b.dias);
    else if (crit === 'creditos') filtrados.sort((a, b) => b.creditos - a.creditos);
    else if (crit === 'huecos') filtrados.sort((a, b) => a.huecos - b.huecos);

    dibujarResultados(filtrados);
}

function dibujarResultados(lista) {
    RESULTADOS_MOSTRADOS = lista;
    OFFSET_MOSTRADOS = 0;
    let resDiv = document.getElementById('resultados-auto');
    resDiv.innerHTML = '';
    document.getElementById('conteo-resultados').innerText = `${lista.length} opciones`;

    if (!lista.length) { resDiv.innerHTML = '<div class="alert alert-danger small text-center">No hay combinaciones con esos filtros.</div>'; return; }

    renderizarBatchResultados();
}

function renderizarBatchResultados() {
    let resDiv = document.getElementById('resultados-auto');
    let btnLoad = document.getElementById('btn-cargar-mas');
    if (btnLoad) btnLoad.remove();

    let end = Math.min(OFFSET_MOSTRADOS + BATCH_SIZE, RESULTADOS_MOSTRADOS.length);
    let batch = RESULTADOS_MOSTRADOS.slice(OFFSET_MOSTRADOS, end);

    batch.forEach((val, k) => {
        let i = OFFSET_MOSTRADOS + k;
        let idAcc = `acc-${i}`;
        let rows = val.cursos.map(c => generarFilaSIAE(c, null, false)).join('');
        let item = document.createElement('div'); item.className = 'accordion-item border shadow-sm mb-2';
        item.innerHTML = `
<h2 class="accordion-header d-flex align-items-center">
    <button class="accordion-button collapsed py-2 flex-grow-1" type="button" data-bs-toggle="collapse" data-bs-target="#${idAcc}" onclick="SadaAnalytics.trackAbrirCombinacion(${i}, RESULTADOS_MOSTRADOS[${i}].cursos)">
        <div class="d-flex w-100 justify-content-between align-items-center me-3">
            <div>
                <span class="badge bg-primary">Opción ${i + 1}</span>
                <small class="text-muted fw-bold ms-2">${val.dias} Días | ${val.creditos} Cr | ${val.huecos}h Libres</small>
            </div>
        </div>
    </button>
    <button class="btn btn-sm btn-success text-white shadow-sm rounded-pill px-3 me-1 fw-bold" style="font-size:0.78rem;" onclick="event.stopPropagation(); confirmarHorarioAuto(${i})" title="Registrar como mi horario final">
        <i class="bi bi-mortarboard me-1"></i>Mi opción de horario
    </button>
    <button class="btn btn-sm btn-light border border-primary shadow-sm rounded-pill px-2 me-1 fw-semibold" style="font-size:0.78rem; color:#0d6efd;" onclick="event.stopPropagation(); transferirAManual(${i})" title="Enviar este horario al Modo Manual para editarlo">
        <i class="bi bi-arrow-left-right me-1"></i>Transferir
    </button>
    <div class="dropdown me-1" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-light border shadow-sm rounded-pill px-3 fw-semibold dropdown-toggle" type="button" data-bs-toggle="dropdown" onclick="event.stopPropagation()">
            <i class="bi bi-download me-1"></i>Descargar
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3 mt-1" onclick="event.stopPropagation()">
            <li><button class="dropdown-item small py-2" onclick="descargarAutoOpcion(${i},'pdf')"><i class="bi bi-file-earmark-pdf text-danger me-2"></i>PDF</button></li>
            <li><button class="dropdown-item small py-2" onclick="descargarAutoOpcion(${i},'png')"><i class="bi bi-file-image text-primary me-2"></i>Imagen PNG</button></li>
            <li><button class="dropdown-item small py-2" onclick="descargarAutoOpcion(${i},'excel')"><i class="bi bi-file-earmark-excel text-success me-2"></i>Excel</button></li>
            <li><button class="dropdown-item small py-2" onclick="descargarAutoOpcion(${i},'csv')"><i class="bi bi-file-text me-2"></i>CSV</button></li>
        </ul>
    </div>
    <select id="sort-auto-${i}" class="form-select form-select-sm border-primary me-2 d-none d-md-inline-block" style="width: auto; font-size: 0.75rem;" onclick="event.stopPropagation()" onchange="ordenarTablaAuto(${i}, this.value)">
        <option value="materia" selected>Ordenar: Materia</option>
        <option value="profesor">Ordenar: Profesor (A-Z)</option>
        <option value="grupo">Ordenar: Grupo</option>
        <option value="horas">Ordenar: Duración</option>
        <option value="cronologico">Ordenar: Cronológico</option>
    </select>

    <button class="btn-tool bg-white shadow-sm border me-1" id="btn-recolor-auto-${i}" style="display:none;" onclick="recolorearAuto(); event.stopPropagation();" title="Cambiar paleta de colores">
        <i class="bi bi-palette text-primary"></i>
    </button>

    <div class="visual-pill shadow-sm me-1" onclick="event.stopPropagation();" style="transform: scale(0.85); transform-origin: right center;">
        <div class="form-check form-switch m-0 d-flex align-items-center">
            <input class="form-check-input" type="checkbox" id="switch-auto-${i}" onclick="event.stopPropagation()" onchange="toggleVistaAuto(${i})">
            <span class="ms-2">VISUAL</span>
        </div>
    </div>
</h2>
<div id="${idAcc}" class="accordion-collapse collapse">
    <div class="accordion-body p-0">
        <div id="res-tabla-${i}" class="table-responsive">
            <table class="table table-bordered table-sm mb-0 tabla-siae"><thead class="table-light"><tr><th>Mat</th><th>Gpo</th><th>Prof</th><th class="col-dia">L</th><th class="col-dia">M</th><th class="col-dia">M</th><th class="col-dia">J</th><th class="col-dia">V</th><th class="col-dia">S</th><th>Cr</th><th>Obs</th></tr></thead><tbody id="tbody-auto-${i}">${rows}</tbody></table>
        </div>
        <div id="res-visual-${i}" class="p-3 bg-white" style="display:none; overflow-x:auto;"></div>
    </div>
</div>`;
        resDiv.appendChild(item);
    });

    OFFSET_MOSTRADOS = end;

    if (OFFSET_MOSTRADOS < RESULTADOS_MOSTRADOS.length) {
        let divBtn = document.createElement('div');
        divBtn.id = 'btn-cargar-mas';
        divBtn.className = 'text-center py-4';
        divBtn.innerHTML = `<button class="btn btn-outline-primary rounded-pill px-4 shadow-sm" onclick="renderizarBatchResultados()">
                                <i class="bi bi-plus-circle me-2"></i>Cargar más resultados (${RESULTADOS_MOSTRADOS.length - OFFSET_MOSTRADOS} restantes)
                            </button>`;
        resDiv.appendChild(divBtn);
    }
}

function transferirAManual(idx) {
    if (miHorario.length > 0) {
        let confirmacion = confirm("ADVERTENCIA: Al transferir esta opción, se borrará todo lo que tienes seleccionado actualmente en el 'Generador Manual'.\n\n¿Deseas continuar y sobrescribir tu horario manual?");
        if (!confirmacion) return;
    }

    registrarEstado();

    miHorario = JSON.parse(JSON.stringify(RESULTADOS_MOSTRADOS[idx].cursos));
    SadaAnalytics.trackTransferir(idx, RESULTADOS_MOSTRADOS[idx].cursos);
    materiasPendientes = [];
    guardarEstado();
    actualizarTablaHorario();
    renderizarHorarioVisual();
    materiaSeleccionadaActual = null;
    limpiarPanelGrupos();
    filtrarMaterias();
    cambiarModo('manual');
    alert("¡Horario transferido con éxito! Ahora puedes editarlo manualmente.");
}

function ordenarTablaAuto(idx, criterio) {
    if (!RESULTADOS_MOSTRADOS[idx]) return;
    SadaAnalytics.trackHerramienta('auto_sort', { combination: idx, criterio: criterio });
    let cursos = [...RESULTADOS_MOSTRADOS[idx].cursos];
    const mapaDias = { 'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5 };

    cursos.sort((a, b) => {
        switch (criterio) {
            case 'materia': return a.asignatura.localeCompare(b.asignatura);
            case 'profesor': return a.profesor.localeCompare(b.profesor);
            case 'grupo':
                let gA = parseInt(a.grupo); let gB = parseInt(b.grupo);
                if (!isNaN(gA) && !isNaN(gB)) return gA - gB;
                return a.grupo.localeCompare(b.grupo);
            case 'horas':
                let durA = a.sesiones.reduce((sum, s) => sum + (s.min_fin - s.min_inicio), 0);
                let durB = b.sesiones.reduce((sum, s) => sum + (s.min_fin - s.min_inicio), 0);
                return durB - durA;
            case 'cronologico':
                let getEarliest = (curso) => {
                    if (curso.sesiones.length === 0) return 999999;
                    return Math.min(...curso.sesiones.map(s => {
                        let diaIdx = mapaDias[s.dia] !== undefined ? mapaDias[s.dia] : 9;
                        return (diaIdx * 10000) + s.min_inicio;
                    }));
                };
                return getEarliest(a) - getEarliest(b);
            default: return 0;
        }
    });

    let rows = cursos.map(c => generarFilaSIAE(c, null, false)).join('');
    document.getElementById(`tbody-auto-${idx}`).innerHTML = rows;
}

function toggleVistaAuto(idx) {
    let isChecked = document.getElementById(`switch-auto-${idx}`).checked;
    SadaAnalytics.trackHerramienta(isChecked ? 'auto_visual_on' : 'auto_visual_off', { combination: idx });
    let tabla = document.getElementById(`res-tabla-${idx}`);
    let visual = document.getElementById(`res-visual-${idx}`);
    let selectorSort = document.getElementById(`sort-auto-${idx}`);
    let recolorBtn = document.getElementById(`btn-recolor-auto-${idx}`);

    if (selectorSort) {
        selectorSort.style.display = isChecked ? 'none' : 'inline-block';
    }
    if (recolorBtn) {
        recolorBtn.style.display = isChecked ? 'inline-block' : 'none';
    }

    tabla.style.display = isChecked ? 'none' : 'block';
    visual.style.display = isChecked ? 'block' : 'none';

    if (isChecked) {
        visual.innerHTML = generarHTMLGridVisual(`auto-${idx}`);
        renderizarBloquesEnGrid(RESULTADOS_MOSTRADOS[idx].cursos, `auto-${idx}`);
    }
}

function generarHTMLGridVisual(suffix) {
    let html = '<table class="table mb-0 tabla-visual w-100"><thead><tr><th style="width:50px;">Hora</th><th>Lunes</th><th>Martes</th><th>Miércoles</th><th>Jueves</th><th>Viernes</th><th>Sábado</th></tr></thead><tbody>';
    let startMin = 7 * 60; let endMin = 21 * 60;
    for (let m = startMin; m < endMin; m += 30) {
        let horaStr = minutosAHora(m);
        html += `<tr><td class="hora-col">${horaStr}</td>`;
        ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].forEach(dia => {
            html += `<td id="grid-${suffix}-${dia}-${m}"></td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

function renderizarBloquesEnGrid(cursos, suffix) {
    let cursosOrdenados = [...cursos].sort((a, b) => a.asignatura.localeCompare(b.asignatura));

    cursosOrdenados.forEach((curso, i) => {
        let totalColores = PALETA_ORDENADA.length;
        let indexColor = (i + OFFSET_RECOLOR_AUTO) % totalColores;
        let color = PALETA_ORDENADA[indexColor];

        let horasStr = curso.sesiones.map(s => `${s.dia.substr(0, 3)} ${s.inicio}-${s.fin}`).join('\n');

        curso.sesiones.forEach(sesion => {
            let diaNorm = sesion.dia.toUpperCase().replace('É', 'E');
            let inicio = sesion.min_inicio;
            let fin = sesion.min_fin;
            let duration = fin - inicio;
            let cellInicio = document.getElementById(`grid-${suffix}-${diaNorm}-${inicio}`);

            if (cellInicio) {
                let bloque = document.createElement('div');
                bloque.className = `bloque-materia bloque-auto-${suffix}-${curso.id_unico}`;
                bloque.style.backgroundColor = color;
                bloque.style.cursor = 'default';

                if (!configVisual.prof) bloque.classList.add('hide-prof');
                if (!configVisual.grupo) bloque.classList.add('hide-group');
                if (!configVisual.horas) bloque.classList.add('hide-time');

                let slots = duration / 30;
                let heightPx = (slots * 31) - 1;
                bloque.style.height = `${heightPx}px`;

                let htmlContent = `<div class="materia-nombre">${curso.asignatura}</div>`;
                htmlContent += `<div class="materia-grupo">Gpo: ${curso.grupo} <span style="font-weight:normal; opacity:0.8;">| Clave: ${curso.clave}</span></div>`;
                htmlContent += `<div class="materia-profe">${curso.profesor}</div>`;
                htmlContent += `<div class="materia-horas">${horasStr}</div>`;

                bloque.innerHTML = htmlContent;

                bloque.onmouseenter = () => {
                    document.querySelectorAll(`.bloque-auto-${suffix}-${curso.id_unico}`).forEach(b => b.classList.add('bloque-resaltado'));
                };
                bloque.onmouseleave = () => {
                    document.querySelectorAll(`.bloque-auto-${suffix}-${curso.id_unico}`).forEach(b => b.classList.remove('bloque-resaltado'));
                };

                cellInicio.appendChild(bloque);
            }
        });
    });
}

// ==========================================
// 16. INIT Y CONTROL DE FLUJO GLOBAL
// ==========================================

window.entrarAlWorkspace = function () {
    let selectorInicio = document.getElementById('landing-selector');
    let valor = selectorInicio.value;

    if (!valor) {
        alert("Por favor, selecciona un semestre para continuar.");
        return;
    }

    let selectorReal = document.getElementById('semestre-selector');
    if (selectorReal) {
        selectorReal.value = valor;
        SadaAnalytics.trackEntrarWorkspace(valor);
        if (typeof cambiarSemestre === 'function') {
            cambiarSemestre(true);
        }
    }

    let landing = document.getElementById('step-1-landing');
    let appWrapper = document.getElementById('app-container-wrapper');

    landing.classList.add('slide-up-exit');

    appWrapper.classList.add('app-loaded');

    document.body.classList.add('mode-workspace');

    setTimeout(() => {
        landing.style.display = 'none';
    }, 600);
};

// ==========================================
// 17. CONFIRMACIÓN DE HORARIO FINAL
// ==========================================

function confirmarHorarioManual() {
    if (miHorario.length === 0) return alert('No tienes materias seleccionadas.');
    SadaAnalytics.saveSnapshot(miHorario, actividadesExtra, document.getElementById('semestre-selector').value, 'manual', true);
    
    let btn = document.getElementById('btn-confirmar-horario');
    if (btn) {
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> ¡Horario registrado! Gracias';
        btn.classList.remove('btn-outline-success');
        btn.classList.add('btn-success');
        btn.disabled = true;
        setTimeout(() => {
            btn.innerHTML = '<i class="bi bi-mortarboard me-1"></i> Este es mi horario final';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-success');
            btn.disabled = false;
        }, 5000);
    }
    mostrarEncuestaSatisfaccion();
}

async function descargarAutoOpcion(idx, formato) {
    if (!RESULTADOS_MOSTRADOS[idx]) return;
    let cursos = RESULTADOS_MOSTRADOS[idx].cursos;
    let nombre = 'Horario_Opcion_' + (idx + 1);

    if (formato === 'csv') {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Materia,Clave,Grupo,Profesor,Lunes,Martes,Miercoles,Jueves,Viernes,Sabado,Creditos,Observaciones\n";
        cursos.forEach(c => {
            let d = { LUNES: '', MARTES: '', MIERCOLES: '', JUEVES: '', VIERNES: '', SABADO: '' };
            c.sesiones.forEach(s => { let k = s.dia.toUpperCase().replace('É', 'E'); if (d.hasOwnProperty(k)) d[k] = `${s.inicio}-${s.fin}`; });
            let row = `${c.asignatura.replace(/,/g,'')},${c.clave},${c.grupo},${c.profesor.replace(/,/g,'')},${d.LUNES},${d.MARTES},${d.MIERCOLES},${d.JUEVES},${d.VIERNES},${d.SABADO},${c.creditos},${(c.observaciones||'').replace(/,/g,' ').replace(/\n/g,' ')}`;
            csvContent += row + "\n";
        });
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', nombre + '.csv');
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        return;
    }

    if (formato === 'excel') {
        const headers = ["Hora", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const diasKeys = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
        let ws_data = [headers];
        let startMin = 7 * 60, endMin = 21 * 60, step = 30;
        let rowMap = {}, rowIndex = 1;
        for (let m = startMin; m < endMin; m += step) {
            ws_data.push([minutosAHora(m) + " - " + minutosAHora(m + 30), "", "", "", "", "", ""]);
            rowMap[m] = rowIndex++;
        }
        let merges = [];
        cursos.forEach(curso => {
            let textoCelda = `${curso.asignatura} (${curso.clave})\n(${curso.profesor})\nGpo: ${curso.grupo}`;
            curso.sesiones.forEach(sesion => {
                let colIndex = diasKeys.indexOf(sesion.dia.toUpperCase().replace("É", "E")) + 1;
                if (colIndex > 0) {
                    let startM = Math.max(sesion.min_inicio, startMin);
                    let rStart = rowMap[startM];
                    if (rStart !== undefined) {
                        let rowSpan = Math.ceil((sesion.min_fin - startM) / 30);
                        ws_data[rStart][colIndex] = textoCelda;
                        if (rowSpan > 1) merges.push({ s: { r: rStart, c: colIndex }, e: { r: rStart + rowSpan - 1, c: colIndex } });
                    }
                }
            });
        });
        let wb = XLSX.utils.book_new();
        let ws = XLSX.utils.aoa_to_sheet(ws_data);
        if (merges.length > 0) ws['!merges'] = merges;
        ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, ws, "Horario Visual");
        XLSX.writeFile(wb, nombre + '.xlsx');
        return;
    }

    // PDF o PNG: capturar la tabla del acordeón
    let isVisual = document.getElementById(`switch-auto-${idx}`) && document.getElementById(`switch-auto-${idx}`).checked;
    let sourceEl = document.getElementById(isVisual ? `res-visual-${idx}` : `res-tabla-${idx}`);
    if (!sourceEl) return;

    let container = document.getElementById('capture-container');
    container.innerHTML = '';
    let wrapper = document.createElement('div');
    wrapper.style.width = '1300px';
    wrapper.style.padding = '20px';
    wrapper.style.backgroundColor = '#ffffff';
    let clone = sourceEl.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    wrapper.appendChild(clone);
    container.appendChild(wrapper);

    const canvas = await html2canvas(wrapper, { scale: 2, useCORS: true, scrollY: 0 });
    container.innerHTML = '';

    if (formato === 'png') {
        const link = document.createElement('a');
        link.download = nombre + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } else {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        let w = pdfWidth - 20, h = w / (imgProps.width / imgProps.height);
        if (h > pdfHeight - 20) { h = pdfHeight - 20; w = h * (imgProps.width / imgProps.height); }
        pdf.addImage(imgData, 'PNG', (pdfWidth - w) / 2, (pdfHeight - h) / 2, w, h);
        pdf.save(nombre + '.pdf');
    }
}

function confirmarHorarioAuto(idx) {
    if (!RESULTADOS_MOSTRADOS[idx]) return;
    let cursos = RESULTADOS_MOSTRADOS[idx].cursos;
    SadaAnalytics.saveSnapshot(cursos, actividadesExtra, document.getElementById('semestre-selector').value, 'auto', true);
    
    // Feedback visual: encontrar el botón por su contexto
    let accordion = document.getElementById('acc-' + idx);
    if (accordion) {
        let btn = accordion.closest('.accordion-item').querySelector('.btn-outline-success, .btn-success');
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>¡Registrado!';
            btn.classList.remove('btn-outline-success');
            btn.classList.add('btn-success');
        }
    }
    mostrarEncuestaSatisfaccion();
}

function actualizarFiltrosUI() {
    if (document.getElementById('sort-resultados'))
        document.getElementById('sort-resultados').value = 'dias';

    if (document.getElementById('filtro-turno'))
        document.getElementById('filtro-turno').value = '';

    document.querySelectorAll('.chk-filtro-dia').forEach(c => c.checked = false);
    let btnDia = document.getElementById('btn-filtro-dia');
    if (btnDia) btnDia.innerText = 'Ninguno';

    document.querySelectorAll('.chk-filtro-profe').forEach(c => c.checked = false);
    let btnProf = document.getElementById('btn-filtro-profe');
    if (btnProf) btnProf.innerText = 'Todos';
}

// ==========================================
// ENCUESTA DE SATISFACCIÓN (post-confirmación)
// ==========================================

let _encuestaTimer = null;

function mostrarEncuestaSatisfaccion() {
    // Eliminar encuesta anterior si existe
    let existing = document.getElementById('encuesta-satisfaccion');
    if (existing) existing.remove();
    if (_encuestaTimer) clearTimeout(_encuestaTimer);

    let div = document.createElement('div');
    div.id = 'encuesta-satisfaccion';
    div.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); z-index:9999; background:#1a1a2e; color:#e8e8f0; padding:16px 24px; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.4); animation:slideUpCookie 0.4s ease-out; display:flex; align-items:center; gap:16px; font-size:0.9rem;';
    div.innerHTML = `
        <div>
            <div class="fw-bold mb-1" style="font-size:0.85rem;">¿Qué tan satisfecho estás con tu horario?</div>
            <div class="d-flex gap-1" id="estrellas-satisfaccion">
                ${[1,2,3,4,5].map(n => `<button class="btn btn-sm px-2 py-1" style="font-size:1.3rem; background:none; border:none; cursor:pointer; filter:grayscale(1); transition:filter 0.2s;" onmouseenter="this.style.filter='none'" onmouseleave="if(!this.dataset.selected) this.style.filter='grayscale(1)'" onclick="enviarSatisfaccion(${n})" title="${n} estrella${n>1?'s':''}">⭐</button>`).join('')}
            </div>
        </div>
        <button class="btn btn-sm" style="background:none; border:none; color:#7fb3f5; font-size:0.75rem; white-space:nowrap;" onclick="cerrarEncuesta()">Cerrar</button>
    `;
    document.body.appendChild(div);

    // Auto-cerrar después de 8 segundos
    _encuestaTimer = setTimeout(() => cerrarEncuesta(), 8000);
}

function enviarSatisfaccion(rating) {
    SadaAnalytics.updateSatisfaction(rating);

    let div = document.getElementById('encuesta-satisfaccion');
    if (div) {
        div.innerHTML = '<i class="bi bi-heart-fill" style="color:#ff6b6b;"></i> <span class="fw-bold">¡Gracias por tu respuesta!</span>';
        setTimeout(() => cerrarEncuesta(), 2000);
    }
}

function cerrarEncuesta() {
    if (_encuestaTimer) { clearTimeout(_encuestaTimer); _encuestaTimer = null; }
    let div = document.getElementById('encuesta-satisfaccion');
    if (div) { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }
}
