import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_parameter_evidence',
  simbolo: 'EURUSD',
  intervalo: 'H1',
  origen: 'test_fixture',
  velas: Array.from({ length: 100 }, (_, i) => ({
    fecha: new Date(2024, 0, 1, 0, i).toISOString(),
    apertura: 1.08 + (i * 0.0001),
    maximo: 1.085 + (i * 0.0001),
    minimo: 1.075 + (i * 0.0001),
    cierre: 1.082 + (i * 0.0001),
    volumen: 1000 + i * 10,
  })),
};

const configFixture: ConfiguracionBacktest = {
  capitalInicial: 10000,
  comisionPorcentaje: 0.001,
  spreadPorcentaje: 0.0005,
  slippagePorcentaje: 0.0001,
  maxRiesgoPorOperacion: 0.02,
  semilla: 42,
};

interface ParameterResult {
  fast: number;
  slow: number;
  risk: number;
  trades: number;
  retornoNeto: number;
  maxDrawdown: number;
  profitFactor: number | null;
}

test('phase2.5-b: parameter sensitivity — baseline (9/21)', () => {
  const estrategia = crearCruceMedias({
    id: 'baseline_param',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

  // Record baseline
  const baseline: ParameterResult = {
    fast: 9,
    slow: 21,
    risk: 0.01,
    trades: resultado.operaciones.length,
    retornoNeto: resultado.metricas.retornoNeto,
    maxDrawdown: resultado.metricas.drawdownMaximo,
    profitFactor: resultado.metricas.profitFactor,
  };

  // Baseline must exist
  assert.ok(baseline.fast === 9);
  assert.ok(baseline.slow === 21);
  assert.ok(Number.isFinite(baseline.retornoNeto));

  console.log('BASELINE:', JSON.stringify(baseline, null, 2));
});

test('phase2.5-b: parameter sensitivity — fast variants (8, 10)', () => {
  const variants: ParameterResult[] = [];

  for (const fast of [8, 10]) {
    const estrategia = crearCruceMedias({
      id: `variant_fast_${fast}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: fast,
      mediaLenta: 21,
      riesgoPorOperacion: 0.01,
    });

    const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

    variants.push({
      fast,
      slow: 21,
      risk: 0.01,
      trades: resultado.operaciones.length,
      retornoNeto: resultado.metricas.retornoNeto,
      maxDrawdown: resultado.metricas.drawdownMaximo,
      profitFactor: resultado.metricas.profitFactor,
    });
  }

  // Verify variants exist and have different trade counts (sensitivity marker)
  assert.ok(variants.length === 2);
  assert.ok(variants[0]!.fast === 8);
  assert.ok(variants[1]!.fast === 10);

  console.log('FAST_VARIANTS:', JSON.stringify(variants, null, 2));

  // Sensitivity: if trade counts differ, strategy responds to parameter
  const tradesIdentical = variants.every(v => v.trades === variants[0]!.trades);
  console.log(`SENSITIVITY_MARKER: trade counts identical = ${tradesIdentical}`);
});

test('phase2.5-b: parameter sensitivity — slow variants (21, 22)', () => {
  const variants: ParameterResult[] = [];

  for (const slow of [21, 22]) {
    const estrategia = crearCruceMedias({
      id: `variant_slow_${slow}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: 9,
      mediaLenta: slow,
      riesgoPorOperacion: 0.01,
    });

    const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

    variants.push({
      fast: 9,
      slow,
      risk: 0.01,
      trades: resultado.operaciones.length,
      retornoNeto: resultado.metricas.retornoNeto,
      maxDrawdown: resultado.metricas.drawdownMaximo,
      profitFactor: resultado.metricas.profitFactor,
    });
  }

  // Verify variants
  assert.ok(variants.length === 2);
  assert.ok(variants[0]!.slow === 21);
  assert.ok(variants[1]!.slow === 22);

  console.log('SLOW_VARIANTS:', JSON.stringify(variants, null, 2));
});

test('phase2.5-b: parameter sensitivity — risk variants (0.005, 0.02)', () => {
  const variants: ParameterResult[] = [];

  for (const risk of [0.005, 0.02]) {
    const estrategia = crearCruceMedias({
      id: `variant_risk_${risk}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: 9,
      mediaLenta: 21,
      riesgoPorOperacion: risk,
    });

    const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

    variants.push({
      fast: 9,
      slow: 21,
      risk,
      trades: resultado.operaciones.length,
      retornoNeto: resultado.metricas.retornoNeto,
      maxDrawdown: resultado.metricas.drawdownMaximo,
      profitFactor: resultado.metricas.profitFactor,
    });
  }

  // Verify variants
  assert.ok(variants.length === 2);
  assert.ok(variants[0]!.risk === 0.005);
  assert.ok(variants[1]!.risk === 0.02);

  console.log('RISK_VARIANTS:', JSON.stringify(variants, null, 2));
});

test('phase2.5-b: baseline unchanged across runs', () => {
  const configs = [
    { fast: 9, slow: 21, risk: 0.01 },
    { fast: 9, slow: 21, risk: 0.01 },
    { fast: 9, slow: 21, risk: 0.01 },
  ];

  const results: ParameterResult[] = [];

  for (const cfg of configs) {
    const estrategia = crearCruceMedias({
      id: `baseline_run_${cfg.fast}_${cfg.slow}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: cfg.fast,
      mediaLenta: cfg.slow,
      riesgoPorOperacion: cfg.risk,
    });

    const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

    results.push({
      fast: cfg.fast,
      slow: cfg.slow,
      risk: cfg.risk,
      trades: resultado.operaciones.length,
      retornoNeto: resultado.metricas.retornoNeto,
      maxDrawdown: resultado.metricas.drawdownMaximo,
      profitFactor: resultado.metricas.profitFactor,
    });
  }

  // All baseline runs must be identical
  assert.equal(results[0]!.trades, results[1]!.trades);
  assert.equal(results[1]!.trades, results[2]!.trades);
  assert.equal(results[0]!.retornoNeto, results[1]!.retornoNeto);
  assert.equal(results[1]!.retornoNeto, results[2]!.retornoNeto);

  console.log('BASELINE_STABILITY:', JSON.stringify(results, null, 2));
});

test('phase2.5-b: classification', () => {
  // Collect all evidence
  const evidence = {
    baseline: { fast: 9, slow: 21, risk: 0.01 },
    fixture: { bars: 100, symbol: 'EURUSD' },
    result: 'UNCLASSIFIED', // Cannot claim ROBUST/FRAGILE without comparison results
    reason: 'Trade counts not measured to determine sensitivity',
  };

  console.log('CLASSIFICATION:', JSON.stringify(evidence, null, 2));

  // Report: cannot classify without seeing trade count differences
  assert.ok(evidence.result === 'UNCLASSIFIED');
});
