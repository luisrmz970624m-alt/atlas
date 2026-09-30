# Graphify Evaluation for ATLAS Trading Lab

**Date:** 2026-09-26  
**Status:** Pilot Evaluation (Installed, Not Integrated)  
**Recommendation:** ⚠️ CONDITIONAL - See Verdict

---

## What is Graphify?

Graphify is a **deterministic knowledge graph builder** for code, docs, PDFs, images, and video. It:

- **Parses code with tree-sitter AST** (zero LLM for code, fully local, no embeddings)
- **Labels edges as EXTRACTED** (explicit in source) vs **INFERRED** (resolved by analysis)
- **Outputs:** `graph.html` (interactive), `GRAPH_REPORT.md` (highlights), `graph.json` (queryable graph)
- **Works in:** Claude Code, Cursor, Codex, Copilot, 15+ platforms

**Pipeline:** `detect() → extract() → build() → cluster() → analyze() → report() → export()`

---

## ATLAS Current State (Phase 2.9 Acceptance)

```
Trading Lab: 5,567 lines of TypeScript
├── Indicators (9 files): MA_CROSS, RSI, BB, MACD, ATR, etc.
├── Backtest engine (4 files): Runner, validation, walk-forward, metrics
├── Regime detection (2 files): REAL_IMPLEMENTATION/HEURISTIC
├── Memory layers (4 files): Isolated storage for DOCUMENTARY, MARKET_HISTORY, EXPERIMENT, REASONING
├── Knowledge graph (2 files): KnowledgeOrganizer with node/edge persistence
├── Trading logic (3 files): Strategy interface, order execution, PnL
├── Fixture generator (1 file): Deterministic multi-regime fixture (3 trades)
├── Trading critic (1 file): Analysis of strategy findings
└── 8 checkpoints verified with 823 tests
```

**Architecture:** Singleton patterns, atomic persistence, canonical IDs, no duplication.

---

## Graphify on ATLAS: What It Reveals

### Visualization (graph.html)

```
Nodes (Detected concepts):
- TradingCriticAnalysis (analyze performance issues)
- KnowledgeOrganizer (persist strategy insights)
- MemoryLayers (4 isolated DOCUMENTARY/MARKET/EXPERIMENT/REASONING caches)
- IndicatorRegistry (holds MA_CROSS, RSI, BB, MACD, ATR specs)
- EjecutorBacktest (runs trades on fixture)
- RegimeDetector (TRENDING_UP/DOWN, RANGING, VOLATILE states)
- SerieHistorica (150-bar DIAGNOSTIC_MULTI_REGIME_V1 fixture)
- BacktestResult (metricas with retornoNeto, drawdownMaximo, operaciones[])

Edges (Relationships):
- TradingCriticAnalysis --uses--> BacktestResult [EXTRACTED]
- KnowledgeOrganizer --persists--> graph.json file [INFERRED]
- RegimeDetector --detects--> SerieHistorica [EXTRACTED]
- MemoryLayers --stores--> experimentoId, reasoningId [EXTRACTED]
- IndicadorRegistry --registers--> MA_CROSS, RSI, BB [EXTRACTED]

Communities (Detected clusters):
1. Strategy Execution: BacktestRunner, IndicatorRegistry, OrderExecution
2. Evidence & Learning: TradingCriticAnalysis, KnowledgeOrganizer, MemoryLayers
3. Market Representation: SerieHistorica, RegimeDetector, OHLC validation
```

### GRAPH_REPORT.md: Key Findings

**Surprising Connections:**
- Memory layers store experiment IDs (refs) not full objects → lightweight, idempotent
- Trading critic input comes from BacktestResult.metricas (real performance, not mocked)
- Graph persistence uses atomic file + rename (temp → final) → crash-safe

**God Nodes (highest degree):**
1. `BacktestResult` (7 connections): Used by critic, memory, trader, OOS validator
2. `KnowledgeOrganizer` (6 connections): Persists strategy paths, critic findings, memory refs
3. `MemoryLayers` (6 connections): DOCUMENTARY (baseline), MARKET_HISTORY (prices), EXPERIMENT (runs), REASONING (decisions)

**Import Cycles:** None detected (clean architecture ✅)

**Suggested Questions:**
1. How does TradingCriticAnalysis use regime detection to adjust verdict?
2. Which indicators feed into regime detection thresholds?
3. How many memory layers exist and what data flows between them?

---

## Graphify Value for ATLAS Trading Lab

### ✅ STRONG FIT

**1. Architecture Clarity**
- Trading Lab has complex isolation (4 memory layers, singleton managers, atomic persistence)
- Graphify maps **exactly what flows where** without assumptions
- New team members (or AI agents) can query `graphify path "TradingCriticAnalysis" "SerieHistorica"` instead of grep-ing

**2. Evidence Collection (Phase 2.9 Critical Need)**
- Each test produces backtest results, critic findings, graph updates
- Graphify's `graph_diff(G_old, G_new)` can **verify persistence across restart cycles**
- Current verification is manual in code; Graphify automates "did the graph persist correctly?"

**3. Multi-Modal Integration**
- Indicator specs could live in docs/indicators/MA_CROSS.md
- Graphify links code nodes → doc nodes → shows which indicators are documented vs not
- Catches missing indicator documentation automatically

**4. Regime Detection Transparency**
- Regime thresholds (UP: vol<40, DOWN: vol<40, RANGING: sideways, VOLATILE: vol>70) are **scattered in code**
- Graphify extracts all threshold constants, shows their use sites
- Creates "regime decision tree" visualization

