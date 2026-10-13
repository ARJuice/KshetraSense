import type { GeoJsonGeometry, GeoJsonPolygon, Position } from './fieldGeometry';

export type SoilProperty = 'pH' | 'ec' | 'nitrogen' | 'phosphorus' | 'potassium';
export type SoilMeasurements = Record<SoilProperty, number>;
export type Wgs84Point = { longitude: number; latitude: number };

export interface SoilSampleInput {
  id: string;
  latitude: number;
  longitude: number;
  depthCm: string;
  collectionDate?: string | null;
  labMethod?: string | null;
  standardUncertainty?: Partial<Record<SoilProperty, number>>;
  measurements: SoilMeasurements;
}

export interface FieldZoningRequest {
  boundary: GeoJsonPolygon;
  samples: SoilSampleInput[];
  cellSizeM: 5 | 10;
  method: 'kmeans' | 'fcm';
  maxK: number;
  seed: number;
  mergeThresholdZ: number;
  perturbationRuns: number;
  fcm: { fuzziness: number; maxIterations: number; tolerance: number };
}

export interface FieldZoningOptions {
  cellSizeM: 5 | 10;
  method: 'kmeans' | 'fcm';
  maxK: number;
  seed: number;
  mergeThresholdZ: number;
  perturbationRuns: number;
  fcm: { fuzziness: number; maxIterations: number; tolerance: number };
}

export interface FieldCellResult {
  cellId: string;
  row: number;
  column: number;
  centerUtm: { eastingM: number; northingM: number };
  centerWgs84: { longitude: number; latitude: number };
  geometry: GeoJsonGeometry;
  areaM2: number;
  nearestSampleDistanceM: number;
  soilValues: SoilMeasurements;
  valueKind: 'idw_interpolated_estimate';
  shi: number;
  shiComponents: SoilMeasurements;
  clusterId: number;
  zoneId: number;
  clusterMemberships?: number[];
}

export interface FieldZoneResult {
  zoneId: number;
  mergedClusterId: number;
  sourceClusterIds: number[];
  cellCount: number;
  cellIds: string[];
  areaM2: number;
  meanSoilValues: SoilMeasurements;
  stdSoilValues: SoilMeasurements;
  meanShi: number;
  meanShiComponents: SoilMeasurements;
  centroidUtm: { eastingM: number; northingM: number };
  centroidWgs84: { longitude: number; latitude: number };
  geometry: GeoJsonGeometry;
  meanClusterMemberships?: Record<string, number>;
}

export interface FieldZoningResponse {
  runId: string;
  inputFingerprint: string;
  createdAt: string;
  processingDurationMs: number;
  method: 'kmeans' | 'fcm';
  selectedK: number;
  zoneCount: number;
  parameters: FieldZoningOptions;
  versions: Record<string, string>;
  field: {
    boundary: GeoJsonPolygon;
    utmCrs: string;
    cellSizeM: number;
    areaHectares: number;
    cellCount: number;
    representedGridAreaM2: number;
    gridCoveragePercent: number;
    boundingBoxUtm: Record<'minX' | 'minY' | 'maxX' | 'maxY', number>;
  };
  samples: Array<Omit<SoilSampleInput, 'collectionDate' | 'labMethod'> & { collectionDate: string | null; labMethod: string | null; eastingM: number; northingM: number }>;
  sampleWarnings: string[];
  interpolation: {
    method: 'IDW';
    power: number;
    distanceMetric: string;
    crossValidation: Record<SoilProperty, { sampleCount: number; rmse: number; mae: number }>;
  };
  featureSchema: {
    requested: SoilProperty[];
    included: SoilProperty[];
    excluded: Array<{ feature: SoilProperty; reason: string }>;
    units: Record<SoilProperty, string>;
    normalization: Array<{ feature: SoilProperty; mean: number; stdDev: number }>;
  };
  shi: { name: string; version: string; officialUSDAIndex: false; scoreRange: [0, 100]; weights: Record<SoilProperty, number>; limitations: string };
  cells: FieldCellResult[];
  zones: FieldZoneResult[];
  autoK: {
    optimalK: number;
    selectionCriterion: string;
    sweep: Array<{ k: number; silhouette: number | null; fpc: number | null; inertia: number | null; iterations: number }>;
    selectedAlgorithmConverged: boolean;
    silhouetteInterpretation: string;
  };
  mergeLog: Array<{ mergedClusters: number[]; profileDistanceZ: number; sharedGridEdges: number }>;
  stability: {
    perturbationRuns: number;
    referenceK: number | null;
    conditionalOnSelectedK: true;
    ariScores: number[];
    meanARI: number | null;
    stdARI: number | null;
    minARI: number | null;
    perCellClusterFlipRate: Record<string, number> | null;
    perCellShiStdDev: Record<string, number> | null;
    noiseModel: Record<string, unknown>;
    limitations: string;
  };
  wsnNodes: Array<{ zoneId: number; cellId: string; positionUtm: { eastingM: number; northingM: number }; positionWgs84: Wgs84Point; zoneMeanShi: number; placementStatus: string }>;
  clusterHead: {
    positionUtm: { eastingM: number; northingM: number };
    positionWgs84: Wgs84Point;
    totalDistanceToNodesM: number;
    algorithm: string;
    radioCoverageValidated: false;
    placementStatus: string;
  };
}

export type { GeoJsonGeometry, GeoJsonPolygon, Position };
