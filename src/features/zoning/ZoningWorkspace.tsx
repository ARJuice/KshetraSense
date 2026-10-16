import { Component, lazy, Suspense, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  Eye,
  FlaskConical,
  Focus,
  HelpCircle,
  Info,
  Layers,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Play,
  Plus,
  Settings2,
  Sprout,
  Table as TableIcon,
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
import { DEMO_DATASETS } from './field/demoDatasets';
import type { FieldZoningOptions, FieldZoningResponse, SoilMeasurements, SoilProperty } from './field/fieldTypes';
import './zoning.css';

const FieldScene3D = lazy(() => import('./field/FieldScene3D').then(({ FieldScene3D: Scene }) => ({ default: Scene })));
const EMPTY_CELLS: FieldZoningResponse['cells'] = [];
const MAX_IMPORT_BYTES = 2_000_000;
const MAX_3D_CELLS = 768;
const MAX_3D_TRIANGLES = 20_000;
const MAX_3D_OVERLAY_TRIANGLES = 1_300;

const SOIL_LABELS: Record<SoilProperty, string> = {
  pH: 'pH',
  ec: 'Electrical conductivity',
  nitrogen: 'Nitrogen',
  phosphorus: 'Phosphorus',
  potassium: 'Potassium',
};

const SOIL_UNITS: Record<SoilProperty, string> = {
  pH: 'pH',
  ec: 'dS/m',
  nitrogen: 'mg/kg',
  phosphorus: 'mg/kg',
  potassium: 'mg/kg',
};

const LAYER_OPTIONS: Array<{ value: FieldLayer; label: string; unit: string }> = [
  { value: 'zone', label: 'Management zones', unit: '' },
  { value: 'pH', label: 'pH (Soil reaction)', unit: 'pH' },
  { value: 'ec', label: 'Electrical conductivity', unit: 'dS/m' },
  { value: 'nitrogen', label: 'Nitrogen (N)', unit: 'mg/kg' },
  { value: 'phosphorus', label: 'Phosphorus (P)', unit: 'mg/kg' },
  { value: 'potassium', label: 'Potassium (K)', unit: 'mg/kg' },
  { value: 'shi', label: 'KshetraSense SHI', unit: '0–100' },
  { value: 'membership', label: 'FCM membership strength', unit: '0–1' },
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
    sourceScope: '',
    soilTestMethod: 'Not supplied',
    sampleDepth: 'Not supplied',
    ecMethod: 'Not supplied',
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
    ? `3D rendering is limited to ${MAX_3D_CELLS} cells to maintain high frame rates.`
    : estimated3DTriangles > MAX_3D_TRIANGLES
      ? `The field geometry exceeds the ${MAX_3D_TRIANGLES.toLocaleString()}-triangle 3D budget.`
      : undefined;

  const completeSampleCount = samples.filter(isSampleComplete).length;
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

  const handleSelectDemo = (demoId: string) => {
    if (!demoId) return;
    const demo = DEMO_DATASETS.find((d) => d.id === demoId);
    if (!demo) return;
    setBoundary(demo.boundary);
    setBoundaryName(`${demo.id}.geojson`);
    setBoundaryRevision((current) => current + 1);
    setSamples(demo.samples);
    setSelectedCellId(null);
    setSelectedZoneId(null);
    setSelectedSampleId(null);
    setPlacementMode(false);
    setView('2d');
    setBoundaryError(null);
    setSampleError(null);
    markInputsChanged();
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
      {/* Header Bar */}
      <header className="zoning-header">
        <div className="zoning-header-titles">
          <div className="zoning-breadcrumb">
            Precision Agriculture <span>/</span> Soil Zoning
          </div>
          <h1>Soil Zoning &amp; Management Units</h1>
          <p className="zoning-header-description">
            Cluster soil variability using inverse distance weighting (IDW) and unsupervised machine learning (FCM / K-means++).
          </p>
        </div>

        <div className="zoning-header-actions">
          {/* Quick Demo Dataset Selector */}
          <div className="zoning-preset-select" title="Load synthetic demonstration field">
            <Database size={14} className="text-emerald-600" />
            <select
              value=""
              onChange={(e) => handleSelectDemo(e.target.value)}
              aria-label="Load demo dataset"
            >
              <option value="" disabled>Load Demo Field...</option>
              {DEMO_DATASETS.map((demo) => (
                <option key={demo.id} value={demo.id}>
                  {demo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Chip */}
          <div
            className={`zoning-status-chip ${
              stale ? 'is-stale' : analysis ? 'is-ready' : ''
            }`}
            role="status"
          >
            {stale ? (
              <AlertTriangle size={14} />
            ) : analysis ? (
              <CheckCircle2 size={14} />
            ) : (
              <Info size={14} />
            )}
            <span>
              {!analysis ? 'Awaiting inputs' : stale ? 'Inputs modified' : 'Analysis complete'}
            </span>
            {analysis && <small>{shortRunId(response!.runId)}</small>}
          </div>

          {/* Primary CTA */}
          <button
            className="zoning-btn zoning-btn-primary"
            type="button"
            onClick={runAnalysis}
            disabled={isRunning || !boundary || completeSampleCount < 3}
          >
            {isRunning ? (
              <LoaderCircle size={15} className="zoning-spin" />
            ) : (
              <Play size={15} />
            )}
            <span>{isRunning ? 'Computing Zones…' : 'Run Field Analysis'}</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column Layout */}
      <div className="zoning-layout">
        {/* Left Column: Configuration & Inputs */}
        <aside className="zoning-input-column" aria-label="Field inputs and parameters">
          {/* Boundary Card */}
          <section className="zoning-panel">
            <div className="zoning-panel-header">
              <h2 className="zoning-panel-title">
                <MapPin size={16} /> Field Geometry
              </h2>
              {boundary && (
                <span className="zoning-panel-badge is-success">
                  <Check size={12} /> Boundary Loaded
                </span>
              )}
            </div>

            {!boundary ? (
              <label className="zoning-dropzone">
                <input
                  type="file"
                  accept=".geojson,.json,application/geo+json,application/json"
                  onChange={handleBoundaryUpload}
                />
                <div className="zoning-dropzone-icon">
                  <Upload size={18} />
                </div>
                <span className="zoning-dropzone-title">Upload Field GeoJSON</span>
                <span className="zoning-dropzone-hint">WGS84 Polygon Feature</span>
              </label>
            ) : (
              <div className="zoning-file-card">
                <div className="zoning-file-card-info">
                  <MapIcon size={16} />
                  <span className="zoning-file-card-name" title={boundaryName}>
                    {boundaryName || 'Polygon Boundary'}
                  </span>
                </div>
                <button
                  type="button"
                  className="zoning-btn-remove"
                  onClick={clearBoundary}
                  title="Remove boundary"
                  aria-label="Remove boundary"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {boundaryError && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 m-0" role="alert">
                <AlertCircle size={14} /> {boundaryError}
              </p>
            )}
            <p className="zoning-caveat">
              Polygons must be self-consistent and closed. Real farm boundaries or synthetic testing geometries are accepted.
            </p>
          </section>

          {/* Soil Samples Card */}
          <section className="zoning-panel">
            <div className="zoning-panel-header">
              <h2 className="zoning-panel-title">
                <FlaskConical size={16} /> Measured Samples
              </h2>
              <span
                className={`zoning-panel-badge ${
                  completeSampleCount >= 3 ? 'is-success' : 'is-warning'
                }`}
              >
                {completeSampleCount} / 3 complete
              </span>
            </div>

            <div className="zoning-actions-bar">
              <label className="zoning-btn zoning-btn-secondary" style={{ flex: 1 }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleSampleCsvUpload}
                  style={{ display: 'none' }}
                />
                <Upload size={14} /> Import CSV
              </label>

              <button
                type="button"
                className="zoning-btn zoning-btn-secondary"
                onClick={addBlankSample}
                disabled={samples.length >= 50}
              >
                <Plus size={14} /> Add
              </button>
            </div>

            {boundary && (
              <button
                type="button"
                className={`zoning-btn zoning-btn-secondary zoning-btn-full ${
                  placementMode ? 'is-active' : ''
                }`}
                onClick={() => {
                  setView('2d');
                  setPlacementMode((active) => !active);
                }}
              >
                <MapPin size={14} />
                <span>{placementMode ? 'Exit Map Placement' : 'Click Map to Place Samples'}</span>
              </button>
            )}

            {sampleError && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 m-0" role="alert">
                <AlertCircle size={14} /> {sampleError}
              </p>
            )}

            {samples.length === 0 ? (
              <div className="zoning-empty-state">
                <FlaskConical size={24} />
                <p>No soil samples added. Import a CSV, load a demo, or add samples manually.</p>
              </div>
            ) : (
              <div className="zoning-sample-list">
                {samples.map((sample, index) => (
                  <SoilSampleItem
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
            <p className="zoning-caveat">
              Requires 3–50 samples. pH, EC, N, P, and K required at a common depth.
            </p>
          </section>

          {/* Analysis Settings Card */}
          <section className="zoning-panel">
            <div className="zoning-panel-header">
              <h2 className="zoning-panel-title">
                <Settings2 size={16} /> Zoning Model
              </h2>
            </div>

            <div className="zoning-form-stack">
              <div className="zoning-form-field">
                <label>Grid Cell Resolution</label>
                <select
                  value={options.cellSizeM}
                  onChange={(e) =>
                    updateOptions((c) => ({ ...c, cellSizeM: Number(e.target.value) as 5 | 10 }))
                  }
                >
                  <option value={10}>10 metres (Standard)</option>
                  <option value={5}>5 metres (High resolution)</option>
                </select>
              </div>

              <div className="zoning-form-field">
                <label>Clustering Method</label>
                <select
                  value={options.method}
                  onChange={(e) =>
                    updateOptions((c) => ({
                      ...c,
                      method: e.target.value as FieldZoningOptions['method'],
                    }))
                  }
                >
                  <option value="fcm">Fuzzy C-means (FCM)</option>
                  <option value="kmeans">K-means++</option>
                </select>
              </div>
            </div>

            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-medium text-slate-700 py-1 hover:text-emerald-700 flex items-center justify-between">
                <span>Advanced parameters</span>
                <ChevronDown size={14} />
              </summary>
              <div className="pt-2 flex flex-col gap-2">
                <div className="zoning-form-grid-2">
                  <div className="zoning-form-field">
                    <label>Random Seed</label>
                    <input
                      type="number"
                      value={options.seed}
                      min={0}
                      onChange={(e) =>
                        updateOptions((c) => ({ ...c, seed: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="zoning-form-field">
                    <label>Merge Threshold Z</label>
                    <input
                      type="number"
                      value={options.mergeThresholdZ}
                      min={0}
                      max={2}
                      step={0.1}
                      onChange={(e) =>
                        updateOptions((c) => ({ ...c, mergeThresholdZ: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                {options.method === 'fcm' && (
                  <div className="zoning-form-grid-2">
                    <div className="zoning-form-field">
                      <label>Fuzziness (m)</label>
                      <input
                        type="number"
                        value={options.fcm.fuzziness}
                        min={1.01}
                        max={5}
                        step={0.1}
                        onChange={(e) =>
                          updateOptions((c) => ({
                            ...c,
                            fcm: { ...c.fcm, fuzziness: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div className="zoning-form-field">
                      <label>Max Iterations</label>
                      <input
                        type="number"
                        value={options.fcm.maxIterations}
                        min={1}
                        max={500}
                        step={1}
                        onChange={(e) =>
                          updateOptions((c) => ({
                            ...c,
                            fcm: { ...c.fcm, maxIterations: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </details>

            {inputError && (
              <p className="text-xs text-rose-600 flex items-center gap-1.5 m-0" role="alert">
                <AlertCircle size={14} /> {inputError}
              </p>
            )}
          </section>
        </aside>

        {/* Center Column: Map & Stage */}
        <main className="zoning-map-column">
          {/* Post-Analysis Summary KPIs */}
          {response && (
            <div className="zoning-kpi-grid">
              <div className="zoning-kpi-cell">
                <span>Field Area</span>
                <strong>{response.field.areaHectares.toFixed(2)} ha</strong>
              </div>
              <div className="zoning-kpi-cell">
                <span>Interpolated Grid</span>
                <strong>{response.field.cellCount.toLocaleString()} cells</strong>
              </div>
              <div className="zoning-kpi-cell">
                <span>Management Zones</span>
                <strong>{response.zoneCount} zones</strong>
              </div>
              <div className="zoning-kpi-cell">
                <span>Auto-Selected K</span>
                <strong>K = {response.selectedK}</strong>
              </div>
              <button
                type="button"
                className="zoning-btn zoning-btn-secondary"
                onClick={downloadResult}
                title="Download full analysis JSON"
              >
                <Download size={14} /> Export JSON
              </button>
            </div>
          )}

          {/* Stale or Warning Notices */}
          {stale && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>
                <strong>Map out of date.</strong> Field inputs were modified; run analysis again to update zones.
              </span>
            </div>
          )}

          {response?.sampleWarnings.map((warning) => (
            <div key={warning} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700">
              <Info size={15} className="flex-shrink-0 text-slate-500" />
              <span>{warning}</span>
            </div>
          ))}

          {/* Map Card */}
          <section className="zoning-panel zoning-map-card" aria-label="Field map">
            {/* Map Header Toolbar */}
            <div className="zoning-map-header">
              <div className="zoning-map-controls-left">
                <div className="zoning-layer-select">
                  <Layers size={14} className="text-slate-400" />
                  <label htmlFor="map-layer-select" className="sr-only">Map Layer</label>
                  <select
                    id="map-layer-select"
                    value={layer}
                    disabled={!displayCells.length}
                    onChange={(e) => setLayer(e.target.value as FieldLayer)}
                  >
                    {LAYER_OPTIONS.filter(
                      (opt) => opt.value !== 'membership' || response?.method === 'fcm',
                    ).map((opt) => (
                      <option value={opt.value} key={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {layer === 'membership' && response && (
                  <div className="zoning-layer-select">
                    <select
                      value={membershipCluster}
                      onChange={(e) => setMembershipCluster(Number(e.target.value))}
                    >
                      {Array.from({ length: response.selectedK }, (_, i) => (
                        <option value={i} key={i}>
                          Cluster {i + 1} Membership
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="zoning-map-controls-right">
                <div className="zoning-view-switcher" role="group" aria-label="Map perspective">
                  <button
                    type="button"
                    className={`zoning-view-btn ${view === '2d' ? 'is-active' : ''}`}
                    onClick={() => setView('2d')}
                  >
                    <MapIcon size={13} /> 2D Map
                  </button>
                  <button
                    type="button"
                    className={`zoning-view-btn ${view === '3d' ? 'is-active' : ''}`}
                    onClick={() => {
                      setView('3d');
                      setPlacementMode(false);
                    }}
                    disabled={!canUse3D}
                    title={threeDLimitMessage}
                  >
                    <Eye size={13} /> 3D Surface
                  </button>
                </div>

                {view === '3d' && (
                  <button
                    type="button"
                    className="zoning-btn zoning-btn-secondary"
                    onClick={() => setFitTrigger((c) => c + 1)}
                    title="Reset camera focus"
                  >
                    <Focus size={13} /> Fit
                  </button>
                )}
              </div>
            </div>

            {/* Map Canvas Stage */}
            <div className="zoning-map-stage-container">
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
                <SceneErrorBoundary
                  fallback={
                    <div className="field-map__empty">
                      <strong>3D rendering unavailable</strong>
                      <span>Please switch back to the 2D map view.</span>
                      <button
                        type="button"
                        className="zoning-btn zoning-btn-secondary"
                        onClick={() => setView('2d')}
                      >
                        Return to 2D
                      </button>
                    </div>
                  }
                >
                  <Suspense
                    fallback={
                      <div className="field-map__empty">
                        <LoaderCircle size={20} className="zoning-spin text-emerald-600" />
                        <span>Rendering 3D elevation field…</span>
                      </div>
                    }
                  >
                    <div style={{ width: '100%', height: '100%' }}>
                      <FieldScene3D
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
                      />
                    </div>
                  </Suspense>
                </SceneErrorBoundary>
              )}
            </div>

            {/* Map Footer & Dynamic Legend */}
            <div className="zoning-map-footer">
              <div className="zoning-legend">
                {layer === 'zone' ? (
                  displayZones.map((zone) => (
                    <button
                      type="button"
                      key={zone.zoneId}
                      className={`zoning-legend-btn ${
                        selectedZoneId === zone.zoneId ? 'is-selected' : ''
                      }`}
                      onClick={() => selectZone(zone.zoneId)}
                    >
                      <span
                        className="zoning-legend-swatch"
                        style={{ background: zoneColor(zone.zoneId) }}
                      />
                      <span>Zone {zone.zoneId + 1}</span>
                    </button>
                  ))
                ) : (
                  <>
                    <span className="zoning-gradient-bar" aria-hidden="true" />
                    <span className="text-xs text-slate-600 font-mono">
                      {prettyValue(range[0])} {getUnits(layer)}
                    </span>
                    <span className="text-xs text-slate-400">to</span>
                    <span className="text-xs text-slate-600 font-mono">
                      {prettyValue(range[1])} {getUnits(layer)}
                    </span>
                  </>
                )}
                <span className="zoning-legend-symbol">
                  <span className="zoning-legend-dot is-sample" /> Sample Pin
                </span>
                {response && (
                  <span className="zoning-legend-symbol">
                    <span className="zoning-legend-dot is-candidate" /> Sensor Node
                  </span>
                )}
              </div>

              <div className="zoning-hover-readout">
                {hoveredCell
                  ? `Row ${hoveredCell.row + 1} · Col ${hoveredCell.column + 1} · ${
                      activeLayer.label
                    }: ${
                      hoveredLayerValue(hoveredCell, layer, membershipCluster) == null
                        ? '—'
                        : `${prettyValue(
                            hoveredLayerValue(hoveredCell, layer, membershipCluster)!,
                          )} ${activeLayer.unit}`
                    }`
                  : displayCells.length
                  ? `${response?.field.cellSizeM} m grid cells · Click any cell to inspect`
                  : 'Import boundary to activate map extent'}
              </div>
            </div>
          </section>

          {/* Zones Filter Strip */}
          {response && (
            <section className="zoning-panel">
              <div className="zoning-panel-header">
                <h2 className="zoning-panel-title">
                  <Layers size={16} /> Contiguous Management Zones
                </h2>
                <span className="text-xs text-slate-500">
                  Statistical cluster units for variable-rate input planning
                </span>
              </div>
              <div className="zoning-zones-strip">
                {response.zones.map((zone) => (
                  <button
                    type="button"
                    key={zone.zoneId}
                    className={`zoning-zone-card-btn ${
                      selectedZoneId === zone.zoneId ? 'is-selected' : ''
                    }`}
                    onClick={() => selectZone(zone.zoneId)}
                  >
                    <span
                      className="zoning-legend-swatch"
                      style={{ background: zoneColor(zone.zoneId), width: 12, height: 12 }}
                    />
                    <div className="zoning-zone-card-content">
                      <strong>Zone {zone.zoneId + 1}</strong>
                      <small>
                        {zone.cellCount.toLocaleString()} cells · {zone.areaM2.toFixed(0)} m²
                      </small>
                    </div>
                    <b>SHI {zone.meanShi.toFixed(0)}</b>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Diagnostics Accordion */}
          {response && <Diagnostics response={response} />}
        </main>

        {/* Right Column: Profile Inspector & Crop Reference Benchmarks */}
        <aside className="zoning-inspector-column" aria-label="Field inspection and crop agronomic fit">
          {/* Card 1: Selected Feature Profile */}
          <section className="zoning-panel">
            <div className="zoning-panel-header">
              <h2 className="zoning-panel-title">
                <Crosshair size={16} /> Selected Profile
              </h2>
              {selectedCell && <span className="zoning-panel-badge is-success">Grid Cell</span>}
              {selectedZone && <span className="zoning-panel-badge is-success">Zone Mean</span>}
              {selectedSample && <span className="zoning-panel-badge">Lab Sample</span>}
            </div>

            {!response ? (
              <div className="zoning-empty-state">
                <Crosshair size={24} />
                <p>Run a field analysis, then click any grid cell, zone card, or sample pin to inspect.</p>
              </div>
            ) : selectedSample ? (
              <SampleInspection sample={selectedSample} />
            ) : selectedCell ? (
              <CellInspection cell={selectedCell} />
            ) : selectedZone ? (
              <ZoneInspection zone={selectedZone} />
            ) : (
              <div className="zoning-empty-state">
                <Crosshair size={24} />
                <p>Click any map cell, sample pin, or zone card to inspect properties.</p>
              </div>
            )}
          </section>

          {/* Card 2: Crop reference report for the selected cell or zone. */}
          <section className="zoning-panel">
            <div className="zoning-panel-header">
              <h2 className="zoning-panel-title">
                <Sprout size={16} /> Crop Reference Report
              </h2>
              {cropTargetLabel && (
                <span className="zoning-panel-badge">
                  {cropFitScope === 'cell' ? 'Cell' : 'Zone Mean'}
                </span>
              )}
            </div>

            {cropProfile && cropTargetLabel ? (
              <CropReferenceReport
                profile={cropProfile}
                targetLabel={cropTargetLabel}
                scope={cropFitScope}
                onScopeChange={(scope: 'cell' | 'zone') => {
                  setCropFitScope(scope);
                  invalidateCropFit();
                }}
                hasCell={Boolean(selectedCell)}
                hasZone={Boolean(selectedZone)}
                backendFit={currentCropFit}
                onRequestBackendFit={runCropFit}
              />
            ) : (
              <div className="zoning-empty-state">
                <Sprout size={24} />
                <p>Select a returned cell or zone to see its measured-value context and crop-specific references.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function SoilSampleItem({
  sample,
  index,
  selected,
  onSelect,
  onRemove,
  onChange,
}: {
  sample: SoilSampleDraft;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChange: (change: (sample: SoilSampleDraft) => SoilSampleDraft) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const complete = isSampleComplete(sample);
  const setField = (field: SampleTextField, value: string) =>
    onChange((current) => ({ ...current, [field]: value }));

  return (
    <article className={`zoning-sample-item ${selected ? 'is-selected' : ''}`}>
      <div
        className="zoning-sample-item-header"
        onClick={() => {
          onSelect();
          setExpanded((c) => !c);
        }}
      >
        <span className="zoning-sample-id">
          <MapPin size={13} />
          <strong>{sample.id || `Sample ${index + 1}`}</strong>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              complete ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {complete ? 'Complete' : 'Draft'}
          </span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="zoning-btn-remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove sample"
            aria-label={`Remove soil sample ${sample.id}`}
          >
            <Trash2 size={13} />
          </button>
          <ChevronRight
            size={14}
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      <div className="zoning-sample-chips">
        <span className="zoning-chip">
          pH <strong>{sample.measurements.pH || '—'}</strong>
        </span>
        <span className="zoning-chip">
          EC <strong>{sample.measurements.ec || '—'}</strong>
        </span>
        <span className="zoning-chip">
          N <strong>{sample.measurements.nitrogen || '—'}</strong>
        </span>
        <span className="zoning-chip">
          P <strong>{sample.measurements.phosphorus || '—'}</strong>
        </span>
        <span className="zoning-chip">
          K <strong>{sample.measurements.potassium || '—'}</strong>
        </span>
      </div>

      {expanded && (
        <div className="zoning-sample-edit-drawer">
          <div className="zoning-form-grid-2">
            <div className="zoning-form-field">
              <label>Sample ID</label>
              <input
                value={sample.id}
                onChange={(e) => setField('id', e.target.value)}
              />
            </div>
            <div className="zoning-form-field">
              <label>Depth Interval</label>
              <input
                value={sample.depthCm}
                placeholder="e.g. 0-15"
                onChange={(e) => setField('depthCm', e.target.value)}
              />
            </div>
          </div>

          <div className="zoning-form-grid-2">
            <div className="zoning-form-field">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                value={sample.latitude}
                onChange={(e) => setField('latitude', e.target.value)}
              />
            </div>
            <div className="zoning-form-field">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                value={sample.longitude}
                onChange={(e) => setField('longitude', e.target.value)}
              />
            </div>
          </div>

          <div className="zoning-form-grid-3">
            {SOIL_PROPERTIES.map((property) => (
              <div className="zoning-form-field" key={property}>
                <label>
                  {property.toUpperCase()} <small>({SOIL_UNITS[property]})</small>
                </label>
                <input
                  type="number"
                  step="any"
                  value={sample.measurements[property]}
                  onChange={(e) =>
                    onChange((current) => ({
                      ...current,
                      measurements: { ...current.measurements, [property]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="zoning-form-grid-2">
            <div className="zoning-form-field">
              <label>Collection Date</label>
              <input
                type="date"
                value={sample.collectionDate}
                onChange={(e) => setField('collectionDate', e.target.value)}
              />
            </div>
            <div className="zoning-form-field">
              <label>Lab Method</label>
              <input
                value={sample.labMethod}
                placeholder="Method identifier"
                onChange={(e) => setField('labMethod', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function SampleInspection({ sample }: { sample: SoilSampleDraft }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 m-0">{sample.id}</h3>
        <span className="text-xs text-slate-500">Laboratory Tested Soil Sample</span>
      </div>

      <div className="zoning-metric-grid">
        <div className="zoning-metric-box">
          <dt>Latitude</dt>
          <dd>{sample.latitude || '—'}</dd>
        </div>
        <div className="zoning-metric-box">
          <dt>Longitude</dt>
          <dd>{sample.longitude || '—'}</dd>
        </div>
        <div className="zoning-metric-box">
          <dt>Depth Interval</dt>
          <dd>{sample.depthCm || '—'} cm</dd>
        </div>
        <div className="zoning-metric-box">
          <dt>Collection Date</dt>
          <dd>{sample.collectionDate || '—'}</dd>
        </div>

        {SOIL_PROPERTIES.map((prop) => (
          <div className="zoning-metric-box" key={prop}>
            <dt>{SOIL_LABELS[prop]}</dt>
            <dd>
              {sample.measurements[prop] || '—'} <small className="text-[10px] font-normal text-slate-500">{SOIL_UNITS[prop]}</small>
            </dd>
          </div>
        ))}
      </div>
      <p className="zoning-caveat">
        These values are direct laboratory measurement inputs.
      </p>
    </div>
  );
}

function CellInspection({ cell }: { cell: FieldZoningResponse['cells'][number] }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 m-0">
          Cell R{cell.row + 1} · C{cell.column + 1}
        </h3>
        <span className="text-xs text-slate-500">
          Zone {cell.zoneId + 1} · {cell.areaM2.toFixed(0)} m² · {cell.nearestSampleDistanceM.toFixed(1)} m to nearest sample
        </span>
      </div>

      <div className="zoning-metric-grid">
        {SOIL_PROPERTIES.map((prop) => (
          <div className="zoning-metric-box" key={prop}>
            <dt>{SOIL_LABELS[prop]}</dt>
            <dd>
              {prettyValue(cell.soilValues[prop])} <small className="text-[10px] font-normal text-slate-500">{SOIL_UNITS[prop]}</small>
            </dd>
          </div>
        ))}
        <div className="zoning-metric-box">
          <dt>KshetraSense SHI</dt>
          <dd>{cell.shi.toFixed(1)} / 100</dd>
        </div>
        {cell.clusterMemberships?.map((membership, idx) => (
          <div className="zoning-metric-box" key={idx}>
            <dt>Cluster {idx + 1} Weight</dt>
            <dd>{(membership * 100).toFixed(1)}%</dd>
          </div>
        ))}
      </div>
      <p className="zoning-caveat">
        Cell values are inverse distance weighted (IDW p=2) estimates, not discrete in-situ sensor measurements.
      </p>
    </div>
  );
}

function ZoneInspection({ zone }: { zone: FieldZoningResponse['zones'][number] }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 m-0">Zone {zone.zoneId + 1} Summary</h3>
        <span className="text-xs text-slate-500">
          {zone.cellCount.toLocaleString()} cells · {zone.areaM2.toFixed(0)} m² ({((zone.areaM2 / 10000)).toFixed(2)} ha)
        </span>
      </div>

      <div className="zoning-metric-grid">
        {SOIL_PROPERTIES.map((prop) => (
          <div className="zoning-metric-box" key={prop}>
            <dt>Mean {SOIL_LABELS[prop]}</dt>
            <dd>
              {prettyValue(zone.meanSoilValues[prop])} <small className="text-[10px] font-normal text-slate-500">{SOIL_UNITS[prop]}</small>
            </dd>
          </div>
        ))}
        <div className="zoning-metric-box">
          <dt>Mean SHI Index</dt>
          <dd>{zone.meanShi.toFixed(1)} / 100</dd>
        </div>
      </div>
      <p className="zoning-caveat">
        Zone means represent the area-weighted average of interpolated cell estimates across this contiguous management cluster.
      </p>
    </div>
  );
}

interface ParameterBenchmark {
  label: string;
  unit: string;
  min: number;
  max: number;
  tolerance: number;
  minScale: number;
  maxScale: number;
  contextNote: string;
  sourceLabel: string;
  sourceUrl: string;
}

interface CropBenchmark {
  id: 'finger_millet' | 'tomato' | 'groundnut';
  shortName: string;
  name: string;
  scientificName: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  benchmarks: Record<SoilProperty, ParameterBenchmark>;
}

const CROP_BENCHMARKS: Record<'finger_millet' | 'tomato' | 'groundnut', CropBenchmark> = {
  finger_millet: {
    id: 'finger_millet',
    shortName: 'Ragi',
    name: 'Finger Millet (Ragi)',
    scientificName: 'Eleusine coracana',
    description: 'Drought-hardy cereal staple with broad adaptability to Karnataka red sandy loam soils.',
    sourceLabel: 'NIFTEM-T / UAS Bengaluru Millet Guide',
    sourceUrl: 'https://niftem-t.ac.in/pmfme/maltdpr.pdf',
    benchmarks: {
      pH: {
        label: 'Soil Reaction',
        unit: 'pH',
        min: 4.5,
        max: 8.0,
        tolerance: 0.4,
        minScale: 4.0,
        maxScale: 8.5,
        contextNote: 'Tolerates wide pH range; optimal 5.5–7.5 in red sandy loams',
        sourceLabel: 'NIFTEM-T Report',
        sourceUrl: 'https://niftem-t.ac.in/pmfme/maltdpr.pdf',
      },
      ec: {
        label: 'Electrical Conductivity',
        unit: 'dS/m',
        min: 0.2,
        max: 2.0,
        tolerance: 0.5,
        minScale: 0.0,
        maxScale: 4.0,
        contextNote: 'Moderately salt-tolerant; yield drops above 2.0 dS/m ECe',
        sourceLabel: 'FAO Annex 1',
        sourceUrl: 'https://www.fao.org/4/y4263e/y4263e0e.htm',
      },
      nitrogen: {
        label: 'Available Nitrogen',
        unit: 'mg/kg',
        min: 40,
        max: 90,
        tolerance: 15,
        minScale: 0,
        maxScale: 150,
        contextNote: 'Low-to-moderate nitrogen feeder (50–100 kg N/ha UASB PoP)',
        sourceLabel: 'UAS Bengaluru PoP',
        sourceUrl: 'https://niftem-t.ac.in/pmfme/maltdpr.pdf',
      },
      phosphorus: {
        label: 'Available Phosphorus',
        unit: 'mg/kg',
        min: 15,
        max: 40,
        tolerance: 8,
        minScale: 0,
        maxScale: 70,
        contextNote: 'Adequate P supports root establishment under rainfed dryland',
        sourceLabel: 'UAS Bengaluru PoP',
        sourceUrl: 'https://niftem-t.ac.in/pmfme/maltdpr.pdf',
      },
      potassium: {
        label: 'Exchangeable Potassium',
        unit: 'mg/kg',
        min: 100,
        max: 200,
        tolerance: 25,
        minScale: 40,
        maxScale: 300,
        contextNote: 'Key for drought resilience and grain filling in semi-arid zones',
        sourceLabel: 'ICAR-IIMR',
        sourceUrl: 'https://niftem-t.ac.in/pmfme/maltdpr.pdf',
      },
    },
  },
  tomato: {
    id: 'tomato',
    shortName: 'Tomato',
    name: 'Tomato',
    scientificName: 'Solanum lycopersicum',
    description: 'High-value solanaceous crop requiring well-drained, fertile loamy soil.',
    sourceLabel: 'Tamil Nadu Agricultural University (TNAU)',
    sourceUrl: 'https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html',
    benchmarks: {
      pH: {
        label: 'Soil Reaction',
        unit: 'pH',
        min: 6.0,
        max: 7.5,
        tolerance: 0.4,
        minScale: 4.5,
        maxScale: 8.5,
        contextNote: 'Optimum 6.5–7.5 in well-drained loamy soil rich in organic matter',
        sourceLabel: 'TNAU Guidance',
        sourceUrl: 'https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html',
      },
      ec: {
        label: 'Electrical Conductivity',
        unit: 'dS/m',
        min: 0.4,
        max: 2.5,
        tolerance: 0.6,
        minScale: 0.0,
        maxScale: 4.5,
        contextNote: 'Yield reduction begins above 2.5 dS/m ECe (FAO salinity table)',
        sourceLabel: 'FAO Annex 1',
        sourceUrl: 'https://www.fao.org/4/y4263e/y4263e0e.htm',
      },
      nitrogen: {
        label: 'Available Nitrogen',
        unit: 'mg/kg',
        min: 50,
        max: 120,
        tolerance: 15,
        minScale: 0,
        maxScale: 180,
        contextNote: 'Heavy nutrient feeder; substantial N needed for vine & foliage',
        sourceLabel: 'TNAU Production',
        sourceUrl: 'https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html',
      },
      phosphorus: {
        label: 'Available Phosphorus',
        unit: 'mg/kg',
        min: 25,
        max: 60,
        tolerance: 10,
        minScale: 0,
        maxScale: 90,
        contextNote: 'Essential for root structure, early flowering, and fruit set',
        sourceLabel: 'TNAU Production',
        sourceUrl: 'https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html',
      },
      potassium: {
        label: 'Exchangeable Potassium',
        unit: 'mg/kg',
        min: 140,
        max: 260,
        tolerance: 30,
        minScale: 50,
        maxScale: 360,
        contextNote: 'Heavy K demand for uniform fruit size, color, firmness, and TSS',
        sourceLabel: 'TNAU Production',
        sourceUrl: 'https://agritech.tnau.ac.in/horticulture/horti_vegetables_tomato_Soil.html',
      },
    },
  },
  groundnut: {
    id: 'groundnut',
    shortName: 'Groundnut',
    name: 'Groundnut',
    scientificName: 'Arachis hypogaea',
    description: 'Major oilseed legume thriving in loose, well-drained sandy/red loam soils.',
    sourceLabel: 'TNAU / ICRISAT Production Guide',
    sourceUrl: 'https://www.agritech.tnau.ac.in/pdf/3.pdf',
    benchmarks: {
      pH: {
        label: 'Soil Reaction',
        unit: 'pH',
        min: 5.3,
        max: 6.6,
        tolerance: 0.4,
        minScale: 4.5,
        maxScale: 8.5,
        contextNote: 'Tolerant of slight acidity; optimum 5.3–6.6 pH in sandy loams',
        sourceLabel: 'TNAU Tolerance',
        sourceUrl: 'https://www.agritech.tnau.ac.in/pdf/3.pdf',
      },
      ec: {
        label: 'Electrical Conductivity',
        unit: 'dS/m',
        min: 0.3,
        max: 3.2,
        tolerance: 0.7,
        minScale: 0.0,
        maxScale: 5.0,
        contextNote: 'Salinity response begins at 3.2 dS/m ECe seed yield threshold',
        sourceLabel: 'FAO Annex 1',
        sourceUrl: 'https://www.fao.org/4/y4263e/y4263e0e.htm',
      },
      nitrogen: {
        label: 'Available Nitrogen',
        unit: 'mg/kg',
        min: 30,
        max: 70,
        tolerance: 15,
        minScale: 0,
        maxScale: 140,
        contextNote: 'Legume; fixes atmospheric N via nodules, lower fertilizer N need',
        sourceLabel: 'ICRISAT Bulletin',
        sourceUrl: 'https://www.agritech.tnau.ac.in/pdf/3.pdf',
      },
      phosphorus: {
        label: 'Available Phosphorus',
        unit: 'mg/kg',
        min: 20,
        max: 45,
        tolerance: 8,
        minScale: 0,
        maxScale: 75,
        contextNote: 'Critical for pegging, nodule development, and pod filling',
        sourceLabel: 'ICRISAT Bulletin',
        sourceUrl: 'https://www.agritech.tnau.ac.in/pdf/3.pdf',
      },
      potassium: {
        label: 'Exchangeable Potassium',
        unit: 'mg/kg',
        min: 110,
        max: 210,
        tolerance: 25,
        minScale: 40,
        maxScale: 320,
        contextNote: 'Promotes seed oil synthesis, kernel plumpness, and shell strength',
        sourceLabel: 'ICRISAT Bulletin',
        sourceUrl: 'https://www.agritech.tnau.ac.in/pdf/3.pdf',
      },
    },
  },
};

type FitCategory = 'optimal' | 'marginal' | 'poor' | 'unknown';

interface FitEvaluation {
  category: FitCategory;
  label: string;
  diff: number;
  gaugePercent: number;
  bandLeftPercent: number;
  bandWidthPercent: number;
}

function evaluateFit(value: number | undefined | null, benchmark: ParameterBenchmark): FitEvaluation {
  if (value == null || Number.isNaN(value)) {
    return {
      category: 'unknown',
      label: 'No Data',
      diff: 0,
      gaugePercent: 50,
      bandLeftPercent: 30,
      bandWidthPercent: 40,
    };
  }

  const { min, max, tolerance, minScale, maxScale } = benchmark;
  const clampedVal = Math.min(Math.max(value, minScale), maxScale);
  const gaugePercent = Math.max(0, Math.min(100, ((clampedVal - minScale) / (maxScale - minScale)) * 100));
  const bandLeftPercent = Math.max(0, Math.min(100, ((min - minScale) / (maxScale - minScale)) * 100));
  const bandRightPercent = Math.max(0, Math.min(100, ((max - minScale) / (maxScale - minScale)) * 100));
  const bandWidthPercent = Math.max(2, bandRightPercent - bandLeftPercent);

  if (value >= min && value <= max) {
    return {
      category: 'optimal',
      label: 'In Range',
      diff: 0,
      gaugePercent,
      bandLeftPercent,
      bandWidthPercent,
    };
  }

  if (value < min) {
    const deficit = min - value;
    const isMarginal = deficit <= tolerance;
    return {
      category: isMarginal ? 'marginal' : 'poor',
      label: isMarginal ? `Slightly Low (−${prettyValue(deficit, 1)})` : `Too Low (−${prettyValue(deficit, 1)})`,
      diff: -deficit,
      gaugePercent,
      bandLeftPercent,
      bandWidthPercent,
    };
  } else {
    const excess = value - max;
    const isMarginal = excess <= tolerance;
    return {
      category: isMarginal ? 'marginal' : 'poor',
      label: isMarginal ? `Slightly High (+${prettyValue(excess, 1)})` : `Too High (+${prettyValue(excess, 1)})`,
      diff: excess,
      gaugePercent,
      bandLeftPercent,
      bandWidthPercent,
    };
  }
}

function FitPill({ fit }: { fit: FitEvaluation }) {
  if (fit.category === 'optimal') {
    return (
      <span className="zoning-fit-pill is-optimal" title="Value falls within cited agronomic range">
        <Check size={10} /> In Range
      </span>
    );
  }
  if (fit.category === 'marginal') {
    return (
      <span className="zoning-fit-pill is-marginal" title={fit.label}>
        <AlertTriangle size={10} /> {fit.label}
      </span>
    );
  }
  if (fit.category === 'poor') {
    return (
      <span className="zoning-fit-pill is-poor" title={fit.label}>
        <AlertCircle size={10} /> {fit.label}
      </span>
    );
  }
  return (
    <span className="zoning-fit-pill is-context">
      <HelpCircle size={10} /> No Data
    </span>
  );
}

const MATRIX_PROP_LABELS: Record<SoilProperty, string> = {
  pH: 'pH',
  ec: 'EC',
  nitrogen: 'Nitrogen (N)',
  phosphorus: 'Phosphorus (P)',
  potassium: 'Potassium (K)',
};

interface CropReferenceReportProps {
  profile: SoilMeasurements;
  targetLabel: string;
  scope: 'cell' | 'zone';
  onScopeChange: (scope: 'cell' | 'zone') => void;
  hasCell: boolean;
  hasZone: boolean;
  backendFit?: CropFitState | null;
  onRequestBackendFit?: () => void;
}

function CropReferenceReport({
  profile,
  targetLabel,
  scope,
  onScopeChange,
  hasCell,
  hasZone,
  backendFit,
  onRequestBackendFit,
}: CropReferenceReportProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'finger_millet' | 'tomato' | 'groundnut'>('matrix');
  const cropList = [CROP_BENCHMARKS.finger_millet, CROP_BENCHMARKS.tomato, CROP_BENCHMARKS.groundnut];
  const isLoading = backendFit?.status === 'loading';

  return (
    <div className="flex flex-col gap-3">
      {/* Scope Selector Bar */}
      <div className="zoning-crop-scope-bar">
        <div className="zoning-crop-scope-toggle" role="group" aria-label="Reference report scope">
          <button
            type="button"
            className={`zoning-scope-btn ${scope === 'cell' ? 'is-active' : ''}`}
            onClick={() => onScopeChange('cell')}
            disabled={!hasCell}
          >
            Cell Value
          </button>
          <button
            type="button"
            className={`zoning-scope-btn ${scope === 'zone' ? 'is-active' : ''}`}
            onClick={() => onScopeChange('zone')}
            disabled={!hasZone}
          >
            Zone Mean
          </button>
        </div>
        <span className="zoning-crop-scope-target">{targetLabel}</span>
      </div>

      {/* Subnav Tabs */}
      <div className="zoning-crop-subnav" role="tablist" aria-label="Crop reference views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'matrix'}
          className={`zoning-crop-subnav-btn ${activeTab === 'matrix' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('matrix')}
        >
          <TableIcon size={12} /> Matrix
        </button>
        {cropList.map((crop) => (
          <button
            type="button"
            role="tab"
            key={crop.id}
            aria-selected={activeTab === crop.id}
            className={`zoning-crop-subnav-btn ${activeTab === crop.id ? 'is-active' : ''}`}
            onClick={() => setActiveTab(crop.id)}
          >
            {crop.shortName}
          </button>
        ))}
      </div>

      {/* Crop Fit Tab Panels with smooth transition */}
      <div key={activeTab} className="module-nav-transition">
        {activeTab === 'matrix' && (
        <div className="zoning-matrix-table-wrapper" role="tabpanel">
          <table className="zoning-matrix-table">
            <thead>
              <tr>
                <th title="Soil factor">Factor</th>
                <th title="Observed cell or zone mean value">Obs.</th>
                <th>Ragi</th>
                <th>Tomato</th>
                <th>Groundnut</th>
              </tr>
            </thead>
            <tbody>
              {SOIL_PROPERTIES.map((prop) => {
                const observedVal = profile[prop];
                const ragiFit = evaluateFit(observedVal, CROP_BENCHMARKS.finger_millet.benchmarks[prop]);
                const tomatoFit = evaluateFit(observedVal, CROP_BENCHMARKS.tomato.benchmarks[prop]);
                const groundnutFit = evaluateFit(observedVal, CROP_BENCHMARKS.groundnut.benchmarks[prop]);

                return (
                  <tr key={prop}>
                    <td>
                      <span className="zoning-param-name">{MATRIX_PROP_LABELS[prop]}</span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {SOIL_UNITS[prop]}
                      </span>
                    </td>
                    <td>
                      <span className="zoning-observed-val">
                        {prettyValue(observedVal)}
                      </span>
                    </td>
                    <td>
                      <div className="zoning-fit-badge">
                        <span className="zoning-fit-range">
                          {CROP_BENCHMARKS.finger_millet.benchmarks[prop].min}–{CROP_BENCHMARKS.finger_millet.benchmarks[prop].max}
                        </span>
                        <FitPill fit={ragiFit} />
                      </div>
                    </td>
                    <td>
                      <div className="zoning-fit-badge">
                        <span className="zoning-fit-range">
                          {CROP_BENCHMARKS.tomato.benchmarks[prop].min}–{CROP_BENCHMARKS.tomato.benchmarks[prop].max}
                        </span>
                        <FitPill fit={tomatoFit} />
                      </div>
                    </td>
                    <td>
                      <div className="zoning-fit-badge">
                        <span className="zoning-fit-range">
                          {CROP_BENCHMARKS.groundnut.benchmarks[prop].min}–{CROP_BENCHMARKS.groundnut.benchmarks[prop].max}
                        </span>
                        <FitPill fit={groundnutFit} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2/3/4: Single Crop Visual Range Gauges */}
      {activeTab !== 'matrix' && (
        <div className="zoning-gauge-list" role="tabpanel">
          {(() => {
            const crop = CROP_BENCHMARKS[activeTab as keyof typeof CROP_BENCHMARKS];
            if (!crop) return null;
            return (
              <>
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div>
                    <strong className="text-xs text-slate-800 font-semibold">{crop.name}</strong>
                    <span className="text-[11px] text-slate-500 italic block">{crop.scientificName}</span>
                  </div>
                  <a
                    href={crop.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 font-medium"
                    title={crop.sourceLabel}
                  >
                    <span>Source</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <p className="text-[11px] text-slate-600 m-0 leading-relaxed">{crop.description}</p>

                {SOIL_PROPERTIES.map((prop) => {
                  const benchmark = crop.benchmarks[prop];
                  const observedVal = profile[prop];
                  const fit = evaluateFit(observedVal, benchmark);

                  return (
                    <article className="zoning-gauge-card" key={prop}>
                      <div className="zoning-gauge-header">
                        <div>
                          <span className="zoning-gauge-title">{benchmark.label}</span>
                          <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                            {prettyValue(observedVal)} {benchmark.unit}
                          </span>
                        </div>
                        <FitPill fit={fit} />
                      </div>

                      {/* Visual Range Track with Green Optimal Band and Colored Position Pip */}
                      <div className="zoning-gauge-track" aria-hidden="true">
                        <div
                          className="zoning-gauge-band"
                          style={{
                            left: `${fit.bandLeftPercent}%`,
                            width: `${fit.bandWidthPercent}%`,
                          }}
                        />
                        <div
                          className={`zoning-gauge-pip is-${fit.category}`}
                          style={{ left: `${fit.gaugePercent}%` }}
                        />
                      </div>

                      <div className="zoning-gauge-footer">
                        <span>{benchmark.minScale}</span>
                        <span className="font-medium text-slate-700">
                          Target: {benchmark.min}–{benchmark.max} {benchmark.unit}
                        </span>
                        <span>{benchmark.maxScale}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span>{benchmark.contextNote}</span>
                        <a
                          href={benchmark.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5"
                        >
                          <span>{benchmark.sourceLabel}</span>
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
      </div>

      {/* Disclaimers & Backend Verification */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between">
          <p className="zoning-caveat">
            Extension &amp; FAO baselines. Non-prescriptive reference; assess drainage, climate, and variety.
          </p>
          {onRequestBackendFit && (
            <button
              type="button"
              className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium underline flex-shrink-0"
              onClick={onRequestBackendFit}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderCircle size={10} className="zoning-spin" /> Verifying…
                </>
              ) : backendFit?.status === 'ready' ? (
                <>
                  <Check size={10} className="text-emerald-600" /> Backend Verified
                </>
              ) : (
                'Run Backend Fit'
              )}
            </button>
          )}
        </div>
        {backendFit?.error && (
          <p className="text-[10px] text-rose-600 m-0">{backendFit.error}</p>
        )}
      </div>
    </div>
  );
}

function Diagnostics({ response }: { response: FieldZoningResponse }) {
  return (
    <details className="zoning-panel zoning-diagnostics-card">
      <summary className="zoning-diagnostics-summary">
        <h2 className="zoning-panel-title">
          <CheckCircle2 size={16} /> Analysis Diagnostics &amp; Verification
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">
            {response.method === 'fcm' ? 'FCM' : 'K-means++'} · {response.processingDurationMs.toFixed(0)} ms
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </summary>

      <div className="zoning-diagnostics-content">
        <div className="zoning-kpi-grid">
          <div className="zoning-kpi-cell">
            <span>Optimal K</span>
            <strong>K = {response.autoK.optimalK}</strong>
          </div>
          <div className="zoning-kpi-cell">
            <span>Silhouette Separation</span>
            <strong>
              {response.autoK.sweep.find((entry) => entry.k === response.selectedK)?.silhouette?.toFixed(3) ?? '—'}
            </strong>
          </div>
          <div className="zoning-kpi-cell">
            <span>Grid Coverage</span>
            <strong>{response.field.gridCoveragePercent.toFixed(1)}%</strong>
          </div>
          <div className="zoning-kpi-cell">
            <span>Convergence</span>
            <strong>{response.autoK.selectedAlgorithmConverged ? 'Converged' : 'Limit reached'}</strong>
          </div>
        </div>

        {/* Silhouette Chart */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Auto-K Silhouette Sweep</h4>
          <SilhouetteChart response={response} />
          <p className="zoning-caveat mt-2">{response.autoK.silhouetteInterpretation}</p>
        </div>

        {/* LOOCV Grid */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 mb-2">
            Leave-One-Out Cross Validation (IDW p={response.interpolation.power})
          </h4>
          <div className="zoning-loocv-grid">
            {SOIL_PROPERTIES.map((property) => {
              const item = response.interpolation.crossValidation[property];
              return (
                <div className="zoning-loocv-card" key={property}>
                  <strong>{SOIL_LABELS[property]}</strong>
                  <span>{item.sampleCount} cross-folds</span>
                  <small>
                    RMSE {item.rmse.toFixed(2)} · MAE {item.mae.toFixed(2)} {SOIL_UNITS[property]}
                  </small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stability & Sensor Nodes */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
          <div className="text-xs text-slate-700 flex items-center justify-between">
            <span>Perturbation Stability (Adjusted Rand Index):</span>
            <strong className="font-mono">Mean ARI {response.stability.meanARI?.toFixed(3) ?? '—'}</strong>
          </div>
          <p className="zoning-caveat">
            Candidate node coordinates: {response.wsnNodes.map((n) => `Z${n.zoneId + 1} (${n.positionWgs84.latitude.toFixed(4)}, ${n.positionWgs84.longitude.toFixed(4)})`).join(', ')}.
          </p>
        </div>
      </div>
    </details>
  );
}

function SilhouetteChart({ response }: { response: FieldZoningResponse }) {
  const entries = response.autoK.sweep;
  const chartWidth = 400;
  const chartHeight = 110;
  const innerWidth = 340;
  const left = 30;
  const base = 80;

  return (
    <svg
      className="zoning-silhouette-chart"
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      role="img"
      aria-label="Silhouette scores for tested cluster counts"
    >
      <line x1={left} y1={base} x2={chartWidth - 10} y2={base} />
      <text x="4" y="16">1.0</text>
      <text x="12" y={base + 4}>0</text>
      <text x="4" y={chartHeight - 6}>−1.0</text>
      {entries.map((entry, index) => {
        const score = entry.silhouette;
        const x = left + (index + 0.5) * (innerWidth / entries.length);
        const barHeight = score == null ? 0 : Math.max(2, (score + 1) * 34);
        return (
          <g key={entry.k} aria-label={`K ${entry.k}: ${score?.toFixed(3) ?? 'unavailable'}`}>
            <rect
              x={x - 14}
              y={base - barHeight}
              width="28"
              height={barHeight}
              className={entry.k === response.selectedK ? 'is-selected' : ''}
            />
            <text x={x} y={base + 16} textAnchor="middle">
              K={entry.k}
            </text>
            {score != null && (
              <text x={x} y={base - barHeight - 4} textAnchor="middle">
                {score.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SceneErrorBoundary({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <SceneBoundary fallback={fallback}>{children}</SceneBoundary>;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hoveredLayerValue(
  cell: FieldZoningResponse['cells'][number],
  selectedLayer: FieldLayer,
  cluster: number,
): number | null {
  if (selectedLayer === 'membership') return cell.clusterMemberships?.[cluster] ?? null;
  if (selectedLayer === 'zone') return cell.zoneId;
  if (selectedLayer === 'shi') return cell.shi;
  return cell.soilValues[selectedLayer];
}

function zoneColor(zoneId: number): string {
  return ZONE_COLORS[zoneId % ZONE_COLORS.length];
}
