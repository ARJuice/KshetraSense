import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  Leaf,
  Lock,
  Radio,
  Satellite,
  ShieldCheck,
  Sprout,
} from 'lucide-react';

interface FirewallRule {
  id: string;
  name: string;
  sourceModule: string;
  targetModule: string;
  ruleTitle: string;
  prohibitedOperation: string;
  scientificRationale: string;
  governingDecision: string;
}

const FIREWALLS: FirewallRule[] = [
  {
    id: 'fw-1',
    name: 'Firewall 1: Spatial Zoning ↔ Telemetry Replay',
    sourceModule: 'Module 1 (Soil Zoning)',
    targetModule: 'Module 2 (Field Telemetry)',
    ruleTitle: 'Zero Research Telemetry Binding to Cadastral Fields',
    prohibitedOperation: 'Binding Parma 2023 tomato research WSN sensor feeds to an arbitrary Indian farm boundary polygon.',
    scientificRationale: 'WSN data from an Italian research trial cannot represent soil pore conditions in Karnataka without physical localized sensor deployment. Cross-binding would deceive users into believing their farm is actively monitored.',
    governingDecision: 'Decision 0003 & Phase 3 Architecture',
  },
  {
    id: 'fw-2',
    name: 'Firewall 2: Soil Zoning ↔ Satellite & SoilGrids',
    sourceModule: 'Module 1 (Soil Zoning)',
    targetModule: 'Module 3 (Remote Sensing)',
    ruleTitle: 'Prohibition of Coarse Covariate Raster Downscaling',
    prohibitedOperation: 'Bilinearly interpolating 250m ISRIC SoilGrids rasters or blending aggregate NDVI into 10m zoning cells.',
    scientificRationale: 'A 250m SoilGrids pixel spans 6.25 hectares—larger than most smallholder fields. Downscaling creates false gradients with zero localized predictive validity. Zoning relies strictly on physical laboratory ground truth.',
    governingDecision: 'Decision 0010 (ISRIC Adapter)',
  },
  {
    id: 'fw-3',
    name: 'Firewall 3: Foliar Pathology ↔ Soil Chemistry',
    sourceModule: 'Module 4 (Leaf Pathology)',
    targetModule: 'Module 1 (Soil Chemistry)',
    ruleTitle: 'Zero Multimodal Fusion in Foliar Classifier',
    prohibitedOperation: 'Concatenating soil pH or NPK values into MobileNetV3-Small convolutional feature representations.',
    scientificRationale: 'Multimodal fusion creates catastrophic spurious correlations. The model would learn dataset co-occurrences (e.g., associating low pH with blight because of geographic sampling bias) rather than classifying actual visual lesions.',
    governingDecision: 'Decision 0004 & Phase 5 Contract',
  },
  {
    id: 'fw-4',
    name: 'Firewall 4: Crop Fit Evaluation ↔ Probability Normalization',
    sourceModule: 'Module 5 (Crop Fit)',
    targetModule: 'All Modules',
    ruleTitle: 'Prohibition of 100% Crop Viability Normalization',
    prohibitedOperation: 'Forcing crop suitability scores across finger millet, tomato, and groundnut to sum to 100%.',
    scientificRationale: 'Agronomic suitability is multi-label. A parcel of land can be simultaneously suitable for millet and tomato, or suitable for neither. Treating independent viability states as mutually exclusive probability events is a fatal mathematical fallacy.',
    governingDecision: 'Decisions 0011 & 0012',
  },
  {
    id: 'fw-5',
    name: 'Firewall 5: Decision Support ↔ Closed-Loop Actuation',
    sourceModule: 'All Modules',
    targetModule: 'Physical Hardware',
    ruleTitle: 'Strict Prohibition of Autonomous Closed-Loop Actuation',
    prohibitedOperation: 'Directly driving irrigation valves, fertilizer spreaders, or chemical spray booms from model outputs.',
    scientificRationale: 'All model outputs are informational screening benchmarks. Without on-site calibration, autonomous chemical or water dispensing risks severe crop failure, chemical runoff, and financial ruin.',
    governingDecision: 'Safety Gate Policy v1',
  },
];

