import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Droplets,
  Eye,
  GitFork,
  Globe,
  Grid,
  Layers,
  Leaf,
  MapPin,
  Radio,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sprout,
  TrendingUp,
} from 'lucide-react';
import type { PipelineStage } from '../methodologyData';
import { InteractiveFormulaCard } from './InteractiveFormulaCard';

export interface PipelineStageFlowProps {
  moduleTitle: string;
  moduleBadge: string;
  stages: PipelineStage[];
  colorTheme?: 'emerald' | 'blue' | 'amber';
}

const ICON_MAP: Record<string, React.ElementType> = {
  MapPin,
  Grid,
  Activity,
  BarChart2,
  Cpu,
  GitFork,
  ShieldCheck,
  Radio,
  Database,
  Clock,
  Layers,
  AlertTriangle,
  Droplets,
  Satellite,
  TrendingUp,
  ShieldAlert,
  Globe,
  Sliders,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Leaf,
  Sprout,
  Eye,
};

export const PipelineStageFlow: React.FC<PipelineStageFlowProps> = ({
  moduleTitle,
  moduleBadge,
  stages,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const activeStage = stages[activeStepIndex] || stages[0];

  const handleNext = () => {
    setActiveStepIndex((prev) => Math.min(prev + 1, stages.length - 1));
  };

  const handlePrev = () => {
    setActiveStepIndex((prev) => Math.max(prev - 1, 0));
  };

  // Helper to render stage-specific visual illustration
  const renderStageVisual = (stageId: string) => {
    switch (stageId) {
      // Module 1: Soil Zoning stages
      case 'boundary-projection':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Visual Projection Diagnostic: WGS84 to UTM Metric Conversion</span>
              <span className="text-emerald-400">EPSG:4326 → EPSG:32643</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="rounded-lg bg-slate-800/80 p-3 border border-slate-700/60 font-mono text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Raw Geographic (Degrees)</span>
                <p className="text-amber-300">Lat: 13.0827° N, Lon: 77.5877° E</p>
                <p className="text-slate-400 text-[11px]">1° Lon ≈ 108.5 km (Latitude dependent)</p>
              </div>
              <div className="rounded-lg bg-slate-800/80 p-3 border border-slate-700/60 font-mono text-xs space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Metric Projection (UTM Zone 43N)</span>
                <p className="text-emerald-300">E: 563,720 m, N: 1,446,580 m</p>
                <p className="text-slate-400 text-[11px]">Isotropic Euclidean Distance: Δx = 1m, Δy = 1m</p>
              </div>
            </div>
          </div>
        );

      case 'grid-discretization':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Discretization Grid Visualizer: 10m Continuous Mesh</span>
              <span className="text-emerald-400">Regular Bounding Box with Exact Polygon Clipping</span>
            </div>
            <div className="flex items-center gap-6 overflow-x-auto py-2">
              <div className="h-28 w-28 shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-2 grid grid-cols-4 gap-1 place-content-center">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-4 w-4 rounded-xs border text-[8px] flex items-center justify-center font-mono ${
                      [0, 3, 12, 15].includes(i)
                        ? 'border-slate-700 bg-slate-800/40 text-slate-600'
                        : 'border-emerald-500/60 bg-emerald-600/30 text-emerald-300'
                    }`}
                  >
                    {[0, 3, 12, 15].includes(i) ? '∅' : '10m'}
                  </div>
                ))}
              </div>
              <div className="text-xs space-y-1 text-slate-300">
                <p className="font-bold text-white">Discretization Rules:</p>
                <p className="text-slate-400 text-[11px]">• Bounding box generated at regular Δx = Δy intervals (5m or 10m).</p>
                <p className="text-slate-400 text-[11px]">• Centroids strictly inside field polygon ring are retained.</p>
                <p className="text-slate-400 text-[11px]">• Perimeter intersection calculates exact clipped cell surface area in m².</p>
              </div>
            </div>
          </div>
        );

      case 'idw-interpolation':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Spatial Physics: Inverse Distance Weighting (IDW p=2.0)</span>
              <span className="text-emerald-400">Exact Interpolator at Observed Cores</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="rounded border border-slate-800 bg-slate-800/60 p-2.5">
                <span className="text-slate-400 text-[10px] block">Distance d = 10m</span>
                <span className="text-white font-bold">Weight w = 1/(10)² = 0.0100</span>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/60 p-2.5">
                <span className="text-slate-400 text-[10px] block">Distance d = 25m</span>
                <span className="text-white font-bold">Weight w = 1/(25)² = 0.0016</span>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/60 p-2.5">
                <span className="text-slate-400 text-[10px] block">Distance d = 50m</span>
                <span className="text-white font-bold">Weight w = 1/(50)² = 0.0004</span>
              </div>
            </div>
          </div>
        );

      case 'spatial-clustering':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Clustering Optimization: Automated K* Sweep with Spatial Filtering</span>
              <span className="text-emerald-400">Max Silhouette Score across K=2..6</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded border border-slate-800 bg-slate-800/60 p-3">
                <span className="font-mono text-slate-400 text-[10px] uppercase block">1. Multivariate z-scoring</span>
                <p className="text-slate-300 mt-1">Normalizes pH, EC, N, P, K into zero-mean unit-variance space.</p>
              </div>
              <div className="rounded border border-emerald-800/80 bg-emerald-950/40 p-3">
                <span className="font-mono text-emerald-400 text-[10px] uppercase block">2. Silhouette argmax</span>
                <p className="text-emerald-200 mt-1">Identifies natural cluster separation without arbitrary human guessing.</p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-800/60 p-3">
                <span className="font-mono text-slate-400 text-[10px] uppercase block">3. Contiguity Filtering</span>
                <p className="text-slate-300 mt-1">Merges small isolated micro-cells with majority neighbors for contiguous zones.</p>
              </div>
            </div>
          </div>
        );

      // Module 2: Field Telemetry stages
      case 'gru-ingestion':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>WSN Data Stream Pipeline</span>
              <span className="text-amber-400">Temporal Resampling &amp; Validation</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded bg-slate-800/70 p-3 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block font-bold">Resampling dt = 10 min</span>
                <p className="text-slate-200 mt-0.5">Aggregates irregular telemetry packets into regular time series.</p>
              </div>
              <div className="rounded bg-slate-800/70 p-3 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block font-bold">5 Monitored Channels</span>
                <p className="text-amber-300 mt-0.5">[Soil %RH, Soil Temp, Soil EC, Air Temp, Air RH]</p>
              </div>
            </div>
          </div>
        );

      case 'gru-recurrent':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Deep Recurrent Architecture: 2-Layer GRU with Residual Dense Head</span>
              <span className="text-emerald-400">144 Timesteps (24h) → Multi-Horizon Deltas</span>
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 font-mono text-xs">
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-slate-400 text-[10px] block">Input Window</span>
                <span className="text-white font-bold">144 × 5</span>
              </div>
              <ArrowRight size={14} className="text-slate-500 shrink-0" />
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-emerald-400 text-[10px] block">GRU Layer 1</span>
                <span className="text-white font-bold">64 Units</span>
              </div>
              <ArrowRight size={14} className="text-slate-500 shrink-0" />
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-emerald-400 text-[10px] block">GRU Layer 2</span>
                <span className="text-white font-bold">32 Units</span>
              </div>
              <ArrowRight size={14} className="text-slate-500 shrink-0" />
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-purple-400 text-[10px] block">Dense Head</span>
                <span className="text-white font-bold">Δy (+6h, +12h, +24h)</span>
              </div>
            </div>
          </div>
        );

      // Module 3: Remote Sensing stages
      case 'satellite-indices':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>Sentinel-2 Multispectral Processing &amp; QA60 Filtering</span>
              <span className="text-purple-400">10m B04 Red (665nm) &amp; B08 NIR (842nm)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded bg-slate-800/80 p-3 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">Vegetation Index Formula</span>
                <p className="text-emerald-300 font-bold mt-1">NDVI = (B08 - B04) / (B08 + B04)</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Measures canopy chlorophyll absorption vs cellular scattering</p>
              </div>
              <div className="rounded bg-slate-800/80 p-3 border border-slate-700/60">
                <span className="text-slate-400 text-[10px] block">QA60 Clear-Sky Filter</span>
                <p className="text-purple-300 font-bold mt-1">Bit 10 (Opaque) | Bit 11 (Cirrus) == 0</p>
                <p className="text-slate-400 text-[10px] mt-0.5">Discards cloud-contaminated acquisition windows</p>
              </div>
            </div>
          </div>
        );

      // Module 4: Leaf Vision stages
      case 'mobilenet-inference':
        return (
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span>MobileNetV3-Small: Inverted Residual Bottlenecks with Squeeze-and-Excitation</span>
              <span className="text-emerald-400">17 Classes · 92.97% Accuracy</span>
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto py-1 font-mono text-xs">
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-slate-400 text-[10px] block">RGB Input</span>
                <span className="text-white font-bold">224 × 224 × 3</span>
              </div>
              <ArrowRight size={14} className="text-slate-500 shrink-0" />
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-emerald-400 text-[10px] block">Backbone</span>
                <span className="text-white font-bold">Hard-Swish + SE</span>
              </div>
              <ArrowRight size={14} className="text-slate-500 shrink-0" />
              <div className="rounded bg-slate-800 px-3 py-2 border border-slate-700 shrink-0 text-center">
                <span className="text-purple-400 text-[10px] block">Classifier</span>
                <span className="text-white font-bold">Top-3 Softmax</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Overview Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              {moduleBadge}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              {stages.length} Sequential Pipeline Stages
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{moduleTitle}</h2>
        </div>

        {/* Quick Stepper Navigation Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handlePrev}
            disabled={activeStepIndex === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous Stage"
          >
            <ArrowLeft size={13} />
            <span>Prev</span>
          </button>
          <span className="text-xs font-mono font-bold text-slate-500 px-1">
            {activeStepIndex + 1} / {stages.length}
          </span>
          <button
            onClick={handleNext}
            disabled={activeStepIndex === stages.length - 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Stage"
          >
            <span>Next</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Horizontal Pipeline Stepper / Track */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-md overflow-x-auto">
        <div className="flex min-w-[650px] items-center justify-between relative px-4 py-2">
          {/* Connecting Line SVG */}
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 pointer-events-none z-0">
            <svg className="w-full h-3 overflow-visible" preserveAspectRatio="none">
              <line
                x1="0"
                y1="6"
                x2="100%"
                y2="6"
                stroke="#334155"
                strokeWidth="2"
              />
              <line
                x1="0"
                y1="6"
                x2="100%"
                y2="6"
                stroke="#10b981"
                strokeWidth="2"
                className="pipeline-flow-path"
              />
            </svg>
          </div>

          {/* Stepper Nodes */}
          {stages.map((stage, idx) => {
            const Icon = ICON_MAP[stage.iconName] || Activity;
            const isActive = idx === activeStepIndex;
            const isCompleted = idx < activeStepIndex;

            return (
              <button
                key={stage.id}
                onClick={() => setActiveStepIndex(idx)}
                className={`group relative z-10 flex flex-col items-center gap-2 focus:outline-none transition-transform ${
                  isActive ? 'scale-105' : 'hover:scale-102'
                }`}
              >
                {/* Stage Circle */}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                      : isCompleted
                      ? 'border-emerald-700 bg-slate-800 text-emerald-400 hover:border-emerald-500'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <Icon size={16} />
                </div>

                {/* Micro Label */}
                <div className="text-center">
                  <span
                    className={`block font-mono text-[10px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'text-emerald-400'
                        : isCompleted
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    Step {stage.stepNumber}
                  </span>
                  <span
                    className={`block max-w-[120px] truncate text-[11px] font-medium leading-tight ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {stage.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Deep Inspector Panel with smooth animated transition */}
      <div
        key={activeStage.id}
        className="stage-transition-panel rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      >
        {/* Stage Header Banner */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 font-mono text-[10px] font-bold text-white">
                  {activeStage.stepNumber}
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Pipeline Stage {activeStage.stepNumber} of {stages.length}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">{activeStage.title}</h3>
              <p className="text-xs text-slate-600">{activeStage.subtitle}</p>
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handlePrev}
                disabled={activeStepIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={13} />
                <span>Previous Stage</span>
              </button>
              <button
                onClick={handleNext}
                disabled={activeStepIndex === stages.length - 1}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Stage</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Stage Content Grid */}
        <div className="p-6 space-y-6">
          {/* Visual Stage Illustration Banner */}
          {renderStageVisual(activeStage.id)}

          {/* Contracts Grid: Inputs vs Outputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input Contract */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Input Data</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed font-mono text-slate-700">
                {activeStage.inputDescription}
              </p>
            </div>

            {/* Output Contract */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Output Data</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed font-mono text-slate-700">
                {activeStage.outputDescription}
              </p>
            </div>
          </div>

          {/* Algorithmic Details & Scientific Rationale */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Execution &amp; Methodology
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  {activeStage.algorithmSummary}
                </p>
              </div>

              {/* Mathematical Formulation & LaTeX Cards */}
              {activeStage.keyFormulas && activeStage.keyFormulas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Mathematical Formulation
                  </h4>
                  {activeStage.keyFormulas.map((formula, fIdx) => (
                    <InteractiveFormulaCard
                      key={fIdx}
                      name={formula.name}
                      latex={formula.latex}
                      description={formula.description}
                      variables={formula.variables}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Rationale & Limits */}
            <div className="space-y-4">
              {/* Scientific Rationale Card */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <BookOpen size={14} className="text-emerald-700" />
                  <span>Design Rationale</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-emerald-950">
                  {activeStage.scientificRationale}
                </p>
              </div>

              {/* Practical Limits */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertTriangle size={14} className="text-amber-700" />
                  <span>Practical Limits &amp; Boundaries</span>
                </div>
                <ul className="mt-2 space-y-2 text-xs text-amber-950 list-disc list-inside">
                  {activeStage.operationalLimits.map((limit, lIdx) => (
                    <li key={lIdx} className="leading-relaxed">
                      {limit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
