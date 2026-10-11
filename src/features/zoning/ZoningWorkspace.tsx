import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Brush, ChevronRight, Crosshair, FileUp, FlaskConical, History, LoaderCircle, Map as MapIcon, Paintbrush, Play, Redo2, RefreshCcw, Rotate3D, SlidersHorizontal, Sprout, Undo2, WandSparkles } from 'lucide-react';
import { FEATURE_KEYS, SOIL_FEATURES, createStarterField, formatSoilValue, type ClusteringMethod, type FieldGrid, type SoilCell, type SoilFeatureKey, type ZoningResult, type ZoneSummary } from '../../domain/soil';
import { evaluateCropFit, runZoning, type CropFitMeasurementContext, type CropFitResponse, ZoningApiError } from '../../services/zoningApi';
import { ZoningFieldCanvas, type ZoningFieldCell, type ZoningFieldZone } from './field';
import type { FieldInteractionMode } from './field/FieldScene3D';
import { importFieldCsv } from './fieldImport';

const ZONE_COLOURS = ['#387d65', '#c99037', '#4c79a6', '#9a5d8d', '#9a6d41', '#517e80'];
const MAX_HISTORY = 30;
const FieldScene3D = lazy(() => import('./field/FieldScene3D').then((module) => ({ default: module.FieldScene3D })));
type WorkspacePane = 'inspect' | 'crop-fit';
type FieldView = 'three' | 'map';
type Playback = 'idle' | 'calculating' | 'revealing' | 'ready';
type BrushDirection = 'raise' | 'lower';

const isCurrentResult = (field: FieldGrid, result: ZoningResult | null) => Boolean(result && Object.keys(result.assignments).length === field.cells.length);
const cloneField = (field: FieldGrid): FieldGrid => ({ ...field, cells: field.cells.map((cell) => ({ ...cell, values: { ...cell.values } })) });
function brushDelta(feature: SoilFeatureKey, intensity: number, direction: BrushDirection) {
  const definition = SOIL_FEATURES[feature];
  const raw = (definition.max - definition.min) * (intensity / 100);
  return (direction === 'raise' ? 1 : -1) * Number(raw.toFixed(definition.precision));
}

