import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# --- CONFIGURACIÓN ---
URL_DE_LOS_HORARIOS = "http://132.248.25.133/alumno/horarios/publicar/"

SEMESTRES_A_BUSCAR = ["1er Semestre", "3er Semestre", "5to Semestre", "7mo Semestre"]

AREAS_A_BUSCAR = [
    "CIENCIAS COGNITIVAS Y DEL COMPORTAMIENTO",
    "PROCESOS PSICOSOCIALES Y CULTURALES",
    "PSICOBIOLOGIA Y NEUROCIENCIAS",
    "PSICOLOGIA CLINICA Y DE LA SALUD",
    "PSICOLOGIA DE LA EDUCACION",
    "PSICOLOGIA ORGANIZACIONAL",
    "CONTEXTUAL"
]

options = webdriver.ChromeOptions()
options.add_argument("--ignore-certificate-errors")
options.add_argument("--ignore-ssl-errors")
options.add_argument("--allow-running-insecure-content")
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20) # Tiempo máximo de espera (20 seg)

datos_totales = []

try:
    print("--- INICIANDO EXTRACCIÓN CON ESPERA INTELIGENTE ---")
    driver.get(URL_DE_LOS_HORARIOS)

    for semestre in SEMESTRES_A_BUSCAR:
        # Los semestres 1 y 3 solo tienen el área general "TODOS"
        if semestre in ["1er Semestre", "3er Semestre"]:
            areas_semestre = ["Todos"]
        else:
            areas_semestre = AREAS_A_BUSCAR

        for area in areas_semestre:
            print(f"\nProcesando: {semestre} - {area}...")
            
            try:
                # 1. SELECCIONAR SEMESTRE
                sel1 = Select(wait.until(EC.presence_of_element_located((By.ID, "select1"))))
                sel1.select_by_visible_text(semestre)
                time.sleep(1)

                # 2. SELECCIONAR GRUPO
                sel2 = Select(wait.until(EC.presence_of_element_located((By.ID, "select2"))))
                sel2.select_by_visible_text("Grupo") 
                time.sleep(1)

                # 3. SELECCIONAR ÁREA
                sel3 = Select(wait.until(EC.presence_of_element_located((By.ID, "select3"))))
                sel3.select_by_visible_text(area)
                
                print("  Selección hecha. Esperando a que aparezcan los datos reales...")

                # --- LA CLAVE DEL ÉXITO ---
                # Aquí obligamos al script a esperar hasta que la página tenga la palabra "ASIGNATURA"
                # Si no aparece esa palabra, no intentará descargar nada.
                try:
                    wait.until(lambda d: "ASIGNATURA" in d.page_source or "PROFESOR" in d.page_source)
                    time.sleep(2) # Un respiro extra de seguridad
                except:
                    print("  Tiempo agotado: No aparecieron los datos.")
                    driver.refresh()
                    continue

                # 4. BUSCAR LA TABLA CORRECTA
                # Bajamos todas las tablas y buscamos la que tenga los datos
                import io
                html_pagina = driver.page_source
                tablas_encontradas = pd.read_html(io.StringIO(html_pagina))
                
                tabla_buena = None
                
                for t in tablas_encontradas:
                    texto_tabla = t.to_string().upper()
                    # Verificamos que sea la tabla de horarios
                    if "PROFESOR" in texto_tabla or "CLAVE" in texto_tabla:
                        tabla_buena = t
                        break
                
                if tabla_buena is not None:
                    # Agregamos la columna de semestre para diferenciarlos después en la base de datos
                    tabla_buena['Semestre'] = semestre
                    tabla_buena['Area_Origen'] = area
                    datos_totales.append(tabla_buena)
                    print(f"  -> ¡ÉXITO! Se extrajeron {len(tabla_buena)} filas.")
                else:
                    print("  -> Se cargó la página pero no encontré la tabla correcta.")

                # 5. REFRESH PARA LA SIGUIENTE
                driver.refresh()
                time.sleep(1.5)

            except Exception as e:
                mensaje = f"Error en {semestre} - {area}: {str(e)}"
                print(f"  {mensaje}")
                with open("error_log.txt", "a", encoding="utf-8") as f:
                    f.write(mensaje + "\n")
                
                # Tomar captura para ver qué estaba viendo el navegador
                try:
                    driver.save_screenshot(f"error_{semestre.replace(' ', '_')}_{area.replace(' ', '_')}.png")
                except:
                    pass
                    
                driver.refresh()

finally:
    driver.quit()

# --- GUARDAR ---
if datos_totales:
    df_final = pd.concat(datos_totales, ignore_index=True)
    nombre_archivo = "Horarios_Impares_Terminado.csv"
    df_final.to_csv(nombre_archivo, index=False, encoding='utf-8-sig')
    print(f"\n¡LISTO! Archivo generado correctamente: {nombre_archivo}")
else:
    print("\nNo se pudieron extraer datos.")