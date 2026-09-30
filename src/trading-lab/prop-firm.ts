/** Prop Firm Lab Foundation — TASK 13.
 * Declarative rule engine. NO real firm rules. NO network. NO trading. */

export type RuleSourceStatus = 'VERIFIED' | 'NOT_VERIFIED' | 'TEST_FIXTURE' | 'STALE';
export type MarketType = 'FOREX_SPOT' | 'FUTURES' | 'CFD' | 'EQUITY' | 'CRYPTO';
export type DrawdownType = 'STATIC' | 'TRAILING';

export interface PropFirmRule {
  profitTargetPct: number;
  dailyLossLimitPct: number;
  maxLossLimitPct: number;
  drawdownType: DrawdownType;
  minTradingDays: number;
  maxTradingDays: number | null;
  positionLimit: number | null;
  consistencyRulePct: number | null;
  overnightAllowed: boolean | null;
  weekendAllowed: boolean | null;
  newsRestricted: boolean | null;
  allowedMarketTypes: MarketType[];
  allowedInstruments: string[] | null;
}

export interface RuleSource {
  url: string | null;
  retrievedAt: string | null;
  effectiveAt: string | null;
  notes: string;
}

export interface RuleSet {
  ruleSetId: string;
  version: number;
  rules: PropFirmRule;
  source: RuleSource;
  sourceStatus: RuleSourceStatus;
  createdAt: string;
}

export interface Program {
  programId: string;
  name: string;
  description: string;
  marketType: MarketType;
  accountSize: number;
  currency: string;
  ruleSet: RuleSet;
}

export interface PropFirm {
  firmId: string;
  name: string;
  website: string | null;
  programs: Program[];
  sourceStatus: RuleSourceStatus;
}

export class PropFirmValidationError extends Error {}

export function validateRuleSet(rs: RuleSet): string[] {
  const errors: string[] = [];

  if (!rs.ruleSetId) errors.push('ruleSetId is required');
  if (!Number.isInteger(rs.version) || rs.version < 1) errors.push('version must be positive integer');
  if (!rs.createdAt) errors.push('createdAt is required');

  const r = rs.rules;
  if (!Number.isFinite(r.profitTargetPct) || r.profitTargetPct <= 0) errors.push('profitTargetPct must be > 0');
  if (!Number.isFinite(r.dailyLossLimitPct) || r.dailyLossLimitPct <= 0) errors.push('dailyLossLimitPct must be > 0');
  if (!Number.isFinite(r.maxLossLimitPct) || r.maxLossLimitPct <= 0) errors.push('maxLossLimitPct must be > 0');
  if (r.dailyLossLimitPct > r.maxLossLimitPct) errors.push('dailyLossLimitPct must be <= maxLossLimitPct');
  if (!['STATIC', 'TRAILING'].includes(r.drawdownType)) errors.push('drawdownType must be STATIC or TRAILING');
  if (!Number.isInteger(r.minTradingDays) || r.minTradingDays < 0) errors.push('minTradingDays must be >= 0');
  if (r.maxTradingDays !== null && (!Number.isInteger(r.maxTradingDays) || r.maxTradingDays < r.minTradingDays)) {
    errors.push('maxTradingDays must be null or >= minTradingDays');
  }
  if (r.positionLimit !== null && (!Number.isInteger(r.positionLimit) || r.positionLimit < 1)) {
    errors.push('positionLimit must be null or >= 1');
  }
  if (r.consistencyRulePct !== null && (!Number.isFinite(r.consistencyRulePct) || r.consistencyRulePct <= 0 || r.consistencyRulePct > 100)) {
    errors.push('consistencyRulePct must be null or between 0 and 100');
  }
  if (!Array.isArray(r.allowedMarketTypes) || r.allowedMarketTypes.length === 0) {
    errors.push('allowedMarketTypes must be a non-empty array');
  }

  if (rs.sourceStatus === 'VERIFIED') {
    if (!rs.source.url) errors.push('VERIFIED source requires url');
    if (!rs.source.retrievedAt) errors.push('VERIFIED source requires retrievedAt');
  }

  if (rs.sourceStatus === 'STALE') {
    errors.push('STALE rulesets must be refreshed before use');
  }

  return errors;
}

export function validateProgram(program: Program): string[] {
  const errors: string[] = [];

  if (!program.programId) errors.push('programId is required');
  if (!program.name) errors.push('name is required');
  if (!Number.isFinite(program.accountSize) || program.accountSize <= 0) {
    errors.push('accountSize must be > 0');
  }
  if (!program.currency) errors.push('currency is required');

  const rsErrors = validateRuleSet(program.ruleSet);
  errors.push(...rsErrors);

  if (!program.ruleSet.rules.allowedMarketTypes.includes(program.marketType)) {
    errors.push('program marketType must be in ruleSet allowedMarketTypes');
  }

  return errors;
}

export function checkMarketCompatibility(
  datasetMarketType: MarketType,
  program: Program,
): { compatible: boolean; reason: string } {
  if (program.ruleSet.rules.allowedMarketTypes.includes(datasetMarketType)) {
    return { compatible: true, reason: 'Market type allowed' };
  }
  return {
    compatible: false,
    reason: `INCOMPATIBLE_MARKET: dataset is ${datasetMarketType}, program allows ${program.ruleSet.rules.allowedMarketTypes.join(', ')}`,
  };
}

export function createTestFixturePropFirm(): PropFirm {
  const ruleSet: RuleSet = {
    ruleSetId: 'TEST_FIXTURE_RS_001',
    version: 1,
    rules: {
      profitTargetPct: 10,
      dailyLossLimitPct: 5,
      maxLossLimitPct: 10,
      drawdownType: 'STATIC',
      minTradingDays: 5,
      maxTradingDays: 30,
      positionLimit: null,
      consistencyRulePct: 30,
      overnightAllowed: true,
      weekendAllowed: false,
      newsRestricted: null,
      allowedMarketTypes: ['FOREX_SPOT'],
      allowedInstruments: null,
    },
    source: {
      url: null,
      retrievedAt: null,
      effectiveAt: null,
      notes: 'TEST_FIXTURE: not based on any real firm. For engine validation only.',
    },
    sourceStatus: 'TEST_FIXTURE',
    createdAt: new Date().toISOString(),
  };

  const program: Program = {
    programId: 'TEST_FIXTURE_PROG_001',
    name: 'Test Challenge',
    description: 'Test fixture program for engine validation. NOT a real firm.',
    marketType: 'FOREX_SPOT',
    accountSize: 100000,
    currency: 'USD',
    ruleSet,
  };

  return {
    firmId: 'TEST_FIXTURE_FIRM',
    name: 'Test Fixture Firm',
    website: null,
    programs: [program],
    sourceStatus: 'TEST_FIXTURE',
  };
}
