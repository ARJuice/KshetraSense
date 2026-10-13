import { Component, lazy, Suspense, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Crosshair,
  Download,
  FlaskConical,
  Focus,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Play,
  Plus,
  Settings2,
  Sprout,
  Trash2,
  Upload,
} from 'lucide-react';
import { evaluateFieldCropFit, runFieldZoning, type CropFitMeasurementContext, type CropFitResponse } from '../../services/zoningApi';
import { FieldMap2D } from './field/FieldMap2D';
import { getFieldLayerRange, ZONE_COLORS, type FieldLayer } from './field/fieldDisplay';
import { estimateGeometryTriangleCount, parseFieldBoundary, type GeoJsonPolygon, type Position } from './field/fieldGeometry';
import {
  buildFieldZoningRequest,
  createBlankSoilSample,
  SOIL_PROPERTIES,
  type SoilSampleDraft,
} from './field/fieldSamples';
import { parseSoilSampleCsv } from './field/soilSampleCsv';
import type { FieldZoningOptions, FieldZoningResponse, SoilMeasurements, SoilProperty } from './field/fieldTypes';
import './zoning.css';

const FieldScene3D = lazy(() => import('./field/FieldScene3D').then(({ FieldScene3D: Scene }) => ({ default: Scene })));
const EMPTY_CELLS: FieldZoningResponse['cells'] = [];
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_3D_CELLS = 768;
const MAX_3D_TRIANGLES = 20_000;
const MAX_3D_OVERLAY_TRIANGLES = 1_300;
const SOIL_LABELS: Record<SoilProperty, string> = {
  pH: 'pH', ec: 'Electrical conductivity', nitrogen: 'Nitrogen', phosphorus: 'Phosphorus', potassium: 'Potassium',
};
const SOIL_UNITS: Record<SoilProperty, string> = {
  pH: 'pH', ec: 'dS/m', nitrogen: 'mg/kg', phosphorus: 'mg/kg', potassium: 'mg/kg',
};
const LAYER_OPTIONS: Array<{ value: FieldLayer; label: string; unit: string }> = [
  { value: 'zone', label: 'Management zones', unit: '' },
  { value: 'pH', label: 'pH', unit: 'pH' },
  { value: 'ec', label: 'Electrical conductivity', unit: 'dS/m' },
  { value: 'nitrogen', label: 'Nitrogen', unit: 'mg/kg' },
  { value: 'phosphorus', label: 'Phosphorus', unit: 'mg/kg' },
  { value: 'potassium', label: 'Potassium', unit: 'mg/kg' },
  { value: 'shi', label: 'KshetraSense SHI', unit: '0–100' },
  { value: 'membership', label: 'FCM membership', unit: '0–1' },
];
const INITIAL_OPTIONS: FieldZoningOptions = {
  cellSizeM: 10,
  method: 'fcm',
  maxK: 6,
  seed: 42,
  mergeThresholdZ: 0.5,
  perturbationRuns: 10,
  fcm: { fuzziness: 2, maxIterations: 150, tolerance: 1e-5 },
};

interface AnalysisRun {
  response: FieldZoningResponse;
  inputRevision: number;
  boundaryRevision: number;
}

interface CropFitState {
  key: string;
  status: 'loading' | 'ready' | 'error';
  response?: CropFitResponse;
  error?: string;
}

type SampleTextField = 'id' | 'latitude' | 'longitude' | 'depthCm' | 'collectionDate' | 'labMethod';

function prettyValue(value: number, digits = 2): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function shortRunId(value: string): string {
  return value.startsWith('field-zoning-') ? value.slice('field-zoning-'.length, 'field-zoning-'.length + 8) : value.slice(0, 12);
}

function nextSampleId(samples: readonly SoilSampleDraft[]): string {
  for (let sequence = 1; sequence <= 50; sequence += 1) {
    const id = `S-${String(sequence).padStart(2, '0')}`;
    if (!samples.some((sample) => sample.id === id)) return id;
  }
  return 'S-50';
}

function isSampleComplete(sample: SoilSampleDraft): boolean {
  return Boolean(
    sample.id.trim() && sample.latitude.trim() && sample.longitude.trim() && sample.depthCm.trim()
    && SOIL_PROPERTIES.every((property) => sample.measurements[property].trim()),
  );
}

