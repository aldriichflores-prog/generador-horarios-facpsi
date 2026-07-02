import sqlite3
import pandas as pd
import os

# --- CONFIGURACIÓN A PRUEBA DE ERRORES ---
# Esto hace que Python busque el archivo .db en la misma carpeta que este script
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(DIRECTORIO_ACTUAL, "horarios_unam.db")

# Verificamos que exista la base de datos
if not os.path.exists(DB_NAME):
    print(f"[ERROR] No se encuentra la base de datos en:")
    print(f"   {DB_NAME}")
    print("   Asegurate de que el archivo .db este junto a este script.")
    exit()

conn = sqlite3.connect(DB_NAME)

# --- 1. LÓGICA DE BÚSQUEDA Y DATOS ---

def buscar_asignaturas(texto_busqueda):
    """Busca asignaturas que coincidan con el texto ingresado"""
    query = """
    SELECT DISTINCT asignatura 
    FROM horarios 
    WHERE asignatura LIKE ? 
    ORDER BY asignatura
    """
    param = f"%{texto_busqueda.upper()}%"
    df = pd.read_sql_query(query, conn, params=(param,))
    return df['asignatura'].tolist()

def obtener_grupos_detallados(nombre_asignatura):
    """
    Trae todos los grupos de una materia, organizados por ID de Curso.
    """
    query = """
    SELECT id_curso, grupo, profesor, dia, hora_inicio, hora_fin, min_inicio, min_fin, salon, area
    FROM horarios 
    WHERE asignatura = ?
    """
    df = pd.read_sql_query(query, conn, params=(nombre_asignatura,))
    
    cursos = {}
    for _, row in df.iterrows():
        cid = row['id_curso']
        if cid not in cursos:
            cursos[cid] = []
        cursos[cid].append(row)
    return cursos

# --- 2. DETECTOR DE CHOQUES ---

def hay_conflicto(clases_candidatas, horario_actual):
    """
    Retorna True si choca, False si esta libre.
    """
    for materia_inscrita in horario_actual:
        for sesion_existente in materia_inscrita['sesiones']:
            for sesion_nueva in clases_candidatas:
                
                # 1. Mismo dia?
                if sesion_existente['dia'] == sesion_nueva['dia']:
                    
                    # 2. Choque de horas?
                    inicio_a = sesion_existente['min_inicio']
                    fin_a = sesion_existente['min_fin']
                    
                    inicio_b = sesion_nueva['min_inicio']
                    fin_b = sesion_nueva['min_fin']
                    
                    # Logica de empalme
                    if (inicio_a < fin_b) and (inicio_b < fin_a):
                        return True 
                        
    return False

# --- 3. INTERFAZ DE USUARIO (CONSOLA) ---

def mostrar_horario_actual(mi_horario):
    print("\n" + "="*60)
    print(f" TU HORARIO ACTUAL ({len(mi_horario)} materias)")
    print("="*60)
    
    if not mi_horario:
        print("   (Vacio)")
    else:
        for m in mi_horario:
            # Recortamos textos largos para que quepan
            asig = m['asignatura'][:30]
            prof = m['profesor'][:20]
            print(f"[OK] {asig:<30} | Gpo: {m['grupo']} | {prof}")

def guardar_en_txt(mi_horario):
    nombre_archivo = os.path.join(DIRECTORIO_ACTUAL, "Mi_Horario_Final.txt")
    try:
        with open(nombre_archivo, "w", encoding="utf-8") as f:
            f.write("=== MI HORARIO OFICIAL ===\n\n")
            for m in mi_horario:
                f.write(f"MATERIA: {m['asignatura']}\n")
                f.write(f"GRUPO:   {m['grupo']}\n")
                f.write(f"PROFESOR:{m['profesor']}\n")
                f.write("HORARIOS:\n")
                for s in m['sesiones']:
                    f.write(f"   - {s['dia']} de {s['hora_inicio']} a {s['hora_fin']} ({s['salon']})\n")
                f.write("-" * 40 + "\n")
        print(f"\n[GUARDADO] Horario guardado en '{nombre_archivo}'!")
    except Exception as e:
        print(f"\n[ERROR] No se pudo guardar el archivo: {e}")

