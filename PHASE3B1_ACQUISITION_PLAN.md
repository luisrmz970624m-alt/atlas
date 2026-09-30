# PHASE 3B.1 — REAL HISTORICAL FOREX ACQUISITION PLAN

**Date:** 2026-09-26  
**Status:** ⏳ PLANNING PHASE  
**Target:** EURUSD H1 + D1 historical data (Dukascopy)

---

## CORRECTIONS FROM PREVIOUS AUDIT

### OANDA Status Correction

**Previous audit claimed:**
```
FREE historical viewer
NO AUTH required
CSV DOWNLOAD available
NO PAYMENT
```

**Corrected status:**
```
Free viewer exists: LIMITED ACCESS
Historical CSV downloads: REQUIRE SUBSCRIPTION OR TRIAL
Access level: PRO tier or trial needed
Cost: PAID SERVICE
```

**Decision:** ❌ DO NOT USE OANDA as automatic source

---

## PRIMARY SOURCE: DUKASCOPY

**Official Forex Historical Data Export**

**Advantages:**
- ✅ Official data provider
- ✅ Free historical data available
- ✅ No subscription required for bulk export
- ✅ Bid/Ask tick data available
- ✅ Verifiable source
- ✅ No requester-pays AWS billing

**Access method:**
- Historical data export (public)
- CSV or custom format
- Verify current T&C before download

---

## ACQUISITION SEQUENCE

### Phase 1: EURUSD H1 (First validation)

```
Target:     EURUSD H1 (hourly)
Timeframe:  5 years (if available)
Format:     CSV or raw export
Output:     
  - raw/EURUSD_H1_raw.csv
  - normalized/EURUSD_H1_normalized.csv
```

### Phase 2: EURUSD D1 (Daily baseline)

```
Target:     EURUSD D1 (daily)
Timeframe:  10 years (if available)
Format:     CSV or raw export
Output:
  - raw/EURUSD_D1_raw.csv
  - normalized/EURUSD_D1_normalized.csv
```

### Phase 3: ECB Secondary Source (cross-validation)

```
Target:     ECB EUR/USD reference rate D1
Timeframe:  Available range
Source:     ECB Data Portal (official)
Type:       Reference rate (not trading candle)
Purpose:    Cross-check, NOT merge with market data
```

### Phase 4: Expand (if H1 successful)

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

## VALIDATION PIPELINE

For each dataset:

```
1. DOWNLOAD
   ↓
2. HASH (SHA256)
   ↓
3. INSPECT (provenance, structure)
   ↓
4. NORMALIZE (timestamps to UTC)
   ↓
5. QUALITY CHECK (OHLC, duplicates, gaps)
   ↓
6. REGISTER (DatasetRepository)
   ↓
7. READINESS CHECK (checkHistoricalReadiness)
   ↓
8. IF READY: Execute baseline (MA_CROSS 9/21/0.01)
   ↓
9. DOCUMENT RESULTS
```

---

## DATA STRUCTURE

### Raw Storage

```
datos/historical/forex/EURUSD/H1/raw/
├── EURUSD_H1_raw.csv
├── EURUSD_H1_raw.json (metadata)
└── EURUSD_H1_raw.SHA256
```

**Raw file = NEVER MODIFIED**

### Normalized Storage

```
datos/historical/forex/EURUSD/H1/normalized/
├── EURUSD_H1_normalized.csv
├── EURUSD_H1_normalized.json (metadata)
└── EURUSD_H1_normalized.SHA256
```

**Normalized file = UTC timestamps, validated OHLC**

---

## PROVENANCE REQUIREMENTS

Must register:

```
sourceName:           "DUKASCOPY"
sourceType:           "EXTERNAL_HISTORICAL"
instrument:           "EURUSD"
timeframe:            "H1"
requestedStartDate:   "YYYY-MM-DD"
requestedEndDate:     "YYYY-MM-DD"
actualStartDate:      "YYYY-MM-DD" (from data)
actualEndDate:        "YYYY-MM-DD" (from data)
retrievedAt:          "ISO8601 UTC"
originalTimezone:     "UTC"
barCount:             N
contentHash:          "SHA256(raw)"
normalizedHash:       "SHA256(normalized)"
format:               "CSV|JSON|custom"
bidAskHandling:       "OHLC close = ask/bid/midpoint"
transformations:      ["UTC normalization", "timestamp parsing"]
accessNotes:          "Public export, no auth required"
```

---

## DATA QUALITY CHECKS

For each file:

```
✅ Timestamp parsing
✅ Ascending order (no reversals)
✅ Duplicates (timestamp, OHLC)
✅ OHLC validity (H >= max(O,C), L <= min(O,C))
✅ Non-finite values (NaN, Inf)
✅ Value reasonableness (no -99999 or outliers)
✅ Bar count (expected vs actual)
✅ First/last timestamps
✅ Gap detection (heuristic)
✅ Decimal precision (consistent)

❌ NO AUTO-REPAIR
   → Report gaps, not fill them
   → Report duplicates, not deduplicate
   → Report invalid rows, not remove
```

