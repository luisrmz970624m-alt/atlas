import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';
import {
  KnowledgeGraphEngine,
  inicializarKG,
  obtenerKG,
  asignarKG,
  type KnowledgeNode,
} from '../src/trading-lab/knowledge-graph.ts';

test('knowledge-graph: crea Vórtice', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-vortice-${Date.now()}.json`));
  const vortice = kg.crearVortice();

  assert.equal(vortice.nodeId, 'vortice-root');
  assert.equal(vortice.name, 'EL VÓRTICE');
  assert.equal(vortice.type, 'DOMAIN');
  assert.equal(vortice.parentId, null);
});

test('knowledge-graph: añade nodo a Vórtice', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-add-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'trading-domain',
    parentId: 'vortice-root',
    type: 'DOMAIN',
    domain: 'TRADING',
    name: 'Trading',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  const recuperado = kg.obtenerNodo('trading-domain');
  assert.ok(recuperado);
  assert.equal(recuperado!.name, 'Trading');
});

test('knowledge-graph: rechaza nodo sin parent', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-noparent-${Date.now()}.json`));

  const nodo: KnowledgeNode = {
    nodeId: 'orfano',
    parentId: 'inexistente',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Nodo Huérfano',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.throws(() => {
    kg.agregarNodo(nodo);
  }, /Parent.*no existe/);
});

test('knowledge-graph: rechaza nodo duplicado', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-dup-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'duplicado',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Test',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  assert.throws(() => {
    kg.agregarNodo(nodo);
  }, /ya existe/);
});

test('knowledge-graph: obtiene hijos', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-children-${Date.now()}.json`));
  kg.crearVortice();

  const nodo1: KnowledgeNode = {
    nodeId: 'hijo1',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Hijo 1',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nodo2: KnowledgeNode = {
    nodeId: 'hijo2',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Hijo 2',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo1);
  kg.agregarNodo(nodo2);

  const hijos = kg.obtenerHijos('vortice-root');
  assert.equal(hijos.length, 2);
});

test('knowledge-graph: obtiene ruta desde nodo a raíz', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-path-${Date.now()}.json`));
  kg.crearVortice();

  const trading: KnowledgeNode = {
    nodeId: 'trading',
    parentId: 'vortice-root',
    type: 'DOMAIN',
    domain: 'TRADING',
    name: 'Trading',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const forex: KnowledgeNode = {
    nodeId: 'forex',
    parentId: 'trading',
    type: 'CATEGORY',
    domain: 'TRADING',
    name: 'Forex',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(trading);
  kg.agregarNodo(forex);

  const ruta = kg.obtenerRuta('forex');
  assert.equal(ruta.length, 3); // vortice -> trading -> forex
  assert.equal(ruta[0].nodeId, 'vortice-root');
  assert.equal(ruta[2].nodeId, 'forex');
});

test('knowledge-graph: busca por nombre', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-search-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'eurusd',
    parentId: 'vortice-root',
    type: 'INSTRUMENT',
    domain: 'TRADING',
    name: 'EURUSD',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  const resultados = kg.buscarPorNombre('EUR');
  assert.equal(resultados.length, 1);
  assert.equal(resultados[0].name, 'EURUSD');
});

test('knowledge-graph: obtiene por domain', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-domain-${Date.now()}.json`));
  kg.crearVortice();

  const nodo1: KnowledgeNode = {
    nodeId: 'forex1',
    parentId: 'vortice-root',
    type: 'CATEGORY',
    domain: 'TRADING',
    name: 'Forex',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo1);
  const nodosTRADING = kg.obtenerPorDomain('TRADING');
  assert.ok(nodosTRADING.length >= 2); // Vórtice + forex1
});

test('knowledge-graph: obtiene por type', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-type-${Date.now()}.json`));
  kg.crearVortice();

  const nodo1: KnowledgeNode = {
    nodeId: 'inst1',
    parentId: 'vortice-root',
    type: 'INSTRUMENT',
    domain: 'TRADING',
    name: 'EURUSD',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nodo2: KnowledgeNode = {
    nodeId: 'inst2',
    parentId: 'vortice-root',
    type: 'INSTRUMENT',
    domain: 'TRADING',
    name: 'GBPUSD',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 75,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo1);
  kg.agregarNodo(nodo2);

  const instrumentos = kg.obtenerPorType('INSTRUMENT');
  assert.equal(instrumentos.length, 2);
  assert.equal(instrumentos[0].priority, 80); // Ordenados por priority
});

test('knowledge-graph: router con instrument', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-router-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'eurusd',
    parentId: 'vortice-root',
    type: 'INSTRUMENT',
    domain: 'TRADING',
    name: 'EURUSD',
    children: [],
    documentRefs: ['doc-1', 'doc-2'],
    chunkRefs: ['chunk-1'],
    priority: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);

  const resultado = kg.rutear({ instrument: 'EUR' });
  assert.ok(resultado.selectedNodes.length > 0);
  assert.ok(resultado.selectedDocuments.length > 0);
});

