import React, { useState, useEffect } from 'react';
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
  Pause,
  Play,
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
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const activeStage = stages[activeStepIndex] || stages[0];

  // Auto-play timer for educational walkthrough
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % stages.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlaying, stages.length]);

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
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-blue-400">WGS84 EPSG:4326 Input</span>
              <span className="text-emerald-400">UTM Zone 43N (EPSG:32643) Output</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 60" className="w-56 h-28">
                <polygon points="15,40 30,15 80,18 90,48 40,55" fill="#065f46" fillOpacity="0.4" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="15" cy="40" r="2" fill="#38bdf8" />
                <circle cx="30" cy="15" r="2" fill="#38bdf8" />
                <circle cx="80" cy="18" r="2" fill="#38bdf8" />
                <circle cx="90" cy="48" r="2" fill="#38bdf8" />
                <circle cx="40" cy="55" r="2" fill="#38bdf8" />
                <text x="50" y="36" fill="#a7f3d0" fontSize="4.5" textAnchor="middle" fontFamily="monospace">Area = 4.25 ha</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Conformal Transverse Mercator: Isotropic Euclidean distances in meters
            </p>
          </div>
        );

      case 'grid-discretization':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Axis-Aligned Bounding Box</span>
              <span className="text-emerald-400">10m Regular Discretization</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 60" className="w-56 h-28">
                <rect x="10" y="10" width="80" height="40" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                {Array.from({ length: 8 }, (_, c) => (
                  <line key={`v-${c}`} x1={10 + c * 10} y1="10" x2={10 + c * 10} y2="50" stroke="#334155" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 4 }, (_, r) => (
                  <line key={`h-${r}`} x1="10" y1={10 + r * 10} x2="90" y2={10 + r * 10} stroke="#334155" strokeWidth="0.5" />
                ))}
                <polygon points="15,45 30,15 80,18 85,48 40,50" fill="#065f46" fillOpacity="0.5" stroke="#10b981" strokeWidth="1.2" />
                <circle cx="35" cy="25" r="1.5" fill="#10b981" />
                <circle cx="45" cy="25" r="1.5" fill="#10b981" />
                <circle cx="55" cy="25" r="1.5" fill="#10b981" />
                <circle cx="35" cy="35" r="1.5" fill="#10b981" />
                <circle cx="45" cy="35" r="1.5" fill="#10b981" />
                <circle cx="55" cy="35" r="1.5" fill="#10b981" />
                <circle cx="65" cy="35" r="1.5" fill="#10b981" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Shapely contains_xy: Interior Centers Retained · Perimeter Footprint Clipped
            </p>
          </div>
        );

      case 'idw-interpolation':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Inverse Distance Weighting</span>
              <span className="text-emerald-400">Power Parameter p = 2.0</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 60" className="w-56 h-28">
                <circle cx="25" cy="30" r="12" fill="none" stroke="#10b981" strokeWidth="0.4" strokeDasharray="1 1" />
                <circle cx="25" cy="30" r="20" fill="none" stroke="#10b981" strokeWidth="0.3" strokeDasharray="1.5 1.5" />
                <circle cx="25" cy="30" r="3" fill="#10b981" />
                <text x="25" y="31" fill="#fff" fontSize="2.5" textAnchor="middle" fontWeight="bold">P1</text>
                <circle cx="75" cy="25" r="3" fill="#10b981" />
                <text x="75" y="26" fill="#fff" fontSize="2.5" textAnchor="middle" fontWeight="bold">P2</text>
                <line x1="25" y1="30" x2="52" y2="35" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="1.5 1" />
                <line x1="75" y1="25" x2="52" y2="35" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="1.5 1" />
                <circle cx="52" cy="35" r="2.5" fill="#38bdf8" />
                <text x="52" y="44" fill="#38bdf8" fontSize="3.5" textAnchor="middle" fontFamily="monospace">z_hat(s_0)</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Distance Decay: w_i = 1 / d_i^2 · Exact Interpolator at Sample Cores
            </p>
          </div>
        );

      case 'auto-k-clustering':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Silhouette Sweep K ∈ [2..6]</span>
              <span className="text-emerald-400 font-bold">Optimal K* = 3</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 50" className="w-56 h-24">
                <polyline points="15,35 32,15 50,28 68,38 85,44" fill="none" stroke="#10b981" strokeWidth="1.5" />
                <circle cx="15" cy="35" r="2" fill="#64748b" />
                <circle cx="32" cy="15" r="3" fill="#10b981" stroke="#fff" strokeWidth="0.8" />
                <circle cx="50" cy="28" r="2" fill="#64748b" />
                <circle cx="68" cy="38" r="2" fill="#64748b" />
                <circle cx="85" cy="44" r="2" fill="#64748b" />
                <text x="32" y="10" fill="#34d399" fontSize="3.5" textAnchor="middle" fontFamily="monospace">K=3 (Peak 0.635)</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Data-Driven Clustering: Silhouette argmax prevents artificial over-segmentation
            </p>
          </div>
        );

      // Module 2: Field Telemetry stages
      case 'provenance-ingestion':
      case 'resampling-qa':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Irregular Sensor Telemetry</span>
              <span className="text-emerald-400">10-Minute Resampled Grid</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 45" className="w-56 h-20">
                <line x1="5" y1="35" x2="95" y2="35" stroke="#475569" strokeWidth="0.5" />
                <path d="M 5,28 Q 25,12 45,25 T 95,20" fill="none" stroke="#10b981" strokeWidth="1.2" />
                <circle cx="15" cy="24" r="1.5" fill="#38bdf8" />
                <circle cx="35" cy="18" r="1.5" fill="#38bdf8" />
                <circle cx="55" cy="26" r="1.5" fill="#38bdf8" />
                <circle cx="75" cy="21" r="1.5" fill="#38bdf8" />
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Forward-Fill Quality Assurance · Outlier Flagging via Isolation Forest
            </p>
          </div>
        );

      case 'window-formulation':
      case 'gru-forecaster':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-blue-400">Sequence [144, 5]</span>
              <span className="text-emerald-400">Residual Head Δy</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 45" className="w-56 h-20">
                <rect x="8" y="12" width="22" height="22" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" />
                <text x="19" y="25" fill="#38bdf8" fontSize="3" textAnchor="middle" fontFamily="monospace">144x5</text>
                <line x1="30" y1="23" x2="40" y2="23" stroke="#64748b" strokeWidth="0.8" markerEnd="url(#arrow)" />
                <rect x="40" y="10" width="24" height="26" rx="2" fill="#065f46" stroke="#10b981" strokeWidth="0.8" />
                <text x="52" y="25" fill="#a7f3d0" fontSize="3" textAnchor="middle" fontFamily="monospace">GRU(64/32)</text>
                <line x1="64" y1="23" x2="74" y2="23" stroke="#64748b" strokeWidth="0.8" />
                <rect x="74" y="12" width="18" height="22" rx="2" fill="#581c87" stroke="#c084fc" strokeWidth="0.8" />
                <text x="83" y="25" fill="#e9d5ff" fontSize="3" textAnchor="middle" fontFamily="monospace">y_t + Δy</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Two-Layer GRU with Huber Loss · Residual Head added to Persistence
            </p>
          </div>
        );

      // Module 3: Remote Sensing
      case 'multispectral-indexing':
      case 'sentinel2-pipeline':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-rose-400">B4 Red (665nm)</span>
              <span className="text-emerald-400">B8 NIR (842nm)</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 45" className="w-56 h-20">
                <rect x="15" y="15" width="20" height="20" rx="3" fill="#be123c" fillOpacity="0.4" stroke="#f43f5e" strokeWidth="0.8" />
                <text x="25" y="27" fill="#fda4af" fontSize="3.5" textAnchor="middle" fontFamily="monospace">Red</text>
                <text x="50" y="28" fill="#e2e8f0" fontSize="5" textAnchor="middle" fontWeight="bold">→</text>
                <rect x="65" y="15" width="20" height="20" rx="3" fill="#065f46" fillOpacity="0.6" stroke="#10b981" strokeWidth="0.8" />
                <text x="75" y="27" fill="#a7f3d0" fontSize="3.5" textAnchor="middle" fontFamily="monospace">NIR</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              NDVI = (B8 - B4) / (B8 + B4) · QA60 Bitmask Dropping Cloud Pixels
            </p>
          </div>
        );

      // Module 4: Leaf Pathology
      case 'mobilenet-backbone':
      case 'image-normalization':
        return (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-blue-400">224 × 224 × 3 RGB</span>
              <span className="text-emerald-400">11 Inverted Residuals</span>
            </div>
            <div className="flex items-center justify-center py-2">
              <svg viewBox="0 0 100 45" className="w-56 h-20">
                <rect x="10" y="10" width="18" height="25" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="0.8" />
                <text x="19" y="24" fill="#38bdf8" fontSize="2.8" textAnchor="middle" fontFamily="monospace">Image</text>
                <text x="35" y="24" fill="#64748b" fontSize="4" textAnchor="middle">→</text>
                <rect x="42" y="8" width="26" height="29" rx="2" fill="#065f46" stroke="#10b981" strokeWidth="0.8" />
                <text x="55" y="20" fill="#a7f3d0" fontSize="2.8" textAnchor="middle" fontFamily="monospace">11 bnecks</text>
                <text x="55" y="27" fill="#6ee7b7" fontSize="2.2" textAnchor="middle" fontFamily="monospace">H-Swish+SE</text>
                <text x="75" y="24" fill="#64748b" fontSize="4" textAnchor="middle">→</text>
                <rect x="80" y="12" width="16" height="21" rx="2" fill="#701a75" stroke="#e879f9" strokeWidth="0.8" />
                <text x="88" y="24" fill="#f5d0fe" fontSize="2.6" textAnchor="middle" fontFamily="monospace">17 Cls</text>
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Pillow Bilinear · Depthwise Separable Convolutions · Hard-Swish
            </p>
          </div>
        );

      default:
        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex items-center justify-between text-xs text-slate-600 font-mono">
            <span>Input: {activeStage.inputDescription.split('.')[0]}</span>
            <ArrowRight size={14} className="text-emerald-600" />
            <span>Output: {activeStage.outputDescription.split('.')[0]}</span>
          </div>
        );
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoPlaying((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
              isAutoPlaying
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isAutoPlaying ? 'Pause Walkthrough' : 'Interactive Walkthrough'}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Pipeline Stepper / Track with Animated Data Pulses */}
      <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-md overflow-x-auto">
        <div className="flex min-w-[700px] items-center justify-between relative px-4 py-2">
          {/* Animated Connecting Line SVG */}
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
                onClick={() => {
                  setActiveStepIndex(idx);
                  setIsAutoPlaying(false);
                }}
                className={`group relative z-10 flex flex-col items-center gap-2 focus:outline-none transition-transform ${
                  isActive ? 'scale-105' : 'hover:scale-102'
                }`}
              >
                {/* Stage Circle with animated pulse on active */}
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
                    className={`block font-mono text-[10px] font-bold ${
                      isActive ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    STEP 0{stage.stepNumber}
                  </span>
                  <span
                    className={`block max-w-[100px] truncate text-[11px] font-medium transition-colors ${
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

      {/* Active Stage Deep Inspector Panel */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={13} />
                <span>Previous Stage</span>
              </button>
              <button
                onClick={handleNext}
                disabled={activeStepIndex === stages.length - 1}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
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
                <span>Input Data Contract</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed font-mono text-slate-700">
                {activeStage.inputDescription}
              </p>
            </div>

            {/* Output Contract */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Output Data Contract</span>
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
                  Algorithmic Execution &amp; Processing Steps
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-700">
                  {activeStage.algorithmSummary}
                </p>
              </div>

              {/* Mathematical Formulation & LaTeX Cards */}
              {activeStage.keyFormulas && activeStage.keyFormulas.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Mathematical Foundations
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
                  <span>Scientific Design Rationale</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-emerald-950">
                  {activeStage.scientificRationale}
                </p>
              </div>

              {/* Explicit Boundary Limits & Failure Modes */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <AlertTriangle size={14} className="text-amber-700" />
                  <span>Boundaries &amp; Model Limits</span>
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
