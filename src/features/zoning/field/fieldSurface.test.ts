import { describe, expect, it } from 'vitest';
import { createLocalProjection, estimateGeometryTriangleCount, type GeoJsonGeometry, type GeoJsonPolygon } from './fieldGeometry';
import { buildFieldSurface, buildGeoJsonSurfaceGeometry } from './fieldSurface';
import type { FieldCellResult } from './fieldTypes';

const boundary: GeoJsonPolygon = { type: 'Polygon', coordinates: [[[77, 13], [77.001, 13], [77.001, 13.001], [77, 13.001], [77, 13]]] };
const cell: FieldCellResult = {
  cellId: 'cell-1', row: 0, column: 0, centerUtm: { eastingM: 500_000, northingM: 1_400_000 },
  centerWgs84: { longitude: 77.0005, latitude: 13.0005 },
  geometry: boundary, areaM2: 100, nearestSampleDistanceM: 5,
  soilValues: { pH: 6.5, ec: 1, nitrogen: 50, phosphorus: 20, potassium: 120 },
  valueKind: 'idw_interpolated_estimate', shi: 50,
  shiComponents: { pH: 1, ec: 0.9, nitrogen: 0.4, phosphorus: 0.4, potassium: 0.4 },
  clusterId: 0, zoneId: 0,
};

describe('batched field surface', () => {
  it('estimates geometry triangles including polygon holes and multipart cells', () => {
    const withHole: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [[77, 13], [77.004, 13], [77.004, 13.004], [77, 13.004], [77, 13]],
        [[77.001, 13.001], [77.003, 13.001], [77.003, 13.003], [77.001, 13.003], [77.001, 13.001]],
      ],
    };
    const multipart: GeoJsonGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [[[77, 13], [77.001, 13], [77, 13.001], [77, 13]]],
        [[[77.002, 13], [77.003, 13], [77.002, 13.001], [77.002, 13]]],
      ],
    };

    expect(estimateGeometryTriangleCount(boundary)).toBe(2);
    expect(estimateGeometryTriangleCount(withHole)).toBe(8);
    expect(estimateGeometryTriangleCount(multipart)).toBe(2);
  });

  it('triangulates clipped cell geometry into one mesh with a cell ID for each face', () => {
    const surface = buildFieldSurface([cell], createLocalProjection(boundary), 'pH', [0, 14], 0, null);

    expect(surface.geometry.getAttribute('position').count).toBe(6);
    expect(surface.triangleCellIds).toEqual(['cell-1', 'cell-1']);
    surface.geometry.dispose();
  });

  it('keeps polygon holes empty in the rendered boundary mesh', () => {
    const polygon: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [[77, 13], [77.004, 13], [77.004, 13.004], [77, 13.004], [77, 13]],
        [[77.001, 13.001], [77.003, 13.001], [77.003, 13.003], [77.001, 13.003], [77.001, 13.001]],
      ],
    };
    const projection = createLocalProjection(polygon);
    const geometry = buildGeoJsonSurfaceGeometry(polygon, projection);
    const positions = geometry.getAttribute('position');
    let area = 0;
    for (let index = 0; index < positions.count; index += 3) {
      const x1 = positions.getX(index), z1 = positions.getZ(index);
      const x2 = positions.getX(index + 1), z2 = positions.getZ(index + 1);
      const x3 = positions.getX(index + 2), z3 = positions.getZ(index + 2);
      area += Math.abs((x2 - x1) * (z3 - z1) - (x3 - x1) * (z2 - z1)) / 2;
    }
    const expected = (projection.extent.maxX - projection.extent.minX) * (projection.extent.maxY - projection.extent.minY) * 0.75;

    expect(area).toBeCloseTo(expected, 2);
    geometry.dispose();
  });
});
