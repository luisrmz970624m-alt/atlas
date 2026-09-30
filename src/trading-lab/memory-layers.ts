import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export type MemoryLayer = 'DOCUMENTARY' | 'MARKET_HISTORY' | 'EXPERIMENT' | 'REASONING';
export type EntityType = 'DOCUMENT' | 'EVENT' | 'EXPERIMENT' | 'DECISION_CASE' | 'HYPOTHESIS';

export interface MemoryEntry {
  entryId: string;
  memoryLayer: MemoryLayer;
  entityType: EntityType;
  entityId: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentaryEntry extends MemoryEntry {
  memoryLayer: 'DOCUMENTARY';
  entityType: 'DOCUMENT';
  documentRef: {
    documentId: string;
    title: string;
    authority: string;
  };
}

export interface MarketHistoryEntry extends MemoryEntry {
  memoryLayer: 'MARKET_HISTORY';
  entityType: 'EVENT';
  eventRef: {
    eventId: string;
    date: string;
    description: string;
    marketReaction: string;
  };
}

export interface ExperimentEntry extends MemoryEntry {
  memoryLayer: 'EXPERIMENT';
  entityType: 'EXPERIMENT';
  experimentRef: {
    runId: string;
    backtest?: number;
    oos?: number;
    walkForward?: number[];
  };
}

export interface ReasoningEntry extends MemoryEntry {
  memoryLayer: 'REASONING';
  entityType: 'DECISION_CASE' | 'HYPOTHESIS';
  reasoningRef: {
    caseId?: string;
    hypothesisId?: string;
    findings: string[];
    contradictions: string[];
    invalidationConditions: string[];
  };
}

/** Gestor de capas de memoria — evita mezcla silenciosa de tipos. */
export class MemoryLayers {
  private documentary: Map<string, DocumentaryEntry> = new Map();
  private marketHistory: Map<string, MarketHistoryEntry> = new Map();
  private experiments: Map<string, ExperimentEntry> = new Map();
  private reasoning: Map<string, ReasoningEntry> = new Map();

  private rutaPersistencia: string = 'datos/memory-layers.json';

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;
    this.cargar();
  }

  /** Ingresa documento en DOCUMENTARY_MEMORY. Dedup por documentId. */
  registrarDocumento(opciones: {
    documentId: string;
    title: string;
    authority: string;
    source: string;
  }): DocumentaryEntry & { status: 'CREATED' | 'REUSED' } {
    const ahora = new Date().toISOString();

    // Canonical key: documentId
    const existente = this.documentary.get(opciones.documentId);
    if (existente) {
      return { ...existente, status: 'REUSED' };
    }

    const entry: DocumentaryEntry = {
      entryId: randomUUID(),
      memoryLayer: 'DOCUMENTARY',
      entityType: 'DOCUMENT',
      entityId: opciones.documentId,
      source: opciones.source,
      createdAt: ahora,
      updatedAt: ahora,
      documentRef: {
        documentId: opciones.documentId,
        title: opciones.title,
        authority: opciones.authority,
      },
    };

    // Usar documentId como clave, no entryId
    this.documentary.set(opciones.documentId, entry);
    this.guardar();

    return { ...entry, status: 'CREATED' };
  }

  /** Ingresa evento en MARKET_HISTORY_MEMORY. Dedup por eventId. */
  registrarEvento(opciones: {
    eventId: string;
    date: string;
    description: string;
    marketReaction: string;
    source: string;
  }): MarketHistoryEntry & { status: 'CREATED' | 'REUSED' } {
    const ahora = new Date().toISOString();

    const existente = this.marketHistory.get(opciones.eventId);
    if (existente) {
      return { ...existente, status: 'REUSED' };
    }

    const entry: MarketHistoryEntry = {
      entryId: randomUUID(),
      memoryLayer: 'MARKET_HISTORY',
      entityType: 'EVENT',
      entityId: opciones.eventId,
      source: opciones.source,
      createdAt: ahora,
      updatedAt: ahora,
      eventRef: {
        eventId: opciones.eventId,
        date: opciones.date,
        description: opciones.description,
        marketReaction: opciones.marketReaction,
      },
    };

    this.marketHistory.set(opciones.eventId, entry);
    this.guardar();

    return { ...entry, status: 'CREATED' };
  }

  /** Ingresa experimento en EXPERIMENT_MEMORY. Dedup por runId. */
  registrarExperimento(opciones: {
    runId: string;
    backtest?: number;
    oos?: number;
    walkForward?: number[];
    source: string;
  }): ExperimentEntry & { status: 'CREATED' | 'REUSED' } {
    const ahora = new Date().toISOString();

    const existente = this.experiments.get(opciones.runId);
    if (existente) {
      return { ...existente, status: 'REUSED' };
    }

    const entry: ExperimentEntry = {
      entryId: randomUUID(),
      memoryLayer: 'EXPERIMENT',
      entityType: 'EXPERIMENT',
      entityId: opciones.runId,
      source: opciones.source,
      createdAt: ahora,
      updatedAt: ahora,
      experimentRef: {
        runId: opciones.runId,
        backtest: opciones.backtest,
        oos: opciones.oos,
        walkForward: opciones.walkForward,
      },
    };

    this.experiments.set(opciones.runId, entry);
    this.guardar();

    return { ...entry, status: 'CREATED' };
  }

