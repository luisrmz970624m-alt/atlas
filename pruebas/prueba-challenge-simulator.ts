import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateChallenge, type ChallengeContext } from '../src/trading-lab/challenge-simulator.ts';
import { createTestFixturePropFirm, type Program, type RuleSet } from '../src/trading-lab/prop-firm.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import { loadAndMapCSV, EURUSD_H1_BASELINE_CONFIG } from '../src/trading-lab/historical-baseline.ts';
import type { SerieHistorica, EstrategiaCruceMedias, ConfiguracionBacktest, ResultadoBacktest } from '../src/trading-lab/tipos.ts';

function getBaselineBacktest(): ResultadoBacktest {
  const velas = loadAndMapCSV(EURUSD_H1_BASELINE_CONFIG.csvPath);
  const serie: SerieHistorica = {
    id: 'EURUSD_H1_TEST',
    simbolo: 'EURUSD',
    intervalo: 'H1',
    origen: 'DUKASCOPY_BID_UTC',
    velas,
  };
  const estrategia: EstrategiaCruceMedias = {
    tipo: 'cruce_medias',
    id: 'MA_CROSS_BASELINE',
    version: 1,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  };
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.0001,
    spreadPorcentaje: 0.0001,
    slippagePorcentaje: 0.00005,
    maxRiesgoPorOperacion: 0.01,
    semilla: 42,
  };
  return ejecutarBacktest(serie, estrategia, config);
}

function getSingleTradeBacktest(entrada: string, salida: string, retornoNeto = 20): ResultadoBacktest {
  return {
    reproducible: true,
    estrategia: { tipo: 'cruce_medias', id: 'TEST', version: 1 },
    datos: { id: 'TEST', simbolo: 'EURUSD', intervalo: 'H1', origen: 'TEST', velas: 2 },
    semilla: 1,
    aprobado: true,
    reglasVioladas: [],
    operaciones: [{ entrada, salida, precioEntrada: 1, precioSalida: 1, cantidad: 1, pnlNeto: 20, comisiones: 0 }],
    metricas: { operaciones: 1, retornoNeto, profitFactor: 1, drawdownMaximo: 0, ratioRiesgoBeneficio: 1, exposicion: 1, comisiones: 0, benchmarkRetorno: 0 },
  };
}

