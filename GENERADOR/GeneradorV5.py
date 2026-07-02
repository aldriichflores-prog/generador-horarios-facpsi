import sqlite3
import pandas as pd
import os
import itertools 

# --- CONFIGURACION ---
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(DIRECTORIO_ACTUAL, "horarios_unam.db")

# REGLAS UNAM
MAX_CREDITOS = 41
MIN_CREDITOS = 37
MATERIA_OBLIGATORIA = "ETICA PROFESIONAL" # <--- LA REGLA DE ORO

if not os.path.exists(DB_NAME):
    print(f"[ERROR] No encuentro la base de datos en: {DB_NAME}")
    exit()

conn = sqlite3.connect(DB_NAME)

# ==========================================
#       FUNCIONES DE DATOS
# ==========================================

def obtener_catalogo():
    query = "SELECT DISTINCT asignatura FROM horarios ORDER BY asignatura"
    return pd.read_sql_query(query, conn)['asignatura'].tolist()

def obtener_grupos(asignatura):
    query = """
    SELECT id_curso, grupo, profesor, dia, hora_inicio, hora_fin, min_inicio, min_fin, salon, creditos 
    FROM horarios WHERE asignatura = ?
    """
    df = pd.read_sql_query(query, conn, params=(asignatura,))
    cursos = {}
    for _, row in df.iterrows():
        cid = row['id_curso']
        if cid not in cursos: cursos[cid] = []
        cursos[cid].append(row)
    return cursos

# ==========================================
#       MOTOR DE LÓGICA
# ==========================================

def hay_choque_entre_cursos(curso_A_sesiones, curso_B_sesiones):
    for s_a in curso_A_sesiones:
        for s_b in curso_B_sesiones:
            if s_a['dia'] == s_b['dia']:
                if (s_a['min_inicio'] < s_b['min_fin']) and (s_b['min_inicio'] < s_a['min_fin']):
                    return True
    return False

def calcular_creditos(lista_cursos):
    return sum([c['sesiones'][0]['creditos'] for c in lista_cursos])

def tiene_obligatoria(lista_cursos):
    for c in lista_cursos:
        if c['asignatura'] == MATERIA_OBLIGATORIA:
            return True
    return False

# ==========================================
#       UTILIDADES VISUALES
# ==========================================

def limpiar_pantalla():
    os.system('cls' if os.name == 'nt' else 'clear')

def barra_creditos(actuales, tiene_etica):
    porcentaje = min(actuales / MAX_CREDITOS, 1.0)
    largo = 15
    llenos = int(largo * porcentaje)
    barra = "█" * llenos + "░" * (largo - llenos)
    
    estado = ""
    if actuales > MAX_CREDITOS: estado = "🚫 EXCESO"
    elif actuales >= MIN_CREDITOS: estado = "✅ CREDITOS OK"
    else: estado = "⚠️ BAJO CREDITOS"
    
    # Aviso de Ética
    aviso_etica = "✅ CONTEXTUAL" if tiene_etica else "🛑 FALTA ETICA"
    
    return f"[{barra}] {actuales} Cr. | {estado} | {aviso_etica}"

def mostrar_encabezado(titulo):
    print("\n" + "="*70)
    print(f"   {titulo}")
    print("="*70)

# ==========================================
#       MODO 1: CONSTRUCTOR MANUAL
# ==========================================

