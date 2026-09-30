import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { KnowledgeGraphEngine, RoutingQuery, RoutingResult, TraceabilityLog } from './knowledge-graph.ts';
import type { MemoryLayers } from './memory-layers.ts';

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'VOLATILE' | 'UNKNOWN';
export type ConfirmationGate = 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' | 'MIXED';
export type DecisionResult =
  | 'NO_HYPOTHESIS'
  | 'REJECTED'
  | 'INSUFFICIENT_DATA'
  | 'TEST_CANDIDATE'
  | 'PAPER_CANDIDATE';

export interface MarketContextAnalysis {
  instrument: string;
  timeframe: string;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS' | 'UNKNOWN';
  volatility: number; // 0-100
  liquidity: number; // 0-100
  session: string; // 'ASIAN', 'EUROPEAN', 'AMERICAN', 'OVERLAP'
  marketRegime: MarketRegime;
  observations: string[];
  timestamp: string;
}

export interface FundamentalAnalysis {
  instrument: string;
  factors: {
    rates: string | null;
    centralBanks: string[];
    inflation: string | null;
    employment: string | null;
    growth: string | null;
    yields: string | null;
    energy: string | null;
    geopolitics: string[];
    events: string[];
  };
  narrative: string;
  evidenceCount: number;
  sourcesUsed: string[];
  timestamp: string;
}

export interface TechnicalAnalysis {
  instrument: string;
  timeframe: string;
  marketStructure: string;
  trend: string;
  momentum: string;
  volatility: string;
  registeredIndicators: {
    name: string;
    value: number;
    signal: string;
  }[];
  observations: string[];
  timestamp: string;
}

export interface HistoricalAnalogue {
  analogueId: string;
  eventDescription: string;
  regimeAtTime: MarketRegime;
  marketReaction: string;
  outcome: string;
  confidenceScore: number;
  casesAvailable: number;
}

export interface AtlasExperienceAnalysis {
  instrument: string;
  backtestsAvailable: number;
  backtestWinRate: number | null;
  oosValidated: boolean;
  walkForwardScores: number[];
  paperTrades: number;
  paperWinRate: number | null;
  relevantExperiments: string[];
  observations: string[];
  timestamp: string;
}

export interface TradingCriticAnalysis {
  hypothesisClear: boolean;
  evidenceSufficient: boolean;
  riskCompliant: boolean;
  overflowRisk: string | null;
  dataRecency: string;
  sourceReliability: string;
  contradictions: string[];
  flaggedRisks: string[];
  questions: string[];
  verdict: string;
  timestamp: string;
}

export interface ConfirmationGates {
  gate1_signal: { passed: boolean; reason: string; timestamp: string };
  gate2_evidence: { passed: boolean; reason: string; timestamp: string };
  gate3_risk: { passed: boolean; reason: string; timestamp: string };
  overallResult: ConfirmationGate;
}

export interface DecisionCase {
  caseId: string;
  timestamp: string;
  instrument: string;
  timeframe: string;
  phase1: MarketContextAnalysis | null;
  phase2: FundamentalAnalysis | null;
  phase3: TechnicalAnalysis | null;
  phase4: HistoricalAnalogue[] | null;
  phase5: AtlasExperienceAnalysis | null;
  phase6: TradingCriticAnalysis | null;
  confirmations: ConfirmationGates | null;
  result: DecisionResult;
  reasoning: string;
  knowledgeNodes?: string[];
  documentRefs?: string[];
  /** Referencias recuperadas, no contenido materializado ni métricas inferidas. */
  cognitiveEvidence?: CognitiveEvidence;
}

export interface CognitiveEvidence {
  query: RoutingQuery;
  selectedNodeIds: string[];
  documentRefs: string[];
  chunkRefs: string[];
  experimentRefs: string[];
  memoryEntryRefs: string[];
  traceability: TraceabilityLog[];
}

export interface CognitiveReasoningRequest {
  instrument: string;
  timeframe: string;
  query?: string;
  intent?: string;
  entities?: string[];
  requestedTask?: string;
  market?: Parameters<TradingReasoningEngine['analizarContextoMercado']>[0];
  technical?: Omit<Parameters<TradingReasoningEngine['analizarTecnico']>[0], 'instrument' | 'timeframe'>;
  /** El llamador puede declarar un límite del modo simulado; por defecto no hay incumplimiento. */
  riskCompliant?: boolean;
}

