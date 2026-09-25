# Arquitectura de El Vortice

## Estado de las Entregas A y B

El núcleo conserva `Generador` en `src/proveedores/tipos.ts`. `src/curso.ts`, `src/ciclo.ts` y `src/evaluacion.ts` no conocen proveedores ni Router.

`src/vortice/router.ts` es una capa opcional sobre ese contrato. Recibe una solicitud estructurada, aplica una política inyectable y expone `generador()` para entregar un `Generador` compatible a los consumidores existentes.

## Invariantes

- Ollama local es la primera ruta para tareas sencillas.
- Una API de pago exige proveedor disponible y permiso explícito; el selector existente exige `ATLAS_PERMITIR_API_PAGADA=true`.
- `ModeloNoDisponible` puede usar el siguiente candidato permitido una vez.
- `RespuestaIncompleta` y errores no recuperables se propagan sin fallback.
- El registro recibe únicamente proveedor, razón, coste, duración, resultado, tipo de error y fallback. No recibe prompts, respuestas, errores crudos, claves ni tokens.
- El contexto se ordena por relevancia y después por identificador, y se recorta por fuente completa dentro de un presupuesto de caracteres y tokens aproximados. El presupuesto descuenta sistema, usuario y un margen de seguridad; si ninguna fuente cabe, se rechaza antes de llamar a un proveedor.
- Los resúmenes reutilizables se persisten con `id`, versión, origen y fuentes. No se encadenan automáticamente.
- Las experiencias se persisten como evidencia estructurada; una ganancia aislada nunca eleva su estado a `validada`.
- Los resúmenes conservan cada versión y la migración desde el esquema anterior preserva las filas existentes.
- El registro genérico redacta valores y campos con aspecto de secreto antes de encadenarlos.

## Alcance excluido

No se creó Trading Lab, backtesting, walk-forward, paper trading, MT5, MT5 DEMO, integración externa nueva, automatización web ni simulación empresarial.
