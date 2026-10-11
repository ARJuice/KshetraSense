import type { ClusteringMethod, FieldGrid, ZoneSummary, ZoningResult } from '../domain/soil';

const SERVICE_URL = import.meta.env.VITE_ZONING_API_URL ?? 'http://127.0.0.1:8000';

export class ZoningApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ZoningApiError';
  }
}

export interface CropFitFactor {
  feature: string;
  observedValue: number | null;
  unit: string;
  state: 'within_contextual_range' | 'outside_contextual_range' | 'not_assessed';
  reason: string;
  supportedRange: { min: number; max: number; unit: string } | null;
  source: { label: string; url: string; context: string } | null;
}

export interface CropFitAssessment {
  crop: string;
  assessmentState: string;
  factors: CropFitFactor[];
  limitations: string[];
}

export interface CropFitResponse {
  profileVersion: string;
  assessments: CropFitAssessment[];
  dataLimitations: string[];
}

export async function runZoning(
  field: FieldGrid,
  method: ClusteringMethod,
  clusterCount: number,
): Promise<ZoningResult> {
  const response = await fetch(`${SERVICE_URL}/api/v1/zoning/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method,
      cluster_count: clusterCount,
      seed: 42,
      cells: field.cells.map((cell) => ({ id: cell.id, row: cell.row, column: cell.column, ...cell.values })),
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ZoningApiError(text || 'The zoning service could not process this field.', response.status);
  }
  return response.json() as Promise<ZoningResult>;
}

export async function evaluateCropFit(zone: ZoneSummary): Promise<CropFitResponse> {
  const response = await fetch(`${SERVICE_URL}/api/v1/crop-fit/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      measurements: {
        pH: zone.mean.ph,
        nitrogen: zone.mean.nitrogen,
        phosphorus: zone.mean.phosphorus,
        potassium: zone.mean.potassium,
        ec: zone.mean.ec,
        soilTemperature: zone.mean.soilTemperature,
      },
      measurementContext: { basis: `zone ${Number(zone.zoneId) + 1} mean values`, scope: 'selected zoning result' },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ZoningApiError(text || 'The crop-fit service could not evaluate this zone.', response.status);
  }
  return response.json() as Promise<CropFitResponse>;
}
