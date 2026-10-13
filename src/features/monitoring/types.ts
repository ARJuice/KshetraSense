export type SampleProvenance = 'manual-entry' | 'csv-import' | 'seed-preset';

export interface SoilMeasurement {
  sampleId: string;
  collectedAt: string;
  latitude: number;
  longitude: number;
  ph: number;
  ecDsM: number;
  nitrogenMgKg: number;
  phosphorusMgKg: number;
  potassiumMgKg: number;
  temperatureC?: number;
  moisturePercentage?: number;
  moistureUnit?: string;
  depthCm?: number;
  depthInterval?: string;
  method?: string;
  source: string;
  labReportId?: string;
  notes?: string;
  provenance: SampleProvenance;
  recordedAt: string;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface CsvImportPreview {
  fileName: string;
  totalRows: number;
  accepted: SoilMeasurement[];
  issues: ImportIssue[];
}

export interface CircularAreaOfInterest {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  startDate: string;
  endDate: string;
}

export interface SoilGridsQuantiles {
  q05: number;
  q50: number;
  q95: number;
}

export interface SoilGridsContextData {
  property: string;
  propertyName: string;
  depth: string;
  nativeResolution: string;
  quantiles: SoilGridsQuantiles;
  unit: string;
  mappedValue: number;
  source: string;
  retrievalDate: string;
  modeledContextLabel: string;
  uncertaintyDisclosure: string;
  disclaimer: string;
  latitude: number;
  longitude: number;
}

export interface CropSightNDVIStats {
  mean: number;
  stddev: number;
  min: number;
  max: number;
}

export interface CropSightTimeSeries {
  dates: string[];
  ndviValues: number[];
  meanNdvi: number;
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient data';
}

export interface CropSightRainfall {
  dates: string[];
  rainfallValues: number[];
  totalRainfall: number;
  avgDailyRainfall: number;
  maxDailyRainfall: number;
}

export interface CropSightZoneStat {
  zone: number;
  meanNdvi: number;
  areaPercentage: number;
  pixelCount?: number;
  scoutingPriority: 'High' | 'Moderate' | 'Baseline';
}

export interface CropSightAnalysisResult {
  source: string;
  provider: string;
  aoi: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    startDate: string;
    endDate: string;
  };
  clusteringMethod: string;
  zonesIdentified: number;
  processingTime: number;
  ndviStats: CropSightNDVIStats;
  ndviTimeSeries: CropSightTimeSeries;
  rainfallData?: CropSightRainfall | null;
  zonalStats: CropSightZoneStat[];
  recommendations: string[];
  isBenchmark?: boolean;
  benchmarkSceneId?: string;
  retrievalDate: string;
}

export interface ComparableGroup {
  groupKey: string;
  siteLabel: string;
  parameter: string;
  unit: string;
  depth: string;
  method: string;
  isComparable: boolean;
  incomparabilityReason?: string;
  readings: Array<{
    sampleId: string;
    collectedAt: string;
    value: number;
    depth: string;
    method: string;
    unit: string;
  }>;
}
