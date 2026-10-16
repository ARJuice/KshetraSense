import React, { useState } from 'react';
import { MathView } from '../../../components/ui/MathView';

interface CanopyPreset {
  name: string;
  redReflectance: number; // Band 4 (665nm) in [0, 1]
  nirReflectance: number; // Band 8 (842nm) in [0, 1]
  description: string;
  expectedNdvi: number;
}

const PRESETS: CanopyPreset[] = [
  {
    name: 'Healthy Dense Canopy',
    redReflectance: 0.06,
    nirReflectance: 0.58,
    description: 'High chlorophyll-a/b absorption at 665nm + intense spongy mesophyll scattering at 842nm.',
    expectedNdvi: 0.813,
  },
  {
    name: 'Moderate Vegetative Vigor',
    redReflectance: 0.12,
    nirReflectance: 0.38,
    description: 'Standard mid-season crop canopy with partial ground cover.',
    expectedNdvi: 0.52,
  },
  {
    name: 'Stressed / Senescent Canopy',
    redReflectance: 0.20,
    nirReflectance: 0.28,
    description: 'Chlorophyll breakdown increases red reflectance; cellular collapse decreases NIR scattering.',
    expectedNdvi: 0.167,
  },
  {
    name: 'Bare Soil / Fallow Field',
    redReflectance: 0.26,
    nirReflectance: 0.28,
    description: 'Nearly flat spectral reflectance across visible and near-infrared bands.',
    expectedNdvi: 0.037,
  },
  {
    name: 'Open Surface Water',
    redReflectance: 0.12,
    nirReflectance: 0.03,
    description: 'Water strongly absorbs near-infrared electromagnetic radiation.',
    expectedNdvi: -0.60,
  },
];

