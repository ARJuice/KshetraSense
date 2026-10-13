import type { FieldCellResult, SoilProperty } from './fieldTypes';

export type FieldLayer = SoilProperty | 'shi' | 'zone' | 'membership';

export const ZONE_COLORS = ['#2E6F5E', '#CC8C37', '#4C78A8', '#9B668F', '#6A8347', '#AC6251'];

const CONTINUOUS_COLORS = ['#3D687D', '#D5C27F', '#8B503E'];

export function getFieldLayerValue(cell: FieldCellResult, layer: FieldLayer, membershipCluster = 0): number | null {
  if (layer === 'zone') return cell.zoneId;
  if (layer === 'membership') return cell.clusterMemberships?.[membershipCluster] ?? null;
  if (layer === 'shi') return cell.shi;
  return cell.soilValues[layer];
}

export function getFieldLayerRange(
  cells: readonly FieldCellResult[],
  layer: FieldLayer,
  membershipCluster = 0,
): [number, number] {
  if (layer === 'membership') return [0, 1];
  const values = cells.map((cell) => getFieldLayerValue(cell, layer, membershipCluster)).filter((value): value is number => value !== null && Number.isFinite(value));
  if (!values.length) return [0, 1];
  return [Math.min(...values), Math.max(...values)];
}

function interpolateColor(left: string, right: string, amount: number): string {
  const channels = (hex: string) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const from = channels(left);
  const to = channels(right);
  const result = from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
  return `#${result.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function getFieldCellColor(
  cell: FieldCellResult,
  layer: FieldLayer,
  range: readonly [number, number],
  membershipCluster = 0,
): string {
  if (layer === 'zone') return ZONE_COLORS[cell.zoneId % ZONE_COLORS.length];
  const value = getFieldLayerValue(cell, layer, membershipCluster);
  if (value === null) return '#A9B7AF';
  const normalized = range[1] > range[0] ? Math.max(0, Math.min(1, (value - range[0]) / (range[1] - range[0]))) : 0.5;
  return normalized <= 0.5
    ? interpolateColor(CONTINUOUS_COLORS[0], CONTINUOUS_COLORS[1], normalized * 2)
    : interpolateColor(CONTINUOUS_COLORS[1], CONTINUOUS_COLORS[2], (normalized - 0.5) * 2);
}
