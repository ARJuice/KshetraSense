import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FlaskConical,
  Import,
  LineChart,
  MapPin,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { createCsvImportPreview } from './csvImport';
import {
  groupSamplesForTrend,
  PARAMETER_METAS,
  type MeasurableParameter,
} from './comparability';
import { SampleCoverageMap } from './SampleCoverageMap';
import { SOIL_CSV_HEADERS, validateSoilSampleRow, type CsvSampleRow } from './soilSampleValidation';
import { fetchSoilGridsContext } from '../../services/monitoringApi';
import type { CsvImportPreview, SoilGridsContextData, SoilMeasurement } from './types';

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
  moisture_pct: '',
  moisture_unit: '% gravimetric',
  depth_cm: '',
  depth_interval: '0-15 cm',
  method: '1:2.5 water extract',
  source: '',
  lab_report_id: '',
  notes: '',
};

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

interface SoilInvestigationViewProps {
  samples: SoilMeasurement[];
  onUpdateSamples: (samples: SoilMeasurement[]) => void;
}

export const SoilInvestigationView: React.FC<SoilInvestigationViewProps> = ({
  samples,
  onUpdateSamples,
}) => {
  const [subTab, setSubTab] = useState<'entry' | 'trends' | 'soilgrids'>('entry');
  const [soilForm, setSoilForm] = useState<CsvSampleRow>(EMPTY_SOIL_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [selectedSample, setSelectedSample] = useState<SoilMeasurement | null>(null);

  // CSV Import State
  const [importPreview, setImportPreview] = useState<CsvImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Comparability & Trends State (FM-02)
  const [trendParam, setTrendParam] = useState<MeasurableParameter>('ph');

  // SoilGrids State (FM-03, FM-04)
  const [sgLat, setSgLat] = useState('');
  const [sgLon, setSgLon] = useState('');
  const [sgProp, setSgProp] = useState<string>('phh2o');
  const [sgDepth, setSgDepth] = useState<string>('0-5cm');
  const [sgData, setSgData] = useState<SoilGridsContextData | null>(null);
  const [sgLoading, setSgLoading] = useState<boolean>(false);
  const [sgError, setSgError] = useState<string | null>(null);
  const sgCoordinatesValid =
    sgLat.trim() !== '' && sgLon.trim() !== '' &&
    Number.isFinite(Number(sgLat)) && Number(sgLat) >= -90 && Number(sgLat) <= 90 &&
    Number.isFinite(Number(sgLon)) && Number(sgLon) >= -180 && Number(sgLon) <= 180;

  // Manual Form Submit
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res = validateSoilSampleRow(soilForm, 'manual-entry');
    if (!res.value) {
      setFormErrors(res.errors);
      return;
    }
    if (samples.some((s) => s.sampleId === res.value?.sampleId)) {
      setFormErrors([`Sample ID “${res.value.sampleId}” already exists. Choose a unique sample ID.`]);
      return;
    }
    const updated = [...samples, res.value];
    onUpdateSamples(updated);
    setSelectedSample(res.value);
    setSoilForm(EMPTY_SOIL_FORM);
    setFormErrors([]);
  };

  // CSV Handlers
  const handleCsvFile = (file?: File) => {
    setImportMessage(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportPreview({
        fileName: file.name,
        totalRows: 0,
        accepted: [],
        issues: [{ row: 0, message: 'File must have a .csv extension.' }],
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImportPreview(createCsvImportPreview(String(reader.result ?? ''), file.name));
    reader.onerror = () =>
      setImportPreview({
        fileName: file.name,
        totalRows: 0,
        accepted: [],
        issues: [{ row: 0, message: 'Could not read file.' }],
      });
    reader.readAsText(file);
  };

  const applyCsvImport = () => {
    if (!importPreview) return;
    const existingIds = new Set(samples.map((s) => s.sampleId));
    const newRecords = importPreview.accepted.filter((s) => !existingIds.has(s.sampleId));
    const duplicates = importPreview.accepted.length - newRecords.length;

    const merged = [...samples, ...newRecords];
    onUpdateSamples(merged);
    setImportMessage(
      `Imported ${newRecords.length} record${newRecords.length === 1 ? '' : 's'}${
        duplicates > 0 ? ` (${duplicates} duplicate IDs skipped)` : ''
      }.`,
    );
    setImportPreview(null);
  };

  const clearAllSamples = () => {
    if (window.confirm('Clear all recorded soil measurements?')) {
      onUpdateSamples([]);
      setSelectedSample(null);
    }
  };

  const measuredSamples = useMemo(
    () => samples.filter((sample) => sample.provenance !== 'seed-preset'),
    [samples],
  );

  // Summary Metrics
  const summary = useMemo(() => {
    if (measuredSamples.length === 0) return null;
    const avg = (fn: (s: SoilMeasurement) => number | undefined) => {
      const vals = measuredSamples.map(fn).filter((v): v is number => v !== undefined && Number.isFinite(v));
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return {
      count: measuredSamples.length,
      meanPh: avg((s) => s.ph),
      meanEc: avg((s) => s.ecDsM),
      meanN: avg((s) => s.nitrogenMgKg),
      meanP: avg((s) => s.phosphorusMgKg),
      meanK: avg((s) => s.potassiumMgKg),
      meanMoist: avg((s) => s.moisturePercentage),
    };
  }, [measuredSamples]);

  // Comparable Groups for Trends (FM-02)
  const comparableGroups = useMemo(() => {
    return groupSamplesForTrend(measuredSamples, trendParam);
  }, [measuredSamples, trendParam]);

  // SoilGrids Retrieval
  const runSoilGridsQuery = async () => {
    if (!sgCoordinatesValid) {
      setSgError('Enter a valid latitude (−90 to 90) and longitude (−180 to 180).');
      return;
    }
    setSgLoading(true);
    setSgError(null);
    setSgData(null);
    try {
      const res = await fetchSoilGridsContext(Number(sgLat), Number(sgLon), sgProp, sgDepth);
      setSgData(res);
    } catch (err) {
      setSgError(err instanceof Error ? err.message : 'Failed to query SoilGrids context.');
    } finally {
      setSgLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-border pb-3">
        <div className="flex rounded-lg border border-line-border bg-parchment-50 p-1">
          <button
            type="button"
            onClick={() => setSubTab('entry')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === 'entry' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            1. Sample Register & CSV
          </button>
          <button
            type="button"
            onClick={() => setSubTab('trends')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === 'trends' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            2. Observation Trends & Comparability (FM-02)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('soilgrids')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              subTab === 'soilgrids' ? 'bg-sage-700 text-parchment-50 shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            3. Regional SoilGrids Context (FM-03)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {samples.length > 0 && (
            <button
              type="button"
              onClick={clearAllSamples}
              className="inline-flex items-center gap-1 rounded border border-clay/30 bg-clay-subtle px-2 py-1 text-[11px] font-medium text-clay-dark hover:bg-clay/20"
            >
              <Trash2 size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: ENTRY & COVERAGE */}
      {subTab === 'entry' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="space-y-5">
            {/* Manual Form Card */}
            <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FlaskConical size={17} className="text-sage-700" />
                    <h2 className="font-serif text-lg font-bold text-ink">Record Soil Measurement</h2>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Values require collection timestamp, coordinates, analytical method, depth, and source. Preserved in local storage.
                  </p>
                </div>
                <StatusPill tone="sage">Manual Entry</StatusPill>
              </div>

              {formErrors.length > 0 && (
                <div className="mb-4 rounded-lg border border-clay/30 bg-clay-subtle p-3 text-xs text-clay-dark">
                  <div className="mb-1 flex items-center gap-1 font-semibold">
                    <AlertTriangle size={14} /> Review record issues
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {formErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FieldLabel label="Sample ID *" help="Unique code"><input required value={soilForm.sample_id} onChange={(e) => setSoilForm({ ...soilForm, sample_id: e.target.value })} className={inputClassName} placeholder="e.g. SE-014" /></FieldLabel>
                <FieldLabel label="Collection Date *" help="ISO date"><input required type="date" value={soilForm.collected_at} onChange={(e) => setSoilForm({ ...soilForm, collected_at: e.target.value })} className={inputClassName} /></FieldLabel>
                <FieldLabel label="Lab / Source *" help="Origin lab or survey"><input required value={soilForm.source} onChange={(e) => setSoilForm({ ...soilForm, source: e.target.value })} className={inputClassName} placeholder="PAU Soil Lab" /></FieldLabel>
                <FieldLabel label="Latitude *" help="-90 to 90"><input required inputMode="decimal" value={soilForm.latitude} onChange={(e) => setSoilForm({ ...soilForm, latitude: e.target.value })} className={inputClassName} placeholder="30.9015" /></FieldLabel>
                <FieldLabel label="Longitude *" help="-180 to 180"><input required inputMode="decimal" value={soilForm.longitude} onChange={(e) => setSoilForm({ ...soilForm, longitude: e.target.value })} className={inputClassName} placeholder="75.8524" /></FieldLabel>
                <FieldLabel label="pH *" help="0–14 scale"><input required inputMode="decimal" value={soilForm.ph} onChange={(e) => setSoilForm({ ...soilForm, ph: e.target.value })} className={inputClassName} placeholder="7.4" /></FieldLabel>
                <FieldLabel label="EC *" help="dS/m"><input required inputMode="decimal" value={soilForm.ec_ds_m} onChange={(e) => setSoilForm({ ...soilForm, ec_ds_m: e.target.value })} className={inputClassName} placeholder="0.65" /></FieldLabel>
                <FieldLabel label="Nitrogen *" help="mg/kg"><input required inputMode="decimal" value={soilForm.nitrogen_mg_kg} onChange={(e) => setSoilForm({ ...soilForm, nitrogen_mg_kg: e.target.value })} className={inputClassName} placeholder="54" /></FieldLabel>
                <FieldLabel label="Phosphorus *" help="mg/kg"><input required inputMode="decimal" value={soilForm.phosphorus_mg_kg} onChange={(e) => setSoilForm({ ...soilForm, phosphorus_mg_kg: e.target.value })} className={inputClassName} placeholder="26" /></FieldLabel>
                <FieldLabel label="Potassium *" help="mg/kg"><input required inputMode="decimal" value={soilForm.potassium_mg_kg} onChange={(e) => setSoilForm({ ...soilForm, potassium_mg_kg: e.target.value })} className={inputClassName} placeholder="215" /></FieldLabel>
                <FieldLabel label="Sampling Depth" help="e.g. 0-15 cm, 15-30 cm"><input value={soilForm.depth_interval} onChange={(e) => setSoilForm({ ...soilForm, depth_interval: e.target.value })} className={inputClassName} placeholder="0-15 cm" /></FieldLabel>
                <FieldLabel label="Analytical Method" help="Lab protocol"><input value={soilForm.method} onChange={(e) => setSoilForm({ ...soilForm, method: e.target.value })} className={inputClassName} placeholder="1:2.5 water / Bray-1" /></FieldLabel>
                <FieldLabel label="Moisture %" help="0–100 (optional)"><input inputMode="decimal" value={soilForm.moisture_pct} onChange={(e) => setSoilForm({ ...soilForm, moisture_pct: e.target.value })} className={inputClassName} placeholder="18.5" /></FieldLabel>
                <FieldLabel label="Soil Temp (°C)" help="optional"><input inputMode="decimal" value={soilForm.temperature_c} onChange={(e) => setSoilForm({ ...soilForm, temperature_c: e.target.value })} className={inputClassName} placeholder="19.0" /></FieldLabel>
                <FieldLabel label="Lab Report ID" help="optional"><input value={soilForm.lab_report_id} onChange={(e) => setSoilForm({ ...soilForm, lab_report_id: e.target.value })} className={inputClassName} placeholder="LAB-2026-99" /></FieldLabel>
                <div className="sm:col-span-2 lg:col-span-3">
                  <FieldLabel label="Notes & Soil Classification" help="Horizon, soil texture class, or observation notes">
                    <input value={soilForm.notes} onChange={(e) => setSoilForm({ ...soilForm, notes: e.target.value })} className={inputClassName} placeholder="Composite topsoil, sandy loam." />
                  </FieldLabel>
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button type="submit" className="button button--primary">
                    Record Measurement
                  </button>
                </div>
              </form>
            </section>

            {/* CSV Import Card */}
            <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={17} className="text-sage-700" />
                    <h2 className="font-serif text-lg font-bold text-ink">CSV Import Register</h2>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Validate soil observation rows in browser memory before merging. Requires explicit units and headers.
                  </p>
                </div>
                <StatusPill tone="slate">2 MB limit</StatusPill>
              </div>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-line-border bg-parchment-100/60 p-3 transition hover:border-sage-500 hover:bg-sage-50">
                <span className="flex items-center gap-2 text-xs font-medium text-ink">
                  <Upload size={16} className="text-sage-700" /> Select CSV file for local validation
                </span>
                <span className="text-[11px] text-ink-subtle">No cloud upload</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => handleCsvFile(e.target.files?.[0])} />
              </label>

              <p className="mt-2 text-[10px] text-ink-subtle">
                Headers: {SOIL_CSV_HEADERS.slice(0, 10).join(', ')}, depth_cm, method, moisture_pct, notes.
              </p>

              {importPreview && (
                <div className="mt-4 rounded-lg border border-line-border bg-parchment-100 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{importPreview.fileName}</span>
                    <span className="font-mono text-sage-800">
                      {importPreview.accepted.length} valid / {importPreview.totalRows} rows
                    </span>
                  </div>

                  {importPreview.issues.length > 0 && (
                    <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto border-t border-line-subtle pt-2 text-clay-dark">
                      {importPreview.issues.slice(0, 6).map((issue, idx) => (
                        <li key={idx}>Row {issue.row || '—'}: {issue.message}</li>
                      ))}
                      {importPreview.issues.length > 6 && <li>…and {importPreview.issues.length - 6} more issue(s).</li>}
                    </ul>
                  )}

                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setImportPreview(null)} className="rounded px-2.5 py-1 text-xs text-ink-muted hover:bg-parchment-200">
                      Discard
                    </button>
                    <button
                      type="button"
                      disabled={importPreview.accepted.length === 0}
                      onClick={applyCsvImport}
                      className="button button--primary !text-xs disabled:opacity-50"
                    >
                      <Import size={13} /> Add {importPreview.accepted.length} Valid Records
                    </button>
                  </div>
                </div>
              )}

              {importMessage && (
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-sage-800">
                  <CheckCircle2 size={14} /> {importMessage}
                </p>
              )}
            </section>
          </div>

          {/* Right Column: Coverage & Inspection */}
          <aside className="space-y-5">
            <section className="rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-sage-700" />
                    <h2 className="font-serif text-base font-bold text-ink">Sample Coverage</h2>
                  </div>
                  <p className="text-[11px] text-ink-muted">Relative coordinate scatter within bounding box.</p>
                </div>
                <span className="font-mono text-xs font-bold text-sage-800">{measuredSamples.length} measured/imported</span>
              </div>

              <SampleCoverageMap
                samples={samples}
                selectedSampleId={selectedSample?.sampleId ?? null}
                onSelectSample={(s) => {
                  setSelectedSample(s);
                  if (s.provenance !== 'seed-preset') {
                    setSgLat(String(s.latitude));
                    setSgLon(String(s.longitude));
                    setSgData(null);
                  }
                }}
              />

              {summary && (
                <div className="mt-3 grid grid-cols-3 divide-x divide-line-subtle rounded-lg border border-line-subtle bg-parchment-100/80 text-center text-[10px]">
                  <div className="p-2">
                    <span className="block font-mono text-sm font-semibold text-ink">
                      {summary.meanPh?.toFixed(2) ?? '—'}
                    </span>
                    <span className="text-ink-subtle">mean pH</span>
                  </div>
                  <div className="p-2">
                    <span className="block font-mono text-sm font-semibold text-ink">
                      {summary.meanEc?.toFixed(2) ?? '—'}
                    </span>
                    <span className="text-ink-subtle">mean EC (dS/m)</span>
                  </div>
                  <div className="p-2">
                    <span className="block font-mono text-sm font-semibold text-ink">
                      {summary.meanN ? Math.round(summary.meanN) : '—'}
                    </span>
                    <span className="text-ink-subtle">mean N (mg/kg)</span>
                  </div>
                </div>
              )}
            </section>

            {/* Selected Sample Detail Inspector */}
            {selectedSample ? (
              <section className="rounded-xl border border-line-border bg-parchment-50 p-4 shadow-instrument">
                <div className="flex items-start justify-between gap-2 border-b border-line-subtle pb-2">
                  <div>
                    <h3 className="font-mono text-xs font-bold text-ink">{selectedSample.sampleId}</h3>
                    <p className="text-[10px] text-ink-subtle">{selectedSample.collectedAt} · {selectedSample.source}</p>
                  </div>
                  <StatusPill tone={selectedSample.provenance === 'seed-preset' ? 'amber' : selectedSample.provenance === 'csv-import' ? 'slate' : 'sage'}>
                    {selectedSample.provenance === 'seed-preset' ? 'Synthetic legacy — excluded' : selectedSample.provenance}
                  </StatusPill>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div><dt className="text-ink-subtle">Depth Stratum</dt><dd className="font-mono font-medium text-ink">{selectedSample.depthInterval || `${selectedSample.depthCm} cm` || 'Unrecorded'}</dd></div>
                  <div><dt className="text-ink-subtle">Method</dt><dd className="font-mono font-medium text-ink">{selectedSample.method || 'Standard extraction'}</dd></div>
                  <div><dt className="text-ink-subtle">pH</dt><dd className="font-mono font-medium text-ink">{selectedSample.ph.toFixed(2)}</dd></div>
                  <div><dt className="text-ink-subtle">EC</dt><dd className="font-mono font-medium text-ink">{selectedSample.ecDsM.toFixed(2)} dS/m</dd></div>
                  <div><dt className="text-ink-subtle">N · P · K</dt><dd className="font-mono font-medium text-ink">{Math.round(selectedSample.nitrogenMgKg)} · {Math.round(selectedSample.phosphorusMgKg)} · {Math.round(selectedSample.potassiumMgKg)} mg/kg</dd></div>
                  {selectedSample.moisturePercentage !== undefined && (
                    <div><dt className="text-ink-subtle">Moisture</dt><dd className="font-mono font-medium text-ink">{selectedSample.moisturePercentage}% ({selectedSample.moistureUnit})</dd></div>
                  )}
                </dl>

                {selectedSample.notes && (
                  <p className="mt-2 rounded bg-parchment-100 p-1.5 text-[10px] leading-4 text-ink-muted">
                    {selectedSample.notes}
                  </p>
                )}

                <div className="mt-3 flex justify-between gap-2 border-t border-line-subtle pt-2">
                  {selectedSample.provenance !== 'seed-preset' && <button
                    type="button"
                    onClick={() => {
                      setSgLat(String(selectedSample.latitude));
                      setSgLon(String(selectedSample.longitude));
                      setSubTab('soilgrids');
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-sage-800 hover:underline"
                  >
                    View SoilGrids for this site <ChevronRight size={12} />
                  </button>}
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-dashed border-line-border p-4 text-center text-xs text-ink-subtle">
                Click a pin on the coverage map to inspect individual sample metadata.
              </div>
            )}
          </aside>
        </div>
      )}

      {/* SUB-TAB 2: OBSERVATION TRENDS & COMPARABILITY (FM-02) */}
      {subTab === 'trends' && (
        <section className="space-y-5 rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-3">
            <div>
              <div className="flex items-center gap-2">
                <LineChart size={18} className="text-sage-700" />
                <h2 className="font-serif text-lg font-bold text-ink">Observation Trends & Comparability Engine (FM-02)</h2>
              </div>
              <p className="text-xs text-ink-muted">
                FM-02 Rule: Repeated soil readings are graphed only when their parameters, units, methods, depths, and time context are comparable; otherwise they remain separate observations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-muted">Parameter:</span>
              <select
                value={trendParam}
                onChange={(e) => setTrendParam(e.target.value as MeasurableParameter)}
                className="rounded border border-line-border bg-parchment-100 px-2.5 py-1 text-xs font-medium text-ink outline-none"
              >
                {Object.values(PARAMETER_METAS).map((meta) => (
                  <option key={meta.key} value={meta.key}>
                    {meta.label} ({meta.defaultUnit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {comparableGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-border p-8 text-center text-xs text-ink-subtle">
              No measurements recorded for {PARAMETER_METAS[trendParam].label}. Add or import soil samples to evaluate temporal trends.
            </div>
          ) : (
            <div className="space-y-5">
              {comparableGroups.map((group) => (
                <div key={group.groupKey} className="rounded-xl border border-line-border bg-parchment-100/50 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-line-subtle pb-2">
                    <div>
                      <h3 className="font-serif text-sm font-bold text-ink">{group.siteLabel}</h3>
                      <p className="text-[11px] text-ink-muted">
                        Depth: <strong>{group.depth}</strong> · Method: <strong>{group.method}</strong> · Unit: <strong>{group.unit}</strong>
                      </p>
                    </div>
                    <StatusPill tone={group.isComparable ? 'sage' : 'amber'}>
                      {group.isComparable ? `${group.readings.length} Comparable Points` : 'Isolated Stratum'}
                    </StatusPill>
                  </div>

                  {/* Comparability boundary notice if depths/methods differed */}
                  {group.incomparabilityReason && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amberGold/30 bg-amberGold-subtle p-2.5 text-xs text-amberGold-dark">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      <p className="leading-5">{group.incomparabilityReason}</p>
                    </div>
                  )}

                  {/* Render SVG Trend Chart if >= 2 points and comparable */}
                  {group.readings.length >= 2 ? (
                    <div className="space-y-2">
                      <div className="h-44 w-full">
                        <svg className="h-full w-full overflow-visible" viewBox="0 0 500 140">
                          {/* Guides */}
                          <line x1="40" y1="20" x2="480" y2="20" stroke="#d5ded3" strokeDasharray="3 3" />
                          <line x1="40" y1="70" x2="480" y2="70" stroke="#d5ded3" strokeDasharray="3 3" />
                          <line x1="40" y1="120" x2="480" y2="120" stroke="#d5ded3" />

                          {(() => {
                            const vals = group.readings.map((r) => r.value);
                            const minVal = Math.min(...vals) * 0.9;
                            const maxVal = Math.max(...vals) * 1.1 || 1;
                            const valSpan = maxVal - minVal || 1;

                            const points = group.readings.map((r, idx) => {
                              const x = 50 + (idx / (group.readings.length - 1)) * 420;
                              const y = 120 - ((r.value - minVal) / valSpan) * 100;
                              return { x, y, r };
                            });

                            const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                            return (
                              <g>
                                <path d={pathD} fill="none" stroke="#32745b" strokeWidth="2.5" strokeLinecap="round" />
                                {points.map((p, idx) => (
                                  <g key={idx}>
                                    <circle cx={p.x} cy={p.y} r="5" fill="#f5f7f3" stroke="#32745b" strokeWidth="2.5" />
                                    <text x={p.x} y={p.y - 9} textAnchor="middle" className="font-mono text-[9px] font-bold fill-sage-900">
                                      {p.r.value}
                                    </text>
                                    <text x={p.x} y="134" textAnchor="middle" className="font-mono text-[8px] fill-ink-subtle">
                                      {p.r.collectedAt.slice(5)}
                                    </text>
                                  </g>
                                ))}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                      <p className="text-[10px] text-ink-subtle text-right">
                        Chronological sequence: {group.readings[0].collectedAt} → {group.readings[group.readings.length - 1].collectedAt}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-line-border p-3 text-center text-xs text-ink-subtle">
                      Single observation point ({group.readings[0].value} {group.unit} on {group.readings[0].collectedAt}). Requires &ge;2 comparable temporal readings to plot a trend line.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUB-TAB 3: REGIONAL SOILGRIDS CONTEXT (FM-03, FM-04) */}
      {subTab === 'soilgrids' && (
        <section className="space-y-5 rounded-xl border border-line-border bg-parchment-50 p-5 shadow-instrument">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Database size={18} className="text-sage-700" />
                <h2 className="font-serif text-lg font-bold text-ink">Regional SoilGrids Context (FM-03, FM-04)</h2>
              </div>
              <p className="text-xs text-ink-muted">
                Intended for broad modeled context only—not field measurements or zoning inputs. The local SoilGrids provider is currently unavailable.
              </p>
            </div>
            <StatusPill tone="amber">Modeled Regional Context</StatusPill>
          </div>

          <div role="status" className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-xs leading-5 text-amberGold-dark">
            No verified ISRIC data adapter is configured in this build. The former local coordinate formula has been removed; no regional estimate will be shown until a real WCS/WebDAV-backed provider is implemented and verified.
          </div>

          {/* Query Inputs Card */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-line-border bg-parchment-100/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FieldLabel label="Latitude" help="Decimal degrees">
              <input required type="number" min="-90" max="90" step="any" value={sgLat} onChange={(e) => { setSgLat(e.target.value); setSgData(null); }} className={inputClassName} placeholder="Enter coordinates or select a sample" />
            </FieldLabel>
            <FieldLabel label="Longitude" help="Decimal degrees">
              <input required type="number" min="-180" max="180" step="any" value={sgLon} onChange={(e) => { setSgLon(e.target.value); setSgData(null); }} className={inputClassName} placeholder="Enter coordinates or select a sample" />
            </FieldLabel>
            <FieldLabel label="Soil Property" help="SoilGrids analyte">
              <select value={sgProp} onChange={(e) => { setSgProp(e.target.value); setSgData(null); }} className={inputClassName}>
                <option value="phh2o">Soil pH (in H2O)</option>
                <option value="nitrogen">Total Nitrogen (g/kg)</option>
                <option value="soc">Soil Organic Carbon (g/kg)</option>
                <option value="cec">Cation Exchange Capacity (cmol(+)/kg)</option>
                <option value="bdod">Bulk Density (kg/dm³)</option>
                <option value="clay">Clay Content (%)</option>
                <option value="sand">Sand Content (%)</option>
                <option value="silt">Silt Content (%)</option>
              </select>
            </FieldLabel>
            <FieldLabel label="Standard Depth" help="Depth interval">
              <select value={sgDepth} onChange={(e) => { setSgDepth(e.target.value); setSgData(null); }} className={inputClassName}>
                <option value="0-5cm">0–5 cm (Surface layer)</option>
                <option value="5-15cm">5–15 cm (Topsoil)</option>
                <option value="15-30cm">15–30 cm (Root zone)</option>
                <option value="30-60cm">30–60 cm (Subsoil)</option>
                <option value="60-100cm">60–100 cm (Deep subsoil)</option>
                <option value="100-200cm">100–200 cm (Substratum)</option>
              </select>
            </FieldLabel>

            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
              <div className="text-[11px] text-ink-subtle">
                Supported UI properties and depth layers are listed; this is not proof of provider availability.
              </div>
              <button
                type="button"
                onClick={runSoilGridsQuery}
                disabled={sgLoading || !sgCoordinatesValid}
                className="button button--primary"
              >
                {sgLoading ? <RefreshCw size={13} className="spin" /> : 'Retrieve Regional Estimate'}
              </button>
            </div>
          </div>

          {sgError && (
            <div className="rounded-lg border border-clay/30 bg-clay-subtle p-3 text-xs text-clay-dark">
              {sgError}
            </div>
          )}

          {/* Results Display (FM-03) */}
          {sgData && (
            <div className="space-y-4 rounded-xl border border-line-border bg-parchment-50 p-5 shadow-sm">
              {/* Prominent Header & Disclosures */}
              <div className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3.5">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amberGold-dark" />
                  <span className="font-serif text-sm font-bold text-amberGold-dark">
                    {sgData.modeledContextLabel}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-amberGold-dark">
                  {sgData.uncertaintyDisclosure}
                </p>
              </div>

              {/* Estimate & Quantile Gauge */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-line-border bg-parchment-100 p-4 text-center">
                  <span className="block text-[10px] uppercase font-bold text-ink-subtle">Lower Bound (Q0.05)</span>
                  <span className="font-mono text-xl font-bold text-ink">{sgData.quantiles.q05}</span>
                  <span className="block text-[10px] text-ink-subtle">{sgData.unit}</span>
                </div>
                <div className="rounded-lg border-2 border-sage-600 bg-sage-50/60 p-4 text-center shadow-sm">
                  <span className="block text-[10px] uppercase font-bold text-sage-800">Median Estimate (Q0.50)</span>
                  <span className="font-mono text-2xl font-bold text-sage-900">{sgData.mappedValue}</span>
                  <span className="block text-[10px] font-semibold text-sage-800">{sgData.unit}</span>
                </div>
                <div className="rounded-lg border border-line-border bg-parchment-100 p-4 text-center">
                  <span className="block text-[10px] uppercase font-bold text-ink-subtle">Upper Bound (Q0.95)</span>
                  <span className="font-mono text-xl font-bold text-ink">{sgData.quantiles.q95}</span>
                  <span className="block text-[10px] text-ink-subtle">{sgData.unit}</span>
                </div>
              </div>

              {/* Quantile Visualization Bar */}
              <div className="space-y-1.5 rounded-lg border border-line-subtle bg-parchment-100/70 p-3">
                <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                  <span>Q0.05–Q0.95 model-quantile span: [{sgData.quantiles.q05} – {sgData.quantiles.q95} {sgData.unit}]</span>
                  <span>Spread: {(sgData.quantiles.q95 - sgData.quantiles.q05).toFixed(2)}</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-parchment-200">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-sage-300" style={{ width: '100%' }} />
                  <div
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-parchment-50 bg-sage-800 shadow"
                    style={{ left: `${sgData.quantiles.q95 === sgData.quantiles.q05 ? 50 : ((sgData.mappedValue - sgData.quantiles.q05) / (sgData.quantiles.q95 - sgData.quantiles.q05)) * 100}%` }}
                    title={`Median: ${sgData.mappedValue}`}
                  />
                </div>
              </div>

              {/* Provenance and Separation Disclaimer (FM-04) */}
              <div className="border-t border-line-subtle pt-3 text-[11px] leading-5 text-ink-muted">
                <p><strong>Source Attribution:</strong> {sgData.source}</p>
                <p><strong>Query Coordinates:</strong> {sgData.latitude.toFixed(4)}°N, {sgData.longitude.toFixed(4)}°E · Depth: {sgData.depth}</p>
                <p><strong>Retrieval Timestamp:</strong> {sgData.retrievalDate}</p>
                <p className="mt-2 font-medium text-sage-800">
                  🛡️ {sgData.disclaimer}
                </p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
