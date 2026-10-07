import { SoilFeatureKey, ZoneSummary } from '../../features/field/types';

export type CropFactorStatus = 'suitable' | 'marginal' | 'unsuitable' | 'unassessed';

export interface CropFactorRow {
  factorKey: SoilFeatureKey | 'calcium' | 'drainage';
  name: string;
  observed: string;
  range: string;
  status: CropFactorStatus;
  statusLabel: string;
  explanation: string;
  source: string;
}

export interface CropProfile {
  id: 'apple' | 'tomato' | 'potato';
  commonName: string;
  scientificName: string;
  iconName: string;
  profileVersion: string;
  notes: string;
  factorRules: {
    pH: { minOpt: number; maxOpt: number; minMarg: number; maxMarg: number; source: string };
    nitrogen: { minOpt: number; maxOpt: number; minMarg: number; maxMarg: number; source: string };
    ec: { maxOpt: number; maxMarg: number; source: string };
    soilTemp: { minOpt: number; maxOpt: number; minMarg: number; maxMarg: number; source: string };
    potassium: { minOpt: number; maxOpt: number; minMarg: number; maxMarg: number; source: string };
    phosphorus: { minOpt: number; maxOpt: number; minMarg: number; maxMarg: number; source: string };
  };
}

export const CROP_PROFILES: Record<'apple' | 'tomato' | 'potato', CropProfile> = {
  apple: {
    id: 'apple',
    commonName: 'Apple',
    scientificName: 'Malus domestica',
    iconName: 'apple',
    profileVersion: 'v0.1-mock-FAO-ecocrop',
    notes: 'Perennial pomaceous fruit tree; favors deep, well-aerated loams with moderate acidity and low salinity.',
    factorRules: {
      pH: { minOpt: 5.8, maxOpt: 7.0, minMarg: 5.0, maxMarg: 8.0, source: 'FAO Ecocrop Malus 2018' },
      nitrogen: { minOpt: 35, maxOpt: 80, minMarg: 20, maxMarg: 120, source: 'Penn State Orchard Nutrition' },
      ec: { maxOpt: 1.7, maxMarg: 2.5, source: 'Mass & Hoffman Salinity Scale' },
      soilTemp: { minOpt: 14, maxOpt: 24, minMarg: 8, maxMarg: 28, source: 'Rootzone Ecocrop Range' },
      potassium: { minOpt: 90, maxOpt: 180, minMarg: 60, maxMarg: 220, source: 'Cornell Apple Guidelines' },
      phosphorus: { minOpt: 15, maxOpt: 45, minMarg: 10, maxMarg: 65, source: 'Cornell Apple Guidelines' },
    },
  },
  tomato: {
    id: 'tomato',
    commonName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    iconName: 'tomato',
    profileVersion: 'v0.1-mock-AVRDC-rules',
    notes: 'Warm-season solanaceous annual; higher demand for balanced N-P-K, moderate salt sensitivity.',
    factorRules: {
      pH: { minOpt: 6.0, maxOpt: 6.8, minMarg: 5.5, maxMarg: 7.5, source: 'AVRDC Production Guide' },
      nitrogen: { minOpt: 60, maxOpt: 130, minMarg: 40, maxMarg: 180, source: 'UC Davis Vegetable RIC' },
      ec: { maxOpt: 2.5, maxMarg: 3.5, source: 'FAO Irrig. & Drainage 29' },
      soilTemp: { minOpt: 18, maxOpt: 28, minMarg: 14, maxMarg: 34, source: 'AVRDC Seedbed & Soil Range' },
      potassium: { minOpt: 120, maxOpt: 220, minMarg: 80, maxMarg: 250, source: 'UC Davis Vegetable RIC' },
      phosphorus: { minOpt: 30, maxOpt: 75, minMarg: 18, maxMarg: 95, source: 'UC Davis Vegetable RIC' },
    },
  },
  potato: {
    id: 'potato',
    commonName: 'Potato',
    scientificName: 'Solanum tuberosum',
    iconName: 'potato',
    profileVersion: 'v0.1-mock-CIP-standard',
    notes: 'Tuberous solanaceous crop; prefers slightly acidic, low-salinity soil; sensitive to scab above pH 6.8.',
    factorRules: {
      pH: { minOpt: 5.0, maxOpt: 6.5, minMarg: 4.5, maxMarg: 7.2, source: 'CIP Potato Soil Reference' },
      nitrogen: { minOpt: 50, maxOpt: 110, minMarg: 30, maxMarg: 160, source: 'Idaho Potato Nutrient Mgmt' },
      ec: { maxOpt: 1.7, maxMarg: 2.5, source: 'FAO Salinity Guidelines' },
      soilTemp: { minOpt: 15, maxOpt: 22, minMarg: 10, maxMarg: 26, source: 'CIP Tuber Bulking Temperature' },
      potassium: { minOpt: 110, maxOpt: 200, minMarg: 70, maxMarg: 240, source: 'Idaho Potato Nutrient Mgmt' },
      phosphorus: { minOpt: 25, maxOpt: 60, minMarg: 15, maxMarg: 80, source: 'Idaho Potato Nutrient Mgmt' },
    },
  },
};

