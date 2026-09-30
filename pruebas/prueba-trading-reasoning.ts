import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  TradingReasoningEngine,
  inicializarTRE,
  obtenerTRE,
  asignarTRE,
} from '../src/trading-lab/trading-reasoning.ts';
import { KnowledgeGraphEngine } from '../src/trading-lab/knowledge-graph.ts';
import { MemoryLayers } from '../src/trading-lab/memory-layers.ts';

test('trading-reasoning: fase 1 - contexto de mercado', () => {
  const tre = new TradingReasoningEngine();

  const analisis = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
    trend: 'UP',
    volatility: 35,
    liquidity: 90,
    session: 'EUROPEAN',
  });

  assert.equal(analisis.instrument, 'EURUSD');
  assert.equal(analisis.trend, 'UP');
  assert.equal(analisis.volatility, 35);
  assert.equal(analisis.marketRegime, 'TRENDING_UP');
});

test('trading-reasoning: fase 1 - detecta régimen RANGING', () => {
  const tre = new TradingReasoningEngine();

  const analisis = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
    trend: 'SIDEWAYS',
    volatility: 45,
  });

  assert.equal(analisis.marketRegime, 'RANGING');
});

test('trading-reasoning: fase 1 - detecta régimen VOLATILE', () => {
  const tre = new TradingReasoningEngine();

  const analisis = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
    trend: 'UP',
    volatility: 85,
  });

  assert.equal(analisis.marketRegime, 'VOLATILE');
});

test('trading-reasoning: fase 2 - análisis fundamental', () => {
  const tre = new TradingReasoningEngine();

  const analisis = tre.analizarFundamental({
    instrument: 'EURUSD',
    factors: {
      rates: 'ECB 4.25%',
      centralBanks: ['ECB', 'FED'],
      inflation: 'EUR: 2.1%, USD: 3.2%',
      employment: 'Strong US jobs',
      geopolitics: ['Ukraine conflict'],
      events: ['ECB decision'],
    },
  });

  assert.equal(analisis.instrument, 'EURUSD');
  assert.equal(analisis.evidenceCount, 6);
  assert.ok(analisis.factors.rates);
});

test('trading-reasoning: fase 2 - cuenta factores presentes', () => {
  const tre = new TradingReasoningEngine();

  const sinDatos = tre.analizarFundamental({
    instrument: 'EURUSD',
    factors: {},
  });

  assert.equal(sinDatos.evidenceCount, 0);

  const conDatos = tre.analizarFundamental({
    instrument: 'EURUSD',
    factors: {
      rates: 'ECB 4.25%',
      inflation: 'EUR: 2.1%',
    },
  });

  assert.equal(conDatos.evidenceCount, 2);
});

test('trading-reasoning: fase 3 - análisis técnico', () => {
  const tre = new TradingReasoningEngine();

  const analisis = tre.analizarTecnico({
    instrument: 'EURUSD',
    timeframe: '1d',
    marketStructure: 'Higher Highs Higher Lows',
    trend: 'Bullish',
    momentum: 'Strong',
    indicators: [
      { name: 'RSI', value: 65, signal: 'Overbought' },
      { name: 'MACD', value: 0.0045, signal: 'Bullish' },
    ],
  });

  assert.equal(analisis.instrument, 'EURUSD');
  assert.equal(analisis.registeredIndicators.length, 2);
  assert.equal(analisis.registeredIndicators[0].name, 'RSI');
});

test('trading-reasoning: fase 4 - busca análogos históricos', () => {
  const tre = new TradingReasoningEngine();

  const analogue = tre.buscarAnalogoHistorico({
    regime: 'TRENDING_UP',
    casesAvailable: 5,
  });

  assert.ok(analogue);
  assert.equal(analogue!.regimeAtTime, 'TRENDING_UP');
  assert.equal(analogue!.casesAvailable, 5);
  assert.ok(analogue!.confidenceScore > 0);
});

