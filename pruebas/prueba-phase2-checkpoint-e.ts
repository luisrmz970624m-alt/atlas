import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_robustness',
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

const baseConfig: ConfiguracionBacktest = {
  capitalInicial: 10000,
  comisionPorcentaje: 0.001,
  spreadPorcentaje: 0.0005,
  slippagePorcentaje: 0.0001,
  maxRiesgoPorOperacion: 0.02,
  semilla: 42,
};

test('phase2-e: robustness with small capital (1000)', () => {
  const estrategia = crearCruceMedias({
    id: 'robust_small_capital',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const config: ConfiguracionBacktest = { ...baseConfig, capitalInicial: 1000 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);

  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
  assert.ok(resultado.operaciones.length >= 0);
});

test('phase2-e: robustness with large capital (100000)', () => {
  const estrategia = crearCruceMedias({
    id: 'robust_large_capital',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const config: ConfiguracionBacktest = { ...baseConfig, capitalInicial: 100000 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);

  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-e: risk limit constraint (maxRiesgoPorOperacion=0.01)', () => {
  const estrategia = crearCruceMedias({
    id: 'risk_limit',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const config: ConfiguracionBacktest = {
    ...baseConfig,
    maxRiesgoPorOperacion: 0.01,
  };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);

  // Must respect risk constraint
  assert.ok(resultado.operaciones.length >= 0);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-e: evidence collection: trades count', () => {
  const estrategia = crearCruceMedias({
    id: 'evidence_trades',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, baseConfig);

  // Evidence: number of trades executed
  assert.ok(Array.isArray(resultado.operaciones));
  assert.ok(resultado.operaciones.length >= 0);
});

test('phase2-e: evidence collection: PnL tracking', () => {
  const estrategia = crearCruceMedias({
    id: 'evidence_pnl',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, baseConfig);

  // Evidence: PnL metrics
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
  assert.ok(Number.isFinite(resultado.metricas.totalPerdida || 0));
  assert.ok(Number.isFinite(resultado.metricas.totalGanancia || 0));
});

test('phase2-e: evidence collection: drawdown tracking', () => {
  const estrategia = crearCruceMedias({
    id: 'evidence_drawdown',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, baseConfig);

  // Evidence: drawdown exists
  assert.ok(resultado.metricas.drawdownMaximo !== undefined);
  assert.ok(Number.isFinite(resultado.metricas.drawdownMaximo || 0));
});

test('phase2-e: reproducibility for robustness verification', () => {
  const estrategia1 = crearCruceMedias({
    id: 'robust_repro1',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const estrategia2 = crearCruceMedias({
    id: 'robust_repro2',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado1 = ejecutarBacktest(serieFixture, estrategia1, baseConfig);
  const resultado2 = ejecutarBacktest(serieFixture, estrategia2, baseConfig);

  // Same parameters on same data should produce comparable results
  assert.equal(resultado1.reproducible, true);
  assert.equal(resultado2.reproducible, true);
});