/**
 * Evaluates factor rows for a crop given either a selected zone summary or baseline illustrative cell values.
 */
export function evaluateCropFactors(
  cropId: 'apple' | 'tomato' | 'potato',
  zoneSummary: ZoneSummary | null
): CropFactorRow[] {
  const profile = CROP_PROFILES[cropId];
  const rules = profile.factorRules;

  // Use zone mean features if zone selected, else reference default
  const ph = zoneSummary ? zoneSummary.meanFeatures.pH : 6.4;
  const n = zoneSummary ? zoneSummary.meanFeatures.nitrogen : 48;
  const ec = zoneSummary ? zoneSummary.meanFeatures.ec : 1.42;
  const temp = zoneSummary ? zoneSummary.meanFeatures.soilTemp : 24.5;
  const k = zoneSummary ? zoneSummary.meanFeatures.potassium : 130;
  const p = zoneSummary ? zoneSummary.meanFeatures.phosphorus : 24;

  const phStatus: CropFactorStatus =
    ph >= rules.pH.minOpt && ph <= rules.pH.maxOpt
      ? 'suitable'
      : ph >= rules.pH.minMarg && ph <= rules.pH.maxMarg
      ? 'marginal'
      : 'unsuitable';

  const nStatus: CropFactorStatus =
    n >= rules.nitrogen.minOpt && n <= rules.nitrogen.maxOpt
      ? 'suitable'
      : n >= rules.nitrogen.minMarg && n <= rules.nitrogen.maxMarg
      ? 'marginal'
      : 'unsuitable';

  const ecStatus: CropFactorStatus =
    ec <= rules.ec.maxOpt
      ? 'suitable'
      : ec <= rules.ec.maxMarg
      ? 'marginal'
      : 'unsuitable';

  const tempStatus: CropFactorStatus =
    temp >= rules.soilTemp.minOpt && temp <= rules.soilTemp.maxOpt
      ? 'suitable'
      : temp >= rules.soilTemp.minMarg && temp <= rules.soilTemp.maxMarg
      ? 'marginal'
      : 'unsuitable';

  const kStatus: CropFactorStatus =
    k >= rules.potassium.minOpt && k <= rules.potassium.maxOpt
      ? 'suitable'
      : k >= rules.potassium.minMarg && k <= rules.potassium.maxMarg
      ? 'marginal'
      : 'unsuitable';

  const pStatus: CropFactorStatus =
    p >= rules.phosphorus.minOpt && p <= rules.phosphorus.maxOpt
      ? 'suitable'
      : p >= rules.phosphorus.minMarg && p <= rules.phosphorus.maxMarg
      ? 'marginal'
      : 'unsuitable';

  return [
    {
      factorKey: 'pH',
      name: 'Soil pH',
      observed: `${ph.toFixed(1)}`,
      range: `${rules.pH.minOpt.toFixed(1)} – ${rules.pH.maxOpt.toFixed(1)}`,
      status: phStatus,
      statusLabel: phStatus === 'suitable' ? 'Suitable' : phStatus === 'marginal' ? 'Marginal' : 'Outside range',
      explanation: phStatus === 'suitable' ? 'Within favorable nutrient availability band.' : 'Slightly outside optimal acidity band.',
      source: rules.pH.source,
    },
    {
      factorKey: 'nitrogen',
      name: 'Nitrogen (N)',
      observed: `${n} mg/kg`,
      range: `${rules.nitrogen.minOpt} – ${rules.nitrogen.maxOpt} mg/kg`,
      status: nStatus,
      statusLabel: nStatus === 'suitable' ? 'Suitable' : nStatus === 'marginal' ? 'Marginal' : 'Outside range',
      explanation: nStatus === 'suitable' ? 'Supports vegetative canopy development.' : n < rules.nitrogen.minOpt ? 'Lower than optimal demand.' : 'Elevated nitrogen levels.',
      source: rules.nitrogen.source,
    },
    {
      factorKey: 'ec',
      name: 'Salinity (EC)',
      observed: `${ec.toFixed(2)} dS/m`,
      range: `< ${rules.ec.maxOpt.toFixed(1)} dS/m`,
      status: ecStatus,
      statusLabel: ecStatus === 'suitable' ? 'Suitable' : ecStatus === 'marginal' ? 'Marginal' : 'Elevated salinity',
      explanation: ecStatus === 'suitable' ? 'Low osmotic root stress.' : 'Mild osmotic inhibition potential.',
      source: rules.ec.source,
    },
    {
      factorKey: 'soilTemp',
      name: 'Soil Temperature',
      observed: `${temp.toFixed(1)} °C`,
      range: `${rules.soilTemp.minOpt} – ${rules.soilTemp.maxOpt} °C`,
      status: tempStatus,
      statusLabel: tempStatus === 'suitable' ? 'Suitable' : tempStatus === 'marginal' ? 'Marginal' : 'Outside range',
      explanation: tempStatus === 'suitable' ? 'Active biological mineralization zone.' : 'Near thermal physiological limits.',
      source: rules.soilTemp.source,
    },
    {
      factorKey: 'potassium',
      name: 'Potassium (K)',
      observed: `${k} mg/kg`,
      range: `${rules.potassium.minOpt} – ${rules.potassium.maxOpt} mg/kg`,
      status: kStatus,
      statusLabel: kStatus === 'suitable' ? 'Suitable' : kStatus === 'marginal' ? 'Marginal' : 'Outside range',
      explanation: kStatus === 'suitable' ? 'Adequate for osmotic regulation and fruit firmness.' : 'Borderline potassium availability.',
      source: rules.potassium.source,
    },
    {
      factorKey: 'phosphorus',
      name: 'Phosphorus (P)',
      observed: `${p} mg/kg`,
      range: `${rules.phosphorus.minOpt} – ${rules.phosphorus.maxOpt} mg/kg`,
      status: pStatus,
      statusLabel: pStatus === 'suitable' ? 'Suitable' : pStatus === 'marginal' ? 'Marginal' : 'Outside range',
      explanation: pStatus === 'suitable' ? 'Adequate for early root establishment.' : 'Borderline phosphate concentration.',
      source: rules.phosphorus.source,
    },
    {
      factorKey: 'calcium',
      name: 'Calcium & Micronutrients',
      observed: '—',
      range: '—',
      status: 'unassessed',
      statusLabel: 'Not assessed',
      explanation: 'Not measured in synthetic soil feature schema. No composite score fabricated.',
      source: 'PRD PR-06 Missing Data Policy',
    },
  ];
}
