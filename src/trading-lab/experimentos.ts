import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ResultadoBacktest, SerieHistorica, EstrategiaDeclarativa } from './tipos.ts';
import type { EventoContextoMercado } from './contexto-mercado.ts';

/** Clasificación conservadora de experimentos; requiere evidencia clara. */
export type ClasificacionExperimento = 'CANDIDATE' | 'VALIDATED' | 'OVERFIT' | 'REJECTED' | 'INSUFFICIENT_DATA' | 'FAILED';

/** Resultado persistido de un experimento de trading; única fuente de verdad para histórico. */
export interface ExperimentoTrading {
  runId: string;
  createdAt: string;

  instrument: {
    symbol: string;
    source: string;
    sourceType: 'fixture-local' | 'mt5-demo' | 'forex-real';
  };

  timeframe: string;

  period: {
    from: string;
    to: string;
  };

  strategy: {
    id: string;
    version: number;
    type: string;
    parameters: Record<string, unknown>;
  };

  capital: {
    initialCapital: number;
    commissionPct: number;
  };

  results: {
    finalEquity: number;
    netPnl: number;
    returnPct: number;
    maxDrawdownPct: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number | null;
    profitFactor: number | null;
    commissions: number;
  };

  validation: {
    backtest: boolean;
    oos: boolean;
    walkForward: boolean;
    paper: boolean;
  };

  context?: {
    events: EventoContextoMercado[];
  };

  dataset?: {
    datasetId: string;
    sha256: string;
    source: string;
  };

  experimentType?: string;
  parameterSource?: string;
  costSource?: string;

  classification: ClasificacionExperimento;
}

export interface ColeccionExperimentos {
  version: number;
  experimentos: ExperimentoTrading[];
  ultimaActualizacion: string;
}

/** Identificador determinista para deduplicación; permite recuperarse de fallos sin crear duplicados. */
export function generarIdDeduplicacion(
  symbol: string,
  timeframe: string,
  period: { from: string; to: string },
  strategyId: string,
  strategyVersion: number,
  capital: number,
  commissionPct: number
): string {
  const componentes = [symbol, timeframe, period.from, period.to, strategyId, strategyVersion, capital, commissionPct].join('|');
  // Hash simple pero determinista; no es criptográfico, solo evita duplicados
  let hash = 0;
  for (let i = 0; i < componentes.length; i++) {
    const char = componentes.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // convert to 32-bit
  }
  return `${Math.abs(hash).toString(36)}-${Date.parse(period.from)}-${Date.parse(period.to)}`;
}

/** Clasifica conservadoramente solo si hay evidencia clara; usa INSUFFICIENT_DATA por defecto. */
export function clasificarExperimento(
  backtest: ResultadoBacktest,
  oos?: ResultadoBacktest,
  walkForward?: ResultadoBacktest[]
): ClasificacionExperimento {
  // FAILED: si el motor rechazó reglas
  if (!backtest.aprobado) return 'FAILED';

  // Necesitamos al menos backtest para CANDIDATE/VALIDATED
  const pnlBacktest = backtest.metricas.retornoNeto;

  // Si no hay OOS/WF, no hay evidencia de overfitting o validación
  if (!oos && (!walkForward || walkForward.length === 0)) {
    return 'INSUFFICIENT_DATA';
  }

  // Evidencia de OVERFIT: backtest ganador pero OOS perdedor
  if (oos) {
    const pnlOos = oos.metricas.retornoNeto;
    if (pnlBacktest > 5 && pnlOos < -5) {
      return 'OVERFIT';
    }
  }

  // Walk-forward inconsistente: muchas ventanas negativas
  if (walkForward && walkForward.length > 0) {
    const negativas = walkForward.filter((w) => w.metricas.retornoNeto < -5).length;
    if (negativas / walkForward.length > 0.5) {
      return 'OVERFIT';
    }
  }

  // Sin suficiente evidencia de bueno o malo: CANDIDATE
  return 'CANDIDATE';
}

export class RepositorioExperimentos {
  private ruta: string;

  constructor(ruta = 'datos/trading-experimentos.json') {
    this.ruta = ruta;
  }

  /** Carga colección actual desde disco; retorna vacía si no existe. */
  private cargar(): ColeccionExperimentos {
    if (!existsSync(this.ruta)) {
      return { version: 1, experimentos: [], ultimaActualizacion: new Date().toISOString() };
    }

    try {
      return JSON.parse(readFileSync(this.ruta, 'utf8')) as ColeccionExperimentos;
    } catch {
      // Archivo corrupto: mejor volver a empezar que perder todos los datos
      console.warn(`Archivo de experimentos corrupto: ${this.ruta}. Comenzando de cero.`);
      return { version: 1, experimentos: [], ultimaActualizacion: new Date().toISOString() };
    }
  }

  /** Guarda con escritura atómica: temporal → rename para evitar truncado en crash. */
  private guardar(coleccion: ColeccionExperimentos): void {
    mkdirSync(dirname(this.ruta), { recursive: true });

    const temporal = `${this.ruta}.tmp`;
    coleccion.ultimaActualizacion = new Date().toISOString();
    writeFileSync(temporal, JSON.stringify(coleccion, null, 2), 'utf8');
    renameSync(temporal, this.ruta);
  }

