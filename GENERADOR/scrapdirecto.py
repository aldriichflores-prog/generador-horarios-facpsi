import time
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
URL_DE_LOS_HORARIOS = "http://132.248.25.133/alumno/horarios/publicar/"

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
driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20)

datos_totales = []

try:
    print("INICIANDO EXTRACCIÓN")
    driver.get("http://132.248.25.133/alumno/horarios/publicar/")

    for area in AREAS_A_BUSCAR:
        print(f"\nProcesando: {area}...")
        
        try:
            sel1 = Select(wait.until(EC.presence_of_element_located((By.ID, "select1"))))
            sel1.select_by_visible_text("6to Semestre")
            time.sleep(1)
            sel2 = Select(wait.until(EC.presence_of_element_located((By.ID, "select2"))))
            sel2.select_by_visible_text("Grupo") 
            time.sleep(1)
            sel3 = Select(wait.until(EC.presence_of_element_located((By.ID, "select3"))))
            sel3.select_by_visible_text(area)
            time.sleep(4) 
            html_pagina = driver.page_source
            tablas_encontradas = pd.read_html(html_pagina)
            df_correcto = None
            for i, tabla in enumerate(tablas_encontradas):
                contenido = tabla.to_string().upper()
                if "PROFESOR" in contenido or "ASIGNATURA" in contenido or "LUNES" in contenido:
                    df_correcto = tabla
                    print(f"  -> ¡Tabla correcta detectada! (Es la tabla #{i})")
                    break
            if df_correcto is not None:
                df_correcto['Area_Origen'] = area
                datos_totales.append(df_correcto)
                print(f"  -> Guardadas {len(df_correcto)} materias.")
            else:
                print("ERROR")
                if tablas_encontradas:
                    print("  -> La tabla 0 contiene:", tablas_encontradas[0].columns.tolist())
            driver.refresh()
            time.sleep(2)

        except Exception as e:
            print(f"  ERROR GRAVE en {area}: {e}")
            driver.refresh()
            time.sleep(2)
finally:
    driver.quit()
if datos_totales:
    print("\n------------------------------------------------")
    df_final = pd.concat(datos_totales, ignore_index=True)
    nombre_archivo = "Horarios_6to_Final_Bien1.csv"
    df_final.to_csv(nombre_archivo, index=False, encoding='utf-8-sig')
    print(f"Revisa el archivo: {nombre_archivo}")
else:
    print("\nNo se guardó nada.")