test('trading-reasoning: fase 4 - sin casos devuelve null', () => {
  const tre = new TradingReasoningEngine();

  const analogue = tre.buscarAnalogoHistorico({
    regime: 'TRENDING_UP',
    casesAvailable: 0,
  });

  assert.equal(analogue, null);
});

test('trading-reasoning: fase 5 - experiencia de Atlas', () => {
  const tre = new TradingReasoningEngine();

  const experiencia = tre.consultarExperienciaAtlas({
    instrument: 'EURUSD',
    backtestWinRate: 62,
    oosValidated: true,
    walkForwardScores: [58, 61, 59],
    paperWinRate: 55,
  });

  assert.equal(experiencia.instrument, 'EURUSD');
  assert.equal(experiencia.backtestWinRate, 62);
  assert.equal(experiencia.oosValidated, true);
  assert.equal(experiencia.walkForwardScores.length, 3);
});

test('trading-reasoning: fase 6 - crítico rechaza hipótesis poco clara', () => {
  const tre = new TradingReasoningEngine();

  const critico = tre.aplicarCritico({
    hypothesisClear: false,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  assert.equal(critico.hypothesisClear, false);
  assert.ok(critico.verdict.includes('hipótesis'));
});

test('trading-reasoning: fase 6 - crítico requiere evidencia', () => {
  const tre = new TradingReasoningEngine();

  const critico = tre.aplicarCritico({
    hypothesisClear: true,
    evidenceSufficient: false,
    riskCompliant: true,
  });

  assert.equal(critico.evidenceSufficient, false);
  assert.ok(critico.verdict.includes('Insuficiente'));
});

test('trading-reasoning: fase 6 - crítico verifica riesgo', () => {
  const tre = new TradingReasoningEngine();

  const critico = tre.aplicarCritico({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: false,
  });

  assert.equal(critico.riskCompliant, false);
  assert.ok(critico.verdict.includes('Incumplimiento'));
});

test('trading-reasoning: confirmation gates - PASS', () => {
  const tre = new TradingReasoningEngine();

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  assert.equal(gates.gate1_signal.passed, true);
  assert.equal(gates.gate2_evidence.passed, true);
  assert.equal(gates.gate3_risk.passed, true);
  assert.equal(gates.overallResult, 'PASS');
});

test('trading-reasoning: confirmation gates - FAIL', () => {
  const ruta = join(tmpdir(), `tre-fail-${Date.now()}.json`);
  const tre = new TradingReasoningEngine(ruta);

  const gates = tre.aplicarConfirmations({
    hypothesisClear: false,
    evidenceSufficient: false,
    riskCompliant: false,
  });

  assert.equal(gates.overallResult, 'FAIL');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: confirmation gates - MIXED', () => {
  const ruta = join(tmpdir(), `tre-mixed-${Date.now()}.json`);
  const tre = new TradingReasoningEngine(ruta);

  const gates = tre.aplicarConfirmations({
    hypothesisClear: false,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  // Si gate1 falla pero gate2 pasa = MIXED
  assert.equal(gates.overallResult, 'MIXED');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: genera DecisionCase válido', () => {
  const tre = new TradingReasoningEngine();

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
    trend: 'UP',
  });

  const phase6 = tre.aplicarCritico({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const decisionCase = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    phase6,
    confirmations: gates,
  });

  assert.ok(decisionCase.caseId);
  assert.equal(decisionCase.instrument, 'EURUSD');
  assert.equal(decisionCase.result, 'PAPER_CANDIDATE');
});

test('trading-reasoning: DecisionCase rechazado cuando falla gate', () => {
  const ruta = join(tmpdir(), `tre-reject-${Date.now()}.json`);
  const tre = new TradingReasoningEngine(ruta);

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: false, // Evidence falla = overallResult FAIL
    riskCompliant: true,
  });

  const decisionCase = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates,
  });

  assert.equal(decisionCase.result, 'REJECTED');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: DecisionCase con OOS validado es TEST_CANDIDATE', () => {
  const tre = new TradingReasoningEngine();

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const phase5 = tre.consultarExperienciaAtlas({
    instrument: 'EURUSD',
    oosValidated: true,
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const decisionCase = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    phase5,
    confirmations: gates,
  });

  assert.equal(decisionCase.result, 'TEST_CANDIDATE');
});

