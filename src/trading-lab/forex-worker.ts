import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { obtenerRepositorio } from './experimentos.ts';
import { ejecutarBacktest } from './backtest.ts';
import { ejecutarWalkForward, validarFueraMuestra } from './validacion.ts';
import { SERIE_PANEL, ESTRATEGIA_PANEL, SERIE_FOREX } from './panel-backtest.ts';
import { obtenerScheduler, inicializarScheduler } from './forex-scheduler.ts';
import type { SerieHistorica, EstrategiaDeclarativa, ConfiguracionBacktest } from './tipos.ts';
import type { FuenteMT5DEMO, WatermarkMT5 } from './mt5-datasource.ts';
import type { EstadoSchedulerForex } from './forex-scheduler.ts';

export type EstadoWorker = 'IDLE' | 'WAITING_DATA' | 'RUNNING_BACKTEST' | 'RUNNING_OOS' | 'RUNNING_WALK_FORWARD' | 'EVALUATING' | 'PAUSED' | 'OFFLINE' | 'ERROR';

export interface EstadoForexWorker {
  status: EstadoWorker;
  datasource: 'unavailable' | 'fixture-local' | 'mt5-demo' | 'forex-real';
  pair: string | null;
  timeframe: string | null;
  lastCycle: string | null;
  nextCycle: string | null;
  currentRunId: string | null;
  totalExperiments: number;
  lastClassification: string | null;
  oosEnabled: boolean;
  walkForwardEnabled: boolean;
  lastError: string | null;
  uptimeSeconds: number;
  marketWindow: string;
  realtimeTasksAllowed: boolean;
  historicalTasksAllowed: boolean;
  currentUtc: string;
  nextTransitionUtc: string | null;
  holidayCalendar: string;
}

export interface EstadoWorkerPersistido {
  pid: number;
  status: EstadoWorker;
  datasource: string;
  pair: string | null;
  timeframe: string | null;
  lastCycle: string | null;
  nextCycle: string | null;
  currentRunId: string | null;
  lastClassification: string | null;
  lastError: string | null;
  startedAt: string;
  updatedAt: string;
}

export class ForexWorker {
  private estado: EstadoWorker = 'OFFLINE';
  private datasource: 'unavailable' | 'fixture-local' | 'mt5-demo' | 'forex-real' = 'unavailable';
  private pair: string | null = null;
  private timeframe: string | null = null;
  private lastCycle: string | null = null;
  private nextCycle: string | null = null;
  private currentRunId: string | null = null;
  private lastError: string | null = null;
  private startedAt: Date = new Date();
  private intervalHandle: NodeJS.Timeout | null = null;
  private mt5Fuente: FuenteMT5DEMO | null = null;
  private intervalMs: number = 60_000;
  private rutaEstado: string = 'datos/forex-worker-status.json';
  private mt5Validado = false;
  private lastClassification: string | null = null;
  private watermark: WatermarkMT5 | null = null;

  constructor(intervalMs?: number, mt5Fuente?: FuenteMT5DEMO, rutaEstado?: string) {
    if (intervalMs) this.intervalMs = intervalMs;
    if (mt5Fuente) this.mt5Fuente = mt5Fuente;
    if (rutaEstado) this.rutaEstado = rutaEstado;

    this.estado = 'WAITING_DATA';
    // Sin MT5 → unavailable (NO fallback automático a fixture)
    // Fixture requiere opt-in explícito (futuro: ATLAS_FOREX_USE_FIXTURE flag)
    this.datasource = mt5Fuente ? 'mt5-demo' : 'unavailable';
    this.pair = null;
    this.timeframe = null;
  }

