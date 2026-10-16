import React, { useState } from 'react';
import {
  Activity,
  GitFork,
  HelpCircle,
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
  { id: 'system', label: 'System Topology', detail: 'Modular pipelines', icon: GitFork },
  { id: 'zoning', label: 'Soil Zoning', detail: 'IDW & Auto-K Spatial ML', icon: Layers },
  { id: 'telemetry', label: 'Field Telemetry', detail: 'Time-series & GRU', icon: Activity },
  { id: 'remote-sensing', label: 'CropSight & SoilGrids', detail: 'Sentinel-2 & Covariates', icon: Satellite },
  { id: 'leaf-vision', label: 'Leaf Diagnosis', detail: 'MobileNetV3-Small CNN', icon: Leaf },
  { id: 'crop-fit', label: 'Crop Fit & DSS', detail: 'Multi-factor suitability', icon: Sprout },
  { id: 'defense', label: 'Scope & Architecture FAQ', detail: 'Key decisions & tests', icon: HelpCircle },
];

export const MethodologyLimitsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MethodologyTab>('system');

  return (
    <section className="workspace methodology-container space-y-6">
      {/* Module Master Header */}
      <header className="workspace__header">
        <div>
          <p className="eyebrow">Methodology &amp; System Architecture</p>
          <h1>Scientific Methods &amp; Processing Pipelines</h1>
          <p className="workspace__lede">
            Modular architecture: how laboratory soil cores, in-situ sensor telemetry, satellite reflectances, and leaf photographs are processed through transparent analytical pipelines.
          </p>
        </div>
      </header>

      {/* Architecture Highlights Stats Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Architecture</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">5 Modules</p>
          <span className="text-[10px] text-emerald-700 font-medium">Modular &amp; Local-First</span>
        </div>

        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Spatial Interpolation</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">IDW p=2.0</p>
          <span className="text-[10px] text-emerald-700 font-medium">Cross-Validated LOOCV</span>
        </div>

        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cluster Selection</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">Auto-K* (2..6)</p>
          <span className="text-[10px] text-emerald-700 font-medium">Silhouette Optimized</span>
        </div>

        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Time-Series Model</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">2-Layer GRU</p>
          <span className="text-[10px] text-emerald-700 font-medium">Multi-Horizon Delta</span>
        </div>

        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Foliar Classifier</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">MobileNetV3</p>
          <span className="text-[10px] text-emerald-700 font-medium">92.97% Test Accuracy</span>
        </div>

        <div className="stat-chip-stagger interactive-hover-card rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Verification</span>
          <p className="font-mono text-base font-bold text-slate-900 mt-0.5">Full Coverage</p>
          <span className="text-[10px] text-emerald-700 font-medium">Deterministic Suites</span>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100/90 p-1.5 shadow-xs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`methodology-tab-btn active:scale-95 ${
                isActive ? 'methodology-tab-btn--active' : 'methodology-tab-btn--inactive'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel Content with Smooth Animated Transition */}
      <div key={activeTab} className="methodology-tab-pane space-y-6">
        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <DecouplingBoundaryDiagram />

            {/* High-level system overview card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                End-to-End Decision Support Architecture &amp; Data Flow
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                KshetraSense operates under an evidence-bounded, modular analytical progression. Each module produces inspectable mathematical and visual artifacts to assist agronomists and farmers with informed field planning:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-emerald-700">STAGE 1</span>
                  <h4 className="text-xs font-bold text-slate-900">Soil Zoning</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Transforms laboratory soil cores into continuous 10m rasters and coherent management zones.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-blue-700">STAGE 2</span>
                  <h4 className="text-xs font-bold text-slate-900">Telemetry Replay</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Replays in-situ telemetry, evaluates multi-step GRU sequence models, and screens anomaly patterns.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-purple-700">STAGE 3</span>
                  <h4 className="text-xs font-bold text-slate-900">Remote Sensing</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Monitors Sentinel-2 NDVI canopy vigor with QA60 cloud screening and regional 250m soil context.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-amber-700">STAGE 4</span>
                  <h4 className="text-xs font-bold text-slate-900">Leaf Pathology</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Classifies foliar conditions across 17 disease classes using lightweight on-device MobileNetV3.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <span className="font-mono text-[10px] font-bold text-rose-700">STAGE 5</span>
                  <h4 className="text-xs font-bold text-slate-900">Crop Suitability DSS</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Evaluates multi-factor compatibility for regional crops (Finger Millet, Tomato, Groundnut).
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
              moduleTitle="Module 1: Soil Zoning &amp; Spatial Machine Learning Core"
              moduleBadge="Spatial ML Engine"
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
              moduleTitle="Module 2: Field Telemetry &amp; GRU Sequence Forecaster"
              moduleBadge="Time-Series Engine"
              stages={telemetryStages}
            />
            <GruTopologyVisualizer />
          </div>
        )}

        {/* TAB 4: REMOTE SENSING & SOILGRIDS */}
        {activeTab === 'remote-sensing' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 3: Sentinel-2 NDVI Remote Sensing &amp; ISRIC SoilGrids 2.0"
              moduleBadge="Earth Observation"
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
              moduleBadge="Computer Vision"
              stages={leafVisionStages}
            />
            <MobileNetV3Visualizer />
          </div>
        )}

        {/* TAB 6: CROP FIT & AGRONOMIC DSS */}
        {activeTab === 'crop-fit' && (
          <div className="space-y-6">
            <PipelineStageFlow
              moduleTitle="Module 5: Agronomic Crop Fit Reference Catalog &amp; DSS"
              moduleBadge="Decision Support Engine"
              stages={cropFitStages}
            />
            <CropFitBoundaryMatrix />
          </div>
        )}

        {/* TAB 7: SCOPE, FAQS & TEST MATRIX */}
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
