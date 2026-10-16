import React, { useMemo } from 'react';
import type { SoilMeasurement } from './types';

interface SampleCoverageMapProps {
  samples: SoilMeasurement[];
  selectedSampleId: string | null;
  onSelectSample: (sample: SoilMeasurement) => void;
}

export const SampleCoverageMap: React.FC<SampleCoverageMapProps> = ({
  samples,
  selectedSampleId,
  onSelectSample,
}) => {
  const bounds = useMemo(() => {
    if (samples.length === 0) return null;
    const lats = samples.map((s) => s.latitude);
    const lons = samples.map((s) => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const rawLatSpan = maxLat - minLat;
    const rawLonSpan = maxLon - minLon;
    const hasSpread = rawLatSpan > 0.00001 || rawLonSpan > 0.00001;
    const latSpan = rawLatSpan || 0.001;
    const lonSpan = rawLonSpan || 0.001;
    return { minLat, maxLat, minLon, maxLon, latSpan, lonSpan, hasSpread };
  }, [samples]);

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2.5 shadow-inner">
      {/* Precision grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Coordinate axes watermark */}
      <div className="pointer-events-none absolute left-3 top-2.5 z-0 flex items-center gap-1.5 font-mono text-[10px] font-medium text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span>{bounds ? `${bounds.maxLat.toFixed(4)}°N` : 'GIS Coordinate Plane'}</span>
      </div>
      <div className="pointer-events-none absolute bottom-2.5 right-3 z-0 font-mono text-[10px] font-medium text-slate-400">
        {bounds ? `${bounds.maxLon.toFixed(4)}°E · WGS84` : '100m Grid'}
      </div>

      {samples.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-slate-300">No coordinate records</p>
          <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-slate-400">
            Add or import soil measurements to view relative coordinate coverage pins.
          </p>
        </div>
      ) : (
        <div className="relative h-full w-full">
          {samples.map((sample) => {
            let leftPct = 50;
            let topPct = 50;

            if (bounds && samples.length > 1 && bounds.hasSpread) {
              leftPct = 12 + ((sample.longitude - bounds.minLon) / bounds.lonSpan) * 76;
              topPct = 88 - ((sample.latitude - bounds.minLat) / bounds.latSpan) * 76;
            }

            const isSelected = sample.sampleId === selectedSampleId;

            return (
              <button
                key={sample.sampleId}
                type="button"
                onClick={() => onSelectSample(sample)}
                title={`${sample.sampleId} (${sample.latitude.toFixed(4)}, ${sample.longitude.toFixed(4)})\n${sample.provenance === 'seed-preset' ? 'Legacy synthetic preset — not a field measurement' : `Date: ${sample.collectedAt}\npH: ${sample.ph} · Depth: ${sample.depthInterval || `${sample.depthCm}cm` || 'Unrecorded'}`}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all focus:outline-none ${
                  isSelected
                    ? 'z-20 h-8 w-8 scale-110 ring-4 ring-emerald-400/60 shadow-lg'
                    : 'z-10 h-7 w-7 hover:scale-110 hover:ring-2 hover:ring-emerald-300/40'
                } flex items-center justify-center border-2 border-slate-900 font-mono text-[10px] font-bold shadow-md ${
                  sample.provenance === 'csv-import'
                    ? 'bg-blue-600 text-white'
                    : sample.provenance === 'seed-preset'
                    ? 'bg-amber-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                {sample.sampleId.slice(-2).toUpperCase()}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

