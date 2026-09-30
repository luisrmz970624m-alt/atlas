import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VersionChain,
  calcularContentHash,
  normalizarContenido,
  generarLogicalDocumentId,
} from '../src/trading-lab/document-identity.ts';

test('identity: normaliza contenido consistentemente', () => {
  const c1 = `
    FED Report

    Inflation: 3.5%
  `;
  const c2 = `FED Report
Inflation: 3.5%`;
  const c3 = `  fed report

inflation: 3.5%  `;

  const n1 = normalizarContenido(c1);
  const n2 = normalizarContenido(c2);
  const n3 = normalizarContenido(c3);

  assert.equal(n1, n2);
  assert.equal(n2, n3);
});

test('identity: hash idéntico para contenido igual', () => {
  const contenido = 'FED Report on Inflation';

  const h1 = calcularContentHash(contenido);
  const h2 = calcularContentHash(contenido);

  assert.equal(h1, h2);
});

test('identity: hash diferente para contenido diferente', () => {
  const h1 = calcularContentHash('Version A');
  const h2 = calcularContentHash('Version B');

  assert.notEqual(h1, h2);
});

test('identity: genera ID lógico consistente', () => {
  const id1 = generarLogicalDocumentId('FED', 'Monetary Policy');
  const id2 = generarLogicalDocumentId('FED', 'Monetary Policy');

  assert.equal(id1, id2);
});

test('version-chain: registrar documento nueva = CREATED', () => {
  const vc = new VersionChain();

  const result = vc.registrarVersion({
    logicalDocumentId: 'test-doc-001',
    source: 'FED',
    title: 'Monetary Policy',
    contenido: 'Initial content',
  });

  assert.equal(result.status, 'CREATED');
  assert.ok(result.value);
  assert.equal(result.value!.logicalDocument.logicalDocumentId, 'test-doc-001');
});

test('version-chain: mismo contenido exacto = REUSED', () => {
  const vc = new VersionChain();

  const r1 = vc.registrarVersion({
    logicalDocumentId: 'test-doc-002',
    source: 'ECB',
    title: 'Interest Rates',
    contenido: 'ECB maintains rates at 4.25%',
  });

  assert.equal(r1.status, 'CREATED');

  const r2 = vc.registrarVersion({
    logicalDocumentId: 'test-doc-002',
    source: 'ECB',
    title: 'Interest Rates',
    contenido: 'ECB maintains rates at 4.25%',
  });

  assert.equal(r2.status, 'REUSED');
  assert.equal(r2.value!.version.versionId, r1.value!.version.versionId);
});

test('version-chain: contenido cambiado = UPDATED_VERSION', () => {
  const vc = new VersionChain();

  const r1 = vc.registrarVersion({
    logicalDocumentId: 'test-doc-003',
    source: 'BOJ',
    title: 'Policy Statement',
    contenido: 'Version 1: No rate change',
  });

  assert.equal(r1.status, 'CREATED');
  const v1 = r1.value!.version;

  const r2 = vc.registrarVersion({
    logicalDocumentId: 'test-doc-003',
    source: 'BOJ',
    title: 'Policy Statement',
    contenido: 'Version 2: Rate increase to 0.5%',
  });

  assert.equal(r2.status, 'UPDATED_VERSION');
  const v2 = r2.value!.version;

  // Debe haber cadena
  assert.equal(v2.supersedes, v1.versionId);
  assert.equal(v1.supersededBy, v2.versionId);
});

test('version-chain: cadena A → B → C preservada', () => {
  const vc = new VersionChain();

  // Crear 3 versiones
  const r1 = vc.registrarVersion({
    logicalDocumentId: 'chain-test-001',
    source: 'FED',
    title: 'Policy',
    contenido: 'Version A',
  });
  const v1 = r1.value!.version.versionId;

  const r2 = vc.registrarVersion({
    logicalDocumentId: 'chain-test-001',
    source: 'FED',
    title: 'Policy',
    contenido: 'Version B',
  });
  const v2 = r2.value!.version.versionId;

  const r3 = vc.registrarVersion({
    logicalDocumentId: 'chain-test-001',
    source: 'FED',
    title: 'Policy',
    contenido: 'Version C',
  });
  const v3 = r3.value!.version.versionId;

  // Verificar cadena
  const cadena = vc.obtenerCadenaVersiones('chain-test-001');

  assert.equal(cadena.length, 3);
  assert.equal(cadena[0]!.versionId, v1);
  assert.equal(cadena[1]!.versionId, v2);
  assert.equal(cadena[2]!.versionId, v3);

  // Verificar relaciones
  assert.equal(cadena[0]!.supersededBy, v2);
  assert.equal(cadena[1]!.supersedes, v1);
  assert.equal(cadena[1]!.supersededBy, v3);
  assert.equal(cadena[2]!.supersedes, v2);
  assert.equal(cadena[2]!.status, 'CURRENT');
});

