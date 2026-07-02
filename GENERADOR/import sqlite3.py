import sqlite3
import pandas as pd 
import os

# --- CONFIGURACION A PRUEBA DE ERRORES ---
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(DIRECTORIO_ACTUAL, "horarios_unam.db")

if not os.path.exists(DB_NAME):
    print(f"[ERROR] No se encuentra la base de datos en:")
    print(f"   {DB_NAME}")
    exit()

conn = sqlite3.connect(DB_NAME)

# --- 1. CONSULTAS DE DATOS ---

def obtener_catalogo_completo():
    """Trae TODAS las asignaturas unicas ordenadas alfabeticamente"""
    query = "SELECT DISTINCT asignatura FROM horarios ORDER BY asignatura"
    df = pd.read_sql_query(query, conn)
    return df['asignatura'].tolist()

def obtener_grupos_detallados(nombre_asignatura):
    """Trae los grupos de una materia"""
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

# --- 2. DETECTOR DE CHOQUES (CORREGIDO) ---

def hay_conflicto(clases_candidatas, horario_actual):
    for materia_inscrita in horario_actual:
        for sesion_existente in materia_inscrita['sesiones']:
            for sesion_nueva in clases_candidatas:
                
                # Mismo dia y se cruzan las horas?
                if sesion_existente['dia'] == sesion_nueva['dia']:
                    ini_a, fin_a = sesion_existente['min_inicio'], sesion_existente['min_fin']
                    ini_b, fin_b = sesion_nueva['min_inicio'], sesion_nueva['min_fin']
                    
                    # --- AQUÍ ESTABA EL ERROR (CORREGIDO) ---
                    # Usamos ini_b en lugar de inicio_b
                    if (ini_a < fin_b) and (ini_b < fin_a):
                        return True 
    return False

# --- 3. INTERFAZ ---

def mostrar_horario_actual(mi_horario):
    print("\n" + "="*60)
    print(f" TU HORARIO ACTUAL ({len(mi_horario)} materias)")
    print("="*60)
    
    if not mi_horario:
        print("   (Vacio - Agrega materias con la opcion 1)")
    else:
        for m in mi_horario:
            asig = m['asignatura'][:35] # Cortar nombre si es largo
            prof = m['profesor'][:20]
            print(f"[OK] {asig:<35} | Gpo: {m['grupo']} | {prof}")

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
        print(f"\n[ERROR] No se pudo guardar: {e}")

def iniciar_programa():
    mi_horario = []      
    nombres_inscritos = [] 

    while True:
        mostrar_horario_actual(mi_horario)
        
        print("\nMENU PRINCIPAL:")
        print("1. [VER CATALOGO] Agregar Materia")
        print("2. [BORRAR]       Quitar una Materia")
        print("3. [GUARDAR]      Terminar y Guardar en TXT")
        print("4. [SALIR]        Cerrar programa")
        
        opcion = input("\n> Elige una opcion: ")

        # --- OPCION 1: AGREGAR DESDE CATALOGO ---
        if opcion == "1":
            print("\n--- CARGANDO CATALOGO DE MATERIAS... ---")
            catalogo = obtener_catalogo_completo()
            
            # Filtramos las que ya inscribiste para no repetir
            disponibles = [m for m in catalogo if m not in nombres_inscritos]

            if not disponibles:
                print("[!] Ya inscribiste absolutamente todas las materias disponibles.")
                continue

            # MOSTRAR LISTA NUMERADA
            for i, materia in enumerate(disponibles):
                # i+1 para que la lista empiece en 1, no en 0
                print(f"{i+1}. {materia}")
            print("0. Regresar al menu anterior")

            try:
                seleccion = int(input("\n> Escribe el numero de la materia que quieres: "))
                if seleccion == 0: continue
                
                # Ajustamos indice (restamos 1 porque las listas empiezan en 0)
                if 1 <= seleccion <= len(disponibles):
                    materia_elegida = disponibles[seleccion-1]
                else:
                    print("[!] Numero fuera de rango.")
                    input("Enter para continuar...")
                    continue
            except:
                print("[!] Debes escribir un numero.")
                input("Enter para continuar...")
                continue

            # --- AQUI SIGUE IGUAL: MOSTRAR GRUPOS ---
            print(f"\nCargando grupos para: {materia_elegida}...")
            grupos_dict = obtener_grupos_detallados(materia_elegida)
            
            opciones_validas = {}
            idx = 1
            
            print("\n" + "-"*78)
            print(f"{'#':<3} {'GRUPO':<6} {'PROFESOR':<25} {'ESTADO':<8} {'HORARIO'}")
            print("-"*(78))
            
            items_ordenados = sorted(grupos_dict.items(), key=lambda x: x[1][0]['grupo'])

            for id_curso, sesiones in items_ordenados:
                info_base = sesiones[0]
                gpo = info_base['grupo']
                prof = info_base['profesor'][:24]
                
                choca = hay_conflicto(sesiones, mi_horario)
                estado = "[CHOQUE]" if choca else "[DISP]"
                
                horario_str = ", ".join([f"{s['dia'][:3]} {s['hora_inicio']}-{s['hora_fin']}" for s in sesiones])
                
                print(f"{idx:<3} {gpo:<6} {prof:<25} {estado:<8} {horario_str}")
                
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
            sel_gpo = input("\n> Elige el numero (#) del grupo (o Enter para cancelar): ")
            
            if sel_gpo.isdigit():
                sel_gpo = int(sel_gpo)
                if sel_gpo in opciones_validas:
                    seleccion = opciones_validas[sel_gpo]
                    mi_horario.append(seleccion)
                    nombres_inscritos.append(materia_elegida)
                    print(f"\n*** Agregada: {materia_elegida} (Gpo {seleccion['grupo']}) ***")
                else:
                    print("\n[!] Numero no valido o tiene choque.")
            else:
                print("Operacion cancelada.")
            input("Enter para continuar...")

        # --- OPCION 2: BORRAR ---
        elif opcion == "2":
            if not mi_horario:
                print("No hay nada que borrar.")
            else:
                print("\n--- TUS MATERIAS ---")
                for i, m in enumerate(mi_horario):
                    print(f"{i+1}. {m['asignatura']}")
                
                try:
                    eliminar = int(input("\n> Numero a borrar: ")) - 1
                    if 0 <= eliminar < len(mi_horario):
                        borrada = mi_horario.pop(eliminar)
                        nombres_inscritos.remove(borrada['asignatura'])
                        print(f"Eliminada: {borrada['asignatura']}")
                    else:
                        print("Numero incorrecto.")
                except:
                    print("Error.")
            input("Enter para continuar...")

        elif opcion == "3":
            guardar_en_txt(mi_horario)
            break
            
        elif opcion == "4":
            print("Adios!")
            break

if __name__ == "__main__":
    try:
        iniciar_programa()
    except KeyboardInterrupt:
        print("\nInterrumpido.")
    finally:
        conn.close()