test('trading-reasoning: obtiene DecisionCase por ID', () => {
  const tre = new TradingReasoningEngine();

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const decisionCase = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates,
  });

  const recuperado = tre.obtenerDecisionCase(decisionCase.caseId);
  assert.ok(recuperado);
  assert.equal(recuperado!.instrument, 'EURUSD');
});

test('trading-reasoning: lista casos por instrumento', () => {
  const ruta = join(tmpdir(), `tre-list-${Date.now()}.json`);
  const tre = new TradingReasoningEngine(ruta);

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates,
  });

  tre.generarDecisionCase({
    instrument: 'GBPUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates,
  });

  const casosEUR = tre.listarPorInstrumento('EURUSD');
  assert.equal(casosEUR.length, 1);
  assert.equal(casosEUR[0].instrument, 'EURUSD');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: estado reporta conteos', () => {
  const ruta = join(tmpdir(), `tre-state-${Date.now()}.json`);
  const tre = new TradingReasoningEngine(ruta);

  const phase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates1 = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates1,
  });

  const gates2 = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: false, // Evidence falla = REJECTED
    riskCompliant: true,
  });

  tre.generarDecisionCase({
    instrument: 'GBPUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates2,
  });

  const estado = tre.obtenerEstado();
  assert.equal(estado.totalCases, 2);
  assert.equal(estado.resultados.PAPER_CANDIDATE, 1);
  assert.equal(estado.resultados.REJECTED, 1);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: persistencia guarda casos', () => {
  const ruta = join(tmpdir(), `tre-persist-${Date.now()}.json`);

  const tre1 = new TradingReasoningEngine(ruta);
  const phase1 = tre1.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates = tre1.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const decisionCase = tre1.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1,
    confirmations: gates,
  });

  const tre2 = new TradingReasoningEngine(ruta);
  const recuperado = tre2.obtenerDecisionCase(decisionCase.caseId);
  assert.ok(recuperado);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('trading-reasoning: singleton', () => {
  asignarTRE(null);
  assert.equal(obtenerTRE(), null);

  const tre = inicializarTRE(join(tmpdir(), `tre-sing-${Date.now()}.json`));
  assert.equal(obtenerTRE(), tre);

  asignarTRE(null);
});

test('trading-reasoning: NO genera REAL_BUY o REAL_SELL', () => {
  const tre = new TradingReasoningEngine();

  const fase1 = tre.analizarContextoMercado({
    instrument: 'EURUSD',
    timeframe: '1d',
  });

  const gates = tre.aplicarConfirmations({
    hypothesisClear: true,
    evidenceSufficient: true,
    riskCompliant: true,
  });

  const decisionCase = tre.generarDecisionCase({
    instrument: 'EURUSD',
    timeframe: '1d',
    phase1: fase1,
    confirmations: gates,
  });

  assert.notEqual(decisionCase.result, 'REAL_BUY');
  assert.notEqual(decisionCase.result, 'REAL_SELL');
  assert.ok(
    ['NO_HYPOTHESIS', 'REJECTED', 'INSUFFICIENT_DATA', 'TEST_CANDIDATE', 'PAPER_CANDIDATE'].includes(
      decisionCase.result
    )
  );
});

test('trading-reasoning: retrieval vacío degrada a INSUFFICIENT_DATA sin inventar evidencia', () => {
  const tre = new TradingReasoningEngine(join(tmpdir(), `tre-cognitive-empty-${Date.now()}.json`));
  const graph = new KnowledgeGraphEngine(join(tmpdir(), `kg-cognitive-empty-${Date.now()}.json`));
  tre.conectarRetrievalCognitivo(graph);
  const decision = tre.razonarConRetrievalCognitivo({
    instrument: 'EURUSD', timeframe: 'H1', query: 'EURUSD',
    technical: { trend: 'UP' },
  });
  assert.equal(decision.result, 'INSUFFICIENT_DATA');
  assert.deepEqual(decision.cognitiveEvidence?.selectedNodeIds, []);
  assert.equal('confidence' in decision, false);
});