def modo_manual():
    mi_horario = []
    inscritas = []
    
    while True:
        total_creds = calcular_creditos(mi_horario)
        con_etica = tiene_obligatoria(mi_horario)
        
        mostrar_encabezado(f"MODO MANUAL")
        print(f"   {barra_creditos(total_creds, con_etica)}")
        print("-" * 70)

        if not mi_horario: print("   (Horario Vacio)")
        else:
            for m in mi_horario: 
                cred = m['sesiones'][0]['creditos']
                tag = "⭐" if m['asignatura'] == MATERIA_OBLIGATORIA else ""
                print(f"[OK] {m['asignatura'][:35]:<35} ({cred} cr) {tag} | {m['profesor'][:20]}")

        print("\nACCIONES:")
        print("1. [AGREGAR] Ver Catalogo y Agregar")
        print("2. [BORRAR]  Quitar Ultima Materia")
        print("3. [GUARDAR] Guardar en TXT y Salir")
        print("4. [VOLVER]  Regresar al Menu Principal")
        op = input("\n> Elige opcion: ")

        if op == "1":
            cat = obtener_catalogo()
            dispo = [c for c in cat if c not in inscritas]
            
            if not dispo:
                print("[!] Ya inscribiste todo.")
                input("Enter...")
                continue

            print("\n--- MATERIAS DISPONIBLES ---")
            for i, m in enumerate(dispo): 
                marca = "⭐ OBLIGATORIA" if m == MATERIA_OBLIGATORIA else ""
                print(f"{i+1}. {m} {marca}")
            print("0. Cancelar")

            try:
                sel = int(input("\n> Numero de materia: "))
                if sel == 0: continue
                mat = dispo[sel-1]
            except: continue

            grupos = obtener_grupos(mat)
            lista_g = sorted(grupos.items(), key=lambda x: x[1][0]['grupo'])
            
            mapa = {}
            print(f"\n--- GRUPOS DE: {mat} ---")
            print(f"{'#':<3} {'GPO':<6} {'CR':<3} {'PROFESOR':<20} {'ESTADO':<10} {'HORARIO'}")
            print("-" * 75)
            
            idx = 1
            for cid, ses in lista_g:
                base = ses[0]
                cred = base['creditos']
                choca = False
                for m_inscrita in mi_horario:
                    if hay_choque_entre_cursos(ses, m_inscrita['sesiones']):
                        choca = True; break
                
                estado = "[CHOQUE]" if choca else "[DISP]"
                hor = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in ses])
                print(f"{idx:<3} {base['grupo']:<6} {cred:<3} {base['profesor'][:20]:<20} {estado:<10} {hor}")
                if not choca:
                    mapa[idx] = {'id': cid, 'asignatura': mat, 'grupo': base['grupo'], 'profesor': base['profesor'], 'sesiones': ses}
                idx += 1
            
            sel_g = input("\n> Elige # de grupo: ")
            if sel_g.isdigit() and int(sel_g) in mapa:
                mi_horario.append(mapa[int(sel_g)])
                inscritas.append(mat)
        
        elif op == "2" and mi_horario:
            r = mi_horario.pop()
            inscritas.remove(r['asignatura'])
            print("Borrado.")
        
        elif op == "3":
            if not con_etica:
                print(f"\n🛑 CUIDADO: No has metido {MATERIA_OBLIGATORIA}.")
                conf = input("¿Guardar de todos modos? (S/N): ").upper()
                if conf != "S": continue
            guardar_txt(mi_horario, "Horario_Manual.txt")
            break
        elif op == "4": break

# ==========================================
#       MODO 2: EXPLORADOR CON RANKING
# ==========================================

