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

## Entrega D

- Estado: verificada; pendiente del commit de fase.
- Alcance permitido: validacion fuera de muestra, walk-forward y observacion paper interna.
- Excluido: broker, MT5, credenciales y envio de ordenes.
- Verificacion: `npm run prueba` resulto en 240 pruebas verdes, sin red.

## Entrega E

- Estado: implementación local verificada; conexión real pendiente.
- Arquitectura: cliente Atlas de solo lectura y protocolo inyectable; el servidor real será un bridge local privado dentro de una VM Windows aislada.
- Controles: `TRADING_MODE=DEMO_ONLY`, `REAL_TRADING=false`, cuenta DEMO obligatoria, timeouts, reconexión limitada, validación de mensajes y sin métodos de escritura.
- Verificación local: fake DEMO para estado, cuenta, símbolos, tick, velas, posiciones e historial; rechaza cuenta real, datos corruptos, timeout, desconexión y operaciones no permitidas.
- Pendiente externo: crear VM Windows, instalar MT5, elegir broker/servidor DEMO, login manual y comprobar el bridge real. No se han realizado estas acciones.
