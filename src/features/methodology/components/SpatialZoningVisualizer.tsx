import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { MathView } from '../../../components/ui/MathView';

interface SamplePoint {
  id: string;
  name: string;
  x: number; // percentage in SVG coordinate space
  y: number;
  ph: number;
  ec: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

const SAMPLE_POINTS: SamplePoint[] = [
  { id: 'SP-1', name: 'Core #1 (Northwest)', x: 25, y: 30, ph: 5.6, ec: 0.9, nitrogen: 55, phosphorus: 18, potassium: 130 },
  { id: 'SP-2', name: 'Core #2 (Northeast)', x: 75, y: 25, ph: 6.8, ec: 1.4, nitrogen: 85, phosphorus: 32, potassium: 210 },
  { id: 'SP-3', name: 'Core #3 (Center)', x: 50, y: 55, ph: 6.4, ec: 1.2, nitrogen: 75, phosphorus: 26, potassium: 185 },
  { id: 'SP-4', name: 'Core #4 (Southwest)', x: 30, y: 80, ph: 5.2, ec: 0.7, nitrogen: 45, phosphorus: 14, potassium: 115 },
  { id: 'SP-5', name: 'Core #5 (Southeast)', x: 78, y: 75, ph: 7.2, ec: 1.8, nitrogen: 95, phosphorus: 38, potassium: 245 },
];

export const SpatialZoningVisualizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'idw' | 'autok' | 'contiguity'>('idw');
  const [selectedCell, setSelectedCell] = useState<{ x: number; y: number } | null>({ x: 45, y: 40 });
  const [selectedK, setSelectedK] = useState<number>(3);
  const [showSmoothing, setShowSmoothing] = useState<boolean>(true);
  const [selectedAttribute, setSelectedAttribute] = useState<'ph' | 'ec' | 'nitrogen' | 'phosphorus' | 'potassium'>('ph');

  // Calculate IDW interpolation for the selected cell
  const cellX = selectedCell ? selectedCell.x : 45;
  const cellY = selectedCell ? selectedCell.y : 40;

