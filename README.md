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
