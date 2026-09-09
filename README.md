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
