import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { obtenerER } from './entity-registry.ts';

export type ClassificationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
export type OrganizationStatus =
  | 'DOCUMENT_INGESTED'
  | 'DOCUMENT_CLASSIFIED'
  | 'DOCUMENT_LINKED'
  | 'DOCUMENT_REVIEW_REQUIRED'
  | 'DOCUMENT_SUPERSEDED';

export interface ClassificationSuggestion {
  domain: string;
  subdomain?: string;
  topic?: string;
  entity?: string;
  instrument?: string;
  institution?: string;
  documentType?: string;
  sourceAuthority?: string;
  confidence: ClassificationConfidence;
}

export interface EntityLink {
  entity: string;
  type: 'INSTRUMENT' | 'COUNTRY' | 'CENTRAL_BANK' | 'INSTITUTION' | 'CONCEPT' | 'PERSON';
  confidence: ClassificationConfidence;
}

export interface DocumentOrganization {
  organizationId: string;
  documentId: string;
  timestamp: string;
  status: OrganizationStatus;
  classification: ClassificationSuggestion;
  suggestedNodeIds: string[];
  linkedEntities: EntityLink[];
  tags: string[];
  needsReview: boolean;
  reviewReason?: string;
  auditTrail: OrganizationAuditEntry[];
}

export interface OrganizationAuditEntry {
  timestamp: string;
  status: OrganizationStatus;
  changedBy?: string;
  details?: string;
}

