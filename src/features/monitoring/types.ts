export type SampleProvenance = 'manual-entry' | 'csv-import';

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

export type IntegrationStatus =
  | 'configuration-required'
  | 'unavailable'
  | 'ready'
  | 'connected';

export interface ExternalIntegrationStatus {
  status: IntegrationStatus;
  detail: string;
}
