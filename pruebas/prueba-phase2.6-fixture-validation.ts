import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDiagnosticFixture_MultiRegime,
  validateFixture,
} from '../src/trading-lab/fixture-generator.ts';
import { crearCruceMedias } from '../src/trading-lab/estrategias.ts';
import { ejecutarBacktest } from '../src/trading-lab/backtest.ts';
import type { ConfiguracionBacktest } from '../src/trading-lab/tipos.ts';

test('phase2.6: fixture generation is deterministic', () => {
  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const fixture1 = createDiagnosticFixture_MultiRegime();
  const fixture2 = createDiagnosticFixture_MultiRegime();

  // Same seed should produce identical bars
  assert.equal(fixture1.velas.length, fixture2.velas.length);
  for (let i = 0; i < fixture1.velas.length; i++) {
    const v1 = fixture1.velas[i]!;
    const v2 = fixture2.velas[i]!;
    assert.equal(v1.apertura, v2.apertura);
    assert.equal(v1.maximo, v2.maximo);
    assert.equal(v1.minimo, v2.minimo);
    assert.equal(v1.cierre, v2.cierre);
  }

  console.log(`✅ Fixture deterministic: ${fixture1.velas.length} bars identical`);
});

test('phase2.6: fixture OHLC valid', () => {
  const fixture = createDiagnosticFixture_MultiRegime();
  const validation = validateFixture(fixture);

  assert.ok(validation.valid, `Validation errors: ${validation.errors.join(', ')}`);
  assert.equal(validation.errors.length, 0);

  console.log(`✅ OHLC valid: ${fixture.velas.length} bars`);
});

test('phase2.6: fixture generates trades with baseline MA_CROSS', () => {
  const fixture = createDiagnosticFixture_MultiRegime();

  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const estrategia = crearCruceMedias({
    id: 'diagnostic_baseline',
    version: 1,
    tipo: 'cruce_medias' as const,
    mediaRapida: 9,
    mediaLenta: 21,
    riesgoPorOperacion: 0.01,
  });

  const resultado = ejecutarBacktest(fixture, estrategia, config);

  // CRITICAL: Must have trades
  assert.ok(
    resultado.operaciones.length >= 2,
    `Expected >= 2 trades, got ${resultado.operaciones.length}`
  );

  console.log(`✅ Baseline MA_CROSS generated ${resultado.operaciones.length} trades`);
  console.log(
    `   Return: ${resultado.metricas.retornoNeto}%, DD: ${resultado.metricas.drawdownMaximo}%`
  );
});

test('phase2.6: fixture multi-segment coverage', () => {
  const fixture = createDiagnosticFixture_MultiRegime();

  // Verify bars span multiple segments
  assert.ok(fixture.velas.length >= 100);

  // Verify price movement across bars
  const firstBar = fixture.velas[0]!.cierre;
  const midBar = fixture.velas[Math.floor(fixture.velas.length / 2)]!.cierre;
  const lastBar = fixture.velas[fixture.velas.length - 1]!.cierre;

  // Should not all be identical
  const prices = [firstBar, midBar, lastBar];
  const unique = new Set(prices);
  assert.ok(unique.size >= 2, `Expected price variation, got ${unique.size} unique prices`);

  console.log(`✅ Multi-segment fixture with price movement`);
  console.log(`   First: ${firstBar}, Mid: ${midBar}, Last: ${lastBar}`);
});

test('phase2.6: fixture supports OOS splits', () => {
  const fixture = createDiagnosticFixture_MultiRegime();

  const config: ConfiguracionBacktest = {
    capitalInicial: 10000,
    comisionPorcentaje: 0.001,
    spreadPorcentaje: 0.0005,
    slippagePorcentaje: 0.0001,
    maxRiesgoPorOperacion: 0.02,
    semilla: 42,
  };

  const splits = [50, 60, 70];

  for (const splitIdx of splits) {
    assert.ok(splitIdx < fixture.velas.length);

    // Ensure splits don't overlap
    const trainBars = fixture.velas.slice(0, splitIdx);
    const oosBars = fixture.velas.slice(splitIdx);

    assert.equal(trainBars.length + oosBars.length, fixture.velas.length);
    assert.ok(trainBars.length > 0);
    assert.ok(oosBars.length > 0);
  }

  console.log(`✅ Fixture supports OOS splits`);
});

test('phase2.6: fixture parameters documented', () => {
  const fixture = createDiagnosticFixture_MultiRegime();

  // Fixture metadata must be verifiable
  assert.ok(fixture.id);
  assert.ok(fixture.simbolo === 'EURUSD');
  assert.ok(fixture.intervalo === 'H1');
  assert.ok(fixture.origen === 'TEST_FIXTURE');

  console.log(`✅ Fixture metadata complete`);
  console.log(`   ID: ${fixture.id}`);
  console.log(`   Bars: ${fixture.velas.length}`);
  console.log(`   Symbol: ${fixture.simbolo}`);
});
