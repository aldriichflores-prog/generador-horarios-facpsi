// ==========================================
// SADA - Generador de Horarios FACPSI UNAM
// app.js - Logica principal de la aplicacion
// ==========================================

// Fallback si sada_analytics.js no cargo
if (!window.SadaAnalytics) {
    window.SadaAnalytics = { trackEntrarWorkspace() { }, trackCambiarSemestre() { }, trackCambiarModo() { }, trackBuscarMateria() { }, trackAgregarCurso() { }, trackEliminarCurso() { }, trackAgregarBolsa() { }, trackGenerarCombinaciones() { }, trackAbrirCombinacion() { }, trackExportar() { }, trackTransferir() { }, trackFiltro() { }, trackPerfilSADA() { }, trackCustom() { }, trackHerramienta() { }, saveSnapshot() { }, saveExitSnapshot() { }, updateSatisfaction() { }, init() { } };
}
var SadaAnalytics = window.SadaAnalytics;

// ==========================================
// 1. CONSTANTES Y CONFIGURACION GLOBAL
// ==========================================

// --- Bases de Datos ---
let BD_CRUDA = [];      // Datos tal cual llegan del JSON
let BD_AGRUPADA = [];   // Datos procesados y limpios con clave y estructura unificada

// --- Estado del Usuario (Modo Manual) ---
let miHorario = [];     // Lista de cursos seleccionados actualmente
let historial = [];     // Pila para Undo
let futuro = [];        // Pila para Redo
let materiasPendientes = []; // Materias en previsualizacion (hover/condicionales)
let materiaSeleccionadaActual = null; // Materia activa en el panel izquierdo (Manual)

// --- Estado del Modo Explorador (Automatico) ---
let bolsa = {};         // Materias candidatas seleccionadas { "Calculo": [grupo1, grupo2] }
let materiaSeleccionadaAuto = null; // Materia activa en el panel izquierdo (Auto)
let RESULTADOS_GLOBALES = [];    // Todas las combinaciones generadas
let RESULTADOS_MOSTRADOS = [];   // Combinaciones filtradas que se muestran
let OFFSET_MOSTRADOS = 0;        // Paginacion de resultados visualizados
const BATCH_SIZE = 50;           // Cantidad de resultados por pagina

// --- Configuracion Visual y Sistema ---
let configVisual = { prof: true, grupo: true, horas: true }; // Que mostrar en los bloques visuales
let MAPA_COLORES_ASIGNADOS = {}; // Cache de colores por ID de materia
let OFFSET_RECOLOR = 0;          // Desplazamiento de colores (Manual)
let OFFSET_RECOLOR_AUTO = 0;     // Desplazamiento de colores (Auto)
let horariosGuardados = {};      // Persistencia de multiples horarios
let activeScheduleId = "default";
let actividadesExtra = [];       // Actividades extracurriculares del usuario

const DB_FILE = 'Horarios_Todos_UNAM.json';

