import React from 'react';
import { ZoningSampleView, ZoneSummary, SoilFeatureKey } from '../../features/field/types';
import { SOIL_FEATURES } from '../../data/fixtures/scenarioFixtures';
import { SpotlightCard } from '../ui/SpotlightCard';
import { CountUp } from '../ui/CountUp';

interface ZoneInspectorTabProps {
  zoningSample: ZoningSampleView | null;
  selectedZoneIndex: number | null;
  onSelectZone: (zoneIndex: number | null) => void;
  onGoToCropFit: () => void;
}

export const ZoneInspectorTab: React.FC<ZoneInspectorTabProps> = ({
  zoningSample,
  selectedZoneIndex,
  onSelectZone,
  onGoToCropFit,
}) => {
  if (!zoningSample) {
    return (
      <div className="py-8 text-center text-xs text-ink-subtle">
        <p className="font-editorial text-sm text-ink-muted mb-1">No zoning sample loaded</p>
        <p>Choose K-means or FCM in Field Controls and click "Show Prepared Sample".</p>
      </div>
    );
  }

  const selectedSummary: ZoneSummary | undefined =
    selectedZoneIndex !== null
      ? zoningSample.summaries[selectedZoneIndex]
      : zoningSample.summaries[0];

  const featureKeys: SoilFeatureKey[] = ['nitrogen', 'phosphorus', 'potassium', 'pH', 'ec', 'soilTemp'];

  return (
    <div className="space-y-4">
      {/* Zone Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-parchment-200/80 rounded-lg border border-line-subtle">
        {zoningSample.summaries.map((summary) => {
          const isSelected = selectedZoneIndex === summary.zoneIndex;
          return (
            <button
              key={summary.zoneIndex}
              onClick={() => onSelectZone(summary.zoneIndex)}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-parchment-50 text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-sm border border-black/20 ${summary.patternClass}`}
                style={{ backgroundColor: summary.color }}
              />
              <span>{summary.label}</span>
            </button>
          );
        })}
      </div>

      {selectedSummary && (
        <div className="space-y-3">
          {/* Zone Headline Summary Card with SpotlightCard */}
          <SpotlightCard
            spotlightColor="rgba(56, 107, 90, 0.08)"
            className="p-3 rounded-xl bg-parchment-100 border border-line-border flex items-center justify-between shadow-sm"
          >
            <div>
              <div className="text-base font-editorial font-bold text-ink">
                {selectedSummary.label} Profile
              </div>
              <div className="text-xs text-ink-muted">
                <CountUp to={selectedSummary.cellCount} duration={300} /> cells (
                <CountUp to={selectedSummary.cellSharePct} decimals={1} duration={300} suffix="%" /> of field)
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-ink-subtle uppercase block">Method</span>
              <span className="text-xs font-semibold font-mono text-verdigris">
                {zoningSample.method === 'kmeans' ? 'K-means' : 'Fuzzy C-means'} (k={zoningSample.k})
              </span>
            </div>
          </SpotlightCard>

          {/* FCM Membership strength disclosure if available */}
          {selectedSummary.fcmAvgMembership !== undefined && (
            <div className="p-2.5 rounded-lg bg-sage-50 border border-sage-300 text-xs text-sage-900 flex items-center justify-between">
              <div>
                <span className="font-semibold block">Mean Membership Strength:</span>
                <span className="text-[11px] text-sage-700">Fuzzy membership matrix μ(x)</span>
              </div>
              <span className="text-base font-bold font-mono text-sage-800">
                <CountUp to={selectedSummary.fcmAvgMembership * 100} duration={300} suffix="%" />
              </span>
            </div>
          )}

          {/* Statistical Breakdown Table (Mean, Min-Max, Std Dev) */}
          <div className="rounded-lg border border-line-border overflow-hidden bg-parchment-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-parchment-200/80 text-[10px] font-mono uppercase text-ink-subtle border-b border-line-border">
                  <th className="py-1.5 px-3 text-left">Feature</th>
                  <th className="py-1.5 px-2 text-right">Mean</th>
                  <th className="py-1.5 px-2 text-right">Min – Max</th>
                  <th className="py-1.5 px-3 text-right">Std Dev (±)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {featureKeys.map((key) => {
                  const feat = SOIL_FEATURES[key];
                  const mean = selectedSummary.meanFeatures[key];
                  const [min, max] = selectedSummary.minMaxFeatures[key];
                  const std = selectedSummary.stdDevFeatures[key];

                  return (
                    <tr key={key} className="hover:bg-parchment-200/40">
                      <td className="py-2 px-3 font-medium text-ink">
                        {feat.shortLabel} <span className="text-ink-subtle text-[10px]">({feat.unit || 'unitless'})</span>
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-ink tabular-nums">
                        <CountUp to={mean} decimals={key === 'ec' ? 2 : key === 'pH' ? 1 : 0} duration={300} />
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-ink-muted tabular-nums">
                        {min}–{max}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-ink-subtle tabular-nums">
                        ±{std}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Shortcut to Crop Fit */}
          <button
            type="button"
            onClick={onGoToCropFit}
            className="w-full py-2 px-3 rounded-lg bg-parchment-200 hover:bg-parchment-300 text-ink text-xs font-semibold flex items-center justify-center gap-1.5 border border-line-border transition-colors"
          >
            <span>Compare Crop Compatibility for {selectedSummary.label}</span>
            <span>➔</span>
          </button>
        </div>
      )}
    </div>
  );
};
