import { createHash } from 'node:crypto';

/** LOGICAL DOCUMENT — identidad canónica del documento. */
export interface LogicalDocument {
  logicalDocumentId: string;
  canonicalSource: string; // P.ej. 'FED', 'ECB', 'user-provided'
  canonicalTitle: string;
  currentVersionId: string; // referencia a DocumentVersion actual
  createdAt: string;
  updatedAt: string;
}

/** DOCUMENT VERSION — versión específica de un documento lógico. */
export interface DocumentVersion {
  versionId: string;
  logicalDocumentId: string;
  contentHash: string; // hash estable del contenido normalizado
  publishedAt?: string; // when source published it
  retrievedAt?: string; // when we ingested it
  supersedes?: string; // versionId anterior
  supersededBy?: string; // versionId siguiente
  status: 'CURRENT' | 'HISTORICAL' | 'SUPERSEDED' | 'UNKNOWN';
  metadata?: {
    contentLength?: number;
    sourceAuthority?: string;
    contentType?: string;
  };
}

/** Resultado normalizado de operación. */
export interface OperationResult<T> {
  status: 'CREATED' | 'REUSED' | 'UPDATED_VERSION' | 'DUPLICATE_REJECTED' | 'NEEDS_REVIEW';
  value?: T;
  reason?: string;
  timestamp: string;
}

/** Normaliza contenido para cálculo de hash de identidad. */
export function normalizarContenido(contenido: string): string {
  return contenido
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.length > 0)
    .join('\n')
    .toLowerCase();
}

/** Calcula hash estable del contenido normalizado. */
export function calcularContentHash(contenido: string): string {
  const normalizado = normalizarContenido(contenido);
  return createHash('sha256').update(normalizado).digest('hex');
}

/** Generador de IDs para documentos y versiones. */
export function generarLogicalDocumentId(source: string, title: string): string {
  const combined = `${source}::${title}`.toLowerCase().replace(/\s+/g, '_');
  const hash = createHash('md5').update(combined).digest('hex').substring(0, 8);
  return `ldoc_${hash}`;
}

export function generarVersionId(logicalId: string, contentHash: string): string {
  // Usar solo los primeros 8 caracteres del content hash para ID conciso
  const hashShort = contentHash.substring(0, 8);
  return `v_${logicalId}_${hashShort}`;
}

/** Version chain manager. */
export class VersionChain {
  private versions: Map<string, DocumentVersion> = new Map();
  private logicalDocs: Map<string, LogicalDocument> = new Map();

  /** Registra nueva versión. Retorna CREATED, REUSED, o UPDATED_VERSION. */
  registrarVersion(opciones: {
    logicalDocumentId: string;
    source: string;
    title: string;
    contenido: string;
    publishedAt?: string;
    retrievedAt?: string;
  }): OperationResult<{ logicalDocument: LogicalDocument; version: DocumentVersion }> {
    const ahora = new Date().toISOString();
    const contentHash = calcularContentHash(opciones.contenido);

    // Buscar documento lógico existente
    let logicalDoc = this.logicalDocs.get(opciones.logicalDocumentId);
    let isNewLogical = false;

    if (!logicalDoc) {
      isNewLogical = true;
      logicalDoc = {
        logicalDocumentId: opciones.logicalDocumentId,
        canonicalSource: opciones.source,
        canonicalTitle: opciones.title,
        currentVersionId: '',
        createdAt: ahora,
        updatedAt: ahora,
      };
    }

    // Buscar versión existente con mismo contenido
    const existingVersion = Array.from(this.versions.values()).find(
      (v) => v.logicalDocumentId === opciones.logicalDocumentId && v.contentHash === contentHash
    );

    if (existingVersion && existingVersion.status === 'CURRENT') {
      return {
        status: 'REUSED',
        value: { logicalDocument: logicalDoc, version: existingVersion },
        reason: 'Exact duplicate of current version',
        timestamp: ahora,
      };
    }

    // Nueva versión del mismo documento lógico
    const versionId = generarVersionId(opciones.logicalDocumentId, contentHash);
    const newVersion: DocumentVersion = {
      versionId,
      logicalDocumentId: opciones.logicalDocumentId,
      contentHash,
      publishedAt: opciones.publishedAt,
      retrievedAt: opciones.retrievedAt,
      status: 'CURRENT',
      metadata: {
        contentLength: opciones.contenido.length,
        sourceAuthority: opciones.source,
      },
    };

    // Actualizar versión anterior si existe
    if (logicalDoc.currentVersionId) {
      const prevVersion = this.versions.get(logicalDoc.currentVersionId);
      if (prevVersion) {
        prevVersion.status = 'SUPERSEDED';
        prevVersion.supersededBy = versionId;
        newVersion.supersedes = logicalDoc.currentVersionId;
      }
    }

    // Guardar nueva versión
    this.versions.set(versionId, newVersion);
    logicalDoc.currentVersionId = versionId;
    logicalDoc.updatedAt = ahora;
    this.logicalDocs.set(opciones.logicalDocumentId, logicalDoc);

    return {
      status: isNewLogical ? 'CREATED' : 'UPDATED_VERSION',
      value: { logicalDocument: logicalDoc, version: newVersion },
      reason: isNewLogical ? 'New logical document' : 'New version of existing document',
      timestamp: ahora,
    };
  }

  /** Obtiene documento lógico por ID. */
  obtenerDocumentoLogico(id: string): LogicalDocument | undefined {
    return this.logicalDocs.get(id);
  }

  /** Obtiene versión por ID. */
  obtenerVersion(versionId: string): DocumentVersion | undefined {
    return this.versions.get(versionId);
  }

  /** Obtiene versión actual de documento lógico. */
  obtenerVersionActual(logicalDocumentId: string): DocumentVersion | undefined {
    const logicalDoc = this.logicalDocs.get(logicalDocumentId);
    if (!logicalDoc) return undefined;
    return this.versions.get(logicalDoc.currentVersionId);
  }

  /** Obtiene cadena de versiones (A → B → C). */
  obtenerCadenaVersiones(logicalDocumentId: string): DocumentVersion[] {
    const cadena: DocumentVersion[] = [];
    const logicalDoc = this.logicalDocs.get(logicalDocumentId);
    if (!logicalDoc) return cadena;

    let currentId = logicalDoc.currentVersionId;
    const visited = new Set<string>();

    // Recorrer hacia atrás hasta el inicio
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const version = this.versions.get(currentId);
      if (!version) break;
      cadena.unshift(version);
      currentId = version.supersedes || '';
    }

    return cadena;
  }

  /** Obtiene estado. */
  obtenerEstado() {
    return {
      logicalDocuments: this.logicalDocs.size,
      versions: this.versions.size,
      current: Array.from(this.versions.values()).filter((v) => v.status === 'CURRENT').length,
      superseded: Array.from(this.versions.values()).filter((v) => v.status === 'SUPERSEDED').length,
    };
  }
}
