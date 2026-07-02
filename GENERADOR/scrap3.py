import requests
from bs4 import BeautifulSoup

# CONFIGURACION
URL_BASE = 'http://132.248.25.133/alumno/horarios/publicar/'
URL_NIVEL_2 = URL_BASE + 'carga_select2.php' # Semestre -> Tipo
URL_NIVEL_3 = URL_BASE + 'carga_select3.php' # Tipo -> Campo
URL_NIVEL_4 = URL_BASE + 'carga_select4.php' # Campo -> ¿Tabla? (HIPOTESIS)

# Usamos el 6to Semestre como conejillo de indias (6:::20262)
SEMESTRE_CLAVE = "6:::20262"

print(f"--- INICIANDO DIAGNOSTICO DE 3 NIVELES ---")
print(f"Objetivo: Llegar a la tabla del 6to Semestre\n")

try:
    # ========================================================
    # PASO 1: Obtener TIPOS (Grupo/Asignatura)
    # ========================================================
    print("1. Consultando Tipos de Busqueda (Nivel 2)...")
    resp2 = requests.post(URL_NIVEL_2, data={'informacion_1': SEMESTRE_CLAVE})
    soup2 = BeautifulSoup(resp2.text, 'html.parser')
    
    opciones_2 = [op for op in soup2.find_all('option') if op.get('value') != "0"]
    
    if not opciones_2:
        print("   [ERROR] No devolvio opciones (¿Quizas el semestre esta vacio?)")
        exit()
        
    print(f"   -> Encontradas {len(opciones_2)} opciones.")
    # Tomamos la PRIMERA opcion real (ej: 'Grupo')
    val_2 = opciones_2[0].get('value')
    txt_2 = opciones_2[0].get_text(strip=True)
    print(f"   -> Seleccionando automaticamente: '{txt_2}' (Clave: {val_2})")

    # ========================================================
    # PASO 2: Obtener CAMPOS DEL CONOCIMIENTO (Nivel 3)
    # ========================================================
    print("\n2. Consultando Campos del Conocimiento (Nivel 3)...")
    payload_3 = {
        'informacion_1': SEMESTRE_CLAVE,
        'informacion_2': val_2
    }
    resp3 = requests.post(URL_NIVEL_3, data=payload_3)
    soup3 = BeautifulSoup(resp3.text, 'html.parser')
    
    # Verificamos si aqui YA esta la tabla (poco probable, pero posible)
    if soup3.find('table'):
        print("   [SORPRESA] ¡La tabla estaba aqui en el Nivel 3!")
    else:
        # Buscamos las opciones del campo (Area)
        opciones_3 = [op for op in soup3.find_all('option') if op.get('value') != "0"]
        
        if opciones_3:
            print(f"   -> Encontradas {len(opciones_3)} areas de conocimiento.")
            # Tomamos la PRIMERA area para probar
            val_3 = opciones_3[0].get('value')
            txt_3 = opciones_3[0].get_text(strip=True)
            print(f"   -> Seleccionando area: '{txt_3}' (Clave: {val_3})")
            
            # ========================================================
            # PASO 3: INTENTO FINAL - Obtener la Tabla (Nivel 4)
            # ========================================================
            print("\n3. Buscando la Tabla Final (Hipotesis carga_select4.php)...")
            payload_4 = {
                'informacion_1': SEMESTRE_CLAVE,
                'informacion_2': val_2,
                'informacion_3': val_3
            }
            
            # PRUEBA A: Intentamos con carga_select4.php
            resp4 = requests.post(URL_NIVEL_4, data=payload_4)
            
            if resp4.status_code == 404:
                print("   [FALLO] El archivo 'carga_select4.php' NO EXISTE (Error 404).")
                print("   Probaremos una alternativa...")
            else:
                soup4 = BeautifulSoup(resp4.text, 'html.parser')
                tabla = soup4.find('table')
                
                if tabla:
                    filas = len(tabla.find_all('tr'))
                    print(f"   [EXITO TOTAL] ¡TABLA ENCONTRADA! Tiene {filas} filas.")
                    print("   Ya tenemos la ruta completa para descargar todo.")
                else:
                    print("   [MISTERIO] El servidor respondio OK, pero no veo la tabla.")
                    print("   Respuesta parcial del servidor:")
                    print(soup4.get_text()[:200])

        else:
            print("   [ERROR] No salieron opciones de Area (Nivel 3 vacio).")
            print("   Respuesta cruda Nivel 3:")
            print(resp3.text[:200])

except Exception as e:
    print(f"Error critico: {e}")