import type { ClusteringMethod, FieldGrid, ZoneSummary, ZoningResult } from '../domain/soil';
import type { FieldZoningRequest, FieldZoningResponse, SoilMeasurements } from '../features/zoning/field/fieldTypes';

const SERVICE_URL = import.meta.env.VITE_ZONING_API_URL ?? 'http://127.0.0.1:8000';

export class ZoningApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ZoningApiError';
  }
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  if (!body) return fallback;
  try {
    const detail = JSON.parse(body).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((item) => item.msg ?? JSON.stringify(item)).join(' ');
  } catch {
    return body;
  }
  return body;
}

export interface CropFitFactor {
  feature: string;
  observedValue: number | null;
  unit: string;
  state: 'within_reference_range' | 'below_reference_range' | 'above_reference_range' | 'context_required' | 'not_provided';
  reason: string;
  referenceText?: string;
  supportedRange: { min: number; max: number; unit: string } | null;
  source: { label: string; url: string; context: string } | null;
}

export interface CropFitAssessment {
  crop: string;
  name: string;
  scientificName: string;
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
  fuzziness = 2,
): Promise<ZoningResult> {
  const response = await fetch(`${SERVICE_URL}/api/v1/zoning/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method,
      cluster_count: clusterCount,
      seed: 42,
      fcm: { fuzziness },
      cells: field.cells.map((cell) => ({ id: cell.id, row: cell.row, column: cell.column, ...cell.values })),
    }),
  });
  if (!response.ok) {
    throw new ZoningApiError(await responseErrorMessage(response, 'The zoning service could not process this field.'), response.status);
  }
  return response.json() as Promise<ZoningResult>;
}

export async function runFieldZoning(request: FieldZoningRequest, signal?: AbortSignal): Promise<FieldZoningResponse> {
  const response = await fetch(`${SERVICE_URL}/v2/zoning/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    throw new ZoningApiError(await responseErrorMessage(response, 'The field zoning service could not process this analysis.'), response.status);
  }
  return response.json() as Promise<FieldZoningResponse>;
}

export interface CropFitMeasurementContext {
  sourceScope: string;
  soilTestMethod: string;
  sampleDepth: string;
  ecMethod: string;
}

export async function evaluateCropFit(
  measurements: ZoneSummary['mean'],
  context: CropFitMeasurementContext,
): Promise<CropFitResponse> {
  const response = await fetch(`${SERVICE_URL}/api/v1/crop-fit/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      measurements: {
        pH: measurements.ph,
        nitrogen: measurements.nitrogen,
        phosphorus: measurements.phosphorus,
        potassium: measurements.potassium,
        ec: measurements.ec,
        soilTemperature: measurements.soilTemperature,
      },
      measurementContext: context,
    }),
  });
  if (!response.ok) {
    throw new ZoningApiError(await responseErrorMessage(response, 'The crop-fit service could not evaluate this zone.'), response.status);
  }
  return response.json() as Promise<CropFitResponse>;
}

export async function evaluateFieldCropFit(
  measurements: SoilMeasurements,
  context: CropFitMeasurementContext,
): Promise<CropFitResponse> {
  const response = await fetch(`${SERVICE_URL}/v1/crop-fit/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ measurements, measurementContext: context }),
  });
  if (!response.ok) {
    throw new ZoningApiError(await responseErrorMessage(response, 'The crop-fit service could not evaluate this profile.'), response.status);
  }
  return response.json() as Promise<CropFitResponse>;
}
