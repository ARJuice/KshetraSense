import type { SoilMeasurement } from './types';

export const SOIL_CSV_HEADERS = [
  'sample_id',
  'collected_at',
  'latitude',
  'longitude',
  'ph',
  'ec_ds_m',
  'nitrogen_mg_kg',
  'phosphorus_mg_kg',
  'potassium_mg_kg',
  'temperature_c',
  'source',
  'lab_report_id',
  'notes',
] as const;

export type CsvSampleRow = Record<string, string>;

export interface RowValidationResult {
  value?: SoilMeasurement;
  errors: string[];
}

const REQUIRED_HEADERS = [
  'sample_id',
  'collected_at',
  'latitude',
  'longitude',
  'ph',
  'ec_ds_m',
  'nitrogen_mg_kg',
  'phosphorus_mg_kg',
  'potassium_mg_kg',
  'source',
] as const;

export const getMissingRequiredHeaders = (headers: string[]) =>
  REQUIRED_HEADERS.filter((header) => !headers.includes(header));

const parseFiniteNumber = (value: string, field: string, errors: string[]) => {
  if (!value.trim()) {
    errors.push(`${field} is required.`);
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push(`${field} must be a number.`);
    return undefined;
  }
  return number;
};

const within = (
  value: number | undefined,
  min: number,
  max: number,
  field: string,
  errors: string[],
) => {
  if (value === undefined) return;
  if (value < min || value > max) {
    errors.push(`${field} must be between ${min} and ${max}.`);
  }
};

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const validateSoilSampleRow = (
  row: CsvSampleRow,
  provenance: SoilMeasurement['provenance'],
  recordedAt = new Date().toISOString(),
): RowValidationResult => {
  const errors: string[] = [];
  const sampleId = row.sample_id?.trim();
  const collectedAt = row.collected_at?.trim();
  const source = row.source?.trim();

  if (!sampleId) errors.push('sample_id is required.');
  if (!collectedAt || !validDate(collectedAt)) errors.push('collected_at must be an ISO date (YYYY-MM-DD).');
  if (!source) errors.push('source is required.');

  const latitude = parseFiniteNumber(row.latitude, 'latitude', errors);
  const longitude = parseFiniteNumber(row.longitude, 'longitude', errors);
  const ph = parseFiniteNumber(row.ph, 'ph', errors);
  const ecDsM = parseFiniteNumber(row.ec_ds_m, 'ec_ds_m', errors);
  const nitrogenMgKg = parseFiniteNumber(row.nitrogen_mg_kg, 'nitrogen_mg_kg', errors);
  const phosphorusMgKg = parseFiniteNumber(row.phosphorus_mg_kg, 'phosphorus_mg_kg', errors);
  const potassiumMgKg = parseFiniteNumber(row.potassium_mg_kg, 'potassium_mg_kg', errors);
  const temperatureInput = row.temperature_c?.trim();
  const temperatureC = temperatureInput ? parseFiniteNumber(temperatureInput, 'temperature_c', errors) : undefined;

  within(latitude, -90, 90, 'latitude', errors);
  within(longitude, -180, 180, 'longitude', errors);
  within(ph, 0, 14, 'ph', errors);
  within(ecDsM, 0, 100, 'ec_ds_m', errors);
  within(nitrogenMgKg, 0, 10000, 'nitrogen_mg_kg', errors);
  within(phosphorusMgKg, 0, 10000, 'phosphorus_mg_kg', errors);
  within(potassiumMgKg, 0, 10000, 'potassium_mg_kg', errors);
  within(temperatureC, -50, 80, 'temperature_c', errors);

  if (errors.length > 0 || latitude === undefined || longitude === undefined || ph === undefined || ecDsM === undefined || nitrogenMgKg === undefined || phosphorusMgKg === undefined || potassiumMgKg === undefined || !sampleId || !collectedAt || !source) {
    return { errors };
  }

  return {
    errors: [],
    value: {
      sampleId,
      collectedAt,
      latitude,
      longitude,
      ph,
      ecDsM,
      nitrogenMgKg,
      phosphorusMgKg,
      potassiumMgKg,
      temperatureC,
      source,
      labReportId: row.lab_report_id?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
      provenance,
      recordedAt,
    },
  };
};
