import { describe, expect, it } from 'vitest';
import { isPointInsideFieldBoundary, parseFieldBoundary } from './fieldGeometry';

const boundary = {
  type: 'Polygon',
  coordinates: [
    [[77, 13], [77.01, 13], [77.01, 13.01], [77, 13.01], [77, 13]],
    [[77.004, 13.004], [77.006, 13.004], [77.006, 13.006], [77.004, 13.006], [77.004, 13.004]],
  ],
} as const;

describe('field boundary input', () => {
  it('accepts a Polygon Feature and keeps its polygon geometry', () => {
    const parsed = parseFieldBoundary({ type: 'Feature', properties: {}, geometry: boundary });

    expect(parsed.type).toBe('Polygon');
    expect(parsed.coordinates).toHaveLength(2);
  });

  it('rejects an open ring and coordinates outside the supported CRS range', () => {
    expect(() => parseFieldBoundary({ ...boundary, coordinates: [boundary.coordinates[0].slice(0, -1)] })).toThrow(/closed/i);
    expect(() => parseFieldBoundary({ type: 'Polygon', coordinates: [[[77, 90], [78, 90], [78, 91], [77, 90]]] })).toThrow(/WGS84/i);
  });

  it('accepts points in the field but excludes its hole', () => {
    const parsed = parseFieldBoundary(boundary);

    expect(isPointInsideFieldBoundary([77.002, 13.002], parsed)).toBe(true);
    expect(isPointInsideFieldBoundary([77.005, 13.005], parsed)).toBe(false);
    expect(isPointInsideFieldBoundary([77.004, 13.005], parsed)).toBe(true);
  });
});
