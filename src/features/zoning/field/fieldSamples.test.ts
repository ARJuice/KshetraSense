import { describe, expect, it } from 'vitest';
import { buildFieldZoningRequest, type SoilSampleDraft } from './fieldSamples';
import { parseSoilSampleCsv } from './soilSampleCsv';
import type { GeoJsonPolygon } from './fieldGeometry';
import type { FieldZoningOptions } from './fieldTypes';

const boundary: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [[[77, 13], [77.01, 13], [77.01, 13.01], [77, 13.01], [77, 13]]],
};

const sample = (id: string, longitude: number, latitude: number, depthCm = '0-15'): SoilSampleDraft => ({
  id,
  longitude: String(longitude),
  latitude: String(latitude),
  depthCm,
  collectionDate: '',
  labMethod: '',
  measurements: { pH: '6.3', ec: '1.2', nitrogen: '48', phosphorus: '20', potassium: '125' },
  standardUncertainty: {},
});

describe('soil-sample entry contract', () => {
  it('builds the fixed-unit field request from three measured samples', () => {
    const request = buildFieldZoningRequest(boundary, [
      sample('s1', 77.001, 13.001), sample('s2', 77.009, 13.001), sample('s3', 77.005, 13.009),
    ]);

    expect(request.samples).toHaveLength(3);
    expect(request.samples[0].measurements).toEqual({ pH: 6.3, ec: 1.2, nitrogen: 48, phosphorus: 20, potassium: 125 });
    expect(request.cellSizeM).toBe(10);
    expect(request.method).toBe('fcm');
  });

  it('rejects mismatched depths, incomplete values, and samples outside the boundary', () => {
    const samples = [sample('s1', 77.001, 13.001), sample('s2', 77.009, 13.001, '0-30'), sample('s3', 78, 13.009)];

    expect(() => buildFieldZoningRequest(boundary, samples)).toThrow(/same sampling depth/i);
    samples[1].depthCm = '0-15';
    expect(() => buildFieldZoningRequest(boundary, samples)).toThrow(/inside the field/i);
    samples[2].longitude = '77.005';
    samples[2].measurements.pH = '';
    expect(() => buildFieldZoningRequest(boundary, samples)).toThrow(/pH/i);
  });

  it('rejects impossible dates and effectively duplicate sample locations', () => {
    const samples = [sample('s1', 77.001, 13.001), sample('s2', 77.009, 13.001), sample('s3', 77.005, 13.009)];
    samples[0].collectionDate = '2026-02-30';
    expect(() => buildFieldZoningRequest(boundary, samples)).toThrow(/YYYY-MM-DD/i);
    samples[0].collectionDate = '';
    samples[1].longitude = '77.00100001';
    samples[1].latitude = '13.00100001';
    expect(() => buildFieldZoningRequest(boundary, samples)).toThrow(/0.01 m apart/i);
  });

  it('rejects invalid algorithm settings locally instead of sending an avoidable 422', () => {
    const samples = [sample('s1', 77.001, 13.001), sample('s2', 77.009, 13.001), sample('s3', 77.005, 13.009)];
    const options: FieldZoningOptions = {
      cellSizeM: 10, method: 'fcm', maxK: 6, seed: 42, mergeThresholdZ: 0.5, perturbationRuns: 10,
      fcm: { fuzziness: 2, maxIterations: 150, tolerance: 1e-5 },
    };

    expect(() => buildFieldZoningRequest(boundary, samples, { ...options, maxK: 1 })).toThrow(/K.*2.*6/i);
    expect(() => buildFieldZoningRequest(boundary, samples, { ...options, fcm: { ...options.fcm, fuzziness: 1 } })).toThrow(/fuzziness/i);
    expect(() => buildFieldZoningRequest(boundary, samples, { ...options, perturbationRuns: 51 })).toThrow(/sensitivity/i);
  });

  it('imports an explicit CSV format and preserves quoted laboratory methods', () => {
    const csv = [
      'id,latitude,longitude,depth_cm,ph,ec,nitrogen,phosphorus,potassium,collection_date,lab_method',
      's1,13.001,77.001,0-15,6.3,1.2,48,20,125,2026-09-01,"Lab A, method 1"',
      's2,13.002,77.002,0-15,6.4,1.3,49,21,126,,Lab B',
      's3,13.003,77.003,0-15,6.5,1.4,50,22,127,,Lab B',
    ].join('\n');

    const result = parseSoilSampleCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.samples[0].labMethod).toBe('Lab A, method 1');
    expect(result.samples[0].depthCm).toBe('0-15');
  });

  it('rejects missing columns and invalid measurements instead of filling them', () => {
    expect(parseSoilSampleCsv('id,latitude\ns1,13').errors.join(' ')).toContain('Missing required columns');
    const csv = [
      'id,latitude,longitude,depth_cm,ph,ec,nitrogen,phosphorus,potassium',
      's1,13.001,77.001,0-15,not-a-number,1,2,3,4',
    ].join('\n');
    expect(parseSoilSampleCsv(csv).errors.join(' ')).toContain('Row 2');
  });
});
