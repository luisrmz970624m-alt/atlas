import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AtlasLocalApi } from '../src/api-local/servidor.ts';
import { CognitiveReadApi } from '../src/api-local/cognitivo.ts';
import { KnowledgeGraphEngine } from '../src/trading-lab/knowledge-graph.ts';
import { MemoryLayers } from '../src/trading-lab/memory-layers.ts';
import { TradingReasoningEngine } from '../src/trading-lab/trading-reasoning.ts';

const dashboard = () => ({ system: { version: 'test', estado: 'OK', simulated: true }, vortice: {}, providers: {}, trading: {}, business: { simulated: true }, simulations: {}, memory: {}, audit: {}, resources: {}, alerts: [] }) as any;
const path = (name: string) => join(tmpdir(), `atlas-cognitive-${name}-${Date.now()}-${Math.random()}.json`);
const request = async (base: string, endpoint: string, init?: RequestInit) => {
  const response = await fetch(`${base}${endpoint}`, init);
  return { response, body: await response.json() as any };
};

test('cognitivo: expone solo DTOs acotados, capas separadas y trazabilidad', () => {
  const graph = new KnowledgeGraphEngine(path('graph'));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: ['doc-eur'], chunkRefs: ['chunk-eur'], experimentRefs: ['run-eur'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const memory = new MemoryLayers(path('memory'));
  memory.registrarDocumento({ documentId: 'doc-eur', title: 'EURUSD source', authority: 'LOCAL', source: 'fixture' });
  const cognitive = new CognitiveReadApi({ graph, memory, reasoning: new TradingReasoningEngine(path('reasoning')) });
  const found = cognitive.handle('/api/cognitive/search', new URLSearchParams('q=eur&limit=1')) as any;
  assert.equal(found.state, 'AVAILABLE'); assert.equal(found.nodes.length, 1); assert.equal(found.nodes[0].id, 'eurusd'); assert.equal('metadata' in found.nodes[0], false);
  const retrieved = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('instrument=EURUSD')) as any;
  assert.deepEqual(retrieved.retrieval.documents, ['doc-eur']); assert.deepEqual(retrieved.retrieval.experiments, ['run-eur']);
  assert.deepEqual(retrieved.retrieval.limits, { maxNodes: 50, maxDocuments: 100, maxChunks: 200 });
  assert.deepEqual(retrieved.retrieval.contextBudget, {
    unit: 'chars', max: 50000, used: null, remaining: null, state: 'NOT_COMPUTED',
    available: 50000, availableUnit: 'chars', selected: 3, selectedUnit: 'references',
    discarded: 0, discardedUnit: 'nodes', breakdown: { nodes: 1, documents: 1, chunks: 1, experiments: 1 }, reason: undefined,
  });
  assert.deepEqual(retrieved.retrieval.traceability.filter((item: any) => item.source === 'EXPERIMENT').map((item: any) => ({ sourceId: item.sourceId, reason: item.reason })), [{ sourceId: 'run-eur', reason: 'Referenced by node eurusd' }]);
  const textRetrieved = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('q=EURUSD')) as any;
  assert.equal(textRetrieved.state, 'AVAILABLE'); assert.deepEqual(textRetrieved.retrieval.documents, ['doc-eur']);
  const entries = cognitive.handle('/api/cognitive/memory', new URLSearchParams('layer=DOCUMENTARY')) as any;
  assert.equal(entries.entries[0].layer, 'DOCUMENTARY'); assert.equal(entries.entries[0].entity.id, 'doc-eur');
  assert.deepEqual(entries.entries[0].provenance, { source: 'fixture' });
});

test('cognitivo: /reasoning refleja evidencia integrada sin exponer contenido interno', () => {
  const graph = new KnowledgeGraphEngine(path('reasoning-integrated-graph'));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'INSTRUMENT', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: ['doc-eur'], chunkRefs: ['chunk-eur'], experimentRefs: ['run-eur'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const memory = new MemoryLayers(path('reasoning-integrated-memory'));
  memory.registrarExperimento({ runId: 'run-eur', source: 'fixture' });
  const reasoning = new TradingReasoningEngine(path('reasoning-integrated'));
  reasoning.conectarRetrievalCognitivo(graph, memory);
  reasoning.razonarConRetrievalCognitivo({ instrument: 'EURUSD', timeframe: 'H1', technical: { trend: 'UP' } });
  const result = new CognitiveReadApi({ graph, memory, reasoning }).handle('/api/cognitive/reasoning', new URLSearchParams('instrument=EURUSD')) as any;
  assert.equal(result.state, 'AVAILABLE');
  assert.deepEqual(result.cases[0].cognitiveEvidence.experimentRefs, ['run-eur']);
  assert.deepEqual(result.cases[0].cognitiveEvidence.documentRefs, ['doc-eur']);
  assert.equal(JSON.stringify(result).includes(path('reasoning-integrated')), false);
});

test('cognitivo: transmite entities HTTP repetidas, acotadas y trazables al router', () => {
  const graph = new KnowledgeGraphEngine(path('entities'));
  graph.crearVortice();
  for (const name of ['EURUSD', 'ECB', 'FED']) {
    graph.agregarNodo({ nodeId: name.toLowerCase(), parentId: 'vortice-root', type: 'ENTITY', domain: 'TRADING', name, children: [], documentRefs: [], chunkRefs: [], experimentRefs: name === 'EURUSD' ? ['run-eur', 'run-shared'] : name === 'ECB' ? ['run-shared', 'run-ecb'] : undefined, priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  }
  const cognitive = new CognitiveReadApi({ graph });
  const one = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('entity=EURUSD')) as any;
  assert.deepEqual(one.retrieval.nodes.map((node: any) => node.id), ['eurusd']);
  const combined = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('q=EURUSD&intent=ECB&entity=FED&entity=EURUSD')) as any;
  assert.deepEqual(new Set(combined.retrieval.nodes.map((node: any) => node.id)), new Set(['eurusd', 'ecb', 'fed']));
  assert.deepEqual(combined.retrieval.experiments, ['run-eur', 'run-shared', 'run-ecb']);
  assert.ok(combined.retrieval.traceability.some((item: any) => item.sourceId === 'fed' && item.reason.includes('FED')));
  const unknown = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('entity=UNKNOWN')) as any;
  assert.equal(unknown.state, 'EMPTY');
  const empty = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('entity=%20%20')) as any;
  assert.equal(empty.state, 'EMPTY');
  const tooLong = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams(`entity=${'A'.repeat(81)}`)) as any;
  assert.equal(tooLong.state, 'EMPTY');
  const many = new URLSearchParams(); for (let index = 0; index < 20; index++) many.append('entity', index === 0 ? 'EURUSD' : `UNKNOWN${index}`);
  const bounded = cognitive.handle('/api/cognitive/retrieve', many) as any;
  assert.deepEqual(bounded.retrieval.nodes.map((node: any) => node.id), ['eurusd']);
  assert.deepEqual(bounded.retrieval.experiments, ['run-eur', 'run-shared']);
  const unavailable = new CognitiveReadApi({}).handle('/api/cognitive/retrieve', new URLSearchParams()) as any;
  assert.equal(unavailable.state, 'UNAVAILABLE'); assert.equal(unavailable.retrieval, null);
});

