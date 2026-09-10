# Gestión de Inventario Farmacia ABG — v3.0.1

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
