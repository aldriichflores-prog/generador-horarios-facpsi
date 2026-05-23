Proyecto SADA (Sistema de Apoyo a la Decisión Académica)

Presentación

El proyecto SADA nació de la necesidad de cubrir un espacio ignorado por la administración de la Facultad de Psicología en el proceso de inscripciones.
Aunque certeramente el sistema de inscripción se remodeló para hacer una IU y UX más accesible y amena, no resolvió el problema de fondo que muchos
alumnos sufren semestre a semestre: armar un horario compatible con sus intereses, limitados además por la carga cognitiva que implica buscar profesores
y materias de forma dispersa, sin una herramienta centralizada y fácil de usar.

Objetivo

El Generador de Horarios plantea cubrir una necesidad entre los alumnos: Brindar una plataforma donde los estudiantes puedan explorar de forma eficaz
y automatizada las opciones de profesores y materias que se ofertan en la Facultad, sin que esa tarea represente una carga adicional que conlleve estrés
e incertidumbre durante el proceso de inscripción.

1. Generador de Horarios

   1.1 Página de Bienvenida

   La página de bienvenida es un landing page que invita al estudiante a elegir su semestre antes de ingresar al sistema. Las opciones disponibles son:
   3er Semestre, 5to Semestre, 7to Semestre y Semestre Adicional. Estas opciones corresponden a la oferta académica publicada en la página
   oficial de horarios de la Facultad para el semestre vigente.

   1.2 Elección de Modos de Uso

   La pantalla presenta dos tarjetas que explican brevemente los dos modos de uso disponibles: Modo Manual y Modo Automático. Cada tarjeta
   tiene un botón de acceso que lleva directamente al modo correspondiente. Esta presentación doble cumple una función de orientación: El estudiante
   entiende desde antes de entrar qué camino existe y cuál le conviene según su situación.
   Al pie de la pantalla se incluye un aviso que aclara que la herramienta es un proyecto estudiantil, sin afiliación ni respaldo oficial de la administración
   de la Facultad.

   1.3 Espacio de Trabajo

   Al elegir un modo, el sistema transiciona al espacio de trabajo. Este espacio está encabezado por una barra de cabecera que muestra el nombre del
   proyecto, el semestre vigente (ej. Semestre 2027-1) y un selector desplegable que permite cambiar de semestre en cualquier momento sin salir del
   sistema.
   Al cambiar el semestre, el espacio de trabajo se reinicia limpiamente: se borra el horario en construcción y la base de datos de materias
   se actualiza para mostrar la oferta del semestre recién seleccionado.
   Inmediatamente debajo del encabezado aparece, cuando corresponde, una alerta informativa específica para el semestre elegido (ver sección 1.4 sobre
   comportamiento por semestre).
   Debajo de esa alerta se ubica una barra de instrucciones desplegable que describe visualmente los tres pasos del modo activo. Su diseño permite que
   se cierre para liberar espacio en pantalla una vez que el estudiante ya conoce el flujo. Esta barra también incluye una sección de "Opciones Avanzadas"
   que anticipa las herramientas disponibles, funcionando como una guía rápida al inicio y como recordatorio para usuarios que regresan.
   
   El espacio de trabajo se divide en dos columnas. La columna izquierda contiene los paneles de selección de materias y actividades extracurriculares.
   La columna derecha contiene el panel de grupos o profesores disponibles para la materia seleccionada, la tabla o cuadrícula del horario en construcción,
   y la barra de herramientas principal. Esta división es intencional: guía al usuario de izquierda a derecha en una secuencia lógica de decisiones.

   1.3.1 Modo Manual

   El Modo Manual está pensado para el estudiante que ya tiene una idea clara de qué materias quiere cursar y prefiere construir su horario con control.

   El flujo es lineal y secuencial:

   Paso 1. Elegir materia: El panel izquierdo muestra todas las materias disponibles para el semestre seleccionado, agrupadas por área de conocimiento.
   Cada área es un acordeón colapsable con un contador de materias disponibles. El estudiante puede buscar directamente por nombre de la materias usando el
   buscador en la parte superior del panel.
   Al seleccionar una materia del listado, el panel derecho (panel de grupos) se activa y carga los grupos disponibles para esa materia.

   Paso 2. Seleccionar profesor y grupo: El panel de grupos presenta cada opción como una tarjeta individual que muestra el nombre del profesor,
   el número de grupo, la clave de la materia, los créditos y el horario completo (días y horas de cada clase). Si el grupo tiene observaciones
   relevantes, aparece un botón "Ver Obs" que despliega esa información sin abandonar el panel.
   
   El estudiante selecciona la tarjeta del grupo de su preferencia y el sistema lo agrega automáticamente al horario en construcción. No hay un botón de
   confirmación adicional: el clic sobre la tarjeta es la acción de agregar.
   
   Detección de traslapes. Cuando el estudiante intenta agregar un grupo cuyo horario choca con una materia ya registrada, el sistema no lo bloquea
   silenciosamente ni lo agrega sin aviso. En cambio, la tarjeta del grupo conflictivo se resalta visualmente en rojo y aparecen dos botones:
   "Confirmar Cambio" y "Cancelar". Si el estudiante confirma, el sistema elimina automáticamente la materia en conflicto y registra el nuevo grupo.
   Si cancela, no ocurre ningún cambio.
   Esta lógica permite al estudiante tomar una decisión informada sin perder el control de su horario. En el modo visual, los traslapes se señalan con una
   etiqueta de "TRASLAPE" visible sobre el bloque en la cuadrícula.

   Paso 3. Repetir y visualizar: El estudiante repite el proceso para cada materia que quiera incluir. El horario va creciendo en la tabla inferior
   de la columna derecha, que muestra materia, grupo, profesor, los días de la semana con su horario y los créditos. El contador de créditos en la
   barra de herramientas se actualiza en tiempo real e indica si la carga está dentro del rango válido, es insuficiente o excede el máximo permitido.
   

   1.3.2 Modo Automático

   El Modo Explorador está diseñado para el estudiante que no sabe de antemano qué combinación de materias y profesores cabe sin traslapes, o que quiere
   explorar todas las posibilidades antes de decidir. En lugar de probar opciones una por una, el estudiante selecciona una variedad materias y profesores
   que le sirven y el sistema hace el trabajo de encontrar todas las combinaciones válidas.
   
   El flujo también es de tres pasos, señalizados visualmente en la barra de instrucciones colapsable:
   
   Paso 1: Agregar materias a la Selecciones: El panel izquierdo funciona igual que en Modo Manual: materias agrupadas por área, buscador en tiempo real,
   acordeones colapsables. Al seleccionar una materia, no se agrega directamente al horario sino a la "Selección de Materias", que es una lista de opciones
   seleccionadas para la combinación. La materia aparece marcada visualmente en el listado para indicar que ya está en la selección, y un contador  en el
   panel inferior izquierdo, "Mis Selecciones" muestra cuántas materias están se han seleccionado.

   Paso 2. Seleccionar profesores candidatos: Al hacer clic en una materia del listado, el panel derecho muestra todos los grupos disponibles para
   esa materia. El estudiante selecciona todos los grupos o profesores que considera aceptables.
   No es una selección única: se pueden marcar varios grupos de la misma materia. Cada grupo marcado queda registrado como opción válida para esa materia
   en la combinación.
   Este paso es lo que le da poder al modo: Si el estudiante acepta cinco profesores para una materia, el sistema explorará combinaciones con los cinco.
   
   Paso 3. Generar. El botón "Generar Horarios" desencadena el algoritmo que calcula todas las combinaciones posibles entre los grupos candidatos de
   cada materia, descartando automáticamente aquellas que presenten traslapes. Las combinaciones válidas se muestran ordenadas en tarjetas en el panel
   de resultados. Si no existe ninguna combinación sin traslape entre las selecciones actuales, el sistema no devuelve un error genérico: Identifica cuál
   materia es la fuente del conflicto y lo señala explícitamente, guiando al estudiante hacia dónde debe ampliar o cambiar sus opciones.
   
   Por rendimiento, el sistema muestra un máximo de 50 combinaciones de todas las posibles calculadas. Los filtros (sección siguiente) permiten reordenar
   la variedad de resultados y poner al frente las combinaciones más relevantes para cada criterio.

   1.4 Opciones Avanzadas y Filtros de los Modos

   1.4.1 Opciones Avanzadas y Filtros (Modo Manual)
   
   En el modo automático, ña barra de herramientas es el panel de control del Modo Manual. Se ubica en el encabezado de la sección de horario y agrupa todos los      controles de gestión en un solo lugar:

      Ordenar: Menú desplegable que cambia el criterio de ordenación de la tabla de horario. Las opciones son Materia, Profesor (A-Z), Grupo, Duración
      Total y Orden Cronológico. El criterio activo se muestra en el botón para que el usuario siempre sepa cómo está visualizando su horario.
   
      Contador de Créditos: Es un badge que muestra el total de créditos acumulados en el horario actual. El color del badge cambia según el estado:
      gris cuando el horario está vacío, amarillo con la leyenda "(Faltan)" cuando los créditos están por debajo del mínimo, y una variante neutra
      cuando la carga está dentro del rango válido. Este indicador es contextual: sirve como recordatorio pasivo de que hay un requisito mínimo que cumplir.
   
      Deshacer / Rehacer: Dos botones de flecha que permiten revertir o repetir la última acción sobre el horario. El sistema mantiene
      un historial de estados que se actualiza con cada cambio (agregar, eliminar, confirmar traslape). Los botones se deshabilitan automáticamente cuando
      no hay acciones disponibles en esa dirección, evitando interacciones vacías.

      Limpiar: Elimina todas las materias del horario actual con un solo clic, después de pedir confirmación implícita por el color rojo del botón.
      No borra las actividades extracurriculares.

      Descargar: Menú desplegable con cuatro opciones de exportación del horario actual: PDf, PNG, Excel (.xlsx), CSV.
   
   Las cuatro opciones exportan exactamente lo que el usuario ve en ese momento: si hay actividades extracurriculares registradas, también se incluyen.
   
      "Este es mi horario final": botón verde que el usuario presiona cuando ha terminado de armar su horario y quiere registrarlo. Al presionarlo,
      el sistema guarda una copia del horario completo en la base de datos de analytics (de forma anónima) y muestra un modal de satisfacción. Este
      registro es la fuente primaria de datos del proyecto: saber qué materias y profesores elige la comunidad estudiantil de manera definitiva. El botón
      cambia de apariencia después de ser presionado para confirmar que el registro fue exitoso.
   
      Tabla Dinámica: Alterna entre la Vista Lista y la Vista Visual del horario.

      Recolorear (ícono de paleta): Solo visible en Tabla Dinámica. Reasigna los colores de todas las materias con el algoritmo de contraste de luminancia.

      Configuración visual (ícono de engranaje): Menú con tres casillas de verificación que controlan qué información se muestra dentro de cada bloque
      en la Tabla Dinámica: Profesor, Grupo, Horario. Cada opción puede activarse o desactivarse de forma independiente.

   1.4.2 Panel de Resultados y Filtros (Modo Explorador)

   En el modo Automático, después de generar, el panel de resultados se activa con un contador que indica cuántas opciones válidas se encontraron. Cada resultado     se presenta como una tarjeta expandible que muestra el resumen del horario (número de días de asistencia, créditos totales, horas libres entre clases) y la        tablacompleta con materia, grupo, profesor y horario por día.

      Cada tarjeta de resultado tiene tres acciones disponibles:

         "Mi opción de horario": Marca esa combinación como el horario final del estudiante y la registra en el sistema del data base
   
         "Pasar al Modo Manual": transfiere todos los cursos de esa combinación al Modo Manual, donde el estudiante puede seguir ajustando materia por
         materia.
         Esta acción es el puente entre ambos modos: Explorar posibilidades con el motor automático y luego refinar a mano.

         Tabla Dinámica: Es un cambio dentro de cada tarjeta activa la cuadrícula gráfica de esa combinación específica.

      El panel de filtros aparece encima de los resultados una vez que se ha generado al menos una combinación. Contiene cuatro controles:

         Ordenar: Reordena las combinaciones por "Menos días de asistencia", "Más créditos" o "Menos horas libres entre clases". Permite al
         estudiante priorizar según su preferencia de carga semanal.

         Turno: Filtra para mostrar solo combinaciones matutinas (todas las materias terminan antes de las 14:00) o vespertinas (todas inician después
         de las 13:00). Las combinaciones que no cumplen el filtro se ocultan, no se eliminan.

         Días libres: Es un menú desplegable con casillas de verificación para cada día de la semana (Lunes a Sábado). Al marcar un día, el sistema filtra
         y muestra únicamente las combinaciones que no tienen clases ese día, permitiendo al estudiante proteger un día libre específico.
   
         Profesores: Es un menú desplegable con todos los profesores que aparecen en los resultados generados. Incluye un buscador interno para localizar
         rápidamente a un profesor por nombre, y botones de "Seleccionar todos" y "Limpiar". Al marcar profesores específicos, el filtro muestra solo las
         combinaciones que los incluyen.

      Todos los filtros actúan de forma acumulativa y se aplican en tiempo real al cambiar cualquier control.

   1.4.3 Vista Lista y Tabla Dinámica
   
      Ambos modos ofrecen dos representaciones del horario en construcción, accesibles mediante el switch "Tabla Dinámica" en la barra de herramientas:

      Vista Lista (predeterminada): Es una tabla con columnas de Materia, Grupo, Profesor, cada día de la semana (Lunes a Sábado) con los horarios
      correspondientes, Créditos, Observaciones y un botón de eliminación. Esta vista es compacta e informativa. Hacer clic sobre una fila abre un
      modal de detalles que muestra el nombre completo de la materia, el nombre del profesor y las observaciones del grupo. Desde ese modal también
      se puede eliminar la materia sin volver a la tabla. La tabla puede reordenarse en cualquier momento usando el menú desplegable de ordenación,
      con las opciones: Materia (alfabético), Profesor (A-Z), Grupo (numérico), Duración Total y Orden Cronológico.

      Tabla Dinámica: Es una cuadrícula semanal con días como columnas y horas como filas, donde cada materia ocupa bloques de color en su franja horaria
      correspondiente. Los colores son asignados automáticamente al agregar cada materia, con un algoritmo que maximiza el contraste entre bloques
      adyacentes para facilitar la lectura. Cada bloque muestra el nombre de la materia, el grupo, el horario y el nombre del profesor, aunque cualquiera
      de esos datos puede ocultarse de forma individual mediante el menú de configuración (ícono de engranaje) ubicado en la barra de herramientas. Los
      traslapes de horario se marcan con un color diferenciado y la etiqueta "TRASLAPE" visible sobre el bloque. Al activar la vista visual, aparece
      también el botón de Recolorear, que reasigna los colores de todas las materias de forma inteligente, recalculando la luminancia para mantener el
      contraste óptimo.
   
   1.5 Actividades Extracurriculares
   
   Ambos modos incluyen un panel de Actividades Extra, ubicado en la columna izquierda debajo del listado de materias. El panel es colapsable para
   no ocupar espacio cuando no se necesita.

   El propósito de esta función es que el estudiante pueda registrar compromisos que no son materias de la Facultad pero que sí ocupan franjas horarias
   reales: inglés, servicio social, prácticas supervisadas externas, deportes, trabajo, entre otros. Al registrar una actividad extracurricular, el
   sistema la trata exactamente igual que una materia en términos de detección de traslapes: si un grupo académico choca con el horario de una actividad
   ya registrada, el conflicto se señala con la misma lógica visual que cualquier otro traslape.

   En el Modo Explorador, las actividades extracurriculares se consideran como restricciones en el algoritmo de generación: ninguna combinación generada
   incluirá grupos que choquen con los horarios de las actividades registradas.

   Para registrar una actividad, el estudiante escribe su nombre, selecciona los días de la semana mediante botones de alternancia (L, M, Mi, J, V, S)
   y elige la hora de inicio y fin con campos de tiempo. Al presionar "Agregar", la actividad queda registrada y aparece en la lista del panel con los
   días y el nombre como referencia, junto a un botón para eliminarla.

   1.6 Comportamiento Específico por Semestre
   
   El sistema adapta su comportamiento y mensajes de orientación según el semestre seleccionado, reconociendo que la lógica de inscripción varía
   sustancialmente entre los semestres de Tronco Común y los semestres libres.

      2do Semestre (Tronco Común): El sistema muestra una alerta informativa que explica el concepto de grupos espejo: Grupos distintos que comparten
      exactamente el mismo horario pero con diferente profesor. Se recomienda el Modo Manual para este semestre. La recomendación de uso es elegir un grupo
      base y, para cualquier materia donde el profesor no sea de la preferencia del estudiante, sustituirlo por el grupo espejo correspondiente sin afectar
      el horario ya armado.

      4to Semestre (Tronco Común): mismo esquema de grupos espejo que en segundo, con las mismas recomendaciones de uso. Se agrega una alerta especial
      para la materia Aprendizaje y Conducta Adaptativa III (ACA III): cada grupo de teoría tiene asignados grupos de práctica específicos. El estudiante
      debe revisar las observaciones del grupo de teoría que elija para identificar cuál grupo de práctica le corresponde y agregarlo por separado.

      6to y 8vo Semestre: no aplica la lógica de grupos espejo. El estudiante selecciona materias y profesores de forma completamente libre entre toda
      la oferta disponible, organizada por áreas de conocimiento. Ambos modos pueden usarse sin restricciones adicionales. La materia Principios de
      Sustentabilidad, que pertenece formalmente a 8vo semestre, también aparece disponible en la oferta de 6to.

      Semestre Adicional: la oferta se limita a materias de 6to y 8vo semestre. El sistema muestra una alerta con las reglas académicas vigentes:
      solo pueden elegirse materias no cursadas previamente, con un rango de créditos obligatorio de mínimo 31 y máximo 41. Se activa además un selector
      de sistema de pertenencia que filtra la oferta entre grupos del sistema escolarizado (grupos 6000–8000) y grupos del Sistema Universidad Abierta,
      SUA (grupos 9000). Este filtro aplica simultáneamente tanto al listado del Modo Manual como al del Modo Explorador.

   1.7 Normativa Académica

   Al pie del espacio de trabajo se encuentra un botón "Ver Normativa Académica y Créditos" que abre un modal con las reglas de carga académica
   vigentes en la Facultad. Este modal concentra en un solo lugar la información que los estudiantes normalmente tienen que buscar por separado:
   rango de créditos por semestre, condiciones de recursamiento, reglas para el Semestre Adicional y normativas sobre movilidad y equivalencias. El
   modal es de solo lectura e incluye un enlace directo a la página oficial de horarios de la Facultad para verificar la información fuente.

   El pie de página también incluye un aviso permanente que recuerda que los horarios y profesores publicados en el sistema están sujetos a cambios
   de último momento por parte de la administración, y que el proyecto no se hace responsable por discrepancias entre los datos del generador y el
   sistema oficial al momento de la inscripción.

   1.8 Consentimiento y Participación

   La primera vez que un usuario ingresa al espacio de trabajo, aparece un banner anclado en la parte inferior de la pantalla que informa sobre la
   recopilación de datos de uso. El banner es informativo, no es un bloqueante: el usuario puede interactuar con el sistema sin necesidad de responderlo.

   El banner especifica qué se recopila (semestre, materias, profesores elegidos, herramientas usadas, horario final si el usuario lo decide compartir)
   y qué no se recopila (nombre, número de cuenta, correo, dirección IP ni ningún dato identificable). Incluye una sección expandible "Más info" que
   detalla la naturaleza anónima de los datos y que el proyecto es de autoría estudiantil de la Facultad de Psicología UNAM.

   El usuario puede aceptar o rechazar la recopilación. Su respuesta queda registrada y el banner no vuelve a aparecer en sesiones subsecuentes desde
   el mismo dispositivo.

   1.8 Calificación de Satisfacción

   Cuando el estudiante presiona el botón "Este es mi horario final" (en Modo Manual) o "Mi opción de horario" (en Modo Automático), el sistema
   registra el horario y presenta inmediatamente un modal con una escala de satisfacción de 1 a 5 estrellas. La pregunta invita al usuario a calificar
   qué tan satisfecho está con la página. Esta calificación se guarda vinculada al horario confirmado en la base de datos.

   La calificación es voluntaria: el modal puede cerrarse sin responder. Para los horarios donde sí se responde, la puntuación queda disponible como
   variable en los análisis de datos del proyecto, permitiendo explorar si ciertos patrones de satisfacción de la página.

