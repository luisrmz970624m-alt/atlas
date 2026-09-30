# CODEX Atlas — auditoría independiente post-Claude

Fecha: 2026-09-27

> **Clasificación temporal (TASK 6, documentación):** esta auditoría describe
> el `RESTRICTED_SANDBOX_AUDIT` original. Sus 51/69 no son el baseline
> actual. Ver `CURRENT VERIFIED STATE` al final para el estado posterior
> comprobado; no se reescribe ni se borra la evidencia histórica.

## Alcance y límites respetados

Auditoría directa del árbol `/home/luisangel/atlas`, sin confiar en informes previos. No se hizo commit, push, add, reset, restore, clean, instalación, uso de credenciales, pago, red externa ni trading real. `1ENTREGA_MULTIAGENTE.md` y `docs/referencias/` no fueron modificados.

## Estado verificado

- Rama/HEAD: `master` / `e0e3652733e2dc1ef37ff7741e902885e845c7c9`.
- Árbol: 12 archivos modificados rastreados y más de 100 no rastreados. La integración reciente no está consolidada en Git. `git diff --check`: sin error de espacios.
- Inventario: 90 archivos en `src`, 69 en `pruebas`, datos históricos, 7 documentos de arquitectura y `graphify-out/graph.json` existente (1415 nodos). Hay además un segundo panel no servido en `src/panel/`; el servidor local sirve exclusivamente `src/panel-vortice/`.
- Node: `v22.23.2`.

## Runtime y seguridad local

- Un servicio ya activo en `127.0.0.1:4317` devolvió: HTML 200, `app.css` 200, `premium.css` 200, `app.js` 200, `/api/dashboard` 200, `/api/backtest/catalog` 200 y ruta inexistente 404 JSON.
- Cabeceras observadas en HTML: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Vista real: núcleo El Vórtice, seis módulos, providers, pestañas Trading (Mercados/Estrategias/Análisis IA/Órdenes/Laboratorio), estado `SIMULATED`, sin botones de ejecución real. Consola del navegador: 0 errores/advertencias capturados.
- Polling: `load()` pide solo `/api/dashboard` y `polling()` usa un único intervalo de 4 s; además carga el catálogo de backtest local. 404 fue correcto.
- Servidor: obliga bind `127.0.0.1`; rechaza `0.0.0.0`/IPv6 público, valida Host/Origin local, DTO, tamaño y content type. El bridge MT5 exige `DEMO_ONLY` y `REAL_TRADING=false`; es solo lectura.
- Limitación: iniciar un nuevo listener dentro del sandbox falla `EPERM`, aunque el servicio preexistente sí fue probado. Etiqueta: **BLOQUEADO POR SANDBOX** para reinicio/arranque independiente.

## Resultado de pruebas exacto

Comando: `ATLAS_SIN_RED=true npm run prueba`

```text
# tests 69
# suites 0
# pass 51
# fail 18
# cancelled 0
# skipped 0
# todo 0
# duration_ms 11812.754913
```

Los 18 archivos fallidos no constituyen una única regresión de código demostrada. Las ejecuciones aisladas muestran causas de entorno:

- API local: `listen EPERM: operation not permitted 127.0.0.1`.
- Pruebas de SQLite: `SQLITE_CANTOPEN: unable to open database file`.
- Backtest de panel: `EROFS: read-only file system, open 'datos/trading-experimentos.json.tmp'`.

Por ello la suite **no está verde** y bloquea toda implementación automática según la regla solicitada. Se requiere una ejecución con escritura permitida y loopback autorizado para distinguir completamente fallos de producto de sandbox.

## Dataset EURUSD H1 Dukascopy

- Archivo normalizado: `datos/historical/forex/EURUSD/H1/normalized/EURUSD_H1_2021-2026_normalized.csv`.
- `wc -l`: **35651** (incluye cabecera; el manifiesto también declara `normalizedBars: 35651`).
- SHA-256 calculado: `d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a` — coincide con el manifiesto.
- Manifiesto: Dukascopy, EURUSD, H1, BID, UTC, 69 fuentes, cobertura 2021-01-01 a 2026-09-26, calidad `VERIFIED`; 48 deduplicados, 1 fila inválida y 287 gaps reportados.
- El identificador solicitado `7863e7b6573ac96b` aparece como `CONFIG_MANIFEST` en el panel legado; no es el `datasetId` del manifiesto. El `datasetId` verificable es `EURUSD_H1_DUKASCOPY_2021-2026`. Esto es inconsistencia de identidad/presentación, no prueba de alteración del CSV.

## Arquitectura, funciones y uso

