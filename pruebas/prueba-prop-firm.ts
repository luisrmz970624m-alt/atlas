import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateRuleSet,
  validateProgram,
  checkMarketCompatibility,
  createTestFixturePropFirm,
  type RuleSet,
  type Program,
  type PropFirm,
} from '../src/trading-lab/prop-firm.ts';

describe('TASK 13: Prop Firm Lab Foundation', () => {

  it('test fixture firm is properly labeled', () => {
    const firm = createTestFixturePropFirm();
    assert.equal(firm.sourceStatus, 'TEST_FIXTURE');
    assert.equal(firm.firmId, 'TEST_FIXTURE_FIRM');
    assert.ok(firm.programs.length > 0);

    const prog = firm.programs[0];
    assert.equal(prog.ruleSet.sourceStatus, 'TEST_FIXTURE');
    assert.ok(prog.ruleSet.source.notes.includes('TEST_FIXTURE'));
    assert.ok(!prog.name.toLowerCase().includes('ftmo'));
    assert.ok(!prog.name.toLowerCase().includes('topstep'));
  });

  it('validates correct ruleset without errors', () => {
    const firm = createTestFixturePropFirm();
    const errors = validateRuleSet(firm.programs[0].ruleSet);
    assert.equal(errors.length, 0);
  });

  it('rejects ruleset with missing ruleSetId', () => {
    const firm = createTestFixturePropFirm();
    const rs = { ...firm.programs[0].ruleSet, ruleSetId: '' };
    const errors = validateRuleSet(rs);
    assert.ok(errors.some(e => e.includes('ruleSetId')));
  });

  it('rejects ruleset with invalid version', () => {
    const firm = createTestFixturePropFirm();
    const rs = { ...firm.programs[0].ruleSet, version: 0 };
    assert.ok(validateRuleSet(rs).length > 0);
  });

  it('rejects invalid numeric limits', () => {
    const firm = createTestFixturePropFirm();
    const rs = JSON.parse(JSON.stringify(firm.programs[0].ruleSet)) as RuleSet;
    rs.rules.profitTargetPct = -5;
    const errors = validateRuleSet(rs);
    assert.ok(errors.some(e => e.includes('profitTargetPct')));
  });

  it('rejects dailyLoss > maxLoss', () => {
    const firm = createTestFixturePropFirm();
    const rs = JSON.parse(JSON.stringify(firm.programs[0].ruleSet)) as RuleSet;
    rs.rules.dailyLossLimitPct = 15;
    rs.rules.maxLossLimitPct = 10;
    assert.ok(validateRuleSet(rs).some(e => e.includes('dailyLossLimitPct')));
  });

  it('rejects empty allowedMarketTypes', () => {
    const firm = createTestFixturePropFirm();
    const rs = JSON.parse(JSON.stringify(firm.programs[0].ruleSet)) as RuleSet;
    rs.rules.allowedMarketTypes = [];
    assert.ok(validateRuleSet(rs).some(e => e.includes('allowedMarketTypes')));
  });

  it('checks market compatibility — allowed', () => {
    const firm = createTestFixturePropFirm();
    const result = checkMarketCompatibility('FOREX_SPOT', firm.programs[0]);
    assert.ok(result.compatible);
  });

  it('checks market compatibility — incompatible', () => {
    const firm = createTestFixturePropFirm();
    const result = checkMarketCompatibility('FUTURES', firm.programs[0]);
    assert.equal(result.compatible, false);
    assert.ok(result.reason.includes('INCOMPATIBLE_MARKET'));
  });

  it('ruleset versioning works', () => {
    const firm = createTestFixturePropFirm();
    const v1 = firm.programs[0].ruleSet;
    assert.equal(v1.version, 1);

    const v2: RuleSet = { ...v1, version: 2, ruleSetId: 'TEST_FIXTURE_RS_002' };
    assert.equal(v2.version, 2);
    assert.equal(validateRuleSet(v2).length, 0);
  });

  it('handles NOT_VERIFIED source status', () => {
    const firm = createTestFixturePropFirm();
    const rs = { ...firm.programs[0].ruleSet, sourceStatus: 'NOT_VERIFIED' as const };
    assert.equal(rs.sourceStatus, 'NOT_VERIFIED');
    assert.equal(validateRuleSet(rs).length, 0);
  });

  it('unknown/missing required fields produce errors', () => {
    const rs: RuleSet = {
      ruleSetId: '',
      version: -1,
      rules: {
        profitTargetPct: NaN,
        dailyLossLimitPct: NaN,
        maxLossLimitPct: NaN,
        drawdownType: 'INVALID' as any,
        minTradingDays: -1,
        maxTradingDays: null,
        positionLimit: null,
        consistencyRulePct: null,
        overnightAllowed: null,
        weekendAllowed: null,
        newsRestricted: null,
        allowedMarketTypes: [],
        allowedInstruments: null,
      },
      source: { url: null, retrievedAt: null, effectiveAt: null, notes: '' },
      sourceStatus: 'NOT_VERIFIED',
      createdAt: '',
    };
    const errors = validateRuleSet(rs);
    assert.ok(errors.length >= 5, `Expected many errors, got ${errors.length}: ${errors.join('; ')}`);
  });

  it('no real firm names in fixture', () => {
    const firm = createTestFixturePropFirm();
    const json = JSON.stringify(firm).toLowerCase();
    for (const name of ['ftmo', 'topstep', 'apex', 'fundingpips', 'myforexfunds']) {
      assert.ok(!json.includes(name), `Must not contain real firm name: ${name}`);
    }
  });

  it('VERIFIED requires url and retrievedAt', () => {
    const firm = createTestFixturePropFirm();
    const rs = {
      ...firm.programs[0].ruleSet,
      sourceStatus: 'VERIFIED' as const,
      source: { url: null, retrievedAt: null, effectiveAt: null, notes: 'test' },
    };
    const errors = validateRuleSet(rs);
    assert.ok(errors.some(e => e.includes('url')));
    assert.ok(errors.some(e => e.includes('retrievedAt')));
  });

  it('STALE rulesets produce validation error', () => {
    const firm = createTestFixturePropFirm();
    const rs = { ...firm.programs[0].ruleSet, sourceStatus: 'STALE' as const };
    const errors = validateRuleSet(rs);
    assert.ok(errors.some(e => e.includes('STALE')));
  });

  it('validateProgram validates program and its ruleset', () => {
    const firm = createTestFixturePropFirm();
    assert.equal(validateProgram(firm.programs[0]).length, 0);
  });

  it('validateProgram rejects invalid accountSize', () => {
    const firm = createTestFixturePropFirm();
    const prog = { ...firm.programs[0], accountSize: -1 };
    assert.ok(validateProgram(prog).some(e => e.includes('accountSize')));
  });

  it('no network calls in module', () => {
    const src = readFileSync('src/trading-lab/prop-firm.ts', 'utf-8');
    assert.ok(!src.includes('fetch('), 'No fetch calls allowed');
    assert.ok(!src.includes('http.get'), 'No HTTP calls allowed');
    assert.ok(!src.includes('https.get'), 'No HTTPS calls allowed');
  });
});
