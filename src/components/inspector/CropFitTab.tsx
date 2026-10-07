import React, { useState } from 'react';
import { ZoneSummary } from '../../features/field/types';
import {
  CROP_PROFILES,
  evaluateCropFactors,
  CropFactorRow,
} from '../../data/fixtures/cropFitFixtures';
import { SpotlightCard } from '../ui/SpotlightCard';

interface CropFitTabProps {
  selectedZoneSummary: ZoneSummary | null;
}

export const CropFitTab: React.FC<CropFitTabProps> = ({ selectedZoneSummary }) => {
  const [activeCropId, setActiveCropId] = useState<'apple' | 'tomato' | 'potato'>('apple');

  const crops: Array<'apple' | 'tomato' | 'potato'> = ['apple', 'tomato', 'potato'];
  const currentFactors: CropFactorRow[] = evaluateCropFactors(activeCropId, selectedZoneSummary);
  const currentProfile = CROP_PROFILES[activeCropId];

  return (
    <div className="space-y-4">
      {/* Zone Context Indicator */}
      <div className="p-2.5 rounded-lg bg-parchment-200/80 border border-line-border text-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase text-ink-subtle block">Evaluation Scope</span>
          <span className="font-semibold text-ink">
            {selectedZoneSummary ? `${selectedZoneSummary.label} (Mean values)` : 'Baseline Whole Field (R12 C8 Reference)'}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amberGold-subtle text-amberGold border border-amberGold/30 font-medium">
          MOCK / NOT ASSESSED
        </span>
      </div>

      {/* Equal-Weight Non-Ranked Crop Selector */}
      <div>
        <div className="text-[11px] font-medium text-ink-subtle mb-1.5 flex items-center justify-between">
          <span>Three Independent Crop Profiles</span>
          <span className="text-[10px] text-ink-subtle italic">No ranking or 100% probability split</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-parchment-200/80 rounded-lg border border-line-subtle">
          {crops.map((cropKey) => {
            const profile = CROP_PROFILES[cropKey];
            const isSelected = activeCropId === cropKey;
            return (
              <button
                key={cropKey}
                onClick={() => setActiveCropId(cropKey)}
                className={`py-2 px-1 text-center rounded text-xs transition-all ${
                  isSelected
                    ? 'bg-parchment-50 text-ink shadow-sm font-semibold ring-1 ring-sage-600'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <div className="font-editorial text-sm">{profile.commonName}</div>
                <div className="text-[10px] text-ink-subtle italic truncate font-sans">{profile.scientificName}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Crop Factor Analysis Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-editorial text-sm font-bold text-ink">{currentProfile.commonName} Compatibility</h4>
            <span className="text-[10px] text-ink-subtle font-mono">{currentProfile.profileVersion}</span>
          </div>
          <span className="text-[11px] text-ink-subtle italic">Sourced rule thresholds</span>
        </div>

        <SpotlightCard
          spotlightColor="rgba(56, 107, 90, 0.08)"
          className="rounded-lg border border-line-border overflow-hidden bg-parchment-100 shadow-sm"
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-parchment-200/80 text-[10px] font-mono uppercase text-ink-subtle border-b border-line-border">
                <th className="py-1.5 px-3 text-left">Factor</th>
                <th className="py-1.5 px-2 text-right">Observed</th>
                <th className="py-1.5 px-2 text-right">Optimal Range</th>
                <th className="py-1.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {currentFactors.map((row) => (
                <tr key={row.factorKey} className="hover:bg-parchment-200/40">
                  <td className="py-2 px-3">
                    <span className="font-medium text-ink block">{row.name}</span>
                    <span className="text-[10px] text-ink-subtle block truncate max-w-[120px]" title={row.source}>
                      {row.source}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-medium text-ink tabular-nums">
                    {row.observed}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-ink-muted tabular-nums">
                    {row.range}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        row.status === 'suitable'
                          ? 'bg-sage-100 text-sage-800 border border-sage-300'
                          : row.status === 'marginal'
                          ? 'bg-amberGold-subtle text-amberGold border border-amberGold/30'
                          : row.status === 'unsuitable'
                          ? 'bg-clay-subtle text-clay-dark border border-clay/30'
                          : 'bg-parchment-200 text-ink-subtle'
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SpotlightCard>

        {/* Agronomic Disclaimer */}
        <div className="p-2.5 rounded-lg bg-parchment-200/60 border border-line-subtle text-[11px] text-ink-subtle leading-relaxed">
          <p className="font-semibold text-ink-muted mb-0.5">Independent Assessment Policy</p>
          Each crop is evaluated independently against published criteria. Multiple crops or no crops may be suitable. This is not a 100% probability split and does not constitute agronomic yield prediction or planting advice.
        </div>
      </div>
    </div>
  );
};
