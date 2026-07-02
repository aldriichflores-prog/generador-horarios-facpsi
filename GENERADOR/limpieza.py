import pandas as pd
import re
import os

# --- CONFIGURACIÓN ---
archivo_entrada = "Horarios_6to_Final_Bien.csv"
archivo_salida = "Horarios_6to_SQL_Normalizado.csv"

print(f"--- Procesando {archivo_entrada} ---")

if not os.path.exists(archivo_entrada):
    print(f" ERROR: No encuentro el archivo '{archivo_entrada}'")
    exit()

# 1. CARGA Y LIMPIEZA INICIAL
df = pd.read_csv(archivo_entrada, header=None, dtype=str)

# Nombres base de las columnas del archivo crudo
nombres_base = [
    'clave', 'asignatura', 
    'raw_lunes', 'raw_martes', 'raw_miercoles', 'raw_jueves', 'raw_viernes', 'raw_sabado', 
    'profesor', 'observaciones', 'area'
]

# Ajuste de columnas
if len(df.columns) >= len(nombres_base):
    df.columns = nombres_base + [f"extra_{i}" for i in range(len(df.columns) - len(nombres_base))]
    df = df[nombres_base]
else:
    df.columns = nombres_base[:len(df.columns)]

# Extraer Grupo y propagar hacia abajo
df['grupo'] = None
mask_grupo = df['clave'].astype(str).str.contains('Grupo', case=False, na=False)
df.loc[mask_grupo, 'grupo'] = df.loc[mask_grupo, 'clave']
df['grupo'] = df['grupo'].ffill().str.extract(r'(\d{4})')

# Filtrar solo filas válidas (materias reales)
df['clave_num'] = pd.to_numeric(df['clave'], errors='coerce')
df_clean = df.dropna(subset=['clave_num']).copy()
df_clean = df_clean[df_clean['clave_num'] > 100]

# --- AQUÍ ESTÁ EL CAMBIO CLAVE ---
# Generamos el ID ÚNICO por materia ANTES de separar los días.
# Así, si la materia se imparte 3 días, los 3 renglones tendrán el mismo ID.
df_clean.reset_index(drop=True, inplace=True)
df_clean['id_curso'] = df_clean.index + 1

# 2. DESGLOSAR DÍAS (UNPIVOT / MELT)
dias_mapping = {
    'raw_lunes': 'LUNES',
    'raw_martes': 'MARTES',
    'raw_miercoles': 'MIERCOLES',
    'raw_jueves': 'JUEVES',
    'raw_viernes': 'VIERNES',
    'raw_sabado': 'SABADO'
}

df_long = df_clean.melt(
    id_vars=['id_curso', 'grupo', 'asignatura', 'profesor', 'area'], # Mantenemos el ID aquí
    value_vars=list(dias_mapping.keys()),
    var_name='dia_raw', 
    value_name='info_horario'
)

# Mapear nombres de días
df_long['dia'] = df_long['dia_raw'].map(dias_mapping)

# Eliminar filas vacías (días que no hay clase)
df_long = df_long.dropna(subset=['info_horario'])
df_long = df_long[df_long['info_horario'].str.strip() != '']

# 3. SEPARAR HORA Y SALÓN
# Regex para capturar: (HoraInicio) a (HoraFin) (Resto es Salón)
# Soporta formatos: "08:00 a 10:00 A 101" o "8:00 a 10:00 Lab 2"
patron = r'(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*(.*)'
datos_extraidos = df_long['info_horario'].astype(str).str.extract(patron)

df_long['hora_inicio'] = datos_extraidos[0]
df_long['hora_fin'] = datos_extraidos[1]
df_long['salon'] = datos_extraidos[2].str.strip() # El resto se va a la columna salón

# 4. LIMPIEZA FINAL DE TEXTO
cols_texto = ['asignatura', 'profesor', 'salon', 'area']
for col in cols_texto:
    df_long[col] = df_long[col].astype(str).str.replace(r'\n|\r', ' ', regex=True).str.strip()
    df_long[col] = df_long[col].replace({'nan': '', 'None': ''})

# 5. ORDENAR COLUMNAS PARA SQL
columnas_finales = [
    'id_curso',      # ID Repetido si es la misma materia
    'grupo',
    'asignatura',
    'profesor',
    'dia',
    'hora_inicio',
    'hora_fin',
    'salon'
]

# Ordenamos por ID para que veas los días juntos
df_final = df_long[columnas_finales].sort_values(by=['id_curso', 'dia'])

# 6. GUARDAR
df_final.to_csv(archivo_salida, index=False, encoding='utf-8')

print(f" ¡LISTO! Archivo generado: {archivo_salida}")
print(f"Total de registros generados: {len(df_final)}")
print("\n--- EJEMPLO DE RESULTADO (Mira los IDs repetidos) ---")
# Mostramos las primeras filas donde el ID se repita para que verifiques
ids_repetidos = df_final[df_final.duplicated(subset=['id_curso'], keep=False)]
if not ids_repetidos.empty:
    print(ids_repetidos.head(6).to_string(index=False))
else:
    print(df_final.head().to_string(index=False))