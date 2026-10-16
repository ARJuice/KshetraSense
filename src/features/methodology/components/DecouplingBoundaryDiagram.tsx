import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  Leaf,
  Radio,
  Satellite,
  ShieldCheck,
  Sprout,
} from 'lucide-react';

export const DecouplingBoundaryDiagram: React.FC = () => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              SYS
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              System Topology &amp; Architectural Pipelines
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Topological layout of the 5 analytical pipelines showing input sources, metric processing, and decision support outputs.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-800 self-start sm:self-auto flex items-center gap-1.5">
          <ShieldCheck size={13} />
          <span>5 Modular Pipelines</span>
        </span>
      </div>

      {/* Visual Architectural Topology Flowchart */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-white shadow-inner space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
            End-to-End Ingestion &amp; Analytical Topology
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
            Local-First · Transparent Decision Support
          </span>
        </div>

        {/* 5 Ingestion Tracks */}
        <div className="space-y-3">
          {/* Module 1 Track */}
          <div className="topology-track-card group grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="md:col-span-4 flex items-center gap-2.5 font-mono text-xs text-blue-400">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-950/80 border border-blue-800 text-blue-400 transition-transform group-hover:scale-105">
                <Database size={14} />
              </div>
              <div>
                <span className="font-bold block text-slate-200">Soil Laboratory Cores</span>
                <span className="text-[10px] text-slate-400">GeoJSON Polygon + 3-50 Point Samples</span>
              </div>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={16} className="text-slate-500 topology-flow-arrow" />
            </div>
            <div className="md:col-span-7 rounded-lg bg-slate-800/90 p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white font-semibold flex items-center gap-1.5">
                  <Layers size={13} className="text-blue-400" />
                  Module 1: Soil Zoning &amp; Spatial ML
                </strong>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                  IDW p=2 · Auto-K*
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Discretizes parcel into regular 5m/10m metric grid, interpolates soil chemistry, sweeps cluster Silhouette scores, and generates management zones.
              </p>
            </div>
          </div>

          {/* Module 2 Track */}
          <div className="topology-track-card group grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="md:col-span-4 flex items-center gap-2.5 font-mono text-xs text-amber-400">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-950/80 border border-amber-800 text-amber-400 transition-transform group-hover:scale-105">
                <Radio size={14} />
              </div>
              <div>
                <span className="font-bold block text-slate-200">Field Telemetry WSN</span>
                <span className="text-[10px] text-slate-400">In-situ Soil &amp; Microclimate Series</span>
              </div>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={16} className="text-slate-500 topology-flow-arrow" />
            </div>
            <div className="md:col-span-7 rounded-lg bg-slate-800/90 p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white font-semibold flex items-center gap-1.5">
                  <Cpu size={13} className="text-amber-400" />
                  Module 2: Field Telemetry &amp; GRU Forecaster
                </strong>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50">
                  144×5 Window · Multi-Horizon
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ingests chronologically ordered sensor observations, resamples to regular 10-min bins, and forecasts future moisture deltas (+6h, +12h, +24h).
              </p>
            </div>
          </div>

          {/* Module 3 Track */}
          <div className="topology-track-card group grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="md:col-span-4 flex items-center gap-2.5 font-mono text-xs text-purple-400">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-purple-950/80 border border-purple-800 text-purple-400 transition-transform group-hover:scale-105">
                <Satellite size={14} />
              </div>
              <div>
                <span className="font-bold block text-slate-200">Satellite Remote Sensing</span>
                <span className="text-[10px] text-slate-400">Copernicus Sentinel-2 + ISRIC 250m</span>
              </div>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={16} className="text-slate-500 topology-flow-arrow" />
            </div>
            <div className="md:col-span-7 rounded-lg bg-slate-800/90 p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white font-semibold flex items-center gap-1.5">
                  <Satellite size={13} className="text-purple-400" />
                  Module 3: CropSight &amp; SoilGrids Covariates
                </strong>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
                  QA60 Mask · Aggregate AOI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Filters clouds via QA60 bitmask, computes canopy vegetative vigor (NDVI), and retrieves regional 250m soil context without uncalibrated downscaling.
              </p>
            </div>
          </div>

          {/* Module 4 Track */}
          <div className="topology-track-card group grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="md:col-span-4 flex items-center gap-2.5 font-mono text-xs text-emerald-400">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-400 transition-transform group-hover:scale-105">
                <Leaf size={14} />
              </div>
              <div>
                <span className="font-bold block text-slate-200">Foliar RGB Imagery</span>
                <span className="text-[10px] text-slate-400">Single Leaf Photo (224×224 px)</span>
              </div>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={16} className="text-slate-500 topology-flow-arrow" />
            </div>
            <div className="md:col-span-7 rounded-lg bg-slate-800/90 p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white font-semibold flex items-center gap-1.5">
                  <Leaf size={13} className="text-emerald-400" />
                  Module 4: MobileNetV3 Foliar Pathology
                </strong>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                  17 Classes · On-Device Inference
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Fast convolutional feature extractor classifying foliar diseases into top-3 probabilistic candidates with mandatory agronomist verification.
              </p>
            </div>
          </div>

          {/* Module 5 Track */}
          <div className="topology-track-card group grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-lg border border-slate-800 bg-slate-900/80 p-3.5">
            <div className="md:col-span-4 flex items-center gap-2.5 font-mono text-xs text-rose-400">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-950/80 border border-rose-800 text-rose-400 transition-transform group-hover:scale-105">
                <Sprout size={14} />
              </div>
              <div>
                <span className="font-bold block text-slate-200">Zone Agronomic Chemistry</span>
                <span className="text-[10px] text-slate-400">pH, EC, Macronutrients, Drainage</span>
              </div>
            </div>
            <div className="md:col-span-1 hidden md:flex justify-center text-slate-500">
              <ArrowRight size={16} className="text-slate-500 topology-flow-arrow" />
            </div>
            <div className="md:col-span-7 rounded-lg bg-slate-800/90 p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs">
                <strong className="text-white font-semibold flex items-center gap-1.5">
                  <Sprout size={13} className="text-rose-400" />
                  Module 5: Agronomic Crop Fit &amp; DSS
                </strong>
                <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/50">
                  Multi-Factor Evaluation
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Evaluates soil profiles against calibrated agronomic boundaries for regional crops (Finger Millet, Tomato, Groundnut) to identify limiting factors.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Highlights Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="interactive-hover-card rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Modular Separation of Concerns</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Each analytical pipeline executes independently with explicit inputs and outputs, preventing cross-domain errors and ensuring reproducible results.
          </p>
        </div>

        <div className="interactive-hover-card rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Local-First &amp; Deterministic</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Spatial interpolation and clustering run directly on transparent mathematical formulations without obscure black-box heuristics.
          </p>
        </div>

        <div className="interactive-hover-card rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Human-Centric Decision Support</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All predictions and zones are delivered as actionable, inspectable advisories for agronomists rather than automated unverified actuators.
          </p>
        </div>
      </div>
    </div>
  );
};
