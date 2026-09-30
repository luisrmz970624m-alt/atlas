# CODEX Atlas — informe final

## Estado final

**CURRENT VERIFIED BASELINE: 929/929 pass, 0 fail, 0 skip (74 suites)** con
`ATLAS_SIN_RED=true` (Validación Host-Local, Post-Closure 14.3 / 15.3).
Las restricciones ambientales previas del sandbox Work (54/74) quedan archivadas
como hechos históricos del entorno y no representan regresión de producto. El árbol
contiene trabajo preexistente/staged preservado intacto.

## Terminología canónica de baseline

| Etapa | Resultado | Clasificación |
|---|---:|---|
| `RESTRICTED_SANDBOX_AUDIT` | 51/69; 18 fallos por `EPERM`/`EROFS`/`SQLITE_CANTOPEN` | HISTORICAL FACT |
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

## Qué estaba mal y qué se corrigió

- La auditoría veía 18 archivos fallidos en un sandbox restringido. Se separó el límite del entorno del producto: localmente la suite pasa 844/844 con `ATLAS_SIN_RED=true`.
- Gemini estaba visible en el panel sin una entrada explícita del dashboard. El contrato ahora publica `Gemini: unavailable`; no se simula conectividad ni se añade un proveedor externo.
- La identidad de EURUSD se revisó contra el manifiesto: ID canónico `EURUSD_H1_DUKASCOPY_2021-2026`, alias histórico `7863e7b6573ac96b` solo en panel legado/documentos, SHA-256 `d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`, `normalizedBars` 35651. El CSV no fue modificado.

## Módulos y conexiones reales

| Área | Estado | Conexión real |
|---|---|---|
| API/panel Vórtice | VERIFIED | Loopback `127.0.0.1`, assets, dashboard y catálogo de backtest. |
| Providers | VERIFIED | Ollama local; Claude y ChatGPT/Codex opt-in; Gemini UNAVAILABLE. |
| Backtest | VERIFIED | Motor existente, MA_CROSS y repositorio inyectable en tests. |
| OOS, walk-forward, paper | VERIFIED | Locales/simulados; paper no envía órdenes. |
| MT5 | VERIFIED | Demo, solo lectura; MT5 real PENDING. |
| Dataset EURUSD H1 | VERIFIED | Manifiesto/hash/barras concordantes. |
| KnowledgeGraph/MemoryLayers | PARTIAL | Implementados y expuestos por API cognitiva GET/read-only; sin UI cognitiva. |
| Agentes y video | PARTIAL | UI honesta `UNAVAILABLE`; no backend de video ni roster activo. |
| Simulación | VERIFIED | Explícitamente `SIMULATED`. |
| `src/panel/` legacy | PARTIAL | No servido; se conserva sin borrar ni consolidar. |

## Current verified baseline

- Tests: **929 pass, 0 fail, 0 skip** (74 suites, `ATLAS_SIN_RED=true npm run prueba`, post-Closure 14.3 / 15.3 en Host Local).
- HISTORICAL: 853/853 (TASK 5), 901/901 (TASK 14), 910/910 (Hardening 15.1), 923/923 (Closure 15.2).
- Endpoints cognitivos locales: GET `/api/cognitive/status`, `/search`,
  `/retrieve`, `/memory`, `/reasoning` y `/nodes/:id`.
- Entities: normalización, deduplicación, máximo de 16 y controles rechazados.
- `experimentRefs` y trazabilidad de experimentos: expuestos como DTOs
  acotados, sin crear persistencia paralela.
- Context budget: semántica honesta en caracteres; `used`/`remaining` son
  `null` y `NOT_COMPUTED` mientras el router no carga contenido textual.
- Hardening negativo: límites de query/entidades/IDs, percent-encoding seguro,
  rutas hostiles 404 y métodos no GET para rutas cognitivas rechazados.
- Runtime cognitivo: local/read-only; no trading real, no red externa, no APIs
  pagadas ni credenciales.

## Validación histórica previa

