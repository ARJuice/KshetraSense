import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDotDashed,
  ClipboardList,
  CloudOff,
  FileSpreadsheet,
  FlaskConical,
  Import,
  MapPin,
  Satellite,
  Upload,
} from 'lucide-react';
import { createCsvImportPreview } from './csvImport';
import { SOIL_CSV_HEADERS, validateSoilSampleRow, type CsvSampleRow } from './soilSampleValidation';
import type { CircularAreaOfInterest, CsvImportPreview, SoilMeasurement } from './types';

const EMPTY_SOIL_FORM: CsvSampleRow = {
  sample_id: '',
  collected_at: '',
  latitude: '',
  longitude: '',
  ph: '',
  ec_ds_m: '',
  nitrogen_mg_kg: '',
  phosphorus_mg_kg: '',
  potassium_mg_kg: '',
  temperature_c: '',
  source: '',
  lab_report_id: '',
  notes: '',
};

const EMPTY_AOI: CircularAreaOfInterest = {
  latitude: null,
  longitude: null,
  radiusMeters: 500,
  startDate: '',
  endDate: '',
};

const formatNumber = (value: number, digits = 2) => value.toLocaleString(undefined, { maximumFractionDigits: digits });

const samplePosition = (sample: SoilMeasurement, samples: SoilMeasurement[]) => {
  if (samples.length === 1) return { left: 50, top: 50 };
  const latitudes = samples.map((record) => record.latitude);
  const longitudes = samples.map((record) => record.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = maxLatitude - minLatitude || 1;
  const longitudeRange = maxLongitude - minLongitude || 1;
  return {
    left: 12 + ((sample.longitude - minLongitude) / longitudeRange) * 76,
    top: 88 - ((sample.latitude - minLatitude) / latitudeRange) * 76,
  };
};

const FieldLabel: React.FC<{ label: string; help: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-ink-muted">{label}</span>
    {children}
    <span className="mt-1 block text-[10px] leading-4 text-ink-subtle">{help}</span>
  </label>
);

const inputClassName = 'w-full rounded-md border border-line-border bg-parchment-50 px-2.5 py-2 text-xs text-ink outline-none transition focus:border-sage-600 focus:ring-2 focus:ring-sage-200';

const StatusPill: React.FC<{ children: React.ReactNode; tone: 'amber' | 'sage' | 'slate' }> = ({ children, tone }) => {
  const tones = {
    amber: 'border-amberGold/30 bg-amberGold-subtle text-amberGold-dark',
    sage: 'border-sage-300 bg-sage-100 text-sage-800',
    slate: 'border-line-border bg-parchment-100 text-ink-muted',
  };
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
};

export interface FieldMonitoringViewProps {
  onSamplesChange?: (samples: SoilMeasurement[]) => void;
}

/**
 * Standalone monitoring workspace. It intentionally keeps local records in browser state;
 * persistence, SoilGrids access, and Earth Engine credentials belong to their later adapters.
 */
export const FieldMonitoringView: React.FC<FieldMonitoringViewProps> = ({ onSamplesChange }) => {
  const [activePanel, setActivePanel] = useState<'soil' | 'vegetation'>('soil');
  const [soilForm, setSoilForm] = useState<CsvSampleRow>(EMPTY_SOIL_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [samples, setSamples] = useState<SoilMeasurement[]>([]);
  const [importPreview, setImportPreview] = useState<CsvImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [aoi, setAoi] = useState<CircularAreaOfInterest>(EMPTY_AOI);
  const [aoiMessage, setAoiMessage] = useState<string | null>(null);

  const updateSamples = (nextSamples: SoilMeasurement[]) => {
    setSamples(nextSamples);
    onSamplesChange?.(nextSamples);
  };

  const submitSoilSample = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateSoilSampleRow(soilForm, 'manual-entry');
    if (!result.value) {
      setFormErrors(result.errors);
      return;
    }
    if (samples.some((sample) => sample.sampleId === result.value?.sampleId)) {
      setFormErrors([`A sample with ID “${result.value.sampleId}” already exists. Choose a unique sample ID.`]);
      return;
    }
    updateSamples([...samples, result.value]);
    setSoilForm(EMPTY_SOIL_FORM);
    setFormErrors([]);
  };

  const previewCsv = (file: File | undefined) => {
    setImportMessage(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportPreview({ fileName: file.name, totalRows: 0, accepted: [], issues: [{ row: 0, message: 'Choose a .csv file.' }] });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImportPreview({ fileName: file.name, totalRows: 0, accepted: [], issues: [{ row: 0, message: 'CSV files must be 2 MB or smaller.' }] });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImportPreview(createCsvImportPreview(String(reader.result ?? ''), file.name));
    reader.onerror = () => setImportPreview({ fileName: file.name, totalRows: 0, accepted: [], issues: [{ row: 0, message: 'The file could not be read.' }] });
    reader.readAsText(file);
  };

  const applyImport = () => {
    if (!importPreview) return;
    const existingIds = new Set(samples.map((sample) => sample.sampleId));
    const newSamples = importPreview.accepted.filter((sample) => !existingIds.has(sample.sampleId));
    const duplicates = importPreview.accepted.length - newSamples.length;
    updateSamples([...samples, ...newSamples]);
    setImportMessage(`${newSamples.length} measurement${newSamples.length === 1 ? '' : 's'} added${duplicates ? `; ${duplicates} duplicate ID${duplicates === 1 ? ' was' : 's were'} skipped` : ''}.`);
    setImportPreview(null);
  };

  const validateAoi = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const issues: string[] = [];
    if (aoi.latitude === null || aoi.latitude < -90 || aoi.latitude > 90) issues.push('Enter a latitude between -90 and 90.');
    if (aoi.longitude === null || aoi.longitude < -180 || aoi.longitude > 180) issues.push('Enter a longitude between -180 and 180.');
    if (!Number.isFinite(aoi.radiusMeters) || aoi.radiusMeters < 10 || aoi.radiusMeters > 10000) issues.push('Radius must be 10–10,000 metres.');
    if (!aoi.startDate || !aoi.endDate || aoi.startDate > aoi.endDate) issues.push('Enter a valid start and end date.');
    setAoiMessage(issues.length > 0 ? issues.join(' ') : 'AOI is valid, but no imagery request was sent: Earth Engine/CropSight is not configured in this build.');
  };

  const soilSummary = useMemo(() => {
    if (samples.length === 0) return null;
    const average = (key: keyof Pick<SoilMeasurement, 'ph' | 'ecDsM' | 'nitrogenMgKg' | 'phosphorusMgKg' | 'potassiumMgKg'>) =>
      samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
    return { ph: average('ph'), ec: average('ecDsM'), nitrogen: average('nitrogenMgKg') };
  }, [samples]);

  return (
    <main className="flex-1 overflow-y-auto bg-parchment-100/60 p-5 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col justify-between gap-3 border-b border-line-border pb-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-serif text-2xl font-bold text-ink">Field Monitoring</span>
              <StatusPill tone="slate">Local workspace</StatusPill>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-ink-muted">Record traceable soil observations and prepare a separate satellite area of interest. Measurements remain distinct from zoning until you explicitly use them as an analysis input.</p>
          </div>
          <div className="flex rounded-lg border border-line-border bg-parchment-50 p-1 shadow-instrument" role="tablist" aria-label="Field Monitoring area">
            <button type="button" role="tab" aria-selected={activePanel === 'soil'} onClick={() => setActivePanel('soil')} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activePanel === 'soil' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:bg-parchment-100'}`}>
              Soil Investigation
            </button>
            <button type="button" role="tab" aria-selected={activePanel === 'vegetation'} onClick={() => setActivePanel('vegetation')} className={`rounded-md px-3 py-2 text-xs font-semibold transition ${activePanel === 'vegetation' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:bg-parchment-100'}`}>
              Vegetation Monitoring
            </button>
          </div>
        </header>

        {activePanel === 'soil' ? (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.78fr)]">
            <div className="space-y-5">
              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="soil-entry-title">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2"><FlaskConical size={17} className="text-verdigris" /><h2 id="soil-entry-title" className="font-serif text-lg font-bold text-ink">Add a soil measurement</h2></div>
                    <p className="text-xs leading-5 text-ink-muted">Values must have a collection date, coordinates, units, and source. They are recorded locally in this session.</p>
                  </div>
                  <StatusPill tone="sage">Manual entry</StatusPill>
                </div>
                {formErrors.length > 0 && <div className="mb-4 rounded-lg border border-clay/30 bg-clay-subtle p-3 text-xs text-clay-dark"><div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle size={14} /> Review this record</div><ul className="list-disc space-y-0.5 pl-4">{formErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
                <form onSubmit={submitSoilSample} className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FieldLabel label="Sample ID" help="Unique field/lab identifier"><input required value={soilForm.sample_id} onChange={(event) => setSoilForm({ ...soilForm, sample_id: event.target.value })} className={inputClassName} placeholder="e.g. SE-014" /></FieldLabel>
                  <FieldLabel label="Collected on" help="ISO date"><input required type="date" value={soilForm.collected_at} onChange={(event) => setSoilForm({ ...soilForm, collected_at: event.target.value })} className={inputClassName} /></FieldLabel>
                  <FieldLabel label="Source" help="Lab, kit, or survey name"><input required value={soilForm.source} onChange={(event) => setSoilForm({ ...soilForm, source: event.target.value })} className={inputClassName} placeholder="Soil lab A" /></FieldLabel>
                  <FieldLabel label="Latitude" help="Decimal degrees"><input required inputMode="decimal" value={soilForm.latitude} onChange={(event) => setSoilForm({ ...soilForm, latitude: event.target.value })} className={inputClassName} placeholder="12.9716" /></FieldLabel>
                  <FieldLabel label="Longitude" help="Decimal degrees"><input required inputMode="decimal" value={soilForm.longitude} onChange={(event) => setSoilForm({ ...soilForm, longitude: event.target.value })} className={inputClassName} placeholder="77.5946" /></FieldLabel>
                  <FieldLabel label="pH" help="0–14 scale"><input required inputMode="decimal" value={soilForm.ph} onChange={(event) => setSoilForm({ ...soilForm, ph: event.target.value })} className={inputClassName} placeholder="6.4" /></FieldLabel>
                  <FieldLabel label="EC" help="dS/m"><input required inputMode="decimal" value={soilForm.ec_ds_m} onChange={(event) => setSoilForm({ ...soilForm, ec_ds_m: event.target.value })} className={inputClassName} placeholder="1.42" /></FieldLabel>
                  <FieldLabel label="Nitrogen" help="mg/kg"><input required inputMode="decimal" value={soilForm.nitrogen_mg_kg} onChange={(event) => setSoilForm({ ...soilForm, nitrogen_mg_kg: event.target.value })} className={inputClassName} placeholder="48" /></FieldLabel>
                  <FieldLabel label="Phosphorus" help="mg/kg"><input required inputMode="decimal" value={soilForm.phosphorus_mg_kg} onChange={(event) => setSoilForm({ ...soilForm, phosphorus_mg_kg: event.target.value })} className={inputClassName} placeholder="24" /></FieldLabel>
                  <FieldLabel label="Potassium" help="mg/kg"><input required inputMode="decimal" value={soilForm.potassium_mg_kg} onChange={(event) => setSoilForm({ ...soilForm, potassium_mg_kg: event.target.value })} className={inputClassName} placeholder="180" /></FieldLabel>
                  <FieldLabel label="Soil temperature" help="°C · optional"><input inputMode="decimal" value={soilForm.temperature_c} onChange={(event) => setSoilForm({ ...soilForm, temperature_c: event.target.value })} className={inputClassName} placeholder="27" /></FieldLabel>
                  <FieldLabel label="Lab report ID" help="Optional reference"><input value={soilForm.lab_report_id} onChange={(event) => setSoilForm({ ...soilForm, lab_report_id: event.target.value })} className={inputClassName} placeholder="LAB-2026-117" /></FieldLabel>
                  <div className="sm:col-span-2 lg:col-span-3"><FieldLabel label="Notes" help="Optional field conditions or method"><input value={soilForm.notes} onChange={(event) => setSoilForm({ ...soilForm, notes: event.target.value })} className={inputClassName} placeholder="Composite sample, 0–15 cm depth" /></FieldLabel></div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end"><button type="submit" className="inline-flex items-center gap-2 rounded-md bg-sage-700 px-4 py-2.5 text-xs font-semibold text-parchment-50 shadow-sm transition hover:bg-sage-800"><ClipboardList size={15} /> Record measurement</button></div>
                </form>
              </section>

              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="csv-import-title">
                <div className="mb-3 flex items-start justify-between gap-4"><div><div className="mb-1 flex items-center gap-2"><FileSpreadsheet size={17} className="text-verdigris" /><h2 id="csv-import-title" className="font-serif text-lg font-bold text-ink">Import measurement history</h2></div><p className="text-xs leading-5 text-ink-muted">Parse a CSV locally, inspect accepted and rejected rows, then add only valid records.</p></div><StatusPill tone="slate">2 MB max</StatusPill></div>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-line-border bg-parchment-100/60 p-3 transition hover:border-sage-500 hover:bg-sage-50"><span className="flex items-center gap-2 text-xs font-medium text-ink"><Upload size={16} className="text-sage-700" /> Choose CSV for validation</span><span className="text-[11px] text-ink-subtle">No upload occurs</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => previewCsv(event.target.files?.[0])} /></label>
                <p className="mt-3 text-[10px] leading-4 text-ink-subtle">Required: {SOIL_CSV_HEADERS.slice(0, 10).join(', ')}. Optional: temperature_c, lab_report_id, notes.</p>
                {importPreview && <div className="mt-4 rounded-lg border border-line-border bg-parchment-100 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-semibold text-ink">{importPreview.fileName}</span><span className="ml-2 text-ink-muted">{importPreview.totalRows} data rows</span></div><span className="font-mono text-verdigris">{importPreview.accepted.length} valid</span></div>{importPreview.issues.length > 0 && <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-line-subtle pt-2 text-clay-dark">{importPreview.issues.slice(0, 8).map((issue) => <li key={`${issue.row}-${issue.message}`}>Row {issue.row || '—'}: {issue.message}</li>)}{importPreview.issues.length > 8 && <li>…and {importPreview.issues.length - 8} more issue(s).</li>}</ul>}<div className="mt-3 flex justify-end gap-2"><button type="button" className="rounded-md px-3 py-2 text-xs text-ink-muted hover:bg-parchment-200" onClick={() => setImportPreview(null)}>Discard</button><button type="button" disabled={importPreview.accepted.length === 0} className="inline-flex items-center gap-1 rounded-md bg-sage-700 px-3 py-2 text-xs font-semibold text-parchment-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={applyImport}><Import size={14} /> Add valid records</button></div></div>}
                {importMessage && <p className="mt-3 flex items-center gap-1 text-xs text-sage-800"><CheckCircle2 size={14} /> {importMessage}</p>}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="sample-map-title">
                <div className="mb-3 flex items-start justify-between gap-3"><div><div className="mb-1 flex items-center gap-2"><MapPin size={17} className="text-verdigris" /><h2 id="sample-map-title" className="font-serif text-lg font-bold text-ink">Sample coverage</h2></div><p className="text-xs text-ink-muted">A coordinate sketch, not a cadastral or basemap layer.</p></div><span className="font-mono text-xs text-ink-muted">{samples.length} records</span></div>
                <div className="relative h-52 overflow-hidden rounded-lg border border-line-border bg-[linear-gradient(rgba(88,134,115,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(88,134,115,0.08)_1px,transparent_1px)] bg-[size:24px_24px]">
                  {samples.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-8 text-center"><CircleDotDashed size={24} className="mb-2 text-ink-faint" /><p className="text-xs font-medium text-ink-muted">No coordinates recorded</p><p className="mt-1 text-[11px] leading-4 text-ink-subtle">Add or import a soil measurement to inspect its relative sample position.</p></div> : samples.map((sample) => { const position = samplePosition(sample, samples); return <span key={sample.sampleId} title={`${sample.sampleId} · ${sample.latitude}, ${sample.longitude}`} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-parchment-50 bg-verdigris text-[9px] font-bold text-parchment-50 shadow-sm" style={{ left: `${position.left}%`, top: `${position.top}%` }}>{sample.sampleId.slice(-2).toUpperCase()}</span>; })}
                </div>
                {soilSummary && <div className="mt-3 grid grid-cols-3 divide-x divide-line-subtle rounded-lg border border-line-subtle bg-parchment-100/80 text-center"><div className="p-2"><span className="block font-mono text-sm font-semibold text-ink">{formatNumber(soilSummary.ph)}</span><span className="text-[10px] text-ink-subtle">mean pH</span></div><div className="p-2"><span className="block font-mono text-sm font-semibold text-ink">{formatNumber(soilSummary.ec)}</span><span className="text-[10px] text-ink-subtle">mean EC dS/m</span></div><div className="p-2"><span className="block font-mono text-sm font-semibold text-ink">{formatNumber(soilSummary.nitrogen, 0)}</span><span className="text-[10px] text-ink-subtle">mean N mg/kg</span></div></div>}
              </section>

              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="history-title">
                <div className="mb-3 flex items-center justify-between"><h2 id="history-title" className="font-serif text-lg font-bold text-ink">Comparable history</h2><StatusPill tone="slate">Provenance kept</StatusPill></div>
                {samples.length === 0 ? <p className="rounded-lg border border-dashed border-line-border p-4 text-xs leading-5 text-ink-subtle">No records yet. A meaningful comparison needs measurements taken with documented sources, dates, units, and coordinates.</p> : <div className="max-h-[31rem] space-y-3 overflow-y-auto pr-1">{[...samples].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)).map((sample) => <article key={sample.sampleId} className="rounded-lg border border-line-border bg-parchment-100/60 p-3"><div className="flex items-start justify-between gap-2"><div><h3 className="text-xs font-semibold text-ink">{sample.sampleId}</h3><p className="mt-0.5 text-[10px] text-ink-subtle">{sample.collectedAt} · {sample.source}</p></div><StatusPill tone={sample.provenance === 'csv-import' ? 'slate' : 'sage'}>{sample.provenance === 'csv-import' ? 'CSV' : 'Manual'}</StatusPill></div><dl className="mt-2 grid grid-cols-3 gap-1 border-y border-line-subtle py-2 text-[10px]"><div><dt className="text-ink-subtle">pH</dt><dd className="font-mono font-medium text-ink">{formatNumber(sample.ph)}</dd></div><div><dt className="text-ink-subtle">EC</dt><dd className="font-mono font-medium text-ink">{formatNumber(sample.ecDsM)} dS/m</dd></div><div><dt className="text-ink-subtle">N · P · K</dt><dd className="font-mono font-medium text-ink">{formatNumber(sample.nitrogenMgKg, 0)} · {formatNumber(sample.phosphorusMgKg, 0)} · {formatNumber(sample.potassiumMgKg, 0)}</dd></div></dl><p className="mt-2 text-[10px] text-ink-subtle">{sample.latitude.toFixed(5)}, {sample.longitude.toFixed(5)}{sample.labReportId ? ` · ${sample.labReportId}` : ''}</p>{sample.notes && <p className="mt-1 text-[10px] leading-4 text-ink-muted">{sample.notes}</p>}</article>)}</div>}
              </section>

              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="soilgrids-title">
                <div className="mb-2 flex items-center justify-between"><h2 id="soilgrids-title" className="font-serif text-base font-bold text-ink">SoilGrids context</h2><StatusPill tone="amber">Not connected</StatusPill></div>
                <div className="flex gap-2 rounded-lg border border-amberGold/25 bg-amberGold-subtle p-3"><CloudOff size={16} className="mt-0.5 shrink-0 text-amberGold-dark" /><p className="text-[11px] leading-5 text-amberGold-dark">No SoilGrids request is made in the browser. A future server adapter must record query location, depth, property, provider timestamp, and uncertainty. SoilGrids is regional context at about 250 m, not a substitute for field samples or zoning cells.</p></div>
              </section>
            </aside>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument" aria-labelledby="aoi-title">
              <div className="mb-4 flex items-start justify-between gap-4"><div><div className="mb-1 flex items-center gap-2"><Satellite size={18} className="text-verdigris" /><h2 id="aoi-title" className="font-serif text-lg font-bold text-ink">Vegetation monitoring area</h2></div><p className="text-xs leading-5 text-ink-muted">CropSight remains an independent satellite workflow: a circular area of interest and date range, separate from soil records and zone boundaries.</p></div><StatusPill tone="amber">Configuration required</StatusPill></div>
              <form onSubmit={validateAoi} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FieldLabel label="Centre latitude" help="WGS84 decimal degrees"><input type="number" step="any" className={inputClassName} value={aoi.latitude ?? ''} onChange={(event) => setAoi({ ...aoi, latitude: event.target.value === '' ? null : Number(event.target.value) })} placeholder="12.9716" /></FieldLabel>
                <FieldLabel label="Centre longitude" help="WGS84 decimal degrees"><input type="number" step="any" className={inputClassName} value={aoi.longitude ?? ''} onChange={(event) => setAoi({ ...aoi, longitude: event.target.value === '' ? null : Number(event.target.value) })} placeholder="77.5946" /></FieldLabel>
                <FieldLabel label="Circle radius" help="10–10,000 metres"><input type="number" min="10" max="10000" className={inputClassName} value={aoi.radiusMeters} onChange={(event) => setAoi({ ...aoi, radiusMeters: Number(event.target.value) })} /></FieldLabel>
                <div className="hidden sm:block" aria-hidden="true" />
                <FieldLabel label="Start date" help="Inclusive"><input type="date" className={inputClassName} value={aoi.startDate} onChange={(event) => setAoi({ ...aoi, startDate: event.target.value })} /></FieldLabel>
                <FieldLabel label="End date" help="Inclusive"><input type="date" className={inputClassName} value={aoi.endDate} onChange={(event) => setAoi({ ...aoi, endDate: event.target.value })} /></FieldLabel>
                <div className="sm:col-span-2 flex items-center justify-between gap-3 border-t border-line-subtle pt-4"><p className="max-w-sm text-[11px] leading-5 text-ink-subtle">Validation never fabricates NDVI, imagery, zones, rainfall, or a recommendation. A configured service must return provenance with any eventual output.</p><button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-md border border-sage-500 bg-sage-50 px-4 py-2.5 text-xs font-semibold text-sage-800 hover:bg-sage-100"><CheckCircle2 size={15} /> Validate AOI</button></div>
              </form>
              {aoiMessage && <div className={`mt-4 rounded-lg border p-3 text-xs leading-5 ${aoiMessage.startsWith('AOI is valid') ? 'border-amberGold/30 bg-amberGold-subtle text-amberGold-dark' : 'border-clay/30 bg-clay-subtle text-clay-dark'}`}>{aoiMessage}</div>}
            </section>
            <aside className="space-y-5">
              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument"><div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-lg font-bold text-ink">CropSight bridge</h2><StatusPill tone="amber">Unavailable</StatusPill></div><p className="text-xs leading-5 text-ink-muted">This interface does not bundle credentials or invoke Earth Engine. It only collects the independent request shape required by a server-side CropSight adapter.</p><dl className="mt-4 space-y-2 border-y border-line-subtle py-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-ink-muted">Provider</dt><dd className="font-mono text-ink">Google Earth Engine</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-muted">Inputs</dt><dd className="text-right font-mono text-ink">circle AOI + dates</dd></div><div className="flex justify-between gap-3"><dt className="text-ink-muted">Expected evidence</dt><dd className="text-right font-mono text-ink">scene IDs + method + timestamp</dd></div></dl><div className="mt-4 rounded-lg border border-dashed border-line-border px-3 py-4 text-center"><CloudOff size={20} className="mx-auto mb-2 text-ink-faint" /><p className="text-xs font-medium text-ink-muted">No imagery or NDVI data loaded</p><p className="mt-1 text-[11px] leading-4 text-ink-subtle">Configure the service adapter and Earth Engine project on the server before enabling retrieval.</p></div></section>
              <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument"><h2 className="font-serif text-base font-bold text-ink">Current intended use</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-ink-muted"><li>• Seasonal NDVI exploration, with source/date visibility.</li><li>• Relative low-performing-patch scouting for human review.</li><li>• Not a prescription, irrigation command, yield estimate, or crop-fit input at this stage.</li></ul></section>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
};
