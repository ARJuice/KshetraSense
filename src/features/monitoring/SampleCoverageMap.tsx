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
    <div className="relative h-60 w-full overflow-hidden rounded-lg border border-line-border bg-[linear-gradient(rgba(88,134,115,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(88,134,115,0.08)_1px,transparent_1px)] bg-[size:20px_20px] bg-parchment-50 p-2">
      {/* Coordinate axes watermark */}
      <div className="pointer-events-none absolute left-2 top-2 z-0 font-mono text-[9px] text-ink-subtle">
        {bounds ? `${bounds.maxLat.toFixed(4)}°N` : 'Grid Plane'}
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 z-0 font-mono text-[9px] text-ink-subtle">
        {bounds ? `${bounds.maxLon.toFixed(4)}°E` : '100m grid'}
      </div>

      {samples.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-ink-muted">No coordinate records</p>
          <p className="mt-1 max-w-xs text-[11px] leading-4 text-ink-subtle">
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
                    ? 'z-20 h-8 w-8 ring-4 ring-sage-400/50'
                    : 'z-10 h-7 w-7 hover:scale-110 hover:ring-2 hover:ring-sage-300'
                } flex items-center justify-center border-2 border-parchment-50 font-mono text-[10px] font-bold shadow-md ${
                  sample.provenance === 'csv-import'
                    ? 'bg-slate-700 text-parchment-50'
                    : sample.provenance === 'seed-preset'
                    ? 'bg-amberGold-dark text-parchment-50'
                    : 'bg-sage-700 text-parchment-50'
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