- Suite: 844 pass, 0 fail, 0 skip, 0 cancelled; 16.78 s.
- Runtime temporal: `http://127.0.0.1:4318/panel-vortice/`.
- HTTP: panel 200; dashboard 200; backtest catalog 200; inexistente 404.
- Browser: 0 errores y 0 advertencias.
- Responsive observado: escritorio 1645×927; 1440 y 1280; móvil 760 y 375. La API de navegador limitó la solicitud de 1180 a 1280, por lo que no se declara verificación exacta en 1180.
- Seguridad: sin red externa, sin CDN, bind solo loopback, no se ejecutó trading real, órdenes reales, APIs pagadas ni credenciales.

## Integridad y alcance

Los cambios rastreados y no rastreados ya presentes antes de esta ejecución se preservaron. Esta ejecución solo cambió `src/panel/contratos.ts` y `pruebas/prueba-panel.ts`, además de estos tres informes. No se hizo `git add`, commit, push, reset, clean, restore ni borrado.

## Visualización final

Se tomaron capturas reales del runtime a 1645×927, de página completa y del recorte del núcleo El Vórtice. La interfaz de captura disponible permite mostrarlas directamente en la entrega pero no escribir sus bytes en `artifacts/`; por ello no se afirma que existan archivos PNG locales. No se editó ninguna captura.

## Actualización cognitiva posterior

La API cognitiva local/read-only está implementada y validada. Expone únicamente datos existentes con límites, DTOs y trazabilidad; cuando un motor no está inicializado o no contiene datos devuelve `UNAVAILABLE` o `EMPTY`, sin fabricar actividad. La recuperación textual ya participa en `KnowledgeGraphEngine.rutear`.

El resultado 846/846 citado aquí es `COGNITIVE_API_INITIAL`, un **HISTORICAL
FACT**. Fue sucedido por TASKs 1–5 y el baseline actual 853/853. El proyecto
permanece PARTIAL/PENDING donde corresponde: UI cognitiva, integración de
TradingReasoning al retrieval, baseline histórico 3B.4, OOS ampliado/
robustness, backend de agentes/video, consolidación del panel legacy y Prop
Firm Lab. PNG persistentes: **NOT_VERIFIED**.

Hacer una revisión humana de la gran cantidad de cambios preexistentes/no
rastreados antes de decidir staging explícito o consolidación del panel legado.

## Hecho histórico de auditoría sandbox — ejecución autónoma GREEN-GATE (2026-09-27)

En la ejecución en sandbox restringido previo (Work environment), `ATLAS_SIN_RED=true npm run prueba`
resultó en 51 pass / 19 fail (70 archivos) por restricciones ambientales del entorno (`listen EPERM: operation not permitted 127.0.0.1` al abrir loopback). Dicho incidente quedó clasificado como limitación ambiental y no como regresión de producto; quedó plenamente superado en la validación en host local autorizado, donde todas las suites pasan en verde sin bloqueos de red local.

## Actualización de continuación autónoma — 2026-09-27

La evidencia de host local autorizada cerró TASK 6B/TASK 6 en verde con 853/853. La continuación auditó y endureció el contrato cognitivo para no emitir metadatos arbitrarios de memoria, y añadió la vista secundaria local `#cognitivo` en El Vórtice. Esta presenta estado, consulta, nodos, documentos/chunks/experimentos, procedencia, capas y presupuesto de contexto con estados `EMPTY`/`UNAVAILABLE` honestos. Se verificó en runtime loopback.

El cierre posterior fue 854/854 pass, 0 fail, 0 skip bajo `ATLAS_SIN_RED=true`; `git diff --check` pasó.

## Actualización — TASK 10 a TASK 15 y Hardening 11.1–15.1 (2026-09-27)

TASK 10 fue resuelto como GREEN (858/858). TASKs 11–15 fueron completadas (901/901 pass final):

| Task | Estado | Tests |
|------|--------|-------|
| TASK 10 TradingReasoning | GREEN | 858/858 |
| TASK 11 Historical Baseline | GREEN → Hardened (11.1) | 12/12 |
| TASK 12 OOS/Walk-Forward | GREEN → Hardened (12.1) | 12/12 |
| TASK 13 Prop Firm Foundation | GREEN → Hardened (13.1) | 18/18 |
| TASK 14 Challenge Simulator | GREEN → Hardened (14.1) | 10/10 |
| TASK 15 Final Review | GREEN → Hardened (15.1) | N/A |

