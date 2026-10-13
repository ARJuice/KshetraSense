import { describe, expect, it } from 'vitest';
import {
  LEGACY_SOIL_PRESETS_STORAGE_KEY,
  loadStoredSoilSamples,
  SOIL_SAMPLES_STORAGE_KEY,
} from './soilSampleStorage';
import type { SoilMeasurement } from './types';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const sample = (sampleId: string, provenance: SoilMeasurement['provenance']): SoilMeasurement => ({
  sampleId,
  collectedAt: '2026-10-01',
  latitude: 12,
  longitude: 77,
  ph: 6.5,
  ecDsM: 0.4,
  nitrogenMgKg: 20,
  phosphorusMgKg: 10,
  potassiumMgKg: 15,
  source: 'Test lab',
  provenance,
  recordedAt: '2026-10-01T00:00:00Z',
});

describe('stored soil sample migration', () => {
  it('starts empty and respects a deliberately empty stored list', () => {
    const storage = new MemoryStorage();
    expect(loadStoredSoilSamples(storage).samples).toEqual([]);
    storage.setItem(SOIL_SAMPLES_STORAGE_KEY, '[]');
    expect(loadStoredSoilSamples(storage).samples).toEqual([]);
  });

  it('archives legacy presets while preserving manual and CSV records', () => {
    const storage = new MemoryStorage();
    const manual = sample('M-1', 'manual-entry');
    const imported = sample('C-1', 'csv-import');
    const legacy = sample('PB-WHT-01', 'seed-preset');
    storage.setItem(SOIL_SAMPLES_STORAGE_KEY, JSON.stringify([manual, imported, legacy]));

    const result = loadStoredSoilSamples(storage);

    expect(result.samples).toEqual([manual, imported]);
    expect(result.archivedPresetCount).toBe(1);
    expect(result.migrationWarning).toBe(false);
    expect(JSON.parse(storage.getItem(SOIL_SAMPLES_STORAGE_KEY) ?? 'null')).toEqual([manual, imported]);
    expect(JSON.parse(storage.getItem(LEGACY_SOIL_PRESETS_STORAGE_KEY) ?? 'null')).toEqual([legacy]);
  });

  it('keeps legacy records visible but sanitizes false lab attribution if archival fails', () => {
    const legacy = { ...sample('PB-WHT-01', 'seed-preset'), source: 'Named fake lab' };
    const storage = new MemoryStorage();
    storage.setItem(SOIL_SAMPLES_STORAGE_KEY, JSON.stringify([legacy]));
    storage.setItem = () => { throw new Error('storage full'); };

    const result = loadStoredSoilSamples(storage);

    expect(result.migrationWarning).toBe(true);
    expect(result.samples[0].provenance).toBe('seed-preset');
    expect(result.samples[0].source).toContain('not a field measurement');
  });
});
