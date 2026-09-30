import { randomUUID } from 'node:crypto';

export type IndicatorPipelineStage =
  | 'SPECIFICATION'
  | 'UNIT_TEST'
  | 'DATA_CHECK'
  | 'BACKTEST'
  | 'OOS'
  | 'WALK_FORWARD'
  | 'REGIME_TEST'
  | 'ROBUSTNESS'
  | 'PAPER'
  | 'EVALUATION';

export type StageStatus = 'NOT_RUN' | 'RUNNING' | 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'ERROR';
export type PipelineResult = 'REJECTED' | 'INSUFFICIENT_DATA' | 'RESEARCH_CANDIDATE' | 'TEST_CANDIDATE' | 'PAPER_CANDIDATE' | 'VALIDATED_FOR_SIMULATION';

export interface StageResult {
  stage: IndicatorPipelineStage;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  details?: Record<string, unknown>;
  reason?: string;
}

export interface IndicatorPipelineRun {
  pipelineRunId: string;
  indicatorId: string;
  indicatorVersion: string;
  implementationKey: string;
  instrument: string;
  timeframe: string;
  datasetId: string;
  datasetSource: 'TEST_FIXTURE' | 'LOCAL_DATA' | 'REAL_MARKET_DATA';
  createdAt: string;
  updatedAt: string;
  currentStage: IndicatorPipelineStage;
  stageResults: Map<IndicatorPipelineStage, StageResult>;
  experimentIds: string[];
  finalResult?: PipelineResult;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'HALTED';
}

/** Orquestador de pipeline de indicadores. */
export class IndicatorPipelineOrchestrator {
  private runs: Map<string, IndicatorPipelineRun> = new Map();

  /** Crea nuevo pipeline run. */
  crearRun(opciones: {
    indicatorId: string;
    indicatorVersion: string;
    implementationKey: string;
    instrument: string;
    timeframe: string;
    datasetId: string;
    datasetSource: 'TEST_FIXTURE' | 'LOCAL_DATA' | 'REAL_MARKET_DATA';
  }): IndicatorPipelineRun {
    const ahora = new Date().toISOString();
    const run: IndicatorPipelineRun = {
      pipelineRunId: `pipeline_${randomUUID().substring(0, 8)}`,
      indicatorId: opciones.indicatorId,
      indicatorVersion: opciones.indicatorVersion,
      implementationKey: opciones.implementationKey,
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      datasetId: opciones.datasetId,
      datasetSource: opciones.datasetSource,
      createdAt: ahora,
      updatedAt: ahora,
      currentStage: 'SPECIFICATION',
      stageResults: new Map(),
      experimentIds: [],
      status: 'RUNNING',
    };

    this.runs.set(run.pipelineRunId, run);
    return run;
  }

  /** Obtiene run por ID. */
  obtenerRun(pipelineRunId: string): IndicatorPipelineRun | undefined {
    return this.runs.get(pipelineRunId);
  }

  /** Avanza a siguiente stage. */
  avanzeStage(
    pipelineRunId: string,
    resultado: StageResult
  ): boolean {
    const run = this.runs.get(pipelineRunId);
    if (!run) return false;

    // Registrar resultado
    run.stageResults.set(resultado.stage, resultado);
    run.updatedAt = new Date().toISOString();

    // Verificar promotion rules
    if (resultado.status === 'FAIL') {
      run.status = 'HALTED';
      run.finalResult = 'REJECTED';
      return false;
    }

    if (resultado.status === 'ERROR') {
      run.status = 'FAILED';
      run.finalResult = 'REJECTED';
      return false;
    }

    if (resultado.status === 'INSUFFICIENT_DATA' && this.requiereDataParaAvanzar(resultado.stage)) {
      run.status = 'HALTED';
      run.finalResult = 'INSUFFICIENT_DATA';
      return false;
    }

    // Determinar siguiente stage
    const stages: IndicatorPipelineStage[] = [
      'SPECIFICATION',
      'UNIT_TEST',
      'DATA_CHECK',
      'BACKTEST',
      'OOS',
      'WALK_FORWARD',
      'REGIME_TEST',
      'ROBUSTNESS',
      'PAPER',
      'EVALUATION',
    ];

    const índiceActual = stages.indexOf(run.currentStage);
    if (índiceActual < stages.length - 1) {
      run.currentStage = stages[índiceActual + 1];
    } else {
      run.status = 'COMPLETED';
      run.finalResult = this.determinarResultado(run);
    }

    return true;
  }

  /** Reglas de promoción. */
  private requiereDataParaAvanzar(stage: IndicatorPipelineStage): boolean {
    return ['DATA_CHECK', 'BACKTEST', 'OOS'].includes(stage);
  }

  /** Determina resultado final basado en stages. */
  private determinarResultado(run: IndicatorPipelineRun): PipelineResult {
    const backtest = run.stageResults.get('BACKTEST');
    const oos = run.stageResults.get('OOS');
    const wf = run.stageResults.get('WALK_FORWARD');

    if (!backtest || backtest.status !== 'PASS') return 'REJECTED';
    if (!oos || oos.status !== 'PASS') return 'RESEARCH_CANDIDATE';
    if (!wf || wf.status !== 'PASS') return 'RESEARCH_CANDIDATE';

    const paper = run.stageResults.get('PAPER');
    if (!paper || paper.status !== 'PASS') return 'TEST_CANDIDATE';

    return 'PAPER_CANDIDATE';
  }

  /** Obtiene estado. */
  obtenerEstado() {
    return {
      totalRuns: this.runs.size,
      running: Array.from(this.runs.values()).filter((r) => r.status === 'RUNNING').length,
      completed: Array.from(this.runs.values()).filter((r) => r.status === 'COMPLETED').length,
      failed: Array.from(this.runs.values()).filter((r) => r.status === 'FAILED' || r.status === 'HALTED').length,
    };
  }
}

/** Resolución de implementation keys. */
export const IMPLEMENTATION_ALLOWLIST = {
  existing_ma_cross: {
    name: 'Moving Average Crossover (Legacy)',
    source: 'src/trading-lab/estrategias.ts',
    functions: ['media', 'crearCruceMedias', 'senalCruceMedias'],
  },
} as const;

export function resolverImplementation(key: string): typeof IMPLEMENTATION_ALLOWLIST[keyof typeof IMPLEMENTATION_ALLOWLIST] | null {
  return (IMPLEMENTATION_ALLOWLIST as Record<string, any>)[key] || null;
}
