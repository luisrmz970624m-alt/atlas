# ATLAS AUDIT HANDOFF — HARDENING 11.1–15.1 + CLOSURE 11.2–15.2 + EDGE CLOSURE 14.3–15.3

**Date:** 2026-09-27
**Author:** Claude Opus 4.6 / Antigravity
**Purpose:** Independent audit by external reviewer

---

## Source files

| Path | Task | Reason |
|------|------|--------|
| `src/trading-lab/csv-historical-loader.ts` | 11.1 | Fixed field mapping (timestamp→fecha, open→apertura, etc.), added `loadCSVHistoricalSync`, added SerieHistorica fields (id/intervalo/origen), maxBars 10000→100000 |
| `src/trading-lab/historical-baseline.ts` | 11.1 | Eliminated duplicate loadAndMapCSV (now delegates to canonical loader), added DatasetIdentity, CostAssumption (TEST_ASSUMPTION), FIRST_HISTORICAL_OBSERVATION metadata, real persistence via RepositorioExperimentos |
| `src/trading-lab/oos-walkforward.ts` | 12.1 | Added RegimeAnalysis (detectRegimeFromSeries), TradingCriticAnalysis (buildCriticAnalysis), walkForwardSemantics='SEGMENTED', baselineRunId field |
| `src/trading-lab/prop-firm.ts` | 13.1 | VERIFIED now requires url+retrievedAt, STALE produces error, added validateProgram() |
| `src/trading-lab/challenge-simulator.ts` | 14.1+14.2+14.3 | Account normalization (scaleFactor), dailyLossBasis='REALIZED_PNL', TRAILING→DATA_INSUFFICIENT, INCOMPLETE result type, ChallengeContext (no capital fallback), STALE guard, overnight/weekend enforcement, INCOMPLETE precedence, invalid timestamp handling, calendar-day weekend overlap, 20 failure reasons total, dataLimitations array |
| `src/trading-lab/experimentos.ts` | 11.2 | Added optional fields: dataset?, experimentType?, parameterSource?, costSource? |

## Test files

| Path | Task | Result |
|------|------|--------|
| `pruebas/prueba-historical-baseline.ts` | 11.1+11.2 | 14/14 PASS (added: restart-safe persistence, true N→N+1 synthetic no-lookahead) |
| `pruebas/prueba-oos-walkforward.ts` | 12.1 | 12/12 PASS (was 9, added: regime, critic, WF semantics) |
| `pruebas/prueba-prop-firm.ts` | 13.1 | 18/18 PASS (was 14, added: VERIFIED validation, STALE, validateProgram, accountSize) |
| `pruebas/prueba-challenge-simulator.ts` | 14.1+14.2+14.3 | 27/27 PASS (added: 6 tests for INCOMPLETE precedence, invalid overnight/weekend timestamps, Fri 23:00 to Sat 01:00 weekend overlap) |

## Result files

| Path | Content | Persistence |
|------|---------|-------------|
| `datos/trading-experimentos.json` | Experiment records (collection format: {version, experimentos[], ultimaActualizacion}) | REAL — JSON file, atomic writes. Note: file was corrupted during hardening by calling private guardar() instead of public guardarExperimento(); restored to collection format and fixed the call. |
| Runtime: regime analysis | RegimeAnalysis object from detectRegimeFromSeries | NOT_PERSISTED — computed at runtime |
| Runtime: critic analysis | TradingCriticAnalysis from buildCriticAnalysis | NOT_PERSISTED — computed at runtime |
| Runtime: challenge evaluation | ChallengeEvaluation with all new fields | NOT_PERSISTED — computed at runtime |

## Reports

| Path | Status |
|------|--------|
| `CODEX_ATLAS_TASK_GREEN_REPORT.md` | Updated with TASK 11.1–15.1 hardening and 11.2–15.3 closure details |
| `CODEX_ATLAS_IMPLEMENTATION_LOG.md` | Updated in closure rounds 15.2 and 15.3 |
| `CODEX_ATLAS_FINAL_REPORT.md` | Updated in closure rounds 15.2 and 15.3 |
| `CODEX_ATLAS_FINAL_WORKLIST.md` | Updated in closure rounds 15.2 and 15.3 |
| `ATLAS_AUDIT_HANDOFF.md` | This file — updated in closure rounds 15.2 and 15.3 |

## Baseline

| Metric | Value |
|--------|-------|
| Targeted tests (hardened 11.1–14.1) | 52 |
| Targeted tests (closure 11.2–14.2) | 64 |
| Targeted tests (edge closure 14.3) | 27 (challenge simulator) |
| Full suite tests | 929 |
| Full suite pass | 929 |
| Full suite fail | 0 |
| Full suite skip | 0 |
| Full suite cancelled | 0 |
| Test files (suites) | 74 |
| git diff --check | PASS (exit 0) |

## Dataset

| Field | Value |
|-------|-------|
| Canonical datasetId | EURUSD_H1_DUKASCOPY_2021-2026 |
| Source descriptor | DUKASCOPY_BID_UTC |
| SHA256 | d9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a |
| CSV lines | 35,651 (1 header + 35,650 data) |
| Data bars | 35,650 |
| Source | Dukascopy |
| Timeframe | H1 |
| Timezone | UTC |
| Bid/Ask side | BID |

## Remaining limitations

1. **Daily loss basis**: Uses REALIZED_PNL only (closed trades by exit date), not intraday equity curve — labeled in output
2. **Trailing drawdown**: Cannot compute from backtest data (needs tick-level equity); reports TRAILING_DRAWDOWN_DATA_INSUFFICIENT
3. **Position limit**: Cannot enforce from backtest data (needs per-bar position count); reports POSITION_LIMIT_DATA_INSUFFICIENT
4. **News restriction**: Cannot enforce (needs economic calendar); reports NEWS_RULE_DATA_INSUFFICIENT
5. **Regime analysis**: Uses simple price-change + volatility heuristic, not a published regime detection model
6. **Critic analysis**: Standalone implementation mirroring TradingReasoning.aplicarCritico() logic, not calling the class method directly (class requires KnowledgeGraph + MemoryLayers instantiation)
7. **Cost assumptions**: All labeled TEST_ASSUMPTION — not derived from real broker data
8. **Full suite**: 929/929 PASS confirmed in host-local environment (74 suites); previous Work environment limitation (54/74) superada sin regresión de producto.
9. **Experiment persistence**: runHistoricalBaseline writes to datos/trading-experimentos.json, but OOS/WF/challenge results are NOT_PERSISTED (runtime only)
10. **Walk-forward**: SEGMENTED (non-overlapping), not rolling or expanding — labeled in output

## Files NOT modified in hardening

The following files were inspected but NOT changed:

- `src/trading-lab/tipos.ts` — Canonical types, no changes needed
- `src/trading-lab/backtest.ts` — Engine unchanged
- `src/trading-lab/experimentos.ts` — Used as-is (imported RepositorioExperimentos)
- `src/trading-lab/trading-reasoning.ts` — Types imported only (MarketRegime, TradingCriticAnalysis)
- `src/trading-lab/knowledge-graph.ts` — Not touched
- `src/trading-lab/memory-layers.ts` — Not touched
- `src/trading-lab/historical-dataset.ts` — Not touched
