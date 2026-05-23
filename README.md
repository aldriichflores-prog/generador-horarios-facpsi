Proyecto SADA (Sistema de Apoyo a la Decisión Académica)

Presentación

El proyecto SADA nació de la necesidad de cubrir un espacio ignorado por la administración de la Facultad de Psicología en el proceso de inscripciones.
Aunque certeramente el sistema de inscripción se remodeló para hacer una IU y UX más accesible y amena, no resolvió el problema de fondo que muchos
alumnos sufren semestre a semestre: armar un horario compatible con sus intereses, limitados además por la carga cognitiva que implica buscar profesores
y materias de forma dispersa, sin una herramienta centralizada y fácil de usar.

Objetivo

El Generador de Horarios plantea cubrir una necesidad entre los alumnos: brindar una plataforma donde los estudiantes puedan explorar de forma eficaz
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

   1.3.2.1 Panel de Resultados y Filtros (Modo Explorador)

   Después de generar, el panel de resultados se activa con un contador que indica cuántas opciones válidas se encontraron. Cada resultado se presenta
   como una tarjeta expandible que muestra el resumen del horario (número de días de asistencia, créditos totales, horas libres entre clases) y la tabla
   completa con materia, grupo, profesor y horario por día.

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

   
