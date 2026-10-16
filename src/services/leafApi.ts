const BASE_URL = import.meta.env.VITE_ZONING_API_URL ?? 'http://127.0.0.1:8000';

export class LeafApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'LeafApiError';
  }
}

export interface LeafPrediction {
  topClass: string;
  reviewRequired: true;
  crop: string;
  condition: string;
  isHealthy: boolean;
  rankedClasses: Array<{ className: string; score: number }>;
  modelMetadata: {
    architecture: string;
    weightsVersion: string;
    classesCount: number;
    inputResolution: [number, number, number];
    preprocessingVersion: string;
    classMapVersion: string;
    reviewPolicyVersion: string;
    inferenceLatencyMs: number;
  };
  limitations: string[];
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.detail === 'string' ? body.detail : `Leaf diagnosis failed (HTTP ${response.status}).`;
  } catch {
    return `Leaf diagnosis failed (HTTP ${response.status}).`;
  }
}

function validatePrediction(data: unknown): LeafPrediction {
  const result = data as Partial<LeafPrediction> | null;
  const rows = result?.rankedClasses;
  const metadata = result?.modelMetadata;
  if (
    !result || typeof result.topClass !== 'string' || typeof result.crop !== 'string' ||
    typeof result.condition !== 'string' || result.reviewRequired !== true ||
    typeof result.isHealthy !== 'boolean' || !Array.isArray(rows) || rows.length !== 17 ||
    !metadata || metadata.architecture !== 'MobileNetV3-Small' || metadata.classesCount !== 17 ||
    !Array.isArray(metadata.inputResolution) || metadata.inputResolution.join(',') !== '224,224,3' ||
    typeof metadata.weightsVersion !== 'string' || typeof metadata.preprocessingVersion !== 'string' ||
    typeof metadata.classMapVersion !== 'string' || typeof metadata.reviewPolicyVersion !== 'string' ||
    !Number.isFinite(metadata.inferenceLatencyMs) || metadata.inferenceLatencyMs < 0 ||
    !Array.isArray(result.limitations) || !result.limitations.every((item) => typeof item === 'string')
  ) {
    throw new LeafApiError('Leaf diagnosis returned an invalid model result.');
  }
  const seen = new Set<string>();
  let previousScore = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (
      !row || typeof row.className !== 'string' || !row.className || seen.has(row.className) ||
      !Number.isFinite(row.score) || row.score < 0 || row.score > 1 || row.score > previousScore
    ) {
      throw new LeafApiError('Leaf diagnosis returned an invalid ranked class list.');
    }
    seen.add(row.className);
    previousScore = row.score;
  }
  if (rows[0].className !== result.topClass) {
    throw new LeafApiError('Leaf diagnosis returned a top class that does not match its ranking.');
  }
  return result as LeafPrediction;
}

export async function runLeafDiagnosis(file: File): Promise<LeafPrediction> {
  const formData = new FormData();
  formData.append('file', file);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/v1/leaf/predict`, { method: 'POST', body: formData });
  } catch {
    throw new LeafApiError(`Leaf diagnosis service is unreachable at ${BASE_URL}.`);
  }
  if (!response.ok) {
    const detail = await errorDetail(response);
    if (response.status === 413) throw new LeafApiError('Image exceeds the 10 MiB upload limit.', 413);
    if (response.status === 415) throw new LeafApiError('Use a JPEG or PNG image whose content matches its file type.', 415);
    if (response.status === 503) throw new LeafApiError('Verified leaf model weights are unavailable.', 503);
    throw new LeafApiError(detail, response.status);
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new LeafApiError('Leaf diagnosis returned invalid JSON.', response.status);
  }
  return validatePrediction(result);
}