  /** Ingresa decisión o hipótesis en REASONING_MEMORY. Dedup por caseId o hypothesisId. */
  registrarRazonamiento(opciones: {
    caseId?: string;
    hypothesisId?: string;
    findings: string[];
    contradictions: string[];
    invalidationConditions: string[];
    source: string;
  }): ReasoningEntry & { status: 'CREATED' | 'REUSED' } {
    const ahora = new Date().toISOString();

    // Canonical key: caseId o hypothesisId
    const canonicalKey = opciones.caseId || opciones.hypothesisId;
    const existente = canonicalKey ? this.reasoning.get(canonicalKey) : null;

    if (existente) {
      return { ...existente, status: 'REUSED' };
    }

    const entry: ReasoningEntry = {
      entryId: randomUUID(),
      memoryLayer: 'REASONING',
      entityType: opciones.caseId ? 'DECISION_CASE' : 'HYPOTHESIS',
      entityId: opciones.caseId || opciones.hypothesisId || randomUUID(),
      source: opciones.source,
      createdAt: ahora,
      updatedAt: ahora,
      reasoningRef: {
        caseId: opciones.caseId,
        hypothesisId: opciones.hypothesisId,
        findings: opciones.findings,
        contradictions: opciones.contradictions,
        invalidationConditions: opciones.invalidationConditions,
      },
    };

    // Usar caseId o hypothesisId como clave, no entryId
    this.reasoning.set(canonicalKey || entry.entryId, entry);
    this.guardar();

    return { ...entry, status: 'CREATED' };
  }

  /** Obtiene documentos (NO mezcla tipos). */
  obtenerDocumentos(): DocumentaryEntry[] {
    return Array.from(this.documentary.values());
  }

  /** Obtiene eventos (NO mezcla tipos). */
  obtenerEventos(): MarketHistoryEntry[] {
    return Array.from(this.marketHistory.values());
  }

  /** Obtiene experimentos (NO mezcla tipos). */
  obtenerExperimentos(): ExperimentEntry[] {
    return Array.from(this.experiments.values());
  }

  /** Obtiene razonamientos (NO mezcla tipos). */
  obtenerRazonamientos(): ReasoningEntry[] {
    return Array.from(this.reasoning.values());
  }

  /** Obtiene por memoryLayer (separado). */
  obtenerPorCapa(capa: MemoryLayer): MemoryEntry[] {
    switch (capa) {
      case 'DOCUMENTARY':
        return Array.from(this.documentary.values());
      case 'MARKET_HISTORY':
        return Array.from(this.marketHistory.values());
      case 'EXPERIMENT':
        return Array.from(this.experiments.values());
      case 'REASONING':
        return Array.from(this.reasoning.values());
    }
  }

  /** Obtiene estado separado. */
  obtenerEstado() {
    return {
      documentary: this.documentary.size,
      marketHistory: this.marketHistory.size,
      experiment: this.experiments.size,
      reasoning: this.reasoning.size,
      total:
        this.documentary.size +
        this.marketHistory.size +
        this.experiments.size +
        this.reasoning.size,
      noSilentMixing: 'capas completamente separadas',
    };
  }

  /** Guarda en disco (atómico). */
  private guardar(): void {
    const datos = {
      documentary: Array.from(this.documentary.values()),
      marketHistory: Array.from(this.marketHistory.values()),
      experiment: Array.from(this.experiments.values()),
      reasoning: Array.from(this.reasoning.values()),
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

      if (Array.isArray(datos.documentary)) {
        for (const e of datos.documentary) {
          // Usar documentId como clave canónica
          this.documentary.set(e.documentRef.documentId, e);
        }
      }

      if (Array.isArray(datos.marketHistory)) {
        for (const e of datos.marketHistory) {
          // Usar eventId como clave canónica
          this.marketHistory.set(e.eventRef.eventId, e);
        }
      }

      if (Array.isArray(datos.experiment)) {
        for (const e of datos.experiment) {
          // Usar runId como clave canónica
          this.experiments.set(e.experimentRef.runId, e);
        }
      }

      if (Array.isArray(datos.reasoning)) {
        for (const e of datos.reasoning) {
          // Usar caseId o hypothesisId como clave canónica
          const canonicalKey = e.reasoningRef.caseId || e.reasoningRef.hypothesisId;
          this.reasoning.set(canonicalKey || e.entryId, e);
        }
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Singleton global. */
let mlGlobal: MemoryLayers | null = null;

export function inicializarML(rutaPersistencia?: string): MemoryLayers {
  mlGlobal = new MemoryLayers(rutaPersistencia);
  return mlGlobal;
}

export function obtenerML(): MemoryLayers | null {
  return mlGlobal;
}

export function asignarML(ml: MemoryLayers | null): void {
  mlGlobal = ml;
}