test('trading-reasoning: enlaza retrieval TRADING, experimento, memoria y trazabilidad sin mezclar instrumento', () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const tre = new TradingReasoningEngine(join(tmpdir(), `tre-cognitive-${stamp}.json`));
  const graph = new KnowledgeGraphEngine(join(tmpdir(), `kg-cognitive-${stamp}.json`));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: ['doc-eur'], chunkRefs: ['chunk-eur'], experimentRefs: ['run-eur'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  graph.agregarNodo({ nodeId: 'gbpusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'BUSINESS', name: 'GBPUSD', children: [], documentRefs: ['doc-gbp'], chunkRefs: ['chunk-gbp'], experimentRefs: ['run-gbp'], priority: 99, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const memory = new MemoryLayers(join(tmpdir(), `memory-cognitive-${stamp}.json`));
  memory.registrarExperimento({ runId: 'run-eur', source: 'fixture' });
  memory.registrarExperimento({ runId: 'run-gbp', source: 'fixture' });
  tre.conectarRetrievalCognitivo(graph, memory);
  const decision = tre.razonarConRetrievalCognitivo({
    instrument: 'EURUSD', timeframe: 'H1', query: 'EURUSD', intent: 'EURUSD', entities: ['EURUSD'], requestedTask: 'reasoning',
    technical: { marketStructure: 'Higher highs', trend: 'UP', indicators: [{ name: 'MA_CROSS', value: 1, signal: 'STRUCTURED' }] },
  });
  assert.deepEqual(decision.knowledgeNodes, ['vortice-root', 'eurusd']);
  assert.deepEqual(decision.documentRefs, ['doc-eur']);
  assert.deepEqual(decision.cognitiveEvidence?.experimentRefs, ['run-eur']);
  assert.equal(decision.cognitiveEvidence?.memoryEntryRefs.length, 1);
  assert.equal(decision.cognitiveEvidence?.query.domain, 'TRADING');
  assert.equal(decision.cognitiveEvidence?.query.timeframe, 'H1');
  assert.ok(decision.cognitiveEvidence?.traceability.some((item) => item.source === 'EXPERIMENT' && item.sourceId === 'run-eur'));
  assert.equal(decision.cognitiveEvidence?.documentRefs.includes('doc-gbp'), false);
  assert.equal(JSON.stringify(decision).includes('BUY'), false);
  assert.equal(JSON.stringify(decision).includes('SELL'), false);
});

test('trading-reasoning: evidencia cognitiva persiste sin escribir ni duplicar MemoryLayers', () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  const route = join(tmpdir(), `tre-cognitive-persist-${stamp}.json`);
  const memory = new MemoryLayers(join(tmpdir(), `memory-cognitive-persist-${stamp}.json`));
  const graph = new KnowledgeGraphEngine(join(tmpdir(), `kg-cognitive-persist-${stamp}.json`));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: ['doc-eur'], chunkRefs: [], experimentRefs: ['run-eur'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  memory.registrarExperimento({ runId: 'run-eur', source: 'fixture' });
  const before = memory.obtenerEstado().total;
  const tre = new TradingReasoningEngine(route); tre.conectarRetrievalCognitivo(graph, memory);
  const decision = tre.razonarConRetrievalCognitivo({ instrument: 'EURUSD', timeframe: 'H1', technical: { trend: 'UP' } });
  assert.equal(memory.obtenerEstado().total, before);
  const reloaded = new TradingReasoningEngine(route).obtenerDecisionCase(decision.caseId);
  assert.deepEqual(reloaded?.cognitiveEvidence?.experimentRefs, ['run-eur']);
});