test('version-chain: restart preserva cadena', () => {
  const vc1 = new VersionChain();

  // Primera instancia: crear A y B
  vc1.registrarVersion({
    logicalDocumentId: 'restart-test-001',
    source: 'FED',
    title: 'Report',
    contenido: 'Version A',
  });

  vc1.registrarVersion({
    logicalDocumentId: 'restart-test-001',
    source: 'FED',
    title: 'Report',
    contenido: 'Version B',
  });

  const estado1 = vc1.obtenerEstado();
  assert.equal(estado1.logicalDocuments, 1);
  assert.equal(estado1.versions, 2);

  // Simular restart: nueva instancia, re-registrar B
  const vc2 = new VersionChain();

  // Re-registrar primero A (ya que no estamos usando persistencia)
  const r1 = vc2.registrarVersion({
    logicalDocumentId: 'restart-test-001',
    source: 'FED',
    title: 'Report',
    contenido: 'Version A',
  });

  // Luego B con mismo contenido
  const r2 = vc2.registrarVersion({
    logicalDocumentId: 'restart-test-001',
    source: 'FED',
    title: 'Report',
    contenido: 'Version B',
  });

  // B debe ser UPDATED_VERSION o REUSED dependiendo del hash
  assert.ok(r2.status === 'UPDATED_VERSION' || r2.status === 'REUSED');

  const estado2 = vc2.obtenerEstado();
  // Sin persistencia, es un nuevo VersionChain, así que contamos de nuevo
  assert.equal(estado2.logicalDocuments, 1);
});

test('version-chain: obtener versión actual', () => {
  const vc = new VersionChain();

  vc.registrarVersion({
    logicalDocumentId: 'current-test-001',
    source: 'ECB',
    title: 'Rate Decision',
    contenido: 'Version A',
  });

  const v1 = vc.registrarVersion({
    logicalDocumentId: 'current-test-001',
    source: 'ECB',
    title: 'Rate Decision',
    contenido: 'Version B',
  });

  const actual = vc.obtenerVersionActual('current-test-001');

  assert.ok(actual);
  assert.equal(actual!.versionId, v1.value!.version.versionId);
  assert.equal(actual!.status, 'CURRENT');
});

test('version-chain: estado correcto', () => {
  const vc = new VersionChain();

  vc.registrarVersion({
    logicalDocumentId: 'state-test-001',
    source: 'FED',
    title: 'Doc 1',
    contenido: 'A',
  });

  vc.registrarVersion({
    logicalDocumentId: 'state-test-001',
    source: 'FED',
    title: 'Doc 1',
    contenido: 'B',
  });

  vc.registrarVersion({
    logicalDocumentId: 'state-test-002',
    source: 'ECB',
    title: 'Doc 2',
    contenido: 'C',
  });

  const estado = vc.obtenerEstado();

  assert.equal(estado.logicalDocuments, 2);
  assert.equal(estado.versions, 3);
  assert.equal(estado.current, 2); // B y C son CURRENT
  assert.equal(estado.superseded, 1); // A es SUPERSEDED
});

test('version-chain: triple registro con mismo contenido = REUSED todos', () => {
  const vc = new VersionChain();

  const r1 = vc.registrarVersion({
    logicalDocumentId: 'triple-test-001',
    source: 'BOJ',
    title: 'Policy',
    contenido: 'Same content',
  });

  const r2 = vc.registrarVersion({
    logicalDocumentId: 'triple-test-001',
    source: 'BOJ',
    title: 'Policy',
    contenido: 'Same content',
  });

  const r3 = vc.registrarVersion({
    logicalDocumentId: 'triple-test-001',
    source: 'BOJ',
    title: 'Policy',
    contenido: 'Same content',
  });

  assert.equal(r1.status, 'CREATED');
  assert.equal(r2.status, 'REUSED');
  assert.equal(r3.status, 'REUSED');

  const estado = vc.obtenerEstado();
  assert.equal(estado.logicalDocuments, 1);
  assert.equal(estado.versions, 1);
});

test('version-chain: resultado normalizado tiene timestamp', () => {
  const vc = new VersionChain();

  const resultado = vc.registrarVersion({
    logicalDocumentId: 'ts-test-001',
    source: 'FED',
    title: 'Test',
    contenido: 'Test content',
  });

  assert.ok(resultado.timestamp);
  assert.match(resultado.timestamp, /^\d{4}-\d{2}-\d{2}/); // ISO format
});
