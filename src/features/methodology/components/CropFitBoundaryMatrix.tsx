import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sliders,
} from 'lucide-react';
import { MathView } from '../../../components/ui/MathView';

interface CropProfile {
  cropName: string;
  scientificName: string;
  regionalContext: string;
  minPh: number;
  maxPh: number;
  citedPhRange: string;
  phSource: string;
  ecThreshold: number; // in dS/m (ECe saturated extract)
  salinityContext: string;
  nutrientContext: string;
  unsupportedFactors: string[];
}

const KARNATAKA_CROPS: CropProfile[] = [
  {
    cropName: 'Finger Millet (Ragi)',
    scientificName: 'Eleusine coracana',
    regionalContext: 'Primary staple dryland cereal across Karnataka Southern Dry Zone & Eastern Dry Zone (UAS Bengaluru)',
    minPh: 4.5,
    maxPh: 8.0,
    citedPhRange: 'pH 4.5 – 8.0',
    phSource: 'NIFTEM-T Technical Report (Broad, method-unspecified agronomic range)',
    ecThreshold: 4.0, // hardy dryland cereal
    salinityContext: 'FAO crop database does not publish an exact ECe threshold for finger millet. No generic millet threshold is substituted.',
    nutrientContext: 'Reported in mg/kg. No universal numeric sufficiency bands are invented without localized calibration.',
    unsupportedFactors: ['Root-zone moisture', 'Soil temperature', 'Effective rooting depth', 'Drainage / aeration'],
  },
  {
    cropName: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    regionalContext: 'Intensive commercial vegetable crop in Kolar and Chikkaballapur belts (UAS Bengaluru research)',
    minPh: 6.5,
    maxPh: 7.5,
    citedPhRange: 'pH 6.5 – 7.5',
    phSource: 'TNAU Agritech Portal (Well-drained loamy soil rich in organic matter)',
    ecThreshold: 2.5, // sensitive to salinity
    salinityContext: 'FAO 29/56 reports an ECe threshold of 2.5 dS/m for saturated-paste extract. Generic 1:2 or 1:5 soil EC cannot be compared to this value.',
    nutrientContext: 'Reported in mg/kg. Extraction methodology (Bray/Olsen P, Ammonium Acetate K) must be specified for crop calibration.',
    unsupportedFactors: ['Blight susceptibility', 'Seasonal frost/heat units', 'Irrigation regime', 'Soil calcium availability'],
  },
  {
    cropName: 'Groundnut',
    scientificName: 'Arachis hypogaea',
    regionalContext: 'Key oilseed crop of Karnataka drylands, extensive research trials at Chintamani ARS',
    minPh: 5.3,
    maxPh: 6.6,
    citedPhRange: 'pH 5.3 – 6.6',
    phSource: 'TNAU Soil Acidity & Crop-Group Table (Slightly acidic to near-neutral)',
    ecThreshold: 3.2,
    salinityContext: 'FAO 29 reports an ECe threshold of 3.2 dS/m. Requires saturated-paste extract context.',
    nutrientContext: 'Reported in mg/kg. Phosphorus and Calcium availability are critical for pegging, but cannot be inferred from generic P alone.',
    unsupportedFactors: ['Soil compaction / bulk density', 'Pod zone moisture', 'Inoculation status', 'Pod rot pathogen load'],
  },
];

