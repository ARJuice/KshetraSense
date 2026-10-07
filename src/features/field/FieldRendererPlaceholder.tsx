import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FieldRendererProps } from './FieldRenderer.interface';
import { SOIL_FEATURES } from '../../data/fixtures/scenarioFixtures';
import { SoilCell } from './types';
import { FieldReticle } from '../../components/ui/FieldReticle';
import { ClickSpark } from '../../components/ui/ClickSpark';
import { DecryptedText } from '../../components/ui/DecryptedText';

/**
 * FieldRendererPlaceholder
 * 
 * Deterministic presentation stage that implements the typed FieldRenderer contract.
 * Serves as the interactive functional seam for the future Three.js / React Three Fiber renderer.
 * 
 * Truthfulness disclosure: Clearly labels this as the temporary deterministic stage,
 * not a completed WebGL engine or physical soil simulation.
 */
export const FieldRendererPlaceholder: React.FC<FieldRendererProps> = ({
  viewModel,
  callbacks,
  className = '',
}) => {
  const {
    cells,
    rows,
    cols,
    activeFeature,
    mapMode,
    zoningSample,
    selectedZoneIndex,
    selectedFCMClusterIndex,
    interactionMode,
    selectedCellId,
    hoveredCellId,
    brushPreviewCellIds,
    affectedFeedbackCellIds,
    prefersReducedMotion,
  } = viewModel;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);

  const featConfig = SOIL_FEATURES[activeFeature];

  // Helper to compute color for cell in current map mode
  const getCellColor = useCallback(
    (cell: SoilCell, cellIndex: number) => {
      if (mapMode === 'zoning' && zoningSample) {
        const zoneIdx = zoningSample.assignments[cellIndex];
        const isDimmed = selectedZoneIndex !== null && selectedZoneIndex !== zoneIdx;
        const summary = zoningSample.summaries[zoneIdx];
        if (!summary) return '#23342B';

        return isDimmed ? 'rgba(35, 52, 43, 0.45)' : summary.color;
      }

      if (mapMode === 'membership' && zoningSample && zoningSample.membershipMatrix) {
        const targetCluster = selectedFCMClusterIndex ?? selectedZoneIndex ?? 0;
        const membershipVal = zoningSample.membershipMatrix[cellIndex]?.[targetCluster] ?? 0.5;
        // Verdigris gradient based on membership strength (0..1)
        const alpha = Math.max(0.15, membershipVal);
        return `rgba(54, 123, 110, ${alpha.toFixed(2)})`;
      }

      // 'soil' mode: sequential gradient based on normalized value
      const val = cell[activeFeature];
      const norm = Math.max(0, Math.min(1, (val - featConfig.min) / (featConfig.max - featConfig.min)));

      // Dark spruce to verdigris/clay tone
      const r = Math.round(25 + norm * 45);
      const g = Math.round(45 + norm * 85);
      const b = Math.round(38 + norm * 65);
      return `rgb(${r}, ${g}, ${b})`;
    },
    [mapMode, zoningSample, selectedZoneIndex, selectedFCMClusterIndex, activeFeature, featConfig]
  );

  // Keyboard navigation across cells
  const handleCellKeyDown = (e: React.KeyboardEvent, cell: SoilCell) => {
    let targetRow = cell.row;
    let targetCol = cell.col;

    if (e.key === 'ArrowUp') targetRow = Math.max(1, cell.row - 1);
    else if (e.key === 'ArrowDown') targetRow = Math.min(rows, cell.row + 1);
    else if (e.key === 'ArrowLeft') targetCol = Math.max(1, cell.col - 1);
    else if (e.key === 'ArrowRight') targetCol = Math.min(cols, cell.col + 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (interactionMode === 'brush') {
        callbacks.onBrushApply(cell.id);
        callbacks.onBrushCommit();
      } else {
        callbacks.onCellSelect(cell.id);
      }
      return;
    } else {
      return;
    }

    e.preventDefault();
    const targetCell = cells.find((c) => c.row === targetRow && c.col === targetCol);
    if (targetCell) {
      callbacks.onCellSelect(targetCell.id);
      const el = document.getElementById(`field-cell-${targetCell.id}`);
      el?.focus();
    }
  };

  const handlePointerDown = (cellId: string) => {
    setIsPointerDown(true);
    if (interactionMode === 'brush') {
      callbacks.onBrushApply(cellId);
    } else {
      callbacks.onCellSelect(cellId);
    }
  };

  const handlePointerEnter = (cellId: string) => {
    callbacks.onCellHover(cellId);
    if (isPointerDown && interactionMode === 'brush') {
      callbacks.onBrushApply(cellId);
    }
  };

  const handlePointerUp = () => {
    if (isPointerDown && interactionMode === 'brush') {
      callbacks.onBrushCommit();
    }
    setIsPointerDown(false);
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isPointerDown) {
        if (interactionMode === 'brush') {
          callbacks.onBrushCommit();
        }
        setIsPointerDown(false);
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isPointerDown, interactionMode, callbacks]);

  const activeHoverCell = cells.find((c) => c.id === hoveredCellId);

  return (
    <div
      ref={containerRef}
      onPointerUp={handlePointerUp}
      className={`relative flex flex-col items-center justify-center p-6 select-none overflow-hidden rounded-xl bg-evergreen-950 border border-evergreen-850 shadow-stage ${
        interactionMode === 'brush' ? 'cursor-field-brush' : 'cursor-field-reticle'
      } ${className}`}
      onPointerLeave={() => callbacks.onCellHover(null)}
      aria-label="Interactive Soil Field Grid"
    >
      {/* Top Architecture Seam Notice */}
      <div className="absolute top-3 left-4 flex items-center gap-2 z-10">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tracking-wider bg-evergreen-900/90 text-sage-300 border border-sage-700/40 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-verdigris animate-pulse" />
          FIELD STAGE SEAM · 18×12 GRID (216 CELLS)
        </span>
      </div>

      {/* Top Right Coordinate / Hover HUD with DecryptedText */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
        {activeHoverCell && (
          <div className="px-3 py-1 rounded text-xs font-mono bg-evergreen-900/95 text-sage-200 border border-sage-700/50 shadow-sm flex items-center gap-2">
            <span className="text-sage-400 font-semibold">
              <DecryptedText
                text={`R${activeHoverCell.row} : C${activeHoverCell.col}`}
                speed={30}
                maxIterations={5}
                animateOn="change"
              />
            </span>
            <span className="text-evergreen-700">|</span>
            <span>
              {activeHoverCell[activeFeature]} {featConfig.unit}
            </span>
            {mapMode === 'zoning' && zoningSample && (
              <>
                <span className="text-evergreen-700">|</span>
                <span className="text-amberGold">
                  Zone {zoningSample.assignments[cells.indexOf(activeHoverCell)] + 1}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Field Reticle Guidelines */}
      <FieldReticle
        containerRef={containerRef}
        hoveredCellRow={activeHoverCell?.row ?? null}
        hoveredCellCol={activeHoverCell?.col ?? null}
        totalRows={rows}
        totalCols={cols}
        activeFeatureLabel={featConfig.label}
        activeFeatureValue={activeHoverCell ? activeHoverCell[activeFeature] : undefined}
        activeFeatureUnit={featConfig.unit}
      />

      {/* Grid Canvas Wrapper with ClickSpark */}
      <ClickSpark sparkColor={interactionMode === 'brush' ? '#B95E3C' : '#386B5A'} sparkRadius={20}>
        <div
          className="relative p-4 rounded-lg bg-evergreen-900/60 border border-sage-800/60 shadow-inner max-w-full overflow-auto"
          style={{
            transform: prefersReducedMotion ? 'none' : 'perspective(1000px) rotateX(16deg)',
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease',
          }}
        >
          {/* 18 x 12 Grid Container */}
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(18px, 28px))`,
              gridTemplateRows: `repeat(${rows}, minmax(18px, 28px))`,
            }}
            role="grid"
            aria-rowcount={rows}
            aria-colcount={cols}
          >
          {cells.map((cell, idx) => {
            const isSelected = selectedCellId === cell.id;
            const isHovered = hoveredCellId === cell.id;
            const isBrushPreview = brushPreviewCellIds.includes(cell.id);
            const isRecentlyAffected = affectedFeedbackCellIds.includes(cell.id);

            const zoneIdx =
              mapMode === 'zoning' && zoningSample
                ? zoningSample.assignments[idx]
                : null;
            const zoneSummary = zoneIdx !== null && zoningSample ? zoningSample.summaries[zoneIdx] : null;

            const cellColor = getCellColor(cell, idx);

            return (
              <button
                key={cell.id}
                id={`field-cell-${cell.id}`}
                type="button"
                tabIndex={isSelected ? 0 : -1}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`Row ${cell.row}, Column ${cell.col}: ${cell[activeFeature]} ${featConfig.unit}`}
                onPointerDown={() => handlePointerDown(cell.id)}
                onPointerEnter={() => handlePointerEnter(cell.id)}
                onKeyDown={(e) => handleCellKeyDown(e, cell)}
                className={`relative aspect-square rounded-sm transition-all focus:outline-none ${
                  zoneSummary ? zoneSummary.patternClass : ''
                } ${
                  isHovered ? 'z-20 -translate-y-1 shadow-md ring-1 ring-sage-300' : ''
                } ${
                  isSelected ? 'z-30 ring-2 ring-parchment-100 shadow-lg scale-105' : ''
                } ${
                  isBrushPreview ? 'ring-2 ring-clay-light animate-pulse' : ''
                } ${
                  isRecentlyAffected && !prefersReducedMotion ? 'ring-1 ring-clay' : ''
                }`}
                style={{
                  backgroundColor: cellColor,
                }}
              >
                {/* Locked corner brackets for selected cell */}
                {isSelected && (
                  <div className="absolute -inset-1 pointer-events-none">
                    <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t-2 border-l-2 border-parchment-50" />
                    <span className="absolute top-0 right-0 w-1.5 h-1.5 border-t-2 border-r-2 border-parchment-50" />
                    <span className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b-2 border-l-2 border-parchment-50" />
                    <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b-2 border-r-2 border-parchment-50" />
                  </div>
                )}

                {/* Zone Number Badge on Key Cells */}
                {mapMode === 'zoning' &&
                  zoneIdx !== null &&
                  cell.row % 4 === 2 &&
                  cell.col % 5 === 2 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90 drop-shadow select-none">
                      Z{zoneIdx + 1}
                    </span>
                  )}
              </button>
            );
          })}
        </div>

        {/* Axis Labels (Subtle cartographic markers) */}
        <div className="flex justify-between items-center text-[10px] font-mono text-sage-400 mt-2 px-1">
          <span>Col 1</span>
          <span className="text-sage-500 text-[10px]">SOIL FEATURE: {featConfig.label.toUpperCase()}</span>
          <span>Col 18</span>
        </div>
      </div>
      </ClickSpark>

      {/* Bottom Stage Status Footer */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[11px] text-sage-400 font-mono z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-clay inline-block" />
            <span>Brush: {interactionMode === 'brush' ? `${viewModel.brushConfig.direction.toUpperCase()} (${viewModel.brushConfig.footprint}×${viewModel.brushConfig.footprint})` : 'Inactive'}</span>
          </span>
          <span className="text-evergreen-700">•</span>
          <span>Mode: {mapMode.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-evergreen-900 border border-sage-800 text-sage-300">
            F
          </kbd>
          <span className="text-sage-500">Fit camera</span>
          <span className="text-evergreen-700">•</span>
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-evergreen-900 border border-sage-800 text-sage-300">
            Arrow keys
          </kbd>
          <span className="text-sage-500">Navigate</span>
        </div>
      </div>
    </div>
  );
};
