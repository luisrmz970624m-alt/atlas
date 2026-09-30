/** MT5 Historical Data Adapter — Contract for future MT5 data integration.
 *
 * PHASE 3A: Interface only.
 * Status: NOT_CONNECTED until real MT5 connection is verified.
 */

import type { SerieHistorica } from './tipos.ts';
import type { HistoricalDataset, DataQualityReport } from './historical-dataset.ts';

/** MT5 connection status (read-only gate). */
export type MT5ConnectionStatus =
  | 'NOT_CONNECTED'      // Default — no connection attempted
  | 'CONNECTING'         // Attempting connection
  | 'CONNECTED_DEMO'     // Successfully connected to demo account
  | 'CONNECTED_REAL'     // ERROR — real account detected, blocked
  | 'CONNECTION_FAILED'  // Error connecting
  | 'UNVERIFIED';        // Connection status unknown

/** MT5 historical data request. */
export interface MT5HistoricalRequest {
  symbol: string; // e.g., "EURUSD"
  timeframe: string; // e.g., "D1", "H1"
  startDate: string; // ISO 8601 UTC
  endDate: string; // ISO 8601 UTC
  limit?: number; // Max bars to fetch
}

/** MT5 historical data response. */
export interface MT5HistoricalResponse {
  symbol: string;
  timeframe: string;
  bars: Array<{
    time: number; // Unix timestamp (milliseconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  fetchedAt: string; // ISO 8601 UTC
}

/** MT5 provenance metadata. */
export interface MT5Provenance {
  accountName: string;
  accountType: 'DEMO' | 'REAL'; // Always DEMO for our use
  serverName: string;
  connectionTime: string; // ISO 8601 UTC
  lastFetchTime?: string; // ISO 8601 UTC
  dataLatency: string; // e.g., "1d", "realtime"
  symbol: string;
  timeframe: string;
}

/** Adapter contract (not implemented yet). */
export interface IMT5HistoricalAdapter {
  // Connection management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): MT5ConnectionStatus;

  // Data fetching
  fetchHistorical(request: MT5HistoricalRequest): Promise<MT5HistoricalResponse>;
  fetchHistoricalSerie(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
  ): Promise<SerieHistorica>;

  // Verification
  verifyDemoAccount(): Promise<boolean>;
  validateAccountType(): Promise<{ isDemoAccount: boolean; reason?: string }>;

  // Metadata
  getProvenance(): MT5Provenance | null;
  getLastError(): string | null;
}

/** MT5 Adapter Stub — Returns NOT_CONNECTED status. */
export class MT5HistoricalAdapterStub implements IMT5HistoricalAdapter {
  private status: MT5ConnectionStatus = 'NOT_CONNECTED';
  private lastError: string | null = null;

  async connect(): Promise<boolean> {
    this.lastError = 'MT5 connection not implemented in Phase 3A. Use verified local/external data.';
    this.status = 'NOT_CONNECTED';
    return false;
  }

  async disconnect(): Promise<void> {
    this.status = 'NOT_CONNECTED';
  }

  isConnected(): boolean {
    return false;
  }

  getStatus(): MT5ConnectionStatus {
    return this.status;
  }

  async fetchHistorical(request: MT5HistoricalRequest): Promise<MT5HistoricalResponse> {
    throw new Error('MT5HistoricalAdapter not connected. Status: NOT_CONNECTED');
  }

  async fetchHistoricalSerie(
    symbol: string,
    timeframe: string,
    startDate: string,
    endDate: string,
  ): Promise<SerieHistorica> {
    throw new Error(`MT5 historical fetch not available. Symbol: ${symbol}, Timeframe: ${timeframe}`);
  }

  async verifyDemoAccount(): Promise<boolean> {
    this.lastError = 'No MT5 connection. Status: NOT_CONNECTED';
    return false;
  }

  async validateAccountType(): Promise<{ isDemoAccount: boolean; reason?: string }> {
    return {
      isDemoAccount: false,
      reason: 'MT5 not connected',
    };
  }

  getProvenance(): MT5Provenance | null {
    return null;
  }

  getLastError(): string | null {
    return this.lastError;
  }
}

/** Singleton instance. */
let _adapterInstance: IMT5HistoricalAdapter | null = null;

export function inicializarMT5Adapter(): IMT5HistoricalAdapter {
  if (!_adapterInstance) {
    _adapterInstance = new MT5HistoricalAdapterStub(); // Default stub
  }
  return _adapterInstance;
}

export function obtenerMT5Adapter(): IMT5HistoricalAdapter {
  if (!_adapterInstance) {
    throw new Error('MT5Adapter not initialized. Call inicializarMT5Adapter() first.');
  }
  return _adapterInstance;
}

export function asignarMT5Adapter(adapter: IMT5HistoricalAdapter | null): void {
  _adapterInstance = adapter;
}