export const CropFitBoundaryMatrix: React.FC = () => {
  const [selectedCropIndex, setSelectedCropIndex] = useState<number>(0);
  const [testPh, setTestPh] = useState<number>(6.5);
  const [testEc, setTestEc] = useState<number>(1.2);
  const [testN, setTestN] = useState<number>(75);
  const [testP, setTestP] = useState<number>(28);
  const [testK, setTestK] = useState<number>(190);

  const activeCrop = KARNATAKA_CROPS[selectedCropIndex];

  // Presets for zone simulation
  const applyZonePreset = (preset: 'zone1' | 'zone2' | 'zone3') => {
    switch (preset) {
      case 'zone1': // Acidic Red Soil
        setTestPh(5.2);
        setTestEc(0.6);
        setTestN(45);
        setTestP(15);
        setTestK(110);
        break;
      case 'zone2': // Fertile Neutral Loam
        setTestPh(6.8);
        setTestEc(1.1);
        setTestN(85);
        setTestP(32);
        setTestK(210);
        break;
      case 'zone3': // Saline-Alkaline Black Soil
        setTestPh(8.1);
        setTestEc(3.4);
        setTestN(70);
        setTestP(22);
        setTestK(180);
        break;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              CAT
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Karnataka Crop Fit Reference Catalog &amp; Decision-Support Boundaries
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Factor-by-factor evidence evaluation aligning with Decision 0011 and Decision 0012. Replaces arbitrary crop probability scores with transparent agronomic literature comparisons.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 self-start sm:self-auto">
          Catalog: 2026.10-crop-reference-report-v3
        </span>
      </div>

      {/* Interactive Soil Zone Profile Evaluator */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sliders size={13} className="text-emerald-700" />
              <span>Interactive Zone Soil Chemistry Vector</span>
            </span>
            <p className="text-[11px] text-slate-500">
              Simulate how different management zone soil vectors evaluate across the 3 reference crops:
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Presets:</span>
            <button
              onClick={() => applyZonePreset('zone1')}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 active:scale-95 transition-all duration-150 hover:bg-slate-100 hover:border-slate-300"
            >
              Zone 1: Acidic Laterite
            </button>
            <button
              onClick={() => applyZonePreset('zone2')}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 active:scale-95 transition-all duration-150 hover:bg-slate-100 hover:border-slate-300"
            >
              Zone 2: Fertile Loam
            </button>
            <button
              onClick={() => applyZonePreset('zone3')}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 active:scale-95 transition-all duration-150 hover:bg-slate-100 hover:border-slate-300"
            >
              Zone 3: Saline-Alkaline
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>pH</span>
              <span className="font-mono text-emerald-700">{testPh.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="4.0"
              max="9.0"
              step="0.1"
              value={testPh}
              onChange={(e) => setTestPh(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>EC (dS/m)</span>
              <span className="font-mono text-emerald-700">{testEc.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="5.0"
              step="0.1"
              value={testEc}
              onChange={(e) => setTestEc(parseFloat(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>N (mg/kg)</span>
              <span className="font-mono text-emerald-700">{testN}</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={testN}
              onChange={(e) => setTestN(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>P (mg/kg)</span>
              <span className="font-mono text-emerald-700">{testP}</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={testP}
              onChange={(e) => setTestP(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1 col-span-2 sm:col-span-1">
            <div className="flex justify-between text-[11px] font-bold">
              <span>K (mg/kg)</span>
              <span className="font-mono text-emerald-700">{testK}</span>
            </div>
            <input
              type="range"
              min="50"
              max="350"
              step="10"
              value={testK}
              onChange={(e) => setTestK(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Comparative 3-Crop Evaluation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {KARNATAKA_CROPS.map((crop, idx) => {
          const isPhInside = testPh >= crop.minPh && testPh <= crop.maxPh;
          const isEcBelow = testEc <= crop.ecThreshold;
          const isSelected = idx === selectedCropIndex;

          return (
            <div
              key={crop.cropName}
              onClick={() => setSelectedCropIndex(idx)}
              className={`cursor-pointer rounded-xl border p-4 text-left active:scale-[0.99] transition-all duration-150 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{crop.cropName}</span>
                <span className="font-mono text-[10px] text-slate-500 italic">
                  {crop.scientificName}
                </span>
              </div>

              {/* Status indicators */}
              <div className="mt-3 space-y-2 text-xs">
                {/* pH evaluation */}
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-600">Soil Reaction (pH):</span>
                  <span
                    className={`font-semibold flex items-center gap-1 text-[11px] ${
                      isPhInside ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isPhInside ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    <span>{isPhInside ? 'Inside Interval' : 'Outside Interval'}</span>
                  </span>
                </div>

                {/* EC evaluation */}
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200">
                  <span className="text-slate-600">Salinity (ECe):</span>
                  <span
                    className={`font-semibold flex items-center gap-1 text-[11px] ${
                      isEcBelow ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isEcBelow ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    <span>{isEcBelow ? 'Tolerant' : 'Salinity Stress'}</span>
                  </span>
                </div>

                {/* Macronutrient profile */}
                <div className="flex items-center justify-between rounded bg-white p-2 border border-slate-200 text-slate-600">
                  <span>Nutrients:</span>
                  <span className="font-mono text-[11px] text-slate-800">
                    N{testN} · P{testP} · K{testK}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 mt-2.5 line-clamp-2">
                {crop.regionalContext}
              </p>
            </div>
          );
        })}
      </div>

      {/* Selected Crop Deep Literature Details */}
      <div key={activeCrop.cropName} className="module-nav-transition rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">{activeCrop.cropName}</h4>
            <p className="text-xs text-slate-500">{activeCrop.regionalContext}</p>
          </div>
          <span className="rounded bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[11px] font-bold self-start sm:self-auto">
            {activeCrop.citedPhRange}
          </span>
        </div>

        {/* Factors Assessment Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Soil pH factor */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">1. Soil Reaction (pH)</span>
              <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                Evaluated
              </span>
            </div>
            <p className="text-slate-700 font-mono text-[11px]">Interval: {activeCrop.citedPhRange}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <strong>Source:</strong> {activeCrop.phSource}. Evaluated as a direct numeric range check; results in neutral &quot;Inside Interval&quot; or &quot;Outside Interval&quot; state.
            </p>
          </div>

          {/* Salinity EC factor */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">2. Salinity (EC)</span>
              <span className="rounded bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                Contextual Only
              </span>
            </div>
            <p className="text-slate-700 font-mono text-[11px]">Threshold: &lt; {activeCrop.ecThreshold} dS/m (ECe)</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {activeCrop.salinityContext}
            </p>
          </div>

          {/* Macronutrients N/P/K */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">3. Macronutrients (N, P, K)</span>
              <span className="rounded bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                Visible / Unclassified
              </span>
            </div>
            <p className="text-slate-700 font-mono text-[11px]">Units: mg/kg</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {activeCrop.nutrientContext}
            </p>
          </div>
        </div>

        {/* Explicitly Unsupported Factors */}
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1 text-xs">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold">
            <AlertCircle size={13} className="text-amber-700" />
            <span>Unmeasured Production Factors in Pre-Season Soil Zoning:</span>
          </div>
          <p className="text-[11px] text-amber-950">
            {activeCrop.unsupportedFactors.join(' · ')}
          </p>
        </div>
      </div>

      {/* Mathematical & Agronomic Proof: Why Crops Never Sum to 100% */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-white shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-emerald-400" />
          <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            Mathematical Proof: Why Crop Suitability Scores Must Never Sum to 100%
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-xs">
          <div className="space-y-3">
            <p className="leading-relaxed text-slate-300">
              In commercial precision agriculture, a parcel of land can be simultaneously viable for <strong>Finger Millet</strong> AND <strong>Tomato</strong>, or suitable for <strong>neither</strong>.
            </p>
            <p className="leading-relaxed text-slate-300">
              Treating crop suitability as a probability distribution summing to 100% is a fatal mathematical fallacy: it treats <em>independent multi-label agronomic viability states</em> as if they were <em>mutually exclusive single-choice events</em>.
            </p>
            <div className="rounded-xl bg-slate-800/90 p-3.5 border border-slate-700/80 my-2">
              <MathView math="P(\text{Suitable}_{\text{Ragi}}) + P(\text{Suitable}_{\text{Tomato}}) + P(\text{Suitable}_{\text{Groundnut}}) \neq 1.0" block className="text-emerald-300 font-semibold" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-800/60 p-4 space-y-2">
            <span className="font-bold text-white text-[11px] uppercase tracking-wider block">
              Multi-Label Reality vs False Normalization
            </span>
            <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
              <li>
                <strong>Single-Label Classification (Sums to 100%):</strong> Applies to mutually exclusive categories, such as identifying a single leaf lesion as Early Blight OR Late Blight.
              </li>
              <li>
                <strong>Multi-Label Suitability (Does NOT Sum to 100%):</strong> A field with pH 6.5, good drainage, and loam texture satisfies both Tomato and Groundnut requirements independently.
              </li>
              <li>
                <strong>Decision Support Boundary:</strong> KshetraSense provides transparent factor-level evidence; the human grower and agricultural extension officer make the cultivation choice.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
