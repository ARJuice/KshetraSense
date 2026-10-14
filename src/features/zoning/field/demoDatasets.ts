import demoData from './demoData.json';
import { parseFieldBoundary, type GeoJsonPolygon } from './fieldGeometry';
import { parseSoilSampleCsv } from './soilSampleCsv';
import type { SoilSampleDraft } from './fieldSamples';

export interface DemoDataset {
  id: string;
  name: string;
  scenario: string;
  collectionDate: string;
  boundary: GeoJsonPolygon;
  samples: SoilSampleDraft[];
}

export const DEMO_DATASETS: DemoDataset[] = demoData.map((d) => ({
  id: d.id,
  name: d.name,
  scenario: d.scenario,
  collectionDate: d.collectionDate,
  boundary: parseFieldBoundary(d.geojson as Parameters<typeof parseFieldBoundary>[0]),
  samples: parseSoilSampleCsv(d.csv).samples,
}));
