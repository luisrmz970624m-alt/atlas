# PHASE 3B.1 — HISTORICAL DATA ACQUISITION STATUS

**Date:** 2026-09-26  
**Status:** ⏳ AWAITING DATA SOURCE  
**Current Action:** Plan defined, ready for manual data provision

---

## SOURCES EVALUATED

### 1. OANDA

**Previous classification (INCORRECT):**
```
FREE
NO AUTH
CSV DOWNLOAD ✓
NO PAYMENT ✓
```

**CORRECTED classification:**
```
Free viewer available: LIMITED ACCESS
CSV historical export: REQUIRES SUBSCRIPTION OR TRIAL
Pro tier: PAID
Trial: REQUIRES SIGNUP + VERIFICATION
```

**Status:** ❌ **DO NOT USE** (requires payment or trial signup)

---

### 2. DUKASCOPY (PRIMARY)

**Official Forex Historical Data Provider**

**Evaluation:**
- ✅ Public historical data export available
- ✅ Free data (no subscription for bulk export)
- ✅ No authentication typically required
- ✅ Bid/Ask tick data available
- ✅ Verifiable source (official)
- ✅ CSV or custom export format

**Status:** ✅ **READY** (if access confirmed)

**Next:** Verify access method (official website, export format, current T&C)

---

### 3. ECB DATA PORTAL (SECONDARY)

**Official European Central Bank Reference Rates**

**Evaluation:**
- ✅ Official source
- ✅ Public API + CSV
- ✅ No authentication
- ✅ Free

**Limitation:**
- EUR/USD reference rate (not trading candle)
- Different methodology than market data
- Use for macro validation only

**Status:** ✅ **READY** (after Dukascopy validated)

---

## DATA TARGETS

### Priority 1: EURUSD H1

```
Instrument:   EURUSD
Timeframe:    H1 (hourly)
Target period: 5 years (2021-2026)
Target bars:   ~40,000+
Purpose:       First validation
```

**Storage:** `datos/historical/forex/EURUSD/H1/{raw,normalized}/`

### Priority 2: EURUSD D1

```
Instrument:   EURUSD
Timeframe:    D1 (daily)
Target period: 10 years (2016-2026)
Target bars:   ~2,600+
Purpose:       Longer-term baseline
```

**Storage:** `datos/historical/forex/EURUSD/D1/{raw,normalized}/`

### Expansion (if H1 succeeds)

```
GBPUSD H1
USDJPY H1
USDCHF H1
AUDUSD H1
USDCAD H1
NZDUSD H1
(Then D1 variants)
```

---

## ACQUISITION PIPELINE

For each dataset:

```
[DOWNLOAD]
    ↓
[HASH & INSPECT]
    ↓
[NORMALIZE] (UTC timestamps, validate OHLC)
    ↓
[QUALITY CHECK] (gaps, duplicates, validity)
    ↓
[REGISTER] (DatasetRepository)
    ↓
[READINESS GATE] (checkHistoricalReadiness)
    ↓
[IF READY: BASELINE] (MA_CROSS 9/21/0.01 observation)
    ↓
[DOCUMENT RESULTS]
```

---

## DATA QUALITY VALIDATION

For each file:

✅ Timestamp parsing  
✅ Ascending order  
✅ No duplicates  
✅ OHLC consistency (H ≥ max(O,C), L ≤ min(O,C))  
✅ Non-finite values check  
✅ Value reasonableness  
✅ Bar count verification  
✅ Gap detection (heuristic, no repair)  
✅ Decimal precision  

❌ **NO AUTO-REPAIR:**
- Report gaps (don't fill)
- Report duplicates (don't remove)
- Report invalid (don't skip)

---

## PROVENANCE TRACKING

Every dataset must register:

```
sourceType:           EXTERNAL_HISTORICAL
sourceName:           DUKASCOPY | ECB | etc
instrument:           EURUSD
timeframe:            H1 | D1 | etc
startDate:            YYYY-MM-DD (requested)
endDate:              YYYY-MM-DD (requested)
actualStartDate:      YYYY-MM-DD (from data)
actualEndDate:        YYYY-MM-DD (from data)
barCount:             N
retrievedAt:          ISO8601 UTC
originalTimezone:     UTC
contentHash:          SHA256(raw)
normalizedHash:       SHA256(normalized)
format:               CSV | JSON | etc
bidAskHandling:       "close = ask price"
transformations:      ["UTC normalization", ...]
accessNotes:          "Public export"
```

---

## CONSTRAINTS ACTIVE

❌ **NO automatic downloads from undocumented endpoints**  
❌ **NO AWS requester-pays billing**  
❌ **NO credential signup without user approval**  
❌ **NO trial account creation**  
❌ **NO payment processing**  
❌ **NO synthetic historical data generation**  
❌ **NO TEST_FIXTURE fallback**  
❌ **NO parameter optimization on first baseline**  

✅ **Only free/public sources**  
✅ **Manual data provision acceptable**  
✅ **Observation-only baseline (no tuning)**  

---

## CURRENT PROJECT STATE

```
Tests:              844 PASS, 0 FAIL
Phase 2.9:          ACCEPTED
Phase 3A:           ACCEPTED
Phase 3B:           WAITING_FOR_DATA
  - Plan defined ✅
  - Sources evaluated ✅
  - Pipeline ready ✅
  - Awaiting data ⏳

Historical data:    BLOCKED_NO_DATA
Readiness:          INFRASTRUCTURE_READY_NO_DATA
```

---

## NEXT ACTIONS

**Manual path (recommended):**
1. User obtains EURUSD H1 CSV from Dukascopy (free public export)
2. Provides file: `/home/luisangel/atlas/datos/historical/forex/EURUSD/H1/raw/EURUSD_H1_raw.csv`
3. Phase 3B.1 processes and validates
4. If passes: Registers dataset, runs baseline

**Automated path (future):**
1. Implement Dukascopy API client (after manual validation)
2. Schedule periodic updates
3. Extend to other pairs

**Blocked paths (DO NOT PURSUE):**
- ❌ OANDA (requires subscription)
- ❌ AWS requester-pays
- ❌ API keys requiring signup
- ❌ Synthetic/demo historical

---

## WAITING FOR

One of:

- ✅ EURUSD H1 CSV file (Dukascopy export, any year range available)
- ✅ EURUSD D1 CSV file (Dukascopy export, any year range available)
- ✅ User confirmation to proceed with alternative source

---

**Status: READY TO INGEST HISTORICAL DATA**

**Awaiting: Manual provision of EURUSD H1/D1 CSV files**

**NO COMMIT. NO PUSH. Paused.**

