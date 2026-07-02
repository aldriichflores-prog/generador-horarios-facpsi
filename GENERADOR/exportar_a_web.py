import sqlite3
import pandas as pd
import json
import os

# CONFIGURACIÓN
DIRECTORIO_ACTUAL = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(DIRECTORIO_ACTUAL, "horarios_unam.db")

conn = sqlite3.connect(DB_NAME)

# 1. OBTENER TODO
query = """
SELECT id_curso, asignatura, grupo, profesor, creditos, 
       dia, hora_inicio, hora_fin, min_inicio, min_fin, salon 
FROM horarios
"""
df = pd.read_sql_query(query, conn)

# 2. ESTRUCTURAR PARA LA WEB (Agrupar por Curso)
# Queremos: { "CLINICA": [ {grupo: 1101, sesiones: [...]}, ... ] }

estructura_web = {}

# Agrupamos por ID de curso primero
cursos_temp = {}
for _, row in df.iterrows():
    cid = row['id_curso']
    if cid not in cursos_temp:
        cursos_temp[cid] = {
            "id": cid,
            "asignatura": row['asignatura'],
            "grupo": row['grupo'],
            "profesor": row['profesor'],
            "creditos": row['creditos'],
            "sesiones": []
        }
    
    # Agregamos la sesión
    cursos_temp[cid]["sesiones"].append({
        "dia": row['dia'],
        "inicio": row['hora_inicio'],
        "fin": row['hora_fin'],
        "min_inicio": row['min_inicio'],
        "min_fin": row['min_fin'],
        "salon": row['salon']
    })

# Ahora re-organizamos por Asignatura para que sea fácil buscar en JS
lista_final = []
for curso in cursos_temp.values():
    lista_final.append(curso)

# 3. GUARDAR JSON
archivo_salida = "horarios.json"
with open(archivo_salida, "w", encoding="utf-8") as f:
    json.dump(lista_final, f, ensure_ascii=False, indent=1)

print(f"✅ ¡Listo! Datos exportados a '{archivo_salida}'.")
conn.close()