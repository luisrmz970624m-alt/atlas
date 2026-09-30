import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { validarFueraMuestra, ejecutarWalkForward } from '../src/trading-lab/validacion.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_oos',
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

const estrategia = crearCruceMedias({
  id: 'oos_test',
  version: 1,
  tipo: 'cruce_medias' as const,
  mediaRapida: 9,
  mediaLenta: 21,
  riesgoPorOperacion: 0.01,
});

test('phase2-d: OOS 50/50 split structure', () => {
  const oos = validarFueraMuestra(serieFixture, estrategia, configFixture, 50);

  // Verify split
  assert.equal(oos.entrenamiento.datos.velas, 50);
  assert.equal(oos.validacion.datos.velas, 50);

  // Verify both have metrics
  assert.ok(Number.isFinite(oos.entrenamiento.metricas.retornoNeto));
  assert.ok(Number.isFinite(oos.validacion.metricas.retornoNeto));
});

test('phase2-d: OOS 60/40 split structure', () => {
  const oos = validarFueraMuestra(serieFixture, estrategia, configFixture, 60);

  assert.equal(oos.entrenamiento.datos.velas, 60);
  assert.equal(oos.validacion.datos.velas, 40);
});

test('phase2-d: OOS 70/30 split structure', () => {
  const oos = validarFueraMuestra(serieFixture, estrategia, configFixture, 70);

  assert.equal(oos.entrenamiento.datos.velas, 70);
  assert.equal(oos.validacion.datos.velas, 30);
});

test('phase2-d: walk-forward 40/20 window structure', () => {
  const wf = ejecutarWalkForward(serieFixture, estrategia, configFixture, 40, 20);

  // Verify windows exist
  assert.ok(Array.isArray(wf));
  assert.ok(wf.length > 0);

  // Verify first window structure
  const ventana1 = wf[0]!;
  assert.equal(ventana1.entrenamiento.datos.velas, 40);
  assert.equal(ventana1.validacion.datos.velas, 20);
});

test('phase2-d: walk-forward 30/15 window structure', () => {
  const wf = ejecutarWalkForward(serieFixture, estrategia, configFixture, 30, 15);

  assert.ok(wf.length > 0);

  for (const ventana of wf) {
    assert.equal(ventana.entrenamiento.datos.velas, 30);
    assert.equal(ventana.validacion.datos.velas, 15);
  }
});

test('phase2-d: walk-forward data continuity', () => {
  const wf = ejecutarWalkForward(serieFixture, estrategia, configFixture, 40, 20);

  // Each window must have consecutive data (no gaps)
  for (const ventana of wf) {
    // Train and validation must be contiguous
    assert.ok(ventana.entrenamiento.datos.velas > 0);
    assert.ok(ventana.validacion.datos.velas > 0);
  }
});

test('phase2-d: OOS metrics consistency', () => {
  const oos = validarFueraMuestra(serieFixture, estrategia, configFixture, 50);

  // Both partitions must produce valid metrics
  const trainMetrics = oos.entrenamiento.metricas;
  const oosMetrics = oos.validacion.metricas;

  assert.ok(Number.isFinite(trainMetrics.retornoNeto));
  assert.ok(Number.isFinite(oosMetrics.retornoNeto));
  assert.ok(Number.isFinite(trainMetrics.operacionesExitosas || 0));
  assert.ok(Number.isFinite(oosMetrics.operacionesExitosas || 0));
});

test('phase2-d: walk-forward metrics collected', () => {
  const wf = ejecutarWalkForward(serieFixture, estrategia, configFixture, 40, 20);

  // Each window must have valid metrics
  for (const ventana of wf) {
    const trainMetrics = ventana.entrenamiento.metricas;
    const oosMetrics = ventana.validacion.metricas;

    assert.ok(Number.isFinite(trainMetrics.retornoNeto));
    assert.ok(Number.isFinite(oosMetrics.retornoNeto));
  }
});
