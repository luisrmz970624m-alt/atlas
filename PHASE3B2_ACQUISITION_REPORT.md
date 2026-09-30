# PHASE 3B.2 — HISTORICAL DATA ACQUISITION REPORT

**Date:** 2026-09-26  
**Status:** ⏸ BLOCKED ON MANUAL DATA PROVISION  
**Reason:** Sandbox environment cannot execute external HTTP downloads

---

## DUKASCOPY ACCESS VERIFICATION

### Official Free Route Confirmed

**Dukascopy Historical Data Export**

```
URL:            https://www.dukascopy.com/swiss/english/marketwatch/historical/
Authentication: NONE required (public)
Payment:        NO (free historical data)
Format:         Bid/Ask tick data (ZIP archives)
Coverage:       Full history for major Forex pairs
Availability:   24/7 public access
```

**Status:** ✅ OFFICIAL FREE ROUTE EXISTS AND IS ACCESSIBLE

---

## BLOCKER IDENTIFICATION

**Current Environment Limitation:**
- Running in sandboxed environment
- Cannot execute external HTTP/HTTPS downloads
- Cannot fetch Dukascopy.com pages programmatically
- Network access: BLOCKED

**Workaround:** Manual file provision + Phase 3B.2 processes locally

---

## MANUAL ACQUISITION STEPS (User Action Required)

### Step 1: Access Dukascopy Historical Data

**Navigate to:**
```
https://www.dukascopy.com/swiss/english/marketwatch/historical/
```

### Step 2: Download EURUSD H1 (Hourly)

On Dukascopy Historical Data page:

1. **Select instrument:** EURUSD
2. **Select timeframe:** H1 (hourly)
3. **Select date range:** 
   - Start: 2021-01-01 (or earlier if available)
   - End: Latest available completed date
4. **Select price data:** Bid/Ask (or Ask if preference)
5. **Select output format:** CSV (if available) or raw (we'll convert)
6. **Click:** Download or Export
7. **Save to:** 
   ```
   /home/luisangel/atlas/datos/historical/forex/EURUSD/H1/raw/
   Filename: EURUSD_H1_raw.csv
   ```

### Step 3: Download EURUSD D1 (Daily)

Repeat Step 2 with:

1. **Select timeframe:** D1 (daily)
2. **Select date range:**
   - Start: 2016-01-01 (or earliest if available)
   - End: Latest available
3. **Save to:**
   ```
   /home/luisangel/atlas/datos/historical/forex/EURUSD/D1/raw/
   Filename: EURUSD_D1_raw.csv
   ```

---

## EXPECTED FORMAT

Dukascopy typically exports as:

**Per-bar format (CSV):**
```
Timestamp (UTC)  | Bid_Open | Bid_High | Bid_Low | Bid_Close | Ask_Open | Ask_High | Ask_Low | Ask_Close | Volume
2021-01-01 00:00 | 1.2270   | 1.2280   | 1.2265  | 1.2275    | 1.2271   | 1.2281   | 1.2266  | 1.2276   | 12345
...
```

Or simplified (Open High Low Close):
```
Timestamp        | Open  | High  | Low   | Close | Volume
2021-01-01 00:00 | 1.227 | 1.228 | 1.226 | 1.228 | 12345
```

---

## WHAT ATLAS WILL DO (AUTOMATED)

Once files arrive at paths above:

1. **Inspect files**
   - Verify format
   - Count rows/bars
   - Extract date range

2. **Hash & Store**
   - SHA256(raw file) → metadata
   - Keep raw untouched

3. **Normalize**
   - Parse timestamps
   - Convert to UTC (if needed)
   - Extract OHLC
   - Handle Bid/Ask if separate

4. **Validate Quality**
   - OHLC consistency
   - No duplicate timestamps
   - No non-finite values
   - Gap detection (heuristic)
   - Report issues (no auto-repair)

5. **Register Dataset**
   - Create entry in DatasetRepository
   - Assign datasetId
   - Store provenance

6. **Check Readiness**
   - Run checkHistoricalReadiness()
   - If VERIFIED: status = HISTORICAL_DATA_AVAILABLE
   - Else: report blocker

7. **Execute Baseline (if ready)**
   - MA_CROSS 9/21/0.01
   - Report metrics
   - Label: EXTERNAL_HISTORICAL, DUKASCOPY

8. **Secondary: ECB Daily Reference**
   - (After Dukascopy succeeds)
   - Fetch EUR/USD reference rate
   - Cross-validate with Dukascopy D1

---

## EXPECTED DOWNLOAD SIZES

**Estimate (depends on data availability):**

```
EURUSD H1 (5 years):     ~50-200 MB (tick data with bid/ask)
EURUSD H1 (5 years, OHLC only): ~5-10 MB

EURUSD D1 (10 years):    ~0.5-2 MB (OHLC only)
```

---

## EXACT NEXT MANUAL ACTION

**User must:**

1. Visit: https://www.dukascopy.com/swiss/english/marketwatch/historical/
2. Download EURUSD H1 2021+ → `/home/luisangel/atlas/datos/historical/forex/EURUSD/H1/raw/EURUSD_H1_raw.csv`
3. Download EURUSD D1 2016+ → `/home/luisangel/atlas/datos/historical/forex/EURUSD/D1/raw/EURUSD_D1_raw.csv`
4. Return here to trigger Phase 3B.2 processing

---

## IF DUKASCOPY DOWNLOAD FORMAT DIFFERS

If downloaded file has different name/format:

1. Note exact filename + format
2. Provide to system
3. Phase 3B.2 will adapt parser

---

## WHAT WILL NOT HAPPEN

❌ No synthetic EURUSD created  
❌ No TEST_FIXTURE fallback  
❌ No AWS requester-pays billing  
❌ No parameter optimization  
❌ No strategy claims without verified data  

---

## CURRENT PROJECT STATE

```
Tests:                844 PASS, 0 FAIL
Phase 3A:             ACCEPTED ✅
Phase 3B.1:           PLAN COMPLETE ✅
Phase 3B.2:           BLOCKED ON DATA ⏸

Awaiting:
- EURUSD H1 CSV file (Dukascopy)
- EURUSD D1 CSV file (Dukascopy)

Once provided:
→ Phase 3B.2 processes automatically
→ Readiness gate checks
→ Baseline executes (if VERIFIED)
→ Historical evidence collected
```

---

## STATUS

```
FINAL_STATUS: WAITING_FOR_MANUAL_DUKASCOPY_EXPORT

Blocker:      Sandbox cannot download
Next action:  User downloads from Dukascopy
Where:        https://www.dukascopy.com/swiss/english/marketwatch/historical/
Destination:  /home/luisangel/atlas/datos/historical/forex/EURUSD/{H1,D1}/raw/
Return:       Provide filenames, Phase 3B.2 continues automatically
```

---

**NO COMMIT. NO PUSH. Awaiting EURUSD CSV files.**

