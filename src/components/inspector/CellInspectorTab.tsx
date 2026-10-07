import React from 'react';
import { SoilCell } from '../../features/field/types';
import { SOIL_FEATURES } from '../../data/fixtures/scenarioFixtures';
import { SpotlightCard } from '../ui/SpotlightCard';
import { CountUp } from '../ui/CountUp';

interface CellInspectorTabProps {
  cell: SoilCell | null;
}

export const CellInspectorTab: React.FC<CellInspectorTabProps> = ({ cell }) => {
  if (!cell) {
    return (
      <div className="py-8 text-center text-xs text-ink-subtle">
        <p className="font-editorial text-sm text-ink-muted mb-1">No cell currently selected</p>
        <p>Click any cell on the field grid or use arrow keys to inspect its readings.</p>
      </div>
    );
  }

  const features = [
    { key: 'pH', label: 'Soil pH', numVal: cell.pH, decimals: 1, unit: '', source: 'synthetic' },
    { key: 'nitrogen', label: 'Nitrogen (N)', numVal: cell.nitrogen, decimals: 0, unit: 'mg/kg', source: 'synthetic' },
    { key: 'phosphorus', label: 'Phosphorus (P)', numVal: cell.phosphorus, decimals: 0, unit: 'mg/kg', source: 'synthetic' },
    { key: 'potassium', label: 'Potassium (K)', numVal: cell.potassium, decimals: 0, unit: 'mg/kg', source: 'synthetic' },
    { key: 'ec', label: 'Electrical Conductivity (EC)', numVal: cell.ec, decimals: 2, unit: 'dS/m', source: 'synthetic' },
    { key: 'soilTemp', label: 'Soil Temperature', numVal: cell.soilTemp, decimals: 1, unit: '°C', source: 'synthetic' },
    { key: 'moisture', label: 'Soil Moisture', numVal: null, decimals: 0, unit: '', source: 'unmeasured' },
  ];

  return (
    <div className="space-y-4">
      {/* Header with coordinates */}
      <div className="flex items-center justify-between pb-2 border-b border-line-border">
        <div>
          <span className="text-[11px] font-mono text-ink-subtle uppercase">Target Coordinate</span>
          <div className="text-base font-editorial font-bold text-ink flex items-center gap-2">
            <span>Row {cell.row}, Column {cell.col}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-parchment-200 text-ink-muted">
              #{cell.id}
            </span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sage-100 text-sage-800 border border-sage-300">
          SYNTHETIC CELL
        </span>
      </div>

      {/* Feature Table with SpotlightCard illumination */}
      <SpotlightCard
        spotlightColor="rgba(56, 107, 90, 0.08)"
        className="rounded-lg border border-line-border overflow-hidden bg-parchment-100 shadow-sm"
      >
        <table className="w-full text-xs" aria-label="Soil cell feature measurements">
          <thead>
            <tr className="bg-parchment-200/80 text-[10px] font-mono uppercase text-ink-subtle border-b border-line-border">
              <th className="py-1.5 px-3 text-left">Measurement</th>
              <th className="py-1.5 px-3 text-right">Value &amp; Unit</th>
              <th className="py-1.5 px-3 text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {features.map((f) => (
              <tr key={f.key} className="hover:bg-parchment-200/50 transition-colors">
                <td className="py-2 px-3 font-medium text-ink">
                  {f.label}
                  {SOIL_FEATURES[f.key as keyof typeof SOIL_FEATURES] && (
                    <span className="block text-[10px] text-ink-subtle font-normal">
                      Range {SOIL_FEATURES[f.key as keyof typeof SOIL_FEATURES].min}–
                      {SOIL_FEATURES[f.key as keyof typeof SOIL_FEATURES].max}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-ink tabular-nums">
                  {f.numVal !== null ? (
                    <CountUp to={f.numVal} decimals={f.decimals} duration={350} />
                  ) : (
                    'Not assessed'
                  )}{' '}
                  <span className="text-ink-subtle text-[11px] font-normal">{f.unit}</span>
                </td>
                <td className="py-2 px-3 text-right">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      f.source === 'synthetic'
                        ? 'bg-parchment-200 text-ink-muted'
                        : 'bg-amberGold-subtle text-amberGold'
                    }`}
                  >
                    {f.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SpotlightCard>

      <div className="p-2.5 rounded-lg bg-parchment-200/60 border border-line-subtle text-[11px] text-ink-subtle leading-relaxed">
        <p className="font-semibold text-ink-muted mb-0.5">Truthfulness Disclosure</p>
        These values are deterministic synthetic fixture numbers generated for educational demonstration. They do not represent live IoT sensor telemetry, physical soil analysis, or agricultural recommendations.
      </div>
    </div>
  );
};
