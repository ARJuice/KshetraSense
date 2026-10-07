import React from 'react';
import { MapMode, SoilFeatureKey, ZoningSampleView } from './types';
import { SOIL_FEATURES } from '../../data/fixtures/scenarioFixtures';

interface FieldLegendProps {
  mapMode: MapMode;
  activeFeature: SoilFeatureKey;
  zoningSample: ZoningSampleView | null;
  selectedZoneIndex: number | null;
  onSelectZone: (zoneIndex: number | null) => void;
}

export const FieldLegend: React.FC<FieldLegendProps> = ({
  mapMode,
  activeFeature,
  zoningSample,
  selectedZoneIndex,
  onSelectZone,
}) => {
  const featConfig = SOIL_FEATURES[activeFeature];

  if (mapMode === 'soil') {
    return (
      <div className="bg-parchment-50 border border-line-border rounded-lg p-3 text-xs shadow-instrument">
        <div className="flex items-center justify-between mb-1.5 font-medium text-ink">
          <span className="font-editorial text-sm font-semibold">{featConfig.label}</span>
          <span className="text-[11px] font-mono text-ink-muted">Unit: {featConfig.unit || 'unitless'}</span>
        </div>

        {/* Continuous Color Gradient Bar */}
        <div className="h-2.5 rounded-sm bg-gradient-to-r from-[#192D26] via-[#2A5749] to-[#458C73] border border-line-subtle shadow-inner mb-1.5" />

        <div className="flex justify-between items-center text-[11px] font-mono text-ink-muted">
          <span>{featConfig.min} {featConfig.unit}</span>
          <span className="text-ink-subtle">sequential value scale</span>
          <span>{featConfig.max} {featConfig.unit}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-line-subtle flex items-center justify-between text-[11px] text-ink-subtle">
          <span>Encoding: visual cell relief &amp; tone</span>
          <span className="font-semibold text-verdigris">Synthetic fixture data</span>
        </div>
      </div>
    );
  }

  if (mapMode === 'zoning' && zoningSample) {
    return (
      <div className="bg-parchment-50 border border-line-border rounded-lg p-3 text-xs shadow-instrument">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="font-editorial text-sm font-semibold">
              {zoningSample.method === 'kmeans' ? 'K-means' : 'Fuzzy C-means'} (k = {zoningSample.k})
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amberGold-subtle border border-amberGold/30 text-amberGold font-medium">
              CROP-NEUTRAL
            </span>
          </div>
          {selectedZoneIndex !== null && (
            <button
              onClick={() => onSelectZone(null)}
              className="text-[11px] text-sage-600 hover:underline"
            >
              Show all zones
            </button>
          )}
        </div>

        {/* Zone Swatches with non-color pattern identifiers */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {zoningSample.summaries.map((summary) => {
            const isSelected = selectedZoneIndex === summary.zoneIndex;
            return (
              <button
                key={summary.zoneIndex}
                onClick={() => onSelectZone(isSelected ? null : summary.zoneIndex)}
                className={`flex items-center justify-between p-2 rounded border text-left transition-all ${
                  isSelected
                    ? 'border-sage-600 bg-sage-100 ring-1 ring-sage-600 shadow-sm'
                    : 'border-line-border bg-parchment-100 hover:bg-parchment-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded border border-black/20 ${summary.patternClass}`}
                    style={{ backgroundColor: summary.color }}
                  />
                  <div>
                    <div className="font-semibold text-ink text-xs">{summary.label}</div>
                    <div className="text-[10px] text-ink-subtle font-mono">
                      {summary.cellCount} cells ({summary.cellSharePct}%)
                    </div>
                  </div>
                </div>
                {isSelected && <span className="text-xs text-sage-700">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-ink-subtle italic border-t border-line-subtle pt-1.5 flex justify-between">
          <span>Patterns + colors support non-color discrimination</span>
          <span>Click zone to isolate &amp; inspect</span>
        </div>
      </div>
    );
  }

  if (mapMode === 'membership' && zoningSample) {
    return (
      <div className="bg-parchment-50 border border-line-border rounded-lg p-3 text-xs shadow-instrument">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-editorial text-sm font-semibold">FCM Cluster Membership</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amberGold-subtle border border-amberGold/30 text-amberGold font-medium">
            MEMBERSHIP STRENGTH · NOT CONFIDENCE
          </span>
        </div>

        <div className="h-2 rounded bg-gradient-to-r from-evergreen-900 via-verdigris to-parchment-50 mb-1" />
        <div className="flex justify-between text-[11px] font-mono text-ink-muted">
          <span>0.0 (weak)</span>
          <span>Fuzzy membership matrix μ(c)</span>
          <span>1.0 (strong)</span>
        </div>
      </div>
    );
  }

  return null;
};
