# Control de Stock Farmacia ABG

Aplicación web estática para monitoreo de stock de fármacos en Farmacia ABG.

## Flujo de uso
1. Cargar el maestro ABG una vez por navegador.
2. Cargar stock Rayen lunes y jueves.
3. Cargar planilla de consumos al inicio de cada mes.
4. Revisar alertas y acciones.

## Reglas
- Crítico: stock < 20% del CPM de los últimos 3 meses.
- Bajo mínimo: stock entre 20% y 40%.
- OK: stock >= 40%.
- Controlados configurados en el maestro: si están críticos, informar directamente, sin revisión de bodega.
- Resto de críticos: revisar bodega; si hay stock, pedir; si no hay, informar.

Los archivos cargados se procesan en el navegador y el estado se guarda en localStorage del navegador.
