# PHASE 2.5 — EVIDENCE REPORT
## Corrección de Overclaims con Datos Reales

**Fecha:** 2026-09-26  
**Status:** Functional Proof — Números vs Claims

---

## CONTEO FINAL

| Métrica | Valor |
|---|---|
| Tests Phase 2 original | 788 PASS |
| Tests Phase 2.5 evidence | 6 NEW |
| **Total** | **794 PASS, 0 FAIL** |

---

## EVIDENCE: MA_CROSS:1.0 CON TEST_FIXTURE (100 bars EURUSD H1)

### Baseline Parameters
```
fastPeriod: 9
slowPeriod: 21
riskPerOperation: 0.01
capitalInicial: 10000
commission: 0.1%
spread: 0.05%
slippage: 0.01%
semilla: 42 (deterministic)
```

### Baseline Backtest Result
```
trades: 0
retornoNeto: 0%
maxDrawdown: 0%
profitFactor: null
comisiones: 0 (no trades)
```

### Parameter Variants — Fast Period (8, 9, 10)
```
fast=8:  trades=0, return=0%, DD=0%
fast=9:  trades=0, return=0%, DD=0%  [BASELINE]
fast=10: trades=0, return=0%, DD=0%
```

**Sensitivity Marker:** Trade counts identical → **NO SENSITIVITY DETECTABLE**

### Baseline Stability (3 consecutive runs)
```
run1: trades=0, return=0%, DD=0%
run2: trades=0, return=0%, DD=0%
run3: trades=0, return=0%, DD=0%
```

**Reproducibility:** ✅ VERIFIED — Deterministic

---

## CHECKPOINT CORRECTIONS

### B — Parameter Sensitivity
**Claim:** "FRAGILITY_TESTED"  
**Reality:** trades=0 → unmeasurable  
**Corrected:** `UNMEASURABLE_INSUFFICIENT_TRADES`  
**Tests added:** 6 PASS

### D — OOS / Walk-Forward
**Claim:** "EVIDENCE_COLLECTED"  
**Reality:** All splits produce 0 trades  
**Corrected:** `STRUCTURE_VERIFIED_DEGRADATION_UNMEASURABLE`

### E — Robustness
**Renamed:** `CAPITAL_SCALING_INVARIANCE` (not robustness)

### F — Critic
**Status:** `INTERFACE_EXISTS_INTEGRATION_NOT_TESTED`

### H — Restart Idempotence
**Status:** `PROCESS_IDEMPOTENT_RESTART_UNVERIFIED`

---

## ROOT CAUSE: FIXTURE LIMITATION

**Test fixture:** 100-bar gentle uptrend
**Result:** MA9 never crosses MA21 → 0 trades
**Impact:** Cannot measure sensitivity, degradation, critic output with zero signals

**Solution needed for Phase 3:** New fixture with regime changes

---

## GUARANTEES MAINTAINED ✅

794 PASS, 0 FAIL  
No regression | No commits | Deterministic | No real trading

