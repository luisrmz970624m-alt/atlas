import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, extname } from 'node:path';

export type SourceAuthority = 'OFFICIAL' | 'INSTITUTIONAL' | 'ACADEMIC' | 'COMMUNITY' | 'USER_PROVIDED' | 'UNKNOWN';
export type DocumentType = 'POLICY' | 'RESEARCH' | 'TECHNICAL' | 'EDUCATIONAL' | 'REFERENCE' | 'UNKNOWN';

export interface KnowledgeSource {
  id: string;
  name: string;
  authority: SourceAuthority;
  institution?: string;
  url?: string;
}

export interface KnowledgeDocument {
  documentId: string;
  title: string;
  author?: string;
  institution?: string;
  publishedAt?: string;
  retrievedAt: string;
  sourceUrl?: string;
  documentType: DocumentType;
  topic?: string;
  region?: string;
  instruments?: string[];
  version: number;
  sourceAuthority: SourceAuthority;
  createdAt: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeChunk {
  chunkId: string;
  documentId: string;
  section?: string;
  page?: number;
  text: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  score: number;
  text: string;
  sourceMetadata: {
    title: string;
    institution?: string;
    authority: SourceAuthority;
    documentType: DocumentType;
  };
}

export interface KnowledgeBaseStatus {
  documentsCount: number;
  chunksCount: number;
  indexType: 'TEXTUAL';
  embeddingsEnabled: boolean;
  webSourcesConnected: boolean;
  lastUpdate: string | null;
  supportedFormats: string[];
}

/** Valida que el documento no tenga secretos detectables. */
function detectarSecretos(texto: string): boolean {
  const patronesSecretos = [
    /\b(contraseña|password|passwd)\b/i,
    /\b(api[-_ ]?key|token|secret|credencial)\b/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(mtfs|masterkey|account[-_ ]?number)\b/i,
  ];

  return patronesSecretos.some((patron) => patron.test(texto));
}

/** Genera ID determinista basado en contenido. */
function generarDocumentId(titulo: string, contenido: string, creacion: string): string {
  // Hash simple sin crypto
  let hash = 0;
  const str = titulo + contenido + creacion;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `doc_${Math.abs(hash).toString(36)}_${Date.now()}`;
}

/** Genera ID de chunk determinista. */
function generarChunkId(documentId: string, sectionIndex: number, textHash: number): string {
  return `chunk_${documentId}_${sectionIndex}_${Math.abs(textHash).toString(36)}`;
}

/** Chunking determinista por párrafos y límite de caracteres. */
export function dividirEnChunks(
  texto: string,
  documentId: string,
  maxChars: number = 1000
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const parrafos = texto.split(/\n\n+/).filter((p) => p.trim().length > 0);

  let sectionIndex = 0;

  for (const parrafo of parrafos) {
    const oraciones = parrafo.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
    let chunkActual = '';

    for (const oracion of oraciones) {
      if ((chunkActual + oracion).length > maxChars && chunkActual.length > 0) {
        // Guardar chunk actual
        const textHash = chunkActual.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0);
        chunks.push({
          chunkId: generarChunkId(documentId, sectionIndex, textHash),
          documentId,
          section: `Sección ${sectionIndex}`,
          text: chunkActual.trim(),
        });
        sectionIndex++;
        chunkActual = '';
      }

      chunkActual += (chunkActual ? ' ' : '') + oracion;
    }

    // Guardar último chunk del párrafo
    if (chunkActual.trim().length > 0) {
      const textHash = chunkActual.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) & 0xffffffff, 0);
      chunks.push({
        chunkId: generarChunkId(documentId, sectionIndex, textHash),
        documentId,
        section: `Sección ${sectionIndex}`,
        text: chunkActual.trim(),
      });
      sectionIndex++;
    }
  }

  return chunks.length > 0 ? chunks : [];
}