/** Motor de razonamiento de trading con 6 fases. */
export class TradingReasoningEngine {
  private rutaPersistencia: string = 'datos/decision-cases.json';
  private cases: Map<string, DecisionCase> = new Map();
  private cognitive: { graph: KnowledgeGraphEngine; memory?: MemoryLayers } | null = null;

  constructor(rutaPersistencia?: string) {
    if (rutaPersistencia) this.rutaPersistencia = rutaPersistencia;
    this.cargar();
  }

  /** Conecta el retrieval local existente; no usa transporte HTTP ni crea otro motor. */
  conectarRetrievalCognitivo(graph: KnowledgeGraphEngine, memory?: MemoryLayers): void {
    this.cognitive = { graph, memory };
  }

  /**
   * Ejecuta el pipeline local: contexto -> técnico -> retrieval -> memoria de
   * experimentos -> crítico -> gates. Las referencias permanecen referencias.
   */
  razonarConRetrievalCognitivo(opciones: CognitiveReasoningRequest): DecisionCase {
    if (!this.cognitive) throw new Error('Retrieval cognitivo no conectado');
    const phase1 = this.analizarContextoMercado({
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      ...(opciones.market ?? {}),
    });
    const phase3 = this.analizarTecnico({
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      ...(opciones.technical ?? {}),
    });
    const query: RoutingQuery = {
      query: opciones.query,
      intent: opciones.intent,
      entities: opciones.entities,
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      domain: 'TRADING',
      requestedTask: opciones.requestedTask,
    };
    const retrieved = this.cognitive.graph.rutear(query);
    const evidence = this.evidenciaCognitiva(query, retrieved);
    const phase5 = this.consultarExperienciaAtlas({ instrument: opciones.instrument });
    phase5.relevantExperiments = evidence.experimentRefs;
    phase5.observations = evidence.experimentRefs.length
      ? ['Experimentos recuperados por referencia']
      : ['No hay experimentos recuperados'];

    const hypothesisClear = this.hipotesisEstructurada(phase3);
    const evidenceSufficient = this.evidenciaSuficiente(evidence);
    const riskCompliant = opciones.riskCompliant ?? true;
    const phase6 = this.aplicarCritico({ hypothesisClear, evidenceSufficient, riskCompliant });
    const confirmations = this.aplicarConfirmations({ hypothesisClear, evidenceSufficient, riskCompliant });
    return this.generarDecisionCase({
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      phase1,
      phase3,
      phase5,
      phase6,
      confirmations,
      cognitiveEvidence: evidence,
    });
  }

  private evidenciaCognitiva(query: RoutingQuery, retrieved: RoutingResult): CognitiveEvidence {
    const experimentRefs = retrieved.selectedExperiments;
    const memoryEntryRefs = this.cognitive?.memory
      ?.obtenerExperimentos()
      .filter((entry) => experimentRefs.includes(entry.experimentRef.runId))
      .map((entry) => entry.entryId) ?? [];
    return {
      query,
      selectedNodeIds: retrieved.selectedNodeIds,
      documentRefs: retrieved.selectedDocuments,
      chunkRefs: retrieved.selectedChunks,
      experimentRefs,
      memoryEntryRefs,
      traceability: retrieved.traceability,
    };
  }

  private evidenciaSuficiente(evidence: CognitiveEvidence): boolean {
    return evidence.selectedNodeIds.length > 0 &&
      (evidence.documentRefs.length > 0 || evidence.chunkRefs.length > 0 || evidence.experimentRefs.length > 0);
  }

  private hipotesisEstructurada(technical: TechnicalAnalysis): boolean {
    return technical.marketStructure !== 'UNKNOWN' || technical.trend !== 'UNKNOWN' || technical.registeredIndicators.length > 0;
  }

