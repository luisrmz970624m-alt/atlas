/** CSV Historical Data Loader — Local CSV to HistoricalDataset.
 *
 * PHASE 3A: Contract only, no CSV files expected yet.
 * Provides interface for future data import.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { VelaHistorica, SerieHistorica } from './tipos.ts';
import type { HistoricalDataset, DataQualityReport } from './historical-dataset.ts';
import { computeDatasetHash } from './historical-dataset.ts';

export interface CSVProvenance {
  filePath: string;
  fileSize: number; // Bytes
  mimeType: string; // e.g., "text/csv"
  encoding: string; // e.g., "utf-8"
  loadedAt: string; // ISO 8601 UTC
  lineCount: number; // Total lines (including header)
  headerFormat: string; // Column format detected
}

export interface CSVLoaderConfig {
  // Expected column names (support multiple formats)
  dateColumn: string; // "date", "Date", "timestamp"
  openColumn: string; // "open", "Open"
  highColumn: string; // "high", "High"
  lowColumn: string; // "low", "Low"
  closeColumn: string; // "close", "Close"
  volumeColumn?: string; // "volume", "Volume" (optional)

  // Parsing
  delimiter: string; // "," or ";" or "\t"
  hasHeader: boolean; // First line is column names?
  dateFormat: string; // "YYYY-MM-DD" or "ISO8601" etc.
  timezone: string; // IANA timezone of input dates

  // Validation
  minBars: number; // Reject if fewer bars
  maxBars: number; // Reject if more bars (sanity check)
}

/** Default CSV format (OANDA style). */
export const DEFAULT_CSV_CONFIG: CSVLoaderConfig = {
  dateColumn: 'Date',
  openColumn: 'Open',
  highColumn: 'High',
  lowColumn: 'Low',
  closeColumn: 'Close',
  volumeColumn: 'Volume',
  delimiter: ',',
  hasHeader: true,
  dateFormat: 'YYYY-MM-DD',
  timezone: 'UTC',
  minBars: 10,
  maxBars: 100000,
};

/** Sync CSV loader — canonical single path for all CSV loading. */
export function loadCSVHistoricalSync(
  filePath: string,
  config: CSVLoaderConfig = DEFAULT_CSV_CONFIG,
): { serie: SerieHistorica; provenance: CSVProvenance } | { error: string } {
  return _loadCSVImpl(filePath, config);
}

/** Async wrapper kept for backward compatibility. */
export async function loadCSVHistorical(
  filePath: string,
  config: CSVLoaderConfig = DEFAULT_CSV_CONFIG,
): Promise<{ serie: SerieHistorica; provenance: CSVProvenance } | { error: string }> {
  return _loadCSVImpl(filePath, config);
}

function _loadCSVImpl(
  filePath: string,
  config: CSVLoaderConfig,
): { serie: SerieHistorica; provenance: CSVProvenance } | { error: string } {
  const resolvedPath = resolve(filePath);

  try {
    const content = readFileSync(resolvedPath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      return { error: 'CSV file has fewer than 2 lines (header + data)' };
    }

    const headerLine = lines[0];
    const headers = headerLine.split(config.delimiter).map(h => h.trim());

    const dateIdx = headers.findIndex(h => h === config.dateColumn);
    const openIdx = headers.findIndex(h => h === config.openColumn);
    const highIdx = headers.findIndex(h => h === config.highColumn);
    const lowIdx = headers.findIndex(h => h === config.lowColumn);
    const closeIdx = headers.findIndex(h => h === config.closeColumn);
    const volumeIdx = config.volumeColumn
      ? headers.findIndex(h => h === config.volumeColumn)
      : -1;

    if (dateIdx < 0 || openIdx < 0 || highIdx < 0 || lowIdx < 0 || closeIdx < 0) {
      return { error: `CSV missing required columns. Found: ${headers.join(', ')}` };
    }

    const velas: VelaHistorica[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = line.split(config.delimiter).map(f => f.trim());

      const timestamp = fields[dateIdx];
      const open = parseFloat(fields[openIdx]);
      const high = parseFloat(fields[highIdx]);
      const low = parseFloat(fields[lowIdx]);
      const close = parseFloat(fields[closeIdx]);
      const volume = volumeIdx >= 0 ? parseFloat(fields[volumeIdx]) : 0;

      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { error: `Row ${i + 1}: Non-finite price values` };
      }

      velas.push({
        fecha: timestamp,
        apertura: open,
        maximo: high,
        minimo: low,
        cierre: close,
        volumen: volume,
      });
    }

    if (velas.length < config.minBars) {
      return { error: `CSV has ${velas.length} bars, expected at least ${config.minBars}` };
    }
    if (velas.length > config.maxBars) {
      return { error: `CSV has ${velas.length} bars, exceeds maximum ${config.maxBars}` };
    }

    const simbolo = extractSymbolFromPath(filePath);
    const intervalo = extractTimeframeFromPath(filePath) || '1d';
    const serie: SerieHistorica = {
      id: `${simbolo}_${intervalo}_CSV`,
      simbolo,
      intervalo,
      origen: `CSV:${resolvedPath}`,
      velas,
    };

    const provenance: CSVProvenance = {
      filePath: resolvedPath,
      fileSize: content.length,
      mimeType: 'text/csv',
      encoding: 'utf-8',
      loadedAt: new Date().toISOString(),
      lineCount: lines.length,
      headerFormat: config.dateColumn + '|' + config.openColumn + '|' + config.highColumn + '|' + config.lowColumn + '|' + config.closeColumn,
    };

    return { serie, provenance };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to load CSV: ${message}` };
  }
}

/** Extract instrument symbol from filename (e.g., "EURUSD_1d.csv" → "EURUSD"). */
function extractSymbolFromPath(filePath: string): string {
  const filename = filePath.split('/').pop() || 'UNKNOWN';
  return filename.split('_')[0].split('.')[0].toUpperCase();
}

/** Extract timeframe from filename (e.g., "EURUSD_1d.csv" → "1d"). */
function extractTimeframeFromPath(filePath: string): string | null {
  const filename = filePath.split('/').pop() || '';
  const match = filename.match(/_(1m|5m|15m|1h|4h|1d|1w)\.csv/i);
  return match ? match[1].toLowerCase() : null;
}

/** Validate CSV quality (structure, not data). */
export function validateCSVStructure(filePath: string, config: CSVLoaderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    if (lines.length < 2) {
      errors.push('CSV has fewer than 2 lines');
    }

    if (config.hasHeader && lines.length > 0) {
      const header = lines[0];
      const columns = header.split(config.delimiter);

      const hasDateColumn = columns.some(c => c.trim() === config.dateColumn);
      const hasOpenColumn = columns.some(c => c.trim() === config.openColumn);

      if (!hasDateColumn) errors.push(`Missing required column: ${config.dateColumn}`);
      if (!hasOpenColumn) errors.push(`Missing required column: ${config.openColumn}`);
    }

  } catch (err) {
    errors.push(`Cannot read file: ${(err as Error).message}`);
  }

  return { valid: errors.length === 0, errors };
}