test('knowledge-graph: router respeta límites', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-limits-${Date.now()}.json`));
  kg.crearVortice();

  // Agregar muchos nodos
  for (let i = 0; i < 100; i++) {
    const nodo: KnowledgeNode = {
      nodeId: `nodo-${i}`,
      parentId: 'vortice-root',
      type: 'TOPIC',
      domain: 'TRADING',
      name: `Nodo ${i}`,
      children: [],
      documentRefs: [],
      chunkRefs: [],
      priority: 50 - (i % 50),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    kg.agregarNodo(nodo);
  }

  const resultado = kg.rutear({ domain: 'TRADING' });
  assert.ok(resultado.selectedNodes.length <= 50); // maxNodesPerQuery
  assert.ok(resultado.contextBudget.discarded > 0);
});

test('knowledge-graph: context budget no finge chars cuando sólo recupera referencias', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-budget-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'test-node',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Test',
    children: [],
    documentRefs: ['doc-1', 'doc-2'],
    chunkRefs: ['chunk-1', 'chunk-2', 'chunk-3'],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  const resultado = kg.rutear({ domain: 'TRADING' });

  assert.equal(resultado.contextBudget.unit, 'chars');
  assert.equal(resultado.contextBudget.max, 50000);
  assert.equal(resultado.contextBudget.used, null);
  assert.equal(resultado.contextBudget.remaining, null);
  assert.equal(resultado.contextBudget.state, 'NOT_COMPUTED');
  assert.equal(resultado.contextBudget.available, resultado.contextBudget.max);
  assert.equal(resultado.contextBudget.availableUnit, 'chars');
  assert.equal(resultado.contextBudget.selectedUnit, 'references');
  assert.equal(resultado.contextBudget.discardedUnit, 'nodes');
  assert.deepEqual(resultado.limits, { maxNodes: 50, maxDocuments: 100, maxChunks: 200 });
  assert.equal(
    resultado.contextBudget.breakdown.nodes +
      resultado.contextBudget.breakdown.documents +
      resultado.contextBudget.breakdown.chunks,
    resultado.contextBudget.selected
  );
});

test('knowledge-graph: context budget vacío mantiene estado textual honesto y límites estructurales', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-empty-budget-${Date.now()}.json`));
  kg.crearVortice();

  const resultado = kg.rutear({ query: 'sin coincidencias' });

  assert.equal(resultado.selectedNodes.length, 0);
  assert.equal(resultado.contextBudget.state, 'NOT_COMPUTED');
  assert.equal(resultado.contextBudget.used, null);
  assert.equal(resultado.contextBudget.remaining, null);
  assert.equal(resultado.contextBudget.selected, 0);
  assert.equal(resultado.contextBudget.selectedUnit, 'references');
  assert.deepEqual(resultado.limits, { maxNodes: 50, maxDocuments: 100, maxChunks: 200 });
});

test('knowledge-graph: traceability registra orígenes', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-trace-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'traced',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Traced',
    children: [],
    documentRefs: ['doc-traced'],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  const resultado = kg.rutear({ domain: 'TRADING' });

  assert.ok(resultado.traceability.length > 0);
  const conDocumento = resultado.traceability.filter((t) => t.sourceId === 'doc-traced');
  assert.equal(conDocumento.length, 1);
  assert.equal(conDocumento[0].source, 'DOCUMENT');
});

test('knowledge-graph: persistencia guarda y carga', () => {
  const ruta = join(tmpdir(), `kg-persist-${Date.now()}.json`);

  const kg1 = new KnowledgeGraphEngine(ruta);
  kg1.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'persistido',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Persistido',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg1.agregarNodo(nodo);

  const kg2 = new KnowledgeGraphEngine(ruta);
  const recuperado = kg2.obtenerNodo('persistido');
  assert.ok(recuperado);
  assert.equal(recuperado!.name, 'Persistido');

  try {
    unlinkSync(ruta);
  } catch {
    // Ignorar
  }
});

test('knowledge-graph: singleton', () => {
  asignarKG(null);
  assert.equal(obtenerKG(), null);

  const kg = inicializarKG(join(tmpdir(), `kg-sing-${Date.now()}.json`));
  assert.equal(obtenerKG(), kg);

  asignarKG(null);
});

test('knowledge-graph: estado refleja grafo', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-state-${Date.now()}.json`));
  kg.crearVortice();

  const nodo: KnowledgeNode = {
    nodeId: 'test',
    parentId: 'vortice-root',
    type: 'INSTRUMENT',
    domain: 'TRADING',
    name: 'Test',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo);
  const estado = kg.obtenerEstado();

  assert.equal(estado.totalNodes, 2); // vortice + test
  assert.ok(estado.domains.includes('TRADING'));
  assert.ok(estado.types.includes('INSTRUMENT'));
});

test('knowledge-graph: no duplica nodos al recolectar subarbol', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-nodup-${Date.now()}.json`));
  kg.crearVortice();

  const nodo1: KnowledgeNode = {
    nodeId: 'padre',
    parentId: 'vortice-root',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Padre',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nodo2: KnowledgeNode = {
    nodeId: 'hijo',
    parentId: 'padre',
    type: 'TOPIC',
    domain: 'TRADING',
    name: 'Hijo',
    children: [],
    documentRefs: [],
    chunkRefs: [],
    priority: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  kg.agregarNodo(nodo1);
  kg.agregarNodo(nodo2);

  const resultado = kg.rutear({ domain: 'TRADING' });
  const nodeIds = resultado.selectedNodeIds;
  const unique = new Set(nodeIds);
  assert.equal(nodeIds.length, unique.size); // Sin duplicados
});

