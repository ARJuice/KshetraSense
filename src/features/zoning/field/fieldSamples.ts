import { createLocalProjection, isPointInsideFieldBoundary, parseFieldBoundary, type Position } from './fieldGeometry';
import type { FieldZoningOptions, FieldZoningRequest, SoilMeasurements, SoilProperty, SoilSampleInput } from './fieldTypes';

export interface SoilSampleDraft {
  id: string;
  latitude: string;
  longitude: string;
  depthCm: string;
  collectionDate: string;
  labMethod: string;
  measurements: Record<SoilProperty, string>;
  standardUncertainty: Partial<Record<SoilProperty, string>>;
}

export const SOIL_PROPERTIES: SoilProperty[] = ['pH', 'ec', 'nitrogen', 'phosphorus', 'potassium'];

export function createBlankSoilSample(id: string): SoilSampleDraft {
  return {
    id, latitude: '', longitude: '', depthCm: '', collectionDate: '', labMethod: '',
    measurements: { pH: '', ec: '', nitrogen: '', phosphorus: '', potassium: '' },
    standardUncertainty: {},
  };
}

const parseNumber = (value: string, label: string): number => {
  if (!value.trim()) throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
};

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function samplePosition(sample: SoilSampleDraft): Position {
  const latitude = parseNumber(sample.latitude, `Sample ${sample.id} latitude`);
  const longitude = parseNumber(sample.longitude, `Sample ${sample.id} longitude`);
  if (latitude < -80 || latitude > 84 || longitude < -180 || longitude > 180) {
    throw new Error(`Sample ${sample.id} coordinates are outside the supported WGS84 range.`);
  }
  return [longitude, latitude];
}

function validateOptions(options: FieldZoningOptions): void {
  if (options.cellSizeM !== 5 && options.cellSizeM !== 10) throw new Error('Grid cell size must be 5 or 10 metres.');
  if (options.method !== 'kmeans' && options.method !== 'fcm') throw new Error('Choose K-means++ or Fuzzy C-means.');
  if (!Number.isInteger(options.maxK) || options.maxK < 2 || options.maxK > 6) throw new Error('Maximum tested K must be from 2 to 6.');
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 4_294_967_295) throw new Error('Random seed must be an integer from 0 to 4,294,967,295.');
  if (!Number.isFinite(options.mergeThresholdZ) || options.mergeThresholdZ < 0 || options.mergeThresholdZ > 2) throw new Error('Merge threshold Z must be from 0 to 2.');
  if (!Number.isInteger(options.perturbationRuns) || options.perturbationRuns < 0 || options.perturbationRuns > 50) throw new Error('Sensitivity reruns must be an integer from 0 to 50.');
  if (!Number.isFinite(options.fcm.fuzziness) || options.fcm.fuzziness <= 1 || options.fcm.fuzziness > 5) throw new Error('FCM fuzziness must be greater than 1 and at most 5.');
  if (!Number.isInteger(options.fcm.maxIterations) || options.fcm.maxIterations < 1 || options.fcm.maxIterations > 1000) throw new Error('FCM iteration limit must be an integer from 1 to 1,000.');
  if (!Number.isFinite(options.fcm.tolerance) || options.fcm.tolerance <= 0 || options.fcm.tolerance > 0.1) throw new Error('FCM tolerance must be greater than 0 and at most 0.1.');
}

export function buildFieldZoningRequest(
  inputBoundary: unknown,
  drafts: readonly SoilSampleDraft[],
  options: FieldZoningOptions = {
    cellSizeM: 10, method: 'fcm', maxK: 6, seed: 42, mergeThresholdZ: 0.5,
    perturbationRuns: 10, fcm: { fuzziness: 2, maxIterations: 150, tolerance: 1e-5 },
  },
): FieldZoningRequest {
  const boundary = parseFieldBoundary(inputBoundary);
  validateOptions(options);
  if (drafts.length < 3 || drafts.length > 50) throw new Error('Enter between 3 and 50 soil samples before running analysis.');
  const ids = drafts.map(({ id }) => id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Every soil sample needs a unique, non-empty ID.');

  const depths = drafts.map(({ depthCm }) => depthCm.trim());
  if (depths.some((depth) => !depth)) throw new Error('Enter an explicit sampling depth for every soil sample.');
  if (new Set(depths.map((depth) => depth.toLocaleLowerCase())).size !== 1) throw new Error('All soil samples must use the same sampling depth.');

  const projection = createLocalProjection(boundary);
  const positions = drafts.map(samplePosition);
  const samples: SoilSampleInput[] = drafts.map((sample, index) => {
    const position = positions[index];
    if (!isPointInsideFieldBoundary(position, boundary)) throw new Error(`Sample ${sample.id} must be inside the field boundary and outside any hole.`);
    const measurements = {} as SoilMeasurements;
    for (const property of SOIL_PROPERTIES) {
      const value = parseNumber(sample.measurements[property], `Sample ${sample.id} ${property}`);
      if (property === 'pH' ? value < 0 || value > 14 : value < 0) {
        throw new Error(`Sample ${sample.id} ${property} is outside the supported value range.`);
      }
      measurements[property] = value;
    }
    const standardUncertainty: Partial<Record<SoilProperty, number>> = {};
    for (const [property, raw] of Object.entries(sample.standardUncertainty)) {
      if (raw?.trim()) {
        const uncertainty = parseNumber(raw, `Sample ${sample.id} ${property} uncertainty`);
        if (uncertainty < 0) throw new Error(`Sample ${sample.id} ${property} uncertainty must not be negative.`);
        standardUncertainty[property as SoilProperty] = uncertainty;
      }
    }
    const collectionDate = sample.collectionDate.trim();
    if (collectionDate && !isValidDate(collectionDate)) {
      throw new Error(`Sample ${sample.id} collection date must use YYYY-MM-DD.`);
    }
    const labMethod = sample.labMethod.trim();
    if (labMethod.length > 128) throw new Error(`Sample ${sample.id} laboratory method must be 128 characters or fewer.`);
    return {
      id: ids[index], longitude: position[0], latitude: position[1], depthCm: depths[index], measurements,
      ...(collectionDate ? { collectionDate } : {}),
      ...(labMethod ? { labMethod } : {}),
      ...(Object.keys(standardUncertainty).length ? { standardUncertainty } : {}),
    };
  });

  const projected = positions.map(projection.project);
  for (let left = 0; left < projected.length; left += 1) {
    for (let right = left + 1; right < projected.length; right += 1) {
      if (Math.hypot(projected[left].x - projected[right].x, projected[left].y - projected[right].y) <= 0.01) {
        throw new Error('Soil sample locations must be more than 0.01 m apart.');
      }
    }
  }
  return { boundary, samples, ...options };
}
