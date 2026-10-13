import React, { useEffect, useState } from 'react';
import { FlaskConical, Satellite } from 'lucide-react';
import { SoilInvestigationView } from './SoilInvestigationView';
import { VegetationMonitoringView } from './VegetationMonitoringView';
import { PUNJAB_WHEAT_SAMPLES } from './seedData';
import type { SoilMeasurement } from './types';

const STORAGE_KEY = 'kshetrasense:soil-samples:v1';

export interface FieldMonitoringViewProps {
  onSamplesChange?: (samples: SoilMeasurement[]) => void;
}

export const FieldMonitoringView: React.FC<FieldMonitoringViewProps> = ({ onSamplesChange }) => {
  const [activeTab, setActiveTab] = useState<'soil' | 'vegetation'>('soil');

  // Load from localStorage or initialize with Punjab benchmark seed
  const [samples, setSamples] = useState<SoilMeasurement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore JSON parse error
    }
    return PUNJAB_WHEAT_SAMPLES;
  });

  // Save to localStorage when samples change
  const handleUpdateSamples = (nextSamples: SoilMeasurement[]) => {
    setSamples(nextSamples);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSamples));
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
          <div className="flex rounded-lg border border-line-border bg-parchment-50 p-1 shadow-instrument" role="tablist" aria-label="Field Monitoring Modules">
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

        {/* View Switch */}
        {activeTab === 'soil' ? (
          <SoilInvestigationView
            samples={samples}
            onUpdateSamples={handleUpdateSamples}
          />
        ) : (
          <VegetationMonitoringView />
        )}
      </div>
    </main>
  );
};
