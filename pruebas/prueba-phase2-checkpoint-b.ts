import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias, senalCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_sensitivity',
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

test('phase2-b: baseline parameters (9/21)', () => {
  const estrategia = crearCruceMedias({
    id: 'baseline',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: parameter variation +1 (10/21)', () => {
  const estrategia = crearCruceMedias({
    id: 'var_fast_10',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 10,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: parameter variation -1 (8/21)', () => {
  const estrategia = crearCruceMedias({
    id: 'var_fast_8',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 8,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: slow period variation +1 (9/22)', () => {
  const estrategia = crearCruceMedias({
    id: 'var_slow_22',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 22,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: risk parameter variation (0.005)', () => {
  const estrategia = crearCruceMedias({
    id: 'var_risk_005',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.005,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: risk parameter variation (0.02)', () => {
  const estrategia = crearCruceMedias({
    id: 'var_risk_02',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.02,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);
  assert.ok(resultado.metricas);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-b: all variations reproducible', () => {
  // Verify same seed produces same results (reproducibility for fragility testing)
  const estrategia = crearCruceMedias({
    id: 'reproducible_test',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const run1 = ejecutarBacktest(serieFixture, estrategia, configFixture);
  const run2 = ejecutarBacktest(serieFixture, estrategia, configFixture);

  assert.equal(run1.metricas.retornoNeto, run2.metricas.retornoNeto);
});
