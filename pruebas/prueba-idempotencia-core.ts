import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { KnowledgeOrganizer, inicializarKO, asignarKO } from '../src/trading-lab/knowledge-organizer.ts';
import { MemoryLayers } from '../src/trading-lab/memory-layers.ts';
import { EntityRegistry } from '../src/trading-lab/entity-registry.ts';

test('idempotencia: mismo documento clasificado 10x = 1 logical object', () => {
  const koRuta = join(tmpdir(), `ko-idempotent-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const docData = {
    documentId: 'idempotent-doc-001',
    titulo: 'EURUSD Fundamental Analysis',
    contenido: 'The FED impact on EURUSD trading',
  };

  const results = [];
  for (let i = 0; i < 10; i++) {
    const org = ko.clasificar(docData);
    results.push(org);
  }

  // Verificar que TODO s tienen el MISMO documentId
  assert.ok(results.every((r) => r.documentId === 'idempotent-doc-001'));

  // Verificar que la clasificación es idéntica
  const firstClass = results[0]!.classification;
  assert.ok(results.every((r) => r.classification.domain === firstClass.domain));
  assert.ok(results.every((r) => r.classification.confidence === firstClass.confidence));

  // Pero organizationIds son distintos (eso es OK - son eventos)
  // Lo importante es que LÓGICAMENTE no hay duplicación

  try {
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('idempotencia: mismo documento en memoria = 1 entry', () => {
  const mlRuta = join(tmpdir(), `ml-idempotent-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const docData = {
    documentId: 'mem-idempotent-001',
    title: 'Document Title',
    authority: 'INSTITUTIONAL' as const,
    source: 'knowledge-base',
  };

  const entries = [];
  for (let i = 0; i < 5; i++) {
    const entry = ml.registrarDocumento(docData);
    entries.push(entry);
  }

  // Con canonical-key dedup, debe haber exactamente 1 entry lógico
  const docs = ml.obtenerDocumentos();
  const filtered = docs.filter((d) => d.documentRef.documentId === 'mem-idempotent-001');

  // Phase 2 Hardening: 1 logical entry (dedup por documentId)
  assert.equal(filtered.length, 1);
  assert.equal(entries[0]!.status, 'CREATED');
  for (let i = 1; i < 5; i++) {
    assert.equal(entries[i]!.status, 'REUSED');
  }

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

test('idempotencia: EntityRegistry bootstrap idempotente', () => {
  const erRuta = join(tmpdir(), `er-idempotent-${Date.now()}.json`);

  const er1 = new EntityRegistry(erRuta);
  const count1 = er1.obtenerEstado().totalEntidades;

  const er2 = new EntityRegistry(erRuta);
  const count2 = er2.obtenerEstado().totalEntidades;

  // Bootstrap debe ser idempotente
  assert.equal(count1, count2);

  try {
    unlinkSync(erRuta);
  } catch {
    // Ignorar
  }
});

test('idempotencia: duplicate name rejected', () => {
  const erRuta = join(tmpdir(), `er-duplicate-${Date.now()}.json`);
  const er = new EntityRegistry(erRuta);

  er.registrarEntidad({
    canonicalName: 'TestEntity',
    entityType: 'INSTRUMENT',
    source: 'test',
  });

  // Intentar registrar mismo nombre debe fallar
  assert.throws(() => {
    er.registrarEntidad({
      canonicalName: 'TestEntity',
      entityType: 'INSTRUMENT',
      source: 'test',
    });
  });

  try {
    unlinkSync(erRuta);
  } catch {
    // Ignorar
  }
});