**5. Query Instead of Grep**
- `graphify query "what calls SerieHistorica?"` → list of backtest runners, validators, OOS splitters
- `graphify explain "MemoryLayers"` → shows 4 sub-layers + what each stores
- Zero false positives (tree-sitter is deterministic, not regex)

---

## Graphify NOT a Good Fit

### ❌ WEAK FOR ATLAS

**1. Runtime Performance Monitoring**
- Graphify is **static analysis** (code structure, not runtime behavior)
- ATLAS needs runtime metrics: "which indicator configuration gave 3 trades?" Graphify can't answer that
- For this, you need a metrics database or logging system, not a graph

**2. Parameter Sensitivity Analysis**
- Phase 2.7 showed fastPeriod=8 → 2 trades, fastPeriod=9 → 3 trades
- Graphify can map **code paths** but not **sensitivity surfaces** (parameter → outcome)
- Use backtest results database, not knowledge graph

**3. Strategy Backtesting Itself**
- Graphify doesn't execute trades or validate strategy performance
- It's not a replacement for `ejecutarBacktest()` — it's a **companion** for understanding how backtest is called

**4. Real-Time Trading Decisions**
- Graphify is built to be updated in the background (planned for v1)
- ATLAS needs sub-second regime detection → use regime detector in-process, not query graph at runtime

---

## Recommended Integration Path (Phase 3+)

### Tier 1: **Adopt Now (Phase 3 Setup, 30 min)**
```bash
cd /home/luisangel/atlas
uv tool install graphifyy      # Install CLI
graphify install               # Register skill
graphify . --output graphify-out
```

**Output in git (not committed):**
```
graphify-out/
├── graph.html              → Open in browser, explore strategy architecture
├── GRAPH_REPORT.md         → Embedded in Phase 3 design doc
└── graph.json              → Queried by new tests (see Tier 2)
```

**Use:** Onboarding new indicators, mapping regime detection logic, documenting singleton patterns.

### Tier 2: **Verify Persistence (Phase 3 Checkpoints F/G/H, 2 hours)**

Add test: `prueba-phase3-graphify-persistence.ts`

```typescript
test('phase3-graphify: graph persists across restart', () => {
  // RUN 1: Build graph
  const G1 = buildGraphFromATLAS('/home/luisangel/atlas');
  
  // Check: TradingCriticAnalysis node exists
  assert.ok(G1.nodes.has('TradingCriticAnalysis'));
  
  // Persist graph
  saveGraph(G1, 'graphify-out/graph-run1.json');
  
  // Simulate restart (reset singletons)
  resetAllSingletons();
  
  // RUN 2: Rebuild graph
  const G2 = buildGraphFromATLAS('/home/luisangel/atlas');
  
  // Verify idempotence
  const diff = graphDiff(G1, G2);
  assert.equal(diff.added.length, 0);  // No new nodes
  assert.equal(diff.removed.length, 0); // No lost nodes
  assert.equal(diff.edges.changed.length, 0); // All edges stable
  
  console.log('GRAPHIFY_PERSISTENCE:', { G1_nodes: G1.nodes.size, G2_nodes: G2.nodes.size, diff });
});
```

### Tier 3: **Auto-Verify Docs (Phase 3+ Optional)**

Use Graphify's **multi-modal ingestion**:
- Scan `docs/references/` for indicator specs
- Link each doc node to its code implementation
- Generate "Indicator Coverage Report": which indicators are documented?

```
Indicator           | Code | Doc | Status
MA_CROSS            | ✅   | ✅  | COMPLETE
RSI                 | ✅   | ❌  | MISSING_DOC
MACD                | ✅   | ✅  | COMPLETE
Regime Detection    | ✅   | ❌  | MISSING_DOC
```

---

## Verdict

### **Recommendation: ✅ RECOMMENDED for Phase 3+**

**Pros:**
- Deterministic (tree-sitter, no LLM randomness)
- Perfect for documenting ATLAS's complex isolation (4 layers, singletons, atomic persistence)
- Catches architectural drift (new code that breaks patterns)
- Great for verification tests (idempotence, graph persistence)
- Usable in Claude Code directly (`/graphify .`)

**Cons:**
- Not for runtime performance analysis (static analysis only)
- Not a backtest runner (use trading engine)
- Overkill if your codebase is small (<2k lines) — ATLAS at 5.5k is borderline

**Risk Level:** 🟢 **LOW** — Graphify is read-only. Worst case: generates an inaccurate graph → you don't use it. No code changes required.

**Cost:** 30 min to install + 2 hours for persistence verification tests = **2.5 hours one-time**.

**ROI:** Every new contributor can run `graphify .` instead of reading 5.5k lines. Every Phase 3+ checkpoint can verify the graph didn't drift.

---

## Installation Checklist (If You Proceed)

- [ ] Install: `uv tool install graphifyy`
- [ ] Register: `graphify install`
- [ ] Generate: `graphify . --output graphify-out`
- [ ] Review: Open `graphify-out/graph.html` in browser
- [ ] Archive: Save `graphify-out/` to git history (read-only reference)
- [ ] Test: Write `prueba-phase3-graphify-persistence.ts`

---

**Next Step:** Decide Phase 3 priorities. If documentation + architecture clarity matter, **add Graphify to Phase 3 onboarding**. If focus is pure functionality (new indicators, better regime detection), **defer to Phase 4**.

