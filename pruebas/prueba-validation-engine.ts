import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationEngine, validationEngine } from '../src/trading-lab/validation-engine.ts';

test('ve: calcula component score', () => {
  const ve = new ValidationEngine();

  const comp = ve.calcularComponent('BacktestScore', 78, 'win_rate * 100');

  assert.equal(comp.componentName, 'BacktestScore');
  assert.equal(comp.value, 78);
  assert.equal(comp.status, 'CALCULATED');
});

test('ve: registra validation score', () => {
  const ve = new ValidationEngine();

  const comp1 = ve.calcularComponent('Backtest', 78, 'formula1');
  const comp2 = ve.calcularComponent('OOS', 64, 'formula2');

  const score = ve.registrarScore('case-001', [comp1, comp2]);

  assert.equal(score.caseId, 'case-001');
  assert.equal(score.components.length, 2);
  assert.ok(score.timestamp);
});

test('ve: calcula overall score si todos calculados', () => {
  const ve = new ValidationEngine();

  const comp1 = ve.calcularComponent('A', 80, 'f1');
  const comp2 = ve.calcularComponent('B', 60, 'f2');

  const score = ve.registrarScore('case-002', [comp1, comp2]);

  assert.ok(score.overallScore);
  assert.equal(score.overallScore, 70); // (80 + 60) / 2
});

test('ve: NO calcula overall si faltan datos', () => {
  const ve = new ValidationEngine();

  const comp1 = {
    componentName: 'A',
    value: 80,
    formula: 'f1',
    status: 'INSUFFICIENT_DATA' as const,
  };
  const comp2 = ve.calcularComponent('B', 60, 'f2');

  const score = ve.registrarScore('case-003', [comp1, comp2]);

  assert.equal(score.overallScore, null);
});

test('ve: obtiene score', () => {
  const ve = new ValidationEngine();

  const comp = ve.calcularComponent('Score', 75, 'formula');
  ve.registrarScore('case-004', [comp]);

  const recuperado = ve.obtenerScore('case-004');
  assert.ok(recuperado);
  assert.equal(recuperado!.overallScore, 75);
});

test('ve: estado', () => {
  const ve = new ValidationEngine();

  const comp1 = ve.calcularComponent('A', 80, 'f1');
  const comp2 = ve.calcularComponent('B', 60, 'f2');

  ve.registrarScore('case-005', [comp1, comp2]);
  ve.registrarScore('case-006', [comp1]);

  const estado = ve.estado();
  assert.equal(estado.totalScores, 2);
  assert.ok(estado.conOverallScore >= 1);
});

test('ve: singleton global', () => {
  assert.ok(validationEngine);
  assert.ok(validationEngine.registrarScore);
});
