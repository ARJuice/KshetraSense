export const FEATURE_KEYS = ['ph', 'nitrogen', 'phosphorus', 'potassium', 'ec', 'soilTemperature'] as const;

export type SoilFeatureKey = (typeof FEATURE_KEYS)[number];

export interface SoilFeatureDefinition {
  label: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  precision: number;
}

export const SOIL_FEATURES: Record<SoilFeatureKey, SoilFeatureDefinition> = {
  ph: { label: 'Soil pH', shortLabel: 'pH', unit: '', min: 3.5, max: 9, precision: 1 },
  nitrogen: { label: 'Nitrogen', shortLabel: 'N', unit: 'mg/kg', min: 0, max: 180, precision: 0 },
  phosphorus: { label: 'Phosphorus', shortLabel: 'P', unit: 'mg/kg', min: 0, max: 120, precision: 0 },
  potassium: { label: 'Potassium', shortLabel: 'K', unit: 'mg/kg', min: 0, max: 280, precision: 0 },
  ec: { label: 'Electrical conductivity', shortLabel: 'EC', unit: 'dS/m', min: 0, max: 5, precision: 2 },
  soilTemperature: { label: 'Soil temperature', shortLabel: 'Temp', unit: '°C', min: 5, max: 40, precision: 1 },
};

export interface SoilCell {
  id: string;
  row: number;
  column: number;
  values: Record<SoilFeatureKey, number>;
}

export interface FieldGrid {
  name: string;
  source: 'starter' | 'imported' | 'manual';
  rows: number;
  columns: number;
  cells: SoilCell[];
}

export type ClusteringMethod = 'kmeans' | 'fuzzy-c-means';

export interface ZoneSummary {
  zoneId: number;
  cellCount: number;
  mean: Record<SoilFeatureKey, number>;
  variance: number;
}

export interface ZoningResult {
  runId: string;
  method: ClusteringMethod;
  clusterCount: number;
  assignments: Record<string, number>;
  memberships?: Record<string, number[]>;
  zones: ZoneSummary[];
  silhouetteScore?: number;
  inputFingerprint: string;
  createdAt: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** A deterministic practice workspace. Results are computed from these values by the zoning service. */
export function createStarterField(rows = 14, columns = 18): FieldGrid {
  const cells: SoilCell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column / Math.max(columns - 1, 1);
      const y = row / Math.max(rows - 1, 1);
      const pocket = Math.exp(-(((x - 0.3) ** 2 + (y - 0.35) ** 2) / 0.025));
      const saline = Math.exp(-(((x - 0.78) ** 2 + (y - 0.68) ** 2) / 0.035));
      const ripple = Math.sin(row * 0.81 + column * 1.37);
      cells.push({
        id: `r${row + 1}-c${column + 1}`,
        row: row + 1,
        column: column + 1,
        values: {
          ph: Number(clamp(6.65 - pocket * 0.7 + saline * 0.22 + ripple * 0.06, 3.5, 9).toFixed(1)),
          nitrogen: Math.round(clamp(82 - pocket * 38 + ripple * 5, 0, 180)),
          phosphorus: Math.round(clamp(43 - pocket * 13 + ripple * 3, 0, 120)),
          potassium: Math.round(clamp(164 - pocket * 20 + ripple * 7, 0, 280)),
          ec: Number(clamp(1.05 + saline * 1.7 + pocket * 0.1, 0, 5).toFixed(2)),
          soilTemperature: Number((22.8 + y * 2.3 + ripple * 0.45).toFixed(1)),
        },
      });
    }
  }
  return { name: 'Practice field', source: 'starter', rows, columns, cells };
}

export function formatSoilValue(feature: SoilFeatureKey, value: number): string {
  const definition = SOIL_FEATURES[feature];
  return `${value.toFixed(definition.precision)}${definition.unit ? ` ${definition.unit}` : ''}`;
}

export function featureColour(feature: SoilFeatureKey, value: number): string {
  const definition = SOIL_FEATURES[feature];
  const amount = clamp((value - definition.min) / (definition.max - definition.min), 0, 1);
  if (feature === 'ec') return `hsl(${125 - amount * 105} 68% ${44 + amount * 10}%)`;
  if (feature === 'ph') return `hsl(${28 + amount * 128} 57% ${35 + amount * 16}%)`;
  return `hsl(${212 - amount * 142} 63% ${30 + amount * 20}%)`;
}
