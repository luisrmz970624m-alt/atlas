import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceMetadataManager, sourceMetadataManager } from '../src/trading-lab/source-metadata.ts';

test('sm: registra source metadata', () => {
  const sm = new SourceMetadataManager();

  sm.registrarSource({
    sourceId: 'source-001',
    sourceUrl: 'https://example.com',
    retrievedAt: new Date().toISOString(),
    authority: 'INSTITUTIONAL',
    status: 'CURRENT',
  });

  const source = sm.obtenerSource('source-001');
  assert.ok(source);
  assert.equal(source!.authority, 'INSTITUTIONAL');
});

test('sm: marca fuente como histórica', () => {
  const sm = new SourceMetadataManager();

  sm.registrarSource({
    sourceId: 'source-old',
    retrievedAt: '2024-01-01T00:00:00Z',
    authority: 'INSTITUTIONAL',
    status: 'HISTORICAL',
  });

  const source = sm.obtenerSource('source-old');
  assert.equal(source!.status, 'HISTORICAL');
});

test('sm: marca fuente como supersedida', () => {
  const sm = new SourceMetadataManager();

  sm.registrarSource({
    sourceId: 'source-v1',
    retrievedAt: '2024-01-01T00:00:00Z',
    authority: 'INSTITUTIONAL',
    status: 'SUPERSEDED',
    supersededBy: 'source-v2',
  });

  const source = sm.obtenerSource('source-v1');
  assert.equal(source!.status, 'SUPERSEDED');
  assert.equal(source!.supersededBy, 'source-v2');
});

test('sm: registra conflicto de evidencia', () => {
  const sm = new SourceMetadataManager();

  sm.registrarConflicto({
    conflictId: 'conflict-001',
    entity: 'FED',
    topic: 'interest rates',
    sourceA: {
      sourceId: 'source-a',
      retrievedAt: new Date().toISOString(),
      authority: 'OFFICIAL',
      status: 'CURRENT',
    },
    sourceB: {
      sourceId: 'source-b',
      retrievedAt: new Date().toISOString(),
      authority: 'OFFICIAL',
      status: 'CURRENT',
    },
    statementA: 'FED will raise rates',
    statementB: 'FED will cut rates',
    createdAt: new Date().toISOString(),
    status: 'UNRESOLVED',
  });

  const conflictos = sm.obtenerConflictos('FED');
  assert.equal(conflictos.length, 1);
  assert.equal(conflictos[0].status, 'UNRESOLVED');
});

test('sm: resuelve conflicto', () => {
  const sm = new SourceMetadataManager();

  sm.registrarConflicto({
    conflictId: 'conflict-002',
    entity: 'ECB',
    topic: 'inflation',
    sourceA: {
      sourceId: 'source-a',
      retrievedAt: new Date().toISOString(),
      authority: 'OFFICIAL',
      status: 'CURRENT',
    },
    sourceB: {
      sourceId: 'source-b',
      retrievedAt: new Date().toISOString(),
      authority: 'OFFICIAL',
      status: 'CURRENT',
    },
    statementA: 'Inflation is rising',
    statementB: 'Inflation is stable',
    createdAt: new Date().toISOString(),
    status: 'UNRESOLVED',
  });

  sm.marcarResuelto('conflict-002', 'Source A is more recent');

  const conflictos = sm.obtenerConflictos('ECB');
  assert.equal(conflictos[0].status, 'RESOLVED');
  assert.ok(conflictos[0].resolutionNote);
});

test('sm: estado', () => {
  const sm = new SourceMetadataManager();

  sm.registrarSource({
    sourceId: 'source-1',
    retrievedAt: new Date().toISOString(),
    authority: 'INSTITUTIONAL',
    status: 'CURRENT',
  });

  sm.registrarConflicto({
    conflictId: 'conflict-1',
    entity: 'Entity1',
    topic: 'topic1',
    sourceA: {
      sourceId: 'source-1',
      retrievedAt: new Date().toISOString(),
      authority: 'INSTITUTIONAL',
      status: 'CURRENT',
    },
    sourceB: {
      sourceId: 'source-2',
      retrievedAt: new Date().toISOString(),
      authority: 'INSTITUTIONAL',
      status: 'CURRENT',
    },
    statementA: 'A',
    statementB: 'B',
    createdAt: new Date().toISOString(),
    status: 'UNRESOLVED',
  });

  const estado = sm.estado();
  assert.equal(estado.totalSources, 1);
  assert.equal(estado.totalConflicts, 1);
  assert.equal(estado.unresolved, 1);
});

test('sm: singleton global', () => {
  assert.ok(sourceMetadataManager);
  assert.ok(sourceMetadataManager.obtenerSource);
  assert.ok(sourceMetadataManager.registrarConflicto);
});