function isFieldPosition(value: string, min: number, max: number): boolean {
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function getUnits(layer: FieldLayer): string {
  return LAYER_OPTIONS.find((option) => option.value === layer)?.unit ?? '';
}

export function ZoningWorkspace() {
  const [boundary, setBoundary] = useState<GeoJsonPolygon | null>(null);
  const [boundaryName, setBoundaryName] = useState('');
  const [boundaryRevision, setBoundaryRevision] = useState(0);
  const [samples, setSamples] = useState<SoilSampleDraft[]>([]);
  const [options, setOptions] = useState<FieldZoningOptions>(INITIAL_OPTIONS);
  const [inputRevision, setInputRevision] = useState(0);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [layer, setLayer] = useState<FieldLayer>('zone');
  const [membershipCluster, setMembershipCluster] = useState(0);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [fitTrigger, setFitTrigger] = useState(0);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [cropFitScope, setCropFitScope] = useState<'cell' | 'zone'>('cell');
  const [cropContext, setCropContext] = useState<CropFitMeasurementContext>({
    sourceScope: '', soilTestMethod: 'Not supplied', sampleDepth: 'Not supplied', ecMethod: 'Not supplied',
  });
  const [cropFitState, setCropFitState] = useState<CropFitState | null>(null);
  const cropRequestId = useRef(0);
  const [hoveredCellId, setHoveredCellId] = useState<string | null>(null);

  const invalidateCropFit = () => {
    cropRequestId.current += 1;
    setCropFitState(null);
  };
  const markInputsChanged = () => {
    setInputRevision((current) => current + 1);
    setInputError(null);
    invalidateCropFit();
  };
  const stale = Boolean(analysis && (analysis.inputRevision !== inputRevision || analysis.boundaryRevision !== boundaryRevision));
  const geometryStale = Boolean(analysis && analysis.boundaryRevision !== boundaryRevision);
  const response = analysis?.response ?? null;
  const displayBoundary = geometryStale ? boundary : response?.field.boundary ?? boundary;
  const displayCells = analysis && !geometryStale ? response?.cells ?? EMPTY_CELLS : EMPTY_CELLS;
  const displayZones = analysis && !geometryStale ? response?.zones ?? [] : [];
  const mapSamples = useMemo(() => samples.flatMap((sample) => {
    if (!isFieldPosition(sample.latitude, -80, 84) || !isFieldPosition(sample.longitude, -180, 180)) return [];
    return [{ id: sample.id, latitude: Number(sample.latitude), longitude: Number(sample.longitude) }];
  }), [samples]);
  const range = useMemo(
    () => getFieldLayerRange(displayCells, layer, membershipCluster),
    [displayCells, layer, membershipCluster],
  );
  const estimated3DTriangles = useMemo(() => {
    if (!displayBoundary) return 0;
    return displayCells.reduce((total, cell) => total + estimateGeometryTriangleCount(cell.geometry), estimateGeometryTriangleCount(displayBoundary))
      + MAX_3D_OVERLAY_TRIANGLES;
  }, [displayBoundary, displayCells]);
  const selectedCell = displayCells.find((cell) => cell.cellId === selectedCellId) ?? null;
  const selectedZone = displayZones.find((zone) => zone.zoneId === selectedZoneId) ?? null;
  const selectedSample = samples.find((sample) => sample.id === selectedSampleId) ?? null;
  const activeLayer = LAYER_OPTIONS.find((option) => option.value === layer)!;
  const canUse3D = displayCells.length > 0 && displayCells.length <= MAX_3D_CELLS && estimated3DTriangles <= MAX_3D_TRIANGLES;
  const threeDLimitMessage = displayCells.length > MAX_3D_CELLS
    ? `3D is limited to ${MAX_3D_CELLS} cells to protect rendering performance.`
    : estimated3DTriangles > MAX_3D_TRIANGLES
      ? `The field geometry exceeds the ${MAX_3D_TRIANGLES.toLocaleString()}-triangle 3D budget; use the full 2D map.`
      : undefined;
  const completeSampleCount = samples.filter(isSampleComplete).length;
  const statusLabel = !analysis ? 'Setup required' : stale ? 'Previous analysis · stale' : 'Analysis current';
  const hoveredCell = hoveredCellId ? displayCells.find((cell) => cell.cellId === hoveredCellId) ?? null : null;

  const handleBoundaryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBoundaryError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setBoundaryError('GeoJSON files must be 2 MB or smaller. Simplify the boundary and try again.');
      return;
    }
    try {
      const parsed = parseFieldBoundary(JSON.parse(await file.text()));
      setBoundary(parsed);
      setBoundaryName(file.name);
      setBoundaryRevision((current) => current + 1);
      setSelectedCellId(null);
      setSelectedZoneId(null);
      setSelectedSampleId(null);
      setPlacementMode(false);
      setView('2d');
      markInputsChanged();
    } catch (reason) {
      setBoundaryError(reason instanceof Error ? reason.message : 'Could not read this GeoJSON boundary.');
    }
  };

  const handleSampleCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setSampleError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setSampleError('Soil-sample CSV files must be 2 MB or smaller.');
      return;
    }
    try {
      const result = parseSoilSampleCsv(await file.text());
      if (result.errors.length) {
        setSampleError(result.errors.join(' '));
        return;
      }
      setSamples(result.samples);
      setSelectedSampleId(null);
      setSampleError(null);
      setPlacementMode(false);
      markInputsChanged();
    } catch (reason) {
      setSampleError(reason instanceof Error ? reason.message : 'Could not read this soil-sample CSV.');
    }
  };

  const patchSample = (id: string, change: (sample: SoilSampleDraft) => SoilSampleDraft) => {
    setSamples((current) => current.map((sample) => sample.id === id ? change(sample) : sample));
    markInputsChanged();
  };

  const addBlankSample = () => {
    if (samples.length >= 50) {
      setSampleError('The field-zoning service accepts at most 50 samples.');
      return;
    }
    const sample = createBlankSoilSample(nextSampleId(samples));
    setSamples((current) => [...current, sample]);
    setSelectedSampleId(sample.id);
    setSampleError(null);
    markInputsChanged();
  };

  const removeSample = (id: string) => {
    setSamples((current) => current.filter((sample) => sample.id !== id));
    if (selectedSampleId === id) setSelectedSampleId(null);
    markInputsChanged();
  };

  const placeSampleAt = (position: Position) => {
    const [longitude, latitude] = position;
    const emptyDraft = samples.find((sample) => !sample.latitude.trim() || !sample.longitude.trim());
    if (emptyDraft) {
      patchSample(emptyDraft.id, (sample) => ({
        ...sample, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6),
      }));
      setSelectedSampleId(emptyDraft.id);
      return;
    }
    if (samples.length >= 50) {
      setSampleError('The field-zoning service accepts at most 50 samples.');
      return;
    }
    const sample = {
      ...createBlankSoilSample(nextSampleId(samples)),
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    };
    setSamples((current) => [...current, sample]);
    setSelectedSampleId(sample.id);
    setSampleError(null);
    markInputsChanged();
  };

  const updateOptions = (change: (current: FieldZoningOptions) => FieldZoningOptions) => {
    setOptions(change);
    markInputsChanged();
  };

  const runAnalysis = async () => {
    if (!boundary) {
      setInputError('Import a valid GeoJSON field boundary before analysis.');
      return;
    }
    let request: ReturnType<typeof buildFieldZoningRequest>;
    try {
      request = buildFieldZoningRequest(boundary, samples, options);
    } catch (reason) {
      setInputError(reason instanceof Error ? reason.message : 'Check the field inputs before analysis.');
      return;
    }
    const revisionAtStart = inputRevision;
    const boundaryRevisionAtStart = boundaryRevision;
    setInputError(null);
    setIsRunning(true);
    try {
      const result = await runFieldZoning(request);
      setAnalysis({ response: result, inputRevision: revisionAtStart, boundaryRevision: boundaryRevisionAtStart });
      setLayer('zone');
      setView('2d');
      setMembershipCluster(0);
      setSelectedCellId(null);
      setSelectedZoneId(null);
      setSelectedSampleId(null);
      setCropFitScope('cell');
      const recordedMethods = [...new Set(result.samples.map((sample) => sample.labMethod?.trim()).filter((method): method is string => Boolean(method)))];
      setCropContext({
        sourceScope: '',
        soilTestMethod: recordedMethods.length === 1 && result.samples.every((sample) => sample.labMethod?.trim())
          ? recordedMethods[0]
          : 'Mixed or not supplied; see sample warnings',
        sampleDepth: result.samples[0]?.depthCm ?? 'Not supplied',
        ecMethod: 'Not supplied',
      });
    } catch (reason) {
      setInputError(reason instanceof Error ? reason.message : 'The zoning service could not process this field.');
    } finally {
      setIsRunning(false);
    }
  };

  const updateCropContext = (key: keyof CropFitMeasurementContext, value: string) => {
    setCropContext((current) => ({ ...current, [key]: value }));
    invalidateCropFit();
  };

  const cropProfile: SoilMeasurements | null = cropFitScope === 'cell'
    ? selectedCell?.soilValues ?? null
    : selectedZone?.meanSoilValues ?? null;
  const cropTargetLabel = cropFitScope === 'cell' && selectedCell
    ? `Cell R${selectedCell.row + 1} · C${selectedCell.column + 1}`
    : cropFitScope === 'zone' && selectedZone
      ? `Zone ${selectedZone.zoneId + 1} mean`
      : null;
  const cropTargetKey = response && cropProfile && cropTargetLabel
    ? `${response.runId}|${cropFitScope}|${cropTargetLabel}|${cropContext.soilTestMethod}|${cropContext.sampleDepth}|${cropContext.ecMethod}`
    : '';
  const currentCropFit = cropFitState?.key === cropTargetKey ? cropFitState : null;

  const runCropFit = async () => {
    if (!cropProfile || !cropTargetLabel || !cropTargetKey) return;
    const context = { ...cropContext, sourceScope: cropTargetLabel };
    const requestId = cropRequestId.current + 1;
    cropRequestId.current = requestId;
    setCropFitState({ key: cropTargetKey, status: 'loading' });
    try {
      const result = await evaluateFieldCropFit(cropProfile, context);
      if (cropRequestId.current !== requestId) return;
      setCropFitState({ key: cropTargetKey, status: 'ready', response: result });
    } catch (reason) {
      if (cropRequestId.current !== requestId) return;
      setCropFitState({
        key: cropTargetKey,
        status: 'error',
        error: reason instanceof Error ? reason.message : 'Crop-fit service unavailable.',
      });
    }
  };

  const selectCell = (cell: FieldZoningResponse['cells'][number]) => {
    setSelectedCellId(cell.cellId);
    setSelectedZoneId(cell.zoneId);
    setSelectedSampleId(null);
    setCropFitScope('cell');
    setHoveredCellId(null);
    invalidateCropFit();
  };

  const selectZone = (zoneId: number) => {
    setSelectedZoneId(zoneId);
    setSelectedCellId(null);
    setSelectedSampleId(null);
    setCropFitScope('zone');
    invalidateCropFit();
  };

  const selectSample = (id: string) => {
    setSelectedSampleId(id);
    setSelectedCellId(null);
    setSelectedZoneId(null);
    invalidateCropFit();
  };

  const downloadResult = () => {
    if (!response) return;
    const file = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${response.runId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearBoundary = () => {
    setBoundary(null);
    setBoundaryName('');
    setBoundaryRevision((current) => current + 1);
    setPlacementMode(false);
    setSelectedCellId(null);
    setSelectedZoneId(null);
    setSelectedSampleId(null);
    markInputsChanged();
  };

  return (
    <section className="workspace zoning-workspace">
      <header className="zoning-header">
        <div>
          <p className="zoning-eyebrow">FIELD ANALYSIS · SOIL ZONING</p>
          <h1>Soil zoning</h1>
          <p>Bring a field boundary and measured soil samples. The map is built only from the analysis service response.</p>
        </div>
        <div className={`zoning-run-state ${stale ? 'is-stale' : analysis ? 'is-current' : ''}`} role="status">
          {stale ? <AlertCircle size={16} /> : analysis ? <Check size={16} /> : <Crosshair size={16} />}
          <span>{statusLabel}</span>
          {analysis && <small>Run {shortRunId(response!.runId)}</small>}
        </div>
      </header>

      <div className="zoning-layout">
        <aside className="zoning-input-column" aria-label="Field input and run settings">
          <section className="zoning-panel">
            <div className="zoning-panel__heading">
              <div><span className="zoning-step">01</span><h2>Field boundary</h2></div>
              {boundary && <span className="zoning-check"><Check size={13} /> Loaded</span>}
            </div>
            <label className="zoning-upload">
              <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleBoundaryUpload} />
              <MapIcon size={19} />
              <strong>{boundary ? 'Replace GeoJSON' : 'Import GeoJSON'}</strong>
              <span>Polygon or Polygon Feature · WGS84</span>
            </label>
            {boundaryName && <div className="zoning-file-row"><span title={boundaryName}>{boundaryName}</span><button type="button" onClick={clearBoundary} aria-label="Remove field boundary">Remove</button></div>}
            {boundaryError && <p className="zoning-inline-error" role="alert"><AlertCircle size={14} />{boundaryError}</p>}
            <p className="zoning-help">No farm geometry or measurements are preloaded. Self-intersection and projection limits are checked by the service before computation.</p>
          </section>

          <section className="zoning-panel zoning-samples-panel">
            <div className="zoning-panel__heading">
              <div><span className="zoning-step">02</span><h2>Soil samples</h2></div>
              <span className={`zoning-count ${completeSampleCount >= 3 ? 'is-ready' : ''}`}>{completeSampleCount} / 3 complete</span>
            </div>
            <div className="zoning-action-row">
              <label className="zoning-small-button">
                <input type="file" accept=".csv,text/csv" onChange={handleSampleCsvUpload} />
                <Upload size={15} /> Import CSV
              </label>
              <button type="button" className="zoning-small-button" onClick={addBlankSample} disabled={samples.length >= 50}>
                <Plus size={15} /> Add sample
              </button>
            </div>
            {boundary && <button type="button" className={`zoning-place-button ${placementMode ? 'is-active' : ''}`} onClick={() => { setView('2d'); setPlacementMode((active) => !active); }}>
              <MapPin size={15} /> {placementMode ? 'Finish map placement' : 'Place samples on map'}
            </button>}
            {sampleError && <p className="zoning-inline-error" role="alert"><AlertCircle size={14} />{sampleError}</p>}
            {samples.length === 0 ? (
              <div className="zoning-empty-samples"><FlaskConical size={18} /><p>Add measured samples manually or import a CSV. Values are never generated for you.</p></div>
            ) : (
              <div className="zoning-sample-list">
                {samples.map((sample, index) => (
                  <SoilSampleCard
                    key={`${sample.id}-${index}`}
                    sample={sample}
                    index={index}
                    selected={selectedSampleId === sample.id}
                    onSelect={() => selectSample(sample.id)}
                    onRemove={() => removeSample(sample.id)}
                    onChange={(update) => patchSample(sample.id, update)}
                  />
                ))}
              </div>
            )}
            <p className="zoning-help">3–50 samples · 5–10 recommended · pH, EC, N, P and K required · one explicit common depth.</p>
          </section>

          <section className="zoning-panel">
            <div className="zoning-panel__heading"><div><span className="zoning-step">03</span><h2>Analysis settings</h2></div><Settings2 size={16} /></div>
            <div className="zoning-form-grid">
              <label>Grid cell size<select value={options.cellSizeM} onChange={(event) => updateOptions((current) => ({ ...current, cellSizeM: Number(event.target.value) as 5 | 10 }))}><option value={10}>10 metres</option><option value={5}>5 metres · finer</option></select></label>
              <label>Clustering method<select value={options.method} onChange={(event) => updateOptions((current) => ({ ...current, method: event.target.value as FieldZoningOptions['method'] }))}><option value="fcm">Fuzzy C-means</option><option value="kmeans">K-means++</option></select></label>
              <label>Maximum tested K<select value={options.maxK} onChange={(event) => updateOptions((current) => ({ ...current, maxK: Number(event.target.value) }))}>{[2, 3, 4, 5, 6].map((value) => <option value={value} key={value}>{value} clusters</option>)}</select></label>
            </div>
            <details className="zoning-advanced">
              <summary>Advanced parameters <ChevronDown size={14} /></summary>
              <div className="zoning-form-grid">
                <label>Random seed<input type="number" value={options.seed} min={0} onChange={(event) => updateOptions((current) => ({ ...current, seed: Number(event.target.value) }))} /></label>
                <label>Merge threshold Z<input type="number" value={options.mergeThresholdZ} min={0} max={2} step={0.1} onChange={(event) => updateOptions((current) => ({ ...current, mergeThresholdZ: Number(event.target.value) }))} /></label>
                <label>Sensitivity reruns<input type="number" value={options.perturbationRuns} min={0} max={50} step={1} onChange={(event) => updateOptions((current) => ({ ...current, perturbationRuns: Number(event.target.value) }))} /></label>
                {options.method === 'fcm' && <>
                  <label>Fuzziness<input type="number" value={options.fcm.fuzziness} min={1.01} max={5} step={0.1} onChange={(event) => updateOptions((current) => ({ ...current, fcm: { ...current.fcm, fuzziness: Number(event.target.value) } }))} /></label>
                  <label>FCM iteration limit<input type="number" value={options.fcm.maxIterations} min={1} max={500} step={1} onChange={(event) => updateOptions((current) => ({ ...current, fcm: { ...current.fcm, maxIterations: Number(event.target.value) } }))} /></label>
                </>}
              </div>
              <p>Auto-K selects the silhouette-best tested K. FCM memberships describe cluster membership strength, not probability.</p>
            </details>
            <button className="zoning-run-button" type="button" onClick={runAnalysis} disabled={isRunning || !boundary || samples.length < 3}>
              {isRunning ? <LoaderCircle size={16} className="zoning-spin" /> : <Play size={16} fill="currentColor" />}
              {isRunning ? 'Running field analysis…' : 'Run field analysis'}
            </button>
            <p className="zoning-help">Runs IDW → SHI → Auto-K clustering → zone post-processing. Higher sensitivity counts may take longer.</p>
            {inputError && <p className="zoning-inline-error" role="alert"><AlertCircle size={14} />{inputError}</p>}
          </section>
        </aside>

        <main className="zoning-map-column">
          <section className="zoning-panel zoning-map-panel" aria-label="Field map">
            {response && <div className="zoning-result-summary">
              <div><span>Field area</span><strong>{response.field.areaHectares.toFixed(2)} ha</strong></div>
              <div><span>Cells</span><strong>{response.field.cellCount.toLocaleString()}</strong></div>
              <div><span>Zones</span><strong>{response.zoneCount}</strong></div>
              <div><span>Auto-selected K</span><strong>{response.selectedK}</strong></div>
              <button type="button" onClick={downloadResult}><Download size={15} /> Export JSON</button>
            </div>}
            {stale && <div className="zoning-stale-banner" role="status"><AlertCircle size={16} /><span><strong>Zoning out of date.</strong> This map and its diagnostics still show the last completed response; run analysis again to reflect edited inputs.</span></div>}
            {response?.sampleWarnings.map((warning) => <div className="zoning-warning" key={warning}><AlertCircle size={14} />{warning}</div>)}
            <div className="zoning-map-toolbar">
              <div className="zoning-map-toolbar__left">
                <label>Map layer<select value={layer} disabled={!displayCells.length} onChange={(event) => setLayer(event.target.value as FieldLayer)}>
                  {LAYER_OPTIONS.filter((option) => option.value !== 'membership' || response?.method === 'fcm').map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select></label>
                {layer === 'membership' && response && <label>Source cluster<select value={membershipCluster} onChange={(event) => setMembershipCluster(Number(event.target.value))}>{Array.from({ length: response.selectedK }, (_, index) => <option value={index} key={index}>Cluster {index + 1}</option>)}</select></label>}
              </div>
              <div className="zoning-map-toolbar__right">
                <div className="zoning-view-switch" role="group" aria-label="Map rendering mode">
                  <button type="button" className={view === '2d' ? 'is-active' : ''} onClick={() => setView('2d')}><MapIcon size={14} /> 2D map</button>
                  <button type="button" className={view === '3d' ? 'is-active' : ''} onClick={() => { setView('3d'); setPlacementMode(false); }} disabled={!canUse3D} title={threeDLimitMessage}><Focus size={14} /> 3D view</button>
                </div>
                {view === '3d' && <button type="button" className="zoning-fit-button" onClick={() => setFitTrigger((current) => current + 1)} title="Reset 3D camera"><Focus size={15} /><span>Fit</span></button>}
              </div>
            </div>
            <div className={`zoning-map-stage ${placementMode ? 'is-pinning' : ''}`}>
              {view === '2d' || !displayCells.length ? (
                <FieldMap2D
                  boundary={displayBoundary}
                  cells={displayCells}
                  zones={displayZones}
                  samples={mapSamples}
                  layer={layer}
                  range={range}
                  membershipCluster={membershipCluster}
                  selectedCellId={selectedCellId}
                  selectedZoneId={selectedZoneId}
                  selectedSampleId={selectedSampleId}
                  placementMode={placementMode}
                  onAddSampleAt={placeSampleAt}
                  onCellSelect={selectCell}
                  onCellHover={(cell) => setHoveredCellId(cell?.cellId ?? null)}
                  onSampleSelect={selectSample}
                  wsnNodes={!geometryStale ? response?.wsnNodes : []}
                  clusterHead={!geometryStale ? response?.clusterHead : null}
                />
              ) : (
                <SceneErrorBoundary fallback={<div className="zoning-3d-fallback"><strong>3D rendering is unavailable in this browser.</strong><span>The 2D map retains all field inspection and sample-placement actions.</span><button type="button" onClick={() => setView('2d')}>Return to 2D map</button></div>}>
                  <Suspense fallback={<div className="zoning-3d-fallback"><LoaderCircle size={18} className="zoning-spin" />Preparing the lightweight 3D field…</div>}>
                    <div className="zoning-3d-canvas"><FieldScene3D
                        result={response!}
                        samples={mapSamples}
                        layer={layer}
                        range={range}
                        membershipCluster={membershipCluster}
                        selectedCellId={selectedCellId}
                        selectedZoneId={selectedZoneId}
                        fitTrigger={fitTrigger}
                        onCellSelect={selectCell}
                        onCellHover={(cell) => setHoveredCellId(cell?.cellId ?? null)}
                      /></div>
                  </Suspense>
                </SceneErrorBoundary>
              )}
            </div>
            <div className="zoning-map-footer">
              <div className="zoning-legend">
                {layer === 'zone' ? (
                  displayZones.map((zone) => <button type="button" key={zone.zoneId} className={selectedZoneId === zone.zoneId ? 'is-selected' : ''} onClick={() => selectZone(zone.zoneId)}><i style={{ background: zoneColor(zone.zoneId) }} />Zone {zone.zoneId + 1}</button>)
                ) : <>
                  <span className="zoning-gradient" aria-hidden="true" />
                <span>{prettyValue(range[0])} {getUnits(layer)}</span>
                  <span>to</span>
                  <span>{prettyValue(range[1])} {getUnits(layer)}</span>
                </>}
                <span className="zoning-map-symbol"><i className="is-sample" /> Lab sample</span>
                {response && <span className="zoning-map-symbol"><i className="is-candidate" /> Suggested node</span>}
              </div>
              <p>{hoveredCell ? `Row ${hoveredCell.row + 1} · Column ${hoveredCell.column + 1} · ${activeLayer.label}: ${hoveredLayerValue(hoveredCell, layer, membershipCluster) == null ? 'Not available' : `${prettyValue(hoveredLayerValue(hoveredCell, layer, membershipCluster)!)} ${activeLayer.unit}`}` : threeDLimitMessage ? `${response?.field.cellSizeM} m cells · full 2D map retained; ${threeDLimitMessage}` : displayCells.length ? `${response?.field.cellSizeM} m cells · IDW estimates · nearest-sample distance is available per cell` : 'Map extent fits the imported boundary automatically.'}</p>
            </div>
          </section>

          {response && <section className="zoning-panel zoning-zone-list-panel">
            <div className="zoning-panel__heading"><div><span className="zoning-step">RESULT</span><h2>Zones</h2></div><small>Statistical soil-profile groups, not prescriptions</small></div>
            <div className="zoning-zone-list">
              {response.zones.map((zone) => <button type="button" key={zone.zoneId} className={selectedZoneId === zone.zoneId ? 'is-selected' : ''} onClick={() => selectZone(zone.zoneId)}>
                <i style={{ background: zoneColor(zone.zoneId) }} /><span><strong>Zone {zone.zoneId + 1}</strong><small>{zone.cellCount.toLocaleString()} cells · {zone.areaM2.toFixed(0)} m²</small></span><b>SHI {zone.meanShi.toFixed(0)}</b>
              </button>)}
            </div>
          </section>}

          {response && <Diagnostics response={response} />}
        </main>

        <aside className="zoning-inspector-column" aria-label="Field inspection and crop fit">
          <section className="zoning-panel zoning-inspector">
            <div className="zoning-panel__heading"><div><span className="zoning-step">INSPECT</span><h2>Selected profile</h2></div><Crosshair size={16} /></div>
            {!response ? <div className="zoning-inspector-empty"><Crosshair size={19} /><p>Run a field analysis, then select a cell or zone to inspect its returned values.</p></div>
              : selectedSample ? <SampleInspection sample={selectedSample} />
              : selectedCell ? <CellInspection cell={selectedCell} />
              : selectedZone ? <ZoneInspection zone={selectedZone} />
              : <div className="zoning-inspector-empty"><Crosshair size={19} /><p>Select a map cell, sample marker, or zone card.</p></div>}
          </section>

          <section className="zoning-panel zoning-crop-fit">
            <div className="zoning-panel__heading"><div><span className="zoning-step">CROP FIT</span><h2>Independent crop checks</h2></div><Sprout size={17} /></div>
            <p className="zoning-help">Apple, tomato and potato are assessed separately for the selected cell or zone mean. This is not a probability, ranking, yield estimate or prescription.</p>
            <div className="zoning-crop-scope" role="group" aria-label="Crop-fit scope">
              <button type="button" className={cropFitScope === 'cell' ? 'is-active' : ''} onClick={() => { setCropFitScope('cell'); invalidateCropFit(); }} disabled={!selectedCell}>Cell</button>
              <button type="button" className={cropFitScope === 'zone' ? 'is-active' : ''} onClick={() => { setCropFitScope('zone'); invalidateCropFit(); }} disabled={!selectedZone}>Zone mean</button>
            </div>
            {cropTargetLabel && cropProfile ? <>
              <p className="zoning-crop-target">Assessing <strong>{cropTargetLabel}</strong>{stale && <span> · from previous run</span>}</p>
              <details className="zoning-advanced zoning-crop-context">
                <summary>Sample context <ChevronDown size={14} /></summary>
                <label>Soil test method<input value={cropContext.soilTestMethod} onChange={(event) => updateCropContext('soilTestMethod', event.target.value)} /></label>
                <label>Common sample depth<input value={cropContext.sampleDepth} onChange={(event) => updateCropContext('sampleDepth', event.target.value)} /></label>
                <label>EC method<input value={cropContext.ecMethod} onChange={(event) => updateCropContext('ecMethod', event.target.value)} /></label>
              </details>
              <button type="button" className="zoning-crop-run" onClick={runCropFit} disabled={currentCropFit?.status === 'loading'}>
                {currentCropFit?.status === 'loading' ? <LoaderCircle size={15} className="zoning-spin" /> : <Sprout size={15} />}
                {currentCropFit?.status === 'loading' ? 'Checking profiles…' : 'Run crop fit'}
              </button>
              {currentCropFit?.status === 'error' && <p className="zoning-inline-error" role="alert"><AlertCircle size={14} />{currentCropFit.error}</p>}
              {currentCropFit?.status === 'ready' && currentCropFit.response && <CropFitCards response={currentCropFit.response} />}
            </> : <div className="zoning-inspector-empty"><p>Select a calculated cell or zone first.</p></div>}
          </section>
        </aside>
      </div>
    </section>
  );
}

function SoilSampleCard({
  sample, index, selected, onSelect, onRemove, onChange,
}: {
  sample: SoilSampleDraft;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: (change: (sample: SoilSampleDraft) => SoilSampleDraft) => void;
}) {
  const complete = isSampleComplete(sample);
  const setField = (field: SampleTextField, value: string) => onChange((current) => ({ ...current, [field]: value }));
  return (
    <article className={`zoning-sample-card ${selected ? 'is-selected' : ''}`}>
      <div className="zoning-sample-card__heading">
        <button type="button" onClick={onSelect} aria-pressed={selected}><MapPin size={13} /><strong>{sample.id || `Sample ${index + 1}`}</strong><span>{complete ? 'Complete' : 'Incomplete'}</span></button>
        <button type="button" onClick={onRemove} aria-label={`Remove soil sample ${sample.id}`}><Trash2 size={14} /></button>
      </div>
      <div className="zoning-sample-grid zoning-sample-grid--coordinates">
        <label>Sample ID<input value={sample.id} onChange={(event) => setField('id', event.target.value)} aria-label={`Sample ${index + 1} ID`} /></label>
        <label>Latitude<input type="number" step="any" value={sample.latitude} onChange={(event) => setField('latitude', event.target.value)} aria-label={`${sample.id} latitude`} /></label>
        <label>Longitude<input type="number" step="any" value={sample.longitude} onChange={(event) => setField('longitude', event.target.value)} aria-label={`${sample.id} longitude`} /></label>
        <label>Depth interval, cm<input value={sample.depthCm} placeholder="e.g. 0–15" onChange={(event) => setField('depthCm', event.target.value)} aria-label={`${sample.id} common soil depth interval`} /></label>
      </div>
      <div className="zoning-sample-grid zoning-sample-grid--soil">
        {SOIL_PROPERTIES.map((property) => <label key={property}>{SOIL_LABELS[property]} <small>{SOIL_UNITS[property]}</small><input type="number" min={0} max={property === 'pH' ? 14 : undefined} step="any" value={sample.measurements[property]} onChange={(event) => onChange((current) => ({ ...current, measurements: { ...current.measurements, [property]: event.target.value } }))} aria-label={`${sample.id} ${SOIL_LABELS[property]} in ${SOIL_UNITS[property]}`} /></label>)}
      </div>
      <div className="zoning-sample-grid zoning-sample-grid--provenance">
        <label>Collection date<input type="date" value={sample.collectionDate} onChange={(event) => setField('collectionDate', event.target.value)} /></label>
        <label>Lab method<input value={sample.labMethod} placeholder="Optional" onChange={(event) => setField('labMethod', event.target.value)} /></label>
      </div>
      <details className="zoning-sample-uncertainty"><summary>Optional measurement uncertainty</summary><div className="zoning-sample-grid zoning-sample-grid--soil">
        {SOIL_PROPERTIES.map((property) => <label key={property}>{SOIL_LABELS[property]} σ<input type="number" min={0} step="any" value={sample.standardUncertainty[property] ?? ''} onChange={(event) => onChange((current) => ({ ...current, standardUncertainty: { ...current.standardUncertainty, [property]: event.target.value } }))} aria-label={`${sample.id} ${SOIL_LABELS[property]} standard uncertainty`} /></label>)}
      </div></details>
    </article>
  );
}

function SampleInspection({ sample }: { sample: SoilSampleDraft }) {
  return <div className="zoning-profile-content"><p className="zoning-profile-kicker"><MapPin size={14} /> Measured lab sample</p><h3>{sample.id}</h3><p className="zoning-profile-note">Entered laboratory data; these values are inputs, not interpolated estimates.</p><dl className="zoning-metric-list">
    <Metric label="Latitude" value={sample.latitude || 'Not entered'} />
    <Metric label="Longitude" value={sample.longitude || 'Not entered'} />
    <Metric label="Depth" value={sample.depthCm || 'Not entered'} />
    {SOIL_PROPERTIES.map((property) => <Metric key={property} label={SOIL_LABELS[property]} value={`${sample.measurements[property] || 'Not entered'} ${SOIL_UNITS[property]}`} />)}
    <Metric label="Collection date" value={sample.collectionDate || 'Not recorded'} />
    <Metric label="Lab method" value={sample.labMethod || 'Not recorded'} />
  </dl></div>;
}

function CellInspection({ cell }: { cell: FieldZoningResponse['cells'][number] }) {
  return <div className="zoning-profile-content"><p className="zoning-profile-kicker"><Crosshair size={14} /> IDW-interpolated estimate</p><h3>Cell R{cell.row + 1} · C{cell.column + 1}</h3><p className="zoning-profile-note">Zone {cell.zoneId + 1} · {cell.areaM2.toFixed(1)} m² · {cell.nearestSampleDistanceM.toFixed(1)} m to nearest sample</p><dl className="zoning-metric-list">
    {SOIL_PROPERTIES.map((property) => <Metric key={property} label={SOIL_LABELS[property]} value={`${prettyValue(cell.soilValues[property])} ${SOIL_UNITS[property]}`} />)}
    <Metric label="KshetraSense SHI" value={`${cell.shi.toFixed(1)} / 100`} />
    {cell.clusterMemberships?.map((membership, index) => <Metric key={index} label={`Cluster ${index + 1} membership`} value={`${(membership * 100).toFixed(1)}%`} />)}
  </dl><p className="zoning-caveat">SHI is a provisional project-defined screen, not a crop score or official soil-health index. FCM membership is not probability.</p></div>;
}

function ZoneInspection({ zone }: { zone: FieldZoningResponse['zones'][number] }) {
  return <div className="zoning-profile-content"><p className="zoning-profile-kicker"><Crosshair size={14} /> Contiguous management zone</p><h3>Zone {zone.zoneId + 1}</h3><p className="zoning-profile-note">{zone.cellCount.toLocaleString()} cells · {zone.areaM2.toFixed(1)} m² · source cluster{zone.sourceClusterIds.length === 1 ? '' : 's'} {zone.sourceClusterIds.map((id) => id + 1).join(', ')}</p><dl className="zoning-metric-list">
    {SOIL_PROPERTIES.map((property) => <Metric key={property} label={`Mean ${SOIL_LABELS[property]}`} value={`${prettyValue(zone.meanSoilValues[property])} ${SOIL_UNITS[property]}`} />)}
    <Metric label="Mean SHI" value={`${zone.meanShi.toFixed(1)} / 100`} />
  </dl><p className="zoning-caveat">Zone means summarize IDW estimates, not additional laboratory measurements. SHI is not a crop suitability score.</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function CropFitCards({ response }: { response: CropFitResponse }) {
  return <div className="zoning-crop-results">
    {response.assessments.map((assessment) => <article className="zoning-crop-card" key={assessment.crop}>
      <div className="zoning-crop-card__heading"><strong>{assessment.crop}</strong><span>Independent screen</span></div>
      {assessment.factors.map((factor) => <div className="zoning-crop-factor" key={factor.feature}>
        <div><span>{factor.feature}</span><b className={`is-${factor.state}`}>{factor.state === 'within_contextual_range' ? 'Within context' : factor.state === 'outside_contextual_range' ? 'Review' : 'Not assessed'}</b></div>
        <p>{factor.reason}</p>
        {factor.supportedRange && <small>{factor.supportedRange.min}–{factor.supportedRange.max} {factor.supportedRange.unit}{factor.source && <> · <a href={factor.source.url} target="_blank" rel="noreferrer">{factor.source.label}</a></>}</small>}
      </div>)}
    </article>)}
    {response.dataLimitations.map((limitation) => <p className="zoning-caveat" key={limitation}>{limitation}</p>)}
  </div>;
}

function Diagnostics({ response }: { response: FieldZoningResponse }) {
  return <section className="zoning-panel zoning-diagnostics">
    <div className="zoning-panel__heading"><div><span className="zoning-step">EVIDENCE</span><h2>Analysis diagnostics</h2></div><small>{response.method === 'fcm' ? 'Fuzzy C-means' : 'K-means++'} · {response.processingDurationMs.toFixed(0)} ms</small></div>
    <div className="zoning-diagnostic-grid">
      <article><span>Auto-K selection</span><strong>K = {response.autoK.optimalK}</strong><small>{response.autoK.selectionCriterion}</small></article>
      <article><span>Silhouette</span><strong>{response.autoK.sweep.find((entry) => entry.k === response.selectedK)?.silhouette?.toFixed(3) ?? 'Not available'}</strong><small>Internal separation; not agronomic validation</small></article>
      <article><span>Grid coverage</span><strong>{response.field.gridCoveragePercent.toFixed(1)}%</strong><small>{response.field.cellSizeM} m grid · {response.field.utmCrs}</small></article>
      <article><span>FCM convergence</span><strong>{response.autoK.selectedAlgorithmConverged ? 'Converged' : 'Iteration limit'}</strong><small>{response.method === 'fcm' ? 'Memberships are not probabilities' : 'K-means++ / Lloyd iterations'}</small></article>
    </div>
    <details className="zoning-diagnostic-details">
      <summary>Auto-K silhouette sweep <ChevronDown size={14} /></summary>
      <SilhouetteChart response={response} />
      <p>{response.autoK.silhouetteInterpretation}</p>
      {response.method === 'fcm' && <p>FPC is a secondary fuzzy-partition diagnostic; Auto-K is selected by silhouette, not FPC.</p>}
    </details>
    <details className="zoning-diagnostic-details">
      <summary>Interpolation and sample validation <ChevronDown size={14} /></summary>
      <div className="zoning-loocv-grid">{SOIL_PROPERTIES.map((property) => {
        const item = response.interpolation.crossValidation[property];
        return <article key={property}><strong>{SOIL_LABELS[property]}</strong><span>{item.sampleCount} folds</span><small>RMSE {item.rmse.toFixed(2)} · MAE {item.mae.toFixed(2)} {SOIL_UNITS[property]}</small></article>;
      })}</div>
      <p>IDW uses p={response.interpolation.power} with {response.interpolation.distanceMetric}. Cross-validation is diagnostic and depends on the small sample set.</p>
      <p>{response.shi.name} v{response.shi.version} is independent of clustering and not locally calibrated.</p>
    </details>
    <details className="zoning-diagnostic-details">
      <summary>Sensitivity and zone merging <ChevronDown size={14} /></summary>
      <div className="zoning-diagnostic-inline"><strong>Mean ARI: {response.stability.meanARI?.toFixed(3) ?? 'Not computed'}</strong><span>Minimum: {response.stability.minARI?.toFixed(3) ?? '—'}</span><span>Reruns: {response.stability.perturbationRuns}</span></div>
      <p>{response.stability.limitations}</p>
      {response.mergeLog.length ? <ul>{response.mergeLog.map((entry, index) => <li key={index}>Clusters {entry.mergedClusters.map((id) => id + 1).join(' + ')}: profile distance Z {entry.profileDistanceZ.toFixed(3)} across {entry.sharedGridEdges} shared grid edges.</li>)}</ul> : <p>No adjacent cluster merges were needed.</p>}
    </details>
    <details className="zoning-diagnostic-details">
      <summary>Suggested sensor and gateway candidates <ChevronDown size={14} /></summary>
      <p>Geometric planning candidates only. Radio coverage, access, power, terrain and installation feasibility have not been validated.</p>
      <ul>{response.wsnNodes.map((node) => <li key={node.zoneId}>Zone {node.zoneId + 1}: {node.placementStatus} · {node.positionWgs84.latitude.toFixed(5)}, {node.positionWgs84.longitude.toFixed(5)}</li>)}</ul>
      <p>Gateway: {response.clusterHead.placementStatus} · straight-line total {response.clusterHead.totalDistanceToNodesM.toFixed(1)} m; not a radio link budget.</p>
    </details>
  </section>;
}

function SilhouetteChart({ response }: { response: FieldZoningResponse }) {
  const entries = response.autoK.sweep;
  const chartWidth = 400;
  const chartHeight = 128;
  const innerWidth = 350;
  const left = 34;
  const base = 96;
  return <svg className="zoning-silhouette-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Silhouette scores for each tested cluster count">
    <line x1={left} y1={base} x2={chartWidth - 10} y2={base} />
    <text x="2" y="17">1.0</text><text x="12" y={base + 3}>0</text><text x="2" y="119">−1.0</text>
    {entries.map((entry, index) => {
      const score = entry.silhouette;
      const x = left + (index + 0.5) * (innerWidth / entries.length);
      const barHeight = score == null ? 0 : Math.max(1, (score + 1) * 38);
      return <g key={entry.k} aria-label={`K ${entry.k}: ${score?.toFixed(3) ?? 'unavailable'}`}>
        <rect x={x - 15} y={base - barHeight} width="30" height={barHeight} rx="4" className={entry.k === response.selectedK ? 'is-selected' : ''} />
        <text x={x} y={base + 17} textAnchor="middle">K {entry.k}</text>
        {score != null && <text x={x} y={base - barHeight - 5} textAnchor="middle">{score.toFixed(2)}</text>}
      </g>;
    })}
  </svg>;
}

function SceneErrorBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <SceneBoundary fallback={fallback}>{children}</SceneBoundary>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function hoveredLayerValue(cell: FieldZoningResponse['cells'][number], selectedLayer: FieldLayer, cluster: number): number | null {
  if (selectedLayer === 'membership') return cell.clusterMemberships?.[cluster] ?? null;
  if (selectedLayer === 'zone') return cell.zoneId;
  if (selectedLayer === 'shi') return cell.shi;
  return cell.soilValues[selectedLayer];
}

function zoneColor(zoneId: number): string {
  return ZONE_COLORS[zoneId % ZONE_COLORS.length];
}
