import {
  ClusteringMethod,
  ClusterCount,
  ScenarioId,
  SoilCell,
  SoilFeatureKey,
  ZoneSummary,
  ZoningSampleView,
} from '../../features/field/types';
import { computeCellsFingerprint, generateScenarioCells, GRID_COLS, GRID_ROWS } from './scenarioFixtures';

const ZONE_COLORS = [
  '#2E7969', // Zone 1: Verdigris / Deep Sage
  '#C46E47', // Zone 2: Warm Clay / Terra Cotta
  '#D4A34A', // Zone 3: Ochre / Harvest Gold
  '#4D6575', // Zone 4: Slate Spruce
];

const ZONE_PATTERNS = [
  'pattern-zone-1',
  'pattern-zone-2',
  'pattern-zone-3',
  'pattern-zone-4',
];

/**
 * Generate coherent spatial zone assignments for 216 cells.
 * Mimics unsupervised feature-space clustering with spatial clustering.
 */
function createDeterministicAssignments(
  cells: SoilCell[],
  method: ClusteringMethod,
  k: ClusterCount
): { assignments: number[]; membershipMatrix?: number[][] } {
  const assignments: number[] = [];
  const membershipMatrix: number[][] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    // Normalized coordinates & features influence group assignment
    const nx = cell.col / GRID_COLS;
    const ny = cell.row / GRID_ROWS;
    const normN = cell.nitrogen / 250;
    const normPH = (cell.pH - 3) / 6.5;

    // Synthetic grouping vector
    const score = (nx * 0.4 + ny * 0.3 + normN * 0.2 + normPH * 0.1);
    let zone = Math.floor(score * k);
    if (zone >= k) zone = k - 1;
    if (zone < 0) zone = 0;

    // Perturb slightly based on method to give FCM softer distinct boundaries
    if (method === 'fcm' && (i % 7 === 0) && zone > 0) {
      // Slight smooth fuzziness
      zone = (zone + (i % 2 === 0 ? 1 : -1) + k) % k;
    }

    assignments.push(zone);

    if (method === 'fcm') {
      // Generate membership vector summing to 1.0
      const weights = Array(k).fill(0.1 / (k - 1));
      weights[zone] = 0.90;
      membershipMatrix.push(weights);
    }
  }

  return { assignments, membershipMatrix: method === 'fcm' ? membershipMatrix : undefined };
}

/**
 * Compute descriptive statistics for each zone directly from member cells.
 */
function computeZoneSummaries(
  cells: SoilCell[],
  assignments: number[],
  k: ClusterCount,
  membershipMatrix?: number[][]
): ZoneSummary[] {
  const summaries: ZoneSummary[] = [];
  const featureKeys: SoilFeatureKey[] = ['nitrogen', 'phosphorus', 'potassium', 'pH', 'ec', 'soilTemp'];

  for (let z = 0; z < k; z++) {
    const memberCells = cells.filter((_, idx) => assignments[idx] === z);
    const count = memberCells.length;
    const sharePct = parseFloat(((count / cells.length) * 100).toFixed(1));

    const meanFeatures = {} as Record<SoilFeatureKey, number>;
    const minMaxFeatures = {} as Record<SoilFeatureKey, [number, number]>;
    const stdDevFeatures = {} as Record<SoilFeatureKey, number>;

    for (const feat of featureKeys) {
      if (count === 0) {
        meanFeatures[feat] = 0;
        minMaxFeatures[feat] = [0, 0];
        stdDevFeatures[feat] = 0;
        continue;
      }

      const values = memberCells.map((c) => c[feat]);
      const sum = values.reduce((acc, v) => acc + v, 0);
      const mean = sum / count;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / count;
      const stdDev = Math.sqrt(variance);

      meanFeatures[feat] = parseFloat(mean.toFixed(feat === 'ec' ? 2 : feat === 'pH' ? 1 : 0));
      minMaxFeatures[feat] = [
        parseFloat(min.toFixed(feat === 'ec' ? 2 : feat === 'pH' ? 1 : 0)),
        parseFloat(max.toFixed(feat === 'ec' ? 2 : feat === 'pH' ? 1 : 0)),
      ];
      stdDevFeatures[feat] = parseFloat(stdDev.toFixed(feat === 'ec' ? 2 : 1));
    }

    let fcmAvgMembership: number | undefined;
    if (membershipMatrix) {
      const memberMemScores = memberCells.map((_, idx) => membershipMatrix[idx][z]);
      const memSum = memberMemScores.reduce((acc, v) => acc + v, 0);
      fcmAvgMembership = memberMemScores.length > 0 ? parseFloat((memSum / memberMemScores.length).toFixed(2)) : 0.85;
    }

    summaries.push({
      zoneIndex: z,
      label: `Zone ${z + 1}`,
      cellCount: count,
      cellSharePct: sharePct,
      color: ZONE_COLORS[z % ZONE_COLORS.length],
      patternClass: ZONE_PATTERNS[z % ZONE_PATTERNS.length],
      meanFeatures,
      minMaxFeatures,
      stdDevFeatures,
      fcmAvgMembership,
    });
  }

  return summaries;
}

/**
 * Return prepared sample fixture for the chosen scenario, method, and cluster count.
 */
export function getZoningSampleFixture(
  scenarioId: ScenarioId,
  method: ClusteringMethod,
  k: ClusterCount
): ZoningSampleView {
  const scenarioCells = generateScenarioCells(scenarioId);
  const fingerprint = computeCellsFingerprint(scenarioCells);
  const { assignments, membershipMatrix } = createDeterministicAssignments(scenarioCells, method, k);
  const summaries = computeZoneSummaries(scenarioCells, assignments, k, membershipMatrix);

  return {
    fixtureId: `fixture-${scenarioId}-${method}-k${k}-v1`,
    scenarioId,
    method,
    k,
    sampleInputFingerprint: fingerprint,
    assignments,
    membershipMatrix,
    summaries,
    loadedAt: '2026-10-07T20:00:00Z',
  };
}
