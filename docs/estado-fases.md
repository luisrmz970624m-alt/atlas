# Estado de fases Atlas

## Correccion B 1

- Estado: verificada.
- Commit: `b1542c9`.
- Alcance: validacion persistente de experiencias, presupuesto conservador, orden por relevancia, historial y migracion de resúmenes, saneamiento de registro, proveedores inyectables y bloqueo de coste en la ruta heredada.
- Verificacion: `ATLAS_SIN_RED=true ATLAS_PERMITIR_API_PAGADA=false npm run prueba` resulto en 232 pruebas verdes.
- Limites: no se activo ninguna API de pago, no se uso secreto ni se hizo una llamada de red.

## Entrega C

- Estado: verificada; pendiente del commit de fase.
- Alcance permitido: datos históricos locales validados, estrategias declarativas y backtester reproducible.
- Excluido: recomendaciones financieras, servicios externos, broker, MT5, paper trading y cualquier orden.
- Verificacion: `npm run prueba` resulto en 237 pruebas verdes con `ATLAS_SIN_RED=true` forzado por el script.
