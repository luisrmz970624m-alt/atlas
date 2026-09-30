# CODEX Atlas — registro de implementación

Fecha: 2026-09-27

## Alcance ejecutado

1. Se revalidó el baseline sin repetir la auditoría. El sandbox restringido reproduce `EPERM` al abrir loopback y errores de escritura; la misma suite, ejecutada localmente con `ATLAS_SIN_RED=true`, pasó **844/844**. No hubo regresión de producto demostrada.
2. Se verificó que los tests de backtest ya inyectan `RepositorioExperimentos` temporal y que memoria/grafo usan rutas temporales en sus pruebas. No se tocaron datos históricos ni resultados reales.
3. Se hizo explícito el estado de Gemini en el contrato del dashboard: `Gemini: unavailable`. No se añadió proveedor, clave, SDK ni acceso externo.
4. Se agregó una aserción que impide presentar Gemini como conectado.

## Cambios de esta ejecución

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/panel/contratos.ts` | Añade `Gemini: 'unavailable'` al estado publicado. | Contrato honesto: no hay backend Gemini. |
| `pruebas/prueba-panel.ts` | Comprueba el estado no conectado de Gemini. | Evita una regresión de presentación. |

## Checkpoints

### Cronología canónica de baselines

| Etapa | Resultado | Estado |
|---|---:|---|
| `RESTRICTED_SANDBOX_AUDIT` | 51/69 (18 fallos por `EPERM`/`EROFS`/`SQLITE_CANTOPEN`) | HISTORICAL FACT |
| `LOCAL_STABLE_BASELINE_PRE_COGNITIVE` | 844/844 | HISTORICAL FACT |
| `COGNITIVE_API_INITIAL` | 846/846 | HISTORICAL FACT |
| `TASK_1_ENTITIES` | 847/847 | HISTORICAL FACT |
| `TASK_2_EXPERIMENT_REFS` | 848/848 | HISTORICAL FACT |
| `TASK_3_EXPERIMENT_TRACEABILITY` | 850/850 | HISTORICAL FACT |
| `TASK_4_CONTEXT_BUDGET` | 851/851 | HISTORICAL FACT |
| `TASK_5_NEGATIVE_SECURITY` | 853/853 | HISTORICAL FACT |
| `TASK_11_14_PRE_HARDENING` | 901/901 | HISTORICAL FACT |
| `HARDENING_11.1_15.1` | 910/910 | HISTORICAL FACT |
| `CLOSURE_11.2_15.2` | 923/923 | HISTORICAL FACT |
| `FINAL_HOST_GATE_14.3_15.3` | 929/929 | CURRENT VERIFIED STATE |

TASK 6 es exclusivamente una reconciliación documental: no modifica código,
pruebas ni los resultados de las etapas anteriores.

## Ejecución autónoma posterior — Fases 0, 1, 2 y 4 parciales

- Baseline preservado y reproducido con `ATLAS_SIN_RED=true`: 844/844.
- Se añadió una API cognitiva local de solo lectura, conectada a los motores existentes de KnowledgeGraph, MemoryLayers y TradingReasoning. No crea una segunda persistencia ni permite mutaciones.
- Rutas: `/api/cognitive/status`, `/search`, `/retrieve`, `/memory`, `/reasoning` y `/nodes/:id`. Las respuestas aplican DTOs acotados, límites de 50 registros y estados honestos `UNAVAILABLE`/`EMPTY`.
- Se corrigió el router existente para que `query`, `intent` y `entities` participen realmente en la selección trazable de nodos, sin cargar documentos completos.
- Inconsistencia reparada: el runtime TypeScript strip-only rechaza parameter properties; el adaptador usa propiedad explícita compatible.
- Pruebas dirigidas: 19/19. Suite posterior: 846/846, 0 fallos.
- Captura visual observada en runtime existente: panel y núcleo El Vórtice a 127.0.0.1:4317. La interfaz disponible permitió visualizarla, pero no persistir bytes PNG como artefacto local. Un listener independiente no pudo persistir en esta ejecución de terminal; las pruebas de integración sí ejercen listener efímero loopback.

- Pruebas dirigidas: 113 pass, 0 fail.
- Suite completa autorizada: 844 pass, 0 fail, 0 skip, duración 16.78 s.
- Runtime local `127.0.0.1:4318`: panel 200, dashboard 200, catálogo 200, ruta inexistente 404.
- Consola del navegador: 0 errores y 0 advertencias.

No se hizo commit, push, staging, instalación, llamada externa, trading real, ni modificación de `1ENTREGA_MULTIAGENTE.md` o `docs/referencias/`.

## Ejecución autónoma GREEN-GATE — TASK 6B (2026-09-27)

**Estado: BLOCKED.** La revalidación literal con
`ATLAS_SIN_RED=true npm run prueba` terminó en **51 pass / 19 fail / 0 skip**
(70 archivos). La prueba cognitiva aislada terminó en **3 pass / 2 fail**; los
dos fallos HTTP son `listen EPERM: operation not permitted 127.0.0.1`.

Esto impide ejercer el gate requerido de loopback y no es una autorización para
modificar producto, pruebas ni contratos con el fin de evitar el listener. Se
verificó `git diff --check` sobre cambios rastreados: PASS. TASKs 7–15 no se
iniciaron, conforme al gate estricto.

## Actualización autorizada — TASK 6B a TASK 10 (2026-09-27)

- TASK 6B / TASK 6: GREEN / VERIFIED por evidencia local autorizada 853/853, 0 fail, 0 skip. `RESTRICTED_SANDBOX_AUDIT` 51/69 sigue histórico.
- TASK 7: revisión contractual GREEN; el DTO de memoria ahora expone solamente una fuente declarada como procedencia y nunca `metadata` arbitrario.
- TASK 8: se añadió `#cognitivo` en `panel-vortice`, lectura local de status/retrieval/memory con estados honestos.
- TASK 9: GREEN; el panel consume la API cognitiva por HTTP local, sin duplicar KnowledgeGraph, MemoryLayers ni persistencia y sin alterar el núcleo/seis módulos.
- Suite posterior: 854/854 pass, 0 fail, 0 skip con `ATLAS_SIN_RED=true`; runtime visual local en `127.0.0.1:4321`; `git diff --check` PASS.
- TASK 10: BLOCKED. TradingReasoning aún no consume retrieval cognitivo; se respetó el gate y TASK 11–15 no iniciaron.

