import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  MemoryLayers,
  inicializarML,
  obtenerML,
  asignarML,
  type MemoryLayer,
} from '../src/trading-lab/memory-layers.ts';

test('memory-layers: registra documento en DOCUMENTARY', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-doc-${Date.now()}.json`));

  const entrada = ml.registrarDocumento({
    documentId: 'doc-001',
    title: 'FED Policy',
    authority: 'INSTITUTIONAL',
    source: 'knowledge-base',
  });

  assert.equal(entrada.memoryLayer, 'DOCUMENTARY');
  assert.equal(entrada.entityType, 'DOCUMENT');
  assert.equal(entrada.entityId, 'doc-001');
});

test('memory-layers: registra evento en MARKET_HISTORY', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-event-${Date.now()}.json`));

  const entrada = ml.registrarEvento({
    eventId: 'evt-001',
    date: '2026-09-26',
    description: 'FED rate decision',
    marketReaction: 'EURUSD dropped 50 pips',
    source: 'history-db',
  });

  assert.equal(entrada.memoryLayer, 'MARKET_HISTORY');
  assert.equal(entrada.entityType, 'EVENT');
});

test('memory-layers: registra experimento en EXPERIMENT', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-exp-${Date.now()}.json`));

  const entrada = ml.registrarExperimento({
    runId: 'run-123',
    backtest: 75,
    oos: 62,
    walkForward: [65, 68, 61],
    source: 'backtester',
  });

  assert.equal(entrada.memoryLayer, 'EXPERIMENT');
  assert.equal(entrada.entityType, 'EXPERIMENT');
  assert.equal(entrada.experimentRef.runId, 'run-123');
});

test('memory-layers: registra razonamiento en REASONING', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-reason-${Date.now()}.json`));

  const entrada = ml.registrarRazonamiento({
    caseId: 'case-001',
    findings: ['FED dovish', 'EUR weakness'],
    contradictions: ['CPI up'],
    invalidationConditions: ['NFP > +300k'],
    source: 'trading-reasoning',
  });

  assert.equal(entrada.memoryLayer, 'REASONING');
  assert.equal(entrada.entityType, 'DECISION_CASE');
});

test('memory-layers: NO mezcla capas - documentos solo DOCUMENTARY', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-nomix-${Date.now()}.json`));

  ml.registrarDocumento({
    documentId: 'doc-002',
    title: 'Doc',
    authority: 'INSTITUTIONAL',
    source: 'kb',
  });

  ml.registrarEvento({
    eventId: 'evt-002',
    date: '2026-09-26',
    description: 'Event',
    marketReaction: 'Reacted',
    source: 'history',
  });

  const docs = ml.obtenerDocumentos();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].memoryLayer, 'DOCUMENTARY');

  const eventos = ml.obtenerEventos();
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].memoryLayer, 'MARKET_HISTORY');
});

test('memory-layers: obtiene por capa', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-getcapa-${Date.now()}.json`));

  ml.registrarDocumento({
    documentId: 'doc-003',
    title: 'Doc',
    authority: 'INSTITUTIONAL',
    source: 'kb',
  });

  ml.registrarExperimento({
    runId: 'run-456',
    source: 'backtester',
  });

  const docLayer = ml.obtenerPorCapa('DOCUMENTARY');
  const expLayer = ml.obtenerPorCapa('EXPERIMENT');

  assert.equal(docLayer.length, 1);
  assert.equal(expLayer.length, 1);

  assert.equal(docLayer[0].memoryLayer, 'DOCUMENTARY');
  assert.equal(expLayer[0].memoryLayer, 'EXPERIMENT');
});

test('memory-layers: estado separado por capa', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-state-${Date.now()}.json`));

  ml.registrarDocumento({
    documentId: 'doc-004',
    title: 'Doc',
    authority: 'INSTITUTIONAL',
    source: 'kb',
  });

  ml.registrarEvento({
    eventId: 'evt-003',
    date: '2026-09-26',
    description: 'Event',
    marketReaction: 'Reacted',
    source: 'history',
  });

  ml.registrarExperimento({
    runId: 'run-789',
    source: 'backtester',
  });

  const estado = ml.obtenerEstado();

  assert.equal(estado.documentary, 1);
  assert.equal(estado.marketHistory, 1);
  assert.equal(estado.experiment, 1);
  assert.equal(estado.reasoning, 0);
  assert.equal(estado.total, 3);
});

test('memory-layers: persistencia guarda y carga', () => {
  const ruta = join(tmpdir(), `ml-persist-${Date.now()}.json`);

  const ml1 = new MemoryLayers(ruta);
  ml1.registrarDocumento({
    documentId: 'doc-persist',
    title: 'Persistent Doc',
    authority: 'INSTITUTIONAL',
    source: 'kb',
  });

  const ml2 = new MemoryLayers(ruta);
  const docs = ml2.obtenerDocumentos();

  assert.equal(docs.length, 1);
  assert.equal(docs[0].documentRef.documentId, 'doc-persist');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('memory-layers: singleton', () => {
  asignarML(null);
  assert.equal(obtenerML(), null);

  const ml = inicializarML(join(tmpdir(), `ml-sing-${Date.now()}.json`));
  assert.equal(obtenerML(), ml);

  asignarML(null);
});

test('memory-layers: entidades tienen timestamps', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-time-${Date.now()}.json`));

  const doc = ml.registrarDocumento({
    documentId: 'doc-005',
    title: 'Doc',
    authority: 'INSTITUTIONAL',
    source: 'kb',
  });

  assert.ok(doc.createdAt);
  assert.ok(doc.updatedAt);
  assert.equal(doc.createdAt, doc.updatedAt);
});

test('memory-layers: source es requerido', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-src-${Date.now()}.json`));

  const doc = ml.registrarDocumento({
    documentId: 'doc-006',
    title: 'Doc',
    authority: 'INSTITUTIONAL',
    source: 'specific-source',
  });

  assert.equal(doc.source, 'specific-source');
});

test('memory-layers: razonamiento soporta contradictions', () => {
  const ml = new MemoryLayers(join(tmpdir(), `ml-contra-${Date.now()}.json`));

  const razon = ml.registrarRazonamiento({
    hypothesisId: 'hyp-001',
    findings: ['Signal A', 'Signal B'],
    contradictions: ['Counter-signal X', 'Counter-signal Y'],
    invalidationConditions: ['If news drops', 'If NFP > 300k'],
    source: 'critic',
  });

  assert.equal(razon.reasoningRef.contradictions.length, 2);
  assert.equal(razon.reasoningRef.invalidationConditions.length, 2);
});
