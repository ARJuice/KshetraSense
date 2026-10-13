import React, { useState, useEffect, useCallback, useMemo } from 'react';

export interface ZoningFieldCell {
  id: string;
  row: number;
  col: number;
  value: number;
  zoneId?: string | null;
  membership?: number | null;
}

export interface ZoningFieldZone {
  id: string;
  label: string;
  color: string;
}

export interface ZoningFieldCanvasProps {
  cells: readonly ZoningFieldCell[];
  zones?: readonly ZoningFieldZone[];
  featureLabel: string;
  featureUnit?: string;
  featureRange: readonly [number, number];
  selectedCellId?: string | null;
  selectedZoneId?: string | null;
  disabled?: boolean;
  interactionMode?: 'inspect' | 'brush';
  brushRadius?: number;
  onCellSelect?: (cell: ZoningFieldCell) => void;
  onBrushCell?: (cell: ZoningFieldCell) => void;
  onBrushEnd?: () => void;
  onCellHover?: (cell: ZoningFieldCell | null) => void;
  onZoneSelect?: (zoneId: string | null) => void;
  className?: string;
}

const ZONE_PATTERNS = ['pattern-zone-1', 'pattern-zone-2', 'pattern-zone-3', 'pattern-zone-4'];

function mineralColor(value: number, range: readonly [number, number]): string {
  const [min, max] = range;
  const norm = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  const r = Math.round(25 + norm * 45);
  const g = Math.round(45 + norm * 85);
  const b = Math.round(38 + norm * 65);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * ZoningFieldCanvas
 * 
 * Restored 2.5D Isometric Soil Atlas Map from commit 0efec7b.
 * Renders an accessible 18×12 grid with CSS 3D perspective projection,
 * WCAG AA non-color zone patterns, surveyor locked corner brackets,
 * and fluid drag-brushing.
 */
export const ZoningFieldCanvas: React.FC<ZoningFieldCanvasProps> = ({
  cells,
  zones = [],
  featureLabel,
  featureUnit,
  featureRange,
  selectedCellId = null,
  selectedZoneId = null,
  disabled = false,
  interactionMode = 'inspect',
  brushRadius = 1,
  onCellSelect,
  onBrushCell,
  onBrushEnd,
  onCellHover,
  onZoneSelect,
  className = '',
}) => {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);

  const rows = useMemo(() => Math.max(...cells.map((c) => c.row), 1), [cells]);
  const cols = useMemo(() => Math.max(...cells.map((c) => c.col), 1), [cells]);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const hoveredCell = useMemo(
    () => cells.find((c) => c.id === hoveredCellId) ?? null,
    [cells, hoveredCellId]
  );

  // Brush preview footprint
  const brushPreviewCellIds = useMemo(() => {
    if (!hoveredCell || interactionMode !== 'brush') return new Set<string>();
    const affected = new Set<string>();
    cells.forEach((cell) => {
      const dist = Math.hypot(cell.row - hoveredCell.row, cell.col - hoveredCell.col);
      if (dist <= brushRadius) {
        affected.add(cell.id);
      }
    });
    return affected;
  }, [cells, hoveredCell, interactionMode, brushRadius]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Global pointer up listener for seamless drag painting
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isPointerDown) {
        setIsPointerDown(false);
        if (interactionMode === 'brush') {
          onBrushEnd?.();
        }
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isPointerDown, interactionMode, onBrushEnd]);

  const getCellColor = useCallback(
    (cell: ZoningFieldCell) => {
      if (cell.zoneId) {
        const zone = zoneById.get(cell.zoneId);
        if (!zone) return '#23342B';

        const isDimmed = selectedZoneId !== null && selectedZoneId !== cell.zoneId;
        if (isDimmed) return 'rgba(35, 52, 43, 0.45)';

        if (cell.membership != null) {
          const alpha = Math.max(0.35, Math.min(1, cell.membership));
          return `rgba(54, 123, 110, ${alpha.toFixed(2)})`;
        }

        return zone.color;
      }

      return mineralColor(cell.value, featureRange);
    },
    [zoneById, selectedZoneId, featureRange]
  );

  const handlePointerDown = (cell: ZoningFieldCell) => {
    if (disabled) return;
    setIsPointerDown(true);
    if (interactionMode === 'brush') {
      onBrushCell?.(cell);
    } else {
      onCellSelect?.(cell);
      if (cell.zoneId) onZoneSelect?.(cell.zoneId);
    }
  };

  const handlePointerEnter = (cell: ZoningFieldCell) => {
    setHoveredCellId(cell.id);
    onCellHover?.(cell);

    if (isPointerDown && interactionMode === 'brush') {
      onBrushCell?.(cell);
    }
  };

  // Keyboard navigation across cells
  const handleCellKeyDown = (e: React.KeyboardEvent, cell: ZoningFieldCell) => {
    let targetRow = cell.row;
    let targetCol = cell.col;

    if (e.key === 'ArrowUp') targetRow = Math.max(1, cell.row - 1);
    else if (e.key === 'ArrowDown') targetRow = Math.min(rows, cell.row + 1);
    else if (e.key === 'ArrowLeft') targetCol = Math.max(1, cell.col - 1);
    else if (e.key === 'ArrowRight') targetCol = Math.min(cols, cell.col + 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (interactionMode === 'brush') {
        onBrushCell?.(cell);
        onBrushEnd?.();
      } else {
        onCellSelect?.(cell);
        if (cell.zoneId) onZoneSelect?.(cell.zoneId);
      }
      return;
    } else if (e.key === 'Escape') {
      onZoneSelect?.(null);
      return;
    } else {
      return;
    }

    e.preventDefault();
    const targetCell = cells.find((c) => c.row === targetRow && c.col === targetCol);
    if (targetCell) {
      onCellSelect?.(targetCell);
      document.getElementById(`field-cell-${targetCell.id}`)?.focus();
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-6 select-none overflow-hidden rounded-xl bg-evergreen-950 border border-evergreen-850 shadow-stage field-stage-pattern w-full h-full min-h-[540px] ${
        interactionMode === 'brush' ? 'cursor-field-brush' : 'cursor-field-reticle'
      } ${className}`}
      onPointerLeave={() => {
        setHoveredCellId(null);
        onCellHover?.(null);
      }}
      aria-label="Interactive 2.5D Soil Field Grid"
    >
      {/* Perspective Grid Canvas Wrapper from 0efec7b */}
      <div
        className="relative p-5 rounded-lg bg-evergreen-900/70 border border-sage-800/60 shadow-inner max-w-full overflow-auto"
        style={{
          transform: prefersReducedMotion ? 'none' : 'perspective(1000px) rotateX(16deg)',
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease',
        }}
      >
        {/* 18 x 12 Grid Container */}
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(20px, 32px))`,
            gridTemplateRows: `repeat(${rows}, minmax(20px, 32px))`,
          }}
          role="grid"
          aria-rowcount={rows}
          aria-colcount={cols}
        >
          {cells.map((cell) => {
            const isSelected = selectedCellId === cell.id;
            const isHovered = hoveredCellId === cell.id;
            const isBrushPreview = brushPreviewCellIds.has(cell.id);

            const zoneIdx = cell.zoneId ? Number(cell.zoneId) : null;
            const patternClass =
              zoneIdx !== null ? ZONE_PATTERNS[zoneIdx % ZONE_PATTERNS.length] : '';

            const cellColor = getCellColor(cell);

            return (
              <button
                key={cell.id}
                id={`field-cell-${cell.id}`}
                type="button"
                tabIndex={isSelected ? 0 : -1}
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`Row ${cell.row}, Column ${cell.col}: ${cell.value} ${featureUnit ?? ''}`}
                onPointerDown={() => handlePointerDown(cell)}
                onPointerEnter={() => handlePointerEnter(cell)}
                onKeyDown={(e) => handleCellKeyDown(e, cell)}
                className={`relative aspect-square rounded-sm transition-all focus:outline-none ${patternClass} ${
                  isHovered ? 'z-20 -translate-y-1.5 shadow-md ring-1 ring-sage-300' : ''
                } ${
                  isSelected ? 'z-30 ring-2 ring-parchment-100 shadow-lg scale-105' : ''
                } ${
                  isBrushPreview ? 'ring-2 ring-clay-light animate-pulse scale-105' : ''
                }`}
                style={{
                  backgroundColor: isBrushPreview ? '#C86B49' : cellColor,
                }}
              >
                {/* Locked corner brackets for selected cell from 0efec7b */}
                {isSelected && (
                  <div className="absolute -inset-1 pointer-events-none">
                    <span className="absolute top-0 left-0 w-1.5 h-1.5 border-t-2 border-l-2 border-parchment-50" />
                    <span className="absolute top-0 right-0 w-1.5 h-1.5 border-t-2 border-r-2 border-parchment-50" />
                    <span className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b-2 border-l-2 border-parchment-50" />
                    <span className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b-2 border-r-2 border-parchment-50" />
                  </div>
                )}

                {/* Zone Number Badge on Key Cells */}
                {zoneIdx !== null &&
                  cell.row % 4 === 2 &&
                  cell.col % 5 === 2 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/95 drop-shadow select-none">
                      Z{zoneIdx + 1}
                    </span>
                  )}
              </button>
            );
          })}
        </div>

        {/* Axis Labels (Subtle cartographic markers from 0efec7b) */}
        <div className="flex justify-between items-center text-[10px] font-mono text-sage-400 mt-2.5 px-1 select-none">
          <span>Col 1</span>
          <span className="text-sage-500 text-[10px]">SOIL FEATURE: {featureLabel.toUpperCase()}</span>
          <span>Col 18</span>
        </div>
      </div>
    </div>
  );
};