## Actualización posterior — TASK 10 a TASK 15 (2026-09-27)

TASK 10 fue resuelto como GREEN en una sesión posterior con 858/858 pass. Las TASKs 11–15 fueron completadas:

- TASK 11: Historical Baseline 3B.4 — GREEN (868/868). CSV loader canónico, baseline runner, 10 tests.
- TASK 12: OOS/Walk-Forward/Robustness — GREEN (877/877). Temporal OOS, 5 WF windows, sensitivity, cost stress, 9 tests.
- TASK 13: Prop Firm Lab Foundation — GREEN (891/891). PropFirm→Program→RuleSet declarativo, 14 tests.
- TASK 14: Prop Firm Challenge Simulator — GREEN (901/901). evaluateChallenge, daily PnL, failure reasons, 10 tests.
- TASK 15: Final Multilayer Review — GREEN. Reconciliación completa.

Suite final tras TASK 14: 901/901 pass, 0 fail, 0 skip.

## Hardening Round — TASK 11.1 a TASK 15.1 (2026-09-27)

Auditoría independiente reveló inconsistencias en TASKs 11–15. Se ejecutó ronda de hardening:

- TASK 11.1: CSV loader field mapping corregido (fecha/apertura/maximo/minimo/cierre), duplicate loadAndMapCSV eliminado, persistencia real, cost labels TEST_ASSUMPTION, no-lookahead proper, dataset identity (35,650 data bars). 12/12 PASS.
- TASK 12.1: Regime analysis (detectRegimeFromSeries), Critic integration (buildCriticAnalysis), WF semantics SEGMENTED, baselineRunId. 12/12 PASS.
- TASK 13.1: VERIFIED requiere url+retrievedAt, STALE produce error, validateProgram(). 18/18 PASS.
- TASK 14.1: Account normalization (scaleFactor), dailyLossBasis REALIZED_PNL, TRAILING→DATA_INSUFFICIENT, INCOMPLETE result, 4 new failure reasons. 10/10 PASS.
- TASK 15.1: Reportes reconciliados.

