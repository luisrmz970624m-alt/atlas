/** Timezone Normalization — Canonical UTC timestamps, preserve metadata.
 *
 * PHASE 3A: Normalizes historical dataset timestamps to UTC.
 * Maintains original timezone metadata without data loss.
 */

import type { VelaHistorica, SerieHistorica } from './tipos.ts';

export interface TimestampNormalizationReport {
  originalTimezone: string;
  targetTimezone: string; // Always 'UTC'
  barsProcessed: number;
  barsNormalized: number;
  barsSkipped: number; // Unparseable
  skipReasons: string[];
}

/** Parse ISO 8601 timestamp (handles UTC and timezone offsets). */
function parseTimestamp(ts: string): Date | null {
  try {
    // Try ISO 8601 format (includes timezone)
    if (ts.includes('T')) {
      return new Date(ts);
    }

    // Try YYYY-MM-DD format (assume UTC)
    if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) {
      return new Date(`${ts}T00:00:00Z`);
    }

    // Try other common formats
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  } catch {
    return null;
  }
}

/** Normalize all timestamps to UTC ISO 8601. */
export function normalizeTimestampsToUTC(
  serie: SerieHistorica,
  sourceTimezone: string,
): { serie: SerieHistorica; report: TimestampNormalizationReport } {

  const report: TimestampNormalizationReport = {
    originalTimezone: sourceTimezone,
    targetTimezone: 'UTC',
    barsProcessed: serie.velas.length,
    barsNormalized: 0,
    barsSkipped: 0,
    skipReasons: [],
  };

  const normalizedVelas: VelaHistorica[] = [];

  for (const vela of serie.velas) {
    const parsed = parseTimestamp(vela.timestamp);

    if (!parsed || isNaN(parsed.getTime())) {
      report.barsSkipped += 1;
      const reason = `Cannot parse timestamp: "${vela.timestamp}"`;
      if (!report.skipReasons.includes(reason)) {
        report.skipReasons.push(reason);
      }
      continue;
    }

    // Convert to UTC ISO 8601
    const normalized: VelaHistorica = {
      ...vela,
      timestamp: parsed.toISOString(), // Guaranteed UTC
    };

    normalizedVelas.push(normalized);
    report.barsNormalized += 1;
  }

  const normalizedSerie: SerieHistorica = {
    ...serie,
    velas: normalizedVelas,
  };

  return { serie: normalizedSerie, report };
}

/** Verify all timestamps are valid UTC ISO 8601. */
export function validateUTCTimestamps(serie: SerieHistorica): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < serie.velas.length; i++) {
    const ts = serie.velas[i].timestamp;

    // Must be ISO 8601 with Z suffix
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(ts)) {
      errors.push(`Bar ${i}: Timestamp "${ts}" not UTC ISO 8601`);
      continue;
    }

    // Must parse successfully
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      errors.push(`Bar ${i}: Timestamp "${ts}" cannot be parsed`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Verify timestamps are in chronological order (no reversals). */
export function validateTimestampOrdering(serie: SerieHistorica): {
  ordered: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 1; i < serie.velas.length; i++) {
    const prev = new Date(serie.velas[i - 1].timestamp).getTime();
    const curr = new Date(serie.velas[i].timestamp).getTime();

    if (curr <= prev) {
      errors.push(`Bar ${i}: Timestamp ${serie.velas[i].timestamp} <= previous ${serie.velas[i - 1].timestamp}`);
    }
  }

  return { ordered: errors.length === 0, errors };
}

/** Detect gaps between consecutive bars. */
export interface TimestampGap {
  gapStart: string; // ISO 8601 UTC
  gapEnd: string; // ISO 8601 UTC
  barsBetween: number;
  expectedBars: number; // Based on timeframe
  actualBars: number;
  reason?: string; // e.g., "weekend", "session_closed"
}

export function detectTimestampGaps(
  serie: SerieHistorica,
  timeframeMinutes: number, // e.g., 1440 for 1d, 60 for 1h
): TimestampGap[] {
  const gaps: TimestampGap[] = [];

  if (serie.velas.length < 2) {
    return gaps; // No gaps in series with <2 bars
  }

  const expectedIntervalMs = timeframeMinutes * 60 * 1000;

  for (let i = 1; i < serie.velas.length; i++) {
    const prevTime = new Date(serie.velas[i - 1].timestamp).getTime();
    const currTime = new Date(serie.velas[i].timestamp).getTime();
    const actualIntervalMs = currTime - prevTime;

    if (actualIntervalMs > expectedIntervalMs * 1.5) {
      // Gap detected
      const gapMs = actualIntervalMs - expectedIntervalMs;
      const expectedBars = Math.round(gapMs / expectedIntervalMs);

      gaps.push({
        gapStart: serie.velas[i - 1].timestamp,
        gapEnd: serie.velas[i].timestamp,
        barsBetween: expectedBars,
        expectedBars: expectedBars + 1,
        actualBars: 1,
        reason: detectGapReason(new Date(prevTime), new Date(currTime), timeframeMinutes),
      });
    }
  }

  return gaps;
}

/** Heuristic: guess why there's a gap (weekend, holiday, session closed). */
function detectGapReason(prevDate: Date, currDate: Date, timeframeMinutes: number): string {
  const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

  // For daily or longer timeframes, check for weekends
  if (timeframeMinutes >= 1440) {
    const prevDay = prevDate.getDay();
    const currDay = currDate.getDay();

    if (prevDay === 5 && currDay === 1) {
      return 'weekend';
    }
    if (prevDay === 5 || currDay === 0 || currDay === 6) {
      return 'weekend_or_holiday';
    }
  }

  // For intraday, could be session closed
  if (timeframeMinutes < 1440) {
    return 'session_closed_or_holiday';
  }

  return 'unknown';
}

/** Parse timeframe string to minutes (e.g., "1h" → 60). */
export function timeframeToMinutes(timeframe: string): number {
  const match = timeframe.match(/^(\d+)([mhd])$/i);
  if (!match) {
    throw new Error(`Invalid timeframe: "${timeframe}"`);
  }

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit.toLowerCase()) {
    case 'm': return num;
    case 'h': return num * 60;
    case 'd': return num * 1440;
    default: throw new Error(`Unknown timeframe unit: "${unit}"`);
  }
}
