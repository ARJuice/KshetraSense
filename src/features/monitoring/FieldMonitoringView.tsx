import React, { useEffect, useState } from 'react';
import { Activity, FlaskConical, Satellite } from 'lucide-react';
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

  return (
    <main className="flex-1 overflow-y-auto bg-parchment-100/60 p-5 lg:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Module Master Header */}
        <header className="flex flex-col justify-between gap-4 border-b border-line-border pb-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-ink">Field Monitoring</span>
              <span className="rounded-full border border-line-border bg-parchment-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
                Functional Module
              </span>
            </div>
            <p className="max-w-3xl text-xs leading-6 text-ink-muted">
              Record validated measured soil observations, query coarse 250m regional SoilGrids context, and run Sentinel-2 / Google Earth Engine vegetation monitoring via the independent CropSight sub-application.
            </p>
          </div>

          {/* Primary View Switcher */}
          <div className="flex flex-wrap rounded-lg border border-line-border bg-parchment-50 p-1 shadow-instrument" role="tablist" aria-label="Field Monitoring Modules">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'soil'}
              onClick={() => setActiveTab('soil')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'soil'
                  ? 'bg-sage-700 text-parchment-50 shadow-sm'
                  : 'text-ink-muted hover:bg-parchment-100 hover:text-ink'
              }`}
            >
              <FlaskConical size={14} />
              <span>Soil Investigation</span>
              <span className="rounded bg-black/15 px-1.5 py-0.2 font-mono text-[10px]">
                {samples.length}
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'telemetry'}
              onClick={() => setActiveTab('telemetry')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'telemetry'
                  ? 'bg-sage-700 text-parchment-50 shadow-sm'
                  : 'text-ink-muted hover:bg-parchment-100 hover:text-ink'
              }`}
            >
              <Activity size={14} />
              <span>Historical Telemetry Replay</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'vegetation'}
              onClick={() => setActiveTab('vegetation')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === 'vegetation'
                  ? 'bg-sage-700 text-parchment-50 shadow-sm'
                  : 'text-ink-muted hover:bg-parchment-100 hover:text-ink'
              }`}
            >
              <Satellite size={14} />
              <span>Vegetation Monitoring (CropSight)</span>
            </button>
          </div>
        </header>

        {storageLoad.archivedPresetCount > 0 && (
          <div className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-xs text-amberGold-dark">
            Archived {storageLoad.archivedPresetCount} legacy synthetic soil preset record(s) from active measurements. Manual and CSV records were preserved.
          </div>
        )}
        {storageLoad.migrationWarning && (
          <div className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-xs text-amberGold-dark">
            Browser storage could not archive legacy synthetic presets. They remain clearly marked as non-measurements; active measurement summaries exclude them.
          </div>
        )}

        {/* View Switch */}
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
    </main>
  );
};
