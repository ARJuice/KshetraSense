import React, { useState } from 'react';
import { AlertTriangle, Sliders } from 'lucide-react';

export const InteractiveSHICalculator: React.FC = () => {
  // Input parameters state
  const [ph, setPh] = useState<number>(6.5);
  const [ec, setEc] = useState<number>(1.2);
  const [nitrogen, setNitrogen] = useState<number>(75);
  const [phosphorus, setPhosphorus] = useState<number>(30);
  const [potassium, setPotassium] = useState<number>(180);

  // Exact nonlinear scoring formulas from Phase 1 (services/zoning/app/shi.py)
  const scorePh = Math.exp(-Math.pow(ph - 6.5, 2) / (2 * Math.pow(0.8, 2)));
  const scoreEc = 1 / (1 + Math.exp(2.5 * (ec - 2.0)));
  const scoreN = 1 / (1 + Math.exp(-0.06 * (nitrogen - 60)));
  const scoreP = 1 / (1 + Math.exp(-0.12 * (phosphorus - 25)));
  const scoreK = 1 / (1 + Math.exp(-0.03 * (potassium - 150)));

  // Weights (sum to 1.0)
  const weightPh = 0.25;
  const weightEc = 0.20;
  const weightN = 0.20;
  const weightP = 0.15;
  const weightK = 0.20;

  const compositeShi = (
    weightPh * scorePh +
    weightEc * scoreEc +
    weightN * scoreN +
    weightP * scoreP +
    weightK * scoreK
  ) * 100;

  // Preset benchmarks for quick comparison
  const applyPreset = (preset: 'optimal' | 'acidic' | 'saline' | 'depleted') => {
    switch (preset) {
      case 'optimal':
        setPh(6.5);
        setEc(0.8);
        setNitrogen(95);
        setPhosphorus(40);
        setPotassium(220);
        break;
      case 'acidic':
        setPh(4.8);
        setEc(0.5);
        setNitrogen(50);
        setPhosphorus(15);
        setPotassium(110);
        break;
      case 'saline':
        setPh(8.2);
        setEc(3.8);
        setNitrogen(70);
        setPhosphorus(22);
        setPotassium(160);
        break;
      case 'depleted':
        setPh(6.2);
        setEc(0.4);
        setNitrogen(22);
        setPhosphorus(8);
        setPotassium(65);
        break;
    }
  };

  const getShiRating = (score: number) => {
    if (score >= 80) return { label: 'Optimal Fertility', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (score >= 60) return { label: 'Moderate Quality', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (score >= 40) return { label: 'Marginal Constraints', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Severe Degradation', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  };

  const rating = getShiRating(compositeShi);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Title & Presets Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-700">
              <Sliders size={13} />
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Interactive Soil Health Index (SHI) Laboratory
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulate how non-linear biological response curves map raw physical laboratory measurements into unitless indicator scores.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500">Presets:</span>
          <button
            onClick={() => applyPreset('optimal')}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Near-Neutral Loam
          </button>
          <button
            onClick={() => applyPreset('acidic')}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Acidic Laterite
          </button>
          <button
            onClick={() => applyPreset('saline')}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Saline-Alkaline
          </button>
          <button
            onClick={() => applyPreset('depleted')}
            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Nutrient-Depleted
          </button>
        </div>
      </div>

      {/* Main Grid: Controls vs Computed Index */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sliders Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* pH Slider */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Soil pH (Dimensionless)</span>
              <span className="font-mono font-bold text-emerald-700">{ph.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="3.5"
              max="9.5"
              step="0.1"
              value={ph}
              onChange={(e) => setPh(parseFloat(e.target.value))}
              className="w-full range-slider-accent h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>Strongly Acidic (3.5)</span>
              <span>Optimum Center (6.5)</span>
              <span>Strongly Alkaline (9.5)</span>
            </div>
          </div>

          {/* EC Slider */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Electrical Conductivity EC (dS/m)</span>
              <span className="font-mono font-bold text-emerald-700">{ec.toFixed(2)} dS/m</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.05"
              value={ec}
              onChange={(e) => setEc(parseFloat(e.target.value))}
              className="w-full range-slider-accent h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>Non-Saline (0.1)</span>
              <span>Inflection (2.0)</span>
              <span>Severely Saline (5.0)</span>
            </div>
          </div>

          {/* Nitrogen Slider */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Available Nitrogen N (mg/kg)</span>
              <span className="font-mono font-bold text-emerald-700">{nitrogen} mg/kg</span>
            </div>
            <input
              type="range"
              min="10"
              max="160"
              step="1"
              value={nitrogen}
              onChange={(e) => setNitrogen(parseInt(e.target.value, 10))}
              className="w-full range-slider-accent h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>Low (10)</span>
              <span>Midpoint (60)</span>
              <span>High (160)</span>
            </div>
          </div>

          {/* Phosphorus Slider */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Available Phosphorus P (mg/kg)</span>
              <span className="font-mono font-bold text-emerald-700">{phosphorus} mg/kg</span>
            </div>
            <input
              type="range"
              min="5"
              max="70"
              step="1"
              value={phosphorus}
              onChange={(e) => setPhosphorus(parseInt(e.target.value, 10))}
              className="w-full range-slider-accent h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>Deficient (5)</span>
              <span>Midpoint (25)</span>
              <span>Sufficient (70)</span>
            </div>
          </div>

          {/* Potassium Slider */}
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Available Potassium K (mg/kg)</span>
              <span className="font-mono font-bold text-emerald-700">{potassium} mg/kg</span>
            </div>
            <input
              type="range"
              min="30"
              max="350"
              step="5"
              value={potassium}
              onChange={(e) => setPotassium(parseInt(e.target.value, 10))}
              className="w-full range-slider-accent h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>Low (30)</span>
              <span>Midpoint (150)</span>
              <span>High (350)</span>
            </div>
          </div>
        </div>

        {/* Results & Sub-Scores Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Composite SHI Badge Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Composite SHI Score
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${rating.color}`}>
                {rating.label}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-extrabold text-emerald-400">
                {compositeShi.toFixed(1)}
              </span>
              <span className="font-mono text-sm text-slate-400">/ 100.0</span>
            </div>

            {/* Score Distribution Bar */}
            <div className="mt-4 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                style={{ width: `${Math.min(compositeShi, 100)}%` }}
              />
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-300">
              Weighted average of 5 non-linear biological response curves. Values represent a mathematical screening index, not a USDA/NRCS certified assessment.
            </p>
          </div>

          {/* Individual Factor Breakdown Table */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Factor Sub-Score Breakdown (S ∈ [0, 1])
            </h4>

            <div className="space-y-2 text-xs">
              {/* pH Subscore */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">S_pH</span>
                  <span className="text-[10px] text-slate-600 ml-1.5">(Weight: 25%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${scorePh * 100}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 w-10 text-right">
                    {scorePh.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* EC Subscore */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">S_EC</span>
                  <span className="text-[10px] text-slate-600 ml-1.5">(Weight: 20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${scoreEc * 100}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 w-10 text-right">
                    {scoreEc.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Nitrogen Subscore */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">S_N</span>
                  <span className="text-[10px] text-slate-600 ml-1.5">(Weight: 20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${scoreN * 100}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 w-10 text-right">
                    {scoreN.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Phosphorus Subscore */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">S_P</span>
                  <span className="text-[10px] text-slate-600 ml-1.5">(Weight: 15%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${scoreP * 100}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 w-10 text-right">
                    {scoreP.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Potassium Subscore */}
              <div className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800">S_K</span>
                  <span className="text-[10px] text-slate-600 ml-1.5">(Weight: 20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${scoreK * 100}%` }} />
                  </div>
                  <span className="font-mono font-bold text-slate-900 w-10 text-right">
                    {scoreK.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Scientific Boundary Note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 flex items-start gap-2.5">
        <AlertTriangle size={15} className="text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 space-y-1">
          <p className="font-bold">Architectural Decoupling Rationale:</p>
          <p className="leading-relaxed">
            The composite SHI is strictly an exploratory screening tool. It is <strong>NEVER used as a clustering feature</strong> in spatial zoning. Clustering uses the multivariate z-scored raw profile <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-amber-900">[z_pH, z_EC, z_N, z_P, z_K]</code> directly. This prevents collapsing multi-dimensional soil chemistry into a scalar index that would obscure orthogonal agronomic requirements.
          </p>
        </div>
      </div>
    </div>
  );
};
