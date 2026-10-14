import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isPointInsideFieldBoundary, parseFieldBoundary } from './fieldGeometry';
import { buildFieldZoningRequest } from './fieldSamples';
import { parseSoilSampleCsv } from './soilSampleCsv';

const demoDirectory = fileURLToPath(new URL('../../../../data/demo/soil-zoning/', import.meta.url));

describe('soil-zoning demonstration inputs', () => {
  it('contains ten complete, correctly paired synthetic boundary and sample bundles', () => {
    const files = readdirSync(demoDirectory);
    const boundaries = files.filter((name) => name.endsWith('.geojson')).sort();
    const samples = files.filter((name) => name.endsWith('.csv')).sort();

    expect(boundaries).toHaveLength(10);
    expect(samples).toHaveLength(10);
    expect(boundaries.map((name) => name.replace('.geojson', '.csv'))).toEqual(samples);

    for (const boundaryFile of boundaries) {
      const stem = boundaryFile.replace('.geojson', '');
      const feature = JSON.parse(readFileSync(new URL(`../../../../data/demo/soil-zoning/${boundaryFile}`, import.meta.url), 'utf8'));
      const boundary = parseFieldBoundary(feature);
      const csv = readFileSync(new URL(`../../../../data/demo/soil-zoning/${stem}.csv`, import.meta.url), 'utf8');
      const parsed = parseSoilSampleCsv(csv);

      expect(feature.properties.dataStatus).toContain('SYNTHETIC DEMO ONLY');
      expect(feature.properties.pairedSamplesCsv).toBe(`${stem}.csv`);
      expect(parsed.errors).toEqual([]);
      expect(parsed.samples).toHaveLength(5);
      expect(new Set(parsed.samples.map(({ collectionDate }) => collectionDate))).toEqual(new Set([feature.properties.collectionDate]));
      expect(parsed.samples.every(({ labMethod, depthCm, standardUncertainty }) =>
        labMethod.includes('SYNTHETIC-DEMO') && depthCm === '0-15' && Object.keys(standardUncertainty).length === 5,
      )).toBe(true);
      expect(parsed.samples.every(({ longitude, latitude }) =>
        isPointInsideFieldBoundary([Number(longitude), Number(latitude)], boundary),
      )).toBe(true);

      expect(() => buildFieldZoningRequest(feature, parsed.samples)).not.toThrow();
    }
  });
});
