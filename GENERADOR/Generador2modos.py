import sqlite3
import pandas as pd
import os
import itertools 

# --- CONFIGURACION ---
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(DIRECTORIO_ACTUAL, "horarios_unam.db")

if not os.path.exists(DB_NAME):
    print(f"[ERROR] No encuentro la base de datos en: {DB_NAME}")
    exit()

conn = sqlite3.connect(DB_NAME)

# ==========================================
#       FUNCIONES DE BASE DE DATOS
# ==========================================

def obtener_catalogo():
    query = "SELECT DISTINCT asignatura FROM horarios ORDER BY asignatura"
    return pd.read_sql_query(query, conn)['asignatura'].tolist()

def obtener_grupos(asignatura):
    query = """
    SELECT id_curso, grupo, profesor, dia, hora_inicio, hora_fin, min_inicio, min_fin, salon 
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
#       MOTOR DE LÓGICA (VALIDACIONES)
# ==========================================

def hay_choque_entre_cursos(curso_A_sesiones, curso_B_sesiones):
    """Revisa si dos materias chocan entre sí"""
    for s_a in curso_A_sesiones:
        for s_b in curso_B_sesiones:
            if s_a['dia'] == s_b['dia']:
                # Logica de choque: (InicioA < FinB) y (InicioB < FinA)
                if (s_a['min_inicio'] < s_b['min_fin']) and (s_b['min_inicio'] < s_a['min_fin']):
                    return True
    return False

def horario_es_valido(lista_cursos):
    """Revisa si una lista completa de cursos tiene choques internos"""
    for i in range(len(lista_cursos)):
        for j in range(i + 1, len(lista_cursos)):
            if hay_choque_entre_cursos(lista_cursos[i]['sesiones'], lista_cursos[j]['sesiones']):
                return False
    return True

# ==========================================
#       UTILIDADES VISUALES
# ==========================================

def limpiar_pantalla():
    os.system('cls' if os.name == 'nt' else 'clear')

def mostrar_encabezado(titulo):
    print("\n" + "="*60)
    print(f"   {titulo}")
    print("="*60)

# ==========================================
#       MODO 1: CONSTRUCTOR MANUAL
# ==========================================

def modo_manual():
    mi_horario = []
    inscritas = []
    
    while True:
        mostrar_encabezado(f"MODO MANUAL ({len(mi_horario)} materias)")
        if not mi_horario: print("   (Vacio)")
        else:
            for m in mi_horario: 
                print(f"[OK] {m['asignatura'][:30]:<30} | {m['profesor'][:20]}")

        print("\nACCIONES:")
        print("1. [AGREGAR] Ver Catalogo y Agregar")
        print("2. [BORRAR]  Quitar Ultima Materia")
        print("3. [GUARDAR] Guardar en TXT y Salir")
        print("4. [VOLVER]  Regresar al Menu Principal")
        op = input("\n> Elige opcion: ")

        if op == "1":
            # CATALOGO
            cat = obtener_catalogo()
            # Filtramos las ya inscritas
            dispo = [c for c in cat if c not in inscritas]
            
            if not dispo:
                print("[!] Ya inscribiste todo.")
                input("Enter...")
                continue

            print("\n--- MATERIAS DISPONIBLES ---")
            for i, m in enumerate(dispo): print(f"{i+1}. {m}")
            print("0. Cancelar")

            try:
                sel = int(input("\n> Numero de materia: "))
                if sel == 0: continue
                mat = dispo[sel-1]
            except: 
                print("Error de seleccion.")
                continue

            grupos = obtener_grupos(mat)
            # Ordenar por grupo
            lista_g = sorted(grupos.items(), key=lambda x: x[1][0]['grupo'])
            
            mapa = {}
            print(f"\n--- GRUPOS DE: {mat} ---")
            print(f"{'#':<3} {'GPO':<6} {'PROFESOR':<20} {'ESTADO':<10} {'HORARIO'}")
            print("-" * 70)
            
            idx = 1
            for cid, ses in lista_g:
                base = ses[0]
                choca = False
                for m_inscrita in mi_horario:
                    if hay_choque_entre_cursos(ses, m_inscrita['sesiones']):
                        choca = True; break
                
                estado = "[CHOQUE]" if choca else "[DISP]"
                hor = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in ses])
                print(f"{idx:<3} {base['grupo']:<6} {base['profesor'][:20]:<20} {estado:<10} {hor}")
                if not choca:
                    mapa[idx] = {'id': cid, 'asignatura': mat, 'grupo': base['grupo'], 'profesor': base['profesor'], 'sesiones': ses}
                idx += 1
            
            sel_g = input("\n> Elige # de grupo (o Enter para cancelar): ")
            if sel_g.isdigit() and int(sel_g) in mapa:
                mi_horario.append(mapa[int(sel_g)])
                inscritas.append(mat)
                print(f"*** Agregada: {mat} ***")
        
        elif op == "2" and mi_horario:
            r = mi_horario.pop()
            inscritas.remove(r['asignatura'])
            print("Borrado.")
        
        elif op == "3":
            guardar_txt(mi_horario, "Horario_Manual.txt")
            break
        elif op == "4": break

# ==========================================
#       MODO 2: EXPLORADOR (MEJORADO)
# ==========================================

def modo_explorador():
    # Estructura: Diccionario donde la llave es el nombre de la materia
    # y el valor es una lista de diccionarios (los cursos candidatos)
    # Ejemplo: { 'CLINICA': [Curso1, Curso2], 'NEURO': [CursoA] }
    seleccion_candidatos = {} 
    
    while True:
        # Calcular estadisticas
        total_materias = len(seleccion_candidatos)
        total_opciones = sum(len(v) for v in seleccion_candidatos.values())
        
        mostrar_encabezado(f"MODO EXPLORADOR (Bolsa: {total_materias} materias, {total_opciones} opciones)")
        
        if total_materias > 0:
            print("TUS MATERIAS EN LA BOLSA:")
            for i, (nombre_mat, opciones) in enumerate(seleccion_candidatos.items()):
                print(f" {i+1}. {nombre_mat} ({len(opciones)} profes seleccionados)")
        else:
            print(" (Bolsa vacia. Agrega materias para combinar)")

        print("\nACCIONES:")
        print("1. [AGREGAR/EDITAR] Seleccionar Materia y Profesores")
        print("2. [BORRAR]         Sacar una Materia de la bolsa")
        print("3. [GENERAR]        ¡Crear Combinaciones!")
        print("4. [SALIR]          Volver al menu principal")
        
        op = input("\n> Elige opcion: ")

        if op == "4": return
        
        if op == "2":
            if not seleccion_candidatos: continue
            print("\n--- QUE MATERIA QUIERES SACAR? ---")
            lista_nombres = list(seleccion_candidatos.keys())
            for i, n in enumerate(lista_nombres): print(f"{i+1}. {n}")
            try:
                elim = int(input("> Numero: ")) - 1
                del seleccion_candidatos[lista_nombres[elim]]
            except: pass
            continue

        if op == "3":
            procesar_combinaciones(seleccion_candidatos)
            input("\nPresiona Enter para volver al explorador...")
            continue
        
        if op == "1":
            # 1. MOSTRAR CATALOGO COMPLETO
            cat = obtener_catalogo()
            print("\n--- CATALOGO DE MATERIAS ---")
            for i, m in enumerate(cat):
                # Marcamos si ya tiene seleccion
                marca = "[YA EN BOLSA]" if m in seleccion_candidatos else ""
                print(f"{i+1}. {m} {marca}")
            print("0. Cancelar")

            try:
                sel = int(input("\n> Elige el numero de la materia: "))
                if sel == 0: continue
                mat_nom = cat[sel-1]
            except:
                print("Numero invalido.")
                continue

            # 2. MOSTRAR GRUPOS DE ESA MATERIA Y PERMITIR SELECCION MULTIPLE
            grupos = obtener_grupos(mat_nom)
            lista_g = sorted(grupos.items(), key=lambda x: x[1][0]['grupo'])
            
            # Recuperamos los que ya habia elegido antes (si existen)
            mis_candidatos = seleccion_candidatos.get(mat_nom, [])
            
            while True:
                print(f"\n--- SELECCIONANDO PROFES PARA: {mat_nom} ---")
                print("Marca con el numero los grupos que te interesan.")
                print("Cuando termines, escribe '0' o 'OK'.")
                
                print(f"\n{'#':<3} {'SEL':<5} {'GPO':<6} {'PROFESOR':<25} {'HORARIO'}")
                print("-" * 75)
                
                mapa_local = {}
                idx = 1
                for cid, ses in lista_g:
                    base = ses[0]
                    # Ver si este ID ya esta en mis candidatos
                    esta_seleccionado = any(c['id'] == cid for c in mis_candidatos)
                    marca = "[X]" if esta_seleccionado else "[ ]"
                    
                    hor = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in ses])
                    
                    print(f"{idx:<3} {marca:<5} {base['grupo']:<6} {base['profesor'][:25]:<25} {hor}")
                    
                    mapa_local[idx] = {'id': cid, 'asignatura': mat_nom, 'grupo': base['grupo'], 'profesor': base['profesor'], 'sesiones': ses}
                    idx += 1
                
                sel_c = input("\n> Numero para marcar/desmarcar (0 para terminar): ").upper()
                
                if sel_c == "0" or sel_c == "OK":
                    # Guardamos cambios en la bolsa global
                    if mis_candidatos:
                        seleccion_candidatos[mat_nom] = mis_candidatos
                    else:
                        # Si dejo vacio, borramos la entrada si existia
                        if mat_nom in seleccion_candidatos:
                            del seleccion_candidatos[mat_nom]
                    break
                
                if sel_c.isdigit() and int(sel_c) in mapa_local:
                    target = mapa_local[int(sel_c)]
                    
                    # Logica de Toggle
                    encontrado_idx = -1
                    for k, c in enumerate(mis_candidatos):
                        if c['id'] == target['id']:
                            encontrado_idx = k
                            break
                    
                    if encontrado_idx != -1:
                        # Ya estaba, lo quitamos
                        mis_candidatos.pop(encontrado_idx)
                    else:
                        # No estaba, lo ponemos
                        mis_candidatos.append(target)

def procesar_combinaciones(diccionario_candidatos):
    if not diccionario_candidatos:
        print("La bolsa esta vacia.")
        return

    # Convertimos el diccionario { 'Mat1': [Op1, Op2], 'Mat2': [OpA] }
    # en una lista de listas [ [Op1, Op2], [OpA] ] para itertools
    listas_para_combinar = list(diccionario_candidatos.values())
    nombres = list(diccionario_candidatos.keys())
    
    print("\n" + "="*50)
    print("CALCULANDO...")
    
    todas = list(itertools.product(*listas_para_combinar))
    print(f"Combinaciones teoricas posibles: {len(todas)}")
    print("Filtrando choques de horario...")
    
    validos = []
    for comb in todas:
        if horario_es_valido(comb):
            validos.append(comb)
            if len(validos) >= 20: # Limite para no saturar
                print("--- Se alcanzo el limite de 20 resultados ---")
                break
    
    print(f"\nRESULTADO: {len(validos)} horarios sin choques.")
    
    if len(validos) > 0:
        for i, hor in enumerate(validos):
            print(f"\n--- OPCION {i+1} ---")
            for curso in hor:
                print(f"  * {curso['asignatura'][:20]} ({curso['grupo']}) - {curso['profesor'][:20]}")
        
        save = input("\n¿Guardar resultados en archivo? (S/N): ").upper()
        if save == "S":
            guardar_multiples_txt(validos)

# ==========================================
#       GUARDAR ARCHIVOS
# ==========================================

def guardar_txt(horario, nombre):
    path = os.path.join(DIRECTORIO_ACTUAL, nombre)
    with open(path, "w", encoding="utf-8") as f:
        f.write("HORARIO\n")
        for m in horario:
            f.write(f"{m['asignatura']} - {m['profesor']} ({m['grupo']})\n")
            for s in m['sesiones']: f.write(f"  {s['dia']} {s['hora_inicio']}-{s['hora_fin']}\n")
    print(f"Guardado en {path}")

def guardar_multiples_txt(lista_horarios):
    path = os.path.join(DIRECTORIO_ACTUAL, "Mis_Opciones_Explorador.txt")
    with open(path, "w", encoding="utf-8") as f:
        for i, h in enumerate(lista_horarios):
            f.write(f"\n=== OPCION {i+1} ===\n")
            for m in h:
                f.write(f"* {m['asignatura']} ({m['grupo']}) - {m['profesor']}\n")
                hor_str = " | ".join([f"{s['dia'][:3]} {s['hora_inicio']}" for s in m['sesiones']])
                f.write(f"  Horario: {hor_str}\n")
    print(f"Guardado en {path}")

# ==========================================
#       MENU PRINCIPAL
# ==========================================

if __name__ == "__main__":
    while True:
        mostrar_encabezado("GENERADOR DE HORARIOS UNAM")
        print("1. MODO MANUAL (Armar paso a paso)")
        print("2. MODO EXPLORADOR (Combinaciones multiples)")
        print("3. SALIR")
        
        op = input("\n> ")
        
        if op == "1": modo_manual()
        elif op == "2": modo_explorador()
        elif op == "3": 
            print("Bye!")
            conn.close()
            break