def iniciar_programa():
    mi_horario = []      
    nombres_inscritos = [] 

    while True:
        mostrar_horario_actual(mi_horario)
        
        print("\nQUE QUIERES HACER?")
        print("1. [BUSCAR] Agregar Materia")
        print("2. [BORRAR] Quitar una Materia")
        print("3. [GUARDAR] Terminar y Guardar")
        print("4. [SALIR]  Salir")
        
        opcion = input("\n> Elige una opcion: ")

        # --- OPCION 1: AGREGAR ---
        if opcion == "1":
            busqueda = input("\nEscribe nombre de materia (ej: CLINICA): ")
            resultados = buscar_asignaturas(busqueda)
            
            if not resultados:
                print("[!] No encontre nada con ese nombre.")
                input("Enter para continuar...")
                continue
            
            # Filtrar ya inscritas
            resultados = [r for r in resultados if r not in nombres_inscritos]
            
            if not resultados:
                print("[!] Ya inscribiste todas las materias de esa busqueda.")
                continue

            print("\n--- RESULTADOS ---")
            for i, nombre in enumerate(resultados):
                print(f"{i+1}. {nombre}")
            print("0. Cancelar")
            
            try:
                sel = int(input("\n> Selecciona el numero: "))
                if sel == 0: continue
                materia_elegida = resultados[sel-1]
            except:
                print("[ERROR] Opcion invalida.")
                continue

            # BUSCAR GRUPOS
            print(f"\nBuscando grupos para: {materia_elegida}...")
            grupos_dict = obtener_grupos_detallados(materia_elegida)
            
            opciones_validas = {}
            idx = 1
            
            print("\n" + "-"*78)
            print(f"{'#':<3} {'GRUPO':<6} {'PROFESOR':<25} {'ESTADO':<10} {'HORARIO'}")
            print("-"*(78))
            
            # Ordenar por numero de grupo
            items_ordenados = sorted(grupos_dict.items(), key=lambda x: x[1][0]['grupo'])

            for id_curso, sesiones in items_ordenados:
                info_base = sesiones[0]
                gpo = info_base['grupo']
                prof = info_base['profesor'][:24]
                
                # VERIFICAR CHOQUE
                choca = hay_conflicto(sesiones, mi_horario)
                
                estado = "[CHOQUE]" if choca else "[DISP]"
                
                horario_str = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}-{s['hora_fin']}" for s in sesiones])
                
                print(f"{idx:<3} {gpo:<6} {prof:<25} {estado:<10} {horario_str}")
                
                if not choca:
                    opciones_validas[idx] = {
                        'id_curso': id_curso,
                        'asignatura': materia_elegida,
                        'grupo': gpo,
                        'profesor': info_base['profesor'],
                        'sesiones': sesiones
                    }
                idx += 1
            
            print("-" * 78)
            sel_gpo = input("\n> Elige el numero (#) del grupo (o Enter para volver): ")
            
            if sel_gpo.isdigit():
                sel_gpo = int(sel_gpo)
                if sel_gpo in opciones_validas:
                    seleccion = opciones_validas[sel_gpo]
                    mi_horario.append(seleccion)
                    nombres_inscritos.append(materia_elegida)
                    print(f"\n*** Excelente! Agregaste el Grupo {seleccion['grupo']} ***")
                else:
                    print("\n[!] Ese numero no es valido o tiene choque.")
            input("Enter para continuar...")

        # --- OPCION 2: BORRAR ---
        elif opcion == "2":
            if not mi_horario:
                print("No tienes materias para borrar.")
            else:
                print("\n--- TUS MATERIAS ---")
                for i, m in enumerate(mi_horario):
                    print(f"{i+1}. {m['asignatura']}")
                
                try:
                    eliminar = int(input("\n> Cual quieres borrar? (Numero): ")) - 1
                    if 0 <= eliminar < len(mi_horario):
                        borrada = mi_horario.pop(eliminar)
                        nombres_inscritos.remove(borrada['asignatura'])
                        print(f"Eliminada: {borrada['asignatura']}")
                    else:
                        print("Numero incorrecto.")
                except:
                    print("Error.")
            input("Enter para continuar...")

        # --- OPCION 3: GUARDAR ---
        elif opcion == "3":
            guardar_en_txt(mi_horario)
            break
            
        # --- OPCION 4: SALIR ---
        elif opcion == "4":
            print("Bye!")
            break

if __name__ == "__main__":
    try:
        iniciar_programa()
    except KeyboardInterrupt:
        print("\nPrograma interrumpido. Adios.")
    finally:
        conn.close()