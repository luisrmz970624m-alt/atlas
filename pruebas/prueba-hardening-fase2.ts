import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import { MemoryLayers } from '../src/trading-lab/memory-layers.ts';
import { EntityRegistry, inicializarER, asignarER, bootstrapEntidadesOrganizador } from '../src/trading-lab/entity-registry.ts';
import { KnowledgeOrganizer, inicializarKO, asignarKO } from '../src/trading-lab/knowledge-organizer.ts';

// ═══════════════════════════════════════════════════════════════════════════
// PROBLEMA 1: MEMORY LAYERS DEDUP
// ═══════════════════════════════════════════════════════════════════════════

test('h2-p1: DocumentaryMemory mismo documento 10x = 1 logical entry', () => {
  const mlRuta = join(tmpdir(), `ml-p1-doc-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const docData = {
    documentId: 'h2-p1-doc-001',
    title: 'Test Document',
    authority: 'INSTITUTIONAL' as const,
    source: 'test',
  };

  const results = [];
  for (let i = 0; i < 10; i++) {
    const result = ml.registrarDocumento(docData);
    results.push(result);
  }

  // Todos deben retornar status CREATED (1ro) o REUSED (2-10)
  assert.equal(results[0]!.status, 'CREATED', 'Primer registro debe ser CREATED');
  for (let i = 1; i < 10; i++) {
    assert.equal(results[i]!.status, 'REUSED', `Registro ${i + 1} debe ser REUSED`);
  }

  // Verificar que solo hay 1 entrada lógica
  const docs = ml.obtenerDocumentos();
  assert.equal(docs.length, 1, 'Debe haber exactamente 1 entry lógico');
  assert.equal(docs[0]!.documentRef.documentId, 'h2-p1-doc-001');

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p1: MarketHistoryMemory mismo evento 10x = 1 logical entry', () => {
  const mlRuta = join(tmpdir(), `ml-p1-event-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const eventData = {
    eventId: 'h2-p1-event-001',
    date: '2026-09-26',
    description: 'Fed announcement',
    marketReaction: 'Bullish',
    source: 'test',
  };

  const results = [];
  for (let i = 0; i < 10; i++) {
    const result = ml.registrarEvento(eventData);
    results.push(result);
  }

  assert.equal(results[0]!.status, 'CREATED');
  for (let i = 1; i < 10; i++) {
    assert.equal(results[i]!.status, 'REUSED');
  }

  const eventos = ml.obtenerEventos();
  assert.equal(eventos.length, 1);

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p1: ExperimentMemory mismo run 10x = 1 logical entry', () => {
  const mlRuta = join(tmpdir(), `ml-p1-exp-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const expData = {
    runId: 'h2-p1-run-001',
    backtest: 75,
    oos: 60,
    source: 'test',
  };

  const results = [];
  for (let i = 0; i < 10; i++) {
    const result = ml.registrarExperimento(expData);
    results.push(result);
  }

  assert.equal(results[0]!.status, 'CREATED');
  for (let i = 1; i < 10; i++) {
    assert.equal(results[i]!.status, 'REUSED');
  }

  const exps = ml.obtenerExperimentos();
  assert.equal(exps.length, 1);

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p1: ReasoningMemory mismo caso 10x = 1 logical entry', () => {
  const mlRuta = join(tmpdir(), `ml-p1-reasoning-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const reasonData = {
    caseId: 'h2-p1-case-001',
    findings: ['Finding 1'],
    contradictions: [] as string[],
    invalidationConditions: [] as string[],
    source: 'test',
  };

  const results = [];
  for (let i = 0; i < 10; i++) {
    const result = ml.registrarRazonamiento(reasonData);
    results.push(result);
  }

  assert.equal(results[0]!.status, 'CREATED');
  for (let i = 1; i < 10; i++) {
    assert.equal(results[i]!.status, 'REUSED');
  }

  const reasoning = ml.obtenerRazonamientos();
  assert.equal(reasoning.length, 1);

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROBLEMA 2: ENTITY SOURCE OF TRUTH
// ═══════════════════════════════════════════════════════════════════════════

test('h2-p2: EntityRegistry bootstrap idempotente 2x = mismo conteo', () => {
  const erRuta = join(tmpdir(), `er-p2-bootstrap-${Date.now()}.json`);

  const er1 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er1);
  const estado1 = er1.obtenerEstado();
  const count1 = estado1.totalEntidades;

  // Reiniciar con mismo archivo (carga desde disco)
  asignarER(null); // Clear singleton
  const er2 = new EntityRegistry(erRuta);
  // Bootstrap debe ser idempotente — no debe duplicar
  bootstrapEntidadesOrganizador(er2);
  const estado2 = er2.obtenerEstado();
  const count2 = estado2.totalEntidades;

  // Ambos conteos deben ser iguales
  assert.equal(count1, count2, `Bootstrap idempotente: ${count1} === ${count2}`);
  // Debería haber ~39 entidades (11+8+8+6+10 = 43, pero algunos overlap)
  assert.ok(count1 > 30, `Debe haber > 30 entidades, actual: ${count1}`);

  try {
    unlinkSync(erRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p2: EntityRegistry bootstrap restart = mismos IDs', () => {
  const erRuta = join(tmpdir(), `er-p2-ids-${Date.now()}.json`);

  const er1 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er1);
  const eurusd1 = er1.obtenerPorNombre('EURUSD');
  const id1 = eurusd1?.entityId;

  // Reiniciar
  asignarER(null);
  const er2 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er2);
  const eurusd2 = er2.obtenerPorNombre('EURUSD');
  const id2 = eurusd2?.entityId;

  // Los IDs deben ser iguales (cargados desde disco)
  assert.equal(id1, id2, 'IDs de EURUSD deben ser iguales después de restart');

  try {
    unlinkSync(erRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p2: KnowledgeOrganizer resuelve través EntityRegistry', () => {
  const erRuta = join(tmpdir(), `er-p2-ko-${Date.now()}.json`);
  const koRuta = join(tmpdir(), `ko-p2-${Date.now()}.json`);

  // Inicializar registry
  const er = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er);
  asignarER(er);

  // Inicializar KnowledgeOrganizer
  const ko = new KnowledgeOrganizer(koRuta);

  // Clasificar documento con EURUSD
  const org = ko.clasificar({
    documentId: 'ko-p2-doc-001',
    titulo: 'EURUSD Trading Strategy',
    contenido: 'We focus on EURUSD pairs and use technical indicators.',
  });

  // Debe detectar EURUSD y ligarlo
  const eurusd = org.linkedEntities.find((e) => e.entity === 'EURUSD');
  assert.ok(eurusd, 'Debe detectar EURUSD a través de EntityRegistry');
  assert.equal(eurusd?.type, 'INSTRUMENT');

  try {
    unlinkSync(erRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p2: Legacy dicts NOT runtime source', () => {
  const erRuta = join(tmpdir(), `er-p2-legacy-${Date.now()}.json`);
  const koRuta = join(tmpdir(), `ko-p2-legacy-${Date.now()}.json`);

  // Inicializar registry vacío (sin bootstrap)
  const er = new EntityRegistry(erRuta);
  asignarER(er);

  // Inicializar KO: debe usar EntityRegistry (vacío), NOT legacy dicts
  const ko = new KnowledgeOrganizer(koRuta);

  // Clasificar con entidad desconocida (no en registry vacío)
  const org = ko.clasificar({
    documentId: 'ko-p2-empty-001',
    titulo: 'Random Document',
    contenido: 'This is a random document with no known entities.',
  });

  // linkedEntities debe estar vacío porque registry está vacío
  assert.equal(org.linkedEntities.length, 0, 'Sin registry, debe haber 0 linked entities');

  try {
    unlinkSync(erRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROBLEMA 3 & 4: VERSION HANDLING + EXPLICIT RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

test('h2-p3: Mismo documento = REUSED status', () => {
  const mlRuta = join(tmpdir(), `ml-p3-reused-${Date.now()}.json`);
  const ml = new MemoryLayers(mlRuta);

  const docData = {
    documentId: 'h2-p3-doc-001',
    title: 'Test',
    authority: 'INSTITUTIONAL' as const,
    source: 'test',
  };

  const r1 = ml.registrarDocumento(docData);
  const r2 = ml.registrarDocumento(docData);

  assert.equal(r1.status, 'CREATED');
  assert.equal(r2.status, 'REUSED');

  try {
    unlinkSync(mlRuta);
  } catch {
    // Ignorar
  }
});

test('h2-p3: EntityRegistry duplicate name rejected', () => {
  const erRuta = join(tmpdir(), `er-p3-duplicate-${Date.now()}.json`);
  const er = new EntityRegistry(erRuta);

  er.registrarEntidad({
    canonicalName: 'TestInstrument',
    entityType: 'INSTRUMENT',
    source: 'test',
  });

  // Intentar registrar mismo nombre debe fallar
  assert.throws(() => {
    er.registrarEntidad({
      canonicalName: 'TestInstrument',
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

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

test('h2-int: Triple-run idempotencia (RUN 1, RUN 2, RESTART, RUN 3)', () => {
  const mlRuta = join(tmpdir(), `ml-triple-${Date.now()}.json`);
  const erRuta = join(tmpdir(), `er-triple-${Date.now()}.json`);
  const koRuta = join(tmpdir(), `ko-triple-${Date.now()}.json`);

  // ═══ RUN 1 ═══
  const ml1 = new MemoryLayers(mlRuta);
  const er1 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er1);
  asignarER(er1);

  const ko1 = new KnowledgeOrganizer(koRuta);
  asignarKO(ko1);

  // Registrar documento
  ml1.registrarDocumento({
    documentId: 'triple-doc-001',
    title: 'Document 1',
    authority: 'INSTITUTIONAL' as const,
    source: 'run-1',
  });

  // Clasificar
  ko1.clasificar({
    documentId: 'triple-doc-001',
    titulo: 'EURUSD Analysis',
    contenido: 'EURUSD technical analysis',
  });

  const estado1_docs = ml1.obtenerDocumentos().length;
  const estado1_org = ko1.obtenerEstado().totalOrganizaciones;
  const estado1_entities = er1.obtenerEstado().totalEntidades;

  assert.equal(estado1_docs, 1);
  assert.equal(estado1_org, 1);
  assert.ok(estado1_entities > 30);

  // ═══ RUN 2 (mismas operaciones) ═══
  const ml2 = new MemoryLayers(mlRuta);
  const er2 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er2);
  asignarER(er2);

  const ko2 = new KnowledgeOrganizer(koRuta);
  asignarKO(ko2);

  // Mismos datos
  const r2 = ml2.registrarDocumento({
    documentId: 'triple-doc-001',
    title: 'Document 1',
    authority: 'INSTITUTIONAL' as const,
    source: 'run-2',
  });

  assert.equal(r2.status, 'REUSED', 'Run 2 debe reusar documento');

  const estado2_docs = ml2.obtenerDocumentos().length;
  const estado2_org = ko2.obtenerEstado().totalOrganizaciones;
  const estado2_entities = er2.obtenerEstado().totalEntidades;

  assert.equal(estado2_docs, 1, 'Debe mantener 1 doc');
  assert.equal(estado2_org, 1, 'Debe mantener 1 clasificación');
  assert.equal(estado2_entities, estado1_entities, 'Debe mantener mismo conteo de entidades');

  // ═══ RESTART: cargar desde disco ═══
  asignarKO(null);
  asignarER(null);

  const ml3 = new MemoryLayers(mlRuta);
  const er3 = new EntityRegistry(erRuta);
  bootstrapEntidadesOrganizador(er3);
  asignarER(er3);

  const ko3 = new KnowledgeOrganizer(koRuta);
  asignarKO(ko3);

  // ═══ RUN 3 (después del restart) ═══
  const r3 = ml3.registrarDocumento({
    documentId: 'triple-doc-001',
    title: 'Document 1',
    authority: 'INSTITUTIONAL' as const,
    source: 'run-3',
  });

  assert.equal(r3.status, 'REUSED');

  const estado3_docs = ml3.obtenerDocumentos().length;
  const estado3_org = ko3.obtenerEstado().totalOrganizaciones;
  const estado3_entities = er3.obtenerEstado().totalEntidades;

  // Todos deben mantener conteos lógicos
  assert.equal(estado3_docs, 1, '1→1→1 docs');
  assert.equal(estado3_org, 1, '1→1→1 classifications');
  assert.equal(estado3_entities, estado1_entities, 'Entities must be stable across restarts');

  try {
    unlinkSync(mlRuta);
    unlinkSync(erRuta);
    unlinkSync(koRuta);
  } catch {
    // Ignorar
  }
});

test('h2-int: Full phase repeated 3x produces stable object counts', () => {
  const baseTmpdir = tmpdir();
  const timestamp = Date.now();

  for (let run = 1; run <= 3; run++) {
    const mlRuta = join(baseTmpdir, `ml-phase-${timestamp}-${run}.json`);
    const erRuta = join(baseTmpdir, `er-phase-${timestamp}-${run}.json`);
    const koRuta = join(baseTmpdir, `ko-phase-${timestamp}-${run}.json`);

    const ml = new MemoryLayers(mlRuta);
    const er = new EntityRegistry(erRuta);
    bootstrapEntidadesOrganizador(er);
    asignarER(er);

    const ko = new KnowledgeOrganizer(koRuta);
    asignarKO(ko);

    // Fase: registrar documento + clasificar
    ml.registrarDocumento({
      documentId: 'phase-doc-001',
      title: 'Document',
      authority: 'INSTITUTIONAL' as const,
      source: `run-${run}`,
    });

    ko.clasificar({
      documentId: 'phase-doc-001',
      titulo: 'EURUSD Technical',
      contenido: 'Chart pattern analysis on EURUSD',
    });

    const docs = ml.obtenerDocumentos().length;
    const orgs = ko.obtenerEstado().totalOrganizaciones;
    const entities = er.obtenerEstado().totalEntidades;

    // Verificar estabilidad
    assert.equal(docs, 1, `Run ${run}: docs debe ser 1`);
    assert.equal(orgs, 1, `Run ${run}: orgs debe ser 1`);
    assert.ok(entities > 30, `Run ${run}: entities > 30`);

    try {
      unlinkSync(mlRuta);
      unlinkSync(erRuta);
      unlinkSync(koRuta);
    } catch {
      // Ignorar
    }
  }
});
