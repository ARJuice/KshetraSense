import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { createLocalProjection, isPointInsideFieldBoundary, type GeoJsonGeometry, type GeoJsonPolygon, type Position } from './fieldGeometry';
import { getFieldCellColor, getFieldLayerValue, ZONE_COLORS, type FieldLayer } from './fieldDisplay';
import type { FieldCellResult, FieldZoningResponse } from './fieldTypes';

export interface FieldMapSample {
  id: string;
  latitude: number;
  longitude: number;
}

export interface FieldMap2DProps {
  boundary: GeoJsonPolygon | null;
  cells: readonly FieldCellResult[];
  zones: readonly FieldZoningResponse['zones'][number][];
  samples: readonly FieldMapSample[];
  layer: FieldLayer;
  range: readonly [number, number];
  membershipCluster?: number;
  selectedCellId: string | null;
  selectedZoneId: number | null;
  selectedSampleId?: string | null;
  placementMode?: boolean;
  onAddSampleAt?: (position: Position) => void;
  onCellSelect?: (cell: FieldCellResult) => void;
  onCellHover?: (cell: FieldCellResult | null) => void;
  onSampleSelect?: (sampleId: string) => void;
  wsnNodes?: FieldZoningResponse['wsnNodes'];
  clusterHead?: FieldZoningResponse['clusterHead'] | null;
}

function polygons(geometry: GeoJsonGeometry): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function geometryPath(geometry: GeoJsonGeometry, project: ReturnType<typeof createLocalProjection>['project']): string {
  return polygons(geometry).flatMap((polygon) => polygon).map((ring) => {
    const points = ring.map(project);
    return `${points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')} Z`;
  }).join(' ');
}

function sameRowCell(cells: readonly FieldCellResult[], origin: FieldCellResult, direction: 'left' | 'right' | 'up' | 'down') {
  const candidates = cells.filter((cell) => {
    if (direction === 'left') return cell.row === origin.row && cell.column < origin.column;
    if (direction === 'right') return cell.row === origin.row && cell.column > origin.column;
    if (direction === 'up') return cell.column === origin.column && cell.row < origin.row;
    return cell.column === origin.column && cell.row > origin.row;
  });
  candidates.sort((left, right) => direction === 'left' || direction === 'up'
    ? (direction === 'left' ? right.column - left.column : right.row - left.row)
    : (direction === 'right' ? left.column - right.column : left.row - right.row));
  return candidates[0] ?? null;
}