---

## BID/ASK HANDLING

**If Dukascopy provides:**

```
Bid Open, Bid High, Bid Low, Bid Close
Ask Open, Ask High, Ask Low, Ask Close
```

**MUST:**
- ✅ Preserve both bid/ask separately in raw
- ✅ Document which side used for OHLC
- ✅ Do NOT silently midpoint
- ✅ Register transformation in provenance

**Typical choice for backtesting:**
- Close = Ask (fill at ask price)
- Open = Ask
- High = Ask high
- Low = Ask low

---

## DATASET REGISTRATION

Using Phase 3A infrastructure:

```python
from src.trading-lab.historical-dataset import (
  inicializarDatasetRepository,
  computeDatasetHash
)

repo = inicializarDatasetRepository()

{dataset, isNew} = repo.registerDataset(
  sourceName="EURUSD_H1_dukascopy_2021_2026",
  instrument="EURUSD",
  timeframe="H1",
  startDate=actualStart,
  endDate=actualEnd,
  contentHash=SHA256(normalized),
  sourceType="EXTERNAL_HISTORICAL",
  barCount=N,
  timezone="UTC"
)

if isNew:
    print(f"New dataset: {dataset.datasetId}")
else:
    print(f"Reused dataset: {dataset.datasetId} (same content)")
```

---

## READINESS GATE

After registration:

```python
from src.trading-lab.historical-readiness-gate import (
  checkHistoricalReadiness
)

readiness = checkHistoricalReadiness()

if readiness.readyToUseHistorical:
    print("✅ READY: Can execute historical baseline")
    # Run MA_CROSS 9/21/0.01 baseline
else:
    print(f"❌ BLOCKED: {readiness.blockedReason}")
    print(f"Status: {readiness.status}")
    for step in readiness.nextSteps:
        print(f"  - {step}")
```

---

## BASELINE EXECUTION (IF READY)

**Only if:**
- Dataset status = VERIFIED
- Readiness = READY
- No previous baseline on this dataset

**Execute:**
```
MA_CROSS:1.0
fast = 9
slow = 21
risk = 0.01

OBSERVATION ONLY:
- No parameter changes
- No optimizer
- No tuning
- Report metrics for documentation
```

**Output:**
```
datasetId:        (from dataset)
sourceType:       EXTERNAL_HISTORICAL
instrument:       EURUSD
timeframe:        H1
period:           [actual dates]
barCount:         N
trades:           T
PnL:              $X
return:           Y%
drawdown:         Z%
profitFactor:     F
sharpeRatio:      S (if computable)
commission:       C
```

---

## SECONDARY SOURCE: ECB

After EURUSD succeeds:

```
Purpose:    Cross-check reference rates
Source:     ECB Data Portal (official)
Frequency:  Daily (D1)
Series:     EUR/USD or equivalent

IMPORTANT:
- ECB reference rate != market candle
- Different methodology
- Use for macro validation only
- Do NOT merge with Dukascopy
```

---

## SIZE CONTROL

Before each batch:

```
Estimate download size:
- EURUSD H1 (5 years): ~200-300 MB
- EURUSD D1 (10 years): ~5-10 MB
- GBPUSD H1 (5 years): ~200-300 MB
- ... etc

If total projected > 100 GB:
  STOP
  REPORT
  ASK USER
```

---

## DOWNLOAD LOG

Update: `datos/historical/manifests/download-log.jsonl`

```json
{
  "timestamp": "2026-09-26T...",
  "dataset": "EURUSD_H1",
  "source": "DUKASCOPY",
  "status": "DOWNLOADED|VERIFIED|REUSED|...",
  "barCount": N,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "rawSize": "XXX MB",
  "normalizedSize": "YYY MB",
  "contentHash": "SHA256",
  "datasetId": "...",
  "notes": "..."
}
```

---

## NO FALLBACK RULE

If Dukascopy access fails:

```
❌ Do NOT use SYNTHETIC_DEMO
❌ Do NOT use TEST_FIXTURE
✅ Return: DATA_UNAVAILABLE

Escalate to user for next step.
```

---

## TESTS & VERIFICATION

Current baseline: 844 PASS, 0 FAIL

Add tests for:
- ✅ CSV parser (unit)
- ✅ Dataset registration (unit)
- ✅ Readiness gate (unit)
- ⚠️ Dukascopy download (integration, requires network)

Separate network tests:
- Don't block offline test suite
- Run only on explicit trigger

---

## NEXT IMMEDIATE STEPS

1. ✅ Verify Dukascopy access (no payment check)
2. ⏳ Download EURUSD H1 (if available)
3. ⏳ Validate and normalize
4. ⏳ Register dataset
5. ⏳ Check readiness
6. ⏳ Execute baseline (if READY)
7. ⏳ Download EURUSD D1
8. ⏳ Repeat steps 3-6

---

**Status: READY TO PROCEED WITH DUKASCOPY ACQUISITION**

**NO COMMIT. NO PUSH. Awaiting download execution.**

