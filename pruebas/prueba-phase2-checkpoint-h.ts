import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarML, asignarML } from '../src/trading-lab/memory-layers.ts';
import { inicializarIR, asignarIR } from '../src/trading-lab/indicator-registry.ts';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { SerieHistorica, ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

const serieFixture: SerieHistorica = {
  id: 'EURUSD_H1_idempotence',
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

test('phase2-h: memory layer idempotence - triple register same document', () => {
  // Reset singleton
  asignarML(null);

  const ml1 = inicializarML();
  ml1.registrarDocumento({
    documentId: 'doc_idempotent_1',
    titulo: 'Test Document',
    fuente: 'test',
    contenido: 'Test content',
  });

  const ml2 = inicializarML();
  ml2.registrarDocumento({
    documentId: 'doc_idempotent_1',
    titulo: 'Test Document',
    fuente: 'test',
    contenido: 'Test content',
  });

  const ml3 = inicializarML();
  ml3.registrarDocumento({
    documentId: 'doc_idempotent_1',
    titulo: 'Test Document',
    fuente: 'test',
    contenido: 'Test content',
  });

  // All should reference the same logical document
  const docs1 = ml1.obtenerDocumentos();
  const docs2 = ml2.obtenerDocumentos();
  const docs3 = ml3.obtenerDocumentos();

  assert.equal(docs1.length, docs2.length);
  assert.equal(docs2.length, docs3.length);
});

test('phase2-h: indicator registry idempotence - triple initialization', () => {
  // Reset singleton
  asignarIR(null);

  const ir1 = inicializarIR();
  const count1 = ir1.estado().totalIndicadores;

  const ir2 = inicializarIR();
  const count2 = ir2.estado().totalIndicadores;

  const ir3 = inicializarIR();
  const count3 = ir3.estado().totalIndicadores;

  // All bootstraps should result in same count (idempotent)
  assert.equal(count1, count2);
  assert.equal(count2, count3);
});

test('phase2-h: backtest reproducibility - same parameters produce same result', () => {
  const estrategia = crearCruceMedias({
    id: 'idempotent_backtest',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const run1 = ejecutarBacktest(serieFixture, estrategia, configFixture);
  const run2 = ejecutarBacktest(serieFixture, estrategia, configFixture);
  const run3 = ejecutarBacktest(serieFixture, estrategia, configFixture);

  // All runs must produce identical results
  assert.equal(run1.metricas.retornoNeto, run2.metricas.retornoNeto);
  assert.equal(run2.metricas.retornoNeto, run3.metricas.retornoNeto);
  assert.equal(run1.operaciones.length, run2.operaciones.length);
  assert.equal(run2.operaciones.length, run3.operaciones.length);
});

test('phase2-h: memory events idempotence', () => {
  asignarML(null);

  const ml1 = inicializarML();
  ml1.registrarEvento({
    eventId: 'event_idempotent_h1',
    tipo: 'MARKET_MOVE',
    timestamp: '2024-01-01T00:00:00Z',
    descripcion: 'Test market event',
    datos: { precio: 1.082 },
  });

  const ml2 = inicializarML();
  ml2.registrarEvento({
    eventId: 'event_idempotent_h1',
    tipo: 'MARKET_MOVE',
    timestamp: '2024-01-01T00:00:00Z',
    descripcion: 'Test market event',
    datos: { precio: 1.082 },
  });

  const ml3 = inicializarML();
  ml3.registrarEvento({
    eventId: 'event_idempotent_h1',
    tipo: 'MARKET_MOVE',
    timestamp: '2024-01-01T00:00:00Z',
    descripcion: 'Test market event',
    datos: { precio: 1.082 },
  });

  const events1 = ml1.obtenerEventos();
  const events2 = ml2.obtenerEventos();
  const events3 = ml3.obtenerEventos();

  // All should have same count (same logical event, not duplicated)
  assert.equal(events1.length, events2.length);
  assert.equal(events2.length, events3.length);
});

test('phase2-h: full pipeline triple run consistency', () => {
  asignarML(null);
  asignarIR(null);

  // Run 1
  const ml1 = inicializarML();
  const ir1 = inicializarIR();
  ml1.registrarDocumento({
    documentId: 'doc_pipeline_h',
    titulo: 'Pipeline test doc',
    fuente: 'test',
    contenido: 'Pipeline content',
  });
  const docs1 = ml1.obtenerDocumentos().length;
  const indicators1 = ir1.listarActivos().length;

  // Run 2
  const ml2 = inicializarML();
  const ir2 = inicializarIR();
  ml2.registrarDocumento({
    documentId: 'doc_pipeline_h',
    titulo: 'Pipeline test doc',
    fuente: 'test',
    contenido: 'Pipeline content',
  });
  const docs2 = ml2.obtenerDocumentos().length;
  const indicators2 = ir2.listarActivos().length;

  // Run 3
  const ml3 = inicializarML();
  const ir3 = inicializarIR();
  ml3.registrarDocumento({
    documentId: 'doc_pipeline_h',
    titulo: 'Pipeline test doc',
    fuente: 'test',
    contenido: 'Pipeline content',
  });
  const docs3 = ml3.obtenerDocumentos().length;
  const indicators3 = ir3.listarActivos().length;

  // All runs must be identical
  assert.equal(docs1, docs2);
  assert.equal(docs2, docs3);
  assert.equal(indicators1, indicators2);
  assert.equal(indicators2, indicators3);
});
