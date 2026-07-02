import pandas as pd
import re
import os

# --- CONFIGURACIÓN ---
archivo_entrada = "Horarios_6to_Final_Bien.csv"
archivo_salida = "Horarios_6to_SQL_Normalizado.csv"

print(f"--- Procesando {archivo_entrada} ---")

if not os.path.exists(archivo_entrada):
    print(f"[ERROR] No encuentro el archivo '{archivo_entrada}'")
    exit()

# 1. CARGA Y LIMPIEZA INICIAL
# Leemos sin header para evitar basura
df = pd.read_csv(archivo_entrada, header=None, dtype=str)

# Nombres base
nombres_base = [
    'clave', 'asignatura', 
    'raw_lunes', 'raw_martes', 'raw_miercoles', 'raw_jueves', 'raw_viernes', 'raw_sabado', 
    'profesor', 'observaciones', 'area'
]

# Ajuste de columnas dinámico
if len(df.columns) >= len(nombres_base):
    df.columns = nombres_base + [f"extra_{i}" for i in range(len(df.columns) - len(nombres_base))]
    df = df[nombres_base]
else:
    df.columns = nombres_base[:len(df.columns)]

# Extraer Grupo
df['grupo'] = None
mask_grupo = df['clave'].astype(str).str.contains('Grupo', case=False, na=False)
df.loc[mask_grupo, 'grupo'] = df.loc[mask_grupo, 'clave']
# Rellenar hacia abajo y extraer solo dígitos
df['grupo'] = df['grupo'].ffill().str.extract(r'(\d{4})')

# Filtrar filas válidas (materias reales)
df['clave_num'] = pd.to_numeric(df['clave'], errors='coerce')
df_clean = df.dropna(subset=['clave_num']).copy()
# Filtrar claves menores a 100 (basura de menús)
df_clean = df_clean[df_clean['clave_num'] > 100]

# Generar ID ÚNICO por materia (para agrupar horarios)
df_clean.reset_index(drop=True, inplace=True)
df_clean['id_curso'] = df_clean.index + 1

# 2. DESGLOSAR DÍAS (MELT / UNPIVOT)
dias_mapping = {
    'raw_lunes': 'LUNES',
    'raw_martes': 'MARTES',
    'raw_miercoles': 'MIERCOLES',
    'raw_jueves': 'JUEVES',
    'raw_viernes': 'VIERNES',
    'raw_sabado': 'SABADO'
}

df_long = df_clean.melt(
    id_vars=['id_curso', 'grupo', 'asignatura', 'profesor', 'area'], 
    value_vars=list(dias_mapping.keys()),
    var_name='dia_raw', 
    value_name='info_horario'
)

df_long['dia'] = df_long['dia_raw'].map(dias_mapping)
# Eliminar días sin clase
df_long = df_long.dropna(subset=['info_horario'])
df_long = df_long[df_long['info_horario'].str.strip() != '']

# 3. SEPARAR HORA Y SALÓN
# Regex: HoraInicio a HoraFin Resto
patron = r'(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*(.*)'
datos_extraidos = df_long['info_horario'].astype(str).str.extract(patron)

df_long['hora_inicio'] = datos_extraidos[0]
df_long['hora_fin'] = datos_extraidos[1]
df_long['salon'] = datos_extraidos[2].str.strip()

# --- 4. CONVERSIÓN A MINUTOS (VITAL PARA SQL) ---
def hora_a_minutos(hora_str):
    try:
        if pd.isna(hora_str) or ":" not in str(hora_str):
            return 0
        partes = str(hora_str).split(':')
        horas = int(partes[0])
        minutos = int(partes[1])
        return (horas * 60) + minutos
    except:
        return 0

df_long['min_inicio'] = df_long['hora_inicio'].apply(hora_a_minutos)
df_long['min_fin'] = df_long['hora_fin'].apply(hora_a_minutos)

# 5. LIMPIEZA FINAL DE TEXTO
cols_texto = ['asignatura', 'profesor', 'salon', 'area']
for col in cols_texto:
    df_long[col] = df_long[col].astype(str).str.replace(r'\n|\r', ' ', regex=True).str.strip()
    df_long[col] = df_long[col].replace({'nan': '', 'None': ''})

# 6. ORDENAR Y GUARDAR
columnas_finales = [
    'id_curso',
    'grupo',
    'asignatura',
    'profesor',
    'dia',
    'hora_inicio',
    'hora_fin',
    'min_inicio',  # <--- Entero para SQL
    'min_fin',     # <--- Entero para SQL
    'salon'
]

# Ordenar por ID y luego por Día
df_final = df_long[columnas_finales].sort_values(by=['id_curso', 'dia'])

df_final.to_csv(archivo_salida, index=False, encoding='utf-8')

print(f"[OK] LISTO! Archivo generado: {archivo_salida}")
print(f"Total de registros: {len(df_final)}")
print("\n--- EJEMPLO (Primeras 5 filas) ---")
print(df_final[['dia', 'hora_inicio', 'min_inicio', 'hora_fin', 'min_fin']].head())