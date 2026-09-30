# PHASE 2.7 — EVIDENCE RECOLLECTION ON DIAGNOSTIC FIXTURE
## Real Data (3 Trades) vs Phase 2.5 (0 Trades)

**Date:** 2026-09-26  
**Status:** EVIDENCE_RECOLLECTION_PARTIAL

---

## TEST SUITE

| Phase | Tests | Pass | Fail |
|---|---|---|---|
| Phase 2 original | 788 | 788 | 0 |
| Phase 2.5 fixture validation | 6 | 6 | 0 |
| Phase 2.6 fixture diagnostics | 6 | 6 | 0 |
| **Phase 2.7 evidence (B+C)** | **8** | **8** | **0** |
| **TOTAL** | **808** | **808** | **0** ✅ |

---

## DIAGNOSTIC FIXTURE ACTIVE

```
ID: DIAGNOSTIC_MULTI_REGIME_V1
Seed: 42
Bars: 150
Symbol: EURUSD
Timeframe: H1
Source: TEST_FIXTURE

Baseline MA_CROSS (9/21/0.01):
  Trades: 3
  Return: -0.857%
  Drawdown: 0.92%
  Profit Factor: 0
```

---

## CHECKPOINT B — PARAMETER SENSITIVITY

### Evidence Status: MEASURABLE ✅

**Before (Phase 2.5):** 0 trades → unmeasurable  
**After (Phase 2.7):** 3 trades → measurable

### Parameter Variants — Fast Period (8, 9, 10)

```
fast=8, slow=21:  trades=2, return=-0.483%, DD=0.55%
fast=9, slow=21:  trades=3, return=-0.857%, DD=0.92%  [BASELINE]
fast=10, slow=21: trades=3, return=-0.857%, DD=0.92%
```

**Finding:** Trade count differs (2 vs 3) → **PARAMETER AFFECTS EXECUTION**

### Classification

```
Status: MEASURABLE
Sensitivity: DETECTED (trade count variation)
Sample Size: LIMITED (3 baseline trades)
Sample Sufficiency: INSUFFICIENT_FOR_STATISTICAL_CLAIMS
Assessment: PIPELINE_FUNCTIONALITY_VERIFIED
```

---

## CHECKPOINT C — COMMISSION SENSITIVITY

### Evidence Status: MEASURABLE ✅

**Baseline:** 0.1% commission

**Variants:**
- 1.0x (0.1%): baseline
- 1.5x (0.15%): higher cost
- 2.0x (0.2%): double cost

**Finding:** Commission impact depends on trade execution. With 3 trades, measurable but limited sample.

### Sample Status

```
Trade Count: 3 (identical across commission multipliers)
Total Commission Impact: PROPORTIONAL_TO_MULTIPLIER
Return Degradation: MEASURABLE_BUT_LIMITED_SAMPLE
```

---

## CHECKPOINTS D-H STATUS

### D — OOS / Walk-Forward
**Status:** PENDING  
(Requires separate fixture-split tests)

### F — Trading Critic
**Status:** PENDING  
(Requires critic integration with backtest results)

### G — Knowledge Graph + Memory
**Status:** PENDING  
(Requires graph persistence tests)

### H — Restart Idempotence
**Status:** PENDING  
(Requires persist→reload→verify cycle)

---

## VALIDATION POLICY

✅ **MAINTAINED**

```
ValidationPolicy: UNCONFIGURED
overallScore: INSUFFICIENT_DATA
No composite scoring attempted
```

---

## IMPORTANT LIMITATIONS

1. **Sample Size:** 3 trades is insufficient for:
   - Statistical robustness claims
   - Generalization to other fixtures
   - Strategy validation

2. **Fixture Scope:** Synthetic multi-regime, **NOT** real market data

3. **Baseline Negative:** -0.857% return demonstrates:
   - Strategy is NOT profitable on this fixture
   - Not designed for returns, only for testing pipeline

4. **Source Type:** All evidence is `TEST_FIXTURE`

---

## VERDICT BY CHECKPOINT

| Checkpoint | Phase 2.5 | Phase 2.7 | Status |
|---|---|---|---|
| **A** Regime | VERIFIED | ✅ | VERIFIED |
| **B** Parameter | UNMEASURABLE | ✅ MEASURABLE | IMPROVED |
| **C** Commission | FRAMEWORK_ONLY | ✅ MEASURABLE | IMPROVED |
| **D** OOS/WF | PARTIAL | - | PENDING |
| **E** Capital Scaling | RENAMED | ✅ | CORRECTED |
| **F** Critic | NOT_IMPLEMENTED | - | PENDING |
| **G** Graph | PARTIAL | - | PENDING |
| **H** Restart | PARTIAL | - | PENDING |

---

## PHASE 2.7 STATUS

✅ **EVIDENCE_RECOLLECTION_PARTIAL**

- B: Measurable evidence collected ✅
- C: Measurable evidence collected ✅
- D, F, G, H: Pending implementation

---

## GUARANTEES MAINTAINED

✅ 808 PASS, 0 FAIL  
✅ No commits  
✅ No MA_CROSS optimization (9/21/0.01 unchanged)  
✅ Deterministic (seed=42)  
✅ TEST_FIXTURE only  
✅ No real trading  
✅ Atomic persistence  

---

**NEXT PHASE:** Implement tests for D, F, G, H to complete evidence recollection.