3.  Base de Datos
   
   El proyecto SADA incluye un sistema de recopilación de datos de uso completamente anónimo, construido sobre Supabase (PostgreSQL). Este sistema
   documenta cómo los estudiantes interactúan con el generador: qué materias y profesores exploran, qué herramientas usan, cómo navegan entre modos
   y qué horario eligen al final.

   La arquitectura es la siguiente: Cada visitante recibe un identificador único derivado de características técnicas de su navegador (fingerprint),
   sin ningún dato personal. Ese identificador persiste entre sesiones para medir retención, pero no es trazable a ninguna persona. Cada sesión de uso
   tiene un ciclo de vida completo: Inicia cuando el usuario entra al sistema y se cierra cuando sale, registrando la duración total.

   Todas las acciones relevantes dentro del sistema generan eventos registrados: elegir semestre, cambiar de modo, buscar una materia, agregar o eliminar
   un curso, generar combinaciones, aplicar filtros, exportar, confirmar horario final. Cada evento lleva un timestamp y los datos específicos de la
   acción (por ejemplo, un evento de "agregar curso" incluye el nombre de la materia, el profesor, el grupo y la clave).

   La tabla más valiosa del sistema es schedule_snapshots, que guarda el horario completo del usuario en dos momentos: una captura automática al
   cerrar el sistema (estado real al salir) y una captura explícita cuando el usuario confirma su horario final. Esta dualidad permite distinguir entre
   lo que el estudiante estaba armando y lo que finalmente eligió.

   El sistema también mantiene tablas de estadísticas agregadas de profesores y materias, actualizadas en tiempo real mediante funciones de base de datos,
   que permiten construir rankings de popularidad sin necesidad de procesar la tabla de eventos completa en cada consulta.

   La seguridad de los datos está garantizada mediante Row Level Security (RLS) en todas las tablas: los usuarios anónimos solo pueden insertar datos,
   nunca leerlos ni eliminarlos. Los análisis se realizan exclusivamente desde el panel de administración de la base de datos, al que solo tienen acceso
   los autores del proyecto.

