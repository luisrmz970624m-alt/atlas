import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type NodeType =
  | 'DOMAIN'
  | 'CATEGORY'
  | 'TOPIC'
  | 'ENTITY'
  | 'INSTRUMENT'
  | 'COUNTRY'
  | 'CENTRAL_BANK'
  | 'EVENT_TYPE'
  | 'STRATEGY'
  | 'INDICATOR'
  | 'INSTITUTION'
  | 'EXPERIMENT'
  | 'CONCEPT'
  | 'FRAMEWORK';

export type Domain = 'TRADING' | 'BUSINESS' | 'PROGRAMMING' | 'DOCUMENTATION' | 'EXPERIENCE';

export interface KnowledgeNode {
  nodeId: string;
  parentId: string | null;
  type: NodeType;
  domain: Domain | string;
  topic?: string;
  name: string;
  description?: string;
  tags?: string[];
  children: string[]; // nodeIds solamente
  documentRefs: string[]; // documentIds desde knowledge-base
  chunkRefs: string[]; // chunkIds desde knowledge-base
  experimentRefs?: string[]; // runIds desde experimentos
  eventRefs?: string[]; // eventIds desde market events
  relatedNodes?: string[]; // nodeIds relacionados
  priority: number; // 0-100
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraph {
  graphId: string;
  version: number;
  nodes: Map<string, KnowledgeNode>;
  nodesByDomain: Map<string, Set<string>>;
  nodesByType: Map<string, Set<string>>;
  rootNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContextBudget {
  /** Unidad del presupuesto textual. No se calcula mientras el router sólo transporte referencias. */
  unit: 'chars';
  max: number;
  used: number | null;
  remaining: number | null;
  state: 'NOT_COMPUTED';
  /** Compatibilidad: capacidad textual histórica, equivalente a max y expresada en chars. */
  available: number;
  availableUnit: 'chars';
  /** Compatibilidad: conteo de referencias seleccionadas; no son caracteres. */
  selected: number;
  selectedUnit: 'references';
  discarded: number;
  discardedUnit: 'nodes';
  breakdown: {
    nodes: number;
    documents: number;
    chunks: number;
    experiments: number;
  };
  reason?: string;
}

export interface RetrievalLimits {
  maxNodes: number;
  maxDocuments: number;
  maxChunks: number;
}

export interface RoutingQuery {
  query?: string;
  intent?: string;
  entities?: string[];
  instrument?: string;
  timeframe?: string;
  domain?: Domain;
  requestedTask?: string;
}

export interface RoutingResult {
  selectedNodes: KnowledgeNode[];
  selectedNodeIds: string[];
  selectedDocuments: string[];
  selectedChunks: string[];
  selectedExperiments: string[];
  limits: RetrievalLimits;
  contextBudget: ContextBudget;
  traceability: TraceabilityLog[];
  reasoning?: string;
}

export interface TraceabilityLog {
  source: 'NODE' | 'DOCUMENT' | 'CHUNK' | 'EXPERIMENT' | 'EVENT';
  sourceId: string;
  reason: string;
  priority?: number;
  timestamp: string;
}

/** Motor de Knowledge Graph con persistencia atómica. */
export class KnowledgeGraphEngine {
  private graph: KnowledgeGraph;
  private rutaPersistencia: string = 'datos/knowledge-graph.json';

  private maxNodesPerQuery: number = 50;
  private maxDocumentsPerQuery: number = 100;
  private maxChunksPerQuery: number = 200;
  private maxContextChars: number = 50000;

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;

    const ahora = new Date().toISOString();
    this.graph = {
      graphId: `kg_${Date.now()}`,
      version: 1,
      nodes: new Map(),
      nodesByDomain: new Map(),
      nodesByType: new Map(),
      rootNodeId: null,
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.cargar();
  }

  /** Crea un nodo root llamado "EL VÓRTICE". */
  crearVortice(): KnowledgeNode {
    const ahora = new Date().toISOString();
    const nodo: KnowledgeNode = {
      nodeId: 'vortice-root',
      parentId: null,
      type: 'DOMAIN',
      domain: 'TRADING',
      name: 'EL VÓRTICE',
      description: 'Router central de conocimiento',
      children: [],
      documentRefs: [],
      chunkRefs: [],
      priority: 100,
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.graph.nodes.set(nodo.nodeId, nodo);
    this.graph.rootNodeId = nodo.nodeId;
    this.indexarNodo(nodo);
    this.guardar();

    return nodo;
  }

  /** Añade un nodo al grafo. */
  agregarNodo(nodo: KnowledgeNode): void {
    if (this.graph.nodes.has(nodo.nodeId)) {
      throw new Error(`Nodo ${nodo.nodeId} ya existe`);
    }

    // Validar parent
    if (nodo.parentId && !this.graph.nodes.has(nodo.parentId)) {
      throw new Error(`Parent ${nodo.parentId} no existe`);
    }

    const ahora = new Date().toISOString();
    nodo.updatedAt = ahora;

    this.graph.nodes.set(nodo.nodeId, nodo);
    this.indexarNodo(nodo);

    // Agregar a children del parent
    if (nodo.parentId) {
      const parent = this.graph.nodes.get(nodo.parentId);
      if (parent && !parent.children.includes(nodo.nodeId)) {
        parent.children.push(nodo.nodeId);
        parent.updatedAt = ahora;
      }
    }

    this.guardar();
  }

  /** Indexa un nodo por domain y type. */
  private indexarNodo(nodo: KnowledgeNode): void {
    if (!this.graph.nodesByDomain.has(nodo.domain)) {
      this.graph.nodesByDomain.set(nodo.domain, new Set());
    }
    this.graph.nodesByDomain.get(nodo.domain)!.add(nodo.nodeId);

    if (!this.graph.nodesByType.has(nodo.type)) {
      this.graph.nodesByType.set(nodo.type, new Set());
    }
    this.graph.nodesByType.get(nodo.type)!.add(nodo.nodeId);
  }

  /** Obtiene un nodo por ID. */
  obtenerNodo(nodeId: string): KnowledgeNode | undefined {
    return this.graph.nodes.get(nodeId);
  }

  /** Obtiene todos los nodos hijos. */
  obtenerHijos(parentId: string): KnowledgeNode[] {
    const parent = this.graph.nodes.get(parentId);
    if (!parent) return [];

    return parent.children
      .map((childId) => this.graph.nodes.get(childId))
      .filter((node) => node !== undefined) as KnowledgeNode[];
  }

  /** Obtiene la ruta completa desde root a un nodo. */
  obtenerRuta(nodeId: string): KnowledgeNode[] {
    const ruta: KnowledgeNode[] = [];
    let nodo = this.graph.nodes.get(nodeId);

    while (nodo) {
      ruta.unshift(nodo);
      nodo = nodo.parentId ? this.graph.nodes.get(nodo.parentId) : undefined;
    }

    return ruta;
  }

  /** Busca nodos por nombre (simple). */
  buscarPorNombre(query: string): KnowledgeNode[] {
    const q = query.toLowerCase();
    const resultados: KnowledgeNode[] = [];

    for (const nodo of this.graph.nodes.values()) {
      if (nodo.name.toLowerCase().includes(q)) {
        resultados.push(nodo);
      }
    }

    return resultados.sort((a, b) => b.priority - a.priority);
  }

  /** Obtiene nodos por domain. */
  obtenerPorDomain(domain: Domain | string): KnowledgeNode[] {
    const nodeIds = this.graph.nodesByDomain.get(domain) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.graph.nodes.get(id)!)
      .sort((a, b) => b.priority - a.priority);
  }

  /** Obtiene nodos por type. */
  obtenerPorType(type: NodeType): KnowledgeNode[] {
    const nodeIds = this.graph.nodesByType.get(type) || new Set();
    return Array.from(nodeIds)
      .map((id) => this.graph.nodes.get(id)!)
      .sort((a, b) => b.priority - a.priority);
  }

  /** Router de conocimiento con presupuesto de contexto. */
  rutear(query: RoutingQuery): RoutingResult {
    const traceability: TraceabilityLog[] = [];
    const selectedNodeIds = new Set<string>();
    const selectedDocuments = new Set<string>();
    const selectedChunks = new Set<string>();
    const selectedExperiments = new Set<string>();

    // Consulta, intención y entidades son señales de recuperación, no texto de
    // contexto. Seleccionan únicamente nodos coincidentes y dejan que los
    // límites del presupuesto decidan cuánto se devuelve al consumidor.
    const señales = [query.query, query.intent, ...(query.entities ?? [])]
      .map((señal) => señal?.trim())
      .filter((señal): señal is string => !!señal);
    for (const señal of señales) {
      for (const nodo of this.buscarPorNombre(señal)) {
        selectedNodeIds.add(nodo.nodeId);
        traceability.push({
          source: 'NODE',
          sourceId: nodo.nodeId,
          reason: `Matched retrieval signal: ${señal}`,
          priority: nodo.priority,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Estrategia 1: Si hay instrument, buscar rama de instrument
    if (query.instrument) {
      const nodoInstr = this.buscarPorNombre(query.instrument)[0];
      if (nodoInstr) {
        this.recolectarSubarbol(nodoInstr, selectedNodeIds, traceability);
      }
    }

    // Estrategia 2: Si hay domain, buscar rama de domain
    if (query.domain) {
      const nodosDomain = this.obtenerPorDomain(query.domain);
      for (const nodo of nodosDomain) {
        selectedNodeIds.add(nodo.nodeId);
        traceability.push({
          source: 'NODE',
          sourceId: nodo.nodeId,
          reason: `Matched domain: ${query.domain}`,
          priority: nodo.priority,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Recolectar documentos y chunks de nodos seleccionados
    for (const nodeId of selectedNodeIds) {
      const nodo = this.graph.nodes.get(nodeId);
      if (nodo) {
        for (const docId of nodo.documentRefs) {
          selectedDocuments.add(docId);
          traceability.push({
            source: 'DOCUMENT',
            sourceId: docId,
            reason: `Referenced by node ${nodeId}`,
            timestamp: new Date().toISOString(),
          });
        }

        for (const chunkId of nodo.chunkRefs) {
          selectedChunks.add(chunkId);
          traceability.push({
            source: 'CHUNK',
            sourceId: chunkId,
            reason: `Referenced by node ${nodeId}`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Aplicar límites
    const selectedNodeArray = Array.from(selectedNodeIds)
      .map((id) => this.graph.nodes.get(id)!)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.maxNodesPerQuery);

    // Las referencias de experimentos y su trazabilidad deben corresponder
    // exactamente a los nodos que finalmente pasan el límite de selección.
    // Se conserva una relación por nodo/ref: un ref repetido dentro del mismo
    // nodo no añade otra relación, pero el mismo ref en nodos distintos deja
    // constancia honesta de cada origen seleccionado.
    for (const nodo of selectedNodeArray) {
      for (const experimentId of new Set(nodo.experimentRefs ?? [])) {
        selectedExperiments.add(experimentId);
        traceability.push({
          source: 'EXPERIMENT',
          sourceId: experimentId,
          reason: `Referenced by node ${nodo.nodeId}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const selectedDocArray = Array.from(selectedDocuments).slice(0, this.maxDocumentsPerQuery);
    const selectedChunkArray = Array.from(selectedChunks).slice(0, this.maxChunksPerQuery);

    // El router no carga el contenido de documentos/chunks: sólo devuelve IDs.
    // Por ello no puede informar chars usados ni restantes sin inventar una medida.
    const budget: ContextBudget = {
      unit: 'chars',
      max: this.maxContextChars,
      used: null,
      remaining: null,
      state: 'NOT_COMPUTED',
      available: this.maxContextChars,
      availableUnit: 'chars',
      selected: selectedNodeArray.length + selectedDocArray.length + selectedChunkArray.length,
      selectedUnit: 'references',
      discarded: selectedNodeIds.size - selectedNodeArray.length,
      discardedUnit: 'nodes',
      breakdown: {
        nodes: selectedNodeArray.length,
        documents: selectedDocArray.length,
        chunks: selectedChunkArray.length,
        experiments: selectedExperiments.size,
      },
      reason:
        selectedNodeIds.size > this.maxNodesPerQuery
          ? `Exceeded maxNodesPerQuery (${this.maxNodesPerQuery})`
          : undefined,
    };

    return {
      selectedNodes: selectedNodeArray,
      selectedNodeIds: selectedNodeArray.map((n) => n.nodeId),
      selectedDocuments: selectedDocArray,
      selectedChunks: selectedChunkArray,
      selectedExperiments: Array.from(selectedExperiments),
      limits: {
        maxNodes: this.maxNodesPerQuery,
        maxDocuments: this.maxDocumentsPerQuery,
        maxChunks: this.maxChunksPerQuery,
      },
      contextBudget: budget,
      traceability,
    };
  }

  /** Recolecta subarbol completo de un nodo. */
  private recolectarSubarbol(
    nodo: KnowledgeNode,
    resultado: Set<string>,
    traceability: TraceabilityLog[]
  ): void {
    resultado.add(nodo.nodeId);
    traceability.push({
      source: 'NODE',
      sourceId: nodo.nodeId,
      reason: 'Included in subtree traversal',
      priority: nodo.priority,
      timestamp: new Date().toISOString(),
    });

    for (const childId of nodo.children) {
      const child = this.graph.nodes.get(childId);
      if (child) {
        this.recolectarSubarbol(child, resultado, traceability);
      }
    }
  }

  /** Obtiene estado del grafo. */
  obtenerEstado() {
    return {
      graphId: this.graph.graphId,
      version: this.graph.version,
      totalNodes: this.graph.nodes.size,
      domains: Array.from(this.graph.nodesByDomain.keys()),
      types: Array.from(this.graph.nodesByType.keys()),
      rootNodeId: this.graph.rootNodeId,
      createdAt: this.graph.createdAt,
      updatedAt: this.graph.updatedAt,
    };
  }

  /** Guarda el grafo en disco (atómico). */
  private guardar(): void {
    const datos = {
      graphId: this.graph.graphId,
      version: this.graph.version,
      nodes: Array.from(this.graph.nodes.values()),
      rootNodeId: this.graph.rootNodeId,
      createdAt: this.graph.createdAt,
      updatedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(this.rutaPersistencia), { recursive: true });
    const temporal = `${this.rutaPersistencia}.tmp`;
    writeFileSync(temporal, JSON.stringify(datos, null, 2), 'utf8');
    renameSync(temporal, this.rutaPersistencia);
  }

  /** Carga el grafo desde disco. */
  private cargar(): void {
    if (!existsSync(this.rutaPersistencia)) {
      return;
    }

    try {
      const contenido = readFileSync(this.rutaPersistencia, 'utf8');
      const datos = JSON.parse(contenido);

      if (Array.isArray(datos.nodes)) {
        for (const nodo of datos.nodes) {
          this.graph.nodes.set(nodo.nodeId, nodo);
          this.indexarNodo(nodo);
        }
      }

      if (datos.rootNodeId) {
        this.graph.rootNodeId = datos.rootNodeId;
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Singleton global. */
let kgGlobal: KnowledgeGraphEngine | null = null;

export function inicializarKG(rutaPersistencia?: string): KnowledgeGraphEngine {
  kgGlobal = new KnowledgeGraphEngine(rutaPersistencia);
  return kgGlobal;
}

export function obtenerKG(): KnowledgeGraphEngine | null {
  return kgGlobal;
}

export function asignarKG(kg: KnowledgeGraphEngine | null): void {
  kgGlobal = kg;
}
