# ATLAS_MASTER_WORKLIST

Orden por dependencia. Estado inicial: auditoría 2026-09-27.

> **HISTORICAL FACT:** la tabla siguiente es la lista hallada durante el
> `RESTRICTED_SANDBOX_AUDIT` (51/69). Los elementos que TASKs posteriores
> resolvieron se reclasifican abajo; no se eliminan de esta auditoría.

| ID | Priority | Area | Problem | Evidence | Files | Dependencies | Risk | Expected result | Tests required |
|---|---|---|---|---|---|---|---|---|---|
| P0-01 | P0 | Verificación | Suite no puede validar listeners ni persistencia en este sandbox | 51 pass / 18 fail; `EPERM`, `EROFS`, `SQLITE_CANTOPEN` | pruebas API, bots, backtest, persistencia | host con loopback y escritura | Alto: no distinguir entorno/código | ejecutar suite íntegra con permisos locales | `ATLAS_SIN_RED=true npm run prueba` verde, runtime nuevo |
| P0-02 | P0 | Integridad | Cambios post-Claude masivos no registrados y coexistencia de docs no rastreadas | `git status --short`: 122 líneas | árbol completo | P0-01 para validar antes de integrar | Alto: pérdida/mezcla de trabajo | revisión humana de alcance y staging explícito posterior | diff/check/suite; no usar add masivo |
| P1-01 | P1 | Dataset/UI | Identidad presentada no coincide con `datasetId` verificable | panel legado `7863...`; manifiesto `EURUSD_H1_DUKASCOPY_2021-2026` | `src/panel/index.html`, manifiesto | P0-01 | Medio: trazabilidad confusa | una sola identidad/etiqueta con hash y barras exactas | prueba de metadatos, panel runtime |
| P1-02 | P1 | Providers | Gemini aparece como opcional en UI pero sin backend/proveedor/contrato | `PROVIDER_DETAILS.gemini`, sin `gemini.ts` | `app.js`, `contratos.ts`, proveedores | decisión explícita: implementar opt-in o marcar no disponible | Medio: falsa expectativa | UI honesta y contrato consistente | provider tests, runtime |
| P1-03 | P1 | Persistencia | Backtest panel escribe repositorio por defecto, lo que impide ejecución read-only | `EROFS` en `RepositorioExperimentos.guardar` | `panel-backtest.ts`, `experimentos.ts`, prueba | P0-01 | Medio: acoplamiento prueba/datos | inyección temporal de repositorio para test sin alterar datos reales | panel-backtest + suite |
| P1-04 | P1 | Test isolation | Tests con SQLite comparten rutas o asumen escritura | `SQLITE_CANTOPEN` y memoria previa de concurrencia | bots/persistencia/legacy | host escribible | Medio | DB temporal única y serialización cuando aplique | archivos afectados + full suite |
| P2-01 | P2 | Panels | `src/panel` parece duplicado y no servido | `asset()` solo lista panel-vortice | src/panel, src/panel-vortice | decisión producto | Medio | consolidar o declarar legado; sin borrar aún | import/static/runtime |
| P2-02 | P2 | Knowledge | Knowledge graph, organizer y memory layers no tienen evidencia de exposición común al panel | componentes/tests separados | trading-lab, API/panel | P0-01 | Medio | contrato explícito o UI `UNAVAILABLE` permanente | unit + integration + runtime |
| P2-03 | P2 | Visual | Falta evidencia pixel-level contra referencia de Vórtice | panel vivo observado, no diff visual | panel-vortice | referencia verificable | Bajo | comparación reproducible, sin ajustar a ciegas | screenshot desktop/tablet/mobile |
| P3-01 | P3 | Coverage | No existe mapa cuantitativo de cobertura de líneas | pruebas por archivo únicamente | package/config | P0-01 | Bajo | cobertura reproducible si se agrega sin instalaciones | coverage command |

## Regla de ejecución

No se inició ninguna tarea de implementación. P0-01 está bloqueada por la restricción observada; por la instrucción de detener cuando `fail > 0`, las P1 quedan pendientes. No se creará `CODEX_ATLAS_IMPLEMENTATION_LOG.md` mientras no exista una implementación permitida.

## Reconciliación canónica posterior — TASK 6

| Área histórica | Estado actual | Evidencia actual |
|---|---|---|
| P0-01, validación local | VERIFIED | `CURRENT_BASELINE` 853/853, 0 fail, 0 skip. El 51/69 conserva su valor como evidencia de sandbox restringido. |
| P1-02, Gemini | VERIFIED (honestidad de contrato) | `Gemini: unavailable`; no hay proveedor Gemini ni red externa. |
| P2-02, conocimiento/memoria | PARTIAL | API cognitiva GET/read-only ya expone datos acotados; UI cognitiva sigue pendiente. |
| P1-01, identidad dataset | PARTIAL | ID canónico y alias histórico están distinguidos documentalmente; no se declara consolidación visual del panel legado. |

Pendientes que no cambian por esta reconciliación: consolidación de panel legado,
UI cognitiva, TradingReasoning integrado al retrieval, baseline histórico 3B.4,
OOS/robustness, agentes/video backend y Prop Firm Lab.