test('cognitivo: API local no permite mutar y devuelve 404 para rutas no declaradas', async () => {
  const graph = new KnowledgeGraphEngine(path('http-entities'));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'ENTITY', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: [], chunkRefs: [], experimentRefs: ['run-eur-http', 'run-eur-http'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const cognitive = new CognitiveReadApi({ graph });
  const api = new AtlasLocalApi({ dashboard, cognitive: (requestPath, query) => cognitive.handle(requestPath, query) }, { port: 0 });
  await api.start();
  try {
    const base = `http://127.0.0.1:${api.address().port}`;
    const status = await (await fetch(`${base}/api/cognitive/status`)).json() as any;
    assert.equal(status.data.readOnly, true); assert.equal(status.data.state, 'AVAILABLE');
    const retrieved = await (await fetch(`${base}/api/cognitive/retrieve?entity=EURUSD`)).json() as any;
    assert.deepEqual(retrieved.data.retrieval.nodes.map((node: any) => node.id), ['eurusd']);
    assert.deepEqual(retrieved.data.retrieval.experiments, ['run-eur-http']);
    assert.deepEqual(retrieved.data.retrieval.limits, { maxNodes: 50, maxDocuments: 100, maxChunks: 200 });
    assert.equal(retrieved.data.retrieval.contextBudget.unit, 'chars');
    assert.equal(retrieved.data.retrieval.contextBudget.state, 'NOT_COMPUTED');
    assert.equal(retrieved.data.retrieval.contextBudget.used, null);
    assert.equal(retrieved.data.retrieval.contextBudget.remaining, null);
    assert.equal(retrieved.data.retrieval.contextBudget.selectedUnit, 'references');
    assert.deepEqual(retrieved.data.retrieval.traceability.filter((item: any) => item.source === 'EXPERIMENT').map((item: any) => ({ sourceId: item.sourceId, reason: item.reason })), [{ sourceId: 'run-eur-http', reason: 'Referenced by node eurusd' }]);
    assert.equal((await fetch(`${base}/api/cognitive/nope`)).status, 404);
    assert.equal((await fetch(`${base}/api/cognitive/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 404);
  } finally { await api.close(); }
});

test('cognitivo: entradas negativas tienen política acotada y no filtran DTOs internos', () => {
  const graph = new KnowledgeGraphEngine(path('negative'));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'ENTITY', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: ['doc-eur'], chunkRefs: ['chunk-eur'], experimentRefs: ['run-eur'], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const memory = new MemoryLayers(path('negative-memory'));
  memory.registrarDocumento({ documentId: 'doc-eur', title: 'EURUSD source', authority: 'LOCAL', source: 'fixture' });
  const reasoning = new TradingReasoningEngine(path('negative-reasoning'));
  const cognitive = new CognitiveReadApi({ graph, memory, reasoning });

  for (const value of [null, '0', '-1', 'nope', '1.5', '1e999']) assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams(value === null ? 'q=eur' : `q=eur&limit=${value}`)) as any).nodes.length, 1);
  assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams('q=eur&limit=999999999999999999999')) as any).nodes.length, 1);
  assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams('q=%20%20')) as any).state, 'EMPTY');
  assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams(`q=${'E'.repeat(1000)}`)) as any).query.length, 160);
  assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams('q=EURUSD%00')) as any).state, 'EMPTY');
  assert.equal((cognitive.handle('/api/cognitive/search', new URLSearchParams('q=%CE%95%CE%A5%CE%A1USD')) as any).state, 'EMPTY');

  const validEntities = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('entity=EURUSD&entity=EURUSD&entity=%CE%95%CE%A5%CE%A1USD&entity=bad%00value')) as any;
  assert.deepEqual(validEntities.retrieval.nodes.map((item: any) => item.id), ['eurusd']);
  for (const value of ['%20', 'bad%00value', 'bad%40value', 'A'.repeat(81)]) assert.equal((cognitive.handle('/api/cognitive/retrieve', new URLSearchParams(`entity=${value}`)) as any).state, 'EMPTY');
  const many = new URLSearchParams(); for (let index = 0; index < 30; index++) many.append('entity', index ? `UNKNOWN${index}` : 'EURUSD');
  assert.deepEqual((cognitive.handle('/api/cognitive/retrieve', many) as any).retrieval.nodes.map((item: any) => item.id), ['eurusd']);

  assert.equal((cognitive.handle('/api/cognitive/nodes/missing', new URLSearchParams()) as any).state, 'EMPTY');
  for (const id of ['%2F', '%00', '..', 'path%2Flike', '%E0%A4%A', '%']) assert.equal(cognitive.handle(`/api/cognitive/nodes/${id}`, new URLSearchParams()), null);
  assert.ok((cognitive.handle('/api/cognitive/nodes/eurusd', new URLSearchParams()) as any) instanceof Object);
  assert.equal((cognitive.handle('/api/cognitive/memory', new URLSearchParams('layer=documentary&limit=1')) as any).state, 'EMPTY');
  assert.equal((cognitive.handle('/api/cognitive/memory', new URLSearchParams('layer=DOCUMENTARY&limit=1')) as any).entries.length, 1);
  assert.equal((cognitive.handle('/api/cognitive/memory', new URLSearchParams('layer=NOPE')) as any).state, 'EMPTY');
  for (const instrument of ['', 'UNKNOWN', 'X'.repeat(1000), 'EURUSD%00']) assert.equal((cognitive.handle('/api/cognitive/reasoning', new URLSearchParams(`instrument=${instrument}&limit=50`)) as any).state, 'EMPTY');
  const dto = cognitive.handle('/api/cognitive/retrieve', new URLSearchParams('entity=EURUSD')) as any;
  assert.equal(JSON.stringify(dto).includes(path('negative')), false);
  assert.equal(JSON.stringify(dto).includes('apiKey'), false);
  memory.registrarDocumento({ documentId: 'secret-proof', title: 'safe', authority: 'LOCAL', source: 'fixture', metadata: { apiKey: 'must-not-leak' } } as any);
  const memoryDto = cognitive.handle('/api/cognitive/memory', new URLSearchParams('layer=DOCUMENTARY')) as any;
  assert.equal(JSON.stringify(memoryDto).includes('must-not-leak'), false);
});

test('cognitivo: HTTP hostil sigue read-only, sin 500 ni caída de servidor', async () => {
  const graph = new KnowledgeGraphEngine(path('http-hostile'));
  graph.crearVortice();
  graph.agregarNodo({ nodeId: 'eurusd', parentId: 'vortice-root', type: 'ENTITY', domain: 'TRADING', name: 'EURUSD', children: [], documentRefs: [], chunkRefs: [], priority: 90, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  const cognitive = new CognitiveReadApi({ graph });
  let mutations = 0;
  const api = new AtlasLocalApi({ dashboard, cognitive: (requestPath, query) => cognitive.handle(requestPath, query), mutate: () => { mutations++; return {}; } }, { port: 0 });
  await api.start();
  try {
    const base = `http://127.0.0.1:${api.address().port}`;
    for (const endpoint of ['/api/cognitive/search', '/api/cognitive/search?q=%20%20', '/api/cognitive/search?q=EURUSD%00', '/api/cognitive/retrieve?entity=bad%00value', '/api/cognitive/nodes/%E0%A4%A', '/api/cognitive/nodes/%2F', '/api/cognitive/nodes/%', '/api/cognitive/nope']) {
      const result = await request(base, endpoint, { headers: { 'content-type': 'application/json' } });
      assert.ok([200, 404].includes(result.response.status)); assert.notEqual(result.response.status, 500);
      assert.equal(JSON.stringify(result.body).includes('/home/'), false);
      assert.equal(JSON.stringify(result.body).includes('stack'), false);
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const result = await request(base, '/api/cognitive/retrieve?entity=EURUSD', { method, headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.ok([404, 405].includes(result.response.status));
    }
    assert.equal(mutations, 0);
    const alive = await request(base, '/api/cognitive/status');
    assert.equal(alive.response.status, 200); assert.equal(alive.body.data.readOnly, true);
  } finally { await api.close(); }
});
