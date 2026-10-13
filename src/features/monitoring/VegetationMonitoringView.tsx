import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, Satellite, ShieldAlert } from 'lucide-react';
import { checkCropSightHealth, runCropSightAnalysis } from '../../services/monitoringApi';
import type { CircularAreaOfInterest, CropSightAnalysisResult } from './types';

const inputClassName = 'w-full rounded-md border border-line-border bg-parchment-50 px-2.5 py-1.5 text-xs text-ink outline-none transition focus:border-sage-600 focus:ring-2 focus:ring-sage-200';
const panel = 'rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument';

const FieldLabel: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-ink-muted">{label}</span>
    {children}
    {help && <span className="mt-1 block text-[10px] leading-4 text-ink-subtle">{help}</span>}
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
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3 border-b border-line-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Satellite size={18} className="text-sage-700" />
            <h2 className="font-serif text-lg font-bold text-ink">Vegetation Monitoring · CropSight</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase ${serviceHealth.online ? 'border-sage-300 bg-sage-100 text-sage-800' : 'border-line-border bg-parchment-100 text-ink-muted'}`}>
              {serviceHealth.online ? 'API reachable' : serviceHealth.checked ? 'API unavailable' : 'Checking'}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">
            Independent circular-AOI Sentinel-2 analysis through the pinned CropSight service. It does not read or change Soil Zoning, Crop Fit, Soil Investigation, or the historical telemetry replay.
          </p>
        </div>
        <button type="button" onClick={() => void refreshHealth()} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-line-border bg-parchment-50 px-3 text-xs font-semibold text-ink-muted hover:bg-parchment-100">
          <RefreshCw size={12} /> Check API
        </button>
      </section>

      {!serviceHealth.online && (
        <div className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-xs leading-5 text-amberGold-dark">
          CropSight’s API is not reachable at the configured endpoint. Google Earth Engine project/authentication setup is intentionally deferred; no sample satellite result is substituted.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section className={panel}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-base font-bold text-ink">Analysis inputs</h3>
              <p className="text-xs text-ink-muted">Define the circle and time window that CropSight will query.</p>
            </div>
            <span className="rounded-full border border-line-border bg-parchment-100 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">No default field</span>
          </div>

          <form onSubmit={handleRunAnalysis} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FieldLabel label="Centre latitude · degrees" help="WGS84, −90 to 90">
                <input required type="number" min="-90" max="90" step="any" value={aoi.latitude ?? ''} onChange={(event) => { setAoi({ ...aoi, latitude: event.target.value === '' ? null : Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} placeholder="e.g. 12.9716" />
              </FieldLabel>
              <FieldLabel label="Centre longitude · degrees" help="WGS84, −180 to 180">
                <input required type="number" min="-180" max="180" step="any" value={aoi.longitude ?? ''} onChange={(event) => { setAoi({ ...aoi, longitude: event.target.value === '' ? null : Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} placeholder="e.g. 77.5946" />
              </FieldLabel>
              <FieldLabel label="Circle radius · metres" help="10 to 10,000 m">
                <input required type="number" min="10" max="10000" value={aoi.radiusMeters} onChange={(event) => { setAoi({ ...aoi, radiusMeters: Number(event.target.value) }); setAnalysisResult(null); }} className={inputClassName} />
              </FieldLabel>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-ink-muted">Observation window</span>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <button type="button" onClick={() => applyDatePreset('rabi')} className="rounded border border-line-border bg-parchment-100 px-2 py-1 text-ink-muted hover:text-ink">Rabi 2025–26</button>
                  <button type="button" onClick={() => applyDatePreset('kharif')} className="rounded border border-line-border bg-parchment-100 px-2 py-1 text-ink-muted hover:text-ink">Kharif 2025</button>
                  <button type="button" onClick={() => applyDatePreset('recent90')} className="rounded border border-line-border bg-parchment-100 px-2 py-1 text-ink-muted hover:text-ink">Last 90 days</button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Start date · inclusive">
                  <input required type="date" max={aoi.endDate || undefined} value={aoi.startDate} onChange={(event) => { setAoi({ ...aoi, startDate: event.target.value }); setAnalysisResult(null); }} className={inputClassName} />
                </FieldLabel>
                <FieldLabel label="End date · exclusive in Earth Engine">
                  <input required type="date" min={aoi.startDate || undefined} value={aoi.endDate} onChange={(event) => { setAoi({ ...aoi, endDate: event.target.value }); setAnalysisResult(null); }} className={inputClassName} />
                </FieldLabel>
              </div>
              <p className="text-[10px] text-ink-subtle">CropSight passes these dates to Earth Engine’s half-open date filter; scenes on the selected end date may not be included.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldLabel label={`Requested K-means cluster count · ${numZones}`} help="The pinned API does not return cluster labels or a spatial zone map.">
                <input type="range" min="2" max="7" step="1" value={numZones} onChange={(event) => { setNumZones(Number(event.target.value)); setAnalysisResult(null); }} className="w-full accent-sage-700" />
                <span className="flex justify-between text-[9px] text-ink-subtle"><span>K = 2</span><span>K = 7</span></span>
              </FieldLabel>
              <FieldLabel label="Crop context" help="Used only by CropSight’s upstream heuristic text; not part of NDVI calculation.">
                <select value={cropType} onChange={(event) => { setCropType(event.target.value); setAnalysisResult(null); }} className={inputClassName}>
                  <option>Wheat</option><option>Rice</option><option>Corn/Maize</option><option>Soybeans</option><option>Cotton</option><option>Sugarcane</option><option>Other</option>
                </select>
              </FieldLabel>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
              <p className="max-w-lg text-[10px] leading-4 text-ink-subtle">Live analysis requires the separately configured CropSight process and Earth Engine access, quota, and coverage.</p>
              <button type="submit" disabled={loading} className="button button--primary">
                {loading ? <RefreshCw size={13} className="spin" /> : <Satellite size={13} />}
                {loading ? 'Querying CropSight…' : 'Analyze selected AOI'}
              </button>
            </div>
          </form>
        </section>

        <div className="space-y-5">
          {errorMessage && <section role="alert" className="rounded-xl border border-clay/30 bg-clay-subtle p-4 text-xs leading-5 text-clay-dark"><div className="flex items-start gap-2"><ShieldAlert size={16} className="mt-0.5 shrink-0" /><div><p className="font-semibold">CropSight analysis unavailable</p><p>{errorMessage}</p><p className="mt-2 text-[10px]">No prior, offline, or synthetic analysis is displayed as a current result.</p></div></div></section>}

          {!analysisResult && !errorMessage && <section className={`${panel} flex min-h-52 flex-col items-center justify-center text-center`}>
            <Satellite size={25} className="text-sage-700" />
            <h3 className="mt-3 font-serif text-base font-bold text-ink">No analysis run yet</h3>
            <p className="mt-1 max-w-sm text-xs leading-5 text-ink-muted">Enter the actual AOI and dates, then run a live query. Output appears here only after the configured service responds.</p>
          </section>}

          {analysisResult && <>
            <section className={`${panel} space-y-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line-subtle pb-2">
                <div><h3 className="font-serif text-base font-bold text-ink">Aggregate vegetation signal</h3><p className="text-[10px] text-ink-subtle">Returned by CropSight · {analysisResult.clusteringMethod}</p></div>
                {analysisResult.processingTime !== null && <span className="text-[10px] text-ink-subtle">Reported clustering time: {analysisResult.processingTime.toFixed(2)} s</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-line-subtle bg-parchment-100 p-3"><span className="block font-mono text-lg font-bold text-ink">{analysisResult.ndviStats.mean.toFixed(3)}</span><span className="text-[10px] text-ink-subtle">Mean NDVI</span></div>
                <div className="rounded-lg border border-line-subtle bg-parchment-100 p-3"><span className="block font-mono text-lg font-bold text-ink">{analysisResult.ndviStats.stddev.toFixed(3)}</span><span className="text-[10px] text-ink-subtle">NDVI standard deviation</span></div>
                <div className="rounded-lg border border-line-subtle bg-parchment-100 p-3"><span className="block font-mono text-lg font-bold text-ink">{analysisResult.ndviStats.min.toFixed(2)}–{analysisResult.ndviStats.max.toFixed(2)}</span><span className="text-[10px] text-ink-subtle">NDVI min–max</span></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-ink-subtle"><span>Per-scene mean NDVI</span><span>Trend returned: {analysisResult.ndviTimeSeries.trend}</span></div>
                <div className="h-40 w-full overflow-x-auto">
                  <svg className="h-full min-w-[420px] w-full" viewBox="0 0 500 140" role="img" aria-label="CropSight returned NDVI time series">
                    {[0, 0.5, 1].map((fraction) => { const y = 18 + fraction * 96; return <g key={fraction}><line x1="38" y1={y} x2="485" y2={y} stroke="#d8e2d7" strokeDasharray="3 4" /><text x="31" y={y + 3} textAnchor="end" fontSize="8" fill="#718277">{(1 - fraction).toFixed(1)}</text></g>; })}
                    {(() => {
                      const { dates, ndviValues } = analysisResult.ndviTimeSeries;
                      const points = ndviValues.map((value, index) => ({
                        x: 42 + (index / Math.max(1, ndviValues.length - 1)) * 435,
                        y: 18 + (1 - Math.max(0, Math.min(1, value))) * 96,
                        value,
                        date: dates[index] ?? '',
                      }));
                      const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
                      return <g><path d={path} fill="none" stroke="#32745b" strokeWidth="2.5" strokeLinecap="round" />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#fff" stroke="#32745b" strokeWidth="2"><title>{`${point.date}: ${point.value.toFixed(3)} NDVI`}</title></circle>)}</g>;
                    })()}
                    <text x="42" y="132" fontSize="8" fill="#718277">{analysisResult.ndviTimeSeries.dates[0] ?? '—'}</text>
                    <text x="477" y="132" textAnchor="end" fontSize="8" fill="#718277">{analysisResult.ndviTimeSeries.dates.at(-1) ?? '—'}</text>
                  </svg>
                </div>
              </div>
              {analysisResult.rainfallData && analysisResult.rainfallData.rainfallValues.length > 0 && <div className="border-t border-line-subtle pt-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-ink">CropSight-returned CHIRPS rainfall context</span><span className="text-[10px] text-ink-muted">Total {analysisResult.rainfallData.totalRainfall.toFixed(1)} mm · not an irrigation recommendation</span></div>
                <div className="mt-2 flex h-12 items-end gap-1 rounded bg-blue-50 p-2">{analysisResult.rainfallData.rainfallValues.map((value, index) => <span key={index} className="flex-1 rounded-t bg-blue-500/70" style={{ height: `${Math.max(3, (value / Math.max(analysisResult.rainfallData!.maxDailyRainfall, 0.1)) * 100)}%` }} title={`${analysisResult.rainfallData?.dates[index] ?? ''}: ${value.toFixed(1)} mm`} />)}</div>
              </div>}
            </section>

            <section className="rounded-xl border border-amberGold/30 bg-amberGold-subtle p-4 text-xs leading-5 text-amberGold-dark">
              <div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><div>
                <p className="font-semibold">Spatial zones are not available from this API response</p>
                <p>The pinned CropSight endpoint returns aggregate NDVI statistics and a time series, but no NDVI raster, pixel labels, zone polygons, or per-zone statistics. Its clustering output is not returned to this interface, so no zone map, variable-rate prescription, or patch-level scouting coordinate is shown.</p>
              </div></div>
            </section>

            {analysisResult.recommendations.length > 0 && <section className={`${panel} space-y-2`}>
              <h3 className="font-serif text-sm font-bold text-ink">Upstream heuristic notes · unvalidated</h3>
              <p className="text-[10px] leading-4 text-ink-muted">These exact strings come from CropSight’s simple threshold rules. They are not diagnoses, agronomic prescriptions, yield estimates, irrigation decisions, or validated recommendations.</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-ink-muted">{analysisResult.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}</ul>
            </section>}

            <section className={`${panel} space-y-1 text-[10px] leading-4 text-ink-subtle`}>
              <p><strong>Data source:</strong> {analysisResult.source} · {analysisResult.provider}.</p>
              <p><strong>AOI:</strong> {analysisResult.aoi.latitude.toFixed(5)}, {analysisResult.aoi.longitude.toFixed(5)} · radius {analysisResult.aoi.radiusMeters} m · dates {analysisResult.aoi.startDate} to {analysisResult.aoi.endDate}.</p>
              <p><strong>API response received:</strong> {new Date(analysisResult.responseReceivedAt).toLocaleString()} · clustering input K={numZones} · {cropType} context.</p>
              <p>NDVI is optical canopy reflectance, not a diagnosis or direct soil measurement. Sentinel-2 scene coverage and pixel-level geometry are not included in this API response.</p>
              <a className="inline-flex items-center gap-1 text-sage-800 underline" href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED" target="_blank" rel="noreferrer">Sentinel-2 harmonized collection details <ExternalLink size={10} /></a>
            </section>
          </>}
        </div>
      </div>
    </div>
  );
};
