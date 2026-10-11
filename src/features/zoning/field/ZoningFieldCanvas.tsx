import { CSSProperties, KeyboardEvent, useId, useMemo, useState } from 'react';

/**
 * Minimal data contract for a rendered soil observation.  The zoning feature
 * owns the data source; this component deliberately does not invent cells or
 * clustering results.
 */
export interface ZoningFieldCell {
  id: string;
  row: number;
  col: number;
  /** Numeric value for the currently selected soil feature. */
  value: number;
  /** A zone identifier is present only after a successful zoning run. */
  zoneId?: string | null;
  /** 0–1 membership for the selected zone, when fuzzy zoning is used. */
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
  /** Label used in screen-reader and keyboard instructions. */
  featureLabel: string;
  featureUnit?: string;
  /** Expected feature scale. Used only to colour an observed value. */
  featureRange: readonly [number, number];
  selectedCellId?: string | null;
  selectedZoneId?: string | null;
  disabled?: boolean;
  onCellSelect?: (cell: ZoningFieldCell) => void;
  onCellHover?: (cell: ZoningFieldCell | null) => void;
  onZoneSelect?: (zoneId: string | null) => void;
  className?: string;
}

const CELL_WIDTH = 52;
const CELL_HEIGHT = 27;
const PADDING_X = 54;
const PADDING_Y = 50;

function featureColor(value: number, range: readonly [number, number]): string {
  const [min, max] = range;
  const normalized = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  // Mineral soil palette: cool low values through fertile olive to warm high values.
  const hue = 204 - normalized * 158;
  const lightness = 42 + normalized * 11;
  return `hsl(${hue} 47% ${lightness}%)`;
}

function isoPoint(row: number, col: number): [number, number] {
  return [PADDING_X + (col - row) * (CELL_WIDTH / 2), PADDING_Y + (col + row) * (CELL_HEIGHT / 2)];
}

function diamondPoints(cx: number, cy: number): string {
  return `${cx},${cy - CELL_HEIGHT / 2} ${cx + CELL_WIDTH / 2},${cy} ${cx},${cy + CELL_HEIGHT / 2} ${cx - CELL_WIDTH / 2},${cy}`;
}

function formatValue(value: number, unit?: string): string {
  const precision = Number.isInteger(value) ? 0 : 2;
  return `${value.toFixed(precision)}${unit ? ` ${unit}` : ''}`;
}

/**
 * Accessible, dependency-free SVG field renderer. It supports both pre-zoning
 * feature maps and post-zoning zone maps and intentionally leaves all domain
 * computation and state persistence to its parent.
 */
