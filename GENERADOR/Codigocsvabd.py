import sqlite3
import pandas as pd
import os

# --- CONFIGURACIÓN ---
csv_entrada = "Horarios_Impares_Estructurado.csv"
nombre_db = "horarios_unam.db"  # Así se llamará tu base de datos

print(f"--- Convirtiendo {csv_entrada} a SQLite ---")

if not os.path.exists(csv_entrada):
    print(f" ERROR: No encuentro el archivo CSV: {csv_entrada}")
    exit()

# 1. CONECTAR (O CREAR) LA BASE DE DATOS
# Al hacer .connect, si el archivo no existe, Python lo crea automáticamente.
conn = sqlite3.connect(nombre_db)
cursor = conn.cursor()

# 2. LIMPIEZA PREVIA
# Borramos la tabla si ya existía para empezar de cero y no duplicar datos
cursor.execute("DROP TABLE IF EXISTS horarios")

# 3. CREAR LA TABLA (EL ESQUELETO)
# Aquí definimos estrictamente los tipos de datos.
# INTEGER es vital para los minutos y el ID.
sql_create_table = """
CREATE TABLE horarios (
    id_curso INTEGER,
    area TEXT,
    grupo TEXT,
    asignatura TEXT,
    profesor TEXT,
    dia TEXT,
    hora_inicio TEXT,
    hora_fin TEXT,
    min_inicio INTEGER,  -- ¡Clave para tu algoritmo!
    min_fin INTEGER,     -- ¡Clave para tu algoritmo!
    salon TEXT
);
"""
cursor.execute(sql_create_table)
print("Tabla 'horarios' creada exitosamente.")

# 4. CARGAR EL CSV CON PANDAS
try:
    df = pd.read_csv(csv_entrada)
    
    # 5. INSERTAR DATOS A SQL
    # Pandas tiene una función mágica para esto.
    # if_exists='append' significa "agrega los datos a la tabla que acabamos de crear"
    df.to_sql('horarios', conn, if_exists='append', index=False)
    
    print(f"✅ Se insertaron {len(df)} registros en la base de datos.")

    # 6. CREAR ÍNDICES (TURBO)
    # Esto hace que las búsquedas sean instantáneas.
    print("⏳ Creando índices de velocidad...")
    cursor.execute("CREATE INDEX idx_area ON horarios(area);")
    cursor.execute("CREATE INDEX idx_asignatura ON horarios(asignatura);")
    cursor.execute("CREATE INDEX idx_grupo ON horarios(grupo);")
    
    # Confirmar cambios
    conn.commit()
    print("¡LISTO! Base de datos optimizada.")

except Exception as e:
    print(f"Ocurrió un error: {e}")

finally:
    conn.close()