def modo_explorador():
    seleccion_candidatos = {} 
    
    while True:
        total_materias = len(seleccion_candidatos)
        tiene_etica_bolsa = MATERIA_OBLIGATORIA in seleccion_candidatos
        
        aviso = "✅ Incluida" if tiene_etica_bolsa else "🛑 FALTA AGREGARLA"
        
        mostrar_encabezado(f"MODO EXPLORADOR (Bolsa: {total_materias} materias)")
        print(f"   Estado de {MATERIA_OBLIGATORIA}: {aviso}")
        print("-" * 70)
        
        if total_materias > 0:
            for i, (nombre_mat, opciones) in enumerate(seleccion_candidatos.items()):
                tag = "⭐" if nombre_mat == MATERIA_OBLIGATORIA else ""
                print(f" {i+1}. {nombre_mat} {tag} ({len(opciones)} profes)")
        else:
            print(" (Bolsa vacia)")

        print("\nACCIONES:")
        print("1. [AGREGAR] Seleccionar Materia y Profesores")
        print("2. [BORRAR]  Sacar una Materia")
        print("3. [GENERAR] ¡Calcular Rankings!")
        print("4. [SALIR]   Volver")
        
        op = input("\n> Elige opcion: ")

        if op == "4": return
        
        if op == "2":
            if not seleccion_candidatos: continue
            lista = list(seleccion_candidatos.keys())
            for i, n in enumerate(lista): print(f"{i+1}. {n}")
            try:
                elim = int(input("> Numero: ")) - 1
                del seleccion_candidatos[lista[elim]]
            except: pass
            continue

        if op == "3":
            # VALIDACION DE OBLIGATORIA
            if not tiene_etica_bolsa:
                print(f"\n[!] ALERTA ROJA: No has seleccionado candidatos para '{MATERIA_OBLIGATORIA}'.")
                print("    Sin esta materia no te puedes inscribir.")
                confirm = input("    ¿Quieres generar horarios SIN ella de todos modos? (S/N): ").upper()
                if confirm != "S": continue 
            
            procesar_combinaciones_con_ranking(seleccion_candidatos)
            input("\nPresiona Enter para volver...")
            continue
        
        if op == "1":
            cat = obtener_catalogo()
            print("\n--- CATALOGO ---")
            for i, m in enumerate(cat):
                marca = "[YA EN BOLSA]" if m in seleccion_candidatos else ""
                tag = "⭐ OBLIGATORIA" if m == MATERIA_OBLIGATORIA else ""
                print(f"{i+1}. {m} {tag} {marca}")
            print("0. Cancelar")

            try:
                sel = int(input("\n> Numero: "))
                if sel == 0: continue
                mat_nom = cat[sel-1]
            except: continue

            grupos = obtener_grupos(mat_nom)
            lista_g = sorted(grupos.items(), key=lambda x: x[1][0]['grupo'])
            mis_candidatos = seleccion_candidatos.get(mat_nom, [])
            
            while True:
                cred_mat = lista_g[0][1][0]['creditos']
                print(f"\n--- PROFES PARA: {mat_nom} ({cred_mat} Cr) ---")
                
                print(f"\n{'#':<3} {'SEL':<5} {'GPO':<6} {'PROFESOR':<25} {'HORARIO'}")
                print("-" * 75)
                
                mapa_local = {}
                idx = 1
                for cid, ses in lista_g:
                    base = ses[0]
                    esta = any(c['id'] == cid for c in mis_candidatos)
                    marca = "[X]" if esta else "[ ]"
                    hor = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in ses])
                    
                    print(f"{idx:<3} {marca:<5} {base['grupo']:<6} {base['profesor'][:25]:<25} {hor}")
                    mapa_local[idx] = {'id': cid, 'asignatura': mat_nom, 'grupo': base['grupo'], 'profesor': base['profesor'], 'sesiones': ses}
                    idx += 1
                
                sel_c = input("\n> Numero para marcar/desmarcar (0 termina): ").upper()
                if sel_c == "0" or sel_c == "OK":
                    if mis_candidatos: seleccion_candidatos[mat_nom] = mis_candidatos
                    elif mat_nom in seleccion_candidatos: del seleccion_candidatos[mat_nom]
                    break
                
                if sel_c.isdigit() and int(sel_c) in mapa_local:
                    target = mapa_local[int(sel_c)]
                    idx_enc = next((i for i, c in enumerate(mis_candidatos) if c['id'] == target['id']), -1)
                    if idx_enc != -1: mis_candidatos.pop(idx_enc)
                    else: mis_candidatos.append(target)

def procesar_combinaciones_con_ranking(diccionario_candidatos):
    if not diccionario_candidatos:
        print("La bolsa esta vacia.")
        return

    listas = list(diccionario_candidatos.values())
    
    print("\n" + "="*60)
    print("   CALCULANDO RANKING DE HORARIOS...")
    print("="*60)
    
    todas = list(itertools.product(*listas))
    print(f"-> Combinaciones posibles: {len(todas)}")
    
    validos = [] # Aqui guardaremos diccionarios con {cursos, huecos, dias}
    primeros_errores = [] 
    
    for comb in todas:
        # FILTRO DE CHOQUE
        es_valido = True
        motivo = ""
        for i in range(len(comb)):
            for j in range(i + 1, len(comb)):
                if hay_choque_entre_cursos(comb[i]['sesiones'], comb[j]['sesiones']):
                    es_valido = False
                    motivo = f"{comb[i]['asignatura']} vs {comb[j]['asignatura']}"
                    break 
            if not es_valido: break
        
        if es_valido:
            # --- CALCULO DE CALIDAD (RANKING) ---
            huecos = 0
            dias_ocupados = set()
            
            # Organizar por dia para medir huecos
            agenda = {}
            for curso in comb:
                for sesion in curso['sesiones']:
                    d = sesion['dia']
                    dias_ocupados.add(d)
                    if d not in agenda: agenda[d] = []
                    # Guardamos (inicio, fin) en minutos
                    agenda[d].append((sesion['min_inicio'], sesion['min_fin']))
            
            # Calcular minutos muertos entre clases
            for dia, lapsos in agenda.items():
                lapsos.sort() # Ordenar cronologicamente
                for k in range(len(lapsos) - 1):
                    fin_actual = lapsos[k][1]
                    inicio_sig = lapsos[k+1][0]
                    diferencia = inicio_sig - fin_actual
                    if diferencia > 0:
                        huecos += diferencia
            
            validos.append({
                'cursos': comb,
                'huecos': huecos,
                'num_dias': len(dias_ocupados)
            })
            
            if len(validos) >= 200: break # Limite aumentado para poder ordenar
        else:
            if len(primeros_errores) < 3: primeros_errores.append(motivo)
    
    # --- ORDENAMIENTO (LA MAGIA) ---
    # Criterio 1: Menos dias de clase (ascendente)
    # Criterio 2: Menos huecos (ascendente)
    validos.sort(key=lambda x: (x['num_dias'], x['huecos']))

    if len(validos) > 0:
        print(f"\n✅ ¡EXITO! Encontre {len(validos)} horarios validos.")
        print("   (Mostrando los TOP 10 ordenados por comodidad)")
        
        for i, data in enumerate(validos[:10]):
            hor = data['cursos']
            huecos_hr = round(data['huecos'] / 60, 1)
            dias = data['num_dias']
            c_total = calcular_creditos(hor)
            
            # Etiquetas
            tag = "✅"
            if c_total > MAX_CREDITOS: tag = "🚫 EXCESO"
            elif c_total < MIN_CREDITOS: tag = "⚠️ BAJO"
            
            print(f"\n--- OPCION {i+1} (Días: {dias} | Huecos: {huecos_hr}h | {c_total} Cr {tag}) ---")
            for curso in hor:
                cr = curso['sesiones'][0]['creditos']
                tag_obl = "⭐" if curso['asignatura'] == MATERIA_OBLIGATORIA else ""
                print(f"  * {curso['asignatura'][:25]:<25} ({cr} cr) {tag_obl} | {curso['profesor'][:20]}")
        
        save = input("\n¿Guardar resultados en archivo? (S/N): ").upper()
        if save == "S": 
            # Extraemos la lista pura de cursos
            lista_pura = [v['cursos'] for v in validos]
            guardar_multiples_txt(lista_pura)
            
    else:
        print("\n❌ 0 HORARIOS VALIDOS.")
        if primeros_errores:
            print("   Conflictos detectados (ejemplos):")
            for e in primeros_errores: print(f"   - {e}")

# ==========================================
#       GUARDAR ARCHIVOS
# ==========================================

def guardar_txt(horario, nombre):
    path = os.path.join(DIRECTORIO_ACTUAL, nombre)
    with open(path, "w", encoding="utf-8") as f:
        creds = calcular_creditos(horario)
        f.write(f"HORARIO OFICIAL ({creds} Creditos)\n\n")
        for m in horario:
            c = m['sesiones'][0]['creditos']
            f.write(f"{m['asignatura']} ({c} cr) - {m['profesor']} ({m['grupo']})\n")
            for s in m['sesiones']: f.write(f"  {s['dia']} {s['hora_inicio']}-{s['hora_fin']}\n")
    print(f"Guardado en {path}")

def guardar_multiples_txt(lista_horarios):
    path = os.path.join(DIRECTORIO_ACTUAL, "Mis_Opciones_Top.txt")
    with open(path, "w", encoding="utf-8") as f:
        for i, h in enumerate(lista_horarios):
            creds = calcular_creditos(h)
            # Volvemos a calcular huecos/dias solo para el reporte
            dias_set = set()
            for m in h:
                for s in m['sesiones']: dias_set.add(s['dia'])
            
            f.write(f"\n=== OPCION {i+1} (Creditos: {creds} | Dias: {len(dias_set)}) ===\n")
            for m in h:
                c = m['sesiones'][0]['creditos']
                f.write(f"* {m['asignatura']} ({c} cr) - {m['profesor']} ({m['grupo']})\n")
                hor_str = " | ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in m['sesiones']])
                f.write(f"  Horario: {hor_str}\n")
    print(f"Guardado en {path}")

if __name__ == "__main__":
    while True:
        mostrar_encabezado("GENERADOR UNAM (V5: Ranking + Etica)")
        print("1. MODO MANUAL")
        print("2. MODO EXPLORADOR")
        print("3. SALIR")
        op = input("\n> ")
        if op == "1": modo_manual()
        elif op == "2": modo_explorador()
        elif op == "3": 
            print("Bye!")
            conn.close()
            break