Targeted tests: 52/52 PASS. Full suite: 910/910 PASS. No commit, no push, no staging.

## Final Closure Round — TASK 11.2 to TASK 15.2 (2026-09-27)

- TASK 11.2: ExperimentoTrading extended with dataset (datasetId, sha256, source), experimentType, parameterSource, costSource. Canonical datasetId: EURUSD_H1_DUKASCOPY_2021-2026. Restart-safe persistence test (write → destroy → recover → verify). True N→N+1 no-lookahead test with synthetic series (signal at candle N=4, entry at candle N+1=5, price = apertura of N+1). 14/14 PASS.
- TASK 13.2: STALE ruleset blocked at execution time in evaluateChallenge (returns NOT_VERIFIED + RULESET_STALE). NOT_VERIFIED also blocked. TEST_FIXTURE allowed. 29/29 PASS.
- TASK 14.2: Capital fallback `?? 10000` eliminated. evaluateChallenge now takes ChallengeContext with backtestInitialCapital. Missing capital → INCOMPLETE + CAPITAL_BASE_DATA_INSUFFICIENT. Overnight rule enforced (cross-day → OVERNIGHT_POSITION_BREACH). Weekend rule enforced (Sat/Sun → WEEKEND_POSITION_BREACH). News/trailing/position limit strict. INCOMPLETE precedence: incompatible market > source invalid > missing data > verified breaches > PASS. 7 new failure reasons. 21/21 PASS.
- TASK 15.2: All reports reconciled. Full suite: 923/923 PASS, 0 fail, 0 skip.

## Edge Hardening y Cierre Final — TASK 14.3 y TASK 15.3 (2026-09-27)

- **TASK 14.3: Challenge Semantics Edge Hardening + Host-Local Validation**
  - Implementación en `src/trading-lab/challenge-simulator.ts`:
    - Precedencia estricta de insuficiencia de datos (`hasDataInsufficiency` antes de evaluar violaciones duras o de target) retornando `INCOMPLETE`.
    - Validación segura de timestamps en reglas de overnight y weekend evitando conversiones NaN; genera `OVERNIGHT_DATA_INSUFFICIENT` / `WEEKEND_DATA_INSUFFICIENT`.
    - Detección precisa de solapamiento de fin de semana en calendario UTC (`utcCalendarDay`) para operaciones que cruzan de viernes 23:00 a sábado 01:00 UTC (`WEEKEND_POSITION_BREACH` si `weekendAllowed: false`).
  - Pruebas dirigidas: 6 nuevos tests en `pruebas/prueba-challenge-simulator.ts`, totalizando **27/27 PASS**.
  - **Aclaración sobre entornos de ejecución:**
    - *Work environment:* En la ejecución previa dentro del sandbox restringido de Work, se alcanzaron 54/74 suites debido a restricciones ambientales del entorno (permisos y binding de red/loopback).
    - *Host-local final:* En el entorno de host local autorizado, la ejecución de la suite completa con `ATLAS_SIN_RED=true npm run prueba` completó las **74/74 suites** y los **929/929 tests PASS** (0 fail, 0 skip, 0 cancelled, 17.8 s).
    - Queda certificado que la discrepancia observada en Work **NO fue una regresión de producto**, sino una limitación ambiental ya resuelta.
  - Integridad: `git diff --check` PASS; dataset canónico verificado intacto con SHA256 `d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`.

- **TASK 15.3: Reconciliación y Cierre Documental Final**
  - Reconciliación de todos los reportes de auditoría (`TASK_GREEN_REPORT`, `FINAL_WORKLIST`, `FINAL_REPORT`, `IMPLEMENTATION_LOG`, `AUDIT_HANDOFF`) alineando el baseline verificado a **929/929 PASS**.
  - Se eliminaron contradicciones de encabezados obsoletos y se diferenció claramente entre HISTORICAL FACT y CURRENT VERIFIED STATE.
  - Sin commits, sin pushes, sin modificaciones a `1ENTREGA_MULTIAGENTE.md`, sin crear `docs/referencias/`, y preservando íntegramente todos los cambios en staging preexistentes.
  - Estado del proyecto: **PROJECT_VERIFIED_STABLE**.

No commit, no push, no staging.
