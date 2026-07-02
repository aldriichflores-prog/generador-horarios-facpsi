import sqlite3
import pandas as pd

# Configuración
db_path = "horarios_unam.db"
conn = sqlite3.connect(db_path)

# Simulamos que el usuario quiere estas 2 materias
materias_deseadas = [
    "PSICODIAGNOSTICO II",
    "TEORIA Y TECNICA DE LA ENTREVIS. II"
]

print(f"--- Buscando combinaciones para: {materias_deseadas} ---")

# 1. FUNCIÓN PARA TRAER LOS GRUPOS DE UNA MATERIA
def obtener_cursos_de_materia(nombre_asignatura):
    # Buscamos por nombre (usamos LIKE por si hay espacios extra)
    query = """
    SELECT id_curso, grupo, profesor, dia, min_inicio, min_fin 
    FROM horarios 
    WHERE asignatura LIKE ?
    """
    df = pd.read_sql_query(query, conn, params=(f"%{nombre_asignatura}%",))
    
    # IMPORTANTE: Agrupar por ID_CURSO
    # Un curso tiene muchas clases (filas). Las guardamos en un diccionario.
    # Estructura: { 101: [Clase_Lunes, Clase_Jueves], 102: [...] }
    cursos_dict = {}
    
    for _, fila in df.iterrows():
        id_c = fila['id_curso']
        if id_c not in cursos_dict:
            cursos_dict[id_c] = []
        cursos_dict[id_c].append(fila)
        
    return cursos_dict

# 2. TRAEMOS LOS DATOS
opciones_materia_1 = obtener_cursos_de_materia(materias_deseadas[0])
opciones_materia_2 = obtener_cursos_de_materia(materias_deseadas[1])

print(f"-> {materias_deseadas[0]}: Encontré {len(opciones_materia_1)} grupos.")
print(f"-> {materias_deseadas[1]}: Encontré {len(opciones_materia_2)} grupos.")

# 3. FUNCIÓN DE CHOQUE (LA LÓGICA MAESTRA)
def hay_choque(curso_A_lista, curso_B_lista):
    # Comparamos cada clase del Curso A contra cada clase del Curso B
    for clase_a in curso_A_lista:
        for clase_b in curso_B_lista:
            # A. Primero: ¿Son el mismo día?
            if clase_a['dia'] == clase_b['dia']:
                # B. Segundo: ¿Se empalman las horas?
                # Fórmula de choque: (InicioA < FinB) Y (InicioB < FinA)
                inicio_a, fin_a = clase_a['min_inicio'], clase_a['min_fin']
                inicio_b, fin_b = clase_b['min_inicio'], clase_b['min_fin']
                
                if (inicio_a < fin_b) and (inicio_b < fin_a):
                    return True # ¡HAY CHOQUE!
    return False # Todo limpio

# 4. PROBAR COMBINACIONES (SIMPLIFICADO)
print("\n--- Probando primeras 5 combinaciones ---")
contador = 0
for id_1, horario_1 in opciones_materia_1.items():
    for id_2, horario_2 in opciones_materia_2.items():
        
        if not hay_choque(horario_1, horario_2):
            prof1 = horario_1[0]['profesor']
            prof2 = horario_2[0]['profesor']
            grp1 = horario_1[0]['grupo']
            grp2 = horario_2[0]['grupo']
            
            print(f"COMBINACIÓN VÁLIDA:")
            print(f"   1. {grp1} - {prof1}")
            print(f"   2. {grp2} - {prof2}")
            print("-" * 30)
            
            contador += 1
            if contador >= 5: break # Solo mostramos 5 para no llenar la pantalla
    if contador >= 5: break

conn.close()