export function ZoningWorkspace() {
  const [field, setField] = useState<FieldGrid>(() => createStarterField());
  const fieldRef = useRef(field);
  const brushBase = useRef<FieldGrid | null>(null);
  const [feature, setFeature] = useState<SoilFeatureKey>('nitrogen');
  const [method, setMethod] = useState<ClusteringMethod>('kmeans');
  const [clusterCount, setClusterCount] = useState(3);
  const [fuzziness, setFuzziness] = useState(2);
  const [result, setResult] = useState<ZoningResult | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(field.cells[0]?.id ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [playback, setPlayback] = useState<Playback>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pane, setPane] = useState<WorkspacePane>('inspect');
  const [view, setView] = useState<FieldView>('three');
  const [interactionMode, setInteractionMode] = useState<FieldInteractionMode>('inspect');
  const [brushRadius, setBrushRadius] = useState(1);
  const [brushIntensity, setBrushIntensity] = useState(5);
  const [brushDirection, setBrushDirection] = useState<BrushDirection>('lower');
  const [undoStack, setUndoStack] = useState<FieldGrid[]>([]);
  const [redoStack, setRedoStack] = useState<FieldGrid[]>([]);

  useEffect(() => { fieldRef.current = field; }, [field]);
  useEffect(() => {
    if (playback !== 'revealing') return undefined;
    const timer = window.setTimeout(() => setPlayback('ready'), 900);
    return () => window.clearTimeout(timer);
  }, [playback]);

  const selectedCell = field.cells.find((cell) => cell.id === selectedCellId) ?? null;
  const selectedZone = result?.zones.find((zone) => String(zone.zoneId) === selectedZoneId) ?? null;
  const fieldZones = useMemo<ZoningFieldZone[]>(() => (result?.zones ?? []).map((zone, index) => ({ id: String(zone.zoneId), label: `Zone ${Number(zone.zoneId) + 1}`, color: ZONE_COLOURS[index % ZONE_COLOURS.length] })), [result]);
  const activeFeature = SOIL_FEATURES[feature];
  const zoningIsCurrent = isCurrentResult(field, result);
  const renderedCells = useMemo<ZoningFieldCell[]>(() => field.cells.map((cell) => ({
    id: cell.id, row: cell.row, col: cell.column, value: cell.values[feature],
    zoneId: result ? String(result.assignments[cell.id]) : null,
    membership: result?.memberships?.[cell.id]?.[Number(result.assignments[cell.id])],
  })), [feature, field.cells, result]);

  const markDirty = () => { setResult(null); setSelectedZoneId(null); setPlayback('idle'); };
  const recordField = (next: FieldGrid, previous = fieldRef.current) => {
    setUndoStack((history) => [...history, cloneField(previous)].slice(-MAX_HISTORY));
    setRedoStack([]); setField(next); markDirty();
  };
  const updateCells = (mutate: (cell: SoilCell) => SoilCell, record = true) => {
    const previous = fieldRef.current;
    const next = { ...previous, source: previous.source === 'starter' ? 'manual' as const : previous.source, cells: previous.cells.map(mutate) };
    if (record) recordField(next, previous); else { setField(next); markDirty(); }
  };
  const editCellValue = (cellId: string, featureToEdit: SoilFeatureKey, nextValue: number) => {
    const definition = SOIL_FEATURES[featureToEdit];
    const bounded = Number(Math.min(definition.max, Math.max(definition.min, nextValue)).toFixed(definition.precision));
    updateCells((cell) => cell.id === cellId ? { ...cell, values: { ...cell.values, [featureToEdit]: bounded } } : cell);
  };
  const applyBrushAt = (origin: ZoningFieldCell) => {
    if (!brushBase.current) {
      brushBase.current = cloneField(fieldRef.current);
      setUndoStack((history) => [...history, brushBase.current!].slice(-MAX_HISTORY));
      setRedoStack([]);
    }
    const delta = brushDelta(feature, brushIntensity, brushDirection);
    const definition = SOIL_FEATURES[feature];
    updateCells((cell) => {
      const distance = Math.hypot(cell.row - origin.row, cell.column - origin.col);
      if (distance > brushRadius) return cell;
      const falloff = 1 - distance / (brushRadius + 0.35);
      const nextValue = Number(Math.min(definition.max, Math.max(definition.min, cell.values[feature] + delta * falloff)).toFixed(definition.precision));
      return { ...cell, values: { ...cell.values, [feature]: nextValue } };
    }, false);
  };
  const finishBrush = () => { brushBase.current = null; };
  const applyPreset = (preset: 'low-nitrogen' | 'ec-pocket' | 'acid-wash') => {
    const config = preset === 'low-nitrogen' ? { key: 'nitrogen' as const, factor: 0.48 } : preset === 'ec-pocket' ? { key: 'ec' as const, add: 1.45 } : { key: 'ph' as const, add: -0.8 };
    const origin = selectedCell ?? fieldRef.current.cells[Math.floor(fieldRef.current.cells.length / 2)];
    const definition = SOIL_FEATURES[config.key];
    updateCells((cell) => {
      const distance = Math.hypot(cell.row - origin.row, cell.column - origin.column);
      if (distance > 3.4) return cell;
      const strength = Math.max(0, 1 - distance / 3.9);
      const base = cell.values[config.key];
      const proposed = 'factor' in config ? base * (1 - (1 - (config.factor ?? 1)) * strength) : base + (config.add ?? 0) * strength;
      return { ...cell, values: { ...cell.values, [config.key]: Number(Math.min(definition.max, Math.max(definition.min, proposed)).toFixed(definition.precision)) } };
    });
    setFeature(config.key); setInteractionMode('inspect');
  };
  const undo = () => {
    const previous = undoStack.at(-1); if (!previous) return;
    setRedoStack((history) => [...history, cloneField(fieldRef.current)].slice(-MAX_HISTORY)); setUndoStack((history) => history.slice(0, -1)); setField(cloneField(previous)); markDirty();
  };
  const redo = () => {
    const next = redoStack.at(-1); if (!next) return;
    setUndoStack((history) => [...history, cloneField(fieldRef.current)].slice(-MAX_HISTORY)); setRedoStack((history) => history.slice(0, -1)); setField(cloneField(next)); markDirty();
  };
  const run = async () => {
    setError(null); setIsRunning(true); setPlayback('calculating');
    try { const nextResult = await runZoning(fieldRef.current, method, clusterCount, fuzziness); setResult(nextResult); setSelectedZoneId(null); setPane('inspect'); setPlayback('revealing'); }
    catch (reason) { const message = reason instanceof ZoningApiError ? reason.message : 'Unable to reach the local zoning service. Start it, then run zoning again.'; setError(message.replace(/^"|"$/g, '')); setPlayback('idle'); }
    finally { setIsRunning(false); }
  };
  const resetPracticeField = () => { const next = createStarterField(); setField(next); setResult(null); setSelectedCellId(next.cells[0]?.id ?? null); setSelectedZoneId(null); setError(null); setUndoStack([]); setRedoStack([]); setPlayback('idle'); };
  const importGrid = (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) { setImportError('Choose a .csv file using the required field-grid columns.'); return; }
    if (file.size > 2 * 1024 * 1024) { setImportError('Field CSV files must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => { const imported = importFieldCsv(String(reader.result ?? ''), file.name); if (!imported.field) { setImportError(imported.errors.join(' ')); return; } recordField(imported.field); setSelectedCellId(imported.field.cells[0]?.id ?? null); };
    reader.onerror = () => setImportError('The selected CSV could not be read.'); reader.readAsText(file);
  };

  return <section className="workspace">
    <header className="workspace__header"><div><p className="eyebrow">Field intelligence / zoning</p><h1>Soil zoning</h1><p className="workspace__lede">Edit sampled conditions, calculate comparable management zones, then screen a specific zone or cell for crop fit.</p></div><div className="workspace__header-actions"><span className={`status-dot ${zoningIsCurrent ? 'status-dot--success' : ''}`}>{zoningIsCurrent ? 'Current run' : 'Zoning out of date'}</span><button className="button button--secondary" onClick={resetPracticeField}><RefreshCcw size={15} /> Reset practice field</button></div></header>
    <div className={`workspace__notice ${zoningIsCurrent ? '' : 'workspace__notice--amber'}`}><FlaskConical size={17} /><span><strong>{field.source === 'starter' ? 'Practice workspace.' : 'Working field.'}</strong> {field.source === 'starter' ? 'Starter observations are synthetic and clearly labelled. Every zone is calculated from the values currently on this field.' : 'Edits preserve their source and require a new zoning run.'}</span></div>
    <div className="zoning-layout zoning-layout--complete">
      <aside className="panel zoning-controls" aria-label="Zoning controls">
        <div className="panel__heading"><SlidersHorizontal size={17} /><h2>Run configuration</h2></div>
        <label className="form-label" htmlFor="zoning-method">Method</label><select id="zoning-method" className="select-control" value={method} onChange={(event) => { setMethod(event.target.value as ClusteringMethod); markDirty(); }}><option value="kmeans">K-means — crisp zone assignment</option><option value="fuzzy-c-means">Fuzzy C-means — membership strength</option></select>
        <label className="form-label" htmlFor="cluster-count">Zone count</label><select id="cluster-count" className="select-control" value={clusterCount} onChange={(event) => { setClusterCount(Number(event.target.value)); markDirty(); }}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} zones</option>)}</select>
        {method === 'fuzzy-c-means' && <><label className="form-label" htmlFor="fuzziness">Fuzziness (m)</label><select id="fuzziness" className="select-control" value={fuzziness} onChange={(event) => { setFuzziness(Number(event.target.value)); markDirty(); }}><option value={1.5}>1.5 — firmer</option><option value={2}>2.0 — balanced</option><option value={2.5}>2.5 — softer</option></select><p className="control-hint">m controls how softly a cell can belong to several zones; it does not add random noise.</p></>}
        <div className="control-rule" />
        <label className="form-label" htmlFor="feature">Visible field layer</label><select id="feature" className="select-control" value={feature} onChange={(event) => setFeature(event.target.value as SoilFeatureKey)}>{FEATURE_KEYS.map((key) => <option key={key} value={key}>{SOIL_FEATURES[key].label}</option>)}</select><p className="control-hint">All six observations are standardized and used for every zoning run. This selector only changes the surface display and editor.</p>
        <div className="tool-mode"><button className={interactionMode === 'inspect' ? 'is-active' : ''} onClick={() => setInteractionMode('inspect')}><Crosshair size={14} /> Inspect</button><button className={interactionMode === 'brush' ? 'is-active' : ''} onClick={() => setInteractionMode('brush')}><Brush size={14} /> Brush</button></div>
        {interactionMode === 'brush' && <div className="brush-config"><p><Paintbrush size={14} /> Paint {activeFeature.shortLabel}</p><div><label>Direction<select value={brushDirection} onChange={(event) => setBrushDirection(event.target.value as BrushDirection)}><option value="lower">Lower values</option><option value="raise">Raise values</option></select></label><label>Radius<select value={brushRadius} onChange={(event) => setBrushRadius(Number(event.target.value))}><option value={1}>1 cell</option><option value={2}>2 cells</option><option value={3}>3 cells</option></select></label></div><label>Strength <input type="range" min="2" max="12" value={brushIntensity} onChange={(event) => setBrushIntensity(Number(event.target.value))} /> {brushIntensity}% of layer range per stroke</label><small>Drag directly on the field. Changes use a radial falloff and are undoable as one stroke.</small></div>}
        <div className="preset-block"><span className="form-label">Quick scenarios</span><button onClick={() => applyPreset('low-nitrogen')}>Low nitrogen patch</button><button onClick={() => applyPreset('ec-pocket')}>High EC pocket</button><button onClick={() => applyPreset('acid-wash')}>Acidic wash</button></div>
        <div className="history-row"><button disabled={!undoStack.length} onClick={undo}><Undo2 size={14} /> Undo</button><button disabled={!redoStack.length} onClick={redo}><Redo2 size={14} /> Redo</button><span><History size={13} /> {undoStack.length}</span></div>
        <label className="import-grid"><FileUp size={15} /><span>Import soil grid CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => importGrid(event.target.files?.[0])} /></label><p className="control-hint">Columns: row, column, ph, nitrogen, phosphorus, potassium, ec, soil_temperature.</p>{importError && <p className="import-error">{importError}</p>}
        <button className="button button--primary button--run" disabled={isRunning} onClick={run}>{isRunning ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />} {isRunning ? 'Calculating from field…' : 'Run zoning'}</button><p className="control-hint">Local deterministic algorithms; results are decision support, not crop prescriptions.</p>
      </aside>
      <div className="field-stage">
        {error && <div className="error-banner"><AlertCircle size={17} /><div><strong>Local service unavailable</strong><span>{error}</span></div></div>}
        <div className="field-toolbar"><div className="view-switch"><button className={view === 'three' ? 'is-active' : ''} onClick={() => setView('three')}><Rotate3D size={14} /> 3D field</button><button className={view === 'map' ? 'is-active' : ''} onClick={() => setView('map')}><MapIcon size={14} /> 2D map</button></div><span>{interactionMode === 'brush' ? 'Brush: drag to paint' : view === 'three' ? 'Drag orbit · right-drag pan · scroll zoom' : 'Click to inspect · arrow keys navigate'}</span></div>
        <div className={`field-visual ${playback === 'revealing' ? 'field-visual--revealing' : ''}`}>{view === 'three' ? <Suspense fallback={<div className="scene-loading"><LoaderCircle className="spin" size={20} /> Loading the lightweight 3D field…</div>}><FieldScene3D cells={renderedCells} zones={fieldZones} featureRange={[activeFeature.min, activeFeature.max]} selectedCellId={selectedCellId} selectedZoneId={selectedZoneId} mode={interactionMode} onCellSelect={(cell) => { setSelectedCellId(cell.id); if (cell.zoneId) setSelectedZoneId(cell.zoneId); }} onBrushCell={applyBrushAt} onBrushEnd={finishBrush} /></Suspense> : <ZoningFieldCanvas cells={renderedCells} zones={fieldZones} featureLabel={result ? 'Zone assignment' : activeFeature.label} featureUnit={result ? undefined : activeFeature.unit} featureRange={[activeFeature.min, activeFeature.max]} selectedCellId={selectedCellId} selectedZoneId={selectedZoneId} interactionMode={interactionMode} onCellSelect={(cell) => { setSelectedCellId(cell.id); if (cell.zoneId) setSelectedZoneId(cell.zoneId); }} onBrushCell={applyBrushAt} onBrushEnd={finishBrush} onZoneSelect={setSelectedZoneId} />}{playback === 'calculating' && <div className="calculation-overlay"><LoaderCircle className="spin" size={22} /><strong>Calculating real {method === 'kmeans' ? 'K-means++' : 'Fuzzy C-means'} result</strong><span>Standardizing the six measured features locally.</span></div>}{playback === 'revealing' && <div className="reveal-note"><WandSparkles size={15} /> Revealing the completed assignment — not a simulated calculation.</div>}</div>
        <div className="field-stage__legend">{result ? <><span className="legend-label">Calculated zones</span>{fieldZones.map((zone) => <button key={zone.id} className={`zone-key ${zone.id === selectedZoneId ? 'zone-key--active' : ''}`} onClick={() => setSelectedZoneId(zone.id)}><i style={{ background: zone.color }} />{zone.label}</button>)}</> : <><span className="legend-label">{activeFeature.shortLabel}</span><span>{activeFeature.min}</span><div className="gradient-bar" /><span>{activeFeature.max} {activeFeature.unit}</span></>}</div>
        <RunEvidence result={result} playback={playback} />
      </div>
      <aside className="panel inspector-panel" aria-label="Selected observation or zone"><div className="segmented-control" role="tablist" aria-label="Analysis inspector"><button role="tab" aria-selected={pane === 'inspect'} className={pane === 'inspect' ? 'is-active' : ''} onClick={() => setPane('inspect')}>Inspect</button><button role="tab" aria-selected={pane === 'crop-fit'} className={pane === 'crop-fit' ? 'is-active' : ''} onClick={() => setPane('crop-fit')}>Crop fit</button></div>{pane === 'inspect' ? <InspectionPanel selectedCell={selectedCell} feature={feature} result={result} selectedZone={selectedZone} onEdit={editCellValue} /> : <CropFitPanel result={result} selectedZone={selectedZone} selectedCell={selectedCell} onChooseZone={() => setPane('inspect')} />}</aside>
    </div>
  </section>;
}

