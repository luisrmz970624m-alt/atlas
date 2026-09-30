import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarTRE } from '../src/trading-lab/trading-reasoning.ts';

test('phase2-f: trading reasoning engine initialized', () => {
  const tre = inicializarTRE();
  assert.ok(tre);
});

test('phase2-f: market context analysis available', () => {
  const tre = inicializarTRE();

  const result = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: 'H1',
    trend: 'UP',
    volatility: 30,
  });

  assert.ok(result);
  assert.ok(result.marketRegime);
  assert.ok(['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'UNKNOWN'].includes(result.marketRegime));
});

test('phase2-f: trading critic integration', () => {
  const tre = inicializarTRE();

  // Verify aplicarCritico method is available
  assert.ok(typeof tre.aplicarCritico === 'function');
});

test('phase2-f: decision case generation', () => {
  const tre = inicializarTRE();

  const decision = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: 'H1',
    precioActual: 1.082,
    senalTecnica: 'comprar',
    confianza: 'MEDIUM' as const,
  });

  assert.ok(decision);
  assert.ok(decision.caseId);
});

test('phase2-f: regime detector integration', () => {
  const tre = inicializarTRE();

  const analysis = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: 'H1',
    trend: 'UP',
    volatility: 35,
  });

  // Regime should be detected
  assert.ok(analysis.marketRegime);
  assert.ok(['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'VOLATILE', 'UNKNOWN'].includes(analysis.marketRegime));
});

test('phase2-f: critic analysis applied', () => {
  const tre = inicializarTRE();

  // Apply critic analysis
  const criticResult = tre.aplicarCritico({
    decision: {
      caseId: 'test_critic',
      timestamp: new Date().toISOString(),
      instrument: 'EURUSD',
      timeframe: 'H1',
      senalTecnica: 'comprar',
      confianza: 'HIGH' as const,
      reasoning: 'Strong uptrend',
    },
    regime: 'TRENDING_UP',
  });

  assert.ok(criticResult);
});

test('phase2-f: decision retrieval capability', () => {
  const tre = inicializarTRE();

  // Generate a decision
  const decision = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: 'H1',
    precioActual: 1.082,
    senalTecnica: 'comprar',
    confianza: 'HIGH' as const,
  });

  assert.ok(decision);
  assert.ok(decision.caseId);

  // Retrieve the decision
  const retrieved = tre.obtenerDecisionCase(decision.caseId);
  assert.ok(retrieved);
});

test('phase2-f: confidence state validation', () => {
  const tre = inicializarTRE();

  const decision = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: 'H1',
    precioActual: 1.082,
    senalTecnica: 'comprar',
    confianza: 'MEDIUM' as const,
  });

  // Verify: decision was generated with proper reasoning
  assert.ok(decision.caseId);
  assert.ok(decision.reasoning);
  assert.ok(decision.result);
});