  const idwCalculations = SAMPLE_POINTS.map((sp) => {
    // Euclidean distance in coordinate space (scaled to simulated meters)
    const dx = (sp.x - cellX) * 2.5; // ~2.5m per unit
    const dy = (sp.y - cellY) * 2.5;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1.0); // minimum 1m to prevent div by 0
    const weight = 1 / Math.pow(dist, 2.0); // IDW power p = 2.0
    return {
      point: sp,
      distanceM: dist,
      weight: weight,
      attrValue: sp[selectedAttribute],
    };
  });

  const sumWeights = idwCalculations.reduce((acc, curr) => acc + curr.weight, 0);
  const interpolatedValue =
    idwCalculations.reduce((acc, curr) => acc + curr.weight * curr.attrValue, 0) / (sumWeights || 1);

  // Silhouette score curve for Auto-K sweep (K=2 to 6)
  const silhouetteData = [
    { k: 2, score: 0.482, label: 'Under-segmented (2 zones)', valid: true },
    { k: 3, score: 0.635, label: 'Optimal Peak K* = 3', valid: true, isOptimal: true },
    { k: 4, score: 0.518, label: 'Over-partitioned (4 zones)', valid: true },
    { k: 5, score: 0.412, label: 'Marginal separation (5 zones)', valid: true },
    { k: 6, score: 0.334, label: 'Severely fragmented (6 zones)', valid: true },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Visualizer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              ML
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Interactive Spatial Machine Learning Core Simulator
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visual inspection of IDW distance-weighted spatial interpolation, Auto-K silhouette sweep, and 8-neighbor boundary smoothing.
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('idw')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'idw' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. IDW Interpolation (p=2)
          </button>
          <button
            onClick={() => setActiveTab('autok')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'autok' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Auto-K* Silhouette Sweep
          </button>
          <button
            onClick={() => setActiveTab('contiguity')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'contiguity' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Contiguity Smoothing
          </button>
        </div>
      </div>

      {/* MODE 1: IDW INTERPOLATION SIMULATOR */}
      {activeTab === 'idw' && (
        <div key="idw" className="module-nav-transition grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Interactive Field Canvas (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin size={13} className="text-emerald-600" />
                <span>Click anywhere inside the field polygon to compute IDW:</span>
              </span>

              {/* Chemical Attribute Picker */}
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 font-medium">Attribute:</span>
                <select
                  value={selectedAttribute}
                  onChange={(e) => setSelectedAttribute(e.target.value as any)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="ph">Soil pH</option>
                  <option value="ec">Electrical Cond. (dS/m)</option>
                  <option value="nitrogen">Nitrogen N (mg/kg)</option>
                  <option value="phosphorus">Phosphorus P (mg/kg)</option>
                  <option value="potassium">Potassium K (mg/kg)</option>
                </select>
              </div>
            </div>

            {/* SVG Interactive Canvas */}
            <div className="relative rounded-xl border border-slate-200 bg-slate-900 p-2 shadow-inner overflow-hidden select-none">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-72 cursor-crosshair"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.max(12, Math.min(88, ((e.clientX - rect.left) / rect.width) * 100));
                  const y = Math.max(12, Math.min(88, ((e.clientY - rect.top) / rect.height) * 100));
                  setSelectedCell({ x, y });
                }}
              >
                {/* Field Boundary Polygon */}
                <polygon
                  points="10,25 35,10 85,15 95,50 85,90 25,85 8,55"
                  fill="#064e3b"
                  fillOpacity="0.3"
                  stroke="#10b981"
                  strokeWidth="0.8"
                  strokeDasharray="2 1"
                />

                {/* 10m regular grid cells hint */}
                <defs>
                  <pattern id="soilGridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                    <rect width="10" height="10" fill="none" stroke="#334155" strokeWidth="0.2" strokeOpacity="0.4" />
                  </pattern>
                </defs>
                <polygon
                  points="10,25 35,10 85,15 95,50 85,90 25,85 8,55"
                  fill="url(#soilGridPattern)"
                />

                {/* Distance rays connecting selected cell to all sample points */}
                {selectedCell &&
                  idwCalculations.map((calc, idx) => (
                    <g key={idx}>
                      <line
                        x1={selectedCell.x}
                        y1={selectedCell.y}
                        x2={calc.point.x}
                        y2={calc.point.y}
                        stroke="#38bdf8"
                        strokeWidth={Math.max(0.3, Math.min(1.2, calc.weight * 50))}
                        strokeDasharray="1.5 1"
                        strokeOpacity="0.7"
                      />
                      {/* Distance label */}
                      <text
                        x={(selectedCell.x + calc.point.x) / 2}
                        y={(selectedCell.y + calc.point.y) / 2 - 1}
                        fontSize="2.2"
                        fill="#94a3b8"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {calc.distanceM.toFixed(1)}m
                      </text>
                    </g>
                  ))}

                {/* Laboratory Soil Sample Points */}
                {SAMPLE_POINTS.map((sp) => (
                  <g key={sp.id}>
                    <circle
                      cx={sp.x}
                      cy={sp.y}
                      r="2.5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="0.6"
                    />
                    <text
                      x={sp.x}
                      y={sp.y + 4.5}
                      fontSize="2.5"
                      fill="#e2e8f0"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {sp.name.split(' ')[0]}
                    </text>
                    <text
                      x={sp.x}
                      y={sp.y + 7.2}
                      fontSize="2.2"
                      fill="#a7f3d0"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {sp[selectedAttribute]}
                    </text>
                  </g>
                ))}

                {/* Selected Unsampled Grid Cell Point */}
                {selectedCell && (
                  <g>
                    <circle
                      cx={selectedCell.x}
                      cy={selectedCell.y}
                      r="3"
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                    <circle
                      cx={selectedCell.x}
                      cy={selectedCell.y}
                      r="6"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.4"
                      strokeDasharray="1 1"
                    />
                    <text
                      x={selectedCell.x}
                      y={selectedCell.y - 4}
                      fontSize="2.6"
                      fill="#38bdf8"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      Selected Cell
                    </text>
                  </g>
                )}
              </svg>

              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>WGS84 UTM 43N Projected</span>
                <span>Power Parameter: p = 2.0</span>
              </div>
            </div>
          </div>

          {/* Real-time Math Breakdown (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Live Mathematical Solution
              </span>
              <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800">
                  Interpolated {selectedAttribute.toUpperCase()}:
                </span>
                <span className="font-mono text-lg font-extrabold text-emerald-700">
                  {interpolatedValue.toFixed(2)}
                </span>
              </div>

              {/* IDW Formulation formula box */}
              <div className="rounded bg-slate-900 p-2.5 text-slate-100 font-mono text-[11px] space-y-1">
                <p className="text-emerald-400 font-semibold">
                  {'w_i = 1 / (d_i)^2'}
                </p>
                <p className="text-slate-300">
                  {'z_est = (∑ w_i · z_i) / (∑ w_i)'}
                </p>
              </div>

              {/* Distance and Weight Contribution Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1">Core</th>
                      <th className="py-1 font-mono">d (m)</th>
                      <th className="py-1 font-mono">Weight %</th>
                      <th className="py-1 font-mono">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {idwCalculations.map((calc, idx) => {
                      const weightPct = ((calc.weight / (sumWeights || 1)) * 100).toFixed(1);
                      return (
                        <tr key={idx}>
                          <td className="py-1 font-semibold">{calc.point.id}</td>
                          <td className="py-1 font-mono text-slate-500">{calc.distanceM.toFixed(1)}m</td>
                          <td className="py-1 font-mono font-bold text-emerald-800">{weightPct}%</td>
                          <td className="py-1 font-mono">{calc.attrValue}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded border border-blue-200 bg-blue-50/60 p-2.5 text-[11px] leading-relaxed text-blue-900">
                <strong>Spatial Physics Note:</strong> As the query cell approaches any sample core, distance <MathView math="d \to 0" /> and its weight <MathView math="w \to \infty" />, honoring the exact lab measurement as an exact interpolator.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: AUTO-K SILHOUETTE SWEEP */}
      {activeTab === 'autok' && (
        <div key="autok" className="module-nav-transition space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Auto-K Bar Chart */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Silhouette Score Evaluation Curve across Candidates (K = 2..6)
                </h4>
                <span className="rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold px-2 py-0.5">
                  Optimal K* = 3
                </span>
              </div>

              <div className="space-y-3 pt-2">
                {silhouetteData.map((item) => (
                  <div
                    key={item.k}
                    onClick={() => setSelectedK(item.k)}
                    className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                      selectedK === item.k
                        ? 'border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-white/60 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900">
                        Candidate K = {item.k} {item.isOptimal && '(Peak Silhouette Score)'}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        s = {item.score.toFixed(3)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.isOptimal ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                        style={{ width: `${item.score * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation & Silhouette Formula */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Why KshetraSense Evaluates K Automatically
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In conventional approaches, the number of zones <MathView math="K" /> is arbitrarily hardcoded (usually <MathView math="K=3" />). If a field is pedologically uniform, forcing 3 zones fabricates false boundaries. If it has 4 distinct soil types, it under-segments.
                </p>
                <div className="rounded bg-slate-900 p-3 text-slate-100 font-mono text-xs space-y-1">
                  <div className="text-emerald-400 py-1">
                    <MathView math="s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}" block className="text-emerald-300" />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    <MathView math="a(i)" />: intra-cluster mean distance · <MathView math="b(i)" />: nearest-cluster distance
                  </p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  KshetraSense executes K-Means++ and FCM across all candidate counts <MathView math="K \in [2, 6]" />, computing the exact silhouette coefficient. The argmax <MathView math="K^*" /> is selected as the mathematically optimal partitioning.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: SPATIAL CONTIGUITY & SMOOTHING */}
      {activeTab === 'contiguity' && (
        <div key="contiguity" className="module-nav-transition grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Visual Comparison: Raw vs Smoothed */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                Spatial Post-Processing: Salt-and-Pepper Filter
              </h4>
              <button
                onClick={() => setShowSmoothing((prev) => !prev)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-all ${
                  showSmoothing
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {showSmoothing ? 'Contiguous Smoothed' : 'Raw K-Means Output'}
              </button>
            </div>

            {/* Simulated 8x8 Grid Map */}
            <div className="grid grid-cols-8 gap-1.5 p-3 rounded-lg bg-slate-800/80 max-w-[280px] mx-auto">
              {Array.from({ length: 64 }, (_, idx) => {
                const row = Math.floor(idx / 8);
                const col = idx % 8;

                // Base zone assignment
                let zone = 1;
                if (row >= 4 && col >= 4) zone = 3;
                else if (row >= 3 || col >= 5) zone = 2;

                // Add artificial isolated salt-and-pepper noise in raw mode
                if (!showSmoothing) {
                  if (idx === 10 || idx === 19) zone = 3; // isolated island in zone 1
                  if (idx === 42) zone = 1; // isolated island in zone 3
                }

                const color =
                  zone === 1
                    ? 'bg-emerald-500'
                    : zone === 2
                    ? 'bg-blue-500'
                    : 'bg-amber-500';

                return (
                  <div
                    key={idx}
                    className={`h-7 w-7 rounded-sm ${color} transition-all duration-300 flex items-center justify-center font-mono text-[9px] font-bold text-white shadow-sm`}
                    title={`Cell ${idx + 1} (Zone ${zone})`}
                  >
                    Z{zone}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                <span>Zone 1</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                <span>Zone 2</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                <span>Zone 3</span>
              </span>
            </div>
          </div>

          {/* Agronomic Rationale for Contiguity */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Agronomic Necessity of Contiguous Zones
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Raw spatial clustering in feature space ignores 2D spatial contiguity. A single 10m grid cell may cluster into Zone 3 while surrounded entirely by Zone 1 cells (salt-and-pepper noise).
              </p>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1 text-xs text-emerald-950">
                <span className="font-bold text-emerald-900 block">Tractor Implement Constraint:</span>
                <p className="leading-relaxed text-[11px]">
                  Variable-rate fertilizer spreaders and tractor booms cannot switch chemical application rates for a single isolated 10m square. KshetraSense applies 8-neighbor connected component labeling and merges sub-threshold components into the most similar adjacent zone profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