function RunEvidence({ result, playback }: { result: ZoningResult | null; playback: Playback }) {
  if (!result || playback === 'calculating') return null;
  const diagnostics = result.diagnostics;
  const isFuzzy = result.method === 'fuzzy-c-means';
  return <div className="run-evidence"><span><strong>{isFuzzy ? 'Fuzzy C-means' : 'K-means++ / Lloyd'}</strong> · {diagnostics?.iterations ?? '—'} actual iterations</span><span>{isFuzzy ? `FPC ${diagnostics?.fuzzyPartitionCoefficient?.toFixed(3) ?? '—'}` : `Inertia ${diagnostics?.inertia?.toFixed(2) ?? '—'}`}</span><span>{diagnostics?.converged === false ? 'Reached iteration limit' : 'Converged'}</span><small>{isFuzzy ? 'Opacity reflects the winning membership for each assigned cell.' : 'Every cell has one nearest-centroid assignment.'} The reveal follows the completed local computation.</small></div>;
}

function InspectionPanel({ selectedCell, feature, result, selectedZone, onEdit }: { selectedCell: SoilCell | null; feature: SoilFeatureKey; result: ZoningResult | null; selectedZone: ZoningResult['zones'][number] | null; onEdit: (cellId: string, feature: SoilFeatureKey, value: number) => void }) {
  if (selectedZone) return <div className="inspector-content"><div className="inspector-kicker"><Crosshair size={15} /> Zone profile</div><h2>Zone {Number(selectedZone.zoneId) + 1}</h2><p className="muted">{selectedZone.cellCount} observations · within-zone variance {selectedZone.variance.toFixed(3)}</p><dl className="metric-list">{FEATURE_KEYS.map((key) => <div key={key}><dt>{SOIL_FEATURES[key].shortLabel}</dt><dd>{formatSoilValue(key, selectedZone.mean[key])}</dd></div>)}</dl>{result?.silhouetteScore != null && <p className="quality-note">Silhouette score: <strong>{result.silhouetteScore.toFixed(2)}</strong>. This indicates separation in standardized soil-feature space, not yield quality.</p>}</div>;
  if (!selectedCell) return <div className="empty-panel"><Crosshair size={20} /><p>Select an observation on the field to inspect it.</p></div>;
  return <div className="inspector-content"><div className="inspector-kicker"><Crosshair size={15} /> Observation</div><h2>Row {selectedCell.row}, column {selectedCell.column}</h2><p className="muted">Edit a precise value here, or use Brush mode for a spatial patch. A change makes the prior run stale.</p><dl className="metric-list">{FEATURE_KEYS.map((key) => <div key={key}><dt>{SOIL_FEATURES[key].label}</dt><dd>{formatSoilValue(key, selectedCell.values[key])}</dd></div>)}</dl><CellValueEditor cell={selectedCell} feature={feature} onCommit={onEdit} /></div>;
}