3. Herramientas Utilizadas

   El sistema está construido como una aplicación web de página única (SPA) sin frameworks de JavaScript. Las tecnologías utilizadas son:

      HTML5, CSS3 y JavaScript (Vanilla): toda la lógica del generador, detección de traslapes, algoritmo de combinaciones y gestión del estado
      se implementa en JavaScript puro sin dependencias de frameworks como React o Vue.

      Bootstrap 5: sistema de grilla, componentes de UI (modales, dropdowns, badges, alertas) y utilidades de layout.

      Bootstrap Icons: iconografía del sistema.

      Supabase: base de datos PostgreSQL en la nube para el sistema de analytics. Las llamadas se realizan directamente mediante la API REST de
      Supabase sin SDK, usando fetch nativo del navegador.

      Canvas API: animación de partículas del landing page (particles.js).

      LocalStorage: persistencia del estado del horario entre sesiones del mismo dispositivo.

   Los datos de la oferta académica (materias, profesores, grupos, horarios) se cargan desde un archivo JSON estático (Horarios_Completo_UNAM.json)
   que se actualiza manualmente al inicio de cada periodo de inscripciones a partir de la información publicada en la página oficial de la Facultad.

4. Aviso y Limitaciones
   
   Esta herramienta es un generador. Los horarios y profesores publicados están sujetos a cambios de último momento por parte de la administración de
   la Facultad de Psicología. El proyecto SADA hace el mejor esfuerzo por mantener la base de datos actualizada ante cualquier aviso, pero no se hace
   responsable por discrepancias entre el generador y el sistema oficial al momento de la inscripción.
   La inscripción formal siempre debe realizarse en los sistemas oficiales de la UNAM.

Proyecto desarrollado por estudiantes de la Facultad de Psicología, UNAM. Hecho por alumnos, para alumnos.
