import type { VelaHistorica, SerieHistorica } from './tipos.ts';
import { createHash } from 'node:crypto';

export interface FixtureConfig {
  fixtureId: string;
  seed: number;
  bars: number;
  startPrice: number;
  sourceType: 'TEST_FIXTURE';
  segments: SegmentConfig[];
}

export interface SegmentConfig {
  name: string;
  barsInSegment: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  volatility: number; // 0-1 range
  expectedRegime: string;
}

export interface FixtureMeta {
  fixtureId: string;
  seed: number;
  totalBars: number;
  segmentCount: number;
  expectedCrossingsMin: number;
  sourceType: string;
  createdAt: string;
}

/**
 * Deterministic OHLC generator for diagnostic testing.
 * NOT optimized for any specific strategy.
 */
export class DiagnosticFixtureGenerator {
  private seed: number;
  private currentPrice: number;

  constructor(initialSeed: number, startPrice: number = 1.08) {
    this.seed = initialSeed;
    this.currentPrice = startPrice;
  }

  /**
   * Seeded pseudo-random number (0-1)
   */
  private random(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate OHLC for one bar given trend and volatility.
   */
  private generateBar(
    basePrice: number,
    trend: 'UP' | 'DOWN' | 'SIDEWAYS',
    volatility: number
  ): { open: number; high: number; low: number; close: number } {
    // Trend bias (0-1 range)
    const trendBias = trend === 'UP' ? 0.6 : trend === 'DOWN' ? 0.4 : 0.5;

    // Random walk
    const randomMove = (this.random() - 0.5) * volatility;
    const trendMove = (trendBias - 0.5) * volatility * 0.5;

    const open = basePrice;
    const move = randomMove + trendMove;
    const close = basePrice + move;

    // High/Low based on range
    const range = Math.abs(move) * 0.5 + volatility * 0.02;
    const high = Math.max(open, close) + range;
    const low = Math.min(open, close) - range;

    return {
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
    };
  }

  /**
   * Generate complete fixture
   */
  generateFixture(config: FixtureConfig): SerieHistorica {
    const velas: VelaHistorica[] = [];
    let barTime = 0;

    for (const segment of config.segments) {
      let segmentPrice = this.currentPrice;

      for (let i = 0; i < segment.barsInSegment; i++) {
        const bar = this.generateBar(segmentPrice, segment.trend, segment.volatility);

        // Validate OHLC
        if (!(bar.high >= bar.open && bar.high >= bar.close)) {
          throw new Error(`Invalid OHLC: high=${bar.high}, open=${bar.open}, close=${bar.close}`);
        }
        if (!(bar.low <= bar.open && bar.low <= bar.close)) {
          throw new Error(`Invalid OHLC: low=${bar.low}, open=${bar.open}, close=${bar.close}`);
        }
        if (bar.high < bar.low) {
          throw new Error(`Invalid OHLC: high=${bar.high} < low=${bar.low}`);
        }

        velas.push({
          fecha: new Date(2024, 0, 1, 0, barTime).toISOString(),
          apertura: bar.open,
          maximo: bar.high,
          minimo: bar.low,
          cierre: bar.close,
          volumen: 1000 + i * 10,
        });

        segmentPrice = bar.close;
        barTime++;
      }

      this.currentPrice = segmentPrice;
    }

    return {
      id: config.fixtureId,
      simbolo: 'EURUSD',
      intervalo: 'H1',
      origen: config.sourceType,
      velas,
    };
  }

  /**
   * Generate metadata for diagnostic purposes
   */
  generateMeta(config: FixtureConfig): FixtureMeta {
    return {
      fixtureId: config.fixtureId,
      seed: config.seed,
      totalBars: config.bars,
      segmentCount: config.segments.length,
      expectedCrossingsMin: 3, // Minimum expected MA9/MA21 crossings
      sourceType: config.sourceType,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Pre-configured diagnostic fixtures
 */
export function createDiagnosticFixture_MultiRegime(): SerieHistorica {
  const generator = new DiagnosticFixtureGenerator(42, 1.08);

  const config: FixtureConfig = {
    fixtureId: 'DIAGNOSTIC_MULTI_REGIME_V1',
    seed: 42,
    bars: 150,
    startPrice: 1.08,
    sourceType: 'TEST_FIXTURE',
    segments: [
      {
        name: 'LOW_VOLATILITY_FLAT',
        barsInSegment: 20,
        trend: 'SIDEWAYS',
        volatility: 0.0005,
        expectedRegime: 'RANGING',
      },
      {
        name: 'TRENDING_UP_1',
        barsInSegment: 30,
        trend: 'UP',
        volatility: 0.001,
        expectedRegime: 'TRENDING_UP',
      },
      {
        name: 'RANGING_HIGH_VOL',
        barsInSegment: 25,
        trend: 'SIDEWAYS',
        volatility: 0.002,
        expectedRegime: 'VOLATILE',
      },
      {
        name: 'TRENDING_DOWN_1',
        barsInSegment: 30,
        trend: 'DOWN',
        volatility: 0.001,
        expectedRegime: 'TRENDING_DOWN',
      },
      {
        name: 'RECOVERY_UP',
        barsInSegment: 25,
        trend: 'UP',
        volatility: 0.0015,
        expectedRegime: 'TRENDING_UP',
      },
      {
        name: 'HIGH_VOLATILITY_CHOPPY',
        barsInSegment: 20,
        trend: 'SIDEWAYS',
        volatility: 0.003,
        expectedRegime: 'VOLATILE',
      },
    ],
  };

  return generator.generateFixture(config);
}

/**
 * Verify fixture integrity
 */
export function validateFixture(serie: SerieHistorica): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!serie.velas || serie.velas.length === 0) {
    errors.push('Empty velas array');
    return { valid: false, errors };
  }

  for (let i = 0; i < serie.velas.length; i++) {
    const vela = serie.velas[i]!;

    if (!Number.isFinite(vela.apertura)) {
      errors.push(`Bar ${i}: apertura not finite`);
    }
    if (!Number.isFinite(vela.maximo)) {
      errors.push(`Bar ${i}: maximo not finite`);
    }
    if (!Number.isFinite(vela.minimo)) {
      errors.push(`Bar ${i}: minimo not finite`);
    }
    if (!Number.isFinite(vela.cierre)) {
      errors.push(`Bar ${i}: cierre not finite`);
    }

    if (vela.maximo < vela.minimo) {
      errors.push(`Bar ${i}: high < low`);
    }
    if (vela.maximo < vela.apertura || vela.maximo < vela.cierre) {
      errors.push(`Bar ${i}: high < open or close`);
    }
    if (vela.minimo > vela.apertura || vela.minimo > vela.cierre) {
      errors.push(`Bar ${i}: low > open or close`);
    }

    if (i > 0) {
      const prevTime = new Date(serie.velas[i - 1]!.fecha).getTime();
      const currTime = new Date(vela.fecha).getTime();
      if (currTime <= prevTime) {
        errors.push(`Bar ${i}: timestamp not increasing`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
