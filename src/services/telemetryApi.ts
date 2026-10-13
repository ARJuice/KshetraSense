const BASE_URL = (import.meta.env.VITE_ZONING_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
export const TELEMETRY_API_URL = `${BASE_URL}/v1/telemetry`;

export class TelemetryApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TelemetryApiError';
  }
}

export interface ReplayPlaybackState {
  index: number;
  timestamp: string;
  timestampMs: number;
  speed: number;
  isPlaying: boolean;
  startUtc: string;
  endUtc: string;
}

export interface Observation {
  observedAtUtc: string | null;
  humiditySignalPctRh?: number | null;
  temperatureC?: number | null;
  electricalConductivityUsCm?: number | null;
  batteryPercent?: number | null;
  relativeHumidityPctRh?: number | null;
  co2Ppm?: number | null;
  pressureHpa?: number | null;
  sharedAcrossLines?: boolean;
  humidityMeaning?: string;
}

export interface ReplayLine {
  lineId: number;
  historicalTreatment: string;
  soilObservation: Observation;
  sharedEnvironmentalObservation: Observation;
  waterMeter: {
    field: string;
    sourceReportedValue: number | null;
    sourceUnit: string;
    observedAtUtc: string | null;
    interpretation: string;
  };
  forecast?: {
    status: 'unavailable' | 'exploratory_only';
    reason?: string;
    modelVersion?: string;
    unit?: string;
    inputWindowSteps?: number;
    interpolatedInputValues?: number;
    inputResamplingNote?: string;
    pointForecasts?: Array<{ horizonHours: number; value: number }>;
    qualityDisposition?: Record<string, string>;
    holdoutMetrics?: Record<string, HorizonMetric>;
    limitations?: string[];
  };
  anomalyReview?: {
    status: 'unavailable' | 'no_candidate' | 'review_candidate';
    reason?: string;
    candidate?: boolean;
    score?: number | null;
    scoreMeaning?: string;
    reviewRequired?: boolean;
  };
}

export interface TelemetrySnapshot {
  replayLabel: string;
  simulatedTimestampUtc: string;
  playback: Pick<ReplayPlaybackState, 'speed' | 'isPlaying' | 'startUtc' | 'endUtc'>;
  lines: ReplayLine[];
}

export interface TelemetryHistorySample extends ReplayLine {
  timestampUtc: string;
}

export interface TelemetryHistory {
  lineId: number;
  historicalTreatment: string;
  replayLabel: string;
  truncated: boolean;
  samples: TelemetryHistorySample[];
}

export interface HorizonMetric {
  sampleCount: number;
  gru: { maePctRh: number; rmsePctRh: number; r2: number | null };
  persistenceBaseline: { maePctRh: number; rmsePctRh: number; r2: number | null };
  beatsPersistenceByMae: boolean;
  byLine?: Record<string, HorizonMetric>;
}

export interface TelemetryMetadata {
  dataset: {
    title: string;
    version: number;
    doi: string;
    sourceUrl: string;
    license: string;
    authors: string[];
    collectedPeriodLocal: string;
  };
  replayLabel: string;
  timeline: { startUtc: string; endUtc: string; stepMinutes: number; samples: number };
  featureUnits: Record<string, string>;
  lines: Array<{ lineId: number; treatment: string }>;
  dataQuality: {
    sha256Verified: boolean;
    environmentRows: number;
    environmentExcludedRows: number;
    soilExcludedRows: number;
    meterExcludedRows: number;
    environmentMedianIntervalMinutes: number;
    environmentBatteryMissingRows: number;
    lineStats: Record<string, {
      soilRows: number;
      soilMedianIntervalMinutes: number;
      soilBatteryMissingRows: number;
      meterRows: number;
      meterMedianIntervalMinutes: number;
      meterNegativeRegisterChanges: number;
      modelGridRowsWithCompleteFeatures: number;
      modelFeatureInterpolatedValues: number;
    }>;
    meterInterpretation: string;
    interpolation: string;
  };
  forecastModel: {
    modelVersion: string;
    framework: string;
    featureOrder: string[];
    windowSteps: number;
    horizonsHours: number[];
    holdoutMetrics: Record<string, HorizonMetric>;
    qualityDisposition: Record<string, string>;
    limitations: string[];
  };
  anomalyScreen: Record<string, unknown>;
  capabilities: {
    historicalReplay: boolean;
    liveTelemetry: boolean;
    fao56AdvisoryRequiresCalibratedVwc: boolean;
    actuation: boolean;
    zoneBinding: boolean;
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let message = body || `Telemetry API returned HTTP ${response.status}.`;
    try {
      message = JSON.parse(body).detail ?? message;
    } catch {
      // Keep the service's plain-text error.
    }
    throw new TelemetryApiError(message, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new TelemetryApiError('Telemetry API returned invalid JSON.', response.status);
  }
}

export async function getTelemetryMetadata(): Promise<TelemetryMetadata> {
  return readResponse(await fetch(`${TELEMETRY_API_URL}/metadata`));
}

export async function getTelemetryState(): Promise<ReplayPlaybackState> {
  return readResponse(await fetch(`${TELEMETRY_API_URL}/state`));
}

export async function getTelemetrySnapshot(): Promise<TelemetrySnapshot> {
  return readResponse(await fetch(`${TELEMETRY_API_URL}/stream`));
}

export type PlaybackControl =
  | { action: 'play' | 'pause' }
  | { action: 'seek'; timestamp: string }
  | { action: 'set_speed'; speed: 1 | 10 | 60 | 360 };

export async function controlTelemetryPlayback(control: PlaybackControl): Promise<ReplayPlaybackState> {
  return readResponse(await fetch(`${TELEMETRY_API_URL}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(control),
  }));
}

export async function getTelemetryHistory(
  lineId: number,
  start: string,
  end: string,
  limit = 1000,
): Promise<TelemetryHistory> {
  const query = new URLSearchParams({ line_id: String(lineId), start, end, limit: String(limit) });
  return readResponse(await fetch(`${TELEMETRY_API_URL}/history?${query}`));
}

export function telemetryWebSocketUrl(): string {
  const url = new URL(`${TELEMETRY_API_URL}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
