# Control de Stock Farmacia ABG

Aplicación web estática para monitoreo de stock de fármacos en Farmacia ABG.

## Versión 2
- El maestro ABG se carga automáticamente desde `maestro.json`.
- El usuario carga stock Rayen lunes y jueves.
- A inicio de mes se carga solo el consumo del mes anterior.
- El histórico de consumos queda guardado en el navegador.
- Se puede exportar/importar un respaldo JSON del histórico.
- CPM = promedio de los últimos 3 meses disponibles.
- Crítico = <20% del CPM.
- Bajo mínimo = 20% a <40% del CPM.
- Controlados críticos: informar directamente, sin revisar bodega.
- Otros críticos: revisar bodega; luego registrar pedir o informar.

## Archivos
- `index.html`
- `styles.css`
- `app.js`
- `maestro.json`

- La versión 2.2 verifica automáticamente si el consumo del mes anterior está cargado y muestra su cobertura.

- Versión 2.3: permite gestionar el arsenal desde la propia web (agregar, editar o retirar medicamentos).
- Versión 2.3: permite agregar o corregir el consumo de un solo medicamento para un mes específico.
- Los cambios manuales del arsenal se guardan localmente en el navegador.

- Versión 2.4: inventario rotativo semanal de 15 medicamentos con Pareto/ABC y prioridad IAAPS/FOFAR.
- Distribución objetivo 9 A, 4 B y 2 C; evita repetir productos de las últimas 4 semanas.
- Permite registrar stock físico, diferencia, guardar historial y exportar a Excel.

- Versión 2.4.1: corregido ingreso de stock físico; ya no se pierde el foco al escribir cifras completas.
