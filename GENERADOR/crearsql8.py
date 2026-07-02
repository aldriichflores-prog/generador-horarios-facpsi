import pandas as pd
import re
import os
import unicodedata

# --- CONFIGURACIÓN ---
ARCHIVO_ENTRADA = "Horarios_8vo_Selenium.csv"
ARCHIVO_SALIDA = "Horarios_8vo_Final.csv"

print(f"--- CREANDO TABLA MAESTRA (FORMATO EXACTO) ---")

if not os.path.exists(ARCHIVO_ENTRADA):
    print(f"❌ ERROR: No encuentro el archivo '{ARCHIVO_ENTRADA}'")
    exit()

# --- FUNCIONES ---
def limpiar_texto(texto):
    if pd.isna(texto) or str(texto).lower() == "nan": return ""
    texto = str(texto)
    # Quitar acentos y normalizar
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('ASCII')
    return texto.strip().upper()

def hora_a_minutos(hora_str):
    try:
        if not hora_str or ":" not in str(hora_str): return 0
        h, m = map(int, str(hora_str).split(':'))
        return (h * 60) + m
    except:
        return 0

# 1. CARGAR CSV SUCIO
df = pd.read_csv(ARCHIVO_ENTRADA, header=None, dtype=str)
print(f"✅ Archivo cargado. Procesando {len(df)} filas...")

filas_limpias = []
grupo_actual = "SIN GRUPO"
id_contador = 1

# Mapeo de columnas del archivo de Selenium
# 2=Lunes, 3=Martes, 4=Miercoles, 5=Jueves, 6=Viernes, 7=Sabado
DIAS_COLUMNAS = {
    2: "LUNES",
    3: "MARTES",
    4: "MIERCOLES",
    5: "JUEVES",
    6: "VIERNES",
    7: "SABADO"
}

# 2. BARRIDO FILA POR FILA
for i, row in df.iterrows():
    celda_0 = str(row[0]).strip()
    
    # A) DETECTAR GRUPO (Encabezado)
    if "Grupo" in celda_0:
        match = re.search(r"Grupo\s+(\d{4})", celda_0)
        if match:
            grupo_actual = match.group(1)
        continue 

    # B) DETECTAR MATERIA (Si empieza con número de clave)
    # Aunque NO guardamos la clave, la usamos para saber que esta fila es válida
    if celda_0.isdigit() and len(celda_0) >= 3:
        
        asignatura = limpiar_texto(row[1])
        profesor = limpiar_texto(row[8]) # Columna 8 es el profesor
        
        # Filtro anti-basura
        if "ASIGNATURA" in asignatura: continue

        # C) EXTRAER HORARIOS DE CADA DÍA
        horario_encontrado = False
        
        for col_idx, nombre_dia in DIAS_COLUMNAS.items():
            contenido = str(row[col_idx])
            
            # Regex busca: "08:00 a 10:00 Salon..."
            match_horario = re.search(r"(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})\s*(.*)", contenido, re.IGNORECASE)
            
            if match_horario:
                inicio = match_horario.group(1)
                fin = match_horario.group(2)
                salon = limpiar_texto(match_horario.group(3))
                
                # Formato bonito (08:00)
                if len(inicio) == 4: inicio = "0" + inicio
                if len(fin) == 4: fin = "0" + fin

                # AGREGAMOS LA FILA CON EL ORDEN EXACTO QUE PEDISTE
                filas_limpias.append({
                    "id_curso": id_contador,
                    "grupo": grupo_actual,
                    "asignatura": asignatura,
                    "profesor": profesor,
                    "dia": nombre_dia,
                    "hora_inicio": inicio,
                    "hora_fin": fin,
                    "min_inicio": hora_a_minutos(inicio),
                    "min_fin": hora_a_minutos(fin),
                    "salon": salon
                })
                horario_encontrado = True
        
        # Si no tiene horario (materias en línea o por asignar), lo agregamos vacío
        if not horario_encontrado:
             filas_limpias.append({
                "id_curso": id_contador,
                "grupo": grupo_actual,
                "asignatura": asignatura,
                "profesor": profesor,
                "dia": "POR ASIGNAR",
                "hora_inicio": "00:00",
                "hora_fin": "00:00",
                "min_inicio": 0,
                "min_fin": 0,
                "salon": "SIN SALON"
            })
            
        id_contador += 1

# 3. GUARDAR EL CSV FINAL
if filas_limpias:
    df_final = pd.DataFrame(filas_limpias)
    
    # Aseguramos el orden de columnas exacto
    columnas_ordenadas = [
        "id_curso", "grupo", "asignatura", "profesor", 
        "dia", "hora_inicio", "hora_fin", 
        "min_inicio", "min_fin", "salon"
    ]
    df_final = df_final[columnas_ordenadas]
    
    df_final.to_csv(ARCHIVO_SALIDA, index=False, encoding='utf-8')
    
    print("\n" + "="*40)
    print(f"🏆 ¡LISTO! Archivo generado: {ARCHIVO_SALIDA}")
    print(f"📊 Registros generados: {len(df_final)}")
    print("="*40)
    print("Primeras filas de ejemplo:")
    print(df_final.head(3).to_string(index=False))
else:
    print("❌ ALERTA: No se generaron datos. Revisa que el archivo de entrada tenga datos.")