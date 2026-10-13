import { describe, expect, it } from 'vitest';
import { buildHumiditySegments } from './telemetryViewModel';
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