  /** FASE 1: Analiza contexto de mercado. */
  analizarContextoMercado(opciones: {
    instrument: string;
    timeframe: string;
    trend?: 'UP' | 'DOWN' | 'SIDEWAYS' | 'UNKNOWN';
    volatility?: number;
    liquidity?: number;
    session?: string;
  }): MarketContextAnalysis {
    const regime = this.detectarRegimen(opciones.trend, opciones.volatility);

    return {
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      trend: opciones.trend || 'UNKNOWN',
      volatility: opciones.volatility || 50,
      liquidity: opciones.liquidity || 50,
      session: opciones.session || 'UNKNOWN',
      marketRegime: regime,
      observations: [
        `Trend: ${opciones.trend || 'UNKNOWN'}`,
        `Volatility: ${opciones.volatility || 50}`,
        `Liquidity: ${opciones.liquidity || 50}`,
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /** FASE 2: Analiza fundamentales. */
  analizarFundamental(opciones: {
    instrument: string;
    factors: {
      rates?: string | null;
      centralBanks?: string[];
      inflation?: string | null;
      employment?: string | null;
      growth?: string | null;
      yields?: string | null;
      energy?: string | null;
      geopolitics?: string[];
      events?: string[];
    };
  }): FundamentalAnalysis {
    const factors = {
      rates: opciones.factors?.rates || null,
      centralBanks: opciones.factors?.centralBanks || [],
      inflation: opciones.factors?.inflation || null,
      employment: opciones.factors?.employment || null,
      growth: opciones.factors?.growth || null,
      yields: opciones.factors?.yields || null,
      energy: opciones.factors?.energy || null,
      geopolitics: opciones.factors?.geopolitics || [],
      events: opciones.factors?.events || [],
    };

    const evidenceCount = Object.values(factors).filter((v) => v && v.length > 0).length;

    return {
      instrument: opciones.instrument,
      factors,
      narrative: `Análisis fundamental de ${opciones.instrument}`,
      evidenceCount,
      sourcesUsed: [],
      timestamp: new Date().toISOString(),
    };
  }

  /** FASE 3: Analiza técnico. */
  analizarTecnico(opciones: {
    instrument: string;
    timeframe: string;
    marketStructure?: string;
    trend?: string;
    momentum?: string;
    volatility?: string;
    indicators?: { name: string; value: number; signal: string }[];
  }): TechnicalAnalysis {
    return {
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      marketStructure: opciones.marketStructure || 'UNKNOWN',
      trend: opciones.trend || 'UNKNOWN',
      momentum: opciones.momentum || 'NEUTRAL',
      volatility: opciones.volatility || 'MODERATE',
      registeredIndicators: opciones.indicators || [],
      observations: ['Análisis técnico realizado'],
      timestamp: new Date().toISOString(),
    };
  }

  /** FASE 4: Busca análogos históricos. */
  buscarAnalogoHistorico(opciones: {
    regime: MarketRegime;
    casesAvailable: number;
  }): HistoricalAnalogue | null {
    if (opciones.casesAvailable === 0) {
      return null;
    }

    return {
      analogueId: `analogue_${Date.now()}`,
      eventDescription: `Evento similar en régimen ${opciones.regime}`,
      regimeAtTime: opciones.regime,
      marketReaction: 'DOCUMENTED',
      outcome: 'HISTORICAL_RECORD',
      confidenceScore: Math.min((opciones.casesAvailable / 5) * 100, 100),
      casesAvailable: opciones.casesAvailable,
    };
  }

  /** FASE 5: Consulta experiencia de Atlas. */
  consultarExperienciaAtlas(opciones: {
    instrument: string;
    backtestWinRate?: number | null;
    oosValidated?: boolean;
    walkForwardScores?: number[];
    paperWinRate?: number | null;
  }): AtlasExperienceAnalysis {
    return {
      instrument: opciones.instrument,
      backtestsAvailable: opciones.backtestWinRate !== null ? 1 : 0,
      backtestWinRate: opciones.backtestWinRate || null,
      oosValidated: opciones.oosValidated || false,
      walkForwardScores: opciones.walkForwardScores || [],
      paperTrades: opciones.paperWinRate !== null ? 1 : 0,
      paperWinRate: opciones.paperWinRate || null,
      relevantExperiments: [],
      observations: [`Experiencia disponible: ${opciones.backtestWinRate !== null ? 'Sí' : 'No'}`],
      timestamp: new Date().toISOString(),
    };
  }

  /** FASE 6: Crítico de trading. */
  aplicarCritico(opciones: {
    hypothesisClear: boolean;
    evidenceSufficient: boolean;
    riskCompliant: boolean;
    dataRecency?: string;
    sourceReliability?: string;
    contradictions?: string[];
    flaggedRisks?: string[];
  }): TradingCriticAnalysis {
    const preguntas = [];
    if (!opciones.hypothesisClear) preguntas.push('¿Está claramente definida la hipótesis?');
    if (!opciones.evidenceSufficient) preguntas.push('¿Existe suficiente evidencia?');
    if (!opciones.riskCompliant) preguntas.push('¿Cumple reglas de riesgo?');

    return {
      hypothesisClear: opciones.hypothesisClear,
      evidenceSufficient: opciones.evidenceSufficient,
      riskCompliant: opciones.riskCompliant,
      overflowRisk: null,
      dataRecency: opciones.dataRecency || 'UNKNOWN',
      sourceReliability: opciones.sourceReliability || 'UNKNOWN',
      contradictions: opciones.contradictions || [],
      flaggedRisks: opciones.flaggedRisks || [],
      questions: preguntas,
      verdict: this.generarVerdictoCritico(opciones),
      timestamp: new Date().toISOString(),
    };
  }

  /** Genera veredicto del crítico. */
  private generarVerdictoCritico(opciones: {
    hypothesisClear: boolean;
    evidenceSufficient: boolean;
    riskCompliant: boolean;
  }): string {
    if (!opciones.hypothesisClear) {
      return 'Rechazado: hipótesis no clara';
    }
    if (!opciones.evidenceSufficient) {
      return 'Insuficiente evidencia';
    }
    if (!opciones.riskCompliant) {
      return 'Incumplimiento de riesgo';
    }
    return 'Aprobado por crítico';
  }

  /** Aplica confirmation gates. */
  aplicarConfirmations(opciones: {
    hypothesisClear: boolean;
    evidenceSufficient: boolean;
    riskCompliant: boolean;
  }): ConfirmationGates {
    const ahora = new Date().toISOString();

    const gate1 = {
      passed: opciones.hypothesisClear,
      reason: opciones.hypothesisClear ? 'Hipótesis clara' : 'Hipótesis indefinida',
      timestamp: ahora,
    };

    const gate2 = {
      passed: opciones.evidenceSufficient,
      reason: opciones.evidenceSufficient ? 'Evidencia presente' : 'Evidencia insuficiente',
      timestamp: ahora,
    };

    const gate3 = {
      passed: opciones.riskCompliant,
      reason: opciones.riskCompliant ? 'Riesgo controlado' : 'Riesgo excesivo',
      timestamp: ahora,
    };

    const allPassed = gate1.passed && gate2.passed && gate3.passed;
    const overallResult: ConfirmationGate = allPassed ? 'PASS' : gate2.passed ? 'MIXED' : 'FAIL';

    return {
      gate1_signal: gate1,
      gate2_evidence: gate2,
      gate3_risk: gate3,
      overallResult,
    };
  }

  /** Completa análisis y genera DecisionCase. */
  generarDecisionCase(opciones: {
    instrument: string;
    timeframe: string;
    phase1?: MarketContextAnalysis;
    phase2?: FundamentalAnalysis;
    phase3?: TechnicalAnalysis;
    phase4?: HistoricalAnalogue[];
    phase5?: AtlasExperienceAnalysis;
    phase6?: TradingCriticAnalysis;
    confirmations?: ConfirmationGates;
    cognitiveEvidence?: CognitiveEvidence;
  }): DecisionCase {
    const caseId = `case_${randomUUID()}`;
    const ahora = new Date().toISOString();

    // Determinar resultado
    let result: DecisionResult = 'NO_HYPOTHESIS';

    if (!opciones.phase1) {
      result = 'INSUFFICIENT_DATA';
    } else if (opciones.cognitiveEvidence && !this.evidenciaSuficiente(opciones.cognitiveEvidence)) {
      result = 'INSUFFICIENT_DATA';
    } else if (opciones.cognitiveEvidence && (!opciones.phase3 || !this.hipotesisEstructurada(opciones.phase3))) {
      result = 'NO_HYPOTHESIS';
    } else if (opciones.confirmations?.overallResult === 'PASS') {
      result = opciones.phase5?.oosValidated ? 'TEST_CANDIDATE' : 'PAPER_CANDIDATE';
    } else if (opciones.confirmations?.overallResult === 'FAIL') {
      result = 'REJECTED';
    } else {
      result = 'INSUFFICIENT_DATA';
    }

    const decisionCase: DecisionCase = {
      caseId,
      timestamp: ahora,
      instrument: opciones.instrument,
      timeframe: opciones.timeframe,
      phase1: opciones.phase1 || null,
      phase2: opciones.phase2 || null,
      phase3: opciones.phase3 || null,
      phase4: opciones.phase4 || null,
      phase5: opciones.phase5 || null,
      phase6: opciones.phase6 || null,
      confirmations: opciones.confirmations || null,
      result,
      reasoning: this.generarRazonamiento(result, opciones),
      knowledgeNodes: opciones.cognitiveEvidence?.selectedNodeIds,
      documentRefs: opciones.cognitiveEvidence?.documentRefs,
      cognitiveEvidence: opciones.cognitiveEvidence,
    };

    this.cases.set(caseId, decisionCase);
    this.guardar();

    return decisionCase;
  }

  /** Genera razonamiento del resultado. */
  private generarRazonamiento(
    result: DecisionResult,
    opciones: {
      phase1?: MarketContextAnalysis;
      phase2?: FundamentalAnalysis;
      confirmations?: ConfirmationGates;
    }
  ): string {
    switch (result) {
      case 'NO_HYPOTHESIS':
        return 'No se formó hipótesis clara';
      case 'REJECTED':
        return `Rechazado por ${opciones.confirmations?.gate1_signal.reason || 'fallo de gate'}`;
      case 'INSUFFICIENT_DATA':
        return 'Datos insuficientes para decisión';
      case 'TEST_CANDIDATE':
        return 'Candidato validado para testing en OOS/WF';
      case 'PAPER_CANDIDATE':
        return 'Candidato para trading de papel';
      default:
        return 'Sin razonamiento';
    }
  }

  /** Detección de régimen de mercado. */
  private detectarRegimen(trend?: string, volatility?: number): MarketRegime {
    if (!trend || trend === 'UNKNOWN') return 'UNKNOWN';

    const vol = volatility || 50;
    if (trend === 'UP' && vol < 40) return 'TRENDING_UP';
    if (trend === 'DOWN' && vol < 40) return 'TRENDING_DOWN';
    if (trend === 'SIDEWAYS') return 'RANGING';
    if (vol > 70) return 'VOLATILE';

    return 'UNKNOWN';
  }

  /** Obtiene un DecisionCase. */
  obtenerDecisionCase(caseId: string): DecisionCase | undefined {
    return this.cases.get(caseId);
  }

  /** Lista DecisionCases por instrumento. */
  listarPorInstrumento(instrument: string): DecisionCase[] {
    return Array.from(this.cases.values()).filter((c) => c.instrument === instrument);
  }

  /** Obtiene estado del motor. */
  obtenerEstado() {
    const casos = Array.from(this.cases.values());
    const resultadosCuenta = {
      NO_HYPOTHESIS: casos.filter((c) => c.result === 'NO_HYPOTHESIS').length,
      REJECTED: casos.filter((c) => c.result === 'REJECTED').length,
      INSUFFICIENT_DATA: casos.filter((c) => c.result === 'INSUFFICIENT_DATA').length,
      TEST_CANDIDATE: casos.filter((c) => c.result === 'TEST_CANDIDATE').length,
      PAPER_CANDIDATE: casos.filter((c) => c.result === 'PAPER_CANDIDATE').length,
    };

    return {
      totalCases: casos.length,
      resultados: resultadosCuenta,
      casosRecientes: casos.slice(-10).map((c) => ({ caseId: c.caseId, result: c.result })),
    };
  }

  /** Guarda en disco (atómico). */
  private guardar(): void {
    const datos = {
      cases: Array.from(this.cases.values()),
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
          this.cases.set(c.caseId, c);
        }
      }
    } catch {
      // Archivo corrupto, comenzar vacío
    }
  }
}

/** Singleton global. */
let treGlobal: TradingReasoningEngine | null = null;

export function inicializarTRE(rutaPersistencia?: string): TradingReasoningEngine {
  treGlobal = new TradingReasoningEngine(rutaPersistencia);
  return treGlobal;
}

export function obtenerTRE(): TradingReasoningEngine | null {
  return treGlobal;
}

export function asignarTRE(tre: TradingReasoningEngine | null): void {
  treGlobal = tre;
}
