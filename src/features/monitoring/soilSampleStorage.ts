import type { SoilMeasurement } from './types';

export const SOIL_SAMPLES_STORAGE_KEY = 'kshetrasense:soil-samples:v1';
export const LEGACY_SOIL_PRESETS_STORAGE_KEY = `${SOIL_SAMPLES_STORAGE_KEY}:legacy-presets`;

type SampleStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface SoilSampleLoadResult {
  samples: SoilMeasurement[];
  archivedPresetCount: number;
  migrationWarning: boolean;
}

const isSample = (value: unknown): value is SoilMeasurement => {
  if (!value || typeof value !== 'object') return false;
  const sample = value as Partial<SoilMeasurement>;
  return (
    typeof sample.sampleId === 'string' &&
    ['manual-entry', 'csv-import', 'seed-preset'].includes(sample.provenance ?? '') &&
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    Number.isFinite(sample.ph) &&
    Number.isFinite(sample.ecDsM) &&
    Number.isFinite(sample.nitrogenMgKg) &&
    Number.isFinite(sample.phosphorusMgKg) &&
    Number.isFinite(sample.potassiumMgKg)
  );
};

const readSamples = (storage: SampleStorage, key: string): SoilMeasurement[] => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter(isSample) : [];
  } catch {
    return [];
  }
};

export function loadStoredSoilSamples(storage: SampleStorage): SoilSampleLoadResult {
  const stored = readSamples(storage, SOIL_SAMPLES_STORAGE_KEY);
  const presets = stored.filter((sample) => sample.provenance === 'seed-preset');
  if (presets.length === 0) return { samples: stored, archivedPresetCount: 0, migrationWarning: false };

  const measured = stored.filter((sample) => sample.provenance !== 'seed-preset');
  try {
    const archive = readSamples(storage, LEGACY_SOIL_PRESETS_STORAGE_KEY);
    const archivedById = new Map([...archive, ...presets].map((sample) => [sample.sampleId, sample]));
    storage.setItem(LEGACY_SOIL_PRESETS_STORAGE_KEY, JSON.stringify([...archivedById.values()]));
    storage.setItem(SOIL_SAMPLES_STORAGE_KEY, JSON.stringify(measured));
    return { samples: measured, archivedPresetCount: presets.length, migrationWarning: false };
  } catch {
    return {
      samples: stored.map((sample) =>
        sample.provenance === 'seed-preset'
          ? {
              ...sample,
              source: 'Legacy synthetic demo preset — not a field measurement',
              labReportId: undefined,
            }
          : sample,
      ),
      archivedPresetCount: 0,
      migrationWarning: true,
    };
  }
}
