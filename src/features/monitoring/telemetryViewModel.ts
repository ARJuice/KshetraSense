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

export const DAY_MS = 24 * 60 * 60 * 1000;

export function clampTimestamp(timestampMs: number, startMs: number, endMs: number): number {
  return Math.max(startMs, Math.min(endMs, timestampMs));
}

export function calculateHistoryWindow(
  centerMs: number,
  startMs: number,
  endMs: number,
  windowSpanMs = DAY_MS,
): { start: string; end: string } {
  let start = Math.max(startMs, centerMs - windowSpanMs / 2);
  let end = Math.min(endMs, start + windowSpanMs);
  start = Math.max(startMs, end - windowSpanMs);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function calculatePlayheadX(
  currentMs: number,
  xMin: number,
  xMax: number,
  chartLeft = 58,
  chartWidth = 636,
): number {
  const span = xMax - xMin || 1;
  const ratio = Math.max(0, Math.min(1, (currentMs - xMin) / span));
  return chartLeft + ratio * chartWidth;
}

export function calculateValueY(
  value: number,
  yMin: number,
  yMax: number,
  chartTop = 22,
  chartHeight = 162,
): number {
  const span = yMax - yMin || 1;
  const ratio = Math.max(0, Math.min(1, (yMax - value) / span));
  return chartTop + ratio * chartHeight;
}

