import type { TelemetryHistorySample } from '../../services/telemetryApi';

export interface HumidityPoint {
  timestampMs: number;
  value: number;
}

export function buildHumiditySegments(
  samples: TelemetryHistorySample[],
  maxGapMs = 30 * 60 * 1000,
): HumidityPoint[][] {
  const points = samples
    .flatMap((sample) => {
      const value = sample.soilObservation.humiditySignalPctRh;
      const observedAt = sample.soilObservation.observedAtUtc;
      const timestampMs = observedAt ? Date.parse(observedAt) : Number.NaN;
      return typeof value === 'number' && Number.isFinite(value) && Number.isFinite(timestampMs)
        ? [{ timestampMs, value }]
        : [];
    })
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const segments: HumidityPoint[][] = [];
  for (const point of points) {
    const current = segments[segments.length - 1];
    if (!current || point.timestampMs - current[current.length - 1].timestampMs > maxGapMs) {
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  return segments;
}