  /** Guarda estado actual en disco, atómicamente. */
  private guardarEstadoPersistido(): void {
    const estadoP: EstadoWorkerPersistido = {
      pid: process.pid,
      status: this.estado,
      datasource: this.datasource,
      pair: this.pair,
      timeframe: this.timeframe,
      lastCycle: this.lastCycle,
      nextCycle: this.nextCycle,
      currentRunId: this.currentRunId,
      lastClassification: this.lastClassification,
      lastError: this.lastError,
      startedAt: this.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mkdirSync(dirname(this.rutaEstado), { recursive: true });
    const temporal = `${this.rutaEstado}.tmp`;
    writeFileSync(temporal, JSON.stringify(estadoP, null, 2), 'utf8');
    renameSync(temporal, this.rutaEstado);
  }

  /** Lee estado persistido desde disco. */
  static leerEstadoPersistido(ruta: string = 'datos/forex-worker-status.json'): EstadoWorkerPersistido | null {
    if (!existsSync(ruta)) return null;
    try {
      return JSON.parse(readFileSync(ruta, 'utf8')) as EstadoWorkerPersistido;
    } catch {
      return null;
    }
  }

  /** Inicia el worker; cicla en intervalos. */
  start(): void {
    if (this.intervalHandle) return;

    this.estado = 'WAITING_DATA';
    this.lastError = null;

    // Primer ciclo inmediato, luego intervalo
    this.ejecutarCiclo().catch((e) => {
      this.lastError = (e as Error).message;
      this.estado = 'ERROR';
    });

    this.intervalHandle = setInterval(
      () => {
        this.ejecutarCiclo().catch((e) => {
          this.lastError = (e as Error).message;
          this.estado = 'ERROR';
        });
      },
      this.intervalMs
    );
  }

  /** Detiene el worker; limpio. */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.estado = 'OFFLINE';
  }

  /** Valida MT5 DEMO de forma lazy (solo una vez). */
  private async validarMT5(): Promise<void> {
    if (this.mt5Validado || !this.mt5Fuente) return;
    this.mt5Validado = true;

    const conectado = await this.mt5Fuente.conectado();
    if (!conectado) {
      this.datasource = 'unavailable';
      this.lastError = this.mt5Fuente.obtenerError() || 'MT5 DEMO no disponible';
      return;
    }

    const cuenta = this.mt5Fuente.obtenerCuenta();
    if (!cuenta || !cuenta.tipo.startsWith('DEMO')) {
      this.datasource = 'unavailable';
      this.lastError = 'Cuenta MT5 no es DEMO';
      return;
    }

    this.datasource = 'mt5-demo';
    this.pair = 'EURUSD'; // Por defecto, será configurable
    this.timeframe = '1d';
  }

  /** Un ciclo completo: backtest → OOS → walk-forward → evaluar → persistir. */
  private async ejecutarCiclo(): Promise<void> {
    if (this.estado === 'OFFLINE' || this.estado === 'PAUSED') return;

    try {
      this.estado = 'RUNNING_BACKTEST';
      this.lastCycle = new Date().toISOString();
      this.nextCycle = new Date(Date.now() + this.intervalMs).toISOString();

      // Validar MT5 lazy si no se ha hecho
      if (this.mt5Fuente && !this.mt5Validado) {
        await this.validarMT5();
      }

      // Cargar datos según datasource
      let serie: SerieHistorica | null = null;

      if (this.datasource === 'mt5-demo' && this.mt5Fuente) {
        // Cargar datos reales de MT5 DEMO
        const pair = this.pair || 'EURUSD';
        const timeframe = this.timeframe || '1d';
        const simbolos = await this.mt5Fuente.simbolosDisponibles();

        if (!simbolos.includes(pair)) {
          this.estado = 'WAITING_DATA';
          this.lastError = `Símbolo ${pair} no disponible en MT5 DEMO`;
          return;
        }

        // Calcular rango de barras (últimas 100 o 50 según timeframe)
        const ahoraUtc = new Date().toISOString();
        const hace100Dias = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

        serie = await this.mt5Fuente.obtenerSerie(pair, hace100Dias, ahoraUtc, timeframe);

        // Verificar watermark: si no hay vela nueva, no ejecutar
        if (serie) {
          const watermarkActual = this.mt5Fuente.obtenerWatermark(pair, timeframe);
          if (watermarkActual) {
            const ultimaVelaEnSerie = serie.velas[serie.velas.length - 1].fecha;
            if (ultimaVelaEnSerie <= watermarkActual.ultimoTimestamp) {
              // Sin vela nueva, esperar
              this.estado = 'IDLE';
              return;
            }
          }
          this.watermark = this.mt5Fuente.obtenerWatermark(pair, timeframe);
        }
      } else {
        // Usar fixture como fallback (solo si no hay MT5)
        serie = SERIE_PANEL;
      }

      if (!serie || serie.velas.length < 10) {
        this.estado = 'WAITING_DATA';
        return;
      }

      const config: ConfiguracionBacktest = {
        capitalInicial: 10000,
        comisionPorcentaje: 0.001,
        spreadPorcentaje: 0.002,
        slippagePorcentaje: 0.001,
        maxRiesgoPorOperacion: 0.02,
        semilla: 7,
      };

      // Backtest
      const resultadoBacktest = ejecutarBacktest(serie, ESTRATEGIA_PANEL, config);

      // OOS
      let resultadoOos = null;
      if (serie.velas.length >= 15) {
        this.estado = 'RUNNING_OOS';
        const oosResult = validarFueraMuestra(serie, ESTRATEGIA_PANEL, config, Math.floor(serie.velas.length * 0.7));
        resultadoOos = oosResult.validacion;
      }

      // Walk-forward
      let resultadosWF: any[] = [];
      if (serie.velas.length >= 20) {
        this.estado = 'RUNNING_WALK_FORWARD';
        const wfResult = ejecutarWalkForward(serie, ESTRATEGIA_PANEL, config, 8, 4);
        resultadosWF = wfResult.map((w) => w.validacion);
      }

      // Evaluar y persistir
      this.estado = 'EVALUATING';
      const repo = obtenerRepositorio();

      // Crear experimento
      const { crearExperimentoDesdeBacktest } = await import('./experimentos.ts');
      const experimento = crearExperimentoDesdeBacktest(
        serie,
        ESTRATEGIA_PANEL,
        resultadoBacktest,
        config.capitalInicial,
        config.comisionPorcentaje,
        resultadoOos || undefined,
        resultadosWF.length > 0 ? resultadosWF : undefined
      );

      repo.guardarExperimento(experimento);
      this.currentRunId = experimento.runId;
      this.lastClassification = experimento.classification;

      this.estado = 'IDLE';
      this.lastError = null;
    } catch (e) {
      this.estado = 'ERROR';
      this.lastError = (e as Error).message;
      throw e;
    } finally {
      // Persistir estado tras cada ciclo
      this.guardarEstadoPersistido();
    }
  }

