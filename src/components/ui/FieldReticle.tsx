import React from 'react';

export interface FieldReticleProps {
  containerRef: React.RefObject<HTMLDivElement>;
  hoveredCellRow: number | null;
  hoveredCellCol: number | null;
  totalRows: number;
  totalCols: number;
  activeFeatureLabel: string;
  activeFeatureValue?: number;
  activeFeatureUnit?: string;
}

/**
 * FieldReticle component adapted from the Crosshair concept in React Bits.
 * Renders precision cartographic guidelines and surveyor coordinate markings
 * across the active field grid.
 */
export const FieldReticle: React.FC<FieldReticleProps> = ({
  hoveredCellRow,
  hoveredCellCol,
  activeFeatureLabel,
  activeFeatureValue,
  activeFeatureUnit,
}) => {
  if (hoveredCellRow === null || hoveredCellCol === null) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {/* Precision Corner Survey Brackets (Top-Left & Bottom-Right) */}
      <div className="absolute top-2 left-2 text-[9px] font-mono text-sage-500/70 select-none flex items-center gap-1">
        <span className="w-2 h-2 border-t border-l border-sage-500" />
        <span>SURVEY RETICLE · R{hoveredCellRow} C{hoveredCellCol}</span>
      </div>

      <div className="absolute bottom-2 right-2 text-[9px] font-mono text-sage-500/70 select-none flex items-center gap-1">
        <span>{activeFeatureLabel}: {activeFeatureValue !== undefined ? `${activeFeatureValue} ${activeFeatureUnit}` : '—'}</span>
        <span className="w-2 h-2 border-b border-r border-sage-500" />
      </div>
    </div>
  );
};
