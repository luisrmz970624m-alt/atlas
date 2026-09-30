import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadAndMapCSV, EURUSD_H1_BASELINE_CONFIG } from '../src/trading-lab/historical-baseline.ts';
import { splitTemporalOOS, walkForwardWindows, runRobustnessAnalysis } from '../src/trading-lab/oos-walkforward.ts';
import type { SerieHistorica, EstrategiaCruceMedias, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const CSV_PATH = EURUSD_H1_BASELINE_CONFIG.csvPath;

function buildSerie(): SerieHistorica {
  const velas = loadAndMapCSV(CSV_PATH);
  return {
    id: 'EURUSD_H1_DUKASCOPY',
    simbolo: 'EURUSD',
    intervalo: 'H1',
    origen: 'DUKASCOPY_BID_UTC',
    velas,
  };
}

const STRATEGY: EstrategiaCruceMedias = {
  tipo: 'cruce_medias',
  id: 'MA_CROSS_BASELINE',
  version: 1,
  mediaRapida: 9,
  mediaLenta: 21,
  riesgoPorOperacion: 0.01,
};

const CONFIG: ConfiguracionBacktest = {
  capitalInicial: 10000,
  comisionPorcentaje: 0.0001,
  spreadPorcentaje: 0.0001,
  slippagePorcentaje: 0.00005,
  maxRiesgoPorOperacion: 0.01,
  semilla: 42,
};

describe('TASK 12: OOS / Walk-Forward / Robustness', () => {

  it('temporal OOS split produces valid IS and OOS segments', () => {
    const serie = buildSerie();
    const split = splitTemporalOOS(serie, 0.7);

    assert.ok(split.inSample.velas.length > 0);
    assert.ok(split.outOfSample.velas.length > 0);
    assert.equal(split.inSample.velas.length + split.outOfSample.velas.length, serie.velas.length);

    const lastIS = split.inSample.velas.at(-1)!.fecha;
    const firstOOS = split.outOfSample.velas[0].fecha;
    assert.ok(Date.parse(firstOOS) > Date.parse(lastIS), 'OOS must start after IS ends');
  });

  it('walk-forward windows cover the dataset without overlap', () => {
    const serie = buildSerie();
    const windows = walkForwardWindows(serie, 5, 0.7);

    assert.ok(windows.length >= 4, 'Should produce at least 4 valid windows');

    for (const w of windows) {
      assert.ok(w.train.velas.length > 0);
      assert.ok(w.test.velas.length > 0);

      const lastTrain = w.train.velas.at(-1)!.fecha;
      const firstTest = w.test.velas[0].fecha;
      assert.ok(Date.parse(firstTest) > Date.parse(lastTrain), 'Test must follow train');
    }
  });

  it('runs full robustness analysis', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    assert.ok(report.baseline.metricas.operaciones > 0);
    assert.ok(report.oos.inSample.metricas.operaciones > 0);
    assert.ok(report.oos.outOfSample.metricas.operaciones > 0);
    assert.ok(report.walkForward.length >= 4);
    assert.equal(report.sensitivity.length, 6);
    assert.equal(report.costStress.length, 4);
    assert.ok(['CANDIDATE', 'VALIDATED', 'OVERFIT', 'REJECTED', 'INSUFFICIENT_DATA', 'FAILED'].includes(report.classification));
  });

  it('IS and OOS are separate periods (no lookahead)', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    const isReturn = report.oos.inSample.metricas.retornoNeto;
    const oosReturn = report.oos.outOfSample.metricas.retornoNeto;

    assert.ok(typeof isReturn === 'number');
    assert.ok(typeof oosReturn === 'number');
    assert.notEqual(isReturn, oosReturn, 'IS and OOS should differ');
  });

  it('parameter sensitivity shows variation across parameters', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    const returns = report.sensitivity.map(s => s.result.metricas.retornoNeto);
    const unique = new Set(returns.map(r => r.toFixed(4)));
    assert.ok(unique.size >= 3, 'Sensitivity should show variation');
  });

  it('cost stress degrades with higher costs', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    const zeroCost = report.costStress.find(c => c.label === 'zero-cost')!;
    const highCost = report.costStress.find(c => c.label === 'high-cost')!;

    assert.ok(
      zeroCost.result.metricas.retornoNeto >= highCost.result.metricas.retornoNeto,
      'Higher costs should reduce or maintain return',
    );
  });

  it('walk-forward test windows produce honest results', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    for (const wf of report.walkForward) {
      assert.ok(typeof wf.testResult.metricas.retornoNeto === 'number');
      assert.ok(wf.testResult.metricas.operaciones >= 0);
    }
  });

  it('classification uses OOS + WF evidence', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    assert.ok(report.classification !== 'INSUFFICIENT_DATA',
      'With OOS and WF evidence, classification should not be INSUFFICIENT_DATA');
  });

  it('results are reproducible', () => {
    const serie = buildSerie();
    const r1 = runRobustnessAnalysis(serie, STRATEGY, CONFIG);
    const r2 = runRobustnessAnalysis(serie, STRATEGY, CONFIG);

    assert.equal(r1.baseline.metricas.retornoNeto, r2.baseline.metricas.retornoNeto);
    assert.equal(r1.oos.outOfSample.metricas.retornoNeto, r2.oos.outOfSample.metricas.retornoNeto);
    assert.equal(r1.classification, r2.classification);
  });

  it('regime analysis detects a valid regime', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);
    const valid: string[] = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'UNKNOWN'];
    assert.ok(valid.includes(report.regimeAnalysis.regime));
    assert.ok(typeof report.regimeAnalysis.volatility === 'number');
    assert.ok(report.regimeAnalysis.notes.length > 0);
  });

  it('critic analysis produces a verdict', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);
    assert.ok(report.criticAnalysis.verdict.length > 0);
    assert.ok(typeof report.criticAnalysis.hypothesisClear === 'boolean');
    assert.ok(typeof report.criticAnalysis.evidenceSufficient === 'boolean');
    assert.ok(typeof report.criticAnalysis.riskCompliant === 'boolean');
    assert.ok(Array.isArray(report.criticAnalysis.flaggedRisks));
  });

  it('walk-forward semantics is SEGMENTED', () => {
    const serie = buildSerie();
    const report = runRobustnessAnalysis(serie, STRATEGY, CONFIG);
    assert.equal(report.walkForwardSemantics, 'SEGMENTED');
  });
});
