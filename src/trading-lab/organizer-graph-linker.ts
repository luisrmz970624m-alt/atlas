import { randomUUID } from 'node:crypto';

export type ClassificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
export type LinkingPolicy = 'AUTO_HIGH' | 'MANUAL_MEDIUM' | 'MANUAL_LOW' | 'MANUAL_UNKNOWN';

export interface DocumentOrganization {
  organizationId: string;
  documentId: string;
  timestamp: string;
  status: string;
  classification: {
    domain: string;
    subdomain?: string;
    confidence: ClassificationConfidence;
  };
  suggestedNodeIds: string[];
  linkedEntities: Array<{ entity: string; type: string; confidence: ClassificationConfidence }>;
  tags: string[];
  needsReview: boolean;
  reviewReason?: string;
  auditTrail: Array<{ timestamp: string; status: string; changedBy?: string; details?: string }>;
}

export interface KnowledgeNode {
  nodeId: string;
  parentId: string | null;
  type: string;
  domain: string;
  name: string;
  description?: string;
  children: string[];
  documentRefs: string[];
  chunkRefs: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface LinkingDecision {
  documentId: string;
  organizationId: string;
  confidence: ClassificationConfidence;
  policy: LinkingPolicy;
  action: 'AUTO_LINK' | 'NEEDS_REVIEW' | 'REJECT';
  reason: string;
  proposedNodeIds: string[];
  createdNodeIds: string[];
  linkedNodeIds: string[];
  timestamp: string;
}

export interface KnowledgeGraphEngine {
  obtenerNodo(nodeId: string): KnowledgeNode | undefined;
  agregarNodo(nodo: KnowledgeNode): void;
}

/** Política de auto-linking basada en confianza. */
export class OrganizerGraphLinker {
  private kg: KnowledgeGraphEngine;

  constructor(kg: KnowledgeGraphEngine) {
    this.kg = kg;
  }

  /** Aplica política de linking a una DocumentOrganization clasificada. */
  decidirLinking(org: DocumentOrganization): LinkingDecision {
    const ahora = new Date().toISOString();
    const confidence = org.classification.confidence;

    let policy: LinkingPolicy = 'MANUAL_UNKNOWN';
    let action: 'AUTO_LINK' | 'NEEDS_REVIEW' | 'REJECT' = 'NEEDS_REVIEW';
    let reason = '';

    if (confidence === 'HIGH') {
      policy = 'AUTO_HIGH';
      action = 'AUTO_LINK';
      reason = 'High confidence classification, domain clear, entities known';
    } else if (confidence === 'MEDIUM') {
      policy = 'MANUAL_MEDIUM';
      action = 'NEEDS_REVIEW';
      reason = 'Medium confidence, requires human review before linking';
    } else if (confidence === 'LOW') {
      policy = 'MANUAL_LOW';
      action = 'NEEDS_REVIEW';
      reason = 'Low confidence, unclear classification';
    } else {
      policy = 'MANUAL_UNKNOWN';
      action = 'NEEDS_REVIEW';
      reason = 'Uncertain classification, no linking without review';
    }

    // Si domain es UNKNOWN, siempre NEEDS_REVIEW
    if (org.classification.domain === 'UNKNOWN') {
      action = 'NEEDS_REVIEW';
      reason = 'Domain unknown, cannot link without clarification';
    }

    // Recolectar nodeIds propuestos desde suggestedNodeIds
    const proposedNodeIds = org.suggestedNodeIds;

    return {
      documentId: org.documentId,
      organizationId: org.organizationId,
      confidence,
      policy,
      action,
      reason,
      proposedNodeIds,
      createdNodeIds: [],
      linkedNodeIds: [],
      timestamp: ahora,
    };
  }

  /** Ejecuta auto-linking para un documento con HIGH confianza. */
  ejecutarAutoLinking(org: DocumentOrganization): LinkingDecision {
    const decision = this.decidirLinking(org);

    if (decision.action !== 'AUTO_LINK') {
      return decision;
    }

    const ahora = new Date().toISOString();

    // Paso 1: Verificar que dominio sea válido
    if (org.classification.domain === 'UNKNOWN') {
      decision.action = 'NEEDS_REVIEW';
      decision.reason = 'Cannot auto-link unknown domain';
      return decision;
    }

    // Paso 2: Obtener o crear nodos necesarios
    const nodosParaVincular: string[] = [];

    // Nodo de domain
    if (org.classification.domain === 'TRADING') {
      const nodoDomain = this.kg.obtenerNodo('trading-domain');
      if (nodoDomain) {
        nodosParaVincular.push(nodoDomain.nodeId);
      } else {
        // Crear nodo TRADING bajo root
        const nodoTrading = this.crearNodoSeguro(
          'trading-domain',
          'vortice-root',
          'CATEGORY',
          'TRADING',
          'Trading Domain',
          'Categoría raíz para conocimiento de trading'
        );
        if (nodoTrading) {
          decision.createdNodeIds.push(nodoTrading.nodeId);
          nodosParaVincular.push(nodoTrading.nodeId);
        }
      }
    }

    // Nodo de subdomain si existe
    if (org.classification.subdomain) {
      const nodoSubdomain = this.obtenerOCrearSubdominio(
        org.classification.subdomain,
        nodosParaVincular[0] || 'trading-domain'
      );
      if (nodoSubdomain) {
        if (!this.kg.obtenerNodo(nodoSubdomain.nodeId)) {
          decision.createdNodeIds.push(nodoSubdomain.nodeId);
        }
        nodosParaVincular.push(nodoSubdomain.nodeId);
      }
    }

    // Nodos de entidades conocidas
    for (const entidad of org.linkedEntities) {
      const nodoEntidad = this.obtenerOCrearEntidad(entidad.entity, entidad.type);
      if (nodoEntidad) {
        if (!this.kg.obtenerNodo(nodoEntidad.nodeId)) {
          decision.createdNodeIds.push(nodoEntidad.nodeId);
        }
        nodosParaVincular.push(nodoEntidad.nodeId);
      }
    }

    // Paso 3: Vincular documento a todos los nodos propuestos
    for (const nodeId of nodosParaVincular) {
      const nodo = this.kg.obtenerNodo(nodeId);
      if (nodo && !nodo.documentRefs.includes(org.documentId)) {
        nodo.documentRefs.push(org.documentId);
        nodo.updatedAt = ahora;
        decision.linkedNodeIds.push(nodeId);
      }
    }

    return decision;
  }

  /** Crea un nodo seguro sin sobreescribir existentes. */
  private crearNodoSeguro(
    nodeId: string,
    parentId: string | null,
    type: string,
    domain: string,
    name: string,
    description?: string
  ): KnowledgeNode | null {
    // Verificar que no exista
    if (this.kg.obtenerNodo(nodeId)) {
      return this.kg.obtenerNodo(nodeId) || null;
    }

    // Verificar que parent exista (si se proporciona)
    if (parentId && !this.kg.obtenerNodo(parentId)) {
      return null; // No crear si el parent no existe
    }

    const ahora = new Date().toISOString();
    const nodo: KnowledgeNode = {
      nodeId,
      parentId,
      type,
      domain,
      name,
      description,
      children: [],
      documentRefs: [],
      chunkRefs: [],
      priority: 50,
      createdAt: ahora,
      updatedAt: ahora,
    };

    try {
      this.kg.agregarNodo(nodo);
      return nodo;
    } catch {
      return null;
    }
  }

  /** Obtiene o crea un nodo de subdomain. */
  private obtenerOCrearSubdominio(
    subdomain: string,
    parentId: string
  ): KnowledgeNode | null {
    const nodeId = `subdomain-${subdomain.toLowerCase()}`;

    const existente = this.kg.obtenerNodo(nodeId);
    if (existente) return existente;

    const type = subdomain === 'FUNDAMENTAL' ? 'CATEGORY' : 'CATEGORY';

    return this.crearNodoSeguro(
      nodeId,
      parentId,
      type,
      'TRADING',
      subdomain,
      `${subdomain} analysis for trading`
    );
  }

  /** Obtiene o crea un nodo de entidad. */
  private obtenerOCrearEntidad(entidad: string, entityType: string): KnowledgeNode | null {
    const nodeId = `entity-${entidad.toLowerCase()}`;

    const existente = this.kg.obtenerNodo(nodeId);
    if (existente) return existente;

    let nodeType = 'ENTITY';
    let domain = 'TRADING';
    let parentId = 'trading-domain';

    if (entityType === 'INSTRUMENT') {
      nodeType = 'INSTRUMENT';
      parentId = 'subdomain-instruments'; // Este debería existir o crearse
    } else if (entityType === 'CENTRAL_BANK') {
      nodeType = 'CENTRAL_BANK';
      parentId = 'subdomain-fundamental'; // Enlazar con análisis fundamental
    } else if (entityType === 'COUNTRY') {
      nodeType = 'COUNTRY';
      parentId = 'trading-domain';
    }

    // Verificar que parent existe antes de crear
    if (parentId && !this.kg.obtenerNodo(parentId)) {
      // Crear parent si no existe
      if (parentId === 'subdomain-instruments') {
        this.crearNodoSeguro(
          'subdomain-instruments',
          'trading-domain',
          'CATEGORY',
          'TRADING',
          'Instruments',
          'Trading instruments'
        );
      } else if (parentId === 'subdomain-fundamental') {
        this.crearNodoSeguro(
          'subdomain-fundamental',
          'trading-domain',
          'CATEGORY',
          'TRADING',
          'Fundamental',
          'Fundamental analysis'
        );
      }
    }

    return this.crearNodoSeguro(
      nodeId,
      parentId || 'trading-domain',
      nodeType,
      domain,
      entidad,
      `${entityType}: ${entidad}`
    );
  }
}

/** Singleton global. */
let linkerGlobal: OrganizerGraphLinker | null = null;

export function inicializarLinker(kg: KnowledgeGraphEngine): OrganizerGraphLinker {
  linkerGlobal = new OrganizerGraphLinker(kg);
  return linkerGlobal;
}

export function obtenerLinker(): OrganizerGraphLinker | null {
  return linkerGlobal;
}

export function asignarLinker(linker: OrganizerGraphLinker | null): void {
  linkerGlobal = linker;
}
