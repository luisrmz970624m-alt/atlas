import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkHistoricalReadiness,
  requireHistoricalReady,
} from '../src/trading-lab/historical-readiness-gate.ts';
import {
  asignarDatasetRepository,
  inicializarDatasetRepository,
} from '../src/trading-lab/historical-dataset.ts';
import {
  asignarMT5Adapter,
  inicializarMT5Adapter,
} from '../src/trading-lab/mt5-historical-adapter.ts';

// ========== PHASE 3B: NO FIXTURE FALLBACK ==========

test('phase3b: historical unavailable blocks backtest (no fixture fallback)', () => {
  // Reset repos
  asignarDatasetRepository(null);
  asignarMT5Adapter(null);
  inicializarDatasetRepository();
  inicializarMT5Adapter();

  // Try to execute historical backtest
  let blockedException: Error | null = null;
  try {
    requireHistoricalReady();
  } catch (e) {
    blockedException = e as Error;
  }

  // MUST fail, not silently use TEST_FIXTURE
  assert.ok(blockedException, 'Should throw if historical not ready');
  assert.ok(
    blockedException!.message.includes('not ready'),
    'Error should explain data is not ready'
  );

  console.log('PHASE3B_NO_FALLBACK_TEST:', {
    blocked: true,
    blockReason: blockedException!.message.split('\n')[0],
    fallbackToFixture: false,
  });
});

test('phase3b: readiness status is correct (no data)', () => {
  asignarDatasetRepository(null);
  asignarMT5Adapter(null);
  inicializarDatasetRepository();
  inicializarMT5Adapter();

  const readiness = checkHistoricalReadiness();

  assert.equal(readiness.readyToUseHistorical, false);
  assert.ok(
    /^(INFRASTRUCTURE_READY_NO_DATA|NOT_READY_NO_DATA)$/.test(readiness.status),
    'Status should indicate no data, not fallback'
  );

  console.log('PHASE3B_READINESS_NO_DATA:', {
    status: readiness.status,
    readyToUseHistorical: false,
    blockedReason: readiness.blockedReason,
  });
});

test('phase3b: test fixture is available but separate', () => {
  asignarDatasetRepository(null);
  asignarMT5Adapter(null);
  inicializarDatasetRepository();
  inicializarMT5Adapter();

  const readiness = checkHistoricalReadiness();

  // TEST_FIXTURE is available as control/baseline
  assert.equal(readiness.hasTestFixture, true, 'TEST_FIXTURE should be available');

  // But NOT as historical evidence
  assert.equal(readiness.readyToUseHistorical, false, 'TEST_FIXTURE is not historical evidence');

  console.log('PHASE3B_FIXTURE_SEPARATION:', {
    testFixtureAvailable: readiness.hasTestFixture,
    isHistoricalEvidence: readiness.readyToUseHistorical,
    separated: true,
  });
});

test('phase3b: final status: WAITING_FOR_HISTORICAL_DATASET', () => {
  asignarDatasetRepository(null);
  asignarMT5Adapter(null);
  inicializarDatasetRepository();
  inicializarMT5Adapter();

  const readiness = checkHistoricalReadiness();
  const status = readiness.readyToUseHistorical ? 'READY' : 'WAITING_FOR_HISTORICAL_DATASET';

  assert.equal(status, 'WAITING_FOR_HISTORICAL_DATASET');

  console.log('PHASE3B_FINAL_STATUS:', {
    status,
    reason: 'No historical data found in project',
    nextAction: 'Supply CSV or verify MT5 DEMO connection',
  });
});
