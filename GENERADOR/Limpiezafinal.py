import pandas as pd
import re
import os
import unicodedata

# --- CONFIGURACIÓN ---
archivo_entrada = "Horarios_Impares_Terminado.csv"
archivo_salida = "Horarios_Impares_Estructurado.csv"

print(f"--- Procesando {archivo_entrada} ---")

if not os.path.exists(archivo_entrada):
    print(f"[ERROR] No encuentro el archivo '{archivo_entrada}'")
    exit()

# --- FUNCIONES ---
def limpiar_texto(texto):
    if not isinstance(texto, str):
        return ""
    # Reemplazos específicos
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
    }
    for original, nuevo in reemplazos.items():
        texto = texto.replace(original, nuevo)
    # Normalización Unicode
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')
    # Limpieza final
    return texto.replace('\n', ' ').replace('\r', '').strip().upper()

def hora_a_minutos(hora_str):
    try:
        if pd.isna(hora_str) or ":" not in str(hora_str):
            return 0
        partes = str(hora_str).split(':')
        return (int(partes[0]) * 60) + int(partes[1])
    except:
        return 0

# 1. CARGA
df = pd.read_csv(archivo_entrada, header=None, dtype=str)

# Nombres base
nombres_base = [
    'clave', 'asignatura', 
    'raw_lunes', 'raw_martes', 'raw_miercoles', 'raw_jueves', 'raw_viernes', 'raw_sabado', 
    'profesor', 'observaciones', 'semestre', 'area'
]

if len(df.columns) >= len(nombres_base):
    df.columns = nombres_base + [f"extra_{i}" for i in range(len(df.columns) - len(nombres_base))]
    df = df[nombres_base]
else:
    df.columns = nombres_base[:len(df.columns)]

# 2. LIMPIEZA INICIAL
# Extraer Grupo
df['grupo'] = None
mask_grupo = df['clave'].astype(str).str.contains('Grupo', case=False, na=False)
df.loc[mask_grupo, 'grupo'] = df.loc[mask_grupo, 'clave']
df['grupo'] = df['grupo'].ffill().str.extract(r'(\d{4})')

# Filtrar materias válidas
df['clave_num'] = pd.to_numeric(df['clave'], errors='coerce')
df_clean = df.dropna(subset=['clave_num']).copy()
df_clean = df_clean[df_clean['clave_num'] > 100]

# ID ÚNICO por materia
df_clean.reset_index(drop=True, inplace=True)
df_clean['id_curso'] = df_clean.index + 1

# 3. DESGLOSAR DÍAS
dias_mapping = {
    'raw_lunes': 'LUNES', 'raw_martes': 'MARTES', 'raw_miercoles': 'MIERCOLES',
    'raw_jueves': 'JUEVES', 'raw_viernes': 'VIERNES', 'raw_sabado': 'SABADO'
}

df_long = df_clean.melt(
    id_vars=['id_curso', 'grupo', 'asignatura', 'profesor', 'semestre', 'area'], 
    value_vars=list(dias_mapping.keys()),
    var_name='dia_raw', value_name='info_horario'
)

df_long['dia'] = df_long['dia_raw'].map(dias_mapping)
df_long = df_long.dropna(subset=['info_horario'])
df_long = df_long[df_long['info_horario'].str.strip() != '']

# 4. SEPARAR HORA Y SALÓN
patron = r'(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*(.*)'
datos_extraidos = df_long['info_horario'].astype(str).str.extract(patron)
df_long['hora_inicio'] = datos_extraidos[0]
df_long['hora_fin'] = datos_extraidos[1]
df_long['salon'] = datos_extraidos[2].str.strip()

# 5. LIMPIEZA DE TEXTO (INCLUYENDO ÁREA)
cols_texto = ['asignatura', 'profesor', 'salon', 'semestre', 'area']
for col in cols_texto:
    df_long[col] = df_long[col].apply(limpiar_texto)

# 6. MINUTOS
df_long['min_inicio'] = df_long['hora_inicio'].apply(hora_a_minutos)
df_long['min_fin'] = df_long['hora_fin'].apply(hora_a_minutos)

# 7. GUARDAR CON ÁREA
columnas_finales = [
    'id_curso',
    'semestre',
    'area',       # <--- ¡AQUÍ ESTÁ LA NUEVA COLUMNA!
    'grupo',
    'asignatura',
    'profesor',
    'dia',
    'hora_inicio',
    'hora_fin',
    'min_inicio',
    'min_fin',
    'salon'
]

df_final = df_long[columnas_finales].sort_values(by=['id_curso', 'dia'])
df_final.to_csv(archivo_salida, index=False, encoding='utf-8')

print(f"[OK] Archivo generado: {archivo_salida}")
print(f"Total registros: {len(df_final)}")
print("\n--- EJEMPLO ---")
print(df_final[['id_curso', 'semestre', 'area', 'asignatura']].head(3))