| FUNCTION_NAME | FILE | PURPOSE | CALLED_BY | CALLS | TESTED | RUNTIME_USED | STATUS |
|---|---|---|---|---|---|---|---|
| `AtlasLocalApi.start/handle` | `src/api-local/servidor.ts` | API local, assets y POSTs permitidos | `iniciarPanel`, pruebas | `asset`, DTO, dashboard, backtest | sí, bloqueado por EPERM | sí, servicio 4317 | PARTIAL |
| `iniciarPanel` | `src/api-local/panel.ts` | ensambla panel, estado y catálogo | script `panel` | `AtlasLocalApi`, `EstadoPanelAtlas` | sí, bloqueado en sandbox | sí, servicio existente | PARTIAL |
| `render/load/polling` | `src/panel-vortice/app.js` | render seguro y polling del dashboard | carga DOM | renderizadores, fetch local | sí | sí | WORKING |
| `renderCore` | `src/panel-vortice/app.js` | núcleo/siete estados UI | `render` | `linkState`, DOM | sí | sí | WORKING |
| `renderProviders` | `src/panel-vortice/app.js` | inventario de providers | `render` | `PROVIDER_DETAILS` | sí | sí | PARTIAL |
| `generarCon` / selección | `src/proveedores/seleccion.ts` | política local-first y gate de pago | Vórtice/CLI | ollama/Claude/ChatGPT | sí | no probado contra APIs | WORKING |
| `Vortice.generador` / router | `src/vortice/router.ts` | orquestación compatible con `Generador` | CLI/supervisor | selección, contexto, experiencia | sí | no evidencia de tráfico real | PARTIAL |
| `ejecutarBacktest` | `src/trading-lab/backtest.ts` | backtest simulado | panel/tests | estrategia MA cross | sí | catálogo local | WORKING |
| `validarFueraMuestra` / `ejecutarWalkForward` | `src/trading-lab/validacion.ts` | OOS/walk-forward | pruebas/lab | `ejecutarBacktest` | sí | no UI completa comprobada | PARTIAL |
| `observarPaperInterno` | `src/trading-lab/paper.ts` | paper interno sin órdenes | pruebas/lab | señal MA | sí | no orden real | WORKING |
| `ClienteMT5SoloLectura` | `src/mt5-bridge/cliente.ts` | bridge demo read-only | pruebas | validadores | sí | fake/demo únicamente | WORKING |
| `DatasetRepository` | `src/trading-lab/historical-dataset.ts` | identidad/hash datasets | pruebas/lab | hash/repo | sí | no recorrido integral | PARTIAL |
| `checkHistoricalReadiness` | `src/trading-lab/historical-readiness-gate.ts` | gate de disponibilidad histórica | pruebas/lab | dataset verificado | sí | no lanzamiento worker | PARTIAL |
| `IndicatorRegistry` / MA_CROSS | `src/trading-lab/indicator-registry.ts` | allowlist de indicadores | pipeline/pruebas | bootstrap | sí | no UI de administración | WORKING |
| `MemoryLayers` | `src/trading-lab/memory-layers.ts` | memoria por capas | init/tests | persistencia JSON | sí | expuesta por API cognitiva read-only; sin UI cognitiva | PARTIAL |
| `KnowledgeGraphEngine` | `src/trading-lab/knowledge-graph.ts` | grafo de conocimiento Atlas | init/tests | trazabilidad | sí | expuesto por API cognitiva read-only; sin UI cognitiva | PARTIAL |
| `KnowledgeOrganizer` | `src/trading-lab/knowledge-organizer.ts` | organización documental | init/tests | entidades/grafo | sí | participa en retrieval; sin UI cognitiva | PARTIAL |
| `TradingReasoningEngine` | `src/trading-lab/trading-reasoning.ts` | razonamiento histórico | pruebas | memoria/decisiones | bloqueado por EROFS | no | PARTIAL |
| `EstadoPanelAtlas.obtener` | `src/panel/contratos.ts` | contrato dashboard | `iniciarPanel` | empresa/simulaciones/memoria | sí | sí | WORKING |

### Call graph resumido (Graphify + código)

`iniciarPanel → AtlasLocalApi.start → handle → asset | /api/dashboard | /api/backtest/*`.

`DOM load → load → json('/api/dashboard') → render → renderCore, renderProviders, renderTrading, renderKpis, renderMemory, renderVideo, renderSimulation`; `polling → load` cada 4 s.

`panel-backtest → ejecutarBacktest → estrategia MA_CROSS`; `validación OOS/walk-forward → ejecutarBacktest`; `paper → señal MA sin ejecutar orden`.

Atlas `KnowledgeGraphEngine` es un componente de conocimiento/persistencia de la aplicación. Graphify es un artefacto separado de análisis estático (`graphify-out`), no dependencia de runtime del panel ni sustituto del grafo Atlas.

## Revisión funcional solicitada

- El Vórtice: HTML/SVG/CSS/JS presentes; `#vortex-core` es `span-8` y provider stack es `span-4`; la composición se observó viva y el SVG tiene texto alternativo. WORKING visualmente, sin comparación pixel a pixel contra la referencia.
- Providers: backend real contiene Ollama, Claude y ChatGPT/OpenAI. El UI enumera Gemini como API opcional, pero no hay implementación `src/proveedores/gemini.ts` ni presencia en el contrato dashboard. **Gemini: PARTIAL / presentación sin backend.** APIs caras se etiquetan opt-in; código de selección contiene gate de pago.
- Trading UI: todas las cinco pestañas solicitadas existen y declaran `SIN DINERO REAL`; Mercado/Análisis no afirman fuentes inexistentes. El laboratorio interactivo requiere persistencia, bloqueada aquí por EROFS.
- Dashboard: `ventas → d.ventas`, `utilidad → d.resultado`, `inventario → d.inventario`; Facturas usa `undefined` y se muestra `UNAVAILABLE`. Los KPIs secundarios solo se calculan de API/sesión y quedan pendientes cuando no hay valor.
- Video, Agentes y módulos no conectados: se muestran como `UNAVAILABLE`/`EMPTY`, no se inventan métricas. Simulación usa estado simulado del backend.