function CellValueEditor({ cell, feature, onCommit }: { cell: SoilCell; feature: SoilFeatureKey; onCommit: (cellId: string, feature: SoilFeatureKey, value: number) => void }) {
  const [draft, setDraft] = useState(String(cell.values[feature]));
  useEffect(() => setDraft(String(cell.values[feature])), [cell.id, cell.values, feature]);
  const commit = () => { const parsed = Number(draft); if (Number.isFinite(parsed)) onCommit(cell.id, feature, parsed); else setDraft(String(cell.values[feature])); };
  return <div className="inline-edit"><label htmlFor="selected-value">Edit {SOIL_FEATURES[feature].shortLabel}</label><input id="selected-value" type="number" aria-label={`Edit ${SOIL_FEATURES[feature].label}`} value={draft} min={SOIL_FEATURES[feature].min} max={SOIL_FEATURES[feature].max} step={10 ** -SOIL_FEATURES[feature].precision} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></div>;
}

function CropFitPanel({ result, selectedZone, selectedCell, onChooseZone }: { result: ZoningResult | null; selectedZone: ZoneSummary | null; selectedCell: SoilCell | null; onChooseZone: () => void }) {
  const [scope, setScope] = useState<'zone' | 'cell'>('zone');
  const [soilTestMethod, setSoilTestMethod] = useState('not supplied');
  const [sampleDepth, setSampleDepth] = useState('not supplied');
  const [ecMethod, setEcMethod] = useState('not supplied');
  const [cropFit, setCropFit] = useState<CropFitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const measurements = useMemo(() => scope === 'zone' ? selectedZone?.mean ?? null : selectedCell?.values ?? null, [scope, selectedCell, selectedZone]);
  const label = scope === 'zone' ? selectedZone ? `Zone ${Number(selectedZone.zoneId) + 1} mean` : null : selectedCell ? `Cell ${selectedCell.id}` : null;
  useEffect(() => {
    if (!measurements || !label) { setCropFit(null); setError(null); return; }
    let active = true; const context: CropFitMeasurementContext = { sourceScope: label, soilTestMethod, sampleDepth, ecMethod };
    setLoading(true); setError(null);
    evaluateCropFit(measurements, context).then((response) => { if (active) setCropFit(response); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Crop-fit service unavailable.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ecMethod, label, measurements, sampleDepth, soilTestMethod]);
  if (!result) return <div className="empty-panel"><Sprout size={20} /><p>Run zoning first. Then screen either the selected zone mean or a selected grid observation.</p></div>;
  return <div className="inspector-content"><div className="inspector-kicker"><Sprout size={15} /> Evidence-aware screen</div><h2>Crop fit</h2><p className="muted">Apple, tomato, and potato are assessed independently. This is never a 100% probability split, yield forecast, or fertilizer prescription.</p><div className="crop-scope"><button className={scope === 'zone' ? 'is-active' : ''} onClick={() => setScope('zone')} disabled={!selectedZone}>Selected zone</button><button className={scope === 'cell' ? 'is-active' : ''} onClick={() => setScope('cell')} disabled={!selectedCell}>Selected cell</button></div>{!measurements && <div className="empty-inline"><p>Select {scope === 'zone' ? 'a calculated zone' : 'a field cell'} first.</p><button className="text-button" onClick={onChooseZone}>Go to inspector <ChevronRight size={14} /></button></div>}{measurements && <><p className="crop-target">Evaluating <strong>{label}</strong></p><details className="measurement-context"><summary>Measurement context (required for fuller nutrient interpretation)</summary><label>Soil test method<input value={soilTestMethod} onChange={(event) => setSoilTestMethod(event.target.value)} placeholder="e.g. Mehlich-3" /></label><label>Sample depth<input value={sampleDepth} onChange={(event) => setSampleDepth(event.target.value)} placeholder="e.g. 0–15 cm" /></label><label>EC method<input value={ecMethod} onChange={(event) => setEcMethod(event.target.value)} placeholder="e.g. saturation extract ECe" /></label></details>{loading ? <div className="empty-inline"><LoaderCircle className="spin" size={18} /><p>Checking source-backed factors…</p></div> : error ? <div className="empty-inline"><AlertCircle size={18} /><p>{error}</p></div> : <div className="crop-fit-list">{cropFit?.assessments.map((assessment) => <article className="crop-fit-card" key={assessment.crop}><div><strong>{assessment.crop}</strong><span className="fit-state">Limited screen</span></div>{assessment.factors.map((factor) => <div className="factor-row" key={factor.feature}><span>{factor.feature}</span><b className={factor.state === 'within_contextual_range' ? 'factor-state factor-state--okay' : factor.state === 'outside_contextual_range' ? 'factor-state factor-state--review' : 'factor-state'}>{factor.state === 'within_contextual_range' ? 'Within context' : factor.state === 'outside_contextual_range' ? 'Review' : 'Not assessed'}</b><p>{factor.reason}</p>{factor.supportedRange && <small>{factor.supportedRange.min}–{factor.supportedRange.max} {factor.supportedRange.unit} · <a href={factor.source?.url} target="_blank" rel="noreferrer">{factor.source?.label}</a></small>}</div>)}</article>)}</div>}{cropFit && <p className="crop-limit">{cropFit.dataLimitations[1]}</p>}</>}</div>;
}