Hardening corrigió: field mapping CSV, duplicate loader, persistence, cost labels, regime analysis, Critic integration, WF semantics, VERIFIED validation, account normalization, daily loss basis, TRAILING drawdown, INCOMPLETE result type.

Targeted hardening: 52/52 PASS. Full suite post-hardening: 910/910 PASS. Dataset SHA256 intact. No commit, no push.

## Final Closure Round — TASK 11.2 to TASK 15.2 (2026-09-27)

| Task | Estado | Targeted |
|------|--------|----------|
| TASK 11.2 Experiment Traceability + True No-Lookahead | GREEN | 14/14 |
| TASK 13.2 Execution-Time STALE Guard | GREEN | 29/29 |
| TASK 14.2 Challenge Semantics Final Fix | GREEN | 21/21 |
| TASK 15.2 True Final Reconciliation | GREEN | N/A |

Closure fixes: dataset traceability persisted (datasetId EURUSD_H1_DUKASCOPY_2021-2026), restart-safe recovery, true N→N+1 synthetic no-lookahead test, STALE blocked at execution, capital fallback eliminated, overnight/weekend rules enforced, INCOMPLETE precedence, 7 new failure reasons.

Targeted closure: 64 tests. Full suite: **923/923 PASS**, 0 fail, 0 skip. 74 test files. Dataset SHA256 intact. No commit, no push.

## Final Edge Closure Round — TASK 14.3 a TASK 15.3 (2026-09-27)

| Task | Estado | Targeted | Full Gate |
|------|--------|----------|-----------|
| TASK 14.3 Challenge Semantics Edge Hardening | GREEN | 27/27 | 929/929 |
| TASK 15.3 Cierre y Reconciliación Documental | GREEN | N/A | 929/929 |

Edge closure fixes:
- Prevalencia estricta de insuficiencia de datos (`hasDataInsufficiency` antes de fallos duros) produciendo `INCOMPLETE`.
- Manejo robusto de timestamps inválidos en reglas overnight y weekend (`OVERNIGHT_DATA_INSUFFICIENT`, `WEEKEND_DATA_INSUFFICIENT`).
- Detección precisa de solapamiento en fines de semana vía calendario UTC (`utcCalendarDay`) para operaciones viernes noche a sábado madrugada (`WEEKEND_POSITION_BREACH` si `weekendAllowed: false`).
- 6 tests dirigidos nuevos en `pruebas/prueba-challenge-simulator.ts` alcanzando 27/27 PASS.

Validación en host local:
- Las restricciones ambientales del sandbox de Work (que limitaron a 54/74 suites en aquella ejecución) quedan superadas por validación autorizada en host local.
- Full suite: **929/929 PASS, 0 FAIL, 0 SKIP, 0 CANCELLED** en 74 suites de prueba (17.8 s).
- `git diff --check`: PASS.
- Dataset canónico intacto (SHA256: `d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a`).
- Preservación íntegra de cambios staged preexistentes, sin commits ni pushes.

### Project Status: PROJECT_VERIFIED_STABLE

All TASKs 1–15 GREEN. All hardening and closure rounds (11.1–15.1, 11.2–15.2, 14.3–15.3) GREEN. Full host-local test suite: 929/929 PASS.

Remaining structural limitations (not blocking verification):
- Trailing drawdown: requires tick-level equity (DATA_INSUFFICIENT)
- Position limit: requires per-bar tracking (DATA_INSUFFICIENT)
- News restriction: requires economic calendar (DATA_INSUFFICIENT)
- Regime analysis: simple heuristic, not published model
- Cost assumptions: all labeled TEST_ASSUMPTION
- OOS/WF/challenge results: runtime only, NOT_PERSISTED
- Walk-forward: SEGMENTED (non-overlapping), not rolling
- `src/panel/` legacy: conserved, pending human review