// Paleta de colores pastel para los bloques
const PALETA_ENTERA = [
    '#FFD8D6', /* Rojo Apple */
    '#CCE4FF', /* Azul Apple */
    '#D6F4DF', /* Verde Apple */
    '#FFECCC', /* Naranja Apple */
    '#EFDCF8', /* Morado Apple */
    '#DEF4FE', /* Cyan Apple */
    '#FFF5CC', /* Amarillo Apple */
    '#FFD5DE', /* Rosa Apple */
    '#DEDDF7', /* Indigo Apple */
    '#E2E2E7'  /* Gris Apple */
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

function normalizarDiaHorario(dia) {
    return String(dia || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function obtenerMinutosSesion(sesion, campoMin, campoHora) {
    if (!sesion) return 0;
    let valorMin = Number(sesion[campoMin]);
    if (Number.isFinite(valorMin)) return valorMin;
    return convertirMinutos(sesion[campoHora]);
}

function limpiarNombreActividadExtra(nombre) {
    return String(nombre || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
}

/** Asigna un color fijo a una materia basado en su ID si no tiene uno */
function asignarColorFijo(id_unico) { if (MAPA_COLORES_ASIGNADOS[id_unico]) return; let count = Object.keys(MAPA_COLORES_ASIGNADOS).length; let color = PALETA_ORDENADA[count % PALETA_ORDENADA.length]; MAPA_COLORES_ASIGNADOS[id_unico] = color; }

// ==========================================
// 3. GESTION DEL ESTADO (UNDO/REDO)
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
// 4. LOGICA DE COLORES Y CHOQUES
// ==========================================

/** Cambia los colores de las materias del Modo Manual ciclicamente */
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

/** Cambia los colores de los Resultados Automaticos */
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
        for (let s1 of (c1.sesiones || [])) {
            for (let s2 of (c2.sesiones || [])) {
                if (normalizarDiaHorario(s1.dia) === normalizarDiaHorario(s2.dia)) {
                    let s1Inicio = obtenerMinutosSesion(s1, 'min_inicio', 'inicio');
                    let s1Fin = obtenerMinutosSesion(s1, 'min_fin', 'fin');
                    let s2Inicio = obtenerMinutosSesion(s2, 'min_inicio', 'inicio');
                    let s2Fin = obtenerMinutosSesion(s2, 'min_fin', 'fin');
                    if (s1Inicio < s2Fin && s2Inicio < s1Fin) {
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

/** Verifica si hay algun choque interno en una lista de cursos (para el generador) */
function hayChoqueCombo(lista) {
    let actsAuto = actividadesExtra.filter(a => a.modo === 'auto');
    let listaCompleta = [...lista, ...actsAuto];
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
// 5. INICIALIZACION Y CARGA DE DATOS
// ==========================================

// Se elimino toggleFijarPanel por peticion del usuario

window.addEventListener('DOMContentLoaded', function () {
    // Ordenar paleta por brillo para contraste
    PALETA_ORDENADA = [...PALETA_ENTERA];
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

            // -- Modulos SADA eliminados temporalmente --

            // -- Toggle visual para botones de dia (actividades extra) --
            document.querySelectorAll('.act-dia-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    let chk = this.querySelector('input[type="checkbox"]');
                    chk.checked = !chk.checked;
                    this.classList.toggle('active', chk.checked);
                });
            });
        })
        .catch(err => { console.error(err); alert("Error cargando datos: " + err.message); });
});

// Snapshot al salir de la pagina (fallback)
window.addEventListener('beforeunload', function () {
    if (miHorario && miHorario.length > 0) {
        SadaAnalytics.saveExitSnapshot(miHorario, actividadesExtra, document.getElementById('semestre-selector').value, 'manual');
    }
});

/** 
 * Procesa el JSON crudo a objetos utilizables.
 * - Genera ID unico si no existe
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

        // Clave unica para agrupar sesiones del mismo grupo
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
                clave: fila.clave || "", // INTEGRACION DE CLAVE
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
// 6. PERSISTENCIA Y GESTION DE HORARIOS
// ==========================================

function guardarEstado(silencioso = false) {
    horariosGuardados[activeScheduleId].cursos = miHorario;
    localStorage.setItem('unam_schedules_v3', JSON.stringify(horariosGuardados));
    localStorage.setItem('unam_active_id_v3', activeScheduleId);
    localStorage.setItem('unam_b_v3', JSON.stringify(bolsa));
    localStorage.setItem('unam_colors_v3', JSON.stringify(MAPA_COLORES_ASIGNADOS));
    if (!silencioso) {
        mostrarToast();
    }
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
    if (!nuevoNombre) return alert("El nombre no puede estar vacio");
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
// 7. INTERFAZ: VISUALIZACION Y HELPERS
// ==========================================

function toggleVistaVisual() {
    let isVisual = document.getElementById('switch-vista').checked;
    SadaAnalytics.trackHerramienta(isVisual ? 'visual_on' : 'visual_off');
    document.getElementById('vista-lista-container').style.display = isVisual ? 'none' : 'block';
    document.getElementById('vista-visual-container').style.display = isVisual ? 'block' : 'none';
    document.getElementById('btn-recolorear').style.display = isVisual ? 'inline-block' : 'none';
    let configVisualDropdown = document.getElementById('config-visual-dropdown');
    if (configVisualDropdown) {
        configVisualDropdown.classList.toggle('is-visible', isVisual);
        configVisualDropdown.style.display = isVisual ? 'block' : 'none';
    }

    if (isVisual) renderizarHorarioVisual();
}

/** Genera la estructura HTML vacia del horario grafico */
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

    let actsManual = actividadesExtra.filter(a => a.modo === 'manual');
    actsManual.forEach(act => {
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
// 9. LOGICA DE FILTRADO Y NAVEGACION
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
        guardarEstado(true);
        actualizarUIHorarios();
        actualizarTablaHorario();
        _modoAutoInicializado = false;
    }
    document.getElementById('buscador').value = '';
    document.getElementById('buscador-auto').value = '';
    materiaSeleccionadaActual = null;
    materiaSeleccionadaAuto = null;
    limpiarPanelGrupos();

    let divAlerta = document.getElementById('alerta-semestre');
    divAlerta.innerHTML = '';
    if (val === 'adicional') {
        divAlerta.innerHTML = `<div class="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
            <h5 class="alerta-semestre-title"><i class="bi bi-info-circle-fill"></i> Semestre Adicional: Reglas de Selección</h5>
            <hr class="my-2" style="border-color: rgba(4, 14, 46, 0.1);">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <p class="alerta-semestre-text mb-1"><strong><i class="bi bi-card-checklist"></i> Requisitos Académicos:</strong></p>
                    <ul class="alerta-semestre-list mb-0">
                        <li>Elige asignaturas de <strong>6° y 8° semestre</strong> de la oferta vigente.</li>
                        <li>Propón asignaturas que <strong>no hayas inscrito previamente</strong>.</li>
                        <li>Rango de créditos obligatorio: <strong>Mínimo 31 - Máximo 41</strong>.</li>
                    </ul>
                </div>
                <div class="col-md-4 mt-3 mt-md-0">
                    <div class="bg-white p-3 rounded border border-primary">
                        <label class="form-label fw-bold text-primary mb-2" style="font-size:13px; font-family: var(--ff-text);">
                            <i class="bi bi-funnel-fill"></i> Sistema de Pertenencia:
                        </label>
                        <select id="filtro-sistema" class="form-select form-select-sm border-primary" onchange="filtrarMaterias(); filtrarMateriasAuto();">
                            <option value="escolarizado">Escolarizado (Gpos. 6000-8000)</option>
                            <option value="sua">SUA (Gpos. 9000)</option>
                        </select>
                    </div>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    }
    else if (sem === 2) {
        divAlerta.innerHTML = `<div class="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
            <h5 class="alerta-semestre-title"><i class="bi bi-people-fill"></i> ¡Hola, estudiante de Segundo Semestre!</h5>
            <p class="alerta-semestre-text">Sabemos que en 2do semestre los horarios funcionan por grupos completos. Por lo que te recomendamos tener en cuenta lo siguiente:</p>
            <ul class="alerta-semestre-list">
                <li><strong>¿Qué son los Grupos Espejo?:</strong> Son dos o más grupos que se imparten exactamente en el mismo horario, pero con diferente profesor.</li>
                <li><strong>¿Cuáles son los Grupos Espejo?:</strong> El grupo 2001 y 2002. 2003 y 2004. 2005 y 2006. 2007 y 2008. 2010 y 2011.</li>
                <li><strong>Recomendación:</strong> Usa el Modo Manual. Elige un grupo base (ej. 2003) y si un profe no te gusta, cámbialo por el del grupo espejo.</li>
                <li>Si quieres usar el modo exploratorio, usa los filtros, te serán de ayuda para ver otras combinaciones.</li>
            </ul>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
    }
    else if (sem === 4) {
        divAlerta.innerHTML = `<div class="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
            <h5 class="alerta-semestre-title"><i class="bi bi-people-fill"></i> ¡Hola, estudiante de Cuarto Semestre!</h5>
            <p class="alerta-semestre-text">Sabemos que en 4to semestre los horarios funcionan por grupos completos. Por lo que te recomendamos tener en cuenta lo siguiente:</p>
            <ul class="alerta-semestre-list" style="margin-bottom:0;">
                <li style="margin-bottom:4px;"><strong>Grupos Espejo:</strong> Grupos: 4001 y 4002. 4003 y 4004. 4005 y 4006. 4007 - 4008 y 4009. 4011 y 4012 tienen las mismas horas. Es fácil intercambiar profesores entre ellos.</li>
                <li style="margin-bottom:4px;"><strong>Recomendación:</strong> Usa el Modo Manual. Elige un grupo base (ej. 4003) y si un profe no te gusta, cámbialo por el del grupo espejo.</li>
                <li style="margin-bottom:8px;">Si quieres usar el modo exploratorio, usa los filtros, te serán de ayuda para ver otras combinaciones.</li>
                <li style="margin-top:8px;padding:8px;background:rgba(255,159,10,0.10);border:1px solid rgba(255,159,10,0.30);border-radius:8px;color:#1d1d1f;">
                    <strong><i class="bi bi-exclamation-triangle-fill"></i> Importante ACA III:</strong> Por cada grupo de Aprendizaje y Conducta Adaptat. III le corresponden 2 grupos de (Práctica). Asegúrate de elegir el grupo correspondiente de prácticas acorde a lo que dicen las <strong>observaciones</strong> del grupo de Teoría.
                </li>
            </ul>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    }

    filtrarMaterias();
    
    if (sem === 2 || sem === 4) {
        setTimeout(() => {
            let alerta = document.getElementById('alerta-semestre');
            if (alerta) {
                const offset = 47; // pixeles de margen superior
                const elementPosition = alerta.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({
                    top: elementPosition - offset,
                    behavior: 'smooth'
                });
            }
        }, 150);
    }

    if (_modoActualWorkspace === 'auto' || _modoActualWorkspace === 'resultados') {
        prepararModoAutoSiNecesario(true);
    }
}

let _modoCargaEnCurso = false;
let _modoActualWorkspace = 'seleccion';
let _modoAutoInicializado = false;

function prepararModoAutoSiNecesario(forzar = false) {
    if (!forzar && _modoAutoInicializado) return;
    renderBolsa();
    limpiarPanelGruposAuto();
    filtrarMateriasAuto();
    _modoAutoInicializado = true;
}

function mostrarPantallaCargaModo(modo) {
    let overlay = document.getElementById('mode-loading-screen');
    if (!overlay) return;
    let titulo = overlay.querySelector('.mode-loading-title');
    let copy = overlay.querySelector('.mode-loading-copy');
    if (modo === 'manual') {
        if (titulo) titulo.textContent = 'Cargando modo manual';
        if (copy) copy.textContent = 'Preparando tu horario para que aparezca completo...';
    } else if (modo === 'generando') {
        if (titulo) titulo.textContent = 'Generando horarios';
        if (copy) copy.textContent = 'Calculando todas las combinaciones posibles sin traslapes...';
    } else {
        if (titulo) titulo.textContent = 'Cargando generador automático';
        if (copy) copy.textContent = 'Preparando tu horario para que aparezca completo...';
    }
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
}

function ocultarPantallaCargaModo() {
    let overlay = document.getElementById('mode-loading-screen');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
}

function enfocarInicioModo(modo) {
    if (modo === 'resultados') {
        let objetivoResultados = document.querySelector('#vista-resultados .back-row') || document.getElementById('vista-resultados');
        if (objetivoResultados) {
            const top = objetivoResultados.getBoundingClientRect().top + window.pageYOffset - 12;
            window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        }
        return;
    }

    let objetivo = null;
    if (modo === 'manual') {
        objetivo = document.getElementById('manual-left-col');
    } else if (modo === 'auto') {
        objetivo = document.getElementById('auto-left-col');
    }

    if (!objetivo) return;

    const top = objetivo.getBoundingClientRect().top + window.pageYOffset - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

function activarModoConCarga(modo) {
    if (_modoCargaEnCurso) return;
    _modoCargaEnCurso = true;
    mostrarPantallaCargaModo(modo);

    setTimeout(() => {
        activarModo(modo);
        if (typeof updateMobileLayoutVars === 'function') updateMobileLayoutVars();
        if (typeof initMobileObservers === 'function') initMobileObservers();
        enfocarInicioModo(modo);

        setTimeout(() => {
            ocultarPantallaCargaModo();
            _modoCargaEnCurso = false;
        }, 220);
    }, 260);
}

function activarModo(modo) {
    // Intercept mode selection for mobile tabs
    if (window.innerWidth < 768) {
        if (modo === 'manual' && typeof switchToMobileTab === 'function') switchToMobileTab(2);
        if (modo === 'auto' && typeof switchToMobileTab === 'function') switchToMobileTab(4);
        if (modo === 'resultados' && typeof switchToMobileTab === 'function') switchToMobileTab(5);
    }

    cambiarModo(modo);
}

function mostrarSeleccionDeModo() {
    let modeCards = document.getElementById('mode-cards-container');
    let vistaManual = document.getElementById('vista-manual');
    let vistaAuto = document.getElementById('vista-auto');
    let vistaResultados = document.getElementById('vista-resultados');

    if (modeCards) modeCards.style.display = 'block';
    if (vistaManual) vistaManual.style.display = 'none';
    if (vistaAuto) vistaAuto.style.display = 'none';
    if (vistaResultados) vistaResultados.style.display = 'none';
}

function cambiarModo(m) {
    SadaAnalytics.trackCambiarModo(m);
    let modeCards = document.getElementById('mode-cards-container');
    let vistaManual = document.getElementById('vista-manual');
    let vistaAuto = document.getElementById('vista-auto');
    let vistaResultados = document.getElementById('vista-resultados');

    if (m === 'seleccion') {
        _modoActualWorkspace = 'seleccion';
        mostrarSeleccionDeModo();
        return;
    }

    _modoActualWorkspace = m;
    if (m === 'auto' || m === 'resultados') {
        prepararModoAutoSiNecesario();
    }
    
    if (modeCards) {
        modeCards.style.display = 'none';
    }
    if (vistaManual) {
        vistaManual.style.display = (m === 'manual') ? 'flex' : 'none';
    }
    if (vistaAuto) {
        vistaAuto.style.display = (m === 'auto') ? 'block' : 'none';
    }
    if (vistaResultados) {
        vistaResultados.style.display = (m === 'resultados') ? 'block' : 'none';
    }
}

// ==========================================
// 10. MODO MANUAL: SELECCION Y PANELES
// ==========================================

function filtrarMaterias() {
    let txt = document.getElementById('buscador').value.toUpperCase();
    let lista = document.getElementById('lista-materias');
    lista.innerHTML = '';

    let matSem = obtenerMateriasActivas();
    if (matSem.length === 0) {
        lista.innerHTML = '<div class="p-3 text-muted small text-center">No hay datos disponibles para esta selección.</div>';
        return;
    }

    let areas = [...new Set(matSem.map(c => c.area))].sort();
    let semVal = parseInt(document.getElementById('semestre-selector').value);
    let teoriaACA = "APRENDIZAJE Y CONDUCTA ADAPTAT. III";
    let practicaACA = "APRENDIZAJE Y CONDUCTA ADAPTAT. III (PRACTICA)";
    const tienePerfilActivo = typeof SADA_PERFIL !== 'undefined' && SADA_PERFIL.completado === true;

    areas.forEach(area => {
        let matsEnArea = [...new Set(matSem.filter(c => c.area === area).map(c => c.asignatura))].sort();
        let matsFiltradas = matsEnArea.filter(m => m.toUpperCase().includes(txt));
        if (matsFiltradas.length === 0) return;

        let isOpen = matsFiltradas.includes(materiaSeleccionadaActual) || txt.length >= 2;

        // AreaAccordion header
        let header = document.createElement('div');
        header.className = 'ml-area-header';
        header.setAttribute('data-open', String(isOpen));
        header.innerHTML = `<i class="bi bi-chevron-down ml-chevron"></i><span class="ml-area-name">${area.toLowerCase()}</span><span class="ml-area-count">${matsFiltradas.length}</span>`;

        // AreaAccordion body
        let body = document.createElement('div');
        body.className = 'ml-area-body';
        body.setAttribute('data-open', String(isOpen));

        header.onclick = () => {
            let open = header.getAttribute('data-open') === 'true';
            header.setAttribute('data-open', String(!open));
            body.setAttribute('data-open', String(!open));
        };

        matsFiltradas.forEach(nom => {
            let inscrita = miHorario.some(c => c.asignatura === nom);
            let esActiva = materiaSeleccionadaActual === nom;

            // MateriaItem: determinar estado e icono
            let estado = 'default';
            let iconHtml = '';

            if (esActiva) {
                estado = 'activa';
                iconHtml = '<i class="bi bi-check-circle-fill ml-item-icon" aria-hidden="true"></i>';
            } else if (inscrita) {
                estado = 'inscrita';
                iconHtml = '<i class="bi bi-bookmark-check-fill ml-item-icon" aria-hidden="true"></i>';
            } else if (tienePerfilActivo && typeof sadaRecomendarCursos === 'function') {
                const semActual = parseInt(document.getElementById('semestre-selector').value);
                const cursoConScore = sadaRecomendarCursos(semActual).find(c => c.asignatura === nom);
                if (cursoConScore && cursoConScore.sada.recomendado) {
                    estado = 'candidata';
                    iconHtml = '<i class="bi bi-star-fill ml-item-icon" aria-hidden="true"></i>';
                }
            }

            // Par ACA obligatorio (4.º semestre)
            let extraClass = '';
            if (semVal === 4) {
                if (nom === teoriaACA && !inscrita && miHorario.some(c => c.asignatura === practicaACA)) extraClass = 'ml-item--requerido';
                if (nom === practicaACA && !inscrita && miHorario.some(c => c.asignatura === teoriaACA)) extraClass = 'ml-item--requerido';
            }

            let item = document.createElement('div');
            item.className = `ml-item${extraClass ? ' ' + extraClass : ''}`;
            item.setAttribute('data-state', estado);
            item.innerHTML = `<span class="ml-item-name">${nom}</span>${iconHtml}`;

            item.onclick = () => {
                materiaSeleccionadaActual = nom;
                filtrarMaterias();
                cargarPanelGrupos(nom);
                if (typeof expandMobilePanel === 'function') expandMobilePanel('#contenedor-panel-manual');
            };
            body.appendChild(item);
        });

        lista.appendChild(header);
        lista.appendChild(body);
    });
}

function limpiarPanelGrupos() {
    document.getElementById('titulo-seleccion').innerHTML = '<i class="bi bi-arrow-left-circle"></i> 2. Selecciona un Profesor';
    document.getElementById('info-seleccion').innerText = 'Esperando...';
    document.getElementById('contenedor-grupos').innerHTML = '<div class="text-center text-muted py-5 w-100"><i class="bi bi-hand-index-thumb display-1 opacity-25"></i><p class="mt-3 lead">Selecciona una materia a la izquierda.</p></div>';
    materiasPendientes = [];
    renderizarHorarioVisual();
}

function escapeHtml(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getGrupoCardObservationIcon(estado) {
    switch (estado) {
        case 'traslape':
            return 'bi-person-exclamation';
        case 'previsualizacion':
            return 'bi-bookmark-star';
        case 'candidato':
            return 'bi-list-check';
        default:
            return 'bi-link-45deg';
    }
}

function getGrupoCardObservationTone(estado) {
    switch (estado) {
        case 'traslape':
            return 'grupo-card-v2__observation--traslape';
        case 'previsualizacion':
        case 'candidato':
            return 'grupo-card-v2__observation--warning';
        default:
            return 'grupo-card-v2__observation--default';
    }
}

function getGrupoCardStateMarkup(estado) {
    switch (estado) {
        case 'inscrita':
            return '<div class="grupo-card-v2__state-pill grupo-card-v2__state-pill--inscrita">Seleccionada</div>';
        case 'traslape':
            return '<div class="grupo-card-v2__state-pill grupo-card-v2__state-pill--traslape">Traslape</div>';
        case 'previsualizacion':
            return '<div class="grupo-card-v2__state-pill grupo-card-v2__state-pill--previsualizacion">Previsualización</div>';
        case 'candidato':
            return '<div class="grupo-card-v2__state-pill grupo-card-v2__state-pill--candidato">Seleccionado</div>';
        default:
            return '';
    }
}

/**
 * GrupoCard reusable renderer.
 * Core props: numeroGrupo, profesor, horario, salon, observacion, estado, onSelect.
 * Internal optional fields preserve current workflows: clickDisabled, footerHtml, creditsText.
 */
function createGrupoCard({
    numeroGrupo,
    profesor,
    horario,
    salon,
    observacion,
    estado = 'default',
    onSelect = null,
    clickDisabled = false,
    footerHtml = '',
    creditsText = '',
    clave = ''
}) {
    let card = document.createElement('div');
    card.className = `grupo-card grupo-card-v2 grupo-card-v2--${estado}`;

    if (!clickDisabled && typeof onSelect === 'function') {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.onclick = onSelect;
        card.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(event);
            }
        };
    }

    const checkIcon = estado === 'inscrita'
        ? ' <i class="bi bi-check-circle grupo-card-v2__title-icon" aria-hidden="true"></i>'
        : '';
    const rightMeta = creditsText
        ? `<div class="grupo-card-v2__meta-right">${escapeHtml(creditsText)}</div>`
        : '';
    const claveHtml = clave
        ? `<div class="grupo-card-v2__clave"><span class="grupo-card-v2__clave-label">Clave:</span> ${escapeHtml(clave)}</div>`
        : '';
    const observationHtml = observacion
        ? `<div class="grupo-card-v2__obs-wrap"><button class="grupo-card-v2__obs-btn2" onclick="event.stopPropagation();var b=this.nextElementSibling;b.style.display=b.style.display==='block'?'none':'block';this.classList.toggle('open')"><i class="bi bi-info-circle" aria-hidden="true"></i> Observaciones <i class="bi bi-chevron-down grupo-card-v2__obs-chevron" aria-hidden="true"></i></button><div class="grupo-card-v2__obs-content" style="display:none">${escapeHtml(observacion)}</div></div>`
        : '';
    const salonHtml = salon ? `<br>${escapeHtml(salon)}` : '';

    card.innerHTML = `
        <div class="grupo-card-v2__meta">
            <div class="grupo-card-v2__group">Grupo ${escapeHtml(numeroGrupo)}${checkIcon}</div>
            ${rightMeta}
        </div>
        ${claveHtml}
        <div class="grupo-card-v2__profesor">${escapeHtml(profesor)}</div>
        <hr class="grupo-card-v2__divider">
        <div class="grupo-card-v2__horario">${horario}${salonHtml}</div>
        ${observationHtml}
        <div class="grupo-card-v2__footer">
            ${getGrupoCardStateMarkup(estado)}
            ${footerHtml}
        </div>
    `;

    return card;
}



function verObs(id) { let el = document.getElementById(id); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }

function previsualizarTraslape(idNuevo, asignatura) {
    let cursoNuevo = BD_AGRUPADA.find(c => c.id_unico === idNuevo);
    let horarioActual = miHorario.filter(h => h.asignatura !== asignatura);
    let actsManual = actividadesExtra.filter(a => a.modo === 'manual');
    let conflictos = obtenerChoques(cursoNuevo, [...horarioActual, ...actsManual]);

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
// 11. GESTION DE MI HORARIO Y TABLA
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

    if (!yaEsta) {
        // Collapse the professor panel on mobile so it "goes down"
        let panelManual = document.getElementById('contenedor-panel-manual');
        if (panelManual) {
            panelManual.classList.remove('expanded');
        }
    }
}

function ordenarMiHorario(criterioInput = null) {
    let criterio = criterioInput;
    window.criterioOrdenManual = criterio;
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
    let actsManual = actividadesExtra.filter(a => a.modo === 'manual');
    
    if (!miHorario.length && !actsManual.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4 t-body">No has agregado materias aún.</td></tr>';
    } else {
        let criterio = window.criterioOrdenManual || 'cronologico';
        
        let combinado = [];
        miHorario.forEach((c, idx) => combinado.push({ item: c, idx: idx, isExtra: false }));
        actsManual.forEach(act => combinado.push({ item: act, idx: null, isExtra: true }));

        const mapaDias = { 'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5 };
        combinado.sort((aObj, bObj) => {
            let a = aObj.item; let b = bObj.item;
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
                        if (!curso.sesiones || curso.sesiones.length === 0) return 999999;
                        let mins = curso.sesiones.map(s => (mapaDias[s.dia.toUpperCase()] || 0) * 1440 + s.min_inicio);
                        return Math.min(...mins);
                    };
                    return getEarliest(a) - getEarliest(b);
                default: return 0;
            }
        });

        combinado.forEach(obj => {
            if (obj.isExtra) {
                let actConFlag = Object.assign({}, obj.item, { _esActividad: true });
                tbody.innerHTML += generarFilaSIAE(actConFlag, null, false);
            } else {
                total += obj.item.creditos;
                tbody.innerHTML += generarFilaSIAE(obj.item, obj.idx);
            }
        });
    }

    // --- LOGICA AJUSTADA DE CREDITOS ---
    let semVal = parseInt(document.getElementById('semestre-selector').value);
    let badge = document.getElementById('creditos-badge');

    let minIdeal = 37;
    let maxIdeal = 41;

    if (semVal === 2) { minIdeal = 40; maxIdeal = 40; }
    if (semVal === 4) { minIdeal = 44; maxIdeal = 44; }

    badge.className = 'tb cred-badge';
    badge.style.background = '';
    badge.style.color = '';
    badge.style.borderColor = '';
    let numStyle = '';
    
    let icon = 'bi-mortarboard';
    if (total > 0 && total < minIdeal) {
        icon = 'bi-exclamation-circle';
        badge.style.background = '#fff9e6';
        badge.style.color = '#856404';
        badge.style.borderColor = '#ffe082';
        numStyle = 'background:#D59F0F; color:#002B7A;';
    } else if (total > maxIdeal) {
        icon = 'bi-x-octagon';
        badge.style.background = '#fff5f5';
        badge.style.color = '#c92a2a';
        badge.style.borderColor = '#ffc9c9';
        numStyle = 'background:#dc3545; color:#fff;';
    } else if (total > 0) {
        icon = 'bi-check-circle';
        // Auto-snapshot silencioso al llegar a créditos ideales
        SadaAnalytics.saveSnapshot(miHorario, actividadesExtra, document.getElementById('semestre-selector').value, 'manual', false);
    }
    
    badge.innerHTML = `<i class="bi ${icon}"></i> Créditos <span class="num" style="${numStyle}">${total}</span>`;

    if (document.getElementById('switch-vista').checked) renderizarHorarioVisual();
}

function generarFilaSIAE(c, idx = null, showDelete = true) {
    const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    let d = { LUNES: null, MARTES: null, MIERCOLES: null, JUEVES: null, VIERNES: null, SABADO: null };
    c.sesiones.forEach(s => {
        let k = normalizarDiaHorario(s.dia);
        if (d.hasOwnProperty(k)) d[k] = `${escapeHtml(s.inicio)}-${escapeHtml(s.fin)}`;
    });

let color = (MAPA_COLORES_ASIGNADOS[c.id_unico] || '#d2d2d7');
    if (c._esActividad) color = '#ffb66d'; 
    let displayAsignatura = c._esActividad ? limpiarNombreActividadExtra(c.asignatura) : c.asignatura;
    let swatchTd = `<td class="swatch-cell"><span class="swatch" style="background:${color}"></span></td>`;
    let claveHtml = c.clave ? `<span class="materia-clave">${escapeHtml(c.clave)}</span>` : '';
    let nombreTd = `<td class="materia-cell"><span class="materia-name">${escapeHtml(displayAsignatura)}</span>${claveHtml}</td>`;
    let grupoTd = `<td class="grupo-cell"><span class="grupo-pill">${escapeHtml(c.grupo)}</span></td>`;
    let profTd = `<td class="profesor-cell"><span class="profesor">${escapeHtml(c.profesor)}</span></td>`;
    let dayTds = DIAS.map(dia =>
        d[dia] !== null
            ? `<td class="day-cell"><span class="hours">${d[dia]}</span></td>`
            : `<td class="day-cell empty">-</td>`
    ).join('');
    let creditosTd = `<td class="creditos">${c.creditos || '-'}</td>`;
    
    let rmTd = '';
    if (c._esActividad) {
        rmTd = `<td class="accion-cell"><button class="rm-btn" onclick="eliminarActividad('${c.id_unico}')" title="Eliminar Actividad"><i class="bi bi-x-lg"></i></button></td>`;
    } else if (showDelete && idx !== null) {
        rmTd = `<td class="accion-cell"><button class="rm-btn" onclick="borrar(${idx})" title="Eliminar Materia"><i class="bi bi-x-lg"></i></button></td>`;
    } else {
        rmTd = `<td class="accion-cell"></td>`;
    }
    let trClass = c._esActividad ? ' class="actividad"' : '';
    return `<tr${trClass}>${swatchTd}${nombreTd}${grupoTd}${profTd}${dayTds}${creditosTd}${rmTd}</tr>`;
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
        actividadesExtra = [];
        renderActividades();
        guardarEstado();
        limpiarPanelGrupos();
        filtrarMaterias();
        actualizarTablaHorario();
    }
}

// --- NUEVAS FUNCIONES DE DESCARGA (CORRIGEN MOVIL/VERTICAL) ---
// ==========================================
// 12. FUNCIONES DE EXPORTACION
// ==========================================

// --- NUEVAS FUNCIONES DE DESCARGA (CORRIGEN MOVIL/VERTICAL) ---
async function descargarPDF() {
    const { jsPDF } = window.jspdf;

    // 1. Clonar contenido a un contenedor oculto con ancho fijo
    let isVisual = document.getElementById('switch-vista').checked;
    let sourceId = isVisual ? 'vista-visual-container' : 'vista-lista-container';
    let source = document.getElementById(sourceId);

    let container = document.getElementById('capture-container');
    container.innerHTML = ''; // Limpiar

    let wrapper = document.createElement('div');
    wrapper.className = 'L1 export-siae-sheet';
    wrapper.style.width = '1300px'; // Forzar ancho escritorio
    wrapper.style.padding = '28px';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.innerHTML = '<div class="export-siae-title">Horario seleccionado</div>';

    let clone = source.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.classList.remove('table-responsive');

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
    wrapper.className = 'L1 export-siae-sheet';
    wrapper.style.width = '1300px'; // Forzar ancho escritorio
    wrapper.style.padding = '28px';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.innerHTML = '<div class="export-siae-title">Horario seleccionado</div>';

    let clone = source.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.classList.remove('table-responsive');

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

function abrirSelectorHora(inputId) {
    let input = document.getElementById(inputId);
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
        input.showPicker();
    }
}

function agregarActividad(source) {
    let suffix = source === 'auto' ? '-auto' : '';
    let modoFiltro = source === 'auto' ? 'auto' : 'manual';
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

    // AQUÍ ESTÁ LA ETIQUETA: modo: modoFiltro
    let actividad = {
        id_unico: id, asignatura: nombre, profesor: 'Actividad Extra',
        grupo: '-', creditos: 0, clave: '-', observaciones: '', semestre: 0,
        area: 'EXTRA', sesiones: sesiones, esActividad: true,
        modo: modoFiltro 
    };
    actividad.asignatura = nombre;

    let targetHorario = modoFiltro === 'auto' ? [] : miHorario;
    let prevActs = actividadesExtra.filter(a => a.modo === modoFiltro);
    let conflictos = obtenerChoques(actividad, [...targetHorario, ...prevActs]);
    if (conflictos.length > 0) {
        let nombres = conflictos.map(c => c.esActividad ? limpiarNombreActividadExtra(c.asignatura) : c.asignatura).join(', ');
        alert('Esta actividad se traslapa con: ' + nombres + '.\nAjusta el día u horario para poder agregarla.');
        return;
    }

    actividadesExtra.push(actividad);
    renderActividades();
    renderizarHorarioVisual();
    actualizarTablaHorario();
    renderBolsa();
    if (materiaSeleccionadaActual) cargarPanelGrupos(materiaSeleccionadaActual);
    if (materiaSeleccionadaAuto) cargarPanelGruposAuto(materiaSeleccionadaAuto);

    document.getElementById('act-nombre' + suffix).value = '';
    document.querySelectorAll('.act-dia-chk' + suffix).forEach(c => { c.checked = false; c.parentElement.classList.remove('active'); });

    SadaAnalytics.trackCustom('add_activity', { name: nombre, dias: dias, inicio: inicio, fin: fin });
}

function eliminarActividad(id) {
    actividadesExtra = actividadesExtra.filter(a => a.id_unico !== id);
    renderActividades();
    renderizarHorarioVisual();
    actualizarTablaHorario();
    renderBolsa();
    if (materiaSeleccionadaActual) cargarPanelGrupos(materiaSeleccionadaActual);
}

function renderActividades() {
    ['', '-auto'].forEach(suffix => {
        let modoStr = suffix === '-auto' ? 'auto' : 'manual';
        let actsFiltradas = actividadesExtra.filter(a => a.modo === modoStr);
        let count = actsFiltradas.length;
        
        let lista = document.getElementById('lista-actividades' + suffix);
        let badge = document.getElementById('badge-actividades' + suffix);
        if (badge) { badge.style.display = count > 0 ? 'inline-block' : 'none'; badge.textContent = count; }
        if (!lista) return;
        lista.innerHTML = '';    
        actsFiltradas.forEach(act => {
            let diasStr = act.sesiones.map(s => s.dia.substr(0, 3)).join(', ');
            let horaStr = act.sesiones[0] ? act.sesiones[0].inicio + '-' + act.sesiones[0].fin : '';
            let nombre = limpiarNombreActividadExtra(act.asignatura);
            let item = document.createElement('div');
            item.className = 'actA__chip';
            item.innerHTML = '<div><div class="actA__chip-name">' + nombre + '</div><div class="actA__chip-meta">' + diasStr + ' · ' + horaStr + '</div></div><button class="actA__chip-rm" onclick="eliminarActividad(\'' + act.id_unico + '\')" title="Eliminar"><i class="bi bi-x-circle-fill"></i></button>';
            lista.appendChild(item);
        });
    });
}

// ==========================================
// 13. MODO EXPLORADOR: SELECCION Y GENERACION
// ==========================================

function filtrarMateriasAuto() {
    let txt = document.getElementById('buscador-auto').value.toUpperCase();
    let lista = document.getElementById('lista-materias-auto');
    lista.innerHTML = '';

    let matSem = obtenerMateriasActivas();
    if (matSem.length === 0) {
        lista.innerHTML = '<div class="p-3 text-muted small text-center">No hay datos.</div>';
        return;
    }

    let areas = [...new Set(matSem.map(c => c.area))].sort();

    areas.forEach(area => {
        let matsEnArea = [...new Set(matSem.filter(c => c.area === area).map(c => c.asignatura))].sort();
        let matsFiltradas = matsEnArea.filter(m => m.toUpperCase().includes(txt));
        if (matsFiltradas.length === 0) return;

        let isOpen = matsFiltradas.includes(materiaSeleccionadaAuto) || txt.length >= 2;

        let header = document.createElement('div');
        header.className = 'ml-area-header';
        header.setAttribute('data-open', String(isOpen));
        header.innerHTML = `<i class="bi bi-chevron-down ml-chevron"></i><span class="ml-area-name">${area.toLowerCase()}</span><span class="ml-area-count">${matsFiltradas.length}</span>`;

        let body = document.createElement('div');
        body.className = 'ml-area-body';
        body.setAttribute('data-open', String(isOpen));

        header.onclick = () => {
            let open = header.getAttribute('data-open') === 'true';
            header.setAttribute('data-open', String(!open));
            body.setAttribute('data-open', String(!open));
        };

        matsFiltradas.forEach(nom => {
            let enBolsa = bolsa[nom] && bolsa[nom].length > 0;
            let esActiva = materiaSeleccionadaAuto === nom;

            let estado = 'default';
            let iconHtml = '';

            if (esActiva) {
                estado = 'activa';
                iconHtml = '<i class="bi bi-check-circle-fill ml-item-icon" aria-hidden="true"></i>';
            } else if (enBolsa) {
                estado = 'candidata';
                iconHtml = '<i class="bi bi-star-fill ml-item-icon" aria-hidden="true"></i>';
            }

            let item = document.createElement('div');
            item.className = 'ml-item';
            item.setAttribute('data-state', estado);
            item.innerHTML = `<span class="ml-item-name">${nom}</span>${iconHtml}`;

            item.onclick = () => {
                materiaSeleccionadaAuto = nom;
                filtrarMateriasAuto();
                cargarPanelGruposAuto(nom);
                if (typeof expandMobilePanel === 'function') expandMobilePanel('#contenedor-panel-auto');
            };
            body.appendChild(item);
        });

        lista.appendChild(header);
        lista.appendChild(body);
    });
}

function limpiarPanelGruposAuto() {
    document.getElementById('titulo-seleccion-auto').innerHTML = '<i class="bi bi-arrow-left-circle"></i> 2. Selecciona tus Profesores';
    document.getElementById('info-seleccion-auto').innerText = 'Esperando...';
    document.getElementById('contenedor-grupos-auto').innerHTML = '<div class="text-center text-muted py-5 w-100"><i class="bi bi-hand-index-thumb display-1 opacity-25"></i><p class="mt-3 lead">Selecciona una materia a la izquierda.</p></div>';
}



function cargarPanelGrupos(asignatura) {
    let semVal = document.getElementById('semestre-selector').value;
    let sem = parseInt(semVal);
    document.getElementById('titulo-seleccion').innerHTML = `<i class="bi bi-book"></i> ${asignatura}`;
    let cursos = obtenerMateriasActivas().filter(c => c.asignatura === asignatura).sort((a, b) => a.grupo.localeCompare(b.grupo));

    let gA = parseInt(cursos[0].grupo), gB = parseInt(cursos[1].grupo);
    if (!isNaN(gA) && !isNaN(gB)) {
        cursos.sort((a, b) => parseInt(a.grupo) - parseInt(b.grupo));
    }

    document.getElementById('info-seleccion').innerText = `${cursos.length} Grupos`;
    let contenedor = document.getElementById('contenedor-grupos');
    contenedor.innerHTML = '';
    contenedor.className = 'horizontal-scroll-container';
    if (cursos.length === 0) {
        contenedor.innerHTML = '<div class="alert alert-warning text-center w-100">No se encontraron grupos.</div>';
        return;
    }

    let materiaPadreInscrita = null;
    let materiaHijoInscrita = null;

    if (sem === 4) {
        if (asignatura.includes("APRENDIZAJE Y CONDUCTA ADAPTAT. III (PRACTICA)")) {
            materiaPadreInscrita = miHorario.find(m => m.asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III");
        } else if (asignatura === "APRENDIZAJE Y CONDUCTA ADAPTAT. III") {
            materiaHijoInscrita = miHorario.find(m => m.asignatura.includes("(PRACTICA)"));
        }
    }
    let horarioSinMateriaActual = miHorario.filter(h => h.asignatura !== asignatura);
    
    let actsManual = actividadesExtra.filter(a => a.modo === 'manual');
    cursos.forEach(c => {
        let conflictos = obtenerChoques(c, [...horarioSinMateriaActual, ...actsManual]);
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

        let horario = c.sesiones.length > 0
            ? c.sesiones.map(s => `<div class="gc-horario-row"><span class="gc-horario-dia">${escapeHtml(s.dia.substr(0, 3).toUpperCase())}</span><span>${escapeHtml(s.inicio)}-${escapeHtml(s.fin)}</span></div>`).join('')
            : '<i>Sin horario</i>';
        let estado = 'default';
        let footerHtml = '';
        let onSelect = null;
        let clickDisabled = false;

        if (yaInscrita) {
            estado = 'inscrita';
            onSelect = () => toggleSeleccionManual(c.id_unico, asignatura);
        } else if (bloqueadoPorACA) {
            estado = 'traslape';
            clickDisabled = true;
        } else if (esPrevisualizada) {
            estado = 'previsualizacion';
            let pendiente = materiasPendientes.find(p => p.curso.id_unico === c.id_unico);
            let listaNombresConflictos = pendiente.conflictos.map(cf => cf.asignatura).join(', ');
            footerHtml = `
                <div class="grupo-card-v2__action-block">
                    <div class="grupo-card-v2__action-caption">Se eliminará: ${escapeHtml(listaNombresConflictos)}</div>
                    <button class="btn btn-sm btn-danger w-100 fw-bold" onclick="event.stopPropagation(); confirmarTraslape(${c.id_unico})">CONFIRMAR CAMBIO</button>
                    <button class="btn btn-sm btn-link text-muted p-0 mt-1" onclick="event.stopPropagation(); cancelarTraslape(${c.id_unico}, '${asignatura}')">Cancelar</button>
                </div>`;
        } else if (choca) {
            estado = 'traslape';
            onSelect = () => previsualizarTraslape(c.id_unico, asignatura);
        } else {
            onSelect = () => toggleSeleccionManual(c.id_unico, asignatura);
        }

        contenedor.appendChild(createGrupoCard({
            numeroGrupo: c.grupo,
            profesor: c.profesor,
            horario,
            salon: c.salon,
            observacion: c.observaciones.length > 5 ? c.observaciones : '',
            estado,
            onSelect,
            clickDisabled,
            footerHtml,
            creditsText: `${c.creditos} Cr`,
            clave: c.clave || ''
        }));
    });
}

function cargarPanelGruposAuto(asignatura) {
    document.getElementById('titulo-seleccion-auto').innerHTML = `<i class="bi bi-book"></i> ${asignatura}`;
    let cursos = obtenerMateriasActivas().filter(c => c.asignatura === asignatura).sort((a, b) => a.grupo.localeCompare(b.grupo));
    document.getElementById('info-seleccion-auto').innerText = `${cursos.length} Grupos`;

    let contenedor = document.getElementById('contenedor-grupos-auto');
    contenedor.innerHTML = '';
    contenedor.className = 'horizontal-scroll-container';
    if (cursos.length === 0) {
        contenedor.innerHTML = '<div class="alert alert-warning text-center w-100">No se encontraron grupos.</div>';
        return;
    }

    let idsEnBolsa = [];
    if (bolsa[asignatura]) {
        idsEnBolsa = bolsa[asignatura].map(c => c.id_unico);
    }

    cursos.forEach(c => {
        let seleccionado = idsEnBolsa.includes(c.id_unico);
        let horario = c.sesiones.length > 0
            ? c.sesiones.map(s => `<div class="gc-horario-row"><span class="gc-horario-dia">${escapeHtml(s.dia.substr(0, 3).toUpperCase())}</span><span>${escapeHtml(s.inicio)}-${escapeHtml(s.fin)}</span></div>`).join('')
            : '<i>Sin horario</i>';

        contenedor.appendChild(createGrupoCard({
            numeroGrupo: c.grupo,
            profesor: c.profesor,
            horario,
            salon: c.salon,
            observacion: c.observaciones.length > 5 ? c.observaciones : '',
            estado: seleccionado ? 'candidato' : 'default',
            onSelect: () => toggleCandidato(c.id_unico, asignatura),
            creditsText: `${c.creditos} Cr`,
            clave: c.clave || ''
        }));
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
    let actsAuto = actividadesExtra.filter(act => act.modo === 'auto');
    let tieneActividades = actsAuto.length > 0;
    
    if (keys.length === 0 && !tieneActividades) { 
        ul.innerHTML = '<li class="list-group-item text-muted text-center py-3 w-100 rounded border-0 bg-transparent">Aún no has seleccionado materias.</li>'; 
        return; 
    }
    
    keys.forEach(k => {
        let li = document.createElement('li'); li.className = 'list-group-item d-flex justify-content-between align-items-center py-2 px-3 rounded shadow-sm border border-secondary border-opacity-25 bg-white';
        li.style.width = "auto";
        li.style.flex = "1 1 auto";
        li.style.minWidth = "220px";
        li.innerHTML = `<div class="misel-chip-name"><span class="fw-bold d-block text-truncate small" title="${escapeHtml(k)}">${escapeHtml(k)}</span></div><div class="misel-chip-meta"><span class="badge bg-secondary rounded-pill">${bolsa[k].length}</span><i class="bi bi-x-circle text-danger cursor-pointer fs-6"></i></div>`;
        li.querySelector('.bi-x-circle').onclick = () => delBolsa(k);
        ul.appendChild(li);
    });

    actsAuto.forEach(act => {
        let li = document.createElement('li'); 
        li.className = 'list-group-item misel-chip--extra d-flex justify-content-between align-items-center py-2 px-3 rounded shadow-sm bg-white';
        li.style.width = "auto";
        li.style.flex = "1 1 auto";
        li.style.minWidth = "220px";
        li.innerHTML = `<div class="misel-chip-name"><span class="fw-bold d-block text-truncate small" title="${escapeHtml(act.asignatura)}">${escapeHtml(act.asignatura)} (Extra)</span></div><div class="misel-chip-meta"><span class="badge">1</span><i class="bi bi-x-circle text-danger cursor-pointer fs-6"></i></div>`;
        li.querySelector('.bi-x-circle').onclick = () => eliminarActividad(act.id_unico);
        ul.appendChild(li);
    });
}

function delBolsa(k) { 
    delete bolsa[k]; 
    guardarEstado(); 
    renderBolsa(); 
    filtrarMateriasAuto(); 
    if (materiaSeleccionadaAuto === k) {
        limpiarPanelGruposAuto(); 
    }
}
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
// 14. ALGORITMOS DE GENERACION
// ==========================================

async function generarCombinaciones() {
    mostrarPantallaCargaModo('generando');
    await new Promise(r => setTimeout(r, 600)); // Allow UI to update with loading screen and feel longer

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
                let actsAuto = actividadesExtra.filter(a => a.modo === 'auto');
                let fullComb = [...comb, ...actsAuto];
                
                let creds = fullComb.reduce((a, b) => a + b.creditos, 0);
                let diasSet = new Set(fullComb.flatMap(c => c.sesiones.map(s => s.dia)));
                let huecos = calcularHuecos(fullComb);

                RESULTADOS_GLOBALES.push({
                    cursos: fullComb,
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

        await new Promise(r => setTimeout(r, 400)); // Extra delay to feel like the engine is stopping
        ocultarPantallaCargaModo();
        // Automatically switch to Results view
        if (window.innerWidth < 768 && typeof switchToMobileTab === 'function') {
            switchToMobileTab(5);
        } else {
            activarModo('resultados');
        }
        enfocarInicioModo('resultados');
    } catch (error) {
        console.error(error);
        ocultarPantallaCargaModo();
        alert(error.message);
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
            let badgeCreditos = rep.maxCreditos > 41
                ? `<span class="badge bg-warning text-dark border border-warning ms-2"><i class="bi bi-exclamation-circle"></i> Excede Créditos (${rep.maxCreditos})</span>`
                : (rep.maxCreditos < 30 ? `<span class="badge bg-light text-muted border ms-2">Baja Carga (${rep.maxCreditos} Cr)</span>` : '');

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

function setFiltroResultado(inputId, value, label, buttonId) {
    let input = document.getElementById(inputId);
    let button = document.getElementById(buttonId);
    if (input) input.value = value;
    if (button) button.textContent = label;
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
    actualizarEstadoFiltrosResultados(crit, tFiltro, diasLibres, profesSeleccionados);

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

function actualizarEstadoFiltrosResultados(crit, turno, diasLibres, profesSeleccionados) {
    const estados = {
        'filtro-card-sort': !!crit,
        'filtro-card-turno': !!turno,
        'filtro-card-dias': diasLibres.length > 0,
        'filtro-card-profes': profesSeleccionados.length > 0
    };
    Object.entries(estados).forEach(([id, activo]) => {
        let el = document.getElementById(id);
        if (el) el.classList.toggle('is-active', activo);
    });
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
        let item = document.createElement('div'); item.className = 'opcion-card';
        item.innerHTML = `
        <div class="opcion-head" role="button" tabindex="0" onclick="toggleOpcionResultado(event, ${i})" onkeydown="if(event.key==='Enter'||event.key===' '){toggleOpcionResultado(event, ${i});}">
        <span class="opcion-num">Opción ${i + 1}</span>
        <div class="opcion-stats t-body">
        <span class="stat"><i class="bi bi-calendar-week"></i> <b>${val.dias}</b> días</span>
        <span class="div"></span>
        <span class="stat"><i class="bi bi-mortarboard"></i> <b>${val.creditos}</b> créditos</span>
        <span class="div"></span>
        <span class="stat"><i class="bi bi-hourglass-split"></i> <b>${val.huecos}h</b> libres</span>
        </div>
        <div class="opcion-actions">
        <button id="btn-auto-${i}" class="ac-btn ac-btn--main" onclick="confirmarHorarioAuto(${i})">
            <i class="bi bi-mortarboard-fill"></i> Mi Opción Principal
        </button>
        <button class="ac-btn ac-btn--ghost" onclick="transferirAManual(${i})">
            <i class="bi bi-arrow-left-right"></i> Transferir
        </button>
        <div class="dropdown d-inline-block">
            <button class="ac-btn ac-btn--neutral dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <i class="bi bi-download"></i> Descargar
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 t-body">
            <li><a class="dropdown-item py-2" href="#" onclick="event.preventDefault(); descargarAutoOpcion(${i}, 'pdf')"><i class="bi bi-file-earmark-pdf me-2 text-danger"></i> PDF</a></li>
            <li><a class="dropdown-item py-2" href="#" onclick="event.preventDefault(); descargarAutoOpcion(${i}, 'png')"><i class="bi bi-image me-2 text-primary"></i> PNG</a></li>
            <li><a class="dropdown-item py-2" href="#" onclick="event.preventDefault(); descargarAutoOpcion(${i}, 'excel')"><i class="bi bi-file-earmark-excel me-2 text-success"></i> Excel</a></li>
            </ul>
        </div>
        <div class="dropdown d-inline-block">
            <button id="sort-auto-${i}" class="ac-btn ac-btn--neutral dropdown-toggle" type="button" data-bs-toggle="dropdown">
            <i class="bi bi-sort-alpha-down"></i> <span id="sort-auto-label-${i}">Ordenar</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0 t-body">
            <li><button class="dropdown-item py-2" onclick="ordenarTablaAuto(${i}, 'materia')">Por Materia (A-Z)</button></li>
            <li><button class="dropdown-item py-2" onclick="ordenarTablaAuto(${i}, 'profesor')">Por Profe (A-Z)</button></li>
            <li><button class="dropdown-item py-2" onclick="ordenarTablaAuto(${i}, 'grupo')">Por Grupo (1-15)</button></li>
            <li><button class="dropdown-item py-2" onclick="ordenarTablaAuto(${i}, 'cronologico')">Por Hora (00-24)</button></li>
            </ul>
        </div>
        <button class="ac-btn ac-btn--dark" onclick="let sw = document.getElementById('switch-auto-${i}'); sw.checked = !sw.checked; toggleVistaAuto(${i})">
            <i class="bi bi-grid-3x3-gap-fill"></i> Tabla dinámica
        </button>
        <button class="ac-btn ac-btn--neutral ms-1" data-bs-toggle="collapse" data-bs-target="#opcion-body-${i}" aria-expanded="false" title="Abrir opción">
            <i class="bi bi-chevron-down"></i>
        </button>
        <input type="checkbox" id="switch-auto-${i}" style="display:none;" onchange="toggleVistaAuto(${i})">
        </div>
    </div>
    <div class="opcion-body collapse t-body t-aa" id="opcion-body-${i}">
        <div id="res-tabla-${i}" class="table-responsive">
            <table class="table table-bordered table-sm mb-0 tabla-siae"><thead class="table-light"><tr><th class="swatch-col"></th><th>Materia</th><th class="grupo-col">Gpo</th><th>Profesor</th><th class="col-dia">L</th><th class="col-dia">M</th><th class="col-dia">Mi</th><th class="col-dia">J</th><th class="col-dia">V</th><th class="col-dia">S</th><th class="num-col">Cr</th><th class="act-col"></th></tr></thead><tbody id="tbody-auto-${i}">${rows}</tbody></table>
        </div>
        <div id="res-visual-${i}" class="p-3 bg-white" style="display:none; overflow-x:auto;"></div>
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

function toggleOpcionResultado(event, idx) {
    if (event && event.target.closest('button, a, input, select, label, .dropdown, .dropdown-menu')) return;
    let body = document.getElementById(`opcion-body-${idx}`);
    if (!body) return;
    if (window.bootstrap && bootstrap.Collapse) {
        bootstrap.Collapse.getOrCreateInstance(body, { toggle: false }).toggle();
    } else {
        body.classList.toggle('show');
    }
}

function ordenarTablaAuto(idx, criterio) {
    if (!RESULTADOS_MOSTRADOS[idx]) return;
    SadaAnalytics.trackHerramienta('auto_sort', { combination: idx, criterio: criterio });
    let cursos = [...RESULTADOS_MOSTRADOS[idx].cursos];
    const mapaDias = { 'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'JUEVES': 3, 'VIERNES': 4, 'SABADO': 5 };

    cursos.sort((a, b) => {
        switch (criterio) {
            case 'materia': return a.asignatura.localeCompare(b.asignatura, 'es', { sensitivity: 'base' });
            case 'profesor': return a.profesor.localeCompare(b.profesor, 'es', { sensitivity: 'base' });
            case 'alfabetico':
                return `${a.asignatura} ${a.profesor}`.localeCompare(`${b.asignatura} ${b.profesor}`, 'es', { sensitivity: 'base' });
            case 'grupo':
                let gA = parseInt(a.grupo); let gB = parseInt(b.grupo);
                if (!isNaN(gA) && !isNaN(gB)) return gA - gB;
                return a.grupo.localeCompare(b.grupo, 'es', { sensitivity: 'base' });
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
    let label = document.getElementById(`sort-auto-label-${idx}`);
    if (label) {
        const labels = {
            materia: 'Materia',
            profesor: 'Profe',
            alfabetico: 'Materia',
            grupo: 'Grupo',
            cronologico: 'Hora'
        };
        label.textContent = labels[criterio] || 'Ordenar';
    }
}

function toggleVistaAuto(idx) {
    let isChecked = document.getElementById(`switch-auto-${idx}`).checked;
    SadaAnalytics.trackHerramienta(isChecked ? 'auto_visual_on' : 'auto_visual_off', { combination: idx });
    let tabla = document.getElementById(`res-tabla-${idx}`);
    let visual = document.getElementById(`res-visual-${idx}`);
    let selectorSort = document.getElementById(`sort-auto-${idx}`);
    let recolorBtn = document.getElementById(`btn-recolor-auto-${idx}`);

    if (selectorSort) {
        let sortGroup = selectorSort.closest('.dropdown') || selectorSort;
        sortGroup.style.display = isChecked ? 'none' : 'inline-block';
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
// 17. CONFIRMACION DE HORARIO FINAL
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
            let row = `${c.asignatura.replace(/,/g, '')},${c.clave},${c.grupo},${c.profesor.replace(/,/g, '')},${d.LUNES},${d.MARTES},${d.MIERCOLES},${d.JUEVES},${d.VIERNES},${d.SABADO},${c.creditos},${(c.observaciones || '').replace(/,/g, ' ').replace(/\n/g, ' ')}`;
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

    // PDF o PNG: capturar con el mismo estilo refinado de la tabla predeterminada
    let sourceEl = document.getElementById(`res-tabla-${idx}`);
    if (!sourceEl) return;

    let container = document.getElementById('capture-container');
    container.innerHTML = '';
    let wrapper = document.createElement('div');
    wrapper.className = 'L1 export-siae-sheet';
    wrapper.style.width = '1300px';
    wrapper.style.padding = '28px';
    wrapper.style.backgroundColor = '#ffffff';
    wrapper.innerHTML = `<div class="export-siae-title">Horario opción ${idx + 1}</div>`;
    let clone = sourceEl.cloneNode(true);
    clone.style.display = 'block';
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    clone.classList.remove('table-responsive');
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
    let btn = document.getElementById('btn-auto-' + idx);
    if (btn) {
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> ¡Registrado!';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
    }
    mostrarEncuestaSatisfaccion();
}

function actualizarFiltrosUI() {
    if (document.getElementById('sort-resultados'))
        document.getElementById('sort-resultados').value = 'dias';
    let btnSort = document.getElementById('btn-sort-resultados');
    if (btnSort) btnSort.textContent = 'Menos Días';

    if (document.getElementById('filtro-turno'))
        document.getElementById('filtro-turno').value = '';
    let btnTurno = document.getElementById('btn-filtro-turno');
    if (btnTurno) btnTurno.textContent = 'Cualquiera';

    document.querySelectorAll('.chk-filtro-dia').forEach(c => c.checked = false);
    let btnDia = document.getElementById('btn-filtro-dia');
    if (btnDia) btnDia.innerText = 'Ninguno';

    document.querySelectorAll('.chk-filtro-profe').forEach(c => c.checked = false);
    let btnProf = document.getElementById('btn-filtro-profe');
    if (btnProf) btnProf.innerText = 'Todos';
    actualizarEstadoFiltrosResultados('dias', '', [], []);
}

// ==========================================
// ENCUESTA DE SATISFACCION (post-confirmacion)
// ==========================================

let _encuestaTimer = null;

function mostrarEncuestaSatisfaccion() {
    let existing = document.getElementById('encuesta-satisfaccion');
    if (existing) existing.remove();
    if (_encuestaTimer) clearTimeout(_encuestaTimer);

    let div = document.createElement('div');
    div.id = 'encuesta-satisfaccion';
    
    // Glassmorphism, centrado, fuente Apple y Nueva Animación Exclusiva
    div.style.cssText = `
        position: fixed; 
        bottom: 24px; 
        left: 50%; 
        z-index: 9999; 
        background: rgba(255, 255, 255, 0.85); 
        backdrop-filter: blur(12px); 
        -webkit-backdrop-filter: blur(12px);
        color: var(--c-label-primary, #000); 
        padding: 24px 32px; 
        border-radius: 20px; 
        box-shadow: 0 10px 40px rgba(0,0,0,0.1); 
        border: 1px solid rgba(255, 182, 109, 0.3);
        animation: slideUpCenter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        gap: 12px; 
        font-family: var(--sf-text, -apple-system, sans-serif);
        text-align: center;
        min-width: 320px;
    `;

    div.innerHTML = `
        <style>
            @keyframes slideUpCenter {
                from { transform: translate(-50%, 150%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        </style>
        <div style="font-weight: 600; font-size: 15px; letter-spacing: -0.01em;">¿Qué tan satisfecho estás con esta página?</div>
        
        <div class="d-flex justify-content-center gap-2" id="estrellas-satisfaccion" style="margin: 4px 0;">
            ${[1, 2, 3, 4, 5].map(n => `
                <button class="star-btn" 
                    style="font-size: 26px; color: #d2d2d7; background: none; border: none; padding: 0; cursor: pointer; transition: transform 0.2s, color 0.2s;" 
                    onmouseenter="document.querySelectorAll('.star-btn').forEach((b, i) => b.style.color = i < ${n} ? '#ffb66d' : '#d2d2d7'); this.style.transform='scale(1.2)'" 
                    onmouseleave="document.querySelectorAll('.star-btn').forEach(b => { b.style.color = '#d2d2d7'; b.style.transform='scale(1)'; })" 
                    onclick="enviarSatisfaccion(${n})" title="${n} estrella${n > 1 ? 's' : ''}">
                    <i class="bi bi-star-fill"></i>
                </button>
            `).join('')}
        </div>

        <button style="background: none; border: none; color: var(--c-label-tertiary, #8e8e93); font-size: 12px; font-weight: 500; cursor: pointer; padding: 4px;" 
            onclick="cerrarEncuesta()">Cerrar</button>
    `;
    
    document.body.appendChild(div);

    // Auto-cerrar exactamente a los 10 segundos
    _encuestaTimer = setTimeout(() => cerrarEncuesta(), 10000);
}


function enviarSatisfaccion(rating) {
    SadaAnalytics.updateSatisfaction(rating);

    let div = document.getElementById('encuesta-satisfaccion');
    if (div) {
        // Pantalla de agradecimiento centrada y con tu Naranja Pastel
        div.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 0;">
                <i class="bi bi-check-circle-fill" style="color: #ffb66d; font-size: 28px; margin-bottom: 8px;"></i> 
                <span style="font-weight: 600; font-size: 15px;">¡Gracias por tu retroalimentación!</span>
            </div>
        `;
        setTimeout(() => cerrarEncuesta(), 2500);
    }
}

function cerrarEncuesta() {
    if (_encuestaTimer) { clearTimeout(_encuestaTimer); _encuestaTimer = null; }
    let div = document.getElementById('encuesta-satisfaccion');
    if (div) { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }
}

// --- INICIAR SELECTOR ---
document.addEventListener("DOMContentLoaded", function() {
    flatpickr(".actA__time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        altInput: true,
        altFormat: "h:i K",
        time_24hr: false,
        disableMobile: "true"
    });
});

