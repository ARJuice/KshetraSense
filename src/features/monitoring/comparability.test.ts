import { describe, expect, it } from 'vitest';
import { checkObservationComparability, groupSamplesForTrend } from './comparability';
import type { SoilMeasurement } from './types';

const makeSample = (overrides: Partial<SoilMeasurement>): SoilMeasurement => ({
  sampleId: 'TEST-01',
  collectedAt: '2026-10-01',
  latitude: 12.9716,
  longitude: 77.5946,
  ph: 6.5,
  ecDsM: 1.2,
  nitrogenMgKg: 50,
  phosphorusMgKg: 25,
  potassiumMgKg: 200,
  source: 'Lab A',
  provenance: 'manual-entry',
  recordedAt: '2026-10-01T10:00:00Z',
  ...overrides,
});

describe('checkObservationComparability (FM-02)', () => {
  it('considers repeated readings comparable when depth, method, and parameter match', () => {
    const s1 = makeSample({ sampleId: 'S1', collectedAt: '2026-09-01', ph: 6.2, depthInterval: '0-15 cm', method: '1:2.5 water' });
    const s2 = makeSample({ sampleId: 'S2', collectedAt: '2026-10-01', ph: 6.5, depthInterval: '0-15 cm', method: '1:2.5 water' });

    const result = checkObservationComparability(s1, s2, 'ph');
    expect(result.comparable).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects comparability when sampling depths differ', () => {
    const s1 = makeSample({ sampleId: 'S1', collectedAt: '2026-09-01', ph: 6.2, depthInterval: '0-15 cm' });
    const s2 = makeSample({ sampleId: 'S2', collectedAt: '2026-10-01', ph: 6.8, depthInterval: '15-30 cm' });

    const result = checkObservationComparability(s1, s2, 'ph');
    expect(result.comparable).toBe(false);
    expect(result.reason).toContain('Sampling depths differ');
  });

  it('rejects comparability when analytical methods differ', () => {
    const s1 = makeSample({ sampleId: 'S1', collectedAt: '2026-09-01', nitrogenMgKg: 45, method: 'Bray-1' });
    const s2 = makeSample({ sampleId: 'S2', collectedAt: '2026-10-01', nitrogenMgKg: 55, method: 'Mehlich-3' });

    const result = checkObservationComparability(s1, s2, 'nitrogenMgKg');
    expect(result.comparable).toBe(false);
    expect(result.reason).toContain('Analytical methods differ');
  });

  it('rejects moisture comparability when moisture units differ', () => {
    const s1 = makeSample({ sampleId: 'S1', moisturePercentage: 22, moistureUnit: '% gravimetric' });
    const s2 = makeSample({ sampleId: 'S2', moisturePercentage: 30, moistureUnit: '% volumetric' });

    const result = checkObservationComparability(s1, s2, 'moisturePercentage');
    expect(result.comparable).toBe(false);
    expect(result.reason).toContain('Moisture units differ');
  });
});

describe('groupSamplesForTrend (FM-02)', () => {
  it('groups multiple comparable readings into a single trend series', () => {
    const samples = [
      makeSample({ sampleId: 'S1', collectedAt: '2026-08-01', ph: 6.1, depthInterval: '0-15 cm', method: '1:2.5' }),
      makeSample({ sampleId: 'S2', collectedAt: '2026-09-01', ph: 6.3, depthInterval: '0-15 cm', method: '1:2.5' }),
      makeSample({ sampleId: 'S3', collectedAt: '2026-10-01', ph: 6.5, depthInterval: '0-15 cm', method: '1:2.5' }),
    ];

    const groups = groupSamplesForTrend(samples, 'ph');
    expect(groups).toHaveLength(1);
    expect(groups[0].isComparable).toBe(true);
    expect(groups[0].readings).toHaveLength(3);
    expect(groups[0].readings[0].value).toBe(6.1);
    expect(groups[0].readings[2].value).toBe(6.5);
  });

  it('separates readings into distinct series with disclosure when depths differ', () => {
    const samples = [
      makeSample({ sampleId: 'S1', collectedAt: '2026-08-01', ph: 6.1, depthInterval: '0-15 cm', method: '1:2.5' }),
      makeSample({ sampleId: 'S2', collectedAt: '2026-09-01', ph: 7.0, depthInterval: '15-30 cm', method: '1:2.5' }),
    ];

    const groups = groupSamplesForTrend(samples, 'ph');
    expect(groups).toHaveLength(2);
    expect(groups[0].incomparabilityReason).toContain('different depths or methods');
  });
});