/** Motor de Knowledge Base local con indexación textual. */
export class KnowledgeBaseLocal {
  private documentos: Map<string, KnowledgeDocument> = new Map();
  private chunks: Map<string, KnowledgeChunk> = new Map();
  private indiceTexto: Map<string, Set<string>> = new Map(); // palabra -> chunkIds
  private rutaAsignarPersistencia: string = 'datos/knowledge-base.json';
  private contadoresFijos: { documentosReales: number; chunksReales: number } = {
    documentosReales: 0,
    chunksReales: 0,
  };

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaAsignarPersistencia = rutaPersistencia;
    this.cargar();
  }

  /** Ingesta documento desde texto. */
  ingesta(opciones: {
    contenido: string;
    titulo: string;
    authority: SourceAuthority;
    documentType?: DocumentType;
    author?: string;
    institution?: string;
    topic?: string;
    region?: string;
    instruments?: string[];
    sourceUrl?: string;
    isFixture?: boolean;
  }): { documentId: string; chunksCount: number } {
    // Validaciones
    if (!opciones.contenido || opciones.contenido.trim().length === 0) {
      throw new Error('Contenido vacío');
    }
    if (!opciones.titulo || opciones.titulo.trim().length === 0) {
      throw new Error('Título vacío');
    }
    if (detectarSecretos(opciones.contenido)) {
      throw new Error('Contenido contiene secretos o credenciales detectables');
    }

    const ahora = new Date().toISOString();
    const docId = generarDocumentId(opciones.titulo, opciones.contenido, ahora);

    // Crear documento
    const documento: KnowledgeDocument = {
      documentId: docId,
      title: opciones.titulo,
      author: opciones.author,
      institution: opciones.institution,
      publishedAt: undefined,
      retrievedAt: ahora,
      sourceUrl: opciones.sourceUrl,
      documentType: opciones.documentType || 'UNKNOWN',
      topic: opciones.topic,
      region: opciones.region,
      instruments: opciones.instruments,
      version: 1,
      sourceAuthority: opciones.authority,
      createdAt: ahora,
      content: opciones.contenido,
      metadata: {
        isFixture: opciones.isFixture || false,
        contentLength: opciones.contenido.length,
      },
    };

    this.documentos.set(docId, documento);

    // Crear chunks
    const chunks = dividirEnChunks(opciones.contenido, docId);
    for (const chunk of chunks) {
      this.chunks.set(chunk.chunkId, chunk);

      // Indexar palabras (simple keyword)
      const palabras = chunk.text.toLowerCase().split(/\W+/).filter((p) => p.length > 2);
      for (const palabra of palabras) {
        if (!this.indiceTexto.has(palabra)) {
          this.indiceTexto.set(palabra, new Set());
        }
        this.indiceTexto.get(palabra)!.add(chunk.chunkId);
      }
    }

    if (!documento.metadata?.isFixture) {
      this.contadoresFijos.documentosReales++;
      this.contadoresFijos.chunksReales += chunks.length;
    }

    this.guardar();

    return {
      documentId: docId,
      chunksCount: chunks.length,
    };
  }

  /** Busca documentos por texto simple (keyword matching). */
  buscar(query: string): SearchResult[] {
    const palabrasQuery = query.toLowerCase().split(/\W+/).filter((p) => p.length > 2);
    const chunksMatching = new Map<string, { chunk: KnowledgeChunk; matches: number }>();

    for (const palabra of palabrasQuery) {
      const chunkIds = this.indiceTexto.get(palabra) || new Set();
      for (const chunkId of chunkIds) {
        const chunk = this.chunks.get(chunkId);
        if (chunk) {
          const actual = chunksMatching.get(chunkId) || { chunk, matches: 0 };
          actual.matches++;
          chunksMatching.set(chunkId, actual);
        }
      }
    }

    // Ordenar por relevancia (cantidad de coincidencias)
    const resultados: SearchResult[] = Array.from(chunksMatching.values())
      .sort((a, b) => b.matches - a.matches)
      .map(({ chunk, matches }) => {
        const doc = this.documentos.get(chunk.documentId)!;
        return {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          score: Math.min(matches / palabrasQuery.length, 1.0), // Score 0-1
          text: chunk.text,
          sourceMetadata: {
            title: doc.title,
            institution: doc.institution,
            authority: doc.sourceAuthority,
            documentType: doc.documentType,
          },
        };
      });

    return resultados;
  }

  /** Busca por institución. */
  buscarPorInstitucion(institucion: string): SearchResult[] {
    const resultados: SearchResult[] = [];

    for (const [, chunk] of this.chunks) {
      const doc = this.documentos.get(chunk.documentId);
      if (doc && doc.institution?.toLowerCase().includes(institucion.toLowerCase())) {
        resultados.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          score: 1.0,
          text: chunk.text,
          sourceMetadata: {
            title: doc.title,
            institution: doc.institution,
            authority: doc.sourceAuthority,
            documentType: doc.documentType,
          },
        });
      }
    }

    return resultados;
  }

  /** Busca por tema. */
  buscarPorTema(tema: string): SearchResult[] {
    const resultados: SearchResult[] = [];

    for (const [, chunk] of this.chunks) {
      const doc = this.documentos.get(chunk.documentId);
      if (doc && doc.topic?.toLowerCase().includes(tema.toLowerCase())) {
        resultados.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          score: 1.0,
          text: chunk.text,
          sourceMetadata: {
            title: doc.title,
            institution: doc.institution,
            authority: doc.sourceAuthority,
            documentType: doc.documentType,
          },
        });
      }
    }

    return resultados;
  }

  /** Busca por instrumento. */
  buscarPorInstrumento(instrumento: string): SearchResult[] {
    const resultados: SearchResult[] = [];

    for (const [, chunk] of this.chunks) {
      const doc = this.documentos.get(chunk.documentId);
      if (doc && doc.instruments?.some((i) => i.toLowerCase().includes(instrumento.toLowerCase()))) {
        resultados.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          score: 1.0,
          text: chunk.text,
          sourceMetadata: {
            title: doc.title,
            institution: doc.institution,
            authority: doc.sourceAuthority,
            documentType: doc.documentType,
          },
        });
      }
    }

    return resultados;
  }

  /** Obtiene estado de la base de conocimientos. */
  obtenerEstado(): KnowledgeBaseStatus {
    let ultimaActualizacion: string | null = null;

    for (const doc of this.documentos.values()) {
      if (!ultimaActualizacion || doc.createdAt > ultimaActualizacion) {
        ultimaActualizacion = doc.createdAt;
      }
    }

    return {
      documentsCount: this.contadoresFijos.documentosReales,
      chunksCount: this.contadoresFijos.chunksReales,
      indexType: 'TEXTUAL',
      embeddingsEnabled: false,
      webSourcesConnected: false,
      lastUpdate: ultimaActualizacion,
      supportedFormats: ['TXT', 'MD', 'JSON'],
    };
  }

  /** Guarda la base de conocimientos en disco (atómico). */
  private guardar(): void {
    const datos = {
      documentos: Array.from(this.documentos.values()),
      chunks: Array.from(this.chunks.values()),
      contadores: this.contadoresFijos,
      ultimaActualizacion: new Date().toISOString(),
    };

    mkdirSync(dirname(this.rutaAsignarPersistencia), { recursive: true });
    const temporal = `${this.rutaAsignarPersistencia}.tmp`;
    writeFileSync(temporal, JSON.stringify(datos, null, 2), 'utf8');
    renameSync(temporal, this.rutaAsignarPersistencia);
  }

  /** Carga la base de conocimientos desde disco. */
  private cargar(): void {
    if (!existsSync(this.rutaAsignarPersistencia)) {
      return;
    }

    try {
      const contenido = readFileSync(this.rutaAsignarPersistencia, 'utf8');
      const datos = JSON.parse(contenido);

      if (Array.isArray(datos.documentos)) {
        for (const doc of datos.documentos) {
          this.documentos.set(doc.documentId, doc);
        }
      }

      if (Array.isArray(datos.chunks)) {
        for (const chunk of datos.chunks) {
          this.chunks.set(chunk.chunkId, chunk);

          // Reconstruir índice
          const palabras = chunk.text.toLowerCase().split(/\W+/).filter((p) => p.length > 2);
          for (const palabra of palabras) {
            if (!this.indiceTexto.has(palabra)) {
              this.indiceTexto.set(palabra, new Set());
            }
            this.indiceTexto.get(palabra)!.add(chunk.chunkId);
          }
        }
      }

      if (datos.contadores) {
        this.contadoresFijos = datos.contadores;
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }

  /** Cuenta documentos reales (no fixtures). */
  contarDocumentosReales(): number {
    return this.contadoresFijos.documentosReales;
  }

  /** Cuenta chunks reales (no de fixtures). */
  contarChunksReales(): number {
    return this.contadoresFijos.chunksReales;
  }

  /** Obtiene documento por ID. */
  obtenerDocumento(documentId: string): KnowledgeDocument | undefined {
    return this.documentos.get(documentId);
  }

  /** Obtiene chunk por ID. */
  obtenerChunk(chunkId: string): KnowledgeChunk | undefined {
    return this.chunks.get(chunkId);
  }
}

/** Singleton global de Knowledge Base. */
let kbGlobal: KnowledgeBaseLocal | null = null;

export function inicializarKB(rutaPersistencia?: string): KnowledgeBaseLocal {
  kbGlobal = new KnowledgeBaseLocal(rutaPersistencia);
  return kbGlobal;
}

export function obtenerKB(): KnowledgeBaseLocal | null {
  return kbGlobal;
}

export function asignarKB(kb: KnowledgeBaseLocal | null): void {
  kbGlobal = kb;
}
