/** Prop Firm Challenge Simulator — TASK 14.
 * Consumes existing backtest results + RuleSet. NO new TradingEngine. NO real trading. */

import type { ResultadoBacktest, OperacionBacktest } from './tipos.ts';
import type { Program, MarketType } from './prop-firm.ts';
import { checkMarketCompatibility } from './prop-firm.ts';

export type ChallengeResult = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'NOT_VERIFIED' | 'INCOMPATIBLE';

export type FailureReason =
  | 'DAILY_LOSS_BREACH'
  | 'MAX_DRAWDOWN_BREACH'
  | 'PROFIT_TARGET_NOT_REACHED'
  | 'MIN_DAYS_NOT_MET'
  | 'MAX_DAYS_EXCEEDED'
  | 'CONSISTENCY_RULE_BREACH'
  | 'INSTRUMENT_NOT_ALLOWED'
  | 'INCOMPATIBLE_MARKET'
  | 'RULE_NOT_VERIFIED'
  | 'BACKTEST_REJECTED'
  | 'DAILY_LOSS_DATA_INSUFFICIENT'
  | 'TRAILING_DRAWDOWN_DATA_INSUFFICIENT'
  | 'POSITION_LIMIT_DATA_INSUFFICIENT'
  | 'NEWS_RULE_DATA_INSUFFICIENT'
  | 'RULESET_STALE'
  | 'CAPITAL_BASE_DATA_INSUFFICIENT'
  | 'OVERNIGHT_POSITION_BREACH'
  | 'OVERNIGHT_DATA_INSUFFICIENT'
  | 'WEEKEND_POSITION_BREACH'
  | 'WEEKEND_DATA_INSUFFICIENT';

export interface ChallengeEvaluation {
  result: ChallengeResult;
  failureReasons: FailureReason[];
  metrics: {
    returnPct: number;
    maxDrawdownPct: number;
    dailyMaxLossPct: number;
    dailyLossBasis: 'REALIZED_PNL';
    tradingDays: number;
    tradeCount: number;
    winRate: number | null;
    profitFactor: number | null;
    maxDayProfitPct: number;
    consistencyOk: boolean | null;
  };
  accountNormalization: {
    backtestCapital: number;
    programAccountSize: number;
    scaleFactor: number;
  };
  drawdownType: 'STATIC' | 'TRAILING';
  dataLimitations: string[];
  programId: string;
  ruleSetVersion: number;
  sourceStatus: string;
}

export interface ChallengeContext {
  backtestInitialCapital?: number;
}

