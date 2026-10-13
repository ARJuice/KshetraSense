import { describe, expect, it } from 'vitest';
import { getFieldCellColor, getFieldLayerRange } from './fieldDisplay';
import type { FieldCellResult } from './fieldTypes';

const cell = (overrides: Partial<FieldCellResult> = {}): FieldCellResult => ({
  cellId: 'cell-1', row: 0, column: 0, centerUtm: { eastingM: 0, northingM: 0 },
  centerWgs84: { longitude: 77, latitude: 13 },
  geometry: { type: 'Polygon', coordinates: [] }, areaM2: 100, nearestSampleDistanceM: 5,
  soilValues: { pH: 6, ec: 1, nitrogen: 20, phosphorus: 15, potassium: 90 },
  valueKind: 'idw_interpolated_estimate', shi: 45,
  shiComponents: { pH: 0.8, ec: 0.9, nitrogen: 0.2, phosphorus: 0.3, potassium: 0.4 },
  clusterId: 0, zoneId: 0, clusterMemberships: [0.8, 0.2], ...overrides,
});

describe('field result layers', () => {
  it('derives ranges from returned cell values without assigning agronomic labels', () => {
    const cells = [cell(), cell({ cellId: 'cell-2', soilValues: { ...cell().soilValues, pH: 8 } })];

    expect(getFieldLayerRange(cells, 'pH')).toEqual([6, 8]);
    expect(getFieldLayerRange(cells, 'membership', 1)).toEqual([0, 1]);
  });

  it('uses a stable sequential scale for continuous fields and a categorical scale for zones', () => {
    expect(getFieldCellColor(cell({ soilValues: { ...cell().soilValues, pH: 0 } }), 'pH', [0, 14])).toBe('#3D687D');
    expect(getFieldCellColor(cell({ soilValues: { ...cell().soilValues, pH: 14 } }), 'pH', [0, 14])).toBe('#8B503E');
    expect(getFieldCellColor(cell({ zoneId: 1 }), 'zone', [0, 1])).not.toBe(getFieldCellColor(cell(), 'zone', [0, 1]));
  });
});
