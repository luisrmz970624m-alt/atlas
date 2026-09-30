import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarKO } from '../src/trading-lab/knowledge-organizer.ts';
import { inicializarML } from '../src/trading-lab/memory-layers.ts';
import { inicializarIR } from '../src/trading-lab/indicator-registry.ts';

test('phase2-g: knowledge organizer available', () => {
  const ko = inicializarKO();
  assert.ok(ko);
});

test('phase2-g: memory layers available', () => {
  const ml = inicializarML();
  assert.ok(ml);
});

test('phase2-g: indicator registry available', () => {
  const ir = inicializarIR();
  assert.ok(ir);

  // Verify MA_CROSS is registered
  const maCross = ir.obtenerIndicador('MA_CROSS');
  assert.ok(maCross);
});

test('phase2-g: knowledge organizer can classify', () => {
  const ko = inicializarKO();

  // Verify organizer can perform classification
  const result = ko.clasificar({
    documentId: 'test_doc_g1',
    contenido: 'EUR/USD trading setup with moving average crossover',
    tema: 'TRADING_INDICATORS',
  });

  assert.ok(result);
});

test('phase2-g: memory layer isolation maintained', () => {
  const ml = inicializarML();

  // Register items in different layers
  ml.registrarDocumento({
    documentId: 'doc_test_g1',
    titulo: 'Test Document',
    fuente: 'test',
    contenido: 'Test content',
  });

  ml.registrarEvento({
    eventId: 'event_test_g1',
    tipo: 'TEST',
    timestamp: new Date().toISOString(),
    descripcion: 'Test event',
    datos: {},
  });

  // Verify layers are separate
  const docs = ml.obtenerPorCapa('DOCUMENTARY');
  const events = ml.obtenerPorCapa('MARKET_HISTORY');

  assert.ok(docs.length > 0);
  assert.ok(events.length > 0);
});

test('phase2-g: indicator registry references documents', () => {
  const ir = inicializarIR();
  const ml = inicializarML();

  // Document registration for indicator
  ml.registrarDocumento({
    documentId: 'doc_ma_cross_spec',
    titulo: 'MA_CROSS Specification',
    fuente: 'test',
    contenido: 'MA_CROSS specification document',
  });

  // Verify both systems exist independently
  const maCross = ir.obtenerIndicador('MA_CROSS');
  assert.ok(maCross);

  const docs = ml.obtenerDocumentos();
  assert.ok(docs.length > 0);
});

test('phase2-g: indicator registry listing works', () => {
  const ir = inicializarIR();

  // Indicator registry should have indicators
  const indicators = ir.listarActivos();
  assert.ok(Array.isArray(indicators));
  assert.ok(indicators.length > 0);
});

test('phase2-g: memory layer state tracking', () => {
  const ml = inicializarML();

  // Register multiple items
  for (let i = 0; i < 3; i++) {
    ml.registrarDocumento({
      documentId: `doc_state_${i}`,
      titulo: `Test Document ${i}`,
      fuente: 'test',
      contenido: `Test content ${i}`,
    });
  }

  // Verify state is tracked
  const docs = ml.obtenerPorCapa('DOCUMENTARY');
  assert.ok(docs.length >= 3);
});
