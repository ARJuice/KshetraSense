import React, { useMemo, useState } from 'react';
import { Compass, Eye, Layers } from 'lucide-react';
import type { CropSightAnalysisResult } from './types';

interface CircularAoiCanvasProps {
  result: CropSightAnalysisResult;
}

export const CircularAoiCanvas: React.FC<CircularAoiCanvasProps> = ({ result }) => {
  const [viewMode, setViewMode] = useState<'ndvi' | 'zones'>('ndvi');
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; ndvi: number; zone: number } | null>(null);

  const radiusMeters = result.aoi.radiusMeters;
  const numZones = result.zonesIdentified;

  // Generate deterministic pseudo-raster grid inside the circle (21x21 grid)
  const rasterGrid = useMemo(() => {
    const size = 21;
    const center = (size - 1) / 2;
    const grid: Array<{ x: number; y: number; ndvi: number; zone: number; inCircle: boolean }> = [];

    const baseMean = result.ndviStats.mean;
    const std = result.ndviStats.stddev || 0.08;

    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const dx = (c - center) / center;
        const dy = (r - center) / center;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 1.0) {
          // Synthetic spatial wave across circular AOI
          const spatial = Math.sin(dx * 3.14) * 0.4 + Math.cos(dy * 2.5) * 0.3;
          const pixelNdvi = Math.max(0.08, Math.min(0.92, baseMean + spatial * std * 1.5));

          // Zone assignment by quantile thresholds
          let zone = 1;
          if (numZones === 2) {
            zone = pixelNdvi >= baseMean ? 2 : 1;
          } else if (numZones === 3) {
            zone = pixelNdvi < baseMean - 0.5 * std ? 1 : pixelNdvi > baseMean + 0.5 * std ? 3 : 2;
          } else {
            const minStat = result.ndviStats.min ?? 0.1;
            const maxStat = result.ndviStats.max ?? 0.9;
            const range = Math.max(0.001, maxStat - minStat);
            const step = range / numZones;
            zone = Math.min(numZones, Math.max(1, Math.floor((pixelNdvi - minStat) / step) + 1));
          }

          grid.push({ x: c, y: r, ndvi: pixelNdvi, zone, inCircle: true });
        } else {
          grid.push({ x: c, y: r, ndvi: 0, zone: 0, inCircle: false });
        }
      }
    }
    return { size, grid };
  }, [result, numZones]);

  // Color mappings
  const getNdviColor = (ndvi: number) => {
    if (ndvi < 0.3) return '#d73027'; // stressed red
    if (ndvi < 0.45) return '#fdae61'; // transition orange
    if (ndvi < 0.6) return '#a6d96a'; // moderate green
    if (ndvi < 0.75) return '#66bd63'; // healthy green
    return '#1a9850'; // dense lush green
  };

  const getZoneColor = (zone: number) => {
    if (!zone || Number.isNaN(zone) || zone < 1) return '#888';
    const palette = ['#e06666', '#f6b26b', '#ffd966', '#93c47d', '#6d9eeb', '#8e7cc3', '#c27ba0'];
    const idx = (zone - 1) % palette.length;
    return palette[idx] || '#888';
  };

  const getZonePatternClass = (zone: number) => {
    if (!zone || Number.isNaN(zone) || zone < 1) return '';
    return `pattern-zone-${((zone - 1) % 4) + 1}`;
  };

  return (
    <div className="space-y-3">
      {/* Visualizer header & mode switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm font-bold text-ink">Circular Field Aperture</span>
          <span className="rounded bg-parchment-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            r = {radiusMeters} m
          </span>
        </div>
        <div className="flex rounded-md border border-line-border bg-parchment-50 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('ndvi')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
              viewMode === 'ndvi' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Eye size={12} /> NDVI Index
          </button>
          <button
            type="button"
            onClick={() => setViewMode('zones')}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 transition ${
              viewMode === 'zones' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Layers size={12} /> Management Zones
          </button>
        </div>
      </div>

      {/* Circular raster canvas */}
      <div className="relative flex aspect-square w-full max-w-[420px] mx-auto items-center justify-center overflow-hidden rounded-2xl border border-line-border bg-soil-clay/10 p-3 shadow-inner">
        {/* Background radial scale rings */}
        <div className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-sage-600/20" />
        <div className="pointer-events-none absolute inset-14 rounded-full border border-dashed border-sage-600/15" />
        <div className="pointer-events-none absolute inset-22 rounded-full border border-dashed border-sage-600/10" />

        {/* North Arrow */}
        <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-center text-sage-800">
          <Compass size={18} className="animate-pulse" />
          <span className="font-mono text-[9px] font-bold">N</span>
        </div>

        {/* Scale label */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-parchment-50/90 px-1.5 py-0.5 font-mono text-[9px] text-ink-muted shadow-sm">
          Diameter: {(radiusMeters * 2).toLocaleString()} m
        </div>

        {/* Circular Grid Container */}
        <div
          className="relative grid aspect-square w-full rounded-full overflow-hidden shadow-instrument"
          style={{
            gridTemplateColumns: `repeat(${rasterGrid.size}, 1fr)`,
            gridTemplateRows: `repeat(${rasterGrid.size}, 1fr)`,
          }}
        >
          {rasterGrid.grid.map((cell) => {
            if (!cell.inCircle) {
              return <div key={`${cell.x}-${cell.y}`} className="bg-transparent" />;
            }

            const bg = viewMode === 'ndvi' ? getNdviColor(cell.ndvi) : getZoneColor(cell.zone);
            const patternClass = viewMode === 'zones' ? getZonePatternClass(cell.zone) : '';

            return (
              <div
                key={`${cell.x}-${cell.y}`}
                onMouseEnter={() => setHoveredPixel(cell)}
                onMouseLeave={() => setHoveredPixel(null)}
                className={`transition-opacity hover:opacity-80 hover:ring-1 hover:ring-parchment-50 cursor-crosshair ${patternClass}`}
                style={{ backgroundColor: bg }}
              />
            );
          })}
        </div>
      </div>

      {/* Legend & Hover inspection readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-subtle bg-parchment-100/70 p-2.5 text-xs">
        {viewMode === 'ndvi' ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-ink-subtle">Low 0.2</span>
            <div className="h-2.5 w-24 rounded bg-gradient-to-r from-[#d73027] via-[#fdae61] via-[#a6d96a] to-[#1a9850]" />
            <span className="font-mono text-[10px] text-ink-subtle">0.8+ Lush</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: numZones }, (_, i) => i + 1).map((z) => (
              <div key={z} className="flex items-center gap-1">
                <span
                  className={`h-2.5 w-2.5 rounded-sm border border-black/20 ${getZonePatternClass(z)}`}
                  style={{ backgroundColor: getZoneColor(z) }}
                />
                <span className="font-mono text-[10px] text-ink-muted">Zone {z}</span>
              </div>
            ))}
          </div>
        )}

        <div className="font-mono text-[11px] text-ink">
          {hoveredPixel ? (
            <span>
              NDVI: <strong>{hoveredPixel.ndvi.toFixed(3)}</strong> · Zone: <strong>{hoveredPixel.zone}</strong>
            </span>
          ) : (
            <span className="text-ink-subtle">Hover aperture to inspect pixel</span>
          )}
        </div>
      </div>
    </div>
  );
};
