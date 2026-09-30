import type { KnowledgeGraphEngine, KnowledgeNode, RoutingQuery } from '../trading-lab/knowledge-graph.ts';
import type { MemoryEntry, MemoryLayer, MemoryLayers } from '../trading-lab/memory-layers.ts';
import type { TradingReasoningEngine } from '../trading-lab/trading-reasoning.ts';

export interface CognitiveDependencies { graph?: KnowledgeGraphEngine | null; memory?: MemoryLayers | null; reasoning?: TradingReasoningEngine | null; }
type CognitiveState = 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE';
const LIMIT_DEFAULT = 20, LIMIT_MAX = 50;
const ENTITY_MAX = 16, ENTITY_MAX_CHARS = 80;
const ENTITY_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._:/-]*$/u;

function limit(value: string | null): number { const number = Number(value ?? LIMIT_DEFAULT); return Number.isInteger(number) && number > 0 ? Math.min(number, LIMIT_MAX) : LIMIT_DEFAULT; }
function text(value: string | null, max = 160): string | null { if (!value) return null; const trimmed = value.trim(); return trimmed && !/[\u0000-\u001F\u007F-\u009F]/u.test(trimmed) ? trimmed.slice(0, max) : null; }
/** Entidades repetidas (?entity=EURUSD&entity=ECB), acotadas antes del router. */
function entities(query: URLSearchParams): string[] {
  const unique = new Set<string>();
  for (const value of query.getAll('entity')) {
    const entity = value.trim();
    if (entity && entity.length <= ENTITY_MAX_CHARS && ENTITY_PATTERN.test(entity)) unique.add(entity);
    if (unique.size === ENTITY_MAX) break;
  }
  return [...unique];
}
/** Los IDs son identificadores lógicos, nunca rutas ni datos codificados sin validar. */
function nodeId(value: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  return decoded && decoded.length <= 160 && !/[\\/\u0000-\u001F\u007F-\u009F]/u.test(decoded) && decoded !== '.' && decoded !== '..' ? decoded : null;
}
function nodeDto(node: KnowledgeNode) { return { id: node.nodeId, parentId: node.parentId, type: node.type, domain: node.domain, topic: node.topic, name: node.name, description: node.description, tags: node.tags ?? [], priority: node.priority, documentRefs: node.documentRefs, chunkRefs: node.chunkRefs, experimentRefs: node.experimentRefs ?? [], eventRefs: node.eventRefs ?? [], relatedNodes: node.relatedNodes ?? [], createdAt: node.createdAt, updatedAt: node.updatedAt }; }
function memoryDto(entry: MemoryEntry) { const source = entry.source || 'UNAVAILABLE'; return { id: entry.entryId, layer: entry.memoryLayer, entity: { type: entry.entityType, id: entry.entityId }, source, createdAt: entry.createdAt, updatedAt: entry.updatedAt, provenance: { source } }; }
function state(total: number, present: boolean): CognitiveState { return !present ? 'UNAVAILABLE' : total === 0 ? 'EMPTY' : 'AVAILABLE'; }

/** Adaptador local y de solo lectura: no crea ni persiste motores cognitivos. */
export class CognitiveReadApi {
  private readonly deps: CognitiveDependencies;
  constructor(deps: CognitiveDependencies) { this.deps = deps; }
  handle(path: string, query: URLSearchParams): unknown {
    if (path === '/api/cognitive/status') return this.status();
    if (path === '/api/cognitive/search') return this.search(text(query.get('q')), limit(query.get('limit')));
    if (path === '/api/cognitive/retrieve') return this.retrieve(query, limit(query.get('limit')));
    if (path === '/api/cognitive/memory') return this.memory(query.get('layer'), limit(query.get('limit')));
    if (path === '/api/cognitive/reasoning') return this.reasoning(text(query.get('instrument')), limit(query.get('limit')));
    const match = path.match(/^\/api\/cognitive\/nodes\/([^/]+)$/);
    if (match) { const id = nodeId(match[1]!); return id ? this.node(id) : null; }
    return null;
  }
  private status() { const graph = this.deps.graph, memory = this.deps.memory, reasoning = this.deps.reasoning; const graphState = graph?.obtenerEstado(); const memoryState = memory?.obtenerEstado(); const reasoningState = reasoning?.obtenerEstado(); const total = (graphState?.totalNodes ?? 0) + (memoryState?.total ?? 0) + (reasoningState?.totalCases ?? 0); return { state: state(total, !!(graph || memory || reasoning)), readOnly: true, graph: graphState ?? { state: 'UNAVAILABLE' }, memory: memoryState ?? { state: 'UNAVAILABLE' }, reasoning: reasoningState ?? { state: 'UNAVAILABLE' } }; }
  private search(q: string | null, max: number) { const graph = this.deps.graph; if (!graph) return { state: 'UNAVAILABLE', query: q, nodes: [] }; if (!q) return { state: 'EMPTY', query: null, nodes: [] }; const nodes = graph.buscarPorNombre(q).slice(0, max).map(nodeDto); return { state: state(nodes.length, true), query: q, nodes }; }
  private node(id: string) { const graph = this.deps.graph; if (!graph) return { state: 'UNAVAILABLE', node: null, neighbors: [] }; const node = graph.obtenerNodo(id); if (!node) return { state: 'EMPTY', node: null, neighbors: [] }; const neighborIds = [...node.children, ...(node.relatedNodes ?? [])]; const neighbors = [...new Set(neighborIds)].map((neighborId) => graph.obtenerNodo(neighborId)).filter((item): item is KnowledgeNode => !!item).slice(0, LIMIT_MAX).map(nodeDto); return { state: 'AVAILABLE', node: nodeDto(node), neighbors, path: graph.obtenerRuta(id).map(nodeDto) }; }
  private memory(layer: string | null, max: number) { const memory = this.deps.memory; if (!memory) return { state: 'UNAVAILABLE', layer: null, entries: [] }; const valid = ['DOCUMENTARY', 'MARKET_HISTORY', 'EXPERIMENT', 'REASONING'] as const; if (layer && !valid.includes(layer as typeof valid[number])) return { state: 'EMPTY', layer, entries: [] }; const entries = (layer ? memory.obtenerPorCapa(layer as MemoryLayer) : valid.flatMap((item) => memory.obtenerPorCapa(item))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, max).map(memoryDto); return { state: state(entries.length, true), layer: layer ?? 'ALL', entries }; }
  private reasoning(instrument: string | null, max: number) { const reasoning = this.deps.reasoning; if (!reasoning) return { state: 'UNAVAILABLE', instrument, cases: [] }; const cases = instrument ? reasoning.listarPorInstrumento(instrument) : []; return { state: state(cases.length, true), instrument, cases: cases.slice(-max).reverse().map((item) => ({ id: item.caseId, instrument: item.instrument, timeframe: item.timeframe, result: item.result, timestamp: item.timestamp, reasoning: item.reasoning, knowledgeNodes: item.knowledgeNodes ?? [], documentRefs: item.documentRefs ?? [], cognitiveEvidence: item.cognitiveEvidence ? { selectedNodeIds: item.cognitiveEvidence.selectedNodeIds, documentRefs: item.cognitiveEvidence.documentRefs, chunkRefs: item.cognitiveEvidence.chunkRefs, experimentRefs: item.cognitiveEvidence.experimentRefs, memoryEntryRefs: item.cognitiveEvidence.memoryEntryRefs, traceability: item.cognitiveEvidence.traceability } : null })) }; }
  private retrieve(query: URLSearchParams, max: number) { const graph = this.deps.graph; if (!graph) return { state: 'UNAVAILABLE', retrieval: null }; const request: RoutingQuery = { query: text(query.get('q')), intent: text(query.get('intent')), entities: entities(query), instrument: text(query.get('instrument')), requestedTask: text(query.get('task')), domain: text(query.get('domain')) as RoutingQuery['domain'] }; const result = graph.rutear(request); const nodes = result.selectedNodes.slice(0, max).map(nodeDto); return { state: state(nodes.length, true), retrieval: { nodes, documents: result.selectedDocuments.slice(0, max), chunks: result.selectedChunks.slice(0, max), experiments: result.selectedExperiments.slice(0, max), traceability: result.traceability.slice(0, max), limits: result.limits, contextBudget: result.contextBudget } }; }
}
