/** Historical Data Readiness Gate — Verifies infrastructure before using historical data.
 *
 * PHASE 3A: Prevents accidental use of TEST_FIXTURE as historical data.
 * Controls access to historical backtest, OOS, critic comparison.
 */

import { obtenerDatasetRepository } from './historical-dataset.ts';
import { obtenerMT5Adapter } from './mt5-historical-adapter.ts';
import type { HistoricalDataset } from './historical-dataset.ts';

export type HistoricalReadinessStatus =
  | 'READY'                           // At least one verified historical dataset available
  | 'PARTIALLY_READY'                 // Datasets exist but not verified
  | 'NOT_READY_NO_DATA'               // No datasets available
  | 'NOT_READY_MT5_NOT_VERIFIED'      // MT5 configured but not verified
  | 'INFRASTRUCTURE_READY_NO_DATA';   // Infrastructure built, awaiting first dataset

export interface HistoricalReadinessReport {
  status: HistoricalReadinessStatus;
  datasetCount: number;
  verifiedDatasets: number;
  unverifiedDatasets: number;
  mt5Connected: boolean;
  csvLoaderAvailable: boolean;
  hasTestFixture: boolean; // Always true (DIAGNOSTIC_MULTI_REGIME_V1)
  readyToUseHistorical: boolean;
  blockedReason?: string; // Why NOT_READY
  nextSteps: string[];
}

/** Check if historical data is ready for use. */
export function checkHistoricalReadiness(): HistoricalReadinessReport {
  const repo = obtenerDatasetRepository();
  const mt5 = obtenerMT5Adapter();

  const allDatasets = repo.listDatasets();
  const verifiedDatasets = allDatasets.filter(ds => ds.status === 'VERIFIED');
  const unverifiedDatasets = allDatasets.filter(ds => ds.status !== 'VERIFIED');

  const mt5Connected = mt5.isConnected();
  const mt5Status = mt5.getStatus();

  let status: HistoricalReadinessStatus;
  let blockedReason: string | undefined;
  let nextSteps: string[] = [];

  // Decision tree
  if (verifiedDatasets.length > 0) {
    // Historical data verified and ready
    status = 'READY';
    nextSteps = [
      'Phase 3 can now execute historical backtest',
      'Phase 3 can execute OOS with historical data',
      'Phase 3 can run historical critic comparison',
    ];
  } else if (unverifiedDatasets.length > 0) {
    // Datasets exist but not verified
    status = 'PARTIALLY_READY';
    blockedReason = `${unverifiedDatasets.length} datasets exist but not verified`;
    nextSteps = [
      'Run data quality checks on each dataset',
      'Verify provenance and content hashes',
      'Mark datasets as VERIFIED after quality passes',
    ];
  } else if (mt5Connected && mt5Status === 'CONNECTED_DEMO') {
    // MT5 connected but no cached data yet
    status = 'PARTIALLY_READY';
    blockedReason = 'MT5 connected but historical data not yet fetched';
    nextSteps = [
      'Fetch historical data from MT5 via MT5HistoricalAdapter',
      'Cache fetched data in DatasetRepository',
      'Verify cached data quality',
      'Mark dataset as VERIFIED',
    ];
  } else if (mt5Status === 'CONNECTING' || mt5Status === 'UNVERIFIED') {
    // MT5 in progress
    status = 'NOT_READY_MT5_NOT_VERIFIED';
    blockedReason = `MT5 status: ${mt5Status}`;
    nextSteps = [
      'Complete MT5 connection verification',
      'Confirm demo account is active',
      'Fetch historical bars once verified',
    ];
  } else {
    // No data available at all
    status = 'INFRASTRUCTURE_READY_NO_DATA';
    blockedReason = 'No historical datasets registered';
    nextSteps = [
      'Option 1: Load local CSV file via CSVHistoricalLoader',
      'Option 2: Connect and fetch from MT5 via MT5HistoricalAdapter',
      'Option 3: Configure external API (Polygon, Alpha Vantage, etc.)',
      'Register dataset with DatasetRepository',
      'Run data quality checks',
      'Mark as VERIFIED',
    ];
  }

  return {
    status,
    datasetCount: allDatasets.length,
    verifiedDatasets: verifiedDatasets.length,
    unverifiedDatasets: unverifiedDatasets.length,
    mt5Connected,
    csvLoaderAvailable: true, // Contract available even if no CSV files
    hasTestFixture: true, // Always available
    readyToUseHistorical: status === 'READY',
    blockedReason,
    nextSteps,
  };
}

/** Assertion: Fail if historical data not ready (for tests). */
export function requireHistoricalReady(): void {
  const report = checkHistoricalReadiness();

  if (!report.readyToUseHistorical) {
    throw new Error(
      `Historical data not ready. Status: ${report.status}\n` +
      `Reason: ${report.blockedReason}\n` +
      `Next steps:\n  ${report.nextSteps.join('\n  ')}`
    );
  }
}

/** Soft check: Warn but don't fail. */
export function logHistoricalReadiness(): void {
  const report = checkHistoricalReadiness();

  console.log('═════════════════════════════════════════');
  console.log('HISTORICAL DATA READINESS REPORT');
  console.log('═════════════════════════════════════════');
  console.log(`Status:                    ${report.status}`);
  console.log(`Datasets total:            ${report.datasetCount}`);
  console.log(`  - Verified:              ${report.verifiedDatasets}`);
  console.log(`  - Unverified:            ${report.unverifiedDatasets}`);
  console.log(`MT5 connected:             ${report.mt5Connected}`);
  console.log(`CSV loader available:      ${report.csvLoaderAvailable}`);
  console.log(`TEST_FIXTURE available:    ${report.hasTestFixture}`);
  console.log(`Ready to use historical:   ${report.readyToUseHistorical}`);

  if (report.blockedReason) {
    console.log(`Blocked reason:            ${report.blockedReason}`);
  }

  if (report.nextSteps.length > 0) {
    console.log('Next steps:');
    report.nextSteps.forEach(step => console.log(`  - ${step}`));
  }
  console.log('═════════════════════════════════════════');
}

/** Get a single dataset if ready, else null. */
export function getVerifiedHistoricalDataset(): HistoricalDataset | null {
  const report = checkHistoricalReadiness();

  if (!report.readyToUseHistorical) {
    return null;
  }

  const repo = obtenerDatasetRepository();
  const datasets = repo.listDatasets().filter(ds => ds.status === 'VERIFIED');

  return datasets.length > 0 ? datasets[0] : null;
}
