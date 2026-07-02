import pandas as pd
import os

# --- 1. CONFIGURACIÓN ---
# Ajusta la ruta si es necesario
CARPETA_BASE = r"C:\Users\aldri\OneDrive\Escritorio\GeneradorCodigos"
NOMBRE_ENTRADA = "Horarios_8vo_Estructurado.csv"
NOMBRE_SALIDA = "Horarios_8vo_Con_Creditos.csv"

# --- 2. EL MAPA MAESTRO (PRE-CARGADO) ---
# He puesto todas las materias de tu archivo aquí.
# ¡CAMBIA LOS 6 POR EL VALOR REAL (4, 8, 10, 12)!
MAPA_CREDITOS = {
    # --- CONDUCTUAL / COGNITIVO ---
    'MODELOS DE APRENDIZ,MOTIV.COGNIC.I': 6,
    'TALLER DE INVEST.DOCENCIA SUPERV. I': 10,
    'TEMAS SELEC.EN COMPORT.COGNIC. I': 6,
    'PRINC.Y TECNICS D CAMBIO DL COMPOR.': 6,
    'ESTRAT.D EVALUAC.Y CAMB.DEL COMP.I': 6,
    'TALLER DE PRACTICA SUPERVISADA I': 7, # ¿Es práctica? Verifica crédito
    'TEMAS SELEC.INTERV.CONDUCTL.I': 4,
    ''

    # --- SOCIAL / CONTEXTUAL ---
    'COMUNICACION Y CONSTRUC. DE SENTIDO': 6,
    'COMUNICACION Y PSICOLOGIA POLITICA': 12,
    'EL DELITO: UNA CONSTRUCCION SOCIAL': 11,
    'INTERVENCION PSICOSOCIAL COMUNIDAD': 10,
    'SEXUALIDAD HUMANA Y GENERO': 13,
    'SEMINARIO DE COMUNICACION': 6, # Seminarios suelen valer 4

    # --- EDUCATIVA ---
    'CONSTRUCC.DE CONOCIMIEN.ESCOLARES': 6,
    'DESARROLLO CURRICULAR': 6,
    'DISEO DE MODELOS Y ESTRAT.EDUCAT.': 6,
    'ENSEANZA DE LA PSICOLOGIA': 6,
    'FORMACION DE AGENTES EDUCATIVOS': 6,
    'INTEGRAC.EDUCATIV: ENFOQUES ACTUALS.': 6,
    'INTEGRACION I: ENFOQUE EDUCATIVO': 6,
    'INTERVEN.EN EDUCAC.EN LA DIVERSI. I': 15,
    'INTERVENC.EN PSICOLOGIA ESCOLAR I': 15,
    'MODELOS DE EVALUAC. PSICOPEDAGOGICA': 6,
    'MODELOS DE ORIENTACION PSICOEDUCAT.': 6,

    # --- ORGANIZACIONAL ---
    'CALIDAD,PRODUCTIV.Y COMPETITIVID.': 6,
    'CULTURA Y COMPORTAMIENTO ORGANIZAC.': 6,
    'DESARROLLO DE EQUIPOS DE TRABAJO': 6,
    'FORMACION DE DIRECTIVOS': 6,
    'IMPACTO PSICOSOCIAL DE LS EMPRESAS': 6,
    'PROCESOS DE MEJORA CONTINUA': 6,
    'PSICOLOG.DE LA SALUD EN ELTRABAJO':6,
    'INTRODUCCION A LA MERCADOTECNIA':6,
    'INVESTIGACION DE MERCADO':6,
    'METROLOGIA PSICOLOGICA': 6,


    # --- CLÍNICA / SALUD ---
    'PRINCIPIOS DEL COMPORTAM.ADICTIVO': 8,
    'TOPICOS SELECTOS EN ADICCIONES': 8,
    'INTERVENCION EN GRUPOS I':8,
    'ALTERN.TERAPEUT.EN NIOS Y ADOLESC.': 6,
    'INTERVENCION EN NIOS I': 8, # Posible práctica
    'PROMOC.Y EDUCACION PARA LA SALUD': 8,
    'PSICOGERONTOLOGIA': 6,
    'PSICOPATOLOGIA DE LA ADULTEZ': 6,
    'PSICOPATOLOGIA DEL DESARR.INFANTIL': 8,
    'SALUD COMUNITARIA Y EPIDEMIOLOGIA': 5,
    'TEMAS SELECT.EN PSICOL.DE LA SALUD': 8,
    'TEORIAS Y MODELOS DE PREVENCION I': 8,

    # --- NEURO / PSICOFISIOLOGÍA ---
    'GENETICA DE LA CONDUCTA': 6,
    'INTEROCEPCION Y CONDUCTA I': 6,
    'METODOS EN NEUROPSICOLOGIA': 6,
    'NEUROPSICOLOGIA BASICA': 6,
    'PROBLEMATIZACION EN PSICOFISIOLOG.': 6,
    'PSICOFISIOLOGIA CLINICA': 6,
    'SEMINARIO DE NEUROPSICOLOGIA': 6, # Seminario
    'SEMINARIO EN PSICOFISIOLOGIA': 6, # Seminario

    # ---- CONTEXTUAL ---
    'COMPRENSION DE LA REALIDAD SOC. III':4,
}

CREDITO_DEFAULT = 6

# -----------------------------------------------------------

archivo_entrada = os.path.join(CARPETA_BASE, NOMBRE_ENTRADA)
archivo_salida = os.path.join(CARPETA_BASE, NOMBRE_SALIDA)

print(f"--- INYECTANDO CRÉDITOS A CSV ---")

if not os.path.exists(archivo_entrada):
    print(f"ERROR: No encuentro '{NOMBRE_ENTRADA}' en {CARPETA_BASE}")
    exit()

# 1. CARGAR CSV
df = pd.read_csv(archivo_entrada)
print(f"Archivo cargado: {len(df)} registros.")

# 2. FUNCIÓN DE ASIGNACIÓN
def asignar_creditos(nombre_materia):
    # .get() busca la llave exacta, si no existe devuelve el default
    return MAPA_CREDITOS.get(str(nombre_materia).strip(), CREDITO_DEFAULT)

# 3. APLICAR MAGIA
print("Asignando créditos...")
df['creditos'] = df['asignatura'].apply(asignar_creditos)

# 4. REPORTE
con_default = df[df['creditos'] == CREDITO_DEFAULT]
print(f"   -> Materias procesadas: {len(df)}")
print(f"   -> Materias con créditos default ({CREDITO_DEFAULT}): {len(con_default)}")

# 5. REORDENAR Y GUARDAR
cols = [
    'id_curso', 'area', 'grupo', 'asignatura', 'creditos', # Créditos al inicio
    'profesor', 'dia', 'hora_inicio', 'hora_fin', 
    'min_inicio', 'min_fin', 'salon'
]

# Asegurar que existan las columnas
cols_finales = [c for c in cols if c in df.columns]
df_final = df[cols_finales]

df_final.to_csv(archivo_salida, index=False, encoding='utf-8-sig')

print("\n" + "="*50)
print(f"¡LISTO! Archivo generado:")
print(f"{archivo_salida}")
print("="*50)
print("¡Revisa los valores en el diccionario MAPA_CREDITOS antes de usar el archivo final!")