/** Organizador de conocimiento — clasifica documentos sin duplicarlos. */
export class KnowledgeOrganizer {
  private organizaciones: Map<string, DocumentOrganization> = new Map();
  private rutaPersistencia: string = 'datos/knowledge-organizer.json';

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;
    this.cargar();
  }

  /** Obtiene entidades de tipo INSTRUMENT desde EntityRegistry. Fallback a búsqueda local. */
  private obtenerInstrumentos(): Set<string> {
    const registry = obtenerER();
    if (registry) {
      const entities = registry.obtenerPorTipo('INSTRUMENT');
      return new Set(entities.map((e) => e.canonicalName));
    }
    // Fallback: diccionarios legacy
    return new Set([
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'BTC', 'ETH', 'SPY', 'QQQ',
    ]);
  }

  /** Obtiene entidades de tipo CENTRAL_BANK desde EntityRegistry. Fallback a búsqueda local. */
  private obtenerBancosCentrales(): Set<string> {
    const registry = obtenerER();
    if (registry) {
      const entities = registry.obtenerPorTipo('CENTRAL_BANK');
      return new Set(entities.map((e) => e.canonicalName));
    }
    return new Set(['FED', 'ECB', 'BOJ', 'BOE', 'SNB', 'RBA', 'RBNZ', 'BAN']);
  }

  /** Obtiene entidades de tipo COUNTRY desde EntityRegistry. Fallback a búsqueda local. */
  private obtenerPaises(): Set<string> {
    const registry = obtenerER();
    if (registry) {
      const entities = registry.obtenerPorTipo('COUNTRY');
      return new Set(entities.map((e) => e.canonicalName));
    }
    return new Set(['USA', 'EUR', 'JPN', 'GBR', 'CHE', 'AUS', 'CAD', 'NZL']);
  }

  /** Obtiene entidades de tipo INSTITUTION desde EntityRegistry. Fallback a búsqueda local. */
  private obtenerInstituciones(): Set<string> {
    const registry = obtenerER();
    if (registry) {
      const entities = registry.obtenerPorTipo('INSTITUTION');
      return new Set(entities.map((e) => e.canonicalName));
    }
    return new Set(['BANK', 'HEDGE_FUND', 'ASSET_MANAGER', 'CTA', 'PROP_TRADER', 'BROKER']);
  }

  /** Obtiene entidades de tipo CONCEPT desde EntityRegistry. Fallback a búsqueda local. */
  private obtenerConceptosTrading(): Set<string> {
    const registry = obtenerER();
    if (registry) {
      const entities = registry.obtenerPorTipo('CONCEPT');
      return new Set(entities.map((e) => e.canonicalName));
    }
    return new Set(['INTEREST_RATES', 'INFLATION', 'EMPLOYMENT', 'GDP', 'CPI', 'NFP', 'PMI', 'YIELD', 'SPREAD', 'VOLATILITY']);
  }

  /** Clasifica un documento automáticamente. */
  clasificar(opciones: {
    documentId: string;
    contenido: string;
    titulo: string;
    sourceAuthority?: string;
  }): DocumentOrganization {
    const organizationId = randomUUID();
    const ahora = new Date().toISOString();

    // Extraer entidades
    const entities = this.extraerEntidades(opciones.contenido);
    const linkedEntities = this.mapearEntidades(entities);

    // Clasificar tema
    const classification = this.clasificarTema(
      opciones.contenido,
      opciones.titulo,
      linkedEntities
    );

    // Determinar nodos sugeridos
    const suggestedNodeIds = this.sugerirNodos(classification, linkedEntities);

    // Determinar si necesita revisión
    // Marca como NEEDS_REVIEW si confianza es menor a HIGH o si domain es UNKNOWN
    const needsReview =
      classification.confidence === 'LOW' ||
      classification.confidence === 'UNCERTAIN' ||
      (classification.confidence === 'MEDIUM' && classification.domain === 'UNKNOWN');
    const reviewReason = needsReview ? `Clasificación con confianza ${classification.confidence}` : undefined;

    const organizacion: DocumentOrganization = {
      organizationId,
      documentId: opciones.documentId,
      timestamp: ahora,
      status: 'DOCUMENT_CLASSIFIED',
      classification,
      suggestedNodeIds,
      linkedEntities,
      tags: this.generarTags(classification, linkedEntities),
      needsReview,
      reviewReason,
      auditTrail: [
        {
          timestamp: ahora,
          status: 'DOCUMENT_INGESTED',
          details: 'Documento ingresado para clasificación',
        },
        {
          timestamp: ahora,
          status: 'DOCUMENT_CLASSIFIED',
          details: `Clasificado con confianza ${classification.confidence}`,
        },
      ],
    };

    this.organizaciones.set(organizationId, organizacion);
    this.guardar();

    return organizacion;
  }

  /** Extrae potenciales entidades del contenido. */
  private extraerEntidades(contenido: string): string[] {
    const palabras = contenido.toUpperCase().split(/\W+/);
    const entidades = new Set<string>();

    const instrumentos = this.obtenerInstrumentos();
    const bancos = this.obtenerBancosCentrales();
    const paises = this.obtenerPaises();
    const conceptos = this.obtenerConceptosTrading();

    for (const palabra of palabras) {
      if (palabra.length < 2) continue;

      if (instrumentos.has(palabra)) entidades.add(palabra);
      if (bancos.has(palabra)) entidades.add(palabra);
      if (paises.has(palabra)) entidades.add(palabra);
      if (conceptos.has(palabra)) entidades.add(palabra);
    }

    return Array.from(entidades);
  }

  /** Mapea entidades extraídas a tipos conocidos. */
  private mapearEntidades(entidades: string[]): EntityLink[] {
    const links: EntityLink[] = [];

    const instrumentos = this.obtenerInstrumentos();
    const bancos = this.obtenerBancosCentrales();
    const paises = this.obtenerPaises();
    const instituciones = this.obtenerInstituciones();

    for (const entidad of entidades) {
      let type: EntityLink['type'] = 'CONCEPT';
      let confidence: ClassificationConfidence = 'HIGH';

      if (instrumentos.has(entidad)) {
        type = 'INSTRUMENT';
      } else if (bancos.has(entidad)) {
        type = 'CENTRAL_BANK';
      } else if (paises.has(entidad)) {
        type = 'COUNTRY';
      } else if (instituciones.has(entidad)) {
        type = 'INSTITUTION';
      }

      links.push({ entity: entidad, type, confidence });
    }

    return links;
  }

  /** Clasifica el tema principal del documento. */
  private clasificarTema(
    contenido: string,
    titulo: string,
    entidades: EntityLink[]
  ): ClassificationSuggestion {
    const texto = (titulo + ' ' + contenido).toLowerCase();

    // Heurística simple
    let domain = 'UNKNOWN';
    let subdomain = 'GENERAL';
    let documentType = 'REFERENCE';
    let confidence: ClassificationConfidence = 'LOW';

    // Detectar FUNDAMENTAL primero (tiene keywords específicos)
    const isFundamental =
      texto.includes('fundamental') ||
      texto.includes('inflation') ||
      texto.includes('interest rate') ||
      texto.includes('employment') ||
      texto.includes('gdp') ||
      texto.includes('cpi') ||
      texto.includes('politica monetaria') ||
      texto.includes('política monetaria') ||
      (texto.includes('fed') && texto.includes('affect')) ||
      (texto.includes('central bank') && texto.includes('policy'));

    // Detectar TECHNICAL
    const isTechnical =
      texto.includes('technical') ||
      texto.includes('chart') ||
      texto.includes('indicator') ||
      texto.includes('vela') ||
      texto.includes('pattern') ||
      texto.includes('resistencia') ||
      texto.includes('soporte') ||
      texto.includes('support') ||
      texto.includes('resistance');

    // Determinar domain y subdomain
    if (
      texto.includes('trade') ||
      texto.includes('trading') ||
      texto.includes('forex') ||
      texto.includes('mercado') ||
      texto.includes('currency') ||
      texto.includes('estrategia') ||
      isFundamental ||
      isTechnical
    ) {
      domain = 'TRADING';
      confidence = 'MEDIUM';

      if (isFundamental) {
        subdomain = 'FUNDAMENTAL';
        confidence = 'HIGH';
      } else if (isTechnical) {
        subdomain = 'TECHNICAL';
        confidence = 'HIGH';
      } else if (texto.includes('strategy') || texto.includes('estrategia')) {
        subdomain = 'STRATEGIES';
        documentType = 'TECHNICAL';
        confidence = 'MEDIUM';
      }
    }

    // Detectar tipo de documento
    if (
      texto.includes('paper') ||
      texto.includes('research') ||
      texto.includes('estudio')
    ) {
      documentType = 'RESEARCH';
      if (domain === 'TRADING') confidence = 'HIGH';
    } else if (
      texto.includes('policy') ||
      texto.includes('regulation') ||
      texto.includes('normativa')
    ) {
      documentType = 'POLICY';
      if (domain === 'UNKNOWN') domain = 'TRADING';
    } else if (texto.includes('education') || texto.includes('educación')) {
      documentType = 'EDUCATIONAL';
    }

    // Si hay entidades vinculadas, aumentar confianza
    if (entidades.length > 0) {
      if (confidence === 'LOW') {
        confidence = 'MEDIUM';
      } else if (confidence === 'MEDIUM' && entidades.length > 2) {
        confidence = 'HIGH';
      }
    }

    return {
      domain,
      subdomain,
      documentType,
      confidence,
    };
  }

  /** Sugiere nodeIds basados en clasificación. */
  private sugerirNodos(
    classification: ClassificationSuggestion,
    entidades: EntityLink[]
  ): string[] {
    const nodos: string[] = [];

    // Nodo de domain
    if (classification.domain === 'TRADING') {
      nodos.push('vortice-root');
      nodos.push('trading-domain');

      if (classification.subdomain === 'FUNDAMENTAL') {
        nodos.push('trading-fundamental');
      } else if (classification.subdomain === 'TECHNICAL') {
        nodos.push('trading-technical');
      }
    }

    // Nodos de entidades
    for (const entidad of entidades) {
      if (entidad.type === 'INSTRUMENT') {
        nodos.push(`instrument-${entidad.entity.toLowerCase()}`);
      } else if (entidad.type === 'CENTRAL_BANK') {
        nodos.push(`bank-${entidad.entity.toLowerCase()}`);
      }
    }

    return Array.from(new Set(nodos)); // Eliminar duplicados
  }

  /** Genera tags para el documento. */
  private generarTags(classification: ClassificationSuggestion, entidades: EntityLink[]): string[] {
    const tags: string[] = [];

    tags.push(classification.domain);
    if (classification.subdomain) tags.push(classification.subdomain);
    if (classification.documentType) tags.push(classification.documentType);

    for (const entidad of entidades) {
      tags.push(entidad.entity.toLowerCase());
    }

    return Array.from(new Set(tags));
  }

  /** Marca documento como vinculado. */
  marcarVinculado(organizationId: string): void {
    const org = this.organizaciones.get(organizationId);
    if (!org) return;

    org.status = 'DOCUMENT_LINKED';
    org.auditTrail.push({
      timestamp: new Date().toISOString(),
      status: 'DOCUMENT_LINKED',
      details: 'Documento vinculado a nodos',
    });

    this.guardar();
  }

  /** Marca documento como superado. */
  marcarSupersedido(organizationId: string, razón?: string): void {
    const org = this.organizaciones.get(organizationId);
    if (!org) return;

    org.status = 'DOCUMENT_SUPERSEDED';
    org.auditTrail.push({
      timestamp: new Date().toISOString(),
      status: 'DOCUMENT_SUPERSEDED',
      details: razón || 'Documento superado',
    });

    this.guardar();
  }

  /** Obtiene documentos que necesitan revisión. */
  obtenerPendienteRevision(): DocumentOrganization[] {
    return Array.from(this.organizaciones.values()).filter((o) => o.needsReview);
  }

  /** Obtiene una organización por ID. */
  obtenerOrganizacion(organizationId: string): DocumentOrganization | undefined {
    return this.organizaciones.get(organizationId);
  }

  /** Obtiene organización por documentId. */
  obtenerPorDocumento(documentId: string): DocumentOrganization | undefined {
    return Array.from(this.organizaciones.values()).find((o) => o.documentId === documentId);
  }

  /** Obtiene estado. */
  obtenerEstado() {
    const organizaciones = Array.from(this.organizaciones.values());

    const instrumentos = this.obtenerInstrumentos();
    const bancos = this.obtenerBancosCentrales();
    const paises = this.obtenerPaises();
    const conceptos = this.obtenerConceptosTrading();

    return {
      totalOrganizaciones: organizaciones.length,
      pendienteRevision: organizaciones.filter((o) => o.needsReview).length,
      clasificadas: organizaciones.filter((o) => o.status === 'DOCUMENT_CLASSIFIED').length,
      vinculadas: organizaciones.filter((o) => o.status === 'DOCUMENT_LINKED').length,
      supersedidas: organizaciones.filter((o) => o.status === 'DOCUMENT_SUPERSEDED').length,
      entidadesConocidas: {
        instrumentos: instrumentos.size,
        bancosCentrales: bancos.size,
        paises: paises.size,
        conceptos: conceptos.size,
      },
    };
  }

  /** Guarda en disco (atómico). */
  private guardar(): void {
    const datos = {
      organizaciones: Array.from(this.organizaciones.values()),
      ultimaActualizacion: new Date().toISOString(),
    };

    mkdirSync(dirname(this.rutaPersistencia), { recursive: true });
    const temporal = `${this.rutaPersistencia}.tmp`;
    writeFileSync(temporal, JSON.stringify(datos, null, 2), 'utf8');
    renameSync(temporal, this.rutaPersistencia);
  }

  /** Carga desde disco. */
  private cargar(): void {
    if (!existsSync(this.rutaPersistencia)) {
      return;
    }

    try {
      const contenido = readFileSync(this.rutaPersistencia, 'utf8');
      const datos = JSON.parse(contenido);

      if (Array.isArray(datos.organizaciones)) {
        for (const o of datos.organizaciones) {
          this.organizaciones.set(o.organizationId, o);
        }
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Singleton global. */
let koGlobal: KnowledgeOrganizer | null = null;

export function inicializarKO(rutaPersistencia?: string): KnowledgeOrganizer {
  koGlobal = new KnowledgeOrganizer(rutaPersistencia);
  return koGlobal;
}

export function obtenerKO(): KnowledgeOrganizer | null {
  return koGlobal;
}

export function asignarKO(ko: KnowledgeOrganizer | null): void {
  koGlobal = ko;
}