  /** Obtiene estado actual (read-only). */
  obtenerEstado(): EstadoForexWorker {
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    const repo = obtenerRepositorio();
    const scheduler = obtenerScheduler() || inicializarScheduler();
    const estadoScheduler = scheduler.obtenerEstado();

    const pair = this.pair || (this.datasource === 'fixture-local' ? 'BTC-USD-FICTICIO' : null);
    const timeframe = this.timeframe || (this.datasource === 'unavailable' ? null : '1d');

    return {
      status: this.estado,
      datasource: this.datasource,
      pair: pair,
      timeframe: timeframe,
      lastCycle: this.lastCycle,
      nextCycle: this.nextCycle,
      currentRunId: this.currentRunId,
      totalExperiments: repo.contar(),
      lastClassification: this.lastClassification,
      oosEnabled: true,
      walkForwardEnabled: true,
      lastError: this.lastError,
      uptimeSeconds,
      marketWindow: estadoScheduler.marketWindow,
      realtimeTasksAllowed: estadoScheduler.realtimeTasksAllowed,
      historicalTasksAllowed: estadoScheduler.historicalTasksAllowed,
      currentUtc: estadoScheduler.currentUtc,
      nextTransitionUtc: estadoScheduler.nextTransitionUtc,
      holidayCalendar: estadoScheduler.holidayCalendar,
    };
  }

  /** Pausa el worker. */
  pausar(): void {
    this.estado = 'PAUSED';
  }

  /** Reanuda el worker. */
  reanudar(): void {
    if (this.estado === 'PAUSED') {
      this.estado = 'IDLE';
    }
  }

  /** Marca como OFFLINE y persiste antes de shutdown. */
  marcarOffline(): void {
    this.estado = 'OFFLINE';
    this.guardarEstadoPersistido();
  }
}

/** Singleton global del worker. */
let workerGlobal: ForexWorker | null = null;

export function inicializarWorker(intervalMs?: number, mt5Fuente?: FuenteMT5DEMO): ForexWorker {
  workerGlobal = new ForexWorker(intervalMs, mt5Fuente);
  return workerGlobal;
}

export function obtenerWorker(): ForexWorker | null {
  return workerGlobal;
}

export function asignarWorker(worker: ForexWorker | null): void {
  workerGlobal = worker;
}

export const leerEstadoPersistido = ForexWorker.leerEstadoPersistido;
