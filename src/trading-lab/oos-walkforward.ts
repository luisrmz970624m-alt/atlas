/** OOS / Walk-Forward / Robustness Analysis — TASK 12.
 * Uses existing backtest engine. NO optimization. NO new TradingEngine. */

import type { SerieHistorica, VelaHistorica, EstrategiaCruceMedias, ConfiguracionBacktest, ResultadoBacktest } from './tipos.ts';
import { ejecutarBacktest } from './backtest.ts';
import { clasificarExperimento } from './experimentos.ts';
import type { MarketRegime, TradingCriticAnalysis } from './trading-reasoning.ts';

export interface OOSSplit {
  inSample: SerieHistorica;
  outOfSample: SerieHistorica;
  splitIndex: number;
  splitRatio: number;
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainSerie: SerieHistorica;
  testSerie: SerieHistorica;
  trainResult: ResultadoBacktest;
  testResult: ResultadoBacktest;
}

export interface SensitivityRun {
  label: string;
  fast: number;
  slow: number;
  risk: number;
  result: ResultadoBacktest;
}

export interface CostStressRun {
  label: string;
  commissionPct: number;
  spreadPct: number;
  slippagePct: number;
  result: ResultadoBacktest;
}

export interface RegimeAnalysis {
  regime: MarketRegime;
  trend: string;
  volatility: number;
  notes: string;
}

export interface RobustnessReport {
  baseline: ResultadoBacktest;
  oos: { inSample: ResultadoBacktest; outOfSample: ResultadoBacktest; split: number };
  walkForward: WalkForwardWindow[];
  walkForwardSemantics: 'SEGMENTED';
  sensitivity: SensitivityRun[];
  costStress: CostStressRun[];
  regimeAnalysis: RegimeAnalysis;
  criticAnalysis: TradingCriticAnalysis;
  classification: string;
  baselineRunId: string | null;
}

export function splitTemporalOOS(serie: SerieHistorica, ratio = 0.7): OOSSplit {
  const splitIndex = Math.floor(serie.velas.length * ratio);
  if (splitIndex < 50 || serie.velas.length - splitIndex < 50) {
    throw new Error('Insufficient data for OOS split');
  }

  return {
    inSample: {
      ...serie,
      id: `${serie.id}_IS`,
      velas: serie.velas.slice(0, splitIndex),
    },
    outOfSample: {
      ...serie,
      id: `${serie.id}_OOS`,
      velas: serie.velas.slice(splitIndex),
    },
    splitIndex,
    splitRatio: ratio,
  };
}

export function walkForwardWindows(
  serie: SerieHistorica,
  windowCount: number,
  trainRatio = 0.7,
): { train: SerieHistorica; test: SerieHistorica }[] {
  const totalBars = serie.velas.length;
  const windowSize = Math.floor(totalBars / windowCount);
  if (windowSize < 100) throw new Error('Window size too small for walk-forward');

  const windows: { train: SerieHistorica; test: SerieHistorica }[] = [];

  for (let i = 0; i < windowCount; i++) {
    const start = i * windowSize;
    const end = Math.min(start + windowSize, totalBars);
    const splitAt = start + Math.floor((end - start) * trainRatio);

    if (splitAt - start < 30 || end - splitAt < 10) continue;

    windows.push({
      train: { ...serie, id: `${serie.id}_WF${i}_TRAIN`, velas: serie.velas.slice(start, splitAt) },
      test: { ...serie, id: `${serie.id}_WF${i}_TEST`, velas: serie.velas.slice(splitAt, end) },
    });
  }

  return windows;
}

