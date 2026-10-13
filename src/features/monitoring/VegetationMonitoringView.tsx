import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Droplets,
  LineChart,
  RefreshCw,
  Satellite,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { CircularAoiCanvas } from './CircularAoiCanvas';
import {
  checkCropSightHealth,
  getCropSightCropInfo,
  getVerifiedCropSightBenchmark,
  runCropSightAnalysis,
} from '../../services/monitoringApi';
import type {
  CircularAreaOfInterest,
  CropSightAnalysisResult,
} from './types';

const inputClassName =
  'w-full rounded-md border border-line-border bg-parchment-50 px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-sage-600 focus:ring-2 focus:ring-sage-200';

const FieldLabel: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({
  label,
  help,
  children,
}) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-ink-muted">{label}</span>
    {children}
    {help && <span className="mt-0.5 block text-[10px] leading-3 text-ink-subtle">{help}</span>}
  </label>
);

const StatusPill: React.FC<{ children: React.ReactNode; tone: 'amber' | 'sage' | 'slate' | 'clay' }> = ({
  children,
  tone,
}) => {
  const tones = {
    amber: 'border-amberGold/30 bg-amberGold-subtle text-amberGold-dark',
    sage: 'border-sage-300 bg-sage-100 text-sage-800',
    slate: 'border-line-border bg-parchment-100 text-ink-muted',
    clay: 'border-clay/30 bg-clay-subtle text-clay-dark',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const VegetationMonitoringView: React.FC = () => {
  const [aoi, setAoi] = useState<CircularAreaOfInterest>({
    latitude: 30.9015,
    longitude: 75.8524,
    radiusMeters: 250,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  });

  const [clusteringMethod, setClusteringMethod] = useState<'K-Means' | 'DBSCAN'>('K-Means');
  const [numZones, setNumZones] = useState<number>(3);
  const [cropType, setCropType] = useState<string>('Wheat');
  const [cropGrowthStage, setCropGrowthStage] = useState<string>('Vegetative');
  const [execMode, setExecMode] = useState<'benchmark' | 'live'>('benchmark');

  const [cropRef, setCropRef] = useState<{ ndviRange: string; optimalRainfall: number }>({
    ndviRange: '0.4-0.9',
    optimalRainfall: 80,
  });

  const [serviceHealth, setServiceHealth] = useState<{ checked: boolean; online: boolean; message: string }>({
    checked: false,
    online: false,
    message: 'Checking...',
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CropSightAnalysisResult | null>(null);

  // Check health on mount
  useEffect(() => {
    checkCropSightHealth().then((h) => {
      setServiceHealth({ checked: true, online: h.online, message: h.message });
    });
  }, []);

  // Update crop ref info
  useEffect(() => {
    getCropSightCropInfo(cropType).then((info) => {
      setCropRef(info);
    });
  }, [cropType]);

  // Load benchmark automatically on initial view
  useEffect(() => {
    if (!analysisResult) {
      setAnalysisResult(getVerifiedCropSightBenchmark(aoi, numZones, clusteringMethod));
    }
  }, []);

  // Preset Date Windows
  const applyDatePreset = (preset: 'rabi' | 'kharif' | 'recent90') => {
    if (preset === 'rabi') {
      setAoi((prev) => ({ ...prev, startDate: '2025-11-01', endDate: '2026-03-31' }));
    } else if (preset === 'kharif') {
      setAoi((prev) => ({ ...prev, startDate: '2025-06-01', endDate: '2025-10-31' }));
    } else {
      const today = new Date();
      const past = new Date();
      past.setDate(today.getDate() - 90);
      setAoi((prev) => ({
        ...prev,
        startDate: past.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
      }));
    }
  };

  // Run Analysis
  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    if (execMode === 'benchmark') {
      setTimeout(() => {
        setAnalysisResult(getVerifiedCropSightBenchmark(aoi, numZones, clusteringMethod));
        setLoading(false);
      }, 400);
      return;
    }

    try {
      const res = await runCropSightAnalysis({
        aoi,
        clusteringMethod,
        numZones,
        cropType,
        cropGrowthStage,
      });
      setAnalysisResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Vegetation analysis request failed.');
      setAnalysisResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Header */}
      <section className="flex flex-col justify-between gap-3 border-b border-line-border pb-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Satellite size={19} className="text-sage-700" />
            <h2 className="font-serif text-lg font-bold text-ink">Vegetation Monitoring (CropSight Integration)</h2>
            <StatusPill tone={analysisResult?.isBenchmark ? 'amber' : 'sage'}>
              {analysisResult?.isBenchmark ? 'Benchmark Mode' : 'Live Mode'}
            </StatusPill>
          </div>
          <p className="max-w-3xl text-xs leading-5 text-ink-muted">
            Independent sub-application integration based on CropSight. Runs Sentinel-2 / Google Earth Engine NDVI analysis over a circular Area of Interest (AOI). Does not consume or alter Soil Zoning or Crop Fit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-muted">Execution Mode:</span>
          <div className="flex rounded-md border border-line-border bg-parchment-50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setExecMode('benchmark')}
              className={`rounded px-2.5 py-1 transition ${
                execMode === 'benchmark' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Verified Benchmark
            </button>
            <button
              type="button"
              onClick={() => setExecMode('live')}
              className={`rounded px-2.5 py-1 transition ${
                execMode === 'live' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Live Earth Engine
            </button>
          </div>
        </div>
      </section>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        {/* Left Column: AOI Parameters & Input Form */}
        <div className="space-y-5">
          <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-base font-bold text-ink">Area of Interest & Parameters (FM-05)</h3>
                <p className="text-xs text-ink-muted">
                  Circular AOI buffer around coordinate center. Independent date window and clustering selection.
                </p>
              </div>
              <StatusPill tone={serviceHealth.online ? 'sage' : 'slate'}>
                {serviceHealth.online ? 'Sub-App Online' : 'Sub-App Standby'}
              </StatusPill>
            </div>

            <form onSubmit={handleRunAnalysis} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FieldLabel label="Centre Latitude *" help="-90 to 90">
                  <input
                    required
                    type="number"
                    step="any"
                    value={aoi.latitude ?? ''}
                    onChange={(e) => setAoi({ ...aoi, latitude: e.target.value === '' ? null : Number(e.target.value) })}
                    className={inputClassName}
                    placeholder="30.9015"
                  />
                </FieldLabel>
                <FieldLabel label="Centre Longitude *" help="-180 to 180">
                  <input
                    required
                    type="number"
                    step="any"
                    value={aoi.longitude ?? ''}
                    onChange={(e) => setAoi({ ...aoi, longitude: e.target.value === '' ? null : Number(e.target.value) })}
                    className={inputClassName}
                    placeholder="75.8524"
                  />
                </FieldLabel>
                <FieldLabel label="Circular Radius *" help="10–10,000 metres">
                  <input
                    required
                    type="number"
                    min="10"
                    max="10000"
                    value={aoi.radiusMeters}
                    onChange={(e) => setAoi({ ...aoi, radiusMeters: Number(e.target.value) })}
                    className={inputClassName}
                  />
                </FieldLabel>
              </div>

              {/* Date Presets & Inputs */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-ink-muted">Date Observation Window</span>
                  <div className="flex gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => applyDatePreset('rabi')}
                      className="rounded border border-line-border bg-parchment-100 px-2 py-0.5 font-medium text-ink-muted hover:bg-parchment-200"
                    >
                      Rabi Season (Nov–Mar)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('kharif')}
                      className="rounded border border-line-border bg-parchment-100 px-2 py-0.5 font-medium text-ink-muted hover:bg-parchment-200"
                    >
                      Kharif Season (Jun–Oct)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDatePreset('recent90')}
                      className="rounded border border-line-border bg-parchment-100 px-2 py-0.5 font-medium text-ink-muted hover:bg-parchment-200"
                    >
                      Last 90 Days
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldLabel label="Start Date *" help="Inclusive">
                    <input
                      required
                      type="date"
                      value={aoi.startDate}
                      onChange={(e) => setAoi({ ...aoi, startDate: e.target.value })}
                      className={inputClassName}
                    />
                  </FieldLabel>
                  <FieldLabel label="End Date *" help="Inclusive">
                    <input
                      required
                      type="date"
                      value={aoi.endDate}
                      onChange={(e) => setAoi({ ...aoi, endDate: e.target.value })}
                      className={inputClassName}
                    />
                  </FieldLabel>
                </div>
              </div>

              {/* Clustering Algorithm Selection (FM-06) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-[11px] font-medium text-ink-muted">Clustering Method (FM-06)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClusteringMethod('K-Means')}
                      className={`rounded-md border p-2 text-left text-xs transition ${
                        clusteringMethod === 'K-Means'
                          ? 'border-sage-600 bg-sage-50 text-sage-900 font-semibold'
                          : 'border-line-border bg-parchment-100 text-ink-muted'
                      }`}
                    >
                      K-Means
                      <span className="mt-0.5 block text-[10px] font-normal text-ink-subtle">Weka clusterer</span>
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Mismatched method in upstream CropSight: upstream implementation runs K-Means under DBSCAN label; disabled for reliable analysis per ADR 0004 & FM-06"
                      className="cursor-not-allowed rounded-md border border-line-border bg-parchment-200/50 p-2 text-left text-xs opacity-60 text-ink-faint"
                    >
                      DBSCAN ⚠️
                      <span className="mt-0.5 block text-[9px] font-normal text-clay-dark">Mismatched upstream</span>
                    </button>
                  </div>
                </div>

                <FieldLabel label={`Number of Management Zones: ${numZones}`} help="2 to 7 zones">
                  <input
                    type="range"
                    min="2"
                    max="7"
                    value={numZones}
                    onChange={(e) => setNumZones(Number(e.target.value))}
                    className="mt-2 w-full accent-sage-700"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-ink-subtle">
                    <span>2 zones</span>
                    <span>3 (standard)</span>
                    <span>7 zones</span>
                  </div>
                </FieldLabel>
              </div>

              {/* Crop & Growth Stage Context */}
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-line-subtle bg-parchment-100/60 p-3 sm:grid-cols-2">
                <FieldLabel label="Crop Type" help={`Typical NDVI: ${cropRef.ndviRange}`}>
                  <select
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="Wheat">Wheat</option>
                    <option value="Rice">Rice</option>
                    <option value="Corn/Maize">Corn / Maize</option>
                    <option value="Soybeans">Soybeans</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Sugarcane">Sugarcane</option>
                    <option value="Other">Other</option>
                  </select>
                </FieldLabel>

                <FieldLabel label="Growth Stage" help={`Optimal rain: ~${cropRef.optimalRainfall} mm/mo`}>
                  <select
                    value={cropGrowthStage}
                    onChange={(e) => setCropGrowthStage(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="Early/Emergence">Early / Emergence</option>
                    <option value="Vegetative">Vegetative</option>
                    <option value="Reproductive/Flowering">Reproductive / Flowering</option>
                    <option value="Maturity">Maturity / Ripening</option>
                  </select>
                </FieldLabel>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
                <div className="text-[11px] text-ink-subtle">
                  {execMode === 'benchmark' ? (
                    <span>Using verified offline Sentinel-2 scene benchmark.</span>
                  ) : (
                    <span>Live request will invoke configured Earth Engine sub-application.</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="button button--primary"
                >
                  {loading ? <RefreshCw size={13} className="spin" /> : <Satellite size={13} />}
                  {execMode === 'benchmark' ? 'Load Benchmark Run' : 'Analyze Field AOI'}
                </button>
              </div>
            </form>
          </section>

          {/* Honest Error Display (FM-07) */}
          {errorMessage && (
            <section className="rounded-xl border border-clay/30 bg-clay-subtle p-4 text-xs text-clay-dark shadow-sm">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="mt-0.5 shrink-0 text-clay-dark" />
                <div className="space-y-1">
                  <h4 className="font-bold text-ink">Vegetation Analysis Error (FM-07)</h4>
                  <p className="leading-5">{errorMessage}</p>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    No fabricated or canned satellite results are presented as current when live queries fail. Toggle to "Verified Benchmark" mode to inspect validated baseline runs.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Time Series & Rainfall Charts */}
          {analysisResult && (
            <section className="space-y-4 rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle pb-2">
                <div className="flex items-center gap-2">
                  <LineChart size={17} className="text-sage-700" />
                  <h3 className="font-serif text-base font-bold text-ink">NDVI Multi-Temporal Trajectory</h3>
                </div>
                <StatusPill tone="sage">
                  Trend: {analysisResult.ndviTimeSeries.trend.toUpperCase()}
                </StatusPill>
              </div>

              {/* Time Series SVG Graph */}
              <div className="space-y-2">
                <div className="h-44 w-full">
                  <svg className="h-full w-full overflow-visible" viewBox="0 0 500 130">
                    <line x1="30" y1="20" x2="480" y2="20" stroke="#d5ded3" strokeDasharray="3 3" />
                    <line x1="30" y1="65" x2="480" y2="65" stroke="#d5ded3" strokeDasharray="3 3" />
                    <line x1="30" y1="110" x2="480" y2="110" stroke="#d5ded3" />

                    {(() => {
                      const dates = analysisResult.ndviTimeSeries.dates || [];
                      const vals = analysisResult.ndviTimeSeries.ndviValues || [];
                      if (dates.length === 0 || vals.length === 0) return null;

                      const points = vals.map((val, idx) => {
                        const x = 40 + (idx / Math.max(1, dates.length - 1)) * 430;
                        const y = Math.max(15, Math.min(115, 110 - (val / 1.0) * 90));
                        return { x, y, val, date: dates[idx] ?? '' };
                      });

                      const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                      return (
                        <g>
                          <path d={pathD} fill="none" stroke="#2c5741" strokeWidth="2.5" strokeLinecap="round" />
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="4.5" fill="#f5f7f3" stroke="#2c5741" strokeWidth="2" />
                              <text x={p.x} y={p.y - 7} textAnchor="middle" className="font-mono text-[8px] font-bold fill-sage-900">
                                {p.val.toFixed(2)}
                              </text>
                              <text x={p.x} y="124" textAnchor="middle" className="font-mono text-[7.5px] fill-ink-subtle">
                                {p.date ? p.date.slice(5) : ''}
                              </text>
                            </g>
                          ))}
                        </g>
                      );
                    })()}
                  </svg>
                </div>
                <div className="flex justify-between text-[10px] text-ink-subtle">
                  <span>Start: {analysisResult.ndviTimeSeries.dates[0] ?? '—'}</span>
                  <span>Mean NDVI: {analysisResult.ndviTimeSeries.meanNdvi.toFixed(3)}</span>
                  <span>End: {analysisResult.ndviTimeSeries.dates[analysisResult.ndviTimeSeries.dates.length - 1] ?? '—'}</span>
                </div>
              </div>

              {/* CHIRPS Daily Rainfall Bars */}
              {analysisResult.rainfallData && (
                <div className="border-t border-line-subtle pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold text-ink">
                      <Droplets size={14} className="text-blue-600" /> Historical Precipitation (CHIRPS Daily)
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      Total: {analysisResult.rainfallData.totalRainfall.toFixed(1)} mm · Max: {analysisResult.rainfallData.maxDailyRainfall.toFixed(1)} mm
                    </span>
                  </div>

                  <div className="flex h-14 items-end gap-1.5 rounded-lg border border-line-subtle bg-blue-50/40 p-2">
                    {analysisResult.rainfallData.rainfallValues.map((rf, idx) => {
                      const maxR = analysisResult.rainfallData?.maxDailyRainfall || 15;
                      const heightPct = Math.max(8, (rf / maxR) * 100);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full rounded-t bg-blue-500/70 hover:bg-blue-600 transition"
                            style={{ height: `${heightPct}%` }}
                            title={`${analysisResult.rainfallData?.dates[idx]}: ${rf.toFixed(1)} mm`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right Column: Circular Aperture Map & Scouting Disclosures */}
        <div className="space-y-5">
          {analysisResult ? (
            <>
              {/* Circular AOI Raster Visualizer */}
              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
                <CircularAoiCanvas result={analysisResult} />

                {/* Statistics Cards */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="rounded-lg border border-line-subtle bg-parchment-100 p-2">
                    <span className="block font-mono text-sm font-bold text-ink">
                      {analysisResult.ndviStats.mean.toFixed(3)}
                    </span>
                    <span className="text-ink-subtle">Mean NDVI</span>
                  </div>
                  <div className="rounded-lg border border-line-subtle bg-parchment-100 p-2">
                    <span className="block font-mono text-sm font-bold text-ink">
                      {analysisResult.ndviStats.min.toFixed(2)} – {analysisResult.ndviStats.max.toFixed(2)}
                    </span>
                    <span className="text-ink-subtle">NDVI Range</span>
                  </div>
                  <div className="rounded-lg border border-line-subtle bg-parchment-100 p-2">
                    <span className="block font-mono text-sm font-bold text-ink">
                      {analysisResult.zonesIdentified}
                    </span>
                    <span className="text-ink-subtle">Zones Identified</span>
                  </div>
                </div>
              </section>

              {/* Management Zones Breakdown */}
              <section className="rounded-xl border border-line-border bg-parchment-50 p-4 shadow-instrument">
                <h4 className="mb-2 font-serif text-sm font-bold text-ink">Zonal Partition Breakdown</h4>
                <div className="space-y-2">
                  {analysisResult.zonalStats.map((z) => (
                    <div
                      key={z.zone}
                      className="flex items-center justify-between rounded-lg border border-line-subtle bg-parchment-100/60 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-between rounded-full bg-sage-800 text-center font-mono text-[10px] font-bold text-parchment-50 flex items-center justify-center">
                          {z.zone}
                        </span>
                        <div>
                          <span className="font-semibold text-ink">Zone {z.zone}</span>
                          <span className="ml-2 font-mono text-[11px] text-ink-muted">
                            NDVI {z.meanNdvi.toFixed(3)} · {z.areaPercentage}% area
                          </span>
                        </div>
                      </div>
                      <StatusPill tone={z.scoutingPriority === 'High' ? 'clay' : 'sage'}>
                        {z.scoutingPriority === 'High' ? 'Scout First' : 'Baseline'}
                      </StatusPill>
                    </div>
                  ))}
                </div>
              </section>

              {/* Scouting Guidance & Strict Disclosures (FM-08) */}
              <section className="space-y-3 rounded-xl border border-line-border bg-parchment-50 p-4 shadow-instrument text-xs leading-5">
                <div className="flex items-start gap-2 text-ink">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-sage-700" />
                  <div>
                    <h4 className="font-bold">Scouting Priority Guidance</h4>
                    <p className="text-ink-muted">
                      Relative low-NDVI patches indicate lower canopy vigor within this date window. Inspect these areas on foot to assess soil moisture, root zone compaction, nutrient stress, or weed emergence.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-[11px] text-amberGold-dark space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} /> Strict Evidence Limitations (FM-08)
                  </div>
                  <p>
                    Satellite NDVI measures optical spectral canopy reflectance only. It does <strong>NOT</strong> diagnose why plants differ, compute irrigation quantities, calculate variable-rate fertilizer doses, or predict crop yield.
                  </p>
                  <p>
                    Upstream recommendations from CropSight are heuristic rules, not agronomic prescriptions.
                  </p>
                </div>

                <div className="border-t border-line-subtle pt-2 text-[10px] text-ink-subtle space-y-0.5">
                  <p><strong>Imagery Source:</strong> {analysisResult.source}</p>
                  <p><strong>Provider:</strong> {analysisResult.provider} · Resolution: 10m Sentinel-2 bands B04/B08</p>
                  {analysisResult.benchmarkSceneId && (
                    <p><strong>Benchmark Scene ID:</strong> {analysisResult.benchmarkSceneId}</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-line-border p-8 text-center text-xs text-ink-subtle">
              No vegetation analysis loaded. Click "Load Benchmark Run" or "Analyze Field AOI" to inspect satellite NDVI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
