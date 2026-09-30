/** Historical Baseline Runner — TASK 11: First historical observation.
 * Loads verified CSV, runs MA_CROSS backtest, persists as experiment.
 * NO optimization, NO tuning, NO lookahead. */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { SerieHistorica, VelaHistorica, EstrategiaCruceMedias, ConfiguracionBacktest } from './tipos.ts';
import { ejecutarBacktest } from './backtest.ts';
import { crearExperimentoDesdeBacktest, RepositorioExperimentos, type ExperimentoTrading } from './experimentos.ts';
import { loadCSVHistoricalSync, type CSVLoaderConfig } from './csv-historical-loader.ts';

export interface HistoricalBaselineConfig {
  csvPath: string;
  expectedSHA256: string;
  symbol: string;
  timeframe: string;
  source: string;
  strategy: { fast: number; slow: number; risk: number };
  capital: number;
  commissionPct: number;
  spreadPct: number;
  slippagePct: number;
}

export interface DatasetIdentity {
  fileName: string;
  sha256: string;
  barCount: number;
  headerLineCount: 1;
  totalLines: number;
  firstDate: string;
  lastDate: string;
}

export interface CostAssumption {
  field: string;
  value: number;
  status: 'TEST_ASSUMPTION';
  notes: string;
}

export interface BaselineResult {
  experiment: ExperimentoTrading;
  experimentType: 'FIRST_HISTORICAL_OBSERVATION';
  datasetVerified: boolean;
  datasetIdentity: DatasetIdentity;
  parameterSource: string;
  costAssumptions: CostAssumption[];
  persisted: boolean;
}

const EURUSD_CSV_CONFIG: CSVLoaderConfig = {
  dateColumn: 'timestamp',
  openColumn: 'open',
  highColumn: 'high',
  lowColumn: 'low',
  closeColumn: 'close',
  volumeColumn: undefined,
  delimiter: ',',
  hasHeader: true,
  dateFormat: 'ISO8601',
  timezone: 'UTC',
  minBars: 10,
  maxBars: 100000,
};

export function loadAndMapCSV(csvPath: string): VelaHistorica[] {
  const result = loadCSVHistoricalSync(csvPath, EURUSD_CSV_CONFIG);
  if ('error' in result) throw new Error(result.error);
  return result.serie.velas;
}

export function verifyDatasetHash(csvPath: string, expectedSHA256: string): boolean {
  const content = readFileSync(csvPath);
  const hash = createHash('sha256').update(content).digest('hex');
  return hash === expectedSHA256;
}

export function runHistoricalBaseline(config: HistoricalBaselineConfig): BaselineResult {
  const hashMatch = verifyDatasetHash(config.csvPath, config.expectedSHA256);
  if (!hashMatch) {
    throw new Error(`Dataset hash mismatch. Expected: ${config.expectedSHA256}`);
  }

  const velas = loadAndMapCSV(config.csvPath);

  const serie: SerieHistorica = {
    id: `${config.symbol}_${config.timeframe}_${config.source}`,
    simbolo: config.symbol,
    intervalo: config.timeframe,
    origen: config.source,
    velas,
  };

  const estrategia: EstrategiaCruceMedias = {
    tipo: 'cruce_medias',
    id: 'MA_CROSS_BASELINE',
    version: 1,
    mediaRapida: config.strategy.fast,
    mediaLenta: config.strategy.slow,
    riesgoPorOperacion: config.strategy.risk,
  };

  const backtestConfig: ConfiguracionBacktest = {
    capitalInicial: config.capital,
    comisionPorcentaje: config.commissionPct,
    spreadPorcentaje: config.spreadPct,
    slippagePorcentaje: config.slippagePct,
    maxRiesgoPorOperacion: config.strategy.risk,
    semilla: 42,
  };

  const resultado = ejecutarBacktest(serie, estrategia, backtestConfig);

  const experiment = crearExperimentoDesdeBacktest(
    serie,
    estrategia,
    resultado,
    config.capital,
    config.commissionPct,
  );

  const costAssumptions: CostAssumption[] = [
    { field: 'comisionPorcentaje', value: config.commissionPct, status: 'TEST_ASSUMPTION', notes: 'Estimated commission, not from broker documentation' },
    { field: 'spreadPorcentaje', value: config.spreadPct, status: 'TEST_ASSUMPTION', notes: 'Estimated average spread, not from tick data' },
    { field: 'slippagePorcentaje', value: config.slippagePct, status: 'TEST_ASSUMPTION', notes: 'Estimated slippage, not from real execution logs' },
  ];

  const content = readFileSync(config.csvPath, 'utf-8');
  const totalLines = content.trim().split('\n').length;

  const datasetIdentity: DatasetIdentity = {
    fileName: config.csvPath.split('/').pop() || config.csvPath,
    sha256: config.expectedSHA256,
    barCount: velas.length,
    headerLineCount: 1,
    totalLines,
    firstDate: velas[0]?.fecha ?? '',
    lastDate: velas[velas.length - 1]?.fecha ?? '',
  };

  experiment.dataset = {
    datasetId: 'EURUSD_H1_DUKASCOPY_2021-2026',
    sha256: config.expectedSHA256,
    source: config.source,
  };
  experiment.experimentType = 'FIRST_HISTORICAL_OBSERVATION';
  experiment.parameterSource = 'TEST_BASELINE';
  experiment.costSource = 'TEST_ASSUMPTION';

  let persisted = false;
  try {
    const repo = new RepositorioExperimentos();
    repo.guardarExperimento(experiment);
    persisted = true;
  } catch {
    persisted = false;
  }

  return {
    experiment,
    experimentType: 'FIRST_HISTORICAL_OBSERVATION',
    datasetVerified: true,
    datasetIdentity,
    parameterSource: 'TEST_BASELINE',
    costAssumptions,
    persisted,
  };
}

export const EURUSD_H1_BASELINE_CONFIG: HistoricalBaselineConfig = {
  csvPath: 'datos/historical/forex/EURUSD/H1/normalized/EURUSD_H1_2021-2026_normalized.csv',
  expectedSHA256: 'd9beb0a6e9c8f366f89403534daae3bb7754dc343e3d17eb148dc45eba3f627a',
  symbol: 'EURUSD',
  timeframe: 'H1',
  source: 'DUKASCOPY_BID_UTC',
  strategy: { fast: 9, slow: 21, risk: 0.01 },
  capital: 10000,
  commissionPct: 0.0001,
  spreadPct: 0.0001,
  slippagePct: 0.00005,
};