export function evaluateChallenge(
  backtest: ResultadoBacktest,
  program: Program,
  datasetMarketType: MarketType,
  datasetInstrument: string,
  context?: ChallengeContext,
): ChallengeEvaluation {
  const rules = program.ruleSet.rules;
  const failureReasons: FailureReason[] = [];
  const dataLimitations: string[] = [];

  const backtestCapital = context?.backtestInitialCapital;
  let scaleFactor = 1;
  if (backtestCapital != null && backtestCapital > 0) {
    scaleFactor = program.accountSize / backtestCapital;
  }
  const accountNormalization = {
    backtestCapital: backtestCapital ?? 0,
    programAccountSize: program.accountSize,
    scaleFactor,
  };

  const baseMetrics = {
    returnPct: backtest.metricas.retornoNeto,
    maxDrawdownPct: backtest.metricas.drawdownMaximo,
    dailyMaxLossPct: 0,
    dailyLossBasis: 'REALIZED_PNL' as const,
    tradingDays: 0,
    tradeCount: backtest.metricas.operaciones,
    winRate: null as number | null,
    profitFactor: backtest.metricas.profitFactor,
    maxDayProfitPct: 0,
    consistencyOk: null as boolean | null,
  };

  const baseResult = (result: ChallengeResult) => ({
    result,
    failureReasons,
    metrics: baseMetrics,
    accountNormalization,
    drawdownType: rules.drawdownType,
    dataLimitations,
    programId: program.programId,
    ruleSetVersion: program.ruleSet.version,
    sourceStatus: program.ruleSet.sourceStatus,
  });

  // Market compatibility check
  const compat = checkMarketCompatibility(datasetMarketType, program);
  if (!compat.compatible) {
    failureReasons.push('INCOMPATIBLE_MARKET');
    return baseResult('INCOMPATIBLE');
  }

  // Instrument check
  if (rules.allowedInstruments && !rules.allowedInstruments.includes(datasetInstrument)) {
    failureReasons.push('INSTRUMENT_NOT_ALLOWED');
  }

  // Source verification — STALE blocked at execution time
  if (program.ruleSet.sourceStatus === 'STALE') {
    failureReasons.push('RULESET_STALE');
    return baseResult('NOT_VERIFIED');
  }

  if (program.ruleSet.sourceStatus === 'NOT_VERIFIED') {
    failureReasons.push('RULE_NOT_VERIFIED');
    return baseResult('NOT_VERIFIED');
  }

  // Backtest rejected
  if (!backtest.aprobado) {
    failureReasons.push('BACKTEST_REJECTED');
    return baseResult('FAIL');
  }

  // Compute daily PnL from trades (realized only)
  const dailyPnl = computeDailyPnl(backtest.operaciones);
  const tradingDays = Object.keys(dailyPnl).length;

  dataLimitations.push('Daily loss uses realized PnL only, not intraday equity');

  // Daily max loss — normalized to account size
  let dailyMaxLossPct = 0;
  let maxDayProfitPct = 0;
  for (const [, pnl] of Object.entries(dailyPnl)) {
    const normalizedPnl = pnl * scaleFactor;
    const pct = (normalizedPnl / program.accountSize) * 100;
    if (pct < 0) dailyMaxLossPct = Math.max(dailyMaxLossPct, Math.abs(pct));
    if (pct > 0) maxDayProfitPct = Math.max(maxDayProfitPct, pct);
  }

  if (tradingDays === 0) {
    failureReasons.push('DAILY_LOSS_DATA_INSUFFICIENT');
    dataLimitations.push('No trading days computed from backtest operations');
  }

  // Win rate
  const wins = backtest.operaciones.filter(o => o.pnlNeto >= 0).length;
  const winRate = backtest.metricas.operaciones > 0 ? (wins / backtest.metricas.operaciones) * 100 : null;

  // Consistency check
  let consistencyOk: boolean | null = null;
  if (rules.consistencyRulePct !== null && tradingDays > 0) {
    const totalProfit = Object.values(dailyPnl).filter(v => v > 0).reduce((a, b) => a + b, 0);
    if (totalProfit > 0) {
      const maxProfitDay = Math.max(...Object.values(dailyPnl));
      consistencyOk = (maxProfitDay / totalProfit) * 100 <= rules.consistencyRulePct;
    } else {
      consistencyOk = true;
    }
  }

  // Trailing drawdown check
  if (rules.drawdownType === 'TRAILING') {
    dataLimitations.push('Trailing drawdown requires tick-level equity curve; using static drawdownMaximo as approximation');
    failureReasons.push('TRAILING_DRAWDOWN_DATA_INSUFFICIENT');
  }

  // Position limit
  if (rules.positionLimit !== null) {
    dataLimitations.push('Position limit enforcement requires per-bar position tracking not available in backtest');
    failureReasons.push('POSITION_LIMIT_DATA_INSUFFICIENT');
  }

  // News restriction
  if (rules.newsRestricted === true) {
    dataLimitations.push('News restriction enforcement requires economic calendar data not available');
    failureReasons.push('NEWS_RULE_DATA_INSUFFICIENT');
  }

  // Capital base check
  if (backtestCapital == null || backtestCapital <= 0) {
    dataLimitations.push('Backtest initial capital not provided; scale factor cannot be computed');
    failureReasons.push('CAPITAL_BASE_DATA_INSUFFICIENT');
  }

  // Overnight rule
  if (rules.overnightAllowed === false) {
    let overnightChecked = false;
    for (const op of backtest.operaciones) {
      const entryMs = Date.parse(op.entrada);
      const exitMs = Date.parse(op.salida);
      if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) {
        failureReasons.push('OVERNIGHT_DATA_INSUFFICIENT');
        dataLimitations.push('Overnight check requires valid entry/exit timestamps');
        overnightChecked = true;
        break;
      }
      if (utcCalendarDay(entryMs) !== utcCalendarDay(exitMs)) {
        failureReasons.push('OVERNIGHT_POSITION_BREACH');
        overnightChecked = true;
        break;
      }
    }
    if (!overnightChecked && backtest.operaciones.length === 0) {
      dataLimitations.push('No trades to check overnight rule');
    }
  }

  // Weekend rule
  if (rules.weekendAllowed === false) {
    let weekendChecked = false;
    for (const op of backtest.operaciones) {
      const entryMs = Date.parse(op.entrada);
      const exitMs = Date.parse(op.salida);
      if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) {
        failureReasons.push('WEEKEND_DATA_INSUFFICIENT');
        dataLimitations.push('Weekend check requires valid entry/exit timestamps');
        weekendChecked = true;
        break;
      }
      const firstDay = utcCalendarDay(entryMs);
      const lastDay = utcCalendarDay(exitMs);
      for (let t = firstDay; t <= lastDay; t += 86400000) {
        const dow = new Date(t).getUTCDay();
        if (dow === 0 || dow === 6) {
          failureReasons.push('WEEKEND_POSITION_BREACH');
          weekendChecked = true;
          break;
        }
      }
      if (weekendChecked) break;
    }
  }

  const metrics = {
    returnPct: backtest.metricas.retornoNeto,
    maxDrawdownPct: backtest.metricas.drawdownMaximo,
    dailyMaxLossPct,
    dailyLossBasis: 'REALIZED_PNL' as const,
    tradingDays,
    tradeCount: backtest.metricas.operaciones,
    winRate,
    profitFactor: backtest.metricas.profitFactor,
    maxDayProfitPct,
    consistencyOk,
  };

  // Rule checks
  if (dailyMaxLossPct > rules.dailyLossLimitPct) {
    failureReasons.push('DAILY_LOSS_BREACH');
  }

  if (backtest.metricas.drawdownMaximo > rules.maxLossLimitPct) {
    failureReasons.push('MAX_DRAWDOWN_BREACH');
  }

  if (backtest.metricas.retornoNeto < rules.profitTargetPct) {
    failureReasons.push('PROFIT_TARGET_NOT_REACHED');
  }

  if (tradingDays < rules.minTradingDays) {
    failureReasons.push('MIN_DAYS_NOT_MET');
  }

  if (rules.maxTradingDays !== null && tradingDays > rules.maxTradingDays) {
    failureReasons.push('MAX_DAYS_EXCEEDED');
  }

  if (consistencyOk === false) {
    failureReasons.push('CONSISTENCY_RULE_BREACH');
  }

  // Determine result — INCOMPLETE when data limitations prevent evaluation
  const hasDataInsufficiency = failureReasons.some(r => r.endsWith('_DATA_INSUFFICIENT'));
  const hasHardFailure = failureReasons.some(r =>
    ['DAILY_LOSS_BREACH', 'MAX_DRAWDOWN_BREACH', 'PROFIT_TARGET_NOT_REACHED',
     'MIN_DAYS_NOT_MET', 'MAX_DAYS_EXCEEDED', 'CONSISTENCY_RULE_BREACH',
     'INSTRUMENT_NOT_ALLOWED', 'OVERNIGHT_POSITION_BREACH',
     'WEEKEND_POSITION_BREACH'].includes(r));

  let result: ChallengeResult;
  if (hasDataInsufficiency) result = 'INCOMPLETE';
  else if (hasHardFailure) result = 'FAIL';
  else result = 'PASS';

  return {
    result,
    failureReasons,
    metrics,
    accountNormalization,
    drawdownType: rules.drawdownType,
    dataLimitations,
    programId: program.programId,
    ruleSetVersion: program.ruleSet.version,
    sourceStatus: program.ruleSet.sourceStatus,
  };
}

function utcCalendarDay(timestampMs: number): number {
  const value = new Date(timestampMs);
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function computeDailyPnl(operations: OperacionBacktest[]): Record<string, number> {
  const daily: Record<string, number> = {};
  for (const op of operations) {
    const day = op.salida.slice(0, 10);
    daily[day] = (daily[day] ?? 0) + op.pnlNeto;
  }
  return daily;
}
