/** Historical Dataset Contract — Ready to receive verified historical data.
 *
 * PHASE 3A: Infrastructure only.
 * NO data populated until external verification complete.
 * NO fixture fallback.
 */

import { createHash } from 'node:crypto';
import type { SerieHistorica, VelaHistorica } from './tipos.ts';

/** Canonical dataset identity + provenance. */
export interface HistoricalDataset {
  // Identity
  datasetId: string; // Canonical ID (hash-based if needed)
  version: number; // Incremented on content change

  // Source metadata
  sourceType: 'LOCAL_HISTORICAL' | 'MT5_DEMO' | 'EXTERNAL_HISTORICAL';
  sourceName: string; // e.g., "EURUSD_1d_local", "MT5_DEMO_account123"

  // Market parameters
  instrument: string; // e.g., "EURUSD"
  timeframe: string; // e.g., "1d", "H1"

  // Temporal range
  startDate: string; // ISO 8601 UTC
  endDate: string; // ISO 8601 UTC
  barCount: number;

  // Timezone
  timezone: string; // IANA timezone (e.g., "UTC", "America/New_York")

  // Provenance
  retrievedAt: string; // ISO 8601 UTC — when was this data fetched?

  // Content verification
  contentHash: string; // SHA256 of OHLC data (stable identifier)
  fileSize?: number; // Bytes, if stored

  // Status gate
  status: 'UNVERIFIED' | 'VERIFIED' | 'STALE' | 'ERROR';

  // Metadata
  description?: string;
  source_metadata?: Record<string, unknown>; // Provider-specific metadata
}

/** Version-aware dataset identifier (prevents accidental reuse). */
export interface DatasetVersion {
  datasetId: string;
  version: number;
  contentHash: string;
  createdAt: string;
}

/** Data quality report (computed on load). */
export interface DataQualityReport {
  barCount: number;

  // OHLC validation
  validOHLC: number;
  invalidOHLC: number;

  // Timestamp validation
  validTimestamps: number;
  duplicateTimestamps: number;
  outOfOrder: number;
  gaps: GapReport[];

  // Value validation
  nonFiniteValues: number;
  unreasonablePriceMovement: number; // >10% in single bar

  // Coverage
  expectedBars: number; // Based on timeframe + date range
  actualBars: number;
  coverage: number; // Percentage

  // Status
  isValid: boolean; // All critical checks pass
  warnings: string[];
}

/** Detected gap in timestamp sequence. */
export interface GapReport {
  gapStartDate: string; // ISO 8601 UTC
  gapEndDate: string; // ISO 8601 UTC
  missedBars: number;
  reason?: string; // e.g., "weekend", "session_closed", "unknown"
}

/** Content hash verification (deterministic). */
export function computeDatasetHash(velas: VelaHistorica[]): string {
  const canonical = velas
    .map(v => `${v.timestamp}|${v.open}|${v.high}|${v.low}|${v.close}|${v.volumen}`)
    .join('\n');

  return createHash('sha256').update(canonical).digest('hex');
}

/** Dataset repository — prevents duplication, tracks versions. */
export class DatasetRepository {
  private datasets: Map<string, HistoricalDataset> = new Map();
  private versions: Map<string, DatasetVersion[]> = new Map(); // datasetId → versions

  /** Register a new dataset. Reuse if hash matches existing. */
  registerDataset(
    sourceName: string,
    instrument: string,
    timeframe: string,
    startDate: string,
    endDate: string,
    contentHash: string,
    sourceType: 'LOCAL_HISTORICAL' | 'MT5_DEMO' | 'EXTERNAL_HISTORICAL',
    barCount: number,
    timezone: string = 'UTC',
  ): { dataset: HistoricalDataset; isNew: boolean } {

    // Canonical ID: hash of source + instrument + timeframe + date range
    const idBase = `${sourceType}:${instrument}:${timeframe}:${startDate}:${endDate}`;
    const datasetId = createHash('sha256')
      .update(idBase)
      .digest('hex')
      .slice(0, 16); // Short form

    // Check if already exists
    if (this.datasets.has(datasetId)) {
      const existing = this.datasets.get(datasetId)!;

      // If content matches, reuse with version unchanged
      if (existing.contentHash === contentHash) {
        return { dataset: existing, isNew: false };
      }

      // Content changed → new version
      existing.version += 1;
      existing.contentHash = contentHash;
      existing.status = 'VERIFIED'; // Reset status when content updates
      existing.retrievedAt = new Date().toISOString();

      const versionRecord: DatasetVersion = {
        datasetId,
        version: existing.version,
        contentHash,
        createdAt: existing.retrievedAt,
      };

      if (!this.versions.has(datasetId)) {
        this.versions.set(datasetId, []);
      }
      this.versions.get(datasetId)!.push(versionRecord);

      return { dataset: existing, isNew: false };
    }

    // New dataset
    const dataset: HistoricalDataset = {
      datasetId,
      version: 1,
      sourceType,
      sourceName,
      instrument,
      timeframe,
      startDate,
      endDate,
      barCount,
      timezone,
      retrievedAt: new Date().toISOString(),
      contentHash,
      status: 'UNVERIFIED',
    };

    this.datasets.set(datasetId, dataset);
    this.versions.set(datasetId, [
      {
        datasetId,
        version: 1,
        contentHash,
        createdAt: dataset.retrievedAt,
      },
    ]);

    return { dataset, isNew: true };
  }

  /** Get dataset by ID. */
  getDataset(datasetId: string): HistoricalDataset | null {
    return this.datasets.get(datasetId) || null;
  }

  /** Get all versions of a dataset. */
  getVersions(datasetId: string): DatasetVersion[] {
    return this.versions.get(datasetId) || [];
  }

  /** List all datasets. */
  listDatasets(): HistoricalDataset[] {
    return Array.from(this.datasets.values());
  }

  /** Mark dataset as verified (after quality checks). */
  markVerified(datasetId: string): void {
    const dataset = this.datasets.get(datasetId);
    if (dataset) {
      dataset.status = 'VERIFIED';
    }
  }

  /** Mark dataset as stale (needs refresh). */
  markStale(datasetId: string, reason: string): void {
    const dataset = this.datasets.get(datasetId);
    if (dataset) {
      dataset.status = 'STALE';
      dataset.description = `Stale: ${reason}`;
    }
  }

  /** Export for persistence. */
  export(): Record<string, HistoricalDataset> {
    const result: Record<string, HistoricalDataset> = {};
    this.datasets.forEach((ds, id) => {
      result[id] = ds;
    });
    return result;
  }

  /** Import from persistence. */
  import(data: Record<string, HistoricalDataset>): void {
    Object.entries(data).forEach(([id, ds]) => {
      this.datasets.set(id, ds);

      // Rebuild versions from import
      if (!this.versions.has(id)) {
        this.versions.set(id, []);
      }
      this.versions.get(id)!.push({
        datasetId: id,
        version: ds.version,
        contentHash: ds.contentHash,
        createdAt: ds.retrievedAt,
      });
    });
  }
}

/** Singleton instance. */
let _repositoryInstance: DatasetRepository | null = null;

export function inicializarDatasetRepository(): DatasetRepository {
  if (!_repositoryInstance) {
    _repositoryInstance = new DatasetRepository();
  }
  return _repositoryInstance;
}

export function obtenerDatasetRepository(): DatasetRepository {
  if (!_repositoryInstance) {
    throw new Error('DatasetRepository not initialized. Call inicializarDatasetRepository() first.');
  }
  return _repositoryInstance;
}

export function asignarDatasetRepository(repo: DatasetRepository | null): void {
  _repositoryInstance = repo;
}