export function runRobustnessAnalysis(
  serie: SerieHistorica,
  estrategia: EstrategiaCruceMedias,
  config: ConfiguracionBacktest,
): RobustnessReport {
  const baseline = ejecutarBacktest(serie, estrategia, config);

  // 1. Temporal OOS (70/30)
  const split = splitTemporalOOS(serie, 0.7);
  const isResult = ejecutarBacktest(split.inSample, estrategia, config);
  const oosResult = ejecutarBacktest(split.outOfSample, estrategia, config);

  // 2. Walk-Forward (5 windows)
  const wfWindows = walkForwardWindows(serie, 5, 0.7);
  const walkForward: WalkForwardWindow[] = wfWindows.map((w, i) => ({
    windowIndex: i,
    trainSerie: w.train,
    testSerie: w.test,
    trainResult: ejecutarBacktest(w.train, estrategia, config),
    testResult: ejecutarBacktest(w.test, estrategia, config),
  }));

  // 3. Parameter Sensitivity (NOT optimization — fixed variations)
  const sensitivityVariations: { label: string; fast: number; slow: number; risk: number }[] = [
    { label: '8/21 (fast-1)', fast: 8, slow: 21, risk: 0.01 },
    { label: '9/21 (baseline)', fast: 9, slow: 21, risk: 0.01 },
    { label: '10/21 (fast+1)', fast: 10, slow: 21, risk: 0.01 },
    { label: '9/18 (slow-3)', fast: 9, slow: 18, risk: 0.01 },
    { label: '9/25 (slow+4)', fast: 9, slow: 25, risk: 0.01 },
    { label: '9/21 risk=0.02', fast: 9, slow: 21, risk: 0.02 },
  ];

  const sensitivity: SensitivityRun[] = sensitivityVariations.map(v => {
    const strat: EstrategiaCruceMedias = {
      ...estrategia,
      mediaRapida: v.fast,
      mediaLenta: v.slow,
      riesgoPorOperacion: v.risk,
    };
    const cfg = { ...config, maxRiesgoPorOperacion: v.risk };
    return {
      label: v.label,
      fast: v.fast,
      slow: v.slow,
      risk: v.risk,
      result: ejecutarBacktest(serie, strat, cfg),
    };
  });

  // 4. Cost Stress (TEST_ASSUMPTION scenarios)
  const costScenarios: { label: string; c: number; s: number; sl: number }[] = [
    { label: 'zero-cost', c: 0, s: 0, sl: 0 },
    { label: 'low-cost', c: 0.0001, s: 0.0001, sl: 0.00005 },
    { label: 'medium-cost', c: 0.0003, s: 0.0002, sl: 0.0001 },
    { label: 'high-cost', c: 0.0005, s: 0.0003, sl: 0.0002 },
  ];

  const costStress: CostStressRun[] = costScenarios.map(cs => ({
    label: cs.label,
    commissionPct: cs.c,
    spreadPct: cs.s,
    slippagePct: cs.sl,
    result: ejecutarBacktest(serie, estrategia, {
      ...config,
      comisionPorcentaje: cs.c,
      spreadPorcentaje: cs.s,
      slippagePorcentaje: cs.sl,
    }),
  }));

  // 5. Regime analysis
  const regimeAnalysis = detectRegimeFromSeries(serie);

  // 6. Classification with OOS + WF evidence
  const wfResults = walkForward.map(w => w.testResult);
  const classification = clasificarExperimento(baseline, oosResult, wfResults);

  // 7. Critic integration
  const hypothesisClear = true;
  const evidenceSufficient = wfResults.length >= 3 && oosResult.operaciones.length > 0;
  const riskCompliant = baseline.metricas.drawdownMaximo < 50;
  const criticAnalysis = buildCriticAnalysis({
    hypothesisClear,
    evidenceSufficient,
    riskCompliant,
    classification,
    oosReturn: oosResult.metricas.retornoNeto,
    wfConsistency: wfResults.filter(r => r.metricas.retornoNeto > 0).length / Math.max(wfResults.length, 1),
  });

  return {
    baseline,
    oos: { inSample: isResult, outOfSample: oosResult, split: 0.7 },
    walkForward,
    walkForwardSemantics: 'SEGMENTED' as const,
    sensitivity,
    costStress,
    regimeAnalysis,
    criticAnalysis,
    classification,
    baselineRunId: null,
  };
}

function detectRegimeFromSeries(serie: SerieHistorica): RegimeAnalysis {
  const velas = serie.velas;
  if (velas.length < 50) return { regime: 'UNKNOWN', trend: 'UNKNOWN', volatility: 0, notes: 'Insufficient data' };

  const closes = velas.map(v => v.cierre);
  const n = closes.length;
  const first50 = closes.slice(0, 50);
  const last50 = closes.slice(n - 50);
  const avgFirst = first50.reduce((a, b) => a + b, 0) / 50;
  const avgLast = last50.reduce((a, b) => a + b, 0) / 50;
  const changePct = ((avgLast - avgFirst) / avgFirst) * 100;

  const returns = [];
  for (let i = 1; i < n; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;

  let trend: string;
  if (changePct > 5) trend = 'UP';
  else if (changePct < -5) trend = 'DOWN';
  else trend = 'SIDEWAYS';

  let regime: MarketRegime;
  if (volatility > 0.7) regime = 'VOLATILE';
  else if (trend === 'UP' && volatility < 0.4) regime = 'TRENDING_UP';
  else if (trend === 'DOWN' && volatility < 0.4) regime = 'TRENDING_DOWN';
  else if (trend === 'SIDEWAYS') regime = 'RANGING';
  else regime = 'UNKNOWN';

  return {
    regime,
    trend,
    volatility: Math.round(volatility * 1000) / 1000,
    notes: `Change: ${changePct.toFixed(2)}%, Vol: ${volatility.toFixed(4)}`,
  };
}

function buildCriticAnalysis(opts: {
  hypothesisClear: boolean;
  evidenceSufficient: boolean;
  riskCompliant: boolean;
  classification: string;
  oosReturn: number;
  wfConsistency: number;
}): TradingCriticAnalysis {
  const contradictions: string[] = [];
  const flaggedRisks: string[] = [];

  if (opts.oosReturn < 0) flaggedRisks.push('OOS return is negative');
  if (opts.wfConsistency < 0.5) flaggedRisks.push('Less than half of WF windows are profitable');
  if (opts.classification === 'OVERFIT') contradictions.push('Classification suggests overfitting');

  let verdict: string;
  if (!opts.hypothesisClear) verdict = 'Rechazado: hipótesis no clara';
  else if (!opts.evidenceSufficient) verdict = 'Insuficiente evidencia';
  else if (!opts.riskCompliant) verdict = 'Rechazado: riesgo no cumple';
  else if (flaggedRisks.length > 0) verdict = 'Aprobado con riesgos señalados';
  else verdict = 'Aprobado';

  return {
    hypothesisClear: opts.hypothesisClear,
    evidenceSufficient: opts.evidenceSufficient,
    riskCompliant: opts.riskCompliant,
    overflowRisk: null,
    dataRecency: 'HISTORICAL',
    sourceReliability: 'CSV_VERIFIED',
    contradictions,
    flaggedRisks,
    questions: [],
    verdict,
    timestamp: new Date().toISOString(),
  };
}
