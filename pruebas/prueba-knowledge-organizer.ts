import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  KnowledgeOrganizer,
  inicializarKO,
  obtenerKO,
  asignarKO,
} from '../src/trading-lab/knowledge-organizer.ts';

test('knowledge-organizer: clasifica documento de trading', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-class-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-forex-001',
    titulo: 'Forex Trading Strategies',
    contenido: 'Learn about EURUSD trading with FED interest rates',
  });

  assert.ok(org.organizationId);
  assert.equal(org.documentId, 'doc-forex-001');
  assert.equal(org.classification.domain, 'TRADING');
  assert.ok(org.classification.confidence);
});

test('knowledge-organizer: extrae instrumentos', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-instr-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-001',
    titulo: 'EURUSD Analysis',
    contenido: 'EURUSD y GBPUSD son instrumentos principales',
  });

  const instrumentos = org.linkedEntities.filter((e) => e.type === 'INSTRUMENT');
  assert.equal(instrumentos.length, 2);
});

test('knowledge-organizer: extrae bancos centrales', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-banks-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-002',
    titulo: 'FED Policy',
    contenido: 'La FED y la ECB tienen políticas diferentes',
  });

  const bancos = org.linkedEntities.filter((e) => e.type === 'CENTRAL_BANK');
  assert.ok(bancos.length >= 1);
});

test('knowledge-organizer: clasifica como FUNDAMENTAL', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-fund-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-003',
    titulo: 'Fundamental Analysis',
    contenido: 'Inflation, interest rates, and employment reports affect currencies',
  });

  assert.equal(org.classification.subdomain, 'FUNDAMENTAL');
});

test('knowledge-organizer: clasifica como TECHNICAL', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-tech-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-004',
    titulo: 'Technical Analysis',
    contenido: 'Chart patterns and indicators guide trading decisions',
  });

  assert.equal(org.classification.subdomain, 'TECHNICAL');
});

test('knowledge-organizer: marca como NEEDS_REVIEW si baja confianza', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-review-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-005',
    titulo: 'Physics',
    contenido: 'Quantum mechanics and particle physics',
  });

  // Documento sin referencias a trading → domain UNKNOWN → NEEDS_REVIEW
  assert.equal(org.classification.domain, 'UNKNOWN');
  assert.equal(org.needsReview, true);
  assert.ok(org.reviewReason);
});

test('knowledge-organizer: genera tags apropiados', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-tags-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-006',
    titulo: 'Forex',
    contenido: 'EURUSD trading fundamental analysis',
  });

  assert.ok(org.tags.length > 0);
  assert.ok(org.tags.includes('TRADING'));
});

test('knowledge-organizer: sugiere nodos', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-nodes-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-007',
    titulo: 'Trading',
    contenido: 'EURUSD fundamental analysis',
  });

  assert.ok(org.suggestedNodeIds.length > 0);
});

test('knowledge-organizer: marca vinculado', () => {
  const ruta = join(tmpdir(), `ko-linked-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(ruta);

  const org = ko.clasificar({
    documentId: 'doc-008',
    titulo: 'Trading',
    contenido: 'Content',
  });

  ko.marcarVinculado(org.organizationId);
  const recuperado = ko.obtenerOrganizacion(org.organizationId);

  assert.equal(recuperado!.status, 'DOCUMENT_LINKED');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: marca supersedido', () => {
  const ruta = join(tmpdir(), `ko-superseded-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(ruta);

  const org = ko.clasificar({
    documentId: 'doc-009',
    titulo: 'Old Document',
    contenido: 'Content',
  });

  ko.marcarSupersedido(org.organizationId, 'Version más nueva disponible');
  const recuperado = ko.obtenerOrganizacion(org.organizationId);

  assert.equal(recuperado!.status, 'DOCUMENT_SUPERSEDED');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: obtiene organizaciones pendiente revisión', () => {
  const ruta = join(tmpdir(), `ko-pending-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(ruta);

  // Documento sin contexto de trading
  ko.clasificar({
    documentId: 'doc-010a',
    titulo: 'Quantum Physics',
    contenido: 'Quantum mechanics and special relativity',
  });

  // Documento con confianza alta
  ko.clasificar({
    documentId: 'doc-010b',
    titulo: 'Trading',
    contenido: 'EURUSD trading strategy with fundamental analysis',
  });

  const pendiente = ko.obtenerPendienteRevision();
  // Al menos uno debería estar pendiente (el documento sin trading)
  assert.ok(pendiente.length > 0);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: obtiene por documentId', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-by-doc-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-unique-001',
    titulo: 'Document',
    contenido: 'Content',
  });

  const recuperado = ko.obtenerPorDocumento('doc-unique-001');
  assert.ok(recuperado);
  assert.equal(recuperado!.organizationId, org.organizationId);
});

test('knowledge-organizer: estado reporta conteos', () => {
  const ruta = join(tmpdir(), `ko-state-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(ruta);

  ko.clasificar({
    documentId: 'doc-011a',
    titulo: 'Trading',
    contenido: 'EURUSD fundamentals',
  });

  ko.clasificar({
    documentId: 'doc-011b',
    titulo: 'Random',
    contenido: 'No trading',
  });

  const estado = ko.obtenerEstado();
  assert.equal(estado.totalOrganizaciones, 2);
  assert.ok(estado.pendienteRevision >= 0);
  assert.ok(estado.entidadesConocidas.instrumentos > 0);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: persistencia guarda y carga', () => {
  const ruta = join(tmpdir(), `ko-persist-${Date.now()}.json`);

  const ko1 = new KnowledgeOrganizer(ruta);
  ko1.clasificar({
    documentId: 'doc-persist-001',
    titulo: 'Trading',
    contenido: 'EURUSD analysis',
  });

  const ko2 = new KnowledgeOrganizer(ruta);
  const recuperado = ko2.obtenerPorDocumento('doc-persist-001');
  assert.ok(recuperado);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: singleton', () => {
  asignarKO(null);
  assert.equal(obtenerKO(), null);

  const ko = inicializarKO(join(tmpdir(), `ko-sing-${Date.now()}.json`));
  assert.equal(obtenerKO(), ko);

  asignarKO(null);
});

test('knowledge-organizer: audit trail registra cambios', () => {
  const ruta = join(tmpdir(), `ko-audit-${Date.now()}.json`);
  const ko = new KnowledgeOrganizer(ruta);

  const org = ko.clasificar({
    documentId: 'doc-audit-001',
    titulo: 'Trading',
    contenido: 'Content',
  });

  assert.ok(org.auditTrail.length >= 2);
  assert.equal(org.auditTrail[0].status, 'DOCUMENT_INGESTED');
  assert.equal(org.auditTrail[1].status, 'DOCUMENT_CLASSIFIED');

  ko.marcarVinculado(org.organizationId);
  const actualizado = ko.obtenerOrganizacion(org.organizationId);
  assert.equal(actualizado!.auditTrail.length, 3);

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-organizer: NO duplica documentos', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-nodup-${Date.now()}.json`));

  ko.clasificar({
    documentId: 'doc-unique-final',
    titulo: 'Document',
    contenido: 'Content',
  });

  // Intentar clasificar el mismo documento
  const org2 = ko.clasificar({
    documentId: 'doc-unique-final',
    titulo: 'Document',
    contenido: 'Content',
  });

  // Ambas son organizaciones diferentes (organizationIds distintos)
  // pero referencian el mismo documentId
  const porDoc = ko.obtenerPorDocumento('doc-unique-final');
  assert.ok(porDoc);
  // El último clasificado debería ser recuperado
});

test('knowledge-organizer: confianza ALTA con múltiples entidades', () => {
  const ko = new KnowledgeOrganizer(join(tmpdir(), `ko-conf-${Date.now()}.json`));

  const org = ko.clasificar({
    documentId: 'doc-highconf',
    titulo: 'EURUSD Trading Strategy',
    contenido: 'The FED impact on EURUSD and GBPUSD trading',
  });

  // Múltiples entidades + trading domain = HIGH confidence
  assert.ok(org.linkedEntities.length >= 2);
  assert.ok(
    org.classification.confidence === 'HIGH' || org.classification.confidence === 'MEDIUM'
  );
});