## Código muerto, duplicación e imports

- `src/panel/` duplica HTML/CSS/JS frente a `src/panel-vortice/`, pero `asset()` sirve solo panel-vortice. Sin import/runtime observado: **UNUSED candidate**, requiere decisión antes de eliminar.
- `graphify-out` detectó 1415 nodos y los caminos centrales citados; no se detectó import roto al importar `src/api-local/panel.ts` con Node 22.
- No se elimina ni modifica código candidato muerto durante esta auditoría.

## Clasificación post-Claude (solo por evidencia actual)

### CLAUDE_COMPLETED

- Panel Vórtice local servido con assets, cabeceras y dashboard funcionales.
- Layout central `span-8` + providers `span-4`; núcleo SVG y seis módulos visibles.
- Backtest catalog/run, MA cross, OOS, walk-forward, paper interno, MT5 demo read-only e indicador registry presentes y con pruebas existentes.
- Dataset local y SHA-256 coincidentes con el manifiesto.

### CLAUDE_PARTIAL

- Gemini solo está representado en UI, no implementado como proveedor.
- Video/agentes/memoria/grafo/razonamiento están implementados en distintos niveles pero no todos expuestos por API/panel.
- Pruebas de listener/persistencia no verificables en este sandbox.
- Dataset identity no es consistente entre el texto `CONFIG_MANIFEST` y `datasetId` real.

### CLAUDE_NOT_COMPLETED

- No hay evidencia de proveedor Gemini operativo.
- No hay evidencia de runtime independiente arrancado desde este entorno ni de suite íntegra verde.
- No hay evidencia de comparación visual 1:1 contra la referencia privada.

### REGRESSIONS

- No se puede afirmar una regresión de producto: los fallos reproducidos dependen de `EPERM`/`EROFS`/`SQLITE_CANTOPEN` del entorno. La suite fallida sí es un riesgo de integración hasta una ejecución autorizada.
- Inconsistencia visible de identificador de dataset: `7863...` versus `EURUSD_H1_DUKASCOPY_2021-2026`.

### KEEP

- Boundaries local/offline/simulated, validación de Host/Origin, no `eval`, `textContent`, estados `UNAVAILABLE`, gates de pago/red y bridge MT5 demo solo lectura.
- Vórtice y el panel-vortice actual; no revertir los cambios pendientes sin una revisión de producto.

## Conclusión

**PROJECT_NEEDS_REPAIR.** La app local observada funciona en el listener existente y no evidencia trading real ni salida a red, pero no puede declararse estable: la suite requerida está en 51/69 debido a un entorno que niega sus operaciones esenciales y hay inconsistencias/funciones parcialmente integradas. Ningún estado `COMPLETE`, `READY` o `STABLE` se usa sin evidencia.

## CURRENT VERIFIED STATE — actualización posterior a la auditoría

La conclusión anterior es un **HISTORICAL FACT** del sandbox restringido, no
una descripción del baseline vigente. TASKs 1–5 posteriores, reportadas y
validadas localmente, establecen `CURRENT_BASELINE: 853/853 pass, 0 fail,
0 skip` con `ATLAS_SIN_RED=true`.

| Etapa | Resultado | Clasificación |
|---|---:|---|
| `RESTRICTED_SANDBOX_AUDIT` | 51/69; 18 fallos `EPERM`/`EROFS`/`SQLITE_CANTOPEN` | HISTORICAL FACT |
| `LOCAL_STABLE_BASELINE_PRE_COGNITIVE` | 844/844 | HISTORICAL FACT |
| `COGNITIVE_API_INITIAL` | 846/846 | HISTORICAL FACT |
| `TASK_1_ENTITIES` | 847/847 | HISTORICAL FACT |
| `TASK_2_EXPERIMENT_REFS` | 848/848 | HISTORICAL FACT |
| `TASK_3_EXPERIMENT_TRACEABILITY` | 850/850 | HISTORICAL FACT |
| `TASK_4_CONTEXT_BUDGET` | 851/851 | HISTORICAL FACT |
| `TASK_5_NEGATIVE_SECURITY` | 853/853 | CURRENT VERIFIED STATE |

La API cognitiva tiene endpoints GET locales/read-only para `status`,
`search`, `retrieve`, `memory`, `reasoning` y `nodes/:id`; sigue sin UI
cognitiva. Gemini continúa `unavailable` sin backend. El ID canónico de
dataset es `EURUSD_H1_DUKASCOPY_2021-2026`; `7863e7b6573ac96b` es un alias
histórico de presentación. El puerto 4318 es evidencia de runtime histórico,
no una afirmación de listener actual. PNG persistentes: **NOT_VERIFIED**.
