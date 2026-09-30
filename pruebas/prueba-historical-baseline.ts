import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import {
  loadAndMapCSV,
  verifyDatasetHash,
  runHistoricalBaseline,
  EURUSD_H1_BASELINE_CONFIG,
} from '../src/trading-lab/historical-baseline.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import { RepositorioExperimentos } from '../src/trading-lab/experimentos.ts';
import { senalCruceMedias } from '../src/trading-lab/estrategias.ts';
import type { SerieHistorica, EstrategiaCruceMedias, ConfiguracionBacktest, VelaHistorica } from '../src/trading-lab/tipos.ts';

const CSV_PATH = 'datos/historical/forex/EURUSD/H1/normalized/EURUSD_H1_2021-2026_normalized.csv';
const EXPECTED_SHA256 = 'd9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a';

describe('TASK 11: Historical Baseline — FIRST_HISTORICAL_OBSERVATION', () => {

  it('dataset file exists', () => {
    assert.ok(existsSync(CSV_PATH), 'EURUSD H1 CSV must exist');
  });

  it('dataset SHA256 matches canonical hash', () => {
    assert.ok(verifyDatasetHash(CSV_PATH, EXPECTED_SHA256));
  });

  it('dataset SHA256 rejects wrong hash', () => {
    assert.equal(verifyDatasetHash(CSV_PATH, 'wrong_hash'), false);
  });

  it('loads CSV with correct field mapping', () => {
    const velas = loadAndMapCSV(CSV_PATH);
    assert.ok(velas.length > 35000, `Expected >35000 bars, got ${velas.length}`);

    const first = velas[0];
    assert.ok(typeof first.fecha === 'string');
    assert.ok(typeof first.apertura === 'number');
    assert.ok(typeof first.maximo === 'number');
    assert.ok(typeof first.minimo === 'number');
    assert.ok(typeof first.cierre === 'number');
    assert.ok(first.apertura > 0);
  });

  it('CSV bars are in chronological order', () => {
    const velas = loadAndMapCSV(CSV_PATH);
    for (let i = 1; i < Math.min(velas.length, 100); i++) {
      const prev = Date.parse(velas[i - 1].fecha);
      const curr = Date.parse(velas[i].fecha);
      assert.ok(curr > prev, `Bar ${i} not after bar ${i - 1}`);
    }
  });

  it('runs baseline backtest with locked parameters', () => {
    const result = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);

    assert.ok(result.datasetVerified);
    assert.equal(result.datasetIdentity.sha256, EXPECTED_SHA256);
    assert.equal(result.parameterSource, 'TEST_BASELINE');
    assert.equal(result.experimentType, 'FIRST_HISTORICAL_OBSERVATION');
    assert.ok(result.datasetIdentity.barCount > 35000);
    assert.equal(result.datasetIdentity.headerLineCount, 1);
    assert.equal(result.datasetIdentity.totalLines, result.datasetIdentity.barCount + 1);

    const exp = result.experiment;
    assert.equal(exp.instrument.symbol, 'EURUSD');
    assert.equal(exp.timeframe, 'H1');
    assert.equal(exp.strategy.id, 'MA_CROSS_BASELINE');
    assert.equal(exp.strategy.version, 1);
    assert.deepStrictEqual(exp.strategy.parameters, {
      mediaRapida: 9,
      mediaLenta: 21,
      riesgoPorOperacion: 0.01,
    });
    assert.equal(exp.capital.initialCapital, 10000);

    assert.ok(typeof exp.results.returnPct === 'number');
    assert.ok(typeof exp.results.maxDrawdownPct === 'number');
    assert.ok(typeof exp.results.trades === 'number');
    assert.ok(exp.results.trades > 0, 'Baseline must produce trades');
    assert.ok(typeof exp.results.winRate === 'number');
    assert.ok(typeof exp.results.profitFactor === 'number' || exp.results.profitFactor === null);
  });

  it('baseline result is reproducible (deterministic)', () => {
    const r1 = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);
    const r2 = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);

    assert.equal(r1.experiment.results.returnPct, r2.experiment.results.returnPct);
    assert.equal(r1.experiment.results.trades, r2.experiment.results.trades);
    assert.equal(r1.experiment.results.maxDrawdownPct, r2.experiment.results.maxDrawdownPct);
    assert.equal(r1.experiment.results.profitFactor, r2.experiment.results.profitFactor);
  });

  it('classification is INSUFFICIENT_DATA (no OOS/WF yet)', () => {
    const result = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);
    assert.equal(result.experiment.classification, 'INSUFFICIENT_DATA');
  });

  it('no lookahead: every entry happens after signal candle close', () => {
    const velas = loadAndMapCSV(CSV_PATH);
    const serie: SerieHistorica = {
      id: 'EURUSD_H1_NOLATEST', simbolo: 'EURUSD', intervalo: 'H1', origen: 'TEST', velas,
    };
    const estrategia: EstrategiaCruceMedias = {
      tipo: 'cruce_medias', id: 'MA_CROSS_NLA', version: 1,
      mediaRapida: 9, mediaLenta: 21, riesgoPorOperacion: 0.01,
    };
    const config: ConfiguracionBacktest = {
      capitalInicial: 10000, comisionPorcentaje: 0.0001,
      spreadPorcentaje: 0.0001, slippagePorcentaje: 0.00005,
      maxRiesgoPorOperacion: 0.01, semilla: 42,
    };
    const bt = ejecutarBacktest(serie, estrategia, config);
    assert.ok(bt.operaciones.length > 0, 'Need trades to verify');

    for (const op of bt.operaciones) {
      const entryDate = Date.parse(op.entrada);
      const signalIdx = velas.findIndex(v => v.fecha === op.entrada);
      if (signalIdx > 0) {
        const prevClose = Date.parse(velas[signalIdx - 1].fecha);
        assert.ok(entryDate > prevClose, `Entry at ${op.entrada} must be after prior candle`);
      }
    }
  });

  it('cost assumptions are labeled as TEST_ASSUMPTION', () => {
    const result = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);
    assert.ok(result.costAssumptions.length >= 3);
    for (const ca of result.costAssumptions) {
      assert.equal(ca.status, 'TEST_ASSUMPTION');
      assert.ok(ca.notes.length > 0);
    }
  });

  it('experiment is persisted to repository', () => {
    const result = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);
    assert.ok(result.persisted, 'Experiment must be persisted');
  });

  it('rejects tampered dataset', () => {
    const tamperedConfig = {
      ...EURUSD_H1_BASELINE_CONFIG,
      expectedSHA256: 'aaaa0000bbbb1111cccc2222dddd3333eeee4444ffff5555666677778888',
    };
    assert.throws(() => runHistoricalBaseline(tamperedConfig), /hash mismatch/i);
  });

  it('persists dataset traceability and survives restart', () => {
    const tmpPath = '/tmp/atlas-test-restart-' + Date.now() + '.json';
    const result = runHistoricalBaseline(EURUSD_H1_BASELINE_CONFIG);
    const exp = result.experiment;

    assert.equal(exp.dataset?.datasetId, 'EURUSD_H1_DUKASCOPY_2021-2026');
    assert.equal(exp.dataset?.sha256, EXPECTED_SHA256);
    assert.equal(exp.experimentType, 'FIRST_HISTORICAL_OBSERVATION');
    assert.equal(exp.parameterSource, 'TEST_BASELINE');
    assert.equal(exp.costSource, 'TEST_ASSUMPTION');

    const repo1 = new RepositorioExperimentos(tmpPath);
    repo1.guardarExperimento(exp);

    const repo2 = new RepositorioExperimentos(tmpPath);
    const recovered = repo2.obtenerExperimento(exp.runId);
    assert.ok(recovered, 'Must recover experiment after restart');
    assert.equal(recovered!.dataset?.datasetId, 'EURUSD_H1_DUKASCOPY_2021-2026');
    assert.equal(recovered!.dataset?.sha256, EXPECTED_SHA256);
    assert.equal(recovered!.experimentType, 'FIRST_HISTORICAL_OBSERVATION');
    assert.equal(recovered!.parameterSource, 'TEST_BASELINE');
    assert.equal(recovered!.costSource, 'TEST_ASSUMPTION');
    assert.equal(recovered!.results.trades, exp.results.trades);
    assert.equal(recovered!.results.returnPct, exp.results.returnPct);

    try { unlinkSync(tmpPath); } catch {}
  });

  it('true N→N+1 no-lookahead: synthetic series with known cross point', () => {
    const mkVela = (fecha: string, apertura: number, cierre: number): VelaHistorica => ({
      fecha, apertura, maximo: Math.max(apertura, cierre) + 0.5,
      minimo: Math.min(apertura, cierre) - 0.5, cierre, volumen: 100,
    });

    const velas: VelaHistorica[] = [
      mkVela('2025-01-01T00:00:00Z', 10, 10),
      mkVela('2025-01-01T01:00:00Z', 10, 9),
      mkVela('2025-01-01T02:00:00Z', 9, 8),
      mkVela('2025-01-01T03:00:00Z', 8, 7),
      mkVela('2025-01-01T04:00:00Z', 7, 15),
      mkVela('2025-01-01T05:00:00Z', 14, 16),
      mkVela('2025-01-01T06:00:00Z', 16, 5),
      mkVela('2025-01-01T07:00:00Z', 5.5, 5),
    ];

    const estrategia: EstrategiaCruceMedias = {
      tipo: 'cruce_medias', id: 'NLA_SYNTH', version: 1,
      mediaRapida: 2, mediaLenta: 3, riesgoPorOperacion: 0.01,
    };

    const signalAtCandle4 = senalCruceMedias(estrategia, velas, 4);
    assert.equal(signalAtCandle4, 'comprar', 'Signal must fire at candle 4');

    const signalAtCandle3 = senalCruceMedias(estrategia, velas, 3);
    assert.notEqual(signalAtCandle3, 'comprar', 'No buy signal before candle 4');

    const serie: SerieHistorica = {
      id: 'SYNTH_NLA', simbolo: 'SYNTH', intervalo: 'H1', origen: 'TEST', velas,
    };
    const config: ConfiguracionBacktest = {
      capitalInicial: 10000, comisionPorcentaje: 0, spreadPorcentaje: 0,
      slippagePorcentaje: 0, maxRiesgoPorOperacion: 0.01, semilla: 1,
    };
    const bt = ejecutarBacktest(serie, estrategia, config);
    assert.ok(bt.operaciones.length > 0, 'Must produce at least one trade');

    const firstOp = bt.operaciones[0];
    assert.equal(firstOp.entrada, '2025-01-01T05:00:00Z',
      'Entry must be at candle 5 (N+1), not candle 4 (signal candle N)');
    assert.equal(firstOp.precioEntrada, 14,
      'Entry price must be candle 5 apertura (14)');
  });
});
