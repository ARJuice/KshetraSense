import { describe, expect, it } from 'vitest';
import {
  buildHumiditySegments,
  calculateHistoryWindow,
  calculatePlayheadX,
  calculateValueY,
  clampTimestamp,
} from './telemetryViewModel';
import type { TelemetryHistorySample } from '../../services/telemetryApi';

const sample = (gridTime: string, observedAt: string | null, value: number | null): TelemetryHistorySample => ({
  timestampUtc: gridTime,
  lineId: 1,
  historicalTreatment: '100% of the trial recommendation',
  soilObservation: {
    observedAtUtc: observedAt,
    humiditySignalPctRh: value,
  },
  sharedEnvironmentalObservation: { observedAtUtc: null },
  waterMeter: { field: 'current_volume', sourceReportedValue: null, sourceUnit: 'm³', observedAtUtc: null, interpretation: '' },
});

describe('telemetry raw humidity chart model', () => {
  it('uses observation timestamps and keeps missing/long-gap values disconnected', () => {
    const samples = [
      sample('2023-07-01T00:00:00Z', '2023-07-01T00:10:00Z', 41),
      sample('2023-07-01T00:10:00Z', null, null),
      sample('2023-07-01T00:20:00Z', '2023-07-01T00:20:00Z', 43),
      sample('2023-07-01T01:00:00Z', '2023-07-01T01:00:00Z', 47),
    ];

    const segments = buildHumiditySegments(samples);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([
      { timestampMs: Date.parse('2023-07-01T00:10:00Z'), value: 41 },
      { timestampMs: Date.parse('2023-07-01T00:20:00Z'), value: 43 },
    ]);
    expect(segments[1][0].timestampMs).toBe(Date.parse('2023-07-01T01:00:00Z'));
  });
});

describe('telemetry replay controls and coordinate math', () => {
  const startMs = Date.parse('2023-07-01T00:00:00Z');
  const endMs = Date.parse('2023-07-31T23:59:59Z');
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('calculates a 24-hour history window bounded by dataset start and end', () => {
    // Centered in the middle of dataset
    const midMs = Date.parse('2023-07-15T12:00:00Z');
    const midWindow = calculateHistoryWindow(midMs, startMs, endMs, DAY_MS);
    expect(Date.parse(midWindow.end) - Date.parse(midWindow.start)).toBe(DAY_MS);
    expect(Date.parse(midWindow.start)).toBe(midMs - DAY_MS / 2);

    // Near the dataset start
    const earlyMs = Date.parse('2023-07-01T02:00:00Z');
    const earlyWindow = calculateHistoryWindow(earlyMs, startMs, endMs, DAY_MS);
    expect(Date.parse(earlyWindow.start)).toBe(startMs);
    expect(Date.parse(earlyWindow.end)).toBe(startMs + DAY_MS);

    // Near the dataset end
    const lateMs = Date.parse('2023-07-31T22:00:00Z');
    const lateWindow = calculateHistoryWindow(lateMs, startMs, endMs, DAY_MS);
    expect(Date.parse(lateWindow.end)).toBe(endMs);
    expect(Date.parse(lateWindow.start)).toBe(endMs - DAY_MS);
  });

  it('clamps timestamps to dataset bounds correctly', () => {
    expect(clampTimestamp(startMs - 5000, startMs, endMs)).toBe(startMs);
    expect(clampTimestamp(endMs + 10000, startMs, endMs)).toBe(endMs);
    const validMs = startMs + 3600000;
    expect(clampTimestamp(validMs, startMs, endMs)).toBe(validMs);
  });

  it('computes playhead X coordinate within SVG chart boundaries', () => {
    const xMin = startMs;
    const xMax = startMs + DAY_MS;
    // Exactly at xMin -> 58
    expect(calculatePlayheadX(xMin, xMin, xMax)).toBe(58);
    // Halfway -> 58 + 318 = 376
    expect(calculatePlayheadX(xMin + DAY_MS / 2, xMin, xMax)).toBe(376);
    // At xMax -> 58 + 636 = 694
    expect(calculatePlayheadX(xMax, xMin, xMax)).toBe(694);
    // Out of bounds (below xMin) clamps to 58
    expect(calculatePlayheadX(xMin - 10000, xMin, xMax)).toBe(58);
    // Out of bounds (above xMax) clamps to 694
    expect(calculatePlayheadX(xMax + 10000, xMin, xMax)).toBe(694);
  });

  it('computes inverted Y coordinate for soil humidity signals', () => {
    const yMin = 30;
    const yMax = 80;
    // Maximum value (80) -> top of plot area (22)
    expect(calculateValueY(80, yMin, yMax)).toBe(22);
    // Minimum value (30) -> bottom of plot area (22 + 162 = 184)
    expect(calculateValueY(30, yMin, yMax)).toBe(184);
    // Midpoint (55) -> 22 + 81 = 103
    expect(calculateValueY(55, yMin, yMax)).toBe(103);
    // Extreme value above yMax clamps to 22
    expect(calculateValueY(95, yMin, yMax)).toBe(22);
    // Extreme value below yMin clamps to 184
    expect(calculateValueY(15, yMin, yMax)).toBe(184);
  });
});

