import React, { useState } from 'react';
import {
  Activity,
  GitFork,
  GraduationCap,
  Layers,
  Leaf,
  Satellite,
  Sprout,
} from 'lucide-react';
import {
  cropFitStages,
  leafVisionStages,
  remoteSensingStages,
  soilZoningStages,
  telemetryStages,
} from './methodologyData';
import { PipelineStageFlow } from './components/PipelineStageFlow';
import { SpatialZoningVisualizer } from './components/SpatialZoningVisualizer';
import { InteractiveSHICalculator } from './components/InteractiveSHICalculator';
import { GruTopologyVisualizer } from './components/GruTopologyVisualizer';
import { RemoteSensingPipelineVisualizer } from './components/RemoteSensingPipelineVisualizer';
import { MobileNetV3Visualizer } from './components/MobileNetV3Visualizer';
import { DecouplingBoundaryDiagram } from './components/DecouplingBoundaryDiagram';
import { CropFitBoundaryMatrix } from './components/CropFitBoundaryMatrix';
import { DefenseQnAPanel } from './components/DefenseQnAPanel';
import { TestMatrixView } from './components/TestMatrixView';
import './methodology.css';

type MethodologyTab =
  | 'system'
  | 'zoning'
  | 'telemetry'
  | 'remote-sensing'
  | 'leaf-vision'
  | 'crop-fit'
  | 'defense';

interface TabConfig {
  id: MethodologyTab;
  label: string;
  detail: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { id: 'system', label: 'System Topology', detail: 'Whole-project firewalls', icon: GitFork },
  { id: 'zoning', label: 'Soil Zoning', detail: 'IDW & Auto-K Spatial ML', icon: Layers },
  { id: 'telemetry', label: 'Field Telemetry', detail: 'Parma trial & GRU', icon: Activity },
  { id: 'remote-sensing', label: 'CropSight & SoilGrids', detail: 'Sentinel-2 & 250m WCS', icon: Satellite },
  { id: 'leaf-vision', label: 'Leaf Diagnosis', detail: 'MobileNetV3-Small CNN', icon: Leaf },
  { id: 'crop-fit', label: 'Crop Fit & DSS', detail: 'Karnataka 3-crop reference', icon: Sprout },
  { id: 'defense', label: 'Defense Q&A & Tests', detail: '11 Q&As & verification', icon: GraduationCap },
];

export const MethodologyLimitsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MethodologyTab>('system');

  return (
    <section className="workspace methodology-container space-y-6">
      {/* Module Master Header */}
      <header className="workspace__header">
        <div>
          <p className="eyebrow">Methodology &amp; Mathematical Constraints</p>
          <h1>Scientific Methods &amp; Architectural Pipelines</h1>
          <p className="workspace__lede">
            Traceability architecture: how discrete laboratory soil cores, in-situ WSN telemetry, satellite multispectral reflectances, and leaf photographs are processed through mathematically bounded, isolated analytical pipelines.
          </p>
        </div>
      </header>

      {/* Quick Scientific Architecture Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Architecture</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">5 Modules</p>
          <span className="text-[10px] text-emerald-700 font-medium">100% Decoupled</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Spatial Interpolation</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">IDW p=2.0</p>
          <span className="text-[10px] text-emerald-700 font-medium">LOOCV Cross-Val</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Clustering Sweep</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">Auto-K* (2..6)</p>
          <span className="text-[10px] text-emerald-700 font-medium">Silhouette argmax</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Time-Series Model</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">2-Layer GRU</p>
          <span className="text-[10px] text-amber-700 font-medium">Persistence Evaluated</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Foliar Classifier</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">MobileNetV3</p>
          <span className="text-[10px] text-emerald-700 font-medium">92.97% Test Acc</span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Verification</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">56 TS / 94 Py</p>
          <span className="text-[10px] text-emerald-700 font-medium">Automated CI Suites</span>
        </div>
      </div>

      {/* Interactive Module Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/80 p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`methodology-tab-btn ${
                isActive ? 'methodology-tab-btn--active' : 'methodology-tab-btn--inactive'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel Content */}
      <div className="space-y-6">
        {/* TAB 1: SYSTEM OVERVIEW & DECOUPLING */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <DecouplingBoundaryDiagram />

            {/* High-level system walkthrough card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                End-to-End Decision Support Architecture &amp; Data Progression
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                KshetraSense operates under an evidence-bounded, four-stage analytical progression. Each module produces inspectable mathematical and visual artifacts for human agronomist review, explicitly refusing to automate closed-loop physical actuation without verified on-site calibration:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-emerald-700">STAGE 1</span>
                  <h4 className="text-xs font-bold text-slate-900">Pre-Season Soil Zoning</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Transforms 3-50 sparse laboratory soil cores into continuous 10m raster estimates and contiguous management zones.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-blue-700">STAGE 2</span>
                  <h4 className="text-xs font-bold text-slate-900">In-Season Telemetry Replay</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Replays historical research WSN data (Parma 2023), tests GRU sequence forecasting, and screens anomaly candidates.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-purple-700">STAGE 3</span>
                  <h4 className="text-xs font-bold text-slate-900">Multispectral Canopy Scouting</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Inspects Sentinel-2 NDVI vegetative vigor trajectories and compares with regional 250m ISRIC SoilGrids covariates.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-amber-700">STAGE 4</span>
                  <h4 className="text-xs font-bold text-slate-900">Targeted Foliar Pathology</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Classifies single leaf photos across 17 audited conditions with an enforced human review mandate on all outputs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SOIL ZONING & SPATIAL ML */}
        {activeTab === 'zoning' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 1: Soil Zoning & Spatial Machine Learning Core"
              moduleBadge="Phase 1 & Phase 2 Verified"
              stages={soilZoningStages}
            />
            <SpatialZoningVisualizer />
            <InteractiveSHICalculator />
          </div>
        )}

        {/* TAB 3: FIELD TELEMETRY & GRU */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 2: Historical Telemetry Replay & GRU Forecaster"
              moduleBadge="Phase 3 & Phase 4 Verified"
              stages={telemetryStages}
            />
            <GruTopologyVisualizer />
          </div>
        )}

        {/* TAB 4: REMOTE SENSING & SOILGRIDS */}
        {activeTab === 'remote-sensing' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 3: Sentinel-2 NDVI Remote Sensing & ISRIC SoilGrids 2.0"
              moduleBadge="Phase 4 Verified"
              stages={remoteSensingStages}
            />
            <RemoteSensingPipelineVisualizer />
          </div>
        )}

        {/* TAB 5: LEAF PATHOLOGY CNN */}
        {activeTab === 'leaf-vision' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 4: MobileNetV3-Small Leaf Disease Classifier"
              moduleBadge="Phase 5 Verified"
              stages={leafVisionStages}
            />
            <MobileNetV3Visualizer />
          </div>
        )}

        {/* TAB 6: CROP FIT & AGRONOMIC DSS */}
        {activeTab === 'crop-fit' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 5: Agronomic Crop Fit Reference Catalog & DSS Boundaries"
              moduleBadge="Decisions 0011 & 0012"
              stages={cropFitStages}
            />
            <CropFitBoundaryMatrix />
          </div>
        )}

        {/* TAB 7: ACADEMIC DEFENSE & TEST MATRIX */}
        {activeTab === 'defense' && (
          <div className="space-y-6">
            <DefenseQnAPanel />
            <TestMatrixView />
          </div>
        )}
      </div>
    </section>
  );
};