export const DecouplingBoundaryDiagram: React.FC = () => {
  const [selectedFirewallId, setSelectedFirewallId] = useState<string>('fw-3');

  const activeFirewall = FIREWALLS.find((f) => f.id === selectedFirewallId) || FIREWALLS[0];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              DSS
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Whole-Project Architecture &amp; Decoupling Firewalls
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual topological representation of the 5 independent decision-support modules and the architectural boundaries preventing cross-contamination.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 self-start sm:self-auto flex items-center gap-1.5">
          <ShieldCheck size={13} />
          <span>5 Architectural Firewalls</span>
        </span>
      </div>

      {/* Visual Architectural Topology Flowchart */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-inner space-y-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
            Whole-Project Decoupled Ingestion &amp; Inference Topology
          </span>
          <span className="text-[10px] font-mono text-emerald-400">
            Local-First · Zero Silent Multimodal Fusion
          </span>
        </div>

        {/* 5 Ingestion Tracks with Explicit Decoupling Gates */}
        <div className="space-y-3">
          {/* Module 1 Track */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-800/60 p-3">
            <div className="md:col-span-3 flex items-center gap-2 font-mono text-xs text-blue-400">
              <Database size={14} />
              <span>GeoJSON + 3-50 Lab Cores</span>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={14} />
            </div>
            <div className="md:col-span-5 rounded bg-slate-800 p-2 border border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white">Module 1: Soil Zoning &amp; Spatial ML</strong>
                <span className="text-[10px] font-mono text-emerald-400">IDW p=2 · Auto-K</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">5m/10m Gridded Field Estimates · In-Zone Medoids · SHI Screen</p>
            </div>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={() => setSelectedFirewallId('fw-1')}
                className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 border transition-all ${
                  selectedFirewallId === 'fw-1'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>Firewall 1: Isolated from WSN</span>
              </button>
            </div>
          </div>

          {/* Module 2 Track */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-800/60 p-3">
            <div className="md:col-span-3 flex items-center gap-2 font-mono text-xs text-amber-400">
              <Radio size={14} />
              <span>Parma 2023 WSN Dataset</span>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={14} />
            </div>
            <div className="md:col-span-5 rounded bg-slate-800 p-2 border border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white">Module 2: Field Telemetry &amp; GRU Forecaster</strong>
                <span className="text-[10px] font-mono text-amber-400">144x5 Sequence · Δy</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Historical Replay · 10-Min Resampling · Evaluated vs Persistence</p>
            </div>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={() => setSelectedFirewallId('fw-5')}
                className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 border transition-all ${
                  selectedFirewallId === 'fw-5'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>Firewall 5: No Actuation</span>
              </button>
            </div>
          </div>

          {/* Module 3 Track */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-800/60 p-3">
            <div className="md:col-span-3 flex items-center gap-2 font-mono text-xs text-purple-400">
              <Satellite size={14} />
              <span>Sentinel-2 L2A + SoilGrids</span>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={14} />
            </div>
            <div className="md:col-span-5 rounded bg-slate-800 p-2 border border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white">Module 3: CropSight &amp; SoilGrids WCS</strong>
                <span className="text-[10px] font-mono text-purple-400">QA60 Mask · Aggregate</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Circular AOI Mean NDVI · CHIRPS Rainfall · 250m Covariates</p>
            </div>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={() => setSelectedFirewallId('fw-2')}
                className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 border transition-all ${
                  selectedFirewallId === 'fw-2'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>Firewall 2: No Downscaling</span>
              </button>
            </div>
          </div>

          {/* Module 4 Track */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-800/60 p-3">
            <div className="md:col-span-3 flex items-center gap-2 font-mono text-xs text-emerald-400">
              <Leaf size={14} />
              <span>Single 224x224 RGB Image</span>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={14} />
            </div>
            <div className="md:col-span-5 rounded bg-slate-800 p-2 border border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white">Module 4: MobileNetV3 Foliar Vision</strong>
                <span className="text-[10px] font-mono text-emerald-400">17 Classes · 84ms</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Image-Only CNN · reviewRequired: true · Isolated from Soil Features</p>
            </div>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={() => setSelectedFirewallId('fw-3')}
                className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 border transition-all ${
                  selectedFirewallId === 'fw-3'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>Firewall 3: Zero Multimodal</span>
              </button>
            </div>
          </div>

          {/* Module 5 Track */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-800/60 p-3">
            <div className="md:col-span-3 flex items-center gap-2 font-mono text-xs text-rose-400">
              <Sprout size={14} />
              <span>Observed Zone Chemistry</span>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={14} />
            </div>
            <div className="md:col-span-5 rounded bg-slate-800 p-2 border border-slate-700">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white">Module 5: Agronomic Crop Fit &amp; DSS</strong>
                <span className="text-[10px] font-mono text-rose-400">Karnataka Reference</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Factor-by-Factor Literature Alignment · Finger Millet, Tomato, Groundnut</p>
            </div>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={() => setSelectedFirewallId('fw-4')}
                className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1 border transition-all ${
                  selectedFirewallId === 'fw-4'
                    ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>Firewall 4: Multi-Label Viability</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Firewall Deep Inspection Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-100 text-amber-800">
              <Lock size={13} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{activeFirewall.name}</h4>
              <p className="text-[11px] text-slate-500">{activeFirewall.ruleTitle}</p>
            </div>
          </div>
          <span className="font-mono text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded self-start sm:self-auto">
            Governed by: {activeFirewall.governingDecision}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 space-y-1">
            <span className="font-bold text-rose-900 uppercase tracking-wider text-[10px] block">
              Strictly Prohibited Operation:
            </span>
            <p className="text-rose-950 leading-relaxed text-[11px]">
              {activeFirewall.prohibitedOperation}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1">
            <span className="font-bold text-emerald-900 uppercase tracking-wider text-[10px] block">
              Scientific Defense Rationale:
            </span>
            <p className="text-emerald-950 leading-relaxed text-[11px]">
              {activeFirewall.scientificRationale}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