  /** Persiste experimento; si duplicado (mismo idDedup), reemplaza el anterior. */
  guardarExperimento(experimento: ExperimentoTrading): void {
    const idDedup = generarIdDeduplicacion(
      experimento.instrument.symbol,
      experimento.timeframe,
      experimento.period,
      experimento.strategy.id,
      experimento.strategy.version,
      experimento.capital.initialCapital,
      experimento.capital.commissionPct
    );

    const coleccion = this.cargar();

    // Busca duplicado por idDedup (no por runId)
    const indice = coleccion.experimentos.findIndex(
      (e) =>
        generarIdDeduplicacion(
          e.instrument.symbol,
          e.timeframe,
          e.period,
          e.strategy.id,
          e.strategy.version,
          e.capital.initialCapital,
          e.capital.commissionPct
        ) === idDedup
    );

    if (indice >= 0) {
      // Reemplaza el anterior; mantiene historial en runId/timestamp
      coleccion.experimentos[indice] = experimento;
    } else {
      // Nuevo experimento
      coleccion.experimentos.push(experimento);
    }

    this.guardar(coleccion);
  }

  /** Recupera por runId único. */
  obtenerExperimento(runId: string): ExperimentoTrading | null {
    const coleccion = this.cargar();
    return coleccion.experimentos.find((e) => e.runId === runId) ?? null;
  }

  /** Lista todos los experimentos, más recientes primero. */
  listarExperimentos(): ExperimentoTrading[] {
    const coleccion = this.cargar();
    return [...coleccion.experimentos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Comprueba si existe un experimento con idDedup dado. */
  existeExperimento(
    symbol: string,
    timeframe: string,
    period: { from: string; to: string },
    strategyId: string,
    strategyVersion: number,
    capital: number,
    commissionPct: number
  ): boolean {
    const idDedup = generarIdDeduplicacion(symbol, timeframe, period, strategyId, strategyVersion, capital, commissionPct);
    const coleccion = this.cargar();
    return coleccion.experimentos.some(
      (e) =>
        generarIdDeduplicacion(
          e.instrument.symbol,
          e.timeframe,
          e.period,
          e.strategy.id,
          e.strategy.version,
          e.capital.initialCapital,
          e.capital.commissionPct
        ) === idDedup
    );
  }

  /** Filtra experimentos por criterios. */
  filtrar(criterios: { symbol?: string; strategy?: string; classification?: ClasificacionExperimento }): ExperimentoTrading[] {
    const coleccion = this.cargar();
    return coleccion.experimentos.filter(
      (e) =>
        (!criterios.symbol || e.instrument.symbol === criterios.symbol) &&
        (!criterios.strategy || e.strategy.id === criterios.strategy) &&
        (!criterios.classification || e.classification === criterios.classification)
    );
  }

  /** Cuenta total de experimentos. */
  contar(): number {
    return this.cargar().experimentos.length;
  }

  /** Elimina todos los experimentos; solo para testing. */
  limpiar(): void {
    this.guardar({ version: 1, experimentos: [], ultimaActualizacion: new Date().toISOString() });
  }
}

/** Singleton global del repositorio. */
let repositorioGlobal: RepositorioExperimentos | null = null;

export function inicializarRepositorio(ruta?: string): RepositorioExperimentos {
  repositorioGlobal = new RepositorioExperimentos(ruta);
  return repositorioGlobal;
}

export function obtenerRepositorio(): RepositorioExperimentos {
  if (!repositorioGlobal) {
    repositorioGlobal = new RepositorioExperimentos();
  }
  return repositorioGlobal;
}

/** Factory para crear experimento desde backtester. */
export function crearExperimentoDesdeBacktest(
  serie: SerieHistorica,
  estrategia: EstrategiaDeclarativa,
  backtest: ResultadoBacktest,
  capital: number,
  comisionPct: number,
  oos?: ResultadoBacktest,
  walkForward?: ResultadoBacktest[],
  contexto?: EventoContextoMercado[]
): ExperimentoTrading {
  const m = backtest.metricas;

  return {
    runId: randomUUID(),
    createdAt: new Date().toISOString(),

    instrument: {
      symbol: serie.simbolo,
      source: serie.origen,
      sourceType: serie.origen === 'fixture-local' ? 'fixture-local' : serie.origen === 'mt5-demo' ? 'mt5-demo' : 'forex-real',
    },

    timeframe: serie.intervalo,

    period: {
      from: serie.velas[0]!.fecha,
      to: serie.velas.at(-1)!.fecha,
    },

    strategy: {
      id: estrategia.id,
      version: estrategia.version,
      type: estrategia.tipo,
      parameters: {
        mediaRapida: (estrategia as any).mediaRapida,
        mediaLenta: (estrategia as any).mediaLenta,
        riesgoPorOperacion: (estrategia as any).riesgoPorOperacion,
      },
    },

    capital: {
      initialCapital: capital,
      commissionPct: comisionPct,
    },

    results: {
      finalEquity: capital * (1 + m.retornoNeto / 100),
      netPnl: capital * (1 + m.retornoNeto / 100) - capital,
      returnPct: m.retornoNeto,
      maxDrawdownPct: m.drawdownMaximo,
      trades: m.operaciones,
      wins: backtest.operaciones.filter((o) => o.pnlNeto >= 0).length,
      losses: backtest.operaciones.filter((o) => o.pnlNeto < 0).length,
      winRate: m.operaciones > 0 ? (backtest.operaciones.filter((o) => o.pnlNeto >= 0).length / m.operaciones) * 100 : null,
      profitFactor: m.profitFactor,
      commissions: m.comisiones,
    },

    validation: {
      backtest: true,
      oos: !!oos,
      walkForward: !!walkForward && walkForward.length > 0,
      paper: false,
    },

    context: contexto ? { events: contexto } : undefined,

    classification: clasificarExperimento(backtest, oos, walkForward),
  };
}
