/**
 * Scheduler para operación Forex 24/5.
 * Decide si permitir ciclos de mercado en vivo o solo históricos.
 * Usa UTC internamente; no depende de timezone local.
 */

export type MarketWindow = 'ACTIVE' | 'WEEKEND_CLOSED';
export type HolidayCalendar = 'NOT_IMPLEMENTED';

export interface EstadoSchedulerForex {
  marketWindow: MarketWindow;
  historicalTasksAllowed: boolean;
  realtimeTasksAllowed: boolean;
  currentUtc: string; // ISO 8601
  nextTransitionUtc: string | null; // ISO 8601
  holidayCalendar: HolidayCalendar;
}

export class ForexScheduler {
  private activoIntervalMs: number = 60_000; // 60s en mercado activo
  private historicoIntervalMs: number = 120_000; // 120s en modo histórico

  constructor(activoIntervalMs?: number, historicoIntervalMs?: number) {
    if (activoIntervalMs !== undefined) {
      if (activoIntervalMs <= 0 || activoIntervalMs > 3600_000)
        throw new Error('Intervalo activo debe estar entre 0ms y 1 hora.');
      this.activoIntervalMs = activoIntervalMs;
    }
    if (historicoIntervalMs !== undefined) {
      if (historicoIntervalMs <= 0 || historicoIntervalMs > 3600_000)
        throw new Error('Intervalo histórico debe estar entre 0ms y 1 hora.');
      this.historicoIntervalMs = historicoIntervalMs;
    }
  }

  /**
   * Obtiene el estado actual del scheduler.
   * Si `fechaOverride` es pasada (para tests), usa esa fecha en lugar de ahora.
   */
  obtenerEstado(fechaOverride?: Date): EstadoSchedulerForex {
    const ahora = fechaOverride || new Date();
    const diaUtc = ahora.getUTCDay(); // 0=domingo, 1=lunes, ..., 6=sábado
    const marketWindow = this.esMercadoActivo(diaUtc);

    return {
      marketWindow,
      historicalTasksAllowed: true, // Siempre se pueden ejecutar tareas históricas
      realtimeTasksAllowed: marketWindow === 'ACTIVE',
      currentUtc: ahora.toISOString(),
      nextTransitionUtc: this.calcularProximaTransicion(ahora),
      holidayCalendar: 'NOT_IMPLEMENTED',
    };
  }

  /**
   * Determina si es mercado activo (lunes-viernes UTC).
   * 0 = domingo (CERRADO)
   * 1-5 = lunes-viernes (ACTIVO)
   * 6 = sábado (CERRADO)
   */
  private esMercadoActivo(diaUtc: number): MarketWindow {
    return diaUtc >= 1 && diaUtc <= 5 ? 'ACTIVE' : 'WEEKEND_CLOSED';
  }

  /**
   * Calcula la próxima transición de ventana de mercado.
   * Lunes 00:00 UTC: Abre
   * Viernes 23:59 UTC: Cierra (sábado 00:00)
   * Domingo 00:00 UTC: Abre (lunes 00:00)
   */
  private calcularProximaTransicion(ahora: Date): string | null {
    const diaUtc = ahora.getUTCDay();

    // Calcular medianoche UTC del próximo día
    const proximosDias = new Date(ahora);
    proximosDias.setUTCDate(proximosDias.getUTCDate() + 1);
    proximosDias.setUTCHours(0, 0, 0, 0);

    // Si hoy es lunes-viernes y mañana es fin de semana: transición CIERRE
    if (diaUtc >= 1 && diaUtc <= 5) {
      const mañanaUtc = new Date(ahora);
      mañanaUtc.setUTCDate(mañanaUtc.getUTCDate() + 1);
      const diaManana = mañanaUtc.getUTCDay();

      if (diaManana === 6 || diaManana === 0) {
        // Mañana es sábado o domingo: cierre
        return proximosDias.toISOString();
      }

      // Mañana es otro día de semana: sin transición inmediata
      return null;
    }

    // Si hoy es fin de semana, próxima transición es lunes
    if (diaUtc === 6) {
      // Hoy es sábado, lunes es en 2 días
      const lunes = new Date(ahora);
      lunes.setUTCDate(lunes.getUTCDate() + 2);
      lunes.setUTCHours(0, 0, 0, 0);
      return lunes.toISOString();
    }

    if (diaUtc === 0) {
      // Hoy es domingo, mañana es lunes
      const lunes = new Date(ahora);
      lunes.setUTCDate(lunes.getUTCDate() + 1);
      lunes.setUTCHours(0, 0, 0, 0);
      return lunes.toISOString();
    }

    return null;
  }

  /**
   * Obtiene el intervalo recomendado en ms según el estado de mercado.
   */
  obtenerIntervaloRecomendado(estado: EstadoSchedulerForex): number {
    return estado.realtimeTasksAllowed ? this.activoIntervalMs : this.historicoIntervalMs;
  }
}

/** Singleton global del scheduler. */
let schedulerGlobal: ForexScheduler | null = null;

export function inicializarScheduler(activoIntervalMs?: number, historicoIntervalMs?: number): ForexScheduler {
  schedulerGlobal = new ForexScheduler(activoIntervalMs, historicoIntervalMs);
  return schedulerGlobal;
}

export function obtenerScheduler(): ForexScheduler | null {
  return schedulerGlobal;
}

export function asignarScheduler(scheduler: ForexScheduler | null): void {
  schedulerGlobal = scheduler;
}