export function FieldMap2D({
  boundary, cells, zones, samples, layer, range, membershipCluster = 0,
  selectedCellId, selectedZoneId, selectedSampleId = null, placementMode = false, onAddSampleAt,
  onCellSelect, onCellHover, onSampleSelect, wsnNodes = [], clusterHead = null,
}: FieldMap2DProps) {
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);
  const projection = useMemo(() => boundary ? createLocalProjection(boundary) : null, [boundary]);
  const cellPaths = useMemo(() => {
    if (!projection) return [];
    return cells.map((cell) => ({ cell, d: geometryPath(cell.geometry, projection.project) }));
  }, [cells, projection]);
  const boundaryPath = useMemo(() => {
    if (!boundary || !projection) return '';
    return geometryPath(boundary, projection.project);
  }, [boundary, projection]);

  if (!boundary || !projection) {
    return <div className="field-map__empty"><strong>Import a field boundary to begin.</strong><span>Use a WGS84 GeoJSON Polygon. No field or sample values are preloaded.</span></div>;
  }

  const { minX, minY, maxX, maxY } = projection.extent;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const padding = Math.max(width, height) * 0.09;
  const viewBox = `${minX - padding} ${minY - padding} ${width + 2 * padding} ${height + 2 * padding}`;
  const pointRadius = Math.max(Math.min(width, height) * 0.018, 0.35);
  const selectedCell = cells.find((cell) => cell.cellId === selectedCellId) ?? null;

  const addSampleFromEvent = (event: MouseEvent<SVGSVGElement>) => {
    if (!placementMode || !onAddSampleAt) return;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const position = projection.unproject({ x: point.x, y: point.y });
    if (isPointInsideFieldBoundary(position, boundary)) onAddSampleAt(position);
  };

  return (
    <div className={`field-map ${placementMode ? 'field-map--pinning' : ''}`}>
      {placementMode && <div className="field-map__pin-note" role="status">Click inside the boundary to place a sample. Its soil values remain blank until entered.</div>}
      <svg
        className="field-map__svg"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="listbox"
        aria-label={`Field map with ${cells.length} analyzed cells`}
        onClick={addSampleFromEvent}
        onPointerLeave={() => { setHoveredCellId(null); onCellHover?.(null); }}
      >
        <defs>
          {zones.map((zone) => (
            <pattern key={zone.zoneId} id={`field-zone-pattern-${zone.zoneId}`} width={1.2} height={1.2} patternUnits="userSpaceOnUse" patternTransform={`rotate(${zone.zoneId % 2 ? -45 : 45})`}>
              <rect width="100%" height="100%" fill={ZONE_COLORS[zone.zoneId % ZONE_COLORS.length]} />
              <path d="M 0 0 L 0 1.2" stroke="rgba(255,255,255,0.44)" strokeWidth="0.22" />
            </pattern>
          ))}
        </defs>
        <path d={boundaryPath} className="field-map__boundary-fill" fillRule="evenodd" />
        {cellPaths.map(({ cell, d }) => {
          const isHovered = hoveredCellId === cell.cellId;
          const isSelected = selectedCellId === cell.cellId;
          const dimmed = selectedZoneId !== null && cell.zoneId !== selectedZoneId;
          const color = getFieldCellColor(cell, layer, range, membershipCluster);
          return (
            <path
              key={cell.cellId}
              id={`field-cell-${cell.cellId}`}
              d={d}
              role="option"
              aria-selected={isSelected}
              aria-label={`Row ${cell.row + 1}, column ${cell.column + 1}, zone ${cell.zoneId + 1}, ${layer} ${getFieldLayerValue(cell, layer, membershipCluster) ?? 'not available'}`}
              aria-describedby="field-map-instructions"
              tabIndex={isSelected || (!selectedCellId && cell.cellId === cells[0]?.cellId) ? 0 : -1}
              className={`field-map__cell ${isHovered ? 'is-hovered' : ''} ${isSelected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
              fill={layer === 'zone' ? `url(#field-zone-pattern-${cell.zoneId})` : color}
              style={{ '--zone-color': color } as CSSProperties}
              onPointerEnter={() => { setHoveredCellId(cell.cellId); onCellHover?.(cell); }}
              onPointerLeave={() => { setHoveredCellId(null); onCellHover?.(null); }}
              onClick={(event) => {
                event.stopPropagation();
                if (placementMode) onAddSampleAt?.([cell.centerWgs84.longitude, cell.centerWgs84.latitude]);
                else onCellSelect?.(cell);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (placementMode) onAddSampleAt?.([cell.centerWgs84.longitude, cell.centerWgs84.latitude]);
                  else onCellSelect?.(cell);
                  return;
                }
                const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[event.key] as 'left' | 'right' | 'up' | 'down' | undefined;
                if (!direction) return;
                event.preventDefault();
                const next = sameRowCell(cells, cell, direction);
                if (next) {
                  onCellSelect?.(next);
                  requestAnimationFrame(() => document.getElementById(`field-cell-${next.cellId}`)?.focus());
                }
              }}
            />
          );
        })}
        <path d={boundaryPath} className="field-map__boundary-line" fill="none" pointerEvents="none" />
        {zones.map((zone) => {
          const center = projection.project([zone.centroidWgs84.longitude, zone.centroidWgs84.latitude]);
          return (
            <g key={zone.zoneId} className={`field-map__zone-label ${selectedZoneId === zone.zoneId ? 'is-selected' : ''}`} pointerEvents="none">
              <circle cx={center.x} cy={center.y} r={pointRadius * 1.4} />
              <text x={center.x} y={center.y} dy="0.34em">{zone.zoneId + 1}</text>
            </g>
          );
        })}
        {samples.map((sample) => {
          const point = projection.project([sample.longitude, sample.latitude]);
          const selected = sample.id === selectedSampleId;
          return (
            <g key={sample.id} className={`field-map__sample-pin ${selected ? 'is-selected' : ''}`}>
              <circle cx={point.x} cy={point.y} r={pointRadius * 1.45} />
              <text x={point.x} y={point.y - pointRadius * 1.8}>{sample.id}</text>
              <circle
                cx={point.x} cy={point.y} r={pointRadius * 0.7}
                role="button" tabIndex={0} aria-label={`Select sample ${sample.id}`}
                onClick={(event) => { event.stopPropagation(); onSampleSelect?.(sample.id); }}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSampleSelect?.(sample.id); } }}
              />
            </g>
          );
        })}
        {wsnNodes.map((node) => {
          const point = projection.project([node.positionWgs84.longitude, node.positionWgs84.latitude]);
          return (
            <g key={`wsn-${node.zoneId}`} className="field-map__candidate" pointerEvents="none">
              <circle cx={point.x} cy={point.y} r={pointRadius * 1.15} />
              <text x={point.x} y={point.y + pointRadius * 0.32}>N{node.zoneId + 1}</text>
            </g>
          );
        })}
        {clusterHead && (() => {
          const point = projection.project([clusterHead.positionWgs84.longitude, clusterHead.positionWgs84.latitude]);
          const radius = pointRadius * 1.55;
          return (
            <g className="field-map__candidate field-map__candidate--gateway" pointerEvents="none">
              <path d={`M ${point.x} ${point.y - radius} L ${point.x + radius} ${point.y} L ${point.x} ${point.y + radius} L ${point.x - radius} ${point.y} Z`} />
              <text x={point.x} y={point.y + pointRadius * 0.32}>G</text>
            </g>
          );
        })()}
      </svg>
      <span id="field-map-instructions" className="field-map__sr-only">
        Use arrow keys to move between cells and Enter to inspect. Samples are measured inputs; map colors are interpolated estimates.
      </span>
      {selectedCell && <div className="field-map__coordinate">R{selectedCell.row + 1} · C{selectedCell.column + 1} · {selectedCell.cellId}</div>}
    </div>
  );
}