describe('TASK 14: Prop Firm Challenge Simulator', () => {
  const firm = createTestFixturePropFirm();
  const program = firm.programs[0];

  it('evaluates baseline against test fixture program', () => {
    const bt = getBaselineBacktest();
    const ctx: ChallengeContext = { backtestInitialCapital: 10000 };
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', ctx);

    assert.ok(['PASS', 'FAIL', 'INCOMPLETE'].includes(eval_.result));
    assert.equal(eval_.programId, program.programId);
    assert.equal(eval_.ruleSetVersion, 1);
    assert.equal(eval_.sourceStatus, 'TEST_FIXTURE');
    assert.ok(typeof eval_.metrics.returnPct === 'number');
    assert.ok(typeof eval_.metrics.maxDrawdownPct === 'number');
    assert.ok(typeof eval_.metrics.tradingDays === 'number');
    assert.ok(eval_.metrics.tradeCount > 0);
    assert.equal(eval_.metrics.dailyLossBasis, 'REALIZED_PNL');
    assert.ok(eval_.accountNormalization.scaleFactor > 0);
    assert.ok(Array.isArray(eval_.dataLimitations));
  });

  it('baseline fails profit target (negative return)', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    assert.ok(['FAIL', 'INCOMPLETE'].includes(eval_.result));
    assert.ok(eval_.failureReasons.includes('PROFIT_TARGET_NOT_REACHED'));
  });

  it('reports MAX_DRAWDOWN_BREACH when drawdown exceeds limit', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    if (bt.metricas.drawdownMaximo > program.ruleSet.rules.maxLossLimitPct) {
      assert.ok(eval_.failureReasons.includes('MAX_DRAWDOWN_BREACH'));
    }
  });

  it('detects INCOMPATIBLE_MARKET', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FUTURES', 'ES', { backtestInitialCapital: 10000 });

    assert.equal(eval_.result, 'INCOMPATIBLE');
    assert.ok(eval_.failureReasons.includes('INCOMPATIBLE_MARKET'));
  });

  it('detects NOT_VERIFIED rules', () => {
    const bt = getBaselineBacktest();
    const unverifiedProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, sourceStatus: 'NOT_VERIFIED' },
    };
    const eval_ = evaluateChallenge(bt, unverifiedProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    assert.equal(eval_.result, 'NOT_VERIFIED');
    assert.ok(eval_.failureReasons.includes('RULE_NOT_VERIFIED'));
  });

  it('detects INSTRUMENT_NOT_ALLOWED', () => {
    const bt = getBaselineBacktest();
    const restrictedProgram: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, allowedInstruments: ['GBPUSD'] },
      },
    };
    const eval_ = evaluateChallenge(bt, restrictedProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    assert.ok(eval_.failureReasons.includes('INSTRUMENT_NOT_ALLOWED'));
  });

  it('failure reasons are specific and enumerated', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    const validReasons = [
      'DAILY_LOSS_BREACH', 'MAX_DRAWDOWN_BREACH', 'PROFIT_TARGET_NOT_REACHED',
      'MIN_DAYS_NOT_MET', 'MAX_DAYS_EXCEEDED', 'CONSISTENCY_RULE_BREACH',
      'INSTRUMENT_NOT_ALLOWED', 'INCOMPATIBLE_MARKET', 'RULE_NOT_VERIFIED',
      'BACKTEST_REJECTED', 'DAILY_LOSS_DATA_INSUFFICIENT',
      'TRAILING_DRAWDOWN_DATA_INSUFFICIENT', 'POSITION_LIMIT_DATA_INSUFFICIENT',
      'NEWS_RULE_DATA_INSUFFICIENT', 'RULESET_STALE',
      'CAPITAL_BASE_DATA_INSUFFICIENT',
      'OVERNIGHT_POSITION_BREACH', 'OVERNIGHT_DATA_INSUFFICIENT',
      'WEEKEND_POSITION_BREACH', 'WEEKEND_DATA_INSUFFICIENT',
    ];
    for (const reason of eval_.failureReasons) {
      assert.ok(validReasons.includes(reason), `Unknown failure reason: ${reason}`);
    }
  });

  it('metrics include all required fields', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });

    const m = eval_.metrics;
    assert.ok(typeof m.returnPct === 'number');
    assert.ok(typeof m.maxDrawdownPct === 'number');
    assert.ok(typeof m.dailyMaxLossPct === 'number');
    assert.ok(typeof m.tradingDays === 'number');
    assert.ok(typeof m.tradeCount === 'number');
    assert.ok(m.winRate === null || typeof m.winRate === 'number');
    assert.ok(m.profitFactor === null || typeof m.profitFactor === 'number');
    assert.ok(typeof m.maxDayProfitPct === 'number');
    assert.ok(m.consistencyOk === null || typeof m.consistencyOk === 'boolean');
  });

  it('no real trading in module', () => {
    const src = readFileSync('src/trading-lab/challenge-simulator.ts', 'utf-8');
    assert.ok(!src.includes('fetch('), 'No fetch calls');
    assert.ok(!src.includes('MT5'), 'No MT5 references');
    assert.ok(!src.includes('real_order'), 'No real order references');
  });

  it('STALE ruleset blocked at execution time', () => {
    const bt = getBaselineBacktest();
    const staleProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, sourceStatus: 'STALE' },
    };
    const eval_ = evaluateChallenge(bt, staleProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.equal(eval_.result, 'NOT_VERIFIED');
    assert.ok(eval_.failureReasons.includes('RULESET_STALE'));
    assert.ok(!eval_.failureReasons.includes('DAILY_LOSS_BREACH'));
  });

  it('scale factor 25k→100k = 4', () => {
    const bt = getBaselineBacktest();
    const prog100k: Program = { ...program, accountSize: 100000 };
    const eval_ = evaluateChallenge(bt, prog100k, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 25000 });
    assert.equal(eval_.accountNormalization.scaleFactor, 4);
    assert.equal(eval_.accountNormalization.backtestCapital, 25000);
    assert.equal(eval_.accountNormalization.programAccountSize, 100000);
  });

  it('missing initialCapital → INCOMPLETE', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD');
    assert.ok(eval_.failureReasons.includes('CAPITAL_BASE_DATA_INSUFFICIENT'));
    assert.ok(['FAIL', 'INCOMPLETE'].includes(eval_.result));
  });

  it('overnight disallowed + cross-day trade → breach', () => {
    const bt = getBaselineBacktest();
    const nightProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, overnightAllowed: false },
      },
    };
    const eval_ = evaluateChallenge(bt, nightProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    const hasBreach = eval_.failureReasons.includes('OVERNIGHT_POSITION_BREACH');
    const hasInsuff = eval_.failureReasons.includes('OVERNIGHT_DATA_INSUFFICIENT');
    assert.ok(hasBreach || hasInsuff, 'Must detect overnight issue on multi-day trades');
  });

  it('overnight allowed → no overnight breach', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(!eval_.failureReasons.includes('OVERNIGHT_POSITION_BREACH'));
    assert.ok(!eval_.failureReasons.includes('OVERNIGHT_DATA_INSUFFICIENT'));
  });

  it('weekend disallowed + weekend overlap → breach', () => {
    const bt = getBaselineBacktest();
    const weekendProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, weekendAllowed: false },
      },
    };
    const eval_ = evaluateChallenge(bt, weekendProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    const hasBreach = eval_.failureReasons.includes('WEEKEND_POSITION_BREACH');
    const hasInsuff = eval_.failureReasons.includes('WEEKEND_DATA_INSUFFICIENT');
    assert.ok(hasBreach || hasInsuff, 'Must detect weekend issue on long trades');
  });

  it('weekend allowed → no weekend breach', () => {
    const bt = getBaselineBacktest();
    const weekendOkProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, weekendAllowed: true },
      },
    };
    const eval_ = evaluateChallenge(bt, weekendOkProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(!eval_.failureReasons.includes('WEEKEND_POSITION_BREACH'));
  });

  it('news restriction no calendar → INCOMPLETE', () => {
    const bt = getBaselineBacktest();
    const newsProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, newsRestricted: true },
      },
    };
    const eval_ = evaluateChallenge(bt, newsProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(eval_.failureReasons.includes('NEWS_RULE_DATA_INSUFFICIENT'));
  });

  it('trailing drawdown insufficient → INCOMPLETE', () => {
    const bt = getBaselineBacktest();
    const trailingProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, drawdownType: 'TRAILING' },
      },
    };
    const eval_ = evaluateChallenge(bt, trailingProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(eval_.failureReasons.includes('TRAILING_DRAWDOWN_DATA_INSUFFICIENT'));
  });

  it('position limit insufficient → INCOMPLETE', () => {
    const bt = getBaselineBacktest();
    const posLimitProg: Program = {
      ...program,
      ruleSet: {
        ...program.ruleSet,
        rules: { ...program.ruleSet.rules, positionLimit: 5 },
      },
    };
    const eval_ = evaluateChallenge(bt, posLimitProg, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(eval_.failureReasons.includes('POSITION_LIMIT_DATA_INSUFFICIENT'));
  });

  it('fixture status remains TEST_FIXTURE', () => {
    const bt = getBaselineBacktest();
    const eval_ = evaluateChallenge(bt, program, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.equal(eval_.sourceStatus, 'TEST_FIXTURE');
  });

  it('no fake company rules', () => {
    const src = readFileSync('src/trading-lab/challenge-simulator.ts', 'utf-8').toLowerCase();
    for (const name of ['ftmo', 'topstep', 'apex', 'fundingpips']) {
      assert.ok(!src.includes(name), `Must not reference ${name}`);
    }
  });

  it('TASK 14.3: insufficient required data takes precedence over profit-target breach', () => {
    const insufficientProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, positionLimit: 1 } },
    };
    const eval_ = evaluateChallenge(
      getSingleTradeBacktest('2026-09-21T10:00:00Z', '2026-09-21T11:00:00Z', -1),
      insufficientProgram,
      'FOREX_SPOT',
      'EURUSD',
      { backtestInitialCapital: 10000 },
    );
    assert.equal(eval_.result, 'INCOMPLETE');
    assert.ok(eval_.failureReasons.includes('POSITION_LIMIT_DATA_INSUFFICIENT'));
    assert.ok(eval_.failureReasons.includes('PROFIT_TARGET_NOT_REACHED'));
  });

  it('TASK 14.3: invalid overnight entry timestamp is incomplete', () => {
    const nightProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, overnightAllowed: false } },
    };
    const eval_ = evaluateChallenge(getSingleTradeBacktest('not-a-timestamp', '2026-09-21T11:00:00Z'), nightProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.equal(eval_.result, 'INCOMPLETE');
    assert.ok(eval_.failureReasons.includes('OVERNIGHT_DATA_INSUFFICIENT'));
  });

  it('TASK 14.3: invalid overnight exit timestamp is incomplete', () => {
    const nightProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, overnightAllowed: false } },
    };
    const eval_ = evaluateChallenge(getSingleTradeBacktest('2026-09-21T10:00:00Z', 'not-a-timestamp'), nightProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.equal(eval_.result, 'INCOMPLETE');
    assert.ok(eval_.failureReasons.includes('OVERNIGHT_DATA_INSUFFICIENT'));
  });

  it('TASK 14.3: Friday 23:00 to Saturday 01:00 breaches a disallowed weekend', () => {
    const weekendProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, weekendAllowed: false } },
    };
    const eval_ = evaluateChallenge(getSingleTradeBacktest('2026-09-25T23:00:00Z', '2026-09-26T01:00:00Z'), weekendProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(eval_.failureReasons.includes('WEEKEND_POSITION_BREACH'));
  });

  it('TASK 14.3: Friday 23:00 to Saturday 01:00 is allowed when weekend trading is allowed', () => {
    const weekendProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, weekendAllowed: true } },
    };
    const eval_ = evaluateChallenge(getSingleTradeBacktest('2026-09-25T23:00:00Z', '2026-09-26T01:00:00Z'), weekendProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.ok(!eval_.failureReasons.includes('WEEKEND_POSITION_BREACH'));
  });

  it('TASK 14.3: invalid weekend timestamp is incomplete', () => {
    const weekendProgram: Program = {
      ...program,
      ruleSet: { ...program.ruleSet, rules: { ...program.ruleSet.rules, weekendAllowed: false } },
    };
    const eval_ = evaluateChallenge(getSingleTradeBacktest('not-a-timestamp', '2026-09-21T11:00:00Z'), weekendProgram, 'FOREX_SPOT', 'EURUSD', { backtestInitialCapital: 10000 });
    assert.equal(eval_.result, 'INCOMPLETE');
    assert.ok(eval_.failureReasons.includes('WEEKEND_DATA_INSUFFICIENT'));
  });
});
