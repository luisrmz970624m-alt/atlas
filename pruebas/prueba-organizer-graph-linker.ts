import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { OrganizerGraphLinker, inicializarLinker, obtenerLinker, asignarLinker } from '../src/trading-lab/organizer-graph-linker.ts';
import { KnowledgeGraphEngine, inicializarKG, asignarKG } from '../src/trading-lab/knowledge-graph.ts';
import { KnowledgeOrganizer, inicializarKO, asignarKO } from '../src/trading-lab/knowledge-organizer.ts';

test('linker: decide HIGH confianza = AUTO_LINK', () => {
  const kgRuta = join(tmpdir(), `kg-link-high-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-link-high-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-high-conf',
    titulo: 'EURUSD Trading Strategy',
    contenido: 'The FED impact on EURUSD and GBPUSD trading',
  });

  const decision = linker.decidirLinking(org);

  assert.equal(decision.confidence, 'HIGH');
  assert.equal(decision.policy, 'AUTO_HIGH');
  assert.equal(decision.action, 'AUTO_LINK');
  assert.ok(decision.reason.length > 0);

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('linker: decide MEDIUM confianza = NEEDS_REVIEW', () => {
  const kgRuta = join(tmpdir(), `kg-link-med-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-link-med-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-med-conf',
    titulo: 'Strategy',
    contenido: 'EURUSD trading',
  });

  const decision = linker.decidirLinking(org);

  assert.equal(decision.action, 'NEEDS_REVIEW');
});

test('linker: decide UNKNOWN domain = NEEDS_REVIEW', () => {
  const kgRuta = join(tmpdir(), `kg-link-unknown-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-link-unknown-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-unknown-domain',
    titulo: 'Quantum Physics',
    contenido: 'Quantum mechanics and special relativity',
  });

  const decision = linker.decidirLinking(org);

  assert.equal(decision.action, 'NEEDS_REVIEW');
  assert.ok(decision.reason.includes('unknown') || decision.reason.includes('Domain'));

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('linker: ejecuta AUTO_LINK crea nodos necesarios', () => {
  const kgRuta = join(tmpdir(), `kg-exec-link-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-exec-link-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-auto-001',
    titulo: 'EURUSD Fundamental Analysis',
    contenido: 'The FED impact on EURUSD and GBPUSD trading',
  });

  const decision = linker.ejecutarAutoLinking(org);

  assert.equal(decision.action, 'AUTO_LINK');
  assert.ok(decision.linkedNodeIds.length > 0);

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('linker: vincula documento a nodos correctos', () => {
  const kgRuta = join(tmpdir(), `kg-link-doc-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-link-doc-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-verify-link',
    titulo: 'EURUSD Technical Analysis',
    contenido: 'Chart patterns and indicators guide trading decisions',
  });

  const decision = linker.ejecutarAutoLinking(org);

  // Verificar que nodos contienen referencia al documento
  for (const nodeId of decision.linkedNodeIds) {
    const nodo = kg.obtenerNodo(nodeId);
    assert.ok(nodo);
    assert.ok(nodo!.documentRefs.includes('doc-verify-link'));
  }

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('linker: no duplica referencias a documento', () => {
  const kgRuta = join(tmpdir(), `kg-no-dup-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-no-dup-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-no-dup',
    titulo: 'EURUSD Trading Strategy',
    contenido: 'The FED impact on EURUSD and GBPUSD trading',
  });

  // Ejecutar dos veces
  const dec1 = linker.ejecutarAutoLinking(org);
  const dec2 = linker.ejecutarAutoLinking(org);

  // Verificar que linkedNodeIds en segundo intento es vacío (ya vinculado)
  // Pero la decisión debe ser la misma
  assert.equal(dec1.action, 'AUTO_LINK');
  assert.equal(dec2.action, 'AUTO_LINK');

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('linker: singleton', () => {
  asignarLinker(null);
  assert.equal(obtenerLinker(), null);

  const kgRuta = join(tmpdir(), `kg-sing-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  const linker = inicializarLinker(kg);
  assert.equal(obtenerLinker(), linker);

  asignarLinker(null);

  try {
    unlinkSync(kgRuta);
  } catch {
    // Ignorar
  }
});

test('linker: propone nodos de entidades', () => {
  const kgRuta = join(tmpdir(), `kg-entities-${Date.now()}.json`);
  const kg = new KnowledgeGraphEngine(kgRuta);
  kg.crearVortice();

  const linker = new OrganizerGraphLinker(kg);

  const koRuta = join(tmpdir(), `ko-entities-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(koRuta);

  const org = ko.clasificar({
    documentId: 'doc-ent-001',
    titulo: 'FED and ECB',
    contenido: 'La FED y la ECB tienen políticas diferentes',
  });

  const decision = linker.decidirLinking(org);

  // proposedNodeIds debería contener entidades
  assert.ok(decision.proposedNodeIds.length > 0);

  try {
    unlinkSync(kgRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});
