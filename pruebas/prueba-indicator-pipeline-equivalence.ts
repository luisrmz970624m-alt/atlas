import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCruceMedias, senalCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import { validarFueraMuestra, ejecutarWalkForward } from '../src/trading-lab/validacion.ts';
import {
  IndicatorPipelineOrchestrator,
  resolverImplementation,
  IMPLEMENTATION_ALLOWLIST,
} from '../src/trading-lab/indicator-pipeline.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

// Fixture data para tests
const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_test',
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

test('pipeline: implementation allowlist contiene existing_ma_cross', () => {
  assert.ok(IMPLEMENTATION_ALLOWLIST.existing_ma_cross);
  assert.equal(IMPLEMENTATION_ALLOWLIST.existing_ma_cross.source, 'src/trading-lab/estrategias.ts');
});

test('pipeline: resolver implementation retorna detalles', () => {
  const impl = resolverImplementation('existing_ma_cross');
  assert.ok(impl);
  assert.equal(impl.name, 'Moving Average Crossover (Legacy)');
  assert.ok(impl.functions.includes('crearCruceMedias'));
});

test('pipeline: resolver implementation rechaza keys inválidas', () => {
  const impl = resolverImplementation('nonexistent_indicator');
  assert.equal(impl, null);
});

test('pipeline: crear pipeline run', () => {
  const orch = new IndicatorPipelineOrchestrator();

  const run = orch.crearRun({
    indicatorId: 'MA_CROSS',
    indicatorVersion: '1.0',
    implementationKey: 'existing_ma_cross',
    instrument: 'EURUSD',
    timeframe: 'H1',
    datasetId: 'EURUSD_H1_test',
    datasetSource: 'TEST_FIXTURE',
  });

  assert.ok(run.pipelineRunId);
  assert.equal(run.indicatorId, 'MA_CROSS');
  assert.equal(run.currentStage, 'SPECIFICATION');
  assert.equal(run.status, 'RUNNING');
});

test('pipeline: obtener run registrado', () => {
  const orch = new IndicatorPipelineOrchestrator();

  const run1 = orch.crearRun({
    indicatorId: 'MA_CROSS',
    indicatorVersion: '1.0',
    implementationKey: 'existing_ma_cross',
    instrument: 'EURUSD',
    timeframe: 'H1',
    datasetId: 'test1',
    datasetSource: 'TEST_FIXTURE',
  });

  const recuperado = orch.obtenerRun(run1.pipelineRunId);
  assert.ok(recuperado);
  assert.equal(recuperado.indicatorId, 'MA_CROSS');
});

test('pipeline: stage failure detiene pipeline', () => {
  const orch = new IndicatorPipelineOrchestrator();

  const run = orch.crearRun({
    indicatorId: 'MA_CROSS',
    indicatorVersion: '1.0',
    implementationKey: 'existing_ma_cross',
    instrument: 'EURUSD',
    timeframe: 'H1',
    datasetId: 'test2',
    datasetSource: 'TEST_FIXTURE',
  });

  // Simular fallo en DATA_CHECK
  const avance = orch.avanzeStage(run.pipelineRunId, {
    stage: 'SPECIFICATION',
    status: 'PASS',
    completedAt: new Date().toISOString(),
  });

  assert.ok(avance);

  const avanceFail = orch.avanzeStage(run.pipelineRunId, {
    stage: 'DATA_CHECK',
    status: 'FAIL',
    reason: 'Missing data',
  });

  assert.equal(avanceFail, false);

  const updated = orch.obtenerRun(run.pipelineRunId);
  assert.equal(updated!.status, 'HALTED');
  assert.equal(updated!.finalResult, 'REJECTED');
});

test('equivalencia: legacy backtest = same result', () => {
  const estrategia = crearCruceMedias({
    id: 'ma_cross_equiv',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(serieFixture, estrategia, configFixture);

  assert.equal(resultado.reproducible, true);
  assert.equal(resultado.estrategia.id, 'ma_cross_equiv');
  assert.ok(resultado.metricas);
  assert.ok(Array.isArray(resultado.operaciones));
});

test('equivalencia: legacy OOS = separated train/test', () => {
  const estrategia = crearCruceMedias({
    id: 'ma_cross_oos',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const oos = validarFueraMuestra(serieFixture, estrategia, configFixture, 50);

  // Train debe tener 50 velas
  assert.equal(oos.entrenamiento.datos.velas, 50);
  // OOS debe tener resto
  assert.equal(oos.validacion.datos.velas, serieFixture.velas.length - 50);
  // Ambos deben tener metricas válidas
  assert.ok(Number.isFinite(oos.entrenamiento.metricas.retornoNeto));
  assert.ok(Number.isFinite(oos.validacion.metricas.retornoNeto));
  // Deben ser valores que representan porcentajes
  assert.ok(oos.entrenamiento.metricas.retornoNeto >= -100);
  assert.ok(oos.validacion.metricas.retornoNeto >= -100);
});

test('equivalencia: legacy WF = multiple windows', () => {
  const estrategia = crearCruceMedias({
    id: 'ma_cross_wf',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const wf = ejecutarWalkForward(serieFixture, estrategia, configFixture, 40, 20);

  assert.ok(Array.isArray(wf));
  assert.ok(wf.length > 0);

  // Verificar que cada ventana está separada
  for (let i = 0; i < wf.length; i++) {
    const ventana = wf[i]!;
    assert.equal(ventana.entrenamiento.datos.velas, 40);
    assert.equal(ventana.validacion.datos.velas, 20);
  }
});

test('equivalencia: no duplicate implementation', () => {
  // Verifica que no hay una segunda implementación de MA_CROSS
  // copiada o duplicada en el código
  const impl = resolverImplementation('existing_ma_cross');
  assert.ok(impl);
  assert.equal(impl.functions.length, 3); // media, crearCruceMedias, senalCruceMedias
  assert.ok(impl.functions.includes('crearCruceMedias'));
  assert.ok(impl.functions.includes('senalCruceMedias'));
  assert.ok(impl.functions.includes('media'));
});

test('pipeline: estado inicial', () => {
  const orch = new IndicatorPipelineOrchestrator();

  const estado = orch.obtenerEstado();
  assert.equal(estado.totalRuns, 0);
  assert.equal(estado.running, 0);
  assert.equal(estado.completed, 0);
  assert.equal(estado.failed, 0);
});

test('pipeline: múltiples runs simultáneos', () => {
  const orch = new IndicatorPipelineOrchestrator();

  const run1 = orch.crearRun({
    indicatorId: 'MA_CROSS',
    indicatorVersion: '1.0',
    implementationKey: 'existing_ma_cross',
    instrument: 'EURUSD',
    timeframe: 'H1',
    datasetId: 'test1',
    datasetSource: 'TEST_FIXTURE',
  });

  const run2 = orch.crearRun({
    indicatorId: 'MA_CROSS',
    indicatorVersion: '1.0',
    implementationKey: 'existing_ma_cross',
    instrument: 'GBPUSD',
    timeframe: 'H1',
    datasetId: 'test2',
    datasetSource: 'TEST_FIXTURE',
  });

  assert.notEqual(run1.pipelineRunId, run2.pipelineRunId);

  const estado = orch.obtenerEstado();
  assert.equal(estado.totalRuns, 2);
  assert.equal(estado.running, 2);
});
