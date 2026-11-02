# Gestión de Inventario Farmacia ABG — v3.2

Versión consolidada de la herramienta web.

## Incluye
- Maestro ABG integrado y editable localmente.
- Stock Rayen lunes/jueves, con comparación versus carga anterior.
- Consumo mensual incremental e ingreso de un solo producto.
- CPM últimos 3 meses, 20% crítico, 40% mínimo.
- Cobertura en meses, tendencia y riesgo de quiebre.
- Trazadores IAAPS/FOFAR y controlados.
- Historial automático de quiebres cuando stock llega a 0.
- Inventario rotativo semanal de 15 productos con responsable y Pareto/ABC.
- Inventario general: calendario editable, 3 TENS + 1 QF, planilla y carga de resultados.
- Vencimientos manuales sin lote.
- Sobrestock >3 meses de cobertura.
- Panel de excepciones.
- Pedido mensual automático (hojas MEDICAMENTOS y PATERNIDAD) 3 días antes, con stock del mismo día.
- Reporte mensual de trazadores, con stock del mismo día.
- Exportación de gestión y respaldo local.

## Nota
Los datos operativos se guardan en localStorage del navegador. Exportar respaldo periódicamente.

- El pedido mensual ahora se descarga sobre la plantilla oficial original, conservando su estructura y formato.
- El archivo final de pedido conserva solo las hojas MEDICAMENTOS y PATERNIDAD.
- Los selectores de consumo mensual se generan dinámicamente para años futuros.

- Configuración anual: permite editar fechas de pedidos e inventarios generales por año desde la propia web.
- El cambio de año es automático: los selectores de consumos se adaptan al año actual y la web avisa si el nuevo año no tiene fechas operativas configuradas.
- Enero reconoce correctamente diciembre del año anterior como último mes de consumo.

- Informe de trazadores con validación previa obligatoria: consumo del mes anterior, CPM 3M, reconocimiento de stock y stock Rayen cargado el mismo día.
- El botón de generación queda bloqueado hasta que todos los requisitos estén completos.
- Se muestra el listado de trazadores pendientes antes de descargar el Excel.

- v3.2.1 corrige la carga inicial del maestro: index.html ahora referencia el archivo JavaScript correcto.
- Se incorpora validación previa obligatoria para el reporte de trazadores.
- El reporte exige stock Rayen cargado el mismo día, consumo del mes anterior, CPM 3M y stock reconocido para todos los trazadores.
- Se corrige el diálogo de Configuración anual para que funcione correctamente.

- v3.2.2 corrige el arranque: el maestro carga sin esperar librerías externas de Excel.
- SheetJS y ExcelJS se cargan solo al importar/exportar archivos.
- pedido_template.json ya no bloquea el inicio de la aplicación si falla.

- v3.2.3 agrega protección contra duplicación de consumos mensuales.
- Si el mes ya tiene datos, la carga masiva avisa antes de reemplazarlos.
- Al finalizar informa cuántos valores fueron nuevos y cuántos fueron reemplazados.

- v3.3: ficha clickeable por medicamento, histórico mensual, curva de consumo, CPM móvil 3 meses y clasificación editable GES/programa ministerial/arsenal general/IAAPS/FOFAR.

- v3.4: permite registrar varios meses de consumo sin cerrar la ventana.
- Tipo de producto: Medicamento, Insumo, Dental y Curación avanzada.
- Subcategorías filtrables: GES, Programa Ministerial, Arsenal general, FOFAR e IAAPS.
- Filtro adicional por detalle GES / programa ministerial.

- v3.4.1: corrige #REF! en la columna SOLICITUD TEÓRICA del pedido mensual.
- La fórmula ahora usa referencias directas por fila: MAX(0, CONSUMO MENSUAL × 1,15 - STOCK ACTUAL).
- Se eliminó la dependencia de referencias estructuradas de tabla que Excel podía romper al generar el archivo.

- v3.4.3: corrige la generación del pedido mensual.
- Se restauró la plantilla oficial ABG original, compatible con ExcelJS.
- Se mantiene la fórmula directa por fila en SOLICITUD TEÓRICA para evitar #REF!.
- No se usa la plantilla reconstruida que provocaba el error "Cannot read properties of undefined (reading 'sheets')".

- v3.5.0: prioridad manual para inventarios rotativos.
- Prioridades: Normal, Media, Alta y Siempre incluir.
- Motivos múltiples: Alta rotación, Diferencias frecuentes de inventario, IAAPS, FOFAR, GES, PPMM, Alto costo y Otro.
- Excel rotativo rediseñado con título, datos del inventario, filtros, anchos legibles, fórmulas, formato condicional y configuración de impresión.

- v3.5.1: en inventario rotativo, STOCK SISTEMA queda vacío al generar los 15 productos.
- STOCK SISTEMA y STOCK FÍSICO se completan manualmente al momento del inventario.
- La diferencia y el resultado se calculan solo cuando ambos campos están informados.
- En el Excel, STOCK SISTEMA y STOCK FÍSICO quedan vacíos por defecto y resaltados como campos de llenado.

- v3.5.2: corrige el cálculo en vivo de Diferencia y Resultado al ingresar stock sistema y stock físico en inventario rotativo.

