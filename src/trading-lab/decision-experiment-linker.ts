import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DecisionCaseRef {
  caseId: string;
  hypothesis: string;
  experimentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentRef {
  runId: string;
  results: {
    backtest?: number;
    oos?: number;
    walkForward?: number[];
  };
  relatedCaseIds: string[];
  hypothesisId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkageRecord {
  linkageId: string;
  decisionCaseId: string;
  experimentId: string;
  direction: 'FORWARD' | 'REVERSE' | 'BIDIRECTIONAL';
  createdAt: string;
  reason?: string;
}

export interface DecisionExperimentLinkageData {
  linkageId: string;
  version: number;
  cases: Map<string, DecisionCaseRef>;
  experiments: Map<string, ExperimentRef>;
  linkages: Map<string, LinkageRecord>;
  casesByExperiment: Map<string, Set<string>>;
  experimentsByCase: Map<string, Set<string>>;
  createdAt: string;
  updatedAt: string;
}

/** Gestor de vínculos bidireccionales entre DecisionCase y Experiment. */
export class DecisionExperimentLinker {
  private data: DecisionExperimentLinkageData;
  private rutaPersistencia: string = 'datos/decision-experiment-links.json';

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;

    const ahora = new Date().toISOString();
    this.data = {
      linkageId: `del_${Date.now()}`,
      version: 1,
      cases: new Map(),
      experiments: new Map(),
      linkages: new Map(),
      casesByExperiment: new Map(),
      experimentsByCase: new Map(),
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.cargar();
  }

  /** Registra un DecisionCase. */
  registrarCase(opciones: {
    caseId: string;
    hypothesis: string;
    experimentIds?: string[];
  }): DecisionCaseRef {
    const ahora = new Date().toISOString();

    const caseRef: DecisionCaseRef = {
      caseId: opciones.caseId,
      hypothesis: opciones.hypothesis,
      experimentIds: opciones.experimentIds || [],
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.data.cases.set(opciones.caseId, caseRef);

    // Registrar relaciones iniciales
    for (const expId of caseRef.experimentIds) {
      this.vincularForward(opciones.caseId, expId);
    }

    this.data.updatedAt = ahora;
    this.guardar();

    return caseRef;
  }

  /** Registra un Experiment. */
  registrarExperiment(opciones: {
    runId: string;
    backtest?: number;
    oos?: number;
    walkForward?: number[];
    relatedCaseIds?: string[];
  }): ExperimentRef {
    const ahora = new Date().toISOString();

    const expRef: ExperimentRef = {
      runId: opciones.runId,
      results: {
        backtest: opciones.backtest,
        oos: opciones.oos,
        walkForward: opciones.walkForward,
      },
      relatedCaseIds: opciones.relatedCaseIds || [],
      createdAt: ahora,
      updatedAt: ahora,
    };

    this.data.experiments.set(opciones.runId, expRef);

    // Registrar relaciones iniciales
    for (const caseId of expRef.relatedCaseIds) {
      this.vincularReverse(caseId, opciones.runId);
    }

    this.data.updatedAt = ahora;
    this.guardar();

    return expRef;
  }

  /** Víncula un DecisionCase → Experiment (forward). */
  vincularForward(caseId: string, experimentId: string, reason?: string): void {
    const ahora = new Date().toISOString();
    const linkageId = `link_${caseId}_${experimentId}`;

    // Evitar duplicados
    if (this.data.linkages.has(linkageId)) return;

    const linkage: LinkageRecord = {
      linkageId,
      decisionCaseId: caseId,
      experimentId,
      direction: 'FORWARD',
      createdAt: ahora,
      reason,
    };

    this.data.linkages.set(linkageId, linkage);

    // Indexar relaciones
    if (!this.data.experimentsByCase.has(caseId)) {
      this.data.experimentsByCase.set(caseId, new Set());
    }
    this.data.experimentsByCase.get(caseId)!.add(experimentId);

    // Actualizar referencias
    const caseRef = this.data.cases.get(caseId);
    if (caseRef && !caseRef.experimentIds.includes(experimentId)) {
      caseRef.experimentIds.push(experimentId);
      caseRef.updatedAt = ahora;
    }

    this.data.updatedAt = ahora;
    this.guardar();
  }

  /** Víncula un Experiment → DecisionCase (reverse). */
  vincularReverse(caseId: string, experimentId: string, reason?: string): void {
    const ahora = new Date().toISOString();
    const linkageId = `link_${caseId}_${experimentId}_rev`;

    // Evitar duplicados
    if (this.data.linkages.has(linkageId)) return;

    const linkage: LinkageRecord = {
      linkageId,
      decisionCaseId: caseId,
      experimentId,
      direction: 'REVERSE',
      createdAt: ahora,
      reason,
    };

    this.data.linkages.set(linkageId, linkage);

    // Indexar relaciones
    if (!this.data.casesByExperiment.has(experimentId)) {
      this.data.casesByExperiment.set(experimentId, new Set());
    }
    this.data.casesByExperiment.get(experimentId)!.add(caseId);

    // Actualizar referencias
    const expRef = this.data.experiments.get(experimentId);
    if (expRef && !expRef.relatedCaseIds.includes(caseId)) {
      expRef.relatedCaseIds.push(caseId);
      expRef.updatedAt = ahora;
    }

    this.data.updatedAt = ahora;
    this.guardar();
  }

  /** Obtiene todos los Experiments de un DecisionCase. */
  obtenerExperimentosPorCase(caseId: string): ExperimentRef[] {
    const expIds = this.data.experimentsByCase.get(caseId) || new Set();
    return Array.from(expIds)
      .map((id) => this.data.experiments.get(id)!)
      .filter((e) => e !== undefined);
  }

  /** Obtiene todos los DecisionCases de un Experiment. */
  obtenerCasesPorExperimento(experimentId: string): DecisionCaseRef[] {
    const caseIds = this.data.casesByExperiment.get(experimentId) || new Set();
    return Array.from(caseIds)
      .map((id) => this.data.cases.get(id)!)
      .filter((c) => c !== undefined);
  }

  /** Obtiene un DecisionCase. */
  obtenerCase(caseId: string): DecisionCaseRef | undefined {
    return this.data.cases.get(caseId);
  }

  /** Obtiene un Experiment. */
  obtenerExperimento(experimentId: string): ExperimentRef | undefined {
    return this.data.experiments.get(experimentId);
  }

  /** Verifica si existe vínculo. */
  existeVinculo(caseId: string, experimentId: string): boolean {
    const linkageId = `link_${caseId}_${experimentId}`;
    return this.data.linkages.has(linkageId);
  }

  /** Obtiene estado. */
  obtenerEstado() {
    return {
      totalCases: this.data.cases.size,
      totalExperiments: this.data.experiments.size,
      totalLinkages: this.data.linkages.size,
      caseConExperimentos: Array.from(this.data.experimentsByCase.keys()).length,
      experimentConCases: Array.from(this.data.casesByExperiment.keys()).length,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
    };
  }

  /** Guarda en disco (atómico). */
  private guardar(): void {
    const datos = {
      linkageId: this.data.linkageId,
      version: this.data.version,
      cases: Array.from(this.data.cases.values()),
      experiments: Array.from(this.data.experiments.values()),
      linkages: Array.from(this.data.linkages.values()),
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

      if (Array.isArray(datos.cases)) {
        for (const c of datos.cases) {
          this.data.cases.set(c.caseId, c);
        }
      }

      if (Array.isArray(datos.experiments)) {
        for (const e of datos.experiments) {
          this.data.experiments.set(e.runId, e);
        }
      }

      if (Array.isArray(datos.linkages)) {
        for (const l of datos.linkages) {
          this.data.linkages.set(l.linkageId, l);

          // Reconstruir índices
          if (l.direction === 'FORWARD' || l.direction === 'BIDIRECTIONAL') {
            if (!this.data.experimentsByCase.has(l.decisionCaseId)) {
              this.data.experimentsByCase.set(l.decisionCaseId, new Set());
            }
            this.data.experimentsByCase.get(l.decisionCaseId)!.add(l.experimentId);
          }

          if (l.direction === 'REVERSE' || l.direction === 'BIDIRECTIONAL') {
            if (!this.data.casesByExperiment.has(l.experimentId)) {
              this.data.casesByExperiment.set(l.experimentId, new Set());
            }
            this.data.casesByExperiment.get(l.experimentId)!.add(l.decisionCaseId);
          }
        }
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Singleton global. */
let linkerGlobal: DecisionExperimentLinker | null = null;

export function inicializarDEL(rutaPersistencia?: string): DecisionExperimentLinker {
  linkerGlobal = new DecisionExperimentLinker(rutaPersistencia);
  return linkerGlobal;
}

export function obtenerDEL(): DecisionExperimentLinker | null {
  return linkerGlobal;
}

export function asignarDEL(linker: DecisionExperimentLinker | null): void {
  linkerGlobal = linker;
}
