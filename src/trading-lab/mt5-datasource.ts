import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import type { MT5ReadOnlyBridge, CuentaMT5 } from '../mt5-bridge/tipos.ts';
import type { SerieHistorica, VelaHistorica } from './tipos.ts';

export type EstadoFuenteMT5 = 'desconectado' | 'conectando' | 'conectado-demo' | 'bloqueado-real' | 'error';

export interface WatermarkMT5 {
  simbolo: string;
  timeframe: string;
  ultimoTimestamp: string; // ISO 8601 UTC
  actualizadoEn: string; // ISO 8601 UTC
}

/** Encapsula MT5 DEMO como fuente READ-ONLY de OHLC para el Backtest Lab. */
export class FuenteMT5DEMO {
  private bridge: MT5ReadOnlyBridge | null = null;
  private estado: EstadoFuenteMT5 = 'desconectado';
  private cuenta: CuentaMT5 | null = null;
  private simbolosMemoria: Map<string, { nombre: string; digitos: number }> = new Map();
  private watermarks: Map<string, WatermarkMT5> = new Map();
  private rutaWatermark: string = 'datos/mt5-watermarks.json';
  private ultimoError: string | null = null;
  private validacionPromise: Promise<void> | null = null;

  constructor(bridge?: MT5ReadOnlyBridge, rutaWatermark?: string) {
    if (rutaWatermark) this.rutaWatermark = rutaWatermark;
    this.leerWatermarks();
    if (bridge) {
      this.bridge = bridge;
    }
  }

  /** Valida que la cuenta sea DEMO (lazy, solo una vez). */
  private async asegurarValidado(): Promise<void> {
    if (this.validacionPromise) return this.validacionPromise;
    if (this.estado !== 'desconectado') return; // Ya fue validado

    this.validacionPromise = (async () => {
      if (!this.bridge) {
        this.estado = 'desconectado';
        return;
      }

      try {
        this.estado = 'conectando';
        this.cuenta = await this.bridge.cuenta();

        if (!this.cuenta.tipo.startsWith('DEMO')) {
          this.estado = 'bloqueado-real';
          this.ultimoError = `Cuenta MT5 rechazada: tipo '${this.cuenta.tipo}' no es DEMO. Real trading bloqueado.`;
          this.cuenta = null;
          return;
        }

        this.estado = 'conectado-demo';
        this.ultimoError = null;
      } catch (e) {
        this.estado = 'error';
        this.ultimoError = (e as Error).message;
        this.cuenta = null;
      }
    })();

    return this.validacionPromise;
  }

  async conectado(): Promise<boolean> {
    await this.asegurarValidado();
    return this.estado === 'conectado-demo' && this.bridge !== null && this.cuenta !== null;
  }

  obtenerEstado(): EstadoFuenteMT5 {
    return this.estado;
  }

  obtenerCuenta(): CuentaMT5 | null {
    return this.cuenta;
  }

  obtenerError(): string | null {
    return this.ultimoError;
  }

  /** Descubre símbolos disponibles en MT5 DEMO. */
  async simbolosDisponibles(): Promise<string[]> {
    await this.asegurarValidado();
    if (!(await this.conectado()) || !this.bridge) return [];
    try {
      const lista = await this.bridge.simbolos();
      for (const s of lista) {
        this.simbolosMemoria.set(s.nombre, s);
      }
      return lista.map((s) => s.nombre);
    } catch (e) {
      this.ultimoError = (e as Error).message;
      return [];
    }
  }

  /** Obtiene OHLC de MT5 DEMO para un período. Valida que la serie sea real, nunca fabrica. */
  async obtenerSerie(simbolo: string, desde: string, hasta: string, timeframe: string = '1d'): Promise<SerieHistorica | null> {
    await this.asegurarValidado();
    if (!(await this.conectado()) || !this.bridge) return null;
    try {
      const velas = await this.bridge.velas(simbolo, desde, hasta, 10_000);
      if (!velas.length) {
        this.ultimoError = `Sin velas para ${simbolo} en rango solicitado`;
        return null;
      }

      const velasProcesadas = velas.map((v) => ({
        fecha: new Date(v.fecha).toISOString(),
        apertura: v.apertura,
        maximo: v.maximo,
        minimo: v.minimo,
        cierre: v.cierre,
        volumen: v.volumen,
      }));

      if (velasProcesadas.length > 0) {
        const clave = `${simbolo}/${timeframe}`;
        const ultimoTs = velasProcesadas[velasProcesadas.length - 1].fecha;
        this.watermarks.set(clave, {
          simbolo,
          timeframe,
          ultimoTimestamp: ultimoTs,
          actualizadoEn: new Date().toISOString(),
        });
        this.guardarWatermarks();
      }

      return {
        id: `mt5-demo-${simbolo}`,
        simbolo: simbolo,
        intervalo: timeframe,
        origen: 'mt5-demo',
        velas: velasProcesadas,
      };
    } catch (e) {
      this.ultimoError = (e as Error).message;
      return null;
    }
  }

  /** Obtiene spread y precios actuales. Normaliza a UTC. */
  async tick(simbolo: string): Promise<{ bid: number; ask: number; spread: number; timestamp: string } | null> {
    await this.asegurarValidado();
    if (!(await this.conectado()) || !this.bridge) return null;
    try {
      const t = await this.bridge.tick(simbolo);
      const timestamp = new Date(t.fecha).toISOString();
      return {
        bid: t.bid,
        ask: t.ask,
        spread: t.ask - t.bid,
        timestamp,
      };
    } catch (e) {
      this.ultimoError = (e as Error).message;
      return null;
    }
  }

  /** Devuelve watermark del símbolo/timeframe, o null si no existe. */
  obtenerWatermark(simbolo: string, timeframe: string = '1d'): WatermarkMT5 | null {
    const clave = `${simbolo}/${timeframe}`;
    return this.watermarks.get(clave) || null;
  }

  /** Lee watermarks persistidos desde disco. */
  private leerWatermarks(): void {
    try {
      const contenido = readFileSync(this.rutaWatermark, 'utf-8');
      const data: WatermarkMT5[] = JSON.parse(contenido);
      for (const w of data) {
        const clave = `${w.simbolo}/${w.timeframe}`;
        this.watermarks.set(clave, w);
      }
    } catch {
      // No existe archivo o error de parseo; comenzar vacío
    }
  }

  /** Guarda watermarks en disco, atómicamente. */
  private guardarWatermarks(): void {
    try {
      mkdirSync(dirname(this.rutaWatermark), { recursive: true });
      const data = Array.from(this.watermarks.values());
      const temporal = `${this.rutaWatermark}.tmp`;
      writeFileSync(temporal, JSON.stringify(data, null, 2), 'utf-8');
      renameSync(temporal, this.rutaWatermark);
    } catch (e) {
      console.error(`Error guardando watermarks MT5: ${(e as Error).message}`);
    }
  }
}
