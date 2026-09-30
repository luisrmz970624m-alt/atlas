import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_commission',
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

const estrategia = crearCruceMedias({
  id: 'commission_test',
  version: 1,
  tipo: 'cruce_medias' as const,
  mediaRapida: 9,
  mediaLenta: 21,
  riesgoPorOperacion: 0.01,
});

test('phase2-c: baseline commission (0.1%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, comisionPorcentaje: 0.001 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: zero commission (0%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, comisionPorcentaje: 0 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: high commission (0.5%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, comisionPorcentaje: 0.005 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: baseline spread (0.05%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, spreadPorcentaje: 0.0005 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: zero spread (0%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, spreadPorcentaje: 0 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: high spread (0.1%)', () => {
  const config: ConfiguracionBacktest = { ...baseConfig, spreadPorcentaje: 0.001 };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: combined high costs (0.5% comm + 0.1% spread)', () => {
  const config: ConfiguracionBacktest = {
    ...baseConfig,
    comisionPorcentaje: 0.005,
    spreadPorcentaje: 0.001,
  };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: slippage variation (0%)', () => {
  const config: ConfiguracionBacktest = {
    ...baseConfig,
    slippagePorcentaje: 0,
  };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});

test('phase2-c: slippage variation (0.05%)', () => {
  const config: ConfiguracionBacktest = {
    ...baseConfig,
    slippagePorcentaje: 0.0005,
  };
  const resultado = ejecutarBacktest(serieFixture, estrategia, config);
  assert.ok(Number.isFinite(resultado.metricas.retornoNeto));
});
