import pandas as pd
import json
import unicodedata
import os

# --- CONFIGURACIÓN ---
# Buscar el archivo tanto si se ejecuta desde GENERADOR FINAL como desde GENERADOR
archivo_entrada = "Horarios_Impares_Terminado.csv"
if not os.path.exists(archivo_entrada):
    archivo_entrada = "../Horarios_Impares_Terminado.csv"

# El archivo JSON de salida se guardará en la carpeta principal
archivo_salida = "Horarios_Impares_Completo_UNAM.json"
if os.path.basename(os.getcwd()) == "GENERADOR":
    archivo_salida = "../Horarios_Impares_Completo_UNAM.json"

# Mapa de créditos por Clave (Es más seguro que por nombre)
mapa_creditos = {
    # 1º Semestre
    1100: 6, 1101: 6, 1102: 4, 1103: 6, 1104: 7, 1105: 6,
    # 3º Semestre
    1300: 7, 1301: 6, 1302: 6, 1303: 8, 1304: 8, 1305: 3, 1306: 4,
    # 5º Semestre
    1500: 4, 1510: 6, 1511: 6, 1512: 6, 1513: 6, 1514: 12,
    1515: 8, 1516: 6, 1517: 6, 1518: 10, 1519: 4, 1520: 4,
    1521: 9, 1522: 6, 1523: 8, 1524: 6, 1525: 8, 1526: 6,
    1527: 15, 1528: 6, 1529: 6, 1530: 6, 1531: 6, 1532: 4,
    1533: 6, 1534: 4, 1535: 6,
    # 7º Semestre
    1700: 4, 1710: 6, 1711: 6, 1712: 6, 1713: 6, 1714: 14,
    1715: 8, 1716: 6, 1717: 6, 1718: 10, 1719: 9, 1720: 9,
    1721: 6, 1722: 6, 1723: 8, 1724: 8, 1725: 8, 1726: 6,
    1727: 6, 1728: 15, 1729: 6, 1730: 6, 1731: 4, 1732: 4,
    1733: 6, 1734: 6, 1735: 6, 1736: 6
}

def limpiar_texto(texto):
    if not isinstance(texto, str): return ""
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
    }
    for orig, nuev in reemplazos.items():
        texto = texto.replace(orig, nuev)
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')
    return texto.replace('\n', ' ').replace('\r', '').strip().upper()

def hora_a_minutos(hora_str):
    try:
        if pd.isna(hora_str) or ":" not in str(hora_str): return 0
        p = str(hora_str).split(':')
        return (int(p[0]) * 60) + int(p[1])
    except:
        return 0

print(f"--- Iniciando generación de JSON Integrado ---")
if not os.path.exists(archivo_entrada):
    print(f"[ERROR] No se pudo encontrar {archivo_entrada}. Asegúrate de tener el archivo Terminado.csv")
    exit()

# 1. Cargar CSV
df = pd.read_csv(archivo_entrada, header=None, dtype=str)

# Los nombres extraídos por el scraper
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

# 2. Asignar grupos usando las filas que dicen "Grupo XXXX"
df['grupo'] = None
mask_grupo = df['clave'].astype(str).str.contains('Grupo', case=False, na=False)
df.loc[mask_grupo, 'grupo'] = df.loc[mask_grupo, 'clave']
df['grupo'] = df['grupo'].ffill().str.extract(r'(\d{4})')

# Filtrar materias válidas (solo números mayores a 100 en la clave)
df['clave_num'] = pd.to_numeric(df['clave'], errors='coerce')
df_clean = df.dropna(subset=['clave_num']).copy()
df_clean = df_clean[df_clean['clave_num'] > 100]

df_clean.reset_index(drop=True, inplace=True)
df_clean['id_curso'] = df_clean.index + 1

# 3. Separar por día
dias_mapping = {
    'raw_lunes': 'LUNES', 'raw_martes': 'MARTES', 'raw_miercoles': 'MIERCOLES',
    'raw_jueves': 'JUEVES', 'raw_viernes': 'VIERNES', 'raw_sabado': 'SABADO'
}

df_long = df_clean.melt(
    id_vars=['id_curso', 'clave', 'grupo', 'asignatura', 'profesor', 'observaciones', 'semestre', 'area'], 
    value_vars=list(dias_mapping.keys()),
    var_name='dia_raw', value_name='info_horario'
)

df_long['dia'] = df_long['dia_raw'].map(dias_mapping)
df_long = df_long.dropna(subset=['info_horario'])
df_long = df_long[df_long['info_horario'].str.strip() != '']

# 4. Separar hora y salón
patron = r'(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*(.*)'
datos_extraidos = df_long['info_horario'].astype(str).str.extract(patron)
df_long['hora_inicio'] = datos_extraidos[0]
df_long['hora_fin'] = datos_extraidos[1]
df_long['salon'] = datos_extraidos[2].str.strip()

# 5. Limpieza de Texto y Conversión Numérica
cols_texto = ['asignatura', 'profesor', 'salon', 'area', 'observaciones']
for col in cols_texto:
    df_long[col] = df_long[col].apply(limpiar_texto)

df_long['semestre_num'] = df_long['semestre'].astype(str).str.extract(r'(\d+)').fillna(0).astype(int)

# 6. Minutos
df_long['min_inicio'] = df_long['hora_inicio'].apply(hora_a_minutos)
df_long['min_fin'] = df_long['hora_fin'].apply(hora_a_minutos)

# 7. Asignar Créditos usando el mapa
df_long['creditos'] = df_long['clave'].astype(int).map(mapa_creditos).fillna(6).astype(int)

# 8. Ordenar y crear JSON final
df_final = df_long.sort_values(by=['id_curso', 'dia']).reset_index(drop=True)
df_final['id_unico'] = df_final.index + 1

# Construir la estructura exacta para la web
json_list = []
for idx, row in df_final.iterrows():
    json_list.append({
        "id_unico": int(row['id_unico']),
        "semestre": int(row['semestre_num']),
        "id_curso": int(row['id_curso']),
        "area": str(row['area']),
        "grupo": int(row['grupo']) if pd.notna(row['grupo']) else 0,
        "asignatura": str(row['asignatura']),
        "creditos": int(row['creditos']),
        "profesor": str(row['profesor']),
        "observaciones": str(row['observaciones']),
        "dia": str(row['dia']),
        "hora_inicio": str(row['hora_inicio']),
        "hora_fin": str(row['hora_fin']),
        "min_inicio": int(row['min_inicio']),
        "min_fin": int(row['min_fin']),
        "salon": str(row['salon']),
        "clave": int(row['clave']) if pd.notna(row['clave']) else 0
    })

# Guardar
with open(archivo_salida, 'w', encoding='utf-8') as f:
    json.dump(json_list, f, ensure_ascii=False, indent=4)

print(f"✅ ¡ÉXITO! Se generó el archivo {archivo_salida} con {len(json_list)} sesiones registradas.")
print("El archivo está listo para usarse directamente en la aplicación web.")