export function ZoningFieldCanvas({
  cells,
  zones = [],
  featureLabel,
  featureUnit,
  featureRange,
  selectedCellId = null,
  selectedZoneId = null,
  disabled = false,
  onCellSelect,
  onCellHover,
  onZoneSelect,
  className,
}: ZoningFieldCanvasProps) {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const [keyboardCellId, setKeyboardCellId] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);

  const extent = useMemo(() => {
    if (cells.length === 0) return { width: 320, height: 220 };
    const points = cells.map((cell) => isoPoint(cell.row, cell.col));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    return {
      width: Math.max(320, Math.max(...xs) - Math.min(...xs) + CELL_WIDTH + PADDING_X * 2),
      height: Math.max(220, Math.max(...ys) - Math.min(...ys) + CELL_HEIGHT + PADDING_Y * 2),
    };
  }, [cells]);

  const orderedCells = useMemo(
    () => [...cells].sort((a, b) => (a.row + a.col) - (b.row + b.col) || a.col - b.col),
    [cells],
  );

  const selectCell = (cell: ZoningFieldCell) => {
    if (disabled) return;
    onCellSelect?.(cell);
    if (cell.zoneId) onZoneSelect?.(cell.zoneId);
  };

  const moveFocus = (current: ZoningFieldCell, rowDelta: number, colDelta: number) => {
    const next = cells.find((candidate) => candidate.row === current.row + rowDelta && candidate.col === current.col + colDelta);
    if (!next) return;
    setKeyboardCellId(next.id);
    document.getElementById(`zoning-field-cell-${next.id}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, cell: ZoningFieldCell) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(cell, -1, 0);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(cell, 1, 0);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(cell, 0, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(cell, 0, 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectCell(cell);
        break;
      case 'Escape':
        onZoneSelect?.(null);
        break;
      default:
        break;
    }
  };

  const shellStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    border: '1px solid rgba(34, 54, 47, 0.14)',
    borderRadius: 14,
    background: 'linear-gradient(145deg, #f8faf6 0%, #edf2ea 100%)',
    boxShadow: '0 18px 42px rgba(34, 54, 47, 0.09)',
  };

  if (cells.length === 0) {
    return (
      <section className={className} style={shellStyle} aria-label="Field map unavailable">
        <div style={{ padding: 28, color: '#476054', textAlign: 'center' }}>
          No field observations are available yet. Import or collect soil samples to draw this map.
        </div>
      </section>
    );
  }

  return (
    <section className={className} style={shellStyle} aria-label={`${featureLabel} field map`}>
      <style>{`
        .ks-field-cell { cursor: pointer; outline: none; transform-origin: center; transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease; }
        .ks-field-cell:hover, .ks-field-cell:focus-visible { filter: brightness(1.13) drop-shadow(0 4px 5px rgba(20, 43, 33, .2)); }
        .ks-field-cell:hover .ks-field-surface, .ks-field-cell:focus-visible .ks-field-surface { transform: translateY(-3px); }
        .ks-field-surface { transform-origin: center; transition: transform 180ms cubic-bezier(.2,.9,.3,1); }
        .ks-field-selected .ks-field-surface { transform: translateY(-4px); }
        @media (prefers-reduced-motion: reduce) { .ks-field-cell, .ks-field-surface { transition: none !important; } }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '13px 16px 5px', color: '#294338' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.02em' }}>{featureLabel} field</span>
        <span style={{ fontSize: 12, color: '#5b6e61' }}>{cells.length} observations</span>
      </div>
      <svg
        viewBox={`0 0 ${extent.width} ${extent.height}`}
        width="100%"
        role="group"
        aria-labelledby={`${titleId} ${descriptionId}`}
        style={{ display: 'block', minHeight: 260, touchAction: 'manipulation' }}
      >
        <title id={titleId}>{featureLabel} field grid</title>
        <desc id={descriptionId}>Select a cell to inspect it. Use arrow keys to navigate cells, Enter to select, and Escape to clear a zone highlight.</desc>
        <g aria-hidden="true" opacity="0.52">
          <path d={`M ${extent.width / 2} 20 L ${extent.width - 26} ${extent.height / 2} L ${extent.width / 2} ${extent.height - 24} L 26 ${extent.height / 2} Z`} fill="none" stroke="#b8c9ba" strokeDasharray="4 6" />
        </g>
        {orderedCells.map((cell) => {
          const [cx, cy] = isoPoint(cell.row, cell.col);
          const zone = cell.zoneId ? zoneById.get(cell.zoneId) : undefined;
          const isSelected = cell.id === selectedCellId || cell.id === keyboardCellId;
          const isHovered = cell.id === hoveredCellId;
          const zoneIsDimmed = Boolean(selectedZoneId && cell.zoneId !== selectedZoneId);
          const fill = zone?.color ?? featureColor(cell.value, featureRange);
          const membershipOpacity = zone && cell.membership != null ? Math.max(0.42, Math.min(1, cell.membership)) : 1;
          const label = `${cell.id}: ${formatValue(cell.value, featureUnit)}${zone ? `, ${zone.label}` : ''}`;

          return (
            <g
              key={cell.id}
              id={`zoning-field-cell-${cell.id}`}
              className={`ks-field-cell${isSelected ? ' ks-field-selected' : ''}`}
              role="button"
              tabIndex={isSelected || (!selectedCellId && cell.id === orderedCells[0]?.id) ? 0 : -1}
              aria-label={label}
              aria-pressed={isSelected}
              onClick={() => selectCell(cell)}
              onFocus={() => setKeyboardCellId(cell.id)}
              onBlur={() => setKeyboardCellId(null)}
              onKeyDown={(event) => handleKeyDown(event, cell)}
              onMouseEnter={() => {
                setHoveredCellId(cell.id);
                onCellHover?.(cell);
              }}
              onMouseLeave={() => {
                setHoveredCellId(null);
                onCellHover?.(null);
              }}
              style={{ opacity: zoneIsDimmed ? 0.26 : membershipOpacity, pointerEvents: disabled ? 'none' : 'auto' }}
            >
              <g className="ks-field-surface">
                <polygon points={diamondPoints(cx, cy + 5)} fill="#173a2d" opacity="0.2" />
                <polygon points={diamondPoints(cx, cy)} fill={fill} stroke={isSelected ? '#102d23' : 'rgba(255,255,255,.68)'} strokeWidth={isSelected ? 2.4 : 0.8} />
                {zone && (
                  <polygon points={diamondPoints(cx, cy)} fill="none" stroke="rgba(255,255,255,.52)" strokeDasharray="2 2" strokeWidth="0.8" />
                )}
              </g>
              {(isSelected || isHovered) && (
                <polygon points={diamondPoints(cx, cy - 1)} fill="none" stroke="#ffffff" strokeWidth="1.4" pointerEvents="none" />
              )}
              <title>{label}</title>
            </g>
          );
        })}
      </svg>
      <div style={{ padding: '6px 16px 14px', color: '#5b6e61', fontSize: 12 }}>
        Click a cell to inspect. Arrow keys move between observations.
      </div>
    </section>
  );
}
