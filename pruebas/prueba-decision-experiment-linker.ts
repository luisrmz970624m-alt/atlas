import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  DecisionExperimentLinker,
  inicializarDEL,
  obtenerDEL,
  asignarDEL,
} from '../src/trading-lab/decision-experiment-linker.ts';

test('del: registra DecisionCase', () => {
  const ruta = join(tmpdir(), `del-case-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  const caseRef = del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'EURUSD bullish on FED dovish',
  });

  assert.equal(caseRef.caseId, 'case-001');
  assert.equal(caseRef.hypothesis, 'EURUSD bullish on FED dovish');
  assert.equal(caseRef.experimentIds.length, 0);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: registra Experiment', () => {
  const ruta = join(tmpdir(), `del-exp-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  const expRef = del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
    oos: 64,
    walkForward: [65, 68, 61],
  });

  assert.equal(expRef.runId, 'run-001');
  assert.equal(expRef.results.backtest, 78);
  assert.equal(expRef.results.oos, 64);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: víncula DecisionCase → Experiment (forward)', () => {
  const ruta = join(tmpdir(), `del-forward-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'EURUSD bullish',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.vincularForward('case-001', 'run-001', 'backtest para hipótesis');

  assert.ok(del.existeVinculo('case-001', 'run-001'));

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: víncula Experiment → DecisionCase (reverse)', () => {
  const ruta = join(tmpdir(), `del-reverse-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'EURUSD bullish',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.vincularReverse('case-001', 'run-001');

  const cases = del.obtenerCasesPorExperimento('run-001');
  assert.equal(cases.length, 1);
  assert.equal(cases[0].caseId, 'case-001');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: obtiene Experiments de un DecisionCase', () => {
  const ruta = join(tmpdir(), `del-get-exp-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'Hipótesis 1',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.registrarExperiment({
    runId: 'run-002',
    backtest: 72,
  });

  del.vincularForward('case-001', 'run-001');
  del.vincularForward('case-001', 'run-002');

  const experimentos = del.obtenerExperimentosPorCase('case-001');
  assert.equal(experimentos.length, 2);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: obtiene DecisionCases de un Experiment', () => {
  const ruta = join(tmpdir(), `del-get-cases-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'Hipótesis 1',
  });

  del.registrarCase({
    caseId: 'case-002',
    hypothesis: 'Hipótesis 2',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.vincularReverse('case-001', 'run-001');
  del.vincularReverse('case-002', 'run-001');

  const cases = del.obtenerCasesPorExperimento('run-001');
  assert.equal(cases.length, 2);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: NO duplica vínculos', () => {
  const ruta = join(tmpdir(), `del-nodup-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'Hipótesis',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.vincularForward('case-001', 'run-001');
  del.vincularForward('case-001', 'run-001'); // Segunda vez

  const experimentos = del.obtenerExperimentosPorCase('case-001');
  assert.equal(experimentos.length, 1); // Solo 1, no 2

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: persistencia', () => {
  const ruta = join(tmpdir(), `del-persist-${Date.now()}.json`);

  const del1 = new DecisionExperimentLinker(ruta);
  del1.registrarCase({
    caseId: 'case-001',
    hypothesis: 'Hipótesis',
  });

  del1.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del1.vincularForward('case-001', 'run-001');

  const del2 = new DecisionExperimentLinker(ruta);
  assert.ok(del2.existeVinculo('case-001', 'run-001'));

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: estado', () => {
  const ruta = join(tmpdir(), `del-state-${Date.now()}.json`);
  const del = new DecisionExperimentLinker(ruta);

  del.registrarCase({
    caseId: 'case-001',
    hypothesis: 'H1',
  });

  del.registrarCase({
    caseId: 'case-002',
    hypothesis: 'H2',
  });

  del.registrarExperiment({
    runId: 'run-001',
    backtest: 78,
  });

  del.vincularForward('case-001', 'run-001');

  const estado = del.obtenerEstado();
  assert.equal(estado.totalCases, 2);
  assert.equal(estado.totalExperiments, 1);
  assert.equal(estado.totalLinkages, 1);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('del: singleton', () => {
  asignarDEL(null);
  assert.equal(obtenerDEL(), null);

  const ruta = join(tmpdir(), `del-sing-${Date.now()}.json`);
  const del = inicializarDEL(ruta);
  assert.equal(obtenerDEL(), del);

  asignarDEL(null);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});
