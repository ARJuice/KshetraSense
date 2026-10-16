import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, Satellite, ShieldAlert } from 'lucide-react';
import { checkCropSightHealth, runCropSightAnalysis } from '../../services/monitoringApi';
import type { CircularAreaOfInterest, CropSightAnalysisResult } from './types';

const inputClassName = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
const panel = 'rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm';

const FieldLabel: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <label className="block space-y-1">
    <span className="block text-[11px] font-semibold text-slate-700">{label}</span>
    {children}
    {help && <span className="block text-[10px] leading-tight text-slate-400">{help}</span>}
  </label>
);

function localDateValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export const VegetationMonitoringView: React.FC = () => {
  const [aoi, setAoi] = useState<CircularAreaOfInterest>({
    latitude: null,
    longitude: null,
    radiusMeters: 250,
    startDate: '',
    endDate: '',
  });
  const [numZones, setNumZones] = useState(3);
  const [cropType, setCropType] = useState('Other');
  const [serviceHealth, setServiceHealth] = useState<{ checked: boolean; online: boolean; message: string }>({
    checked: false,
    online: false,
    message: 'Checking CropSight API…',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CropSightAnalysisResult | null>(null);

  const refreshHealth = async () => {
    const health = await checkCropSightHealth();
    setServiceHealth({ checked: true, online: health.online, message: health.message });
  };

  useEffect(() => { void refreshHealth(); }, []);

  const applyDatePreset = (preset: 'rabi' | 'kharif' | 'recent90') => {
    const today = new Date();
    if (preset === 'rabi') setAoi((current) => ({ ...current, startDate: '2025-11-01', endDate: '2026-03-31' }));
    else if (preset === 'kharif') setAoi((current) => ({ ...current, startDate: '2025-06-01', endDate: '2025-10-31' }));
    else {
      const past = new Date(today);
      past.setDate(today.getDate() - 90);
      setAoi((current) => ({ ...current, startDate: localDateValue(past), endDate: localDateValue(today) }));
    }
    setAnalysisResult(null);
  };

  const handleRunAnalysis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setAnalysisResult(null);
    setLoading(true);
    try {
      const result = await runCropSightAnalysis({
        aoi,
        clusteringMethod: 'K-Means',
        numZones,
        cropType,
        cropGrowthStage: 'Unspecified',
      });
      setAnalysisResult(result);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Vegetation analysis request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Satellite size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold tracking-tight text-slate-900">Vegetation Monitoring · CropSight</h2>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${serviceHealth.online ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              {serviceHealth.online ? 'API reachable' : serviceHealth.checked ? 'API unavailable' : 'Checking'}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            Independent circular-AOI Sentinel-2 analysis through the pinned CropSight service. It does not read or change Soil Zoning, Crop Fit, Soil Investigation, or the historical telemetry replay.
          </p>
        </div>
        <button type="button" onClick={() => void refreshHealth()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900">
          <RefreshCw size={12} /> Check API
        </button>
      </section>

      {!serviceHealth.online && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900">
          CropSight’s API is not reachable at the configured endpoint. Google Earth Engine project/authentication setup is intentionally deferred; no sample satellite result is substituted.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section className={panel}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold tracking-tight text-slate-900">Analysis Inputs</h3>
              <p className="mt-0.5 text-xs text-slate-500">Define the circular boundary and time window that CropSight will query.</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-slate-600">
              User Defined AOI
            </span>
          </div>

          <form onSubmit={handleRunAnalysis} className="space-y-4">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <FieldLabel label="Centre Latitude · Degrees" help="WGS84, −90 to 90">
                <input required type="number" min="-90" max="90" step="any" value={aoi.latitude ?? ''} onChange={(event) => { setAoi({ ...aoi, latitude: event.target.value === '' ? null : Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} placeholder="e.g. 12.9716" />
              </FieldLabel>
              <FieldLabel label="Centre Longitude · Degrees" help="WGS84, −180 to 180">
                <input required type="number" min="-180" max="180" step="any" value={aoi.longitude ?? ''} onChange={(event) => { setAoi({ ...aoi, longitude: event.target.value === '' ? null : Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} placeholder="e.g. 77.5946" />
              </FieldLabel>
              <FieldLabel label="Circle Radius · Metres" help="10 to 10,000 m">
                <input required type="number" min="10" max="10000" value={aoi.radiusMeters} onChange={(event) => { setAoi({ ...aoi, radiusMeters: Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} />
              </FieldLabel>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-700">Observation Window</span>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <button type="button" onClick={() => applyDatePreset('rabi')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900">Rabi 2025–26</button>
                  <button type="button" onClick={() => applyDatePreset('kharif')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900">Kharif 2025</button>
                  <button type="button" onClick={() => applyDatePreset('recent90')} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900">Last 90 days</button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                <FieldLabel label="Start Date · Inclusive">
                  <input required type="date" max={aoi.endDate || undefined} value={aoi.startDate} onChange={(event) => { setAoi({ ...aoi, startDate: event.target.value }); setAnalysisResult(null); }} className={inputClassName} />
                </FieldLabel>
                <FieldLabel label="End Date · Exclusive in Earth Engine">
                  <input required type="date" min={aoi.startDate || undefined} value={aoi.endDate} onChange={(event) => { setAoi({ ...aoi, endDate: event.target.value }); setAnalysisResult(null); }} className={inputClassName} />
                </FieldLabel>
              </div>
              <p className="text-[10px] text-slate-400">CropSight passes these dates to Earth Engine’s half-open date filter; scenes on the selected end date may not be included.</p>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FieldLabel label={`Requested K-Means Cluster Count · ${numZones}`} help="The pinned API does not return cluster labels or a spatial zone map.">
                <input type="range" min="2" max="7" step="1" value={numZones} onChange={(event) => { setNumZones(Number(event.target.value)); setAnalysisResult(null); }} className="w-full accent-emerald-600 cursor-pointer" />
                <span className="flex justify-between font-mono text-[9px] text-slate-400"><span>K = 2</span><span>K = 7</span></span>
              </FieldLabel>
              <FieldLabel label="Crop Context" help="Used only by CropSight’s upstream heuristic text; not part of NDVI calculation.">
                <select value={cropType} onChange={(event) => { setCropType(event.target.value); setAnalysisResult(null); }} className={inputClassName}>
                  <option>Wheat</option><option>Rice</option><option>Corn/Maize</option><option>Soybeans</option><option>Cotton</option><option>Sugarcane</option><option>Other</option>
                </select>
              </FieldLabel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <p className="max-w-md text-[10px] leading-relaxed text-slate-400">Live analysis requires the separately configured CropSight process and Earth Engine access, quota, and coverage.</p>
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50">
                {loading ? <RefreshCw size={13} className="spin" /> : <Satellite size={13} />}
                {loading ? 'Querying CropSight…' : 'Analyze selected AOI'}
              </button>
            </div>
          </form>
        </section>

        <div className="space-y-6">
          {errorMessage && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-xs leading-relaxed text-rose-900"><div className="flex items-start gap-2.5"><ShieldAlert size={17} className="mt-0.5 shrink-0 text-rose-600" /><div><p className="font-bold">CropSight analysis unavailable</p><p className="mt-0.5">{errorMessage}</p><p className="mt-2 text-[10px] text-rose-700">No prior, offline, or synthetic analysis is displayed as a current result.</p></div></div></section>}

          {!analysisResult && !errorMessage && <section className={`${panel} flex min-h-60 flex-col items-center justify-center text-center`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Satellite size={24} className="text-emerald-600" />
            </div>
            <h3 className="mt-3 text-base font-bold tracking-tight text-slate-900">No Analysis Run Yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">Enter the actual AOI and dates, then run a live query. Output appears here only after the configured service responds.</p>
          </section>}

          {analysisResult && <>
            <section className={`${panel} space-y-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div><h3 className="text-base font-bold tracking-tight text-slate-900">Aggregate Vegetation Signal</h3><p className="mt-0.5 text-[11px] text-slate-400">Returned by CropSight · {analysisResult.clusteringMethod}</p></div>
                {analysisResult.processingTime !== null && <span className="font-mono text-[10px] text-slate-400">Reported clustering time: {analysisResult.processingTime.toFixed(2)} s</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"><span className="block font-mono text-xl font-bold text-slate-900">{analysisResult.ndviStats.mean.toFixed(3)}</span><span className="mt-0.5 block text-[10px] text-slate-500">Mean NDVI</span></div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"><span className="block font-mono text-xl font-bold text-slate-900">{analysisResult.ndviStats.stddev.toFixed(3)}</span><span className="mt-0.5 block text-[10px] text-slate-500">NDVI Std Dev</span></div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5"><span className="block font-mono text-xl font-bold text-slate-900">{analysisResult.ndviStats.min.toFixed(2)}–{analysisResult.ndviStats.max.toFixed(2)}</span><span className="mt-0.5 block text-[10px] text-slate-500">NDVI Min–Max</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Per-scene mean NDVI</span><span className="font-medium text-emerald-700">Trend: {analysisResult.ndviTimeSeries.trend}</span></div>
                <div className="h-44 w-full overflow-x-auto">
                  <svg className="h-full min-w-[420px] w-full" viewBox="0 0 500 140" role="img" aria-label="CropSight returned NDVI time series">
                    {[0, 0.5, 1].map((fraction) => { const y = 18 + fraction * 96; return <g key={fraction}><line x1="38" y1={y} x2="485" y2={y} stroke="#e2e8f0" strokeDasharray="3 4" /><text x="31" y={y + 3} textAnchor="end" fontSize="8" fill="#94a3b8" className="font-mono">{(1 - fraction).toFixed(1)}</text></g>; })}
                    {(() => {
                      const { dates, ndviValues } = analysisResult.ndviTimeSeries;
                      const points = ndviValues.map((value, index) => ({
                        x: 42 + (index / Math.max(1, ndviValues.length - 1)) * 435,
                        y: 18 + (1 - Math.max(0, Math.min(1, value))) * 96,
                        value,
                        date: dates[index] ?? '',
                      }));
                      const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
                      return <g><path d={path} fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#059669" strokeWidth="2"><title>{`${point.date}: ${point.value.toFixed(3)} NDVI`}</title></circle>)}</g>;
                    })()}
                    <text x="42" y="132" fontSize="8" fill="#94a3b8" className="font-mono">{analysisResult.ndviTimeSeries.dates[0] ?? '—'}</text>
                    <text x="477" y="132" textAnchor="end" fontSize="8" fill="#94a3b8" className="font-mono">{analysisResult.ndviTimeSeries.dates.at(-1) ?? '—'}</text>
                  </svg>
                </div>
              </div>
              {analysisResult.rainfallData && analysisResult.rainfallData.rainfallValues.length > 0 && <div className="border-t border-slate-100 pt-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-slate-900">CHIRPS Rainfall Context</span><span className="text-[10px] text-slate-500">Total {analysisResult.rainfallData.totalRainfall.toFixed(1)} mm · not an irrigation recommendation</span></div>
                <div className="mt-2.5 flex h-12 items-end gap-1 rounded-xl bg-blue-50/60 p-2.5 border border-blue-100">{analysisResult.rainfallData.rainfallValues.map((value, index) => <span key={index} className="flex-1 rounded-t bg-blue-500/70" style={{ height: `${Math.max(3, (value / Math.max(analysisResult.rainfallData!.maxDailyRainfall, 0.1)) * 100)}%` }} title={`${analysisResult.rainfallData?.dates[index] ?? ''}: ${value.toFixed(1)} mm`} />)}</div>
              </div>}
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-900">
              <div className="flex items-start gap-2.5"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><div>
                <p className="font-bold">Spatial zones are not available from this API response</p>
                <p className="mt-0.5">The pinned CropSight endpoint returns aggregate NDVI statistics and a time series, but no NDVI raster, pixel labels, zone polygons, or per-zone statistics. Its clustering output is not returned to this interface, so no zone map, variable-rate prescription, or patch-level scouting coordinate is shown.</p>
              </div></div>
            </section>

            {analysisResult.recommendations.length > 0 && <section className={`${panel} space-y-2.5`}>
              <h3 className="text-sm font-bold text-slate-900">Upstream Heuristic Notes · Unvalidated</h3>
              <p className="text-[10px] leading-relaxed text-slate-500">These exact strings come from CropSight’s simple threshold rules. They are not diagnoses, agronomic prescriptions, yield estimates, irrigation decisions, or validated recommendations.</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">{analysisResult.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}</ul>
            </section>}

            <section className={`${panel} space-y-1.5 text-[11px] leading-relaxed text-slate-500`}>
              <p><strong>Data source:</strong> {analysisResult.source} · {analysisResult.provider}.</p>
              <p><strong>AOI:</strong> {analysisResult.aoi.latitude.toFixed(5)}, {analysisResult.aoi.longitude.toFixed(5)} · radius {analysisResult.aoi.radiusMeters} m · dates {analysisResult.aoi.startDate} to {analysisResult.aoi.endDate}.</p>
              <p><strong>API response received:</strong> {new Date(analysisResult.responseReceivedAt).toLocaleString()} · clustering input K={numZones} · {cropType} context.</p>
              <p className="text-[10px] text-slate-400">NDVI is optical canopy reflectance, not a diagnosis or direct soil measurement. Sentinel-2 scene coverage and pixel-level geometry are not included in this API response.</p>
              <a className="inline-flex items-center gap-1 text-emerald-600 font-semibold underline hover:text-emerald-700" href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED" target="_blank" rel="noreferrer">Sentinel-2 harmonized collection details <ExternalLink size={11} /></a>
            </section>
          </>}
        </div>
      </div>
    </div>
  );
};

