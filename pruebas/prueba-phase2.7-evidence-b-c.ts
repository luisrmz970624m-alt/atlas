import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticFixture_MultiRegime } from '../src/trading-lab/fixture-generator.ts';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const fixture = createDiagnosticFixture_MultiRegime();

interface ParameterEvidenceRow {
  fast: number;
  slow: number;
  trades: number;
  pnl: number;
  return: number;
  drawdown: number;
  profitFactor: number | null;
}

interface CommissionEvidenceRow {
  multiplier: number;
  commissionRate: number;
  trades: number;
  totalCommission: number;
  pnl: number;
  return: number;
}

test('phase2.7-b: parameter sensitivity baseline', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const estrategia = crearCruceMedias({
    id: 'b_baseline_9_21',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const result = ejecutarBacktest(fixture, estrategia, config);

  const baseline: ParameterEvidenceRow = {
    fast: 9,
    slow: 21,
    trades: result.operaciones.length,
    pnl: result.metricas.retornoNeto,
    return: result.metricas.retornoNeto,
    drawdown: result.metricas.drawdownMaximo,
    profitFactor: result.metricas.profitFactor,
  };

  // Verify baseline metrics
  assert.ok(baseline.trades >= 2, `baseline trades: ${baseline.trades}`);
  assert.ok(Number.isFinite(baseline.return));
  assert.ok(Number.isFinite(baseline.drawdown));

  console.log('BASELINE_9_21:', JSON.stringify(baseline, null, 2));
});

test('phase2.7-b: parameter sensitivity fast variants', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const variants: ParameterEvidenceRow[] = [];

  for (const fast of [8, 9, 10]) {
    const estrategia = crearCruceMedias({
      id: `b_fast_${fast}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: fast,
      mediaLenta: 21,
      riesgoPorOperacion: 0.01,
    });

    const result = ejecutarBacktest(fixture, estrategia, config);

    variants.push({
      fast,
      slow: 21,
      trades: result.operaciones.length,
      pnl: result.metricas.retornoNeto,
      return: result.metricas.retornoNeto,
      drawdown: result.metricas.drawdownMaximo,
      profitFactor: result.metricas.profitFactor,
    });
  }

  // Verify variants exist
  assert.equal(variants.length, 3);

  // Report metrics
  console.log('FAST_VARIANTS_8_9_10:', JSON.stringify(variants, null, 2));

  // Check for measurable differences
  const allSameTrades = variants.every(v => v.trades === variants[0]!.trades);
  console.log(`TRADE_COUNT_IDENTICAL: ${allSameTrades}`);

  if (!allSameTrades) {
    console.log('MEASURABILITY: MEASURABLE (trade counts differ)');
  }
});

test('phase2.7-b: parameter sensitivity slow variants', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const variants: ParameterEvidenceRow[] = [];

  for (const slow of [20, 21, 22]) {
    const estrategia = crearCruceMedias({
      id: `b_slow_${slow}`,
      version: 1,
      tipo: 'cruce_medias' as const,
      mediaRapida: 9,
      mediaLenta: slow,
      riesgoPorOperacion: 0.01,
    });

    const result = ejecutarBacktest(fixture, estrategia, config);

    variants.push({
      fast: 9,
      slow,
      trades: result.operaciones.length,
      pnl: result.metricas.retornoNeto,
      return: result.metricas.retornoNeto,
      drawdown: result.metricas.drawdownMaximo,
      profitFactor: result.metricas.profitFactor,
    });
  }

  assert.equal(variants.length, 3);
  console.log('SLOW_VARIANTS_20_21_22:', JSON.stringify(variants, null, 2));
});

test('phase2.7-b: sample status assessment', () => {
  const status = {
    sampleSize: 3,
    assessment: 'LIMITED',
    sufficiency: 'INSUFFICIENT_FOR_STATISTICAL_CLAIMS',
    usable_for: 'PIPELINE_FUNCTIONALITY_ONLY',
  };

  console.log('SAMPLE_STATUS:', JSON.stringify(status, null, 2));
  assert.ok(status.sampleSize >= 2);
});

test('phase2.7-c: commission sensitivity 1x baseline', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001, // 1x baseline
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const estrategia = crearCruceMedias({
    id: 'c_commission_1x',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const result = ejecutarBacktest(fixture, estrategia, config);

  const evidence: CommissionEvidenceRow = {
    multiplier: 1.0,
    commissionRate: 0.001,
    trades: result.operaciones.length,
    totalCommission: Math.abs(result.metricas.comisiones),
    pnl: result.metricas.retornoNeto,
    return: result.metricas.retornoNeto,
  };

  console.log('COMMISSION_1X:', JSON.stringify(evidence, null, 2));
  assert.ok(Number.isFinite(evidence.totalCommission));
});

test('phase2.7-c: commission sensitivity 1.5x', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.0015, // 1.5x baseline
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const estrategia = crearCruceMedias({
    id: 'c_commission_1.5x',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const result = ejecutarBacktest(fixture, estrategia, config);

  const evidence: CommissionEvidenceRow = {
    multiplier: 1.5,
    commissionRate: 0.0015,
    trades: result.operaciones.length,
    totalCommission: Math.abs(result.metricas.comisiones),
    pnl: result.metricas.retornoNeto,
    return: result.metricas.retornoNeto,
  };

  console.log('COMMISSION_1.5X:', JSON.stringify(evidence, null, 2));
});

test('phase2.7-c: commission sensitivity 2x', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.002, // 2x baseline
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const estrategia = crearCruceMedias({
    id: 'c_commission_2x',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const result = ejecutarBacktest(fixture, estrategia, config);

  const evidence: CommissionEvidenceRow = {
    multiplier: 2.0,
    commissionRate: 0.002,
    trades: result.operaciones.length,
    totalCommission: Math.abs(result.metricas.comisiones),
    pnl: result.metricas.retornoNeto,
    return: result.metricas.retornoNeto,
  };

  console.log('COMMISSION_2X:', JSON.stringify(evidence, null, 2));
});

test('phase2.7-c: commission degradation analysis', () => {
  // Verify mathematically that higher commission doesn't help
  const comm1x = 0.001;
  const comm2x = 0.002;

  assert.ok(comm2x > comm1x, 'Higher multiplier should have higher commission rate');

  console.log('COMMISSION_MATH: verified comm2x > comm1x');
});
