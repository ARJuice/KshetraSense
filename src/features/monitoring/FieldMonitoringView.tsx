import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, FlaskConical, Satellite } from 'lucide-react';
import { SoilInvestigationView } from './SoilInvestigationView';
import { TelemetryReplayView } from './TelemetryReplayView';
import { VegetationMonitoringView } from './VegetationMonitoringView';
import { loadStoredSoilSamples, SOIL_SAMPLES_STORAGE_KEY } from './soilSampleStorage';
import type { SoilMeasurement } from './types';

export interface FieldMonitoringViewProps {
  onSamplesChange?: (samples: SoilMeasurement[]) => void;
}

export const FieldMonitoringView: React.FC<FieldMonitoringViewProps> = ({ onSamplesChange }) => {
  const [activeTab, setActiveTab] = useState<'soil' | 'telemetry' | 'vegetation'>('soil');
  const [storageLoad] = useState(() => loadStoredSoilSamples(localStorage));
  const [samples, setSamples] = useState<SoilMeasurement[]>(storageLoad.samples);

  // Save to localStorage when samples change
  const handleUpdateSamples = (nextSamples: SoilMeasurement[]) => {
    setSamples(nextSamples);
    try {
      localStorage.setItem(SOIL_SAMPLES_STORAGE_KEY, JSON.stringify(nextSamples));
    } catch {
      // ignore storage quota errors
    }
    onSamplesChange?.(nextSamples);
  };

  useEffect(() => {
    onSamplesChange?.(samples);
  }, []);

  const navTabs = [
    {
      id: 'soil' as const,
      title: 'Soil Investigation',
      description: 'Lab samples & 250m SoilGrids context',
      icon: FlaskConical,
      badge: `${samples.length} ${samples.length === 1 ? 'record' : 'records'}`,
    },
    {
      id: 'telemetry' as const,
      title: 'Telemetry Replay',
      description: 'In-situ sensor WSN & time-series',
      icon: Activity,
      badge: 'WSN Model',
    },
    {
      id: 'vegetation' as const,
      title: 'Vegetation Monitoring',
      description: 'Multispectral Sentinel-2 & CropSight',
      icon: Satellite,
      badge: 'Copernicus S2',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Module Master Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Precision Agriculture
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-[11px] font-semibold text-slate-500">
                Field Monitoring &amp; Telemetry
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Field Monitoring &amp; Observations
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              Record validated measured soil observations, query coarse 250m regional SoilGrids context, replay in-situ sensor telemetry, and run Sentinel-2 multispectral vegetation monitoring via the independent CropSight sub-application.
            </p>
          </div>

          {/* Primary View Segmented Dock */}
          <nav
            role="tablist"
            aria-label="Field Monitoring Modules"
            className="grid grid-cols-1 gap-2.5 rounded-2xl border border-slate-200/90 bg-slate-100/70 p-1.5 sm:grid-cols-3"
          >
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-3.5 rounded-xl px-4 py-3 text-left transition-all duration-150 ${
                    isActive
                      ? 'border border-slate-200/90 bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5'
                      : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20'
                        : 'bg-slate-200/60 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold tracking-tight">
                        {tab.title}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-slate-400 group-hover:text-slate-500">
                      {tab.description}
                    </p>
                  </div>
                  <span
                    className={`ml-auto shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                      isActive
                        ? 'border border-emerald-200/60 bg-emerald-50 text-emerald-700'
                        : 'bg-slate-200/50 text-slate-500'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </header>

        {storageLoad.archivedPresetCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>
              Archived {storageLoad.archivedPresetCount} legacy synthetic soil preset record(s) from active measurements. Manual and CSV records were preserved.
            </span>
          </div>
        )}
        {storageLoad.migrationWarning && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
            <AlertCircle size={16} className="shrink-0 text-amber-600" />
            <span>
              Browser storage could not archive legacy synthetic presets. They remain clearly marked as non-measurements; active measurement summaries exclude them.
            </span>
          </div>
        )}

        {/* View Switch with smooth in-module transition */}
        <div key={activeTab} className="module-nav-transition">
          {activeTab === 'soil' ? (
            <SoilInvestigationView
              samples={samples}
              onUpdateSamples={handleUpdateSamples}
            />
          ) : activeTab === 'telemetry' ? (
            <TelemetryReplayView />
          ) : (
            <VegetationMonitoringView />
          )}
        </div>
      </div>
    </div>
  );
};
