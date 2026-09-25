# Arquitectura de El Vortice

## Estado de la Entrega A

El núcleo conserva `Generador` en `src/proveedores/tipos.ts`. `src/curso.ts`, `src/ciclo.ts` y `src/evaluacion.ts` no conocen proveedores ni Router.

`src/vortice/router.ts` es una capa opcional sobre ese contrato. Recibe una solicitud estructurada, aplica una política inyectable y expone `generador()` para entregar un `Generador` compatible a los consumidores existentes.

## Invariantes

- Ollama local es la primera ruta para tareas sencillas.
- Una API de pago exige proveedor disponible y permiso explícito; el selector existente exige `ATLAS_PERMITIR_API_PAGADA=true`.
- `ModeloNoDisponible` puede usar el siguiente candidato permitido una vez.
- `RespuestaIncompleta` y errores no recuperables se propagan sin fallback.
- El registro recibe únicamente proveedor, razón, coste, duración, resultado, tipo de error y fallback. No recibe prompts, respuestas, errores crudos, claves ni tokens.

## Alcance excluido

No se creó Trading Lab, backtesting, walk-forward, paper trading, MT5, MT5 DEMO, integración externa nueva, automatización web, memoria de experiencia nueva ni simulación empresarial.
