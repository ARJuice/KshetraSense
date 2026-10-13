import { parseCsvRows } from '../fieldImport';
import { SOIL_PROPERTIES, createBlankSoilSample, type SoilSampleDraft } from './fieldSamples';
import type { SoilProperty } from './fieldTypes';

const REQUIRED_HEADERS = ['id', 'latitude', 'longitude', 'depth_cm', 'ph', 'ec', 'nitrogen', 'phosphorus', 'potassium'] as const;
const OPTIONAL_UNCERTAINTY_HEADERS: Record<string, SoilProperty> = {
  uncertainty_ph: 'pH', uncertainty_ec: 'ec', uncertainty_nitrogen: 'nitrogen',
  uncertainty_phosphorus: 'phosphorus', uncertainty_potassium: 'potassium',
};

export interface SoilSampleCsvResult {
  samples: SoilSampleDraft[];
  errors: string[];
}

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function parseSoilSampleCsv(content: string): SoilSampleCsvResult {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return { samples: [], errors: ['The CSV needs a header row and at least three samples.'] };
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) return { samples: [], errors: [`Missing required columns: ${missing.join(', ')}.`] };
  if (new Set(headers).size !== headers.length) return { samples: [], errors: ['CSV column names must be unique.'] };

  const samples: SoilSampleDraft[] = [];
  const errors: string[] = [];
  for (const [index, row] of rows.slice(1).entries()) {
    const line = index + 2;
    if (row.length > headers.length) errors.push(`Row ${line}: has more values than the header row.`);
    const record = Object.fromEntries(headers.map((header, position) => [header, (row[position] ?? '').trim()]));
    const draft = createBlankSoilSample(record.id || `sample-${line}`);
    draft.latitude = record.latitude ?? '';
    draft.longitude = record.longitude ?? '';
    draft.depthCm = record.depth_cm ?? '';
    draft.collectionDate = record.collection_date ?? '';
    draft.labMethod = record.lab_method ?? '';
    draft.measurements = {
      pH: record.ph ?? '', ec: record.ec ?? '', nitrogen: record.nitrogen ?? '',
      phosphorus: record.phosphorus ?? '', potassium: record.potassium ?? '',
    };
    for (const property of SOIL_PROPERTIES) {
      const header = Object.entries(OPTIONAL_UNCERTAINTY_HEADERS).find(([, key]) => key === property)?.[0];
      if (header && record[header]) draft.standardUncertainty[property] = record[header];
    }
    const numericValues = [draft.latitude, draft.longitude, ...Object.values(draft.measurements)];
    if (!draft.id.trim() || !draft.depthCm.trim() || numericValues.some((value) => !value.trim() || !Number.isFinite(Number(value)))) {
      errors.push(`Row ${line}: provide an ID, coordinates, depth, and finite pH/EC/N/P/K measurements.`);
    }
    if (draft.collectionDate && !validDate(draft.collectionDate)) errors.push(`Row ${line}: collection_date must use YYYY-MM-DD.`);
    samples.push(draft);
  }
  if (samples.length < 3 || samples.length > 50) errors.push('A soil-sample CSV must contain between 3 and 50 records.');
  return { samples: errors.length ? [] : samples, errors: errors.slice(0, 8) };
}