export const RemoteSensingPipelineVisualizer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reflectance' | 'qa60' | 'soilgrids'>('reflectance');
  const [red, setRed] = useState<number>(0.06);
  const [nir, setNir] = useState<number>(0.58);

  // Compute live NDVI
  const denom = nir + red;
  const ndvi = denom === 0 ? 0 : (nir - red) / denom;

  const applyPreset = (preset: CanopyPreset) => {
    setRed(preset.redReflectance);
    setNir(preset.nirReflectance);
  };

  const getNdviColor = (val: number) => {
    if (val > 0.6) return { bg: 'bg-emerald-600', text: 'text-emerald-700', label: 'Dense Canopy Vigor' };
    if (val > 0.35) return { bg: 'bg-emerald-400', text: 'text-emerald-600', label: 'Moderate Canopy' };
    if (val > 0.15) return { bg: 'bg-amber-400', text: 'text-amber-700', label: 'Sparse / Stressed' };
    if (val >= 0.0) return { bg: 'bg-stone-400', text: 'text-stone-700', label: 'Bare Soil / Non-Vegetated' };
    return { bg: 'bg-blue-500', text: 'text-blue-700', label: 'Water / Cloud Shadow' };
  };

  const ndviStatus = getNdviColor(ndvi);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
              RS
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Copernicus Sentinel-2 &amp; ISRIC SoilGrids Architecture Simulator
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Multispectral physics, QA60 cloud bitmask filtering, and regional 250m soil covariates.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('reflectance')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'reflectance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Multispectral NDVI Physics
          </button>
          <button
            onClick={() => setActiveTab('qa60')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'qa60' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. QA60 Cloud Masking
          </button>
          <button
            onClick={() => setActiveTab('soilgrids')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'soilgrids' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. 250m Regional Covariates
          </button>
        </div>
      </div>

      {/* TAB 1: MULTISPECTRAL REFLECTANCE PHYSICS & NDVI */}
      {activeTab === 'reflectance' && (
        <div key="reflectance" className="module-nav-transition space-y-6">
          {/* Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Canopy Presets:</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 active:scale-95 transition-all duration-150 hover:bg-slate-100 hover:border-slate-300"
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Sliders & Spectral Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Band 4: Red Slider */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    <span>Sentinel-2 Band 4 (Red, λ ≈ 665 nm)</span>
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    ρ_Red = {(red * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.60"
                  step="0.01"
                  value={red}
                  onChange={(e) => setRed(parseFloat(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  Chlorophyll pigments (Chl-a and Chl-b) absorb red photon wavelengths for photosystem reaction centers.
                </p>
              </div>

              {/* Band 8: NIR Slider */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    <span>Sentinel-2 Band 8 (NIR, λ ≈ 842 nm)</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    ρ_NIR = {(nir * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.80"
                  step="0.01"
                  value={nir}
                  onChange={(e) => setNir(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  Spongy mesophyll cell walls strongly scatter near-infrared light through multiple internal air-cell refractions.
                </p>
              </div>

              {/* Visual Spectral Bar */}
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Canopy Spectral Response Profile</span>
                  <span className="text-emerald-400 font-bold">Contrast Δ = {(nir - red).toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end h-28 pt-2">
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="font-mono text-xs font-bold text-rose-400">{(red * 100).toFixed(0)}%</span>
                    <div
                      className="w-full bg-rose-500/80 rounded-t transition-all duration-200"
                      style={{ height: `${Math.max(5, red * 100 * 1.5)}%` }}
                    />
                    <span className="text-[10px] font-mono text-slate-400">B4 Red (665nm)</span>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="font-mono text-xs font-bold text-emerald-400">{(nir * 100).toFixed(0)}%</span>
                    <div
                      className="w-full bg-emerald-500/80 rounded-t transition-all duration-200"
                      style={{ height: `${Math.max(5, nir * 100 * 1.5)}%` }}
                    />
                    <span className="text-[10px] font-mono text-slate-400">B8 NIR (842nm)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculated Output & Indicator (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Computed Normalized Index
                </span>

                <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">NDVI Value</span>
                    <span className={`text-[11px] font-semibold ${ndviStatus.text}`}>
                      {ndviStatus.label}
                    </span>
                  </div>
                  <span className="font-mono text-3xl font-black text-slate-900">
                    {ndvi.toFixed(3)}
                  </span>
                </div>

                {/* Formula breakdown */}
                <div className="rounded-lg bg-slate-900 p-3 text-slate-100 font-mono text-xs space-y-1">
                  <div className="py-1">
                    <MathView math="\text{NDVI} = \frac{\rho_{\text{B08}} - \rho_{\text{B04}}}{\rho_{\text{B08}} + \rho_{\text{B04}}}" block className="text-emerald-300" />
                  </div>
                  <p className="text-slate-300 text-[11px] text-center">
                    {`= (${nir.toFixed(2)} - ${red.toFixed(2)}) / (${nir.toFixed(2)} + ${red.toFixed(2)})`}
                  </p>
                  <p className="text-emerald-300 font-bold text-[11px] text-center">
                    {`= ${(nir - red).toFixed(3)} / ${denom.toFixed(3)} = ${ndvi.toFixed(3)}`}
                  </p>
                </div>

                {/* Canopy False-Color Indicator Swatch */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg shadow-inner shrink-0 ${ndviStatus.bg}`}
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">Canopy False-Color Swatch</span>
                    <p className="text-[11px] text-slate-500">
                      Standard vegetation indices normalize values between -1.0 and +1.0.
                    </p>
                  </div>
                </div>

                <div className="rounded border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] leading-relaxed text-amber-950">
                  <strong className="text-amber-900 font-bold block mb-0.5">Scientific Decoupling Constraint:</strong>
                  CropSight returns aggregate NDVI statistics across a circular buffer AOI. It does not return pixel-level rasters, zone polygons, or variable-rate chemical prescriptions.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QA60 CLOUD MASKING */}
      {activeTab === 'qa60' && (
        <div key="qa60" className="module-nav-transition grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                Copernicus QA60 Quality Assessment Bitmask
              </span>
              <span className="rounded bg-blue-500/20 text-blue-300 px-2 py-0.5 text-[10px] font-mono border border-blue-400/30">
                16-Bit Flag
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 font-mono">Bit 10: Opaque Cloud Mask</span>
                  <span className="rounded bg-rose-500/20 text-rose-300 px-1.5 py-0.2 text-[10px] font-mono">
                    1 = Cloud Detected
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Flagged when dense cloud albedo obscures ground canopy reflectance. Masked pixels are dropped immediately from the NDVI calculation.
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 font-mono">Bit 11: Cirrus Cloud Mask</span>
                  <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[10px] font-mono">
                    1 = Cirrus Present
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  High-altitude ice crystal clouds distort near-infrared scattering without blocking all optical light. Dropping cirrus pixels prevents spurious sudden dips in NDVI time series.
                </p>
              </div>
            </div>

            <div className="rounded bg-slate-800 p-3 text-xs font-mono text-emerald-400 border border-slate-700">
              {'cloud_mask = (QA60 & (1 << 10) == 0) & (QA60 & (1 << 11) == 0)'}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Why Automated Cloud Screening is Essential
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Optical satellite sensors cannot penetrate monsoonal cloud cover over Karnataka. Without bitmask QA60 filtering, a cloudy scene produces near-zero or negative NDVI values.
              </p>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-1 text-xs text-emerald-950">
                <span className="font-bold text-emerald-900 block">False Diagnosis Prevention:</span>
                <p className="leading-relaxed text-[11px]">
                  Unfiltered clouds mimic catastrophic crop death or sudden drought. KshetraSense strictly screens out contaminated scenes, presenting a sparse, validated chronological trajectory rather than interpolated false signals.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 250M COVARIATE FIREWALL */}
      {activeTab === 'soilgrids' && (
        <div key="soilgrids" className="module-nav-transition grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Spatial Resolution Comparison */}
          <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 text-white space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
              Spatial Resolution Scale Mismatch: 10m vs 250m
            </h4>

            {/* Visual comparison box */}
            <div className="relative border-2 border-amber-500 rounded-lg p-3 bg-amber-950/20 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-300 font-mono">
                <span>1 SoilGrids 2.0 Pixel = 250 m × 250 m (6.25 ha)</span>
                <span className="text-amber-400 font-bold">1 Pixel</span>
              </div>

              {/* Grid representation */}
              <div className="rounded bg-slate-800 p-2 border border-slate-700">
                <div className="grid grid-cols-5 gap-1 text-center font-mono text-[9px] text-slate-400">
                  <div className="border border-emerald-500/80 bg-emerald-950/60 p-1 text-emerald-300 rounded">
                    10m Cell
                  </div>
                  <div className="border border-slate-700 p-1">10m</div>
                  <div className="border border-slate-700 p-1">10m</div>
                  <div className="border border-slate-700 p-1">10m</div>
                  <div className="border border-slate-700 p-1">10m ...</div>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-2 font-mono">
                  Contains 25 × 25 = 625 internal 10-meter farm cells
                </p>
              </div>
            </div>

            <div className="rounded border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200 space-y-1">
              <strong className="text-amber-400 font-bold block">Resolution Boundary Principle:</strong>
              SoilGrids 2.0 layers provide regional soil reference context. They are retained at their native 250m resolution rather than artificially downscaled into localized 10m farm rasters.
            </div>
          </div>

          {/* Agronomic & Mathematical Justification */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                The Nyquist-Shannon Sampling Constraint
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                A typical smallholder farm in Karnataka spans 1 to 3 hectares. An entire 2-hectare parcel fits completely inside <em>one third</em> of a single 250m SoilGrids pixel.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-1 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block">Why Bilinear Downscaling is Fraudulent:</span>
                <p className="leading-relaxed text-[11px]">
                  Interpolating a 250m coarse covariate to 10m does not create 10m information—it creates artificial gradients with zero localized predictive power. SoilGrids provides regional quantiles ($Q_{0.05}, Q_{0.50}, Q_{0.95}$); physical lab cores provide the true field-scale truth.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