- v3.5.3: los inventarios rotativos incompletos quedan guardados como PENDIENTES.
- El historial muestra estado, avance y permite Abrir / continuar un inventario pendiente.
- Un inventario completo puede abrirse nuevamente para ver su resumen.
- Guardar / actualizar modifica el mismo inventario abierto y no crea duplicados.
- Se agrega 2° conteo opcional por producto. Si se ingresa, pasa a ser el conteo usado para la diferencia final.
- El inventario se considera completo cuando todos los productos tienen STOCK SISTEMA y 1° CONTEO.
- El Excel incorpora 1° conteo, 2° conteo, diferencia del primer conteo, diferencia final, estado y avance.

- v3.6.0: agrega módulo de Cuadre de controlados con stock Rayen, físico y libro, diferencias y exportación Excel.
- Agrega módulo Redistribución ABG ↔ MH: consulta el último stock y consumo MH desde Supabase, cruza por glosa de bodega exacta y compara cobertura en meses.
- La redistribución excluye controlados y productos no dispensables en MH y propone cantidad/dirección para aproximar la cobertura de ambos centros.

- v3.7.0: rediseño visual completo de ABG.
- No modifica la lógica ni los datos de v3.6.0.
- Nuevo encabezado institucional tipo dashboard.
- KPIs modernizados con mejor jerarquía visual.
- Módulos operativos convertidos en tarjetas más limpias y navegables.
- Filtros, tablas, diálogos, formularios y botones actualizados.
- Mejoras responsivas para notebook, tablet y celular.

- v3.8.0: navegación orientada a evitar desplazamientos largos.
- Los KPI (Críticos, Bajo mínimo, Riesgo alto, etc.) ahora abren una vista rápida en modal con los productos filtrados.
- La vista rápida permite abrir el detalle del producto o revisar bodega sin bajar al panel principal.
- Inventarios, Pedidos, Cuadre de controlados, Redistribución, Trazadores, Vencimientos, Excepciones y Configuración anual pasan a un menú lateral de Operaciones.
- Se mantienen accesos directos a Inventario rotativo, Controlados, Redistribución y Pedido mensual.
- Se conserva toda la lógica funcional de v3.7.0/v3.6.0.

- v3.9.0: navegación principal mediante menú lateral fijo.
- Secciones del menú: Inventarios, Cuadratura, Pedido mensual y Reportes.
- Inventarios incluye Rotativo, General y Programación anual.
- Cuadratura incluye Controlados y Redistribución ABG ↔ MH.
- Pedido mensual abre directamente el módulo de preparación de pedido.
- Reportes incluye Trazadores, Vencimientos, Excepciones y Exportar gestión.
- En escritorio el menú permanece siempre visible.
- En tablet/celular se transforma en menú lateral desplegable.
- La lógica funcional y los datos de v3.8.0 se mantienen sin cambios.

- v3.10.0: reemplaza el menú lateral por una barra superior fija.
- Secciones principales: Inventarios, Cuadratura, Pedido mensual y Reportes.
- Los submódulos aparecen en menús desplegables bajo cada sección.
- Pedido mensual queda como acceso directo destacado.
- El dashboard mantiene todo el ancho disponible.
- En pantallas pequeñas la barra superior permite desplazamiento horizontal y los menús se adaptan al ancho.
- La lógica funcional de v3.9.0 se mantiene sin cambios.

- v3.10.1: las vistas rápidas de KPI ahora se pueden descargar a Excel.
- Exporta exactamente el listado filtrado visible en Críticos, Bajo mínimo, Riesgo alto, Sobrestock, Vencimientos, etc.
- Columnas: Producto, Programa, Stock, CPM 3M, Cobertura, Estado y Acción.
- El archivo incluye título, descripción, fecha de generación, autofiltro y encabezado congelado.

- v3.10.2: el módulo Redistribución queda vinculado conceptualmente y técnicamente con la herramienta MH mediante la misma base Supabase.
- Al abrir Redistribución, ABG intenta sincronizar automáticamente el último stock y consumos de MH.
- Ya no depende de presionar primero el botón manual; el botón queda como reintento “Sincronizar con MH”.
- La última sincronización MH válida queda almacenada localmente en ABG.
- Si Supabase presenta una caída temporal, ABG muestra el último conjunto de datos MH disponible con su fecha, en vez de dejar el módulo vacío.
- El estado distingue conexión actual versus datos en caché.

- v3.10.3: corrige error de inicialización de v3.10.2.
- El script principal se carga ahora al final real del HTML, después de todos los diálogos y botones.
- Se evita el error por intentar enlazar `exportKpiQuick` antes de que exista en el DOM.
- Se agrega cache-busting explícito a CSS y JS para evitar mezclas de versiones en GitHub Pages/navegador.
- Verificado: el arranque ya alcanza `init()` correctamente.

- v3.10.5: versión robusta de carga para GitHub Pages.
- CSS y JavaScript principal se integran directamente dentro de index.html.
- Ya no depende de archivos app-vX.js o styles-vX.css para iniciar.
- Esto evita mezclas de caché o referencias entre distintas versiones.
- Se eliminó código residual del antiguo menú lateral.
- La aplicación conserva maestro.json, pedido_template.json y pedido_template.xlsx como archivos externos.


Actualización v3.10.5: se modernizó visualmente el ingreso de Stock físico y Stock libro en el módulo de cuadre de medicamentos controlados.


Actualización v3.10.6: corregido el ingreso de Stock físico y Stock libro. La tabla ya no se redibuja en cada tecla, por lo que se pueden escribir números completos de forma normal y las diferencias se actualizan en vivo.
