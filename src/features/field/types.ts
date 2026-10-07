/**
 * Domain types for KshetraSense Soil Field & Zoning
 * Adheres to PRD, TRD, UX-SPEC, and Decision 0002 contracts.
 */

export type SoilFeatureKey = 'nitrogen' | 'phosphorus' | 'potassium' | 'pH' | 'ec' | 'soilTemp';

export interface SoilFeatureConfig {
  key: SoilFeatureKey;
  label: string;
  shortLabel: string;
  unit: string;
  min: number;
  max: number;
  precision: number;
  step: number;
  description: string;
}

export interface SoilCell {
  id: string; // e.g. "r12-c8"
  row: number; // 1-based, 1..12
  col: number; // 1-based, 1..18
  nitrogen: number; // mg/kg, 0..250
  phosphorus: number; // mg/kg, 0..250
  potassium: number; // mg/kg, 0..250
  pH: number; // unitless, 3.0..9.5
  ec: number; // dS/m, 0..8.0
  soilTemp: number; // °C, 0..50.0
  moisture?: number | null; // not assessed in standard fixture
}

export type MapMode = 'soil' | 'zoning' | 'membership';
export type InteractionMode = 'inspect' | 'brush';

export type BrushDirection = 'raise' | 'lower';
export type BrushStrength = 'light' | 'medium' | 'strong';
export type BrushFootprint = 1 | 3 | 5;

export interface BrushConfig {
  feature: SoilFeatureKey;
  direction: BrushDirection;
  strength: BrushStrength;
  footprint: BrushFootprint;
}

export type ScenarioId = 'baseline' | 'lowN' | 'highEC' | 'acidicWash';

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  subtitle: string;
  seed: number;
  focusFeature: SoilFeatureKey;
  description: string;
  patchDescription: string;
}

export type ClusteringMethod = 'kmeans' | 'fcm';
export type ClusterCount = 3 | 4;

export interface ZoneSummary {
  zoneIndex: number; // 0..k-1
  label: string; // e.g. "Zone 1"
  cellCount: number;
  cellSharePct: number;
  color: string;
  patternClass: string;
  meanFeatures: Record<SoilFeatureKey, number>;
  minMaxFeatures: Record<SoilFeatureKey, [number, number]>;
  stdDevFeatures: Record<SoilFeatureKey, number>;
  fcmAvgMembership?: number;
}

export interface ZoningSampleView {
  fixtureId: string;
  scenarioId: ScenarioId;
  method: ClusteringMethod;
  k: ClusterCount;
  sampleInputFingerprint: string;
  assignments: number[]; // 216 length, zone index 0..k-1 for each cell
  membershipMatrix?: number[][]; // 216 x k for FCM
  summaries: ZoneSummary[];
  loadedAt: string;
}

export interface EditHistoryItem {
  id: string;
  label: string;
  cellsSnapshot: SoilCell[];
  activeFeature: SoilFeatureKey;
  affectedCellIds: string[];
  timestamp: number;
}