test('knowledge-graph: recupera experimentRefs solo de nodos finalmente seleccionados', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-experiments-${Date.now()}.json`));
  kg.crearVortice();
  const sourceRefs = ['run-1', 'run-2', 'run-2'];

  for (let index = 0; index < 51; index++) {
    kg.agregarNodo({
      nodeId: `experiment-node-${index}`,
      parentId: 'vortice-root',
      type: 'EXPERIMENT',
      domain: 'TRADING',
      name: `Experiment node ${index}`,
      children: [],
      documentRefs: index === 0 ? ['doc-stable'] : [],
      chunkRefs: index === 0 ? ['chunk-stable'] : [],
      experimentRefs: index === 0 ? sourceRefs : index === 1 ? ['run-2', 'run-3'] : index === 50 ? ['run-not-selected'] : undefined,
      priority: 100 - index,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const resultado = kg.rutear({ query: 'Experiment node' });

  assert.equal(resultado.selectedNodes.length, 50);
  assert.deepEqual(resultado.selectedExperiments, ['run-1', 'run-2', 'run-3']);
  assert.equal(resultado.selectedExperiments.includes('run-not-selected'), false);
  assert.deepEqual(kg.obtenerNodo('experiment-node-0')!.experimentRefs, sourceRefs);
  assert.deepEqual(resultado.selectedDocuments, ['doc-stable']);
  assert.deepEqual(resultado.selectedChunks, ['chunk-stable']);
});

test('knowledge-graph: traza experimentos por relación seleccionada, sin duplicar refs del mismo nodo', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-experiment-trace-${Date.now()}.json`));
  kg.crearVortice();
  kg.agregarNodo({
    nodeId: 'eurusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'TRADING', name: 'EURUSD',
    children: [], documentRefs: ['doc-eur'], chunkRefs: ['chunk-eur'], experimentRefs: ['run-eur', 'run-eur', 'run-shared'],
    priority: 90, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  kg.agregarNodo({
    nodeId: 'ecb', parentId: 'vortice-root', type: 'ENTITY', domain: 'TRADING', name: 'ECB',
    children: [], documentRefs: ['doc-ecb'], chunkRefs: ['chunk-ecb'], experimentRefs: ['run-shared', 'run-ecb'],
    priority: 80, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  const resultado = kg.rutear({ query: 'EURUSD', intent: 'ECB', entities: ['EURUSD'] });
  assert.deepEqual(resultado.selectedExperiments, ['run-eur', 'run-shared', 'run-ecb']);
  const experimentTrace = resultado.traceability.filter((item) => item.source === 'EXPERIMENT');
  assert.deepEqual(experimentTrace.map((item) => [item.sourceId, item.reason]), [
    ['run-eur', 'Referenced by node eurusd'],
    ['run-shared', 'Referenced by node eurusd'],
    ['run-shared', 'Referenced by node ecb'],
    ['run-ecb', 'Referenced by node ecb'],
  ]);
  assert.deepEqual(resultado.selectedDocuments, ['doc-eur', 'doc-ecb']);
  assert.deepEqual(resultado.selectedChunks, ['chunk-eur', 'chunk-ecb']);
  assert.equal(experimentTrace.every((item) => resultado.selectedExperiments.includes(item.sourceId)), true);
});

test('knowledge-graph: no traza experimentos de nodos descartados por límite ni de nodos sin refs', () => {
  const kg = new KnowledgeGraphEngine(join(tmpdir(), `kg-experiment-limit-trace-${Date.now()}.json`));
  kg.crearVortice();
  for (let index = 0; index < 51; index++) {
    kg.agregarNodo({
      nodeId: `node-${index}`, parentId: 'vortice-root', type: 'EXPERIMENT', domain: 'TRADING', name: `Node ${index}`,
      children: [], documentRefs: [], chunkRefs: [], experimentRefs: index === 0 ? ['run-selected'] : index === 50 ? ['run-discarded'] : undefined,
      priority: 100 - index, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }
  const resultado = kg.rutear({ query: 'Node' });
  const experimentTrace = resultado.traceability.filter((item) => item.source === 'EXPERIMENT');
  assert.deepEqual(resultado.selectedExperiments, ['run-selected']);
  assert.deepEqual(experimentTrace.map((item) => item.sourceId), ['run-selected']);
  assert.equal(experimentTrace.some((item) => item.reason.includes('node-50')), false);
});
