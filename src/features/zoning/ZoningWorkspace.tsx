import { useEffect, useMemo, useRef, useState, useCallback, Suspense } from 'react';
import {
  AlertCircle,
  ChevronRight,
  Crosshair,
  FileUp,
  FlaskConical,
  Focus,
  LoaderCircle,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Redo2,
  RefreshCcw,
  SlidersHorizontal,
  Sprout,
  TreePine,
  Undo2,
  WandSparkles,
} from 'lucide-react';
import {
  FEATURE_KEYS,
  SOIL_FEATURES,
  createStarterField,
  formatSoilValue,
  type ClusteringMethod,
  type FieldGrid,
  type SoilCell,
  type SoilFeatureKey,
  type ZoningResult,
  type ZoneSummary,
} from '../../domain/soil';
import {
  evaluateCropFit,
  runZoning,
  type CropFitMeasurementContext,
  type CropFitResponse,
  ZoningApiError,
} from '../../services/zoningApi';
import {
  FieldScene3D,
  ZoningFieldCanvas,
  type FieldInteractionMode,
  type ZoningFieldCell,
  type ZoningFieldZone,
} from './field';
import { importFieldCsv } from './fieldImport';
import { ClickSpark } from '../../components/ui/ClickSpark';
import { DecryptedText } from '../../components/ui/DecryptedText';
import { FieldReticle } from '../../components/ui/FieldReticle';

const ZONE_COLOURS = ['#387d65', '#c99037', '#4c79a6', '#9a5d8d', '#9a6d41', '#517e80'];
const MAX_HISTORY = 30;

type WorkspacePane = 'inspect' | 'crop-fit';
type FieldView = 'three' | 'atlas';
type Playback = 'idle' | 'calculating' | 'revealing' | 'ready';
type BrushDirection = 'raise' | 'lower';

const isCurrentResult = (field: FieldGrid, result: ZoningResult | null) =>
  Boolean(result && Object.keys(result.assignments).length === field.cells.length);

const cloneField = (field: FieldGrid): FieldGrid => ({
  ...field,
  cells: field.cells.map((cell) => ({ ...cell, values: { ...cell.values } })),
});

function brushDelta(feature: SoilFeatureKey, intensity: number, direction: BrushDirection) {
  const definition = SOIL_FEATURES[feature];
  const raw = (definition.max - definition.min) * (intensity / 100);
  return (direction === 'raise' ? 1 : -1) * Number(raw.toFixed(definition.precision));
}

export function ZoningWorkspace() {
  const [field, setField] = useState<FieldGrid>(() => createStarterField());
  const fieldRef = useRef(field);
  const brushBase = useRef<FieldGrid | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [feature, setFeature] = useState<SoilFeatureKey>('nitrogen');
  const [method, setMethod] = useState<ClusteringMethod>('kmeans');
  const [clusterCount, setClusterCount] = useState(3);
  const [fuzziness, setFuzziness] = useState(2);
  const [result, setResult] = useState<ZoningResult | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(field.cells[0]?.id ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<ZoningFieldCell | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [playback, setPlayback] = useState<Playback>('idle');
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [pane, setPane] = useState<WorkspacePane>('inspect');
  const [view, setView] = useState<FieldView>('three');
  const [interactionMode, setInteractionMode] = useState<FieldInteractionMode>('inspect');
  const [brushRadius, setBrushRadius] = useState(1);
  const [brushIntensity, setBrushIntensity] = useState(6);
  const [brushDirection, setBrushDirection] = useState<BrushDirection>('lower');

  // Collapsible panels state for wide panoramic soil focus
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);

  const [undoStack, setUndoStack] = useState<FieldGrid[]>([]);
  const [redoStack, setRedoStack] = useState<FieldGrid[]>([]);

  useEffect(() => {
    fieldRef.current = field;
  }, [field]);

  useEffect(() => {
    if (playback !== 'revealing') return undefined;
    const timer = window.setTimeout(() => setPlayback('ready'), 900);
    return () => window.clearTimeout(timer);
  }, [playback]);

  // Keyboard shortcut 'F' to fit camera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        setFitTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedCell = field.cells.find((cell) => cell.id === selectedCellId) ?? null;
  const selectedZone = result?.zones.find((zone) => String(zone.zoneId) === selectedZoneId) ?? null;
  const fieldZones = useMemo<ZoningFieldZone[]>(
    () =>
      (result?.zones ?? []).map((zone, index) => ({
        id: String(zone.zoneId),
        label: `Zone ${Number(zone.zoneId) + 1}`,
        color: ZONE_COLOURS[index % ZONE_COLOURS.length],
      })),
    [result]
  );
  const activeFeature = SOIL_FEATURES[feature];
  const zoningIsCurrent = isCurrentResult(field, result);

  const renderedCells = useMemo<ZoningFieldCell[]>(
    () =>
      field.cells.map((cell) => ({
        id: cell.id,
        row: cell.row,
        col: cell.column,
        value: cell.values[feature],
        zoneId: result ? String(result.assignments[cell.id]) : null,
        membership: result?.memberships?.[cell.id]?.[Number(result.assignments[cell.id])],
      })),
    [feature, field.cells, result]
  );

  const markDirty = () => {
    setResult(null);
    setSelectedZoneId(null);
    setPlayback('idle');
  };

  const recordField = (next: FieldGrid, previous = fieldRef.current) => {
    setUndoStack((history) => [...history, cloneField(previous)].slice(-MAX_HISTORY));
    setRedoStack([]);
    setField(next);
    markDirty();
  };

  const updateCells = (mutate: (cell: SoilCell) => SoilCell, record = true) => {
    const previous = fieldRef.current;
    const next = {
      ...previous,
      source: previous.source === 'starter' ? ('manual' as const) : previous.source,
      cells: previous.cells.map(mutate),
    };
    if (record) recordField(next, previous);
    else {
      setField(next);
      markDirty();
    }
  };

  const editCellValue = (cellId: string, featureToEdit: SoilFeatureKey, nextValue: number) => {
    const definition = SOIL_FEATURES[featureToEdit];
    const bounded = Number(
      Math.min(definition.max, Math.max(definition.min, nextValue)).toFixed(definition.precision)
    );
    updateCells((cell) =>
      cell.id === cellId ? { ...cell, values: { ...cell.values, [featureToEdit]: bounded } } : cell
    );
  };

  const applyBrushAt = useCallback(
    (origin: ZoningFieldCell) => {
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
        const nextValue = Number(
          Math.min(
            definition.max,
            Math.max(definition.min, cell.values[feature] + delta * falloff)
          ).toFixed(definition.precision)
        );
        return { ...cell, values: { ...cell.values, [feature]: nextValue } };
      }, false);
    },
    [feature, brushIntensity, brushDirection, brushRadius]
  );

  const finishBrush = useCallback(() => {
    brushBase.current = null;
  }, []);

  const applyPreset = (preset: 'low-nitrogen' | 'ec-pocket' | 'acid-wash') => {
    const config =
      preset === 'low-nitrogen'
        ? { key: 'nitrogen' as const, factor: 0.48 }
        : preset === 'ec-pocket'
        ? { key: 'ec' as const, add: 1.45 }
        : { key: 'ph' as const, add: -0.8 };
    const origin = selectedCell ?? fieldRef.current.cells[Math.floor(fieldRef.current.cells.length / 2)];
    const definition = SOIL_FEATURES[config.key];
    updateCells((cell) => {
      const distance = Math.hypot(cell.row - origin.row, cell.column - origin.column);
      if (distance > 3.4) return cell;
      const strength = Math.max(0, 1 - distance / 3.9);
      const base = cell.values[config.key];
      const proposed =
        'factor' in config
          ? base * (1 - (1 - (config.factor ?? 1)) * strength)
          : base + (config.add ?? 0) * strength;
      return {
        ...cell,
        values: {
          ...cell.values,
          [config.key]: Number(
            Math.min(definition.max, Math.max(definition.min, proposed)).toFixed(definition.precision)
          ),
        },
      };
    });
    setFeature(config.key);
    setInteractionMode('inspect');
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((history) => [...history, cloneField(fieldRef.current)].slice(-MAX_HISTORY));
    setUndoStack((history) => history.slice(0, -1));
    setField(cloneField(previous));
    markDirty();
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((history) => [...history, cloneField(fieldRef.current)].slice(-MAX_HISTORY));
    setRedoStack((history) => history.slice(0, -1));
    setField(cloneField(next));
    markDirty();
  };

  const run = async () => {
    setError(null);
    setIsRunning(true);
    setPlayback('calculating');
    try {
      const nextResult = await runZoning(fieldRef.current, method, clusterCount, fuzziness);
      setResult(nextResult);
      setSelectedZoneId(null);
      setPane('inspect');
      setPlayback('revealing');
    } catch (reason) {
      const message =
        reason instanceof ZoningApiError
          ? reason.message
          : 'Unable to reach the local zoning service. Start it, then run zoning again.';
      setError(message.replace(/^"|"$/g, ''));
      setPlayback('idle');
    } finally {
      setIsRunning(false);
    }
  };

  const resetPracticeField = () => {
    const next = createStarterField();
    setField(next);
    setResult(null);
    setSelectedCellId(next.cells[0]?.id ?? null);
    setSelectedZoneId(null);
    setError(null);
    setUndoStack([]);
    setRedoStack([]);
    setPlayback('idle');
  };

  const importGrid = (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Choose a .csv file using the required field-grid columns.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImportError('Field CSV files must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importFieldCsv(String(reader.result ?? ''), file.name);
      if (!imported.field) {
        setImportError(imported.errors.join(' '));
        return;
      }
      recordField(imported.field);
      setSelectedCellId(imported.field.cells[0]?.id ?? null);
    };
    reader.onerror = () => setImportError('The selected CSV could not be read.');
    reader.readAsText(file);
  };

  // Toggle Focus / Zen mode (collapse or restore both sidebars)
  const toggleFocusField = () => {
    if (leftPanelOpen || rightPanelOpen) {
      setLeftPanelOpen(false);
      setRightPanelOpen(false);
    } else {
      setLeftPanelOpen(true);
      setRightPanelOpen(true);
    }
  };

  const activeHoverOrSelected = hoveredCell ?? renderedCells.find((c) => c.id === selectedCellId);

  return (
    <section className="workspace">
      {/* Header with status & Reset */}
      <header className="workspace__header">
        <div>
          <p className="eyebrow">Field intelligence / zoning</p>
          <h1>Soil zoning &amp; management atlas</h1>
          <p className="workspace__lede">
            Explore 216 soil observations, edit conditions with radial brushes or presets, calculate
            homogeneous management zones, and screen zone means for evidence-backed crop fit.
          </p>
        </div>
        <div className="workspace__header-actions">
          <span className={`status-dot ${zoningIsCurrent ? 'status-dot--success' : ''}`}>
            {zoningIsCurrent ? 'Current run' : 'Zoning out of date'}
          </span>
          <button className="button button--secondary" onClick={resetPracticeField}>
            <RefreshCcw size={15} /> Reset practice field
          </button>
        </div>
      </header>

      {/* Notice Banner */}
      <div className={`workspace__notice ${zoningIsCurrent ? '' : 'workspace__notice--amber'}`}>
        <FlaskConical size={17} />
        <span>
          <strong>{field.source === 'starter' ? 'Practice workspace.' : 'Working field.'}</strong>{' '}
          {field.source === 'starter'
            ? 'Starter observations are synthetic and clearly labelled. Every zone is calculated from the values currently on this field.'
            : 'Edits preserve their source and require a new zoning run.'}
        </span>
      </div>

      {/* Panoramic Layout with Collapsible Sidebars & Hero Canvas */}
      <div className="flex items-start gap-4 w-full">
        {/* Collapsible Left Panel: Run & Layer Configuration */}
        {leftPanelOpen && (
          <aside className="w-[285px] flex-shrink-0 panel zoning-controls" aria-label="Zoning controls">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-evergreen-900 font-bold text-xs uppercase tracking-wider">
                <SlidersHorizontal size={16} />
                <h2>Run configuration</h2>
              </div>
              <button
                type="button"
                onClick={() => setLeftPanelOpen(false)}
                className="p-1 rounded text-sage-600 hover:text-evergreen-950 hover:bg-sage-100 transition-colors"
                title="Collapse controls panel"
                aria-label="Collapse controls panel"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>

            <label className="form-label" htmlFor="zoning-method">
              Method
            </label>
            <select
              id="zoning-method"
              className="select-control"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value as ClusteringMethod);
                markDirty();
              }}
            >
              <option value="kmeans">K-means — crisp zone assignment</option>
              <option value="fuzzy-c-means">Fuzzy C-means — membership strength</option>
            </select>

            <label className="form-label" htmlFor="cluster-count">
              Zone count
            </label>
            <select
              id="cluster-count"
              className="select-control"
              value={clusterCount}
              onChange={(e) => {
                setClusterCount(Number(e.target.value));
                markDirty();
              }}
            >
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count} zones
                </option>
              ))}
            </select>

            {method === 'fuzzy-c-means' && (
              <>
                <label className="form-label" htmlFor="fuzziness">
                  Fuzziness (m)
                </label>
                <select
                  id="fuzziness"
                  className="select-control"
                  value={fuzziness}
                  onChange={(e) => {
                    setFuzziness(Number(e.target.value));
                    markDirty();
                  }}
                >
                  <option value={1.5}>1.5 — firmer</option>
                  <option value={2}>2.0 — balanced</option>
                  <option value={2.5}>2.5 — softer</option>
                </select>
                <p className="control-hint">
                  m controls how softly a cell can belong to several zones; it does not add random noise.
                </p>
              </>
            )}

            <div className="control-rule" />

            <label className="form-label" htmlFor="feature">
              Visible field layer
            </label>
            <select
              id="feature"
              className="select-control"
              value={feature}
              onChange={(e) => setFeature(e.target.value as SoilFeatureKey)}
            >
              {FEATURE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SOIL_FEATURES[key].label}
                </option>
              ))}
            </select>
            <p className="control-hint">
              All six observations are standardized and used for every zoning run. This selector changes
              surface display and brush target.
            </p>

            <div className="preset-block">
              <span className="form-label">Quick scenarios</span>
              <button onClick={() => applyPreset('low-nitrogen')}>Low nitrogen patch</button>
              <button onClick={() => applyPreset('ec-pocket')}>High EC pocket</button>
              <button onClick={() => applyPreset('acid-wash')}>Acidic wash</button>
            </div>

            <label className="import-grid">
              <FileUp size={15} />
              <span>Import soil grid CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => importGrid(e.target.files?.[0])}
              />
            </label>
            <p className="control-hint">
              Columns: row, column, ph, nitrogen, phosphorus, potassium, ec, soil_temperature.
            </p>
            {importError && <p className="import-error">{importError}</p>}

            <button
              className="button button--primary button--run"
              disabled={isRunning}
              onClick={run}
            >
              {isRunning ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
              {isRunning ? 'Calculating from field…' : 'Run zoning'}
            </button>
            <p className="control-hint">
              Local deterministic algorithms; results are decision support, not crop prescriptions.
            </p>
          </aside>
        )}

        {/* Hero Central Field Stage (Maximizes to 100% width when sidebars collapse) */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {error && (
            <div className="error-banner">
              <AlertCircle size={17} />
              <div>
                <strong>Local service unavailable</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Interactive Field Stage Container */}
          <div
            ref={stageRef}
            className={`relative w-full rounded-xl overflow-hidden border border-evergreen-850 shadow-2xl bg-evergreen-950 field-stage-pattern ${
              interactionMode === 'brush' ? 'cursor-field-brush' : 'cursor-field-reticle'
            }`}
            style={{ minHeight: 600, height: 'clamp(580px, 74vh, 840px)' }}
          >
            {/* Top Seam & Controls Bar */}
            <div className="absolute top-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
              {/* Left: Open Controls if closed & Architecture Seam Badge */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {!leftPanelOpen && (
                  <button
                    type="button"
                    onClick={() => setLeftPanelOpen(true)}
                    className="stage-floating-btn"
                    title="Open configuration panel"
                  >
                    <PanelLeftOpen size={14} />
                    <span>Run Config</span>
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-mono tracking-wider bg-evergreen-900/90 text-sage-300 border border-sage-700/40 backdrop-blur-md shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-verdigris animate-pulse" />
                  FIELD STAGE · 18×12 GRID (216 CELLS)
                </span>
              </div>

              {/* Center: View Switcher (3D Realistic vs 2.5D Atlas Map) & Focus Field */}
              <div className="flex items-center gap-2 pointer-events-auto">
                <div className="flex items-center p-1 rounded-lg bg-evergreen-900/90 border border-sage-700/40 backdrop-blur-md shadow-md">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      view === 'three'
                        ? 'bg-sage-600/90 text-white shadow-sm'
                        : 'text-sage-300 hover:text-white'
                    }`}
                    onClick={() => setView('three')}
                  >
                    <TreePine size={13} />
                    <span>3D Realistic</span>
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                      view === 'atlas'
                        ? 'bg-sage-600/90 text-white shadow-sm'
                        : 'text-sage-300 hover:text-white'
                    }`}
                    onClick={() => setView('atlas')}
                  >
                    <MapIcon size={13} />
                    <span>2.5D Atlas</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleFocusField}
                  className="stage-floating-btn"
                  title={leftPanelOpen || rightPanelOpen ? 'Maximize field canvas' : 'Restore side panels'}
                >
                  {leftPanelOpen || rightPanelOpen ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                  <span>{leftPanelOpen || rightPanelOpen ? 'Focus' : 'Standard'}</span>
                </button>
              </div>

              {/* Right: DecryptedText Live Coordinate HUD & Open Inspector if closed */}
              <div className="flex items-center gap-2 pointer-events-auto">
                {activeHoverOrSelected && (
                  <div className="px-3 py-1.5 rounded-md text-xs font-mono bg-evergreen-900/95 text-sage-200 border border-sage-700/50 shadow-md flex items-center gap-2 backdrop-blur-md">
                    <span className="text-sage-400 font-semibold">
                      <DecryptedText
                        text={`R${activeHoverOrSelected.row} : C${activeHoverOrSelected.col}`}
                        speed={30}
                        maxIterations={5}
                        animateOn="change"
                      />
                    </span>
                    <span className="text-evergreen-700">|</span>
                    <span>
                      {activeHoverOrSelected.value.toFixed(SOIL_FEATURES[feature].precision)}{' '}
                      {activeFeature.unit}
                    </span>
                    {activeHoverOrSelected.zoneId && (
                      <>
                        <span className="text-evergreen-700">|</span>
                        <span className="text-amberGold font-semibold">
                          Zone {Number(activeHoverOrSelected.zoneId) + 1}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {!rightPanelOpen && (
                  <button
                    type="button"
                    onClick={() => setRightPanelOpen(true)}
                    className="stage-floating-btn"
                    title="Open inspector panel"
                  >
                    <PanelRightOpen size={14} />
                    <span>Inspector</span>
                  </button>
                )}
              </div>
            </div>

            {/* Field Reticle Guidelines & Corner Surveyor Markings from 0efec7b */}
            <FieldReticle
              containerRef={stageRef}
              hoveredCellRow={hoveredCell?.row ?? null}
              hoveredCellCol={hoveredCell?.col ?? null}
              totalRows={12}
              totalCols={18}
              activeFeatureLabel={activeFeature.label}
              activeFeatureValue={hoveredCell?.value}
              activeFeatureUnit={activeFeature.unit}
            />

            {/* Tactile Particle Burst with ClickSpark */}
            <ClickSpark
              sparkColor={interactionMode === 'brush' ? '#C86B49' : '#387D65'}
              sparkRadius={24}
              className="w-full h-full"
            >
              <div className="w-full h-full relative">
                {view === 'three' ? (
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center h-full gap-2 text-sage-300">
                        <LoaderCircle className="spin" size={20} />
                        <span>Rendering 3D realistic field…</span>
                      </div>
                    }
                  >
                    <FieldScene3D
                      cells={renderedCells}
                      zones={fieldZones}
                      featureRange={[activeFeature.min, activeFeature.max]}
                      selectedCellId={selectedCellId}
                      selectedZoneId={selectedZoneId}
                      mode={interactionMode}
                      brushRadius={brushRadius}
                      fitTrigger={fitTrigger}
                      onCellSelect={(cell) => {
                        setSelectedCellId(cell.id);
                        if (cell.zoneId) setSelectedZoneId(cell.zoneId);
                      }}
                      onBrushCell={applyBrushAt}
                      onBrushEnd={finishBrush}
                      onCellHover={setHoveredCell}
                    />
                  </Suspense>
                ) : (
                  <ZoningFieldCanvas
                    cells={renderedCells}
                    zones={fieldZones}
                    featureLabel={result ? 'Zone assignment' : activeFeature.label}
                    featureUnit={result ? undefined : activeFeature.unit}
                    featureRange={[activeFeature.min, activeFeature.max]}
                    selectedCellId={selectedCellId}
                    selectedZoneId={selectedZoneId}
                    interactionMode={interactionMode}
                    brushRadius={brushRadius}
                    onCellSelect={(cell) => {
                      setSelectedCellId(cell.id);
                      if (cell.zoneId) setSelectedZoneId(cell.zoneId);
                    }}
                    onBrushCell={applyBrushAt}
                    onBrushEnd={finishBrush}
                    onCellHover={setHoveredCell}
                    onZoneSelect={setSelectedZoneId}
                  />
                )}

                {/* Calculation Overlay */}
                {playback === 'calculating' && (
                  <div className="calculation-overlay">
                    <LoaderCircle className="spin" size={24} />
                    <strong>Calculating real {method === 'kmeans' ? 'K-means++' : 'Fuzzy C-means'} result</strong>
                    <span>Standardizing 6 soil features and clustering locally.</span>
                  </div>
                )}

                {/* Reveal Note Animation */}
                {playback === 'revealing' && (
                  <div className="reveal-note">
                    <WandSparkles size={15} />
                    <span>Revealing completed cluster assignment from standardized field features.</span>
                  </div>
                )}
              </div>
            </ClickSpark>

            {/* Floating Bottom Quick Action Dock */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
              <div className="stage-dock">
                {/* Tool Switcher */}
                <div className="flex items-center gap-1 p-0.5 rounded-full bg-evergreen-950/80 border border-sage-700/40">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      interactionMode === 'inspect'
                        ? 'bg-sage-600 text-white shadow-sm'
                        : 'text-sage-300 hover:text-white'
                    }`}
                    onClick={() => setInteractionMode('inspect')}
                  >
                    <Crosshair size={13} />
                    <span>Inspect</span>
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      interactionMode === 'brush'
                        ? 'bg-clay text-white shadow-sm'
                        : 'text-sage-300 hover:text-white'
                    }`}
                    onClick={() => setInteractionMode('brush')}
                  >
                    <Paintbrush size={13} />
                    <span>Brush</span>
                  </button>
                </div>

                {/* Brush Settings inline when brush is active */}
                {interactionMode === 'brush' && (
                  <div className="flex items-center gap-2 pl-1 pr-2 border-l border-sage-700/40 text-[11px] text-sage-200">
                    <select
                      value={brushDirection}
                      onChange={(e) => setBrushDirection(e.target.value as BrushDirection)}
                      className="bg-evergreen-900 border border-sage-700/60 rounded px-1.5 py-0.5 text-xs text-white"
                    >
                      <option value="lower">Lower</option>
                      <option value="raise">Raise</option>
                    </select>

                    <div className="flex items-center gap-1">
                      <span className="text-sage-400">Radius:</span>
                      {[1, 2, 3].map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`w-5 h-5 rounded text-[10px] font-bold ${
                            brushRadius === r
                              ? 'bg-clay text-white'
                              : 'bg-evergreen-900 text-sage-300 hover:bg-evergreen-800'
                          }`}
                          onClick={() => setBrushRadius(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-sage-400">Strength:</span>
                      <input
                        type="range"
                        min="2"
                        max="12"
                        value={brushIntensity}
                        onChange={(e) => setBrushIntensity(Number(e.target.value))}
                        className="w-14 accent-clay cursor-pointer"
                      />
                      <span className="font-mono text-[10px]">{brushIntensity}%</span>
                    </div>
                  </div>
                )}

                <div className="w-px h-4 bg-sage-700/40" />

                {/* Undo / Redo */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!undoStack.length}
                    onClick={undo}
                    className="p-1 rounded text-sage-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Undo stroke"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={!redoStack.length}
                    onClick={redo}
                    className="p-1 rounded text-sage-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Redo stroke"
                  >
                    <Redo2 size={14} />
                  </button>
                </div>

                <div className="w-px h-4 bg-sage-700/40" />

                {/* Fit Camera */}
                <button
                  type="button"
                  onClick={() => setFitTrigger((prev) => prev + 1)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-sage-300 hover:text-white"
                  title="Fit camera view (Press F)"
                >
                  <Focus size={13} />
                  <span>Fit</span>
                </button>

                <div className="w-px h-4 bg-sage-700/40" />

                {/* Run Zoning Trigger in Dock */}
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={run}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sage-500 hover:bg-sage-400 text-white shadow-md disabled:opacity-50"
                >
                  {isRunning ? <LoaderCircle className="spin" size={13} /> : <Play size={13} fill="currentColor" />}
                  <span>{isRunning ? 'Running…' : 'Run'}</span>
                </button>
              </div>
            </div>

            {/* Bottom Status Indicators from 0efec7b */}
            <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[11px] text-sage-400 font-mono z-10 pointer-events-none">
              <div className="flex items-center gap-2">
                <span>
                  Mode: <strong className="text-sage-200">{interactionMode.toUpperCase()}</strong>
                </span>
                <span>•</span>
                <span>
                  Layer: <strong className="text-sage-200">{activeFeature.label.toUpperCase()}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-evergreen-900 border border-sage-800 text-sage-300">
                  F
                </kbd>
                <span className="text-sage-500">Fit camera</span>
                <span>•</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-evergreen-900 border border-sage-800 text-sage-300">
                  Arrow keys
                </kbd>
                <span className="text-sage-500">Navigate</span>
              </div>
            </div>
          </div>

          {/* Field Stage Legend */}
          <div className="field-stage__legend">
            {result ? (
              <>
                <span className="legend-label">Calculated zones:</span>
                {fieldZones.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    className={`zone-key ${zone.id === selectedZoneId ? 'zone-key--active' : ''}`}
                    onClick={() =>
                      setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id)
                    }
                  >
                    <i style={{ background: zone.color }} />
                    {zone.label}
                  </button>
                ))}
              </>
            ) : (
              <>
                <span className="legend-label">{activeFeature.shortLabel} scale:</span>
                <span>{activeFeature.min}</span>
                <div className="gradient-bar" />
                <span>
                  {activeFeature.max} {activeFeature.unit}
                </span>
              </>
            )}
          </div>

          {/* Diagnostic Evidence Summary */}
          <RunEvidence result={result} playback={playback} />
        </div>

        {/* Collapsible Right Panel: Selected Observation / Crop Fit */}
        {rightPanelOpen && (
          <aside className="w-[315px] flex-shrink-0 panel inspector-panel" aria-label="Selected observation or zone">
            <div className="flex items-center justify-between mb-3">
              <div className="segmented-control flex-1 mr-2" role="tablist" aria-label="Analysis inspector">
                <button
                  role="tab"
                  aria-selected={pane === 'inspect'}
                  className={pane === 'inspect' ? 'is-active' : ''}
                  onClick={() => setPane('inspect')}
                >
                  Inspect
                </button>
                <button
                  role="tab"
                  aria-selected={pane === 'crop-fit'}
                  className={pane === 'crop-fit' ? 'is-active' : ''}
                  onClick={() => setPane('crop-fit')}
                >
                  Crop fit
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRightPanelOpen(false)}
                className="p-1 rounded text-sage-600 hover:text-evergreen-950 hover:bg-sage-100 transition-colors"
                title="Collapse inspector panel"
                aria-label="Collapse inspector panel"
              >
                <PanelRightClose size={16} />
              </button>
            </div>

            {pane === 'inspect' ? (
              <InspectionPanel
                selectedCell={selectedCell}
                feature={feature}
                result={result}
                selectedZone={selectedZone}
                onEdit={editCellValue}
              />
            ) : (
              <CropFitPanel
                result={result}
                selectedZone={selectedZone}
                selectedCell={selectedCell}
                onChooseZone={() => setPane('inspect')}
              />
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

function RunEvidence({ result, playback }: { result: ZoningResult | null; playback: Playback }) {
  if (!result || playback === 'calculating') return null;
  const diagnostics = result.diagnostics;
  const isFuzzy = result.method === 'fuzzy-c-means';
  return (
    <div className="run-evidence">
      <span>
        <strong>{isFuzzy ? 'Fuzzy C-means' : 'K-means++ / Lloyd'}</strong> ·{' '}
        {diagnostics?.iterations ?? '—'} actual iterations
      </span>
      <span>
        {isFuzzy
          ? `FPC ${diagnostics?.fuzzyPartitionCoefficient?.toFixed(3) ?? '—'}`
          : `Inertia ${diagnostics?.inertia?.toFixed(2) ?? '—'}`}
      </span>
      <span>{diagnostics?.converged === false ? 'Reached iteration limit' : 'Converged'}</span>
      <small>
        {isFuzzy
          ? 'Soft opacity reflects the winning membership for each assigned cell.'
          : 'Every cell has one nearest-centroid assignment.'}{' '}
        The reveal follows the completed local computation.
      </small>
    </div>
  );
}

function InspectionPanel({
  selectedCell,
  feature,
  result,
  selectedZone,
  onEdit,
}: {
  selectedCell: SoilCell | null;
  feature: SoilFeatureKey;
  result: ZoningResult | null;
  selectedZone: ZoningResult['zones'][number] | null;
  onEdit: (cellId: string, feature: SoilFeatureKey, value: number) => void;
}) {
  if (selectedZone) {
    return (
      <div className="inspector-content">
        <div className="inspector-kicker">
          <Crosshair size={15} /> Zone profile
        </div>
        <h2>Zone {Number(selectedZone.zoneId) + 1}</h2>
        <p className="muted">
          {selectedZone.cellCount} observations · within-zone variance{' '}
          {selectedZone.variance.toFixed(3)}
        </p>
        <dl className="metric-list">
          {FEATURE_KEYS.map((key) => (
            <div key={key}>
              <dt>{SOIL_FEATURES[key].shortLabel}</dt>
              <dd>{formatSoilValue(key, selectedZone.mean[key])}</dd>
            </div>
          ))}
        </dl>
        {result?.silhouetteScore != null && (
          <p className="quality-note">
            Silhouette score: <strong>{result.silhouetteScore.toFixed(2)}</strong>. This indicates
            separation in standardized soil-feature space, not yield quality.
          </p>
        )}
      </div>
    );
  }

  if (!selectedCell) {
    return (
      <div className="empty-panel">
        <Crosshair size={20} />
        <p>Select an observation on the field to inspect it.</p>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <div className="inspector-kicker">
        <Crosshair size={15} /> Observation
      </div>
      <h2>
        Row {selectedCell.row}, column {selectedCell.column}
      </h2>
      <p className="muted">
        Edit a precise value here, or use Brush mode for a spatial patch. A change makes the prior run
        stale.
      </p>
      <dl className="metric-list">
        {FEATURE_KEYS.map((key) => (
          <div key={key}>
            <dt>{SOIL_FEATURES[key].label}</dt>
            <dd>{formatSoilValue(key, selectedCell.values[key])}</dd>
          </div>
        ))}
      </dl>
      <CellValueEditor cell={selectedCell} feature={feature} onCommit={onEdit} />
    </div>
  );
}

function CellValueEditor({
  cell,
  feature,
  onCommit,
}: {
  cell: SoilCell;
  feature: SoilFeatureKey;
  onCommit: (cellId: string, feature: SoilFeatureKey, value: number) => void;
}) {
  const [draft, setDraft] = useState(String(cell.values[feature]));
  useEffect(() => setDraft(String(cell.values[feature])), [cell.id, cell.values, feature]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(cell.id, feature, parsed);
    else setDraft(String(cell.values[feature]));
  };
  return (
    <div className="inline-edit">
      <label htmlFor="selected-value">Edit {SOIL_FEATURES[feature].shortLabel}</label>
      <input
        id="selected-value"
        type="number"
        aria-label={`Edit ${SOIL_FEATURES[feature].label}`}
        value={draft}
        min={SOIL_FEATURES[feature].min}
        max={SOIL_FEATURES[feature].max}
        step={10 ** -SOIL_FEATURES[feature].precision}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </div>
  );
}

function CropFitPanel({
  result,
  selectedZone,
  selectedCell,
  onChooseZone,
}: {
  result: ZoningResult | null;
  selectedZone: ZoneSummary | null;
  selectedCell: SoilCell | null;
  onChooseZone: () => void;
}) {
  const [scope, setScope] = useState<'zone' | 'cell'>('zone');
  const [soilTestMethod, setSoilTestMethod] = useState('not supplied');
  const [sampleDepth, setSampleDepth] = useState('not supplied');
  const [ecMethod, setEcMethod] = useState('not supplied');
  const [cropFit, setCropFit] = useState<CropFitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const measurements = useMemo(
    () => (scope === 'zone' ? selectedZone?.mean ?? null : selectedCell?.values ?? null),
    [scope, selectedCell, selectedZone]
  );
  const label =
    scope === 'zone'
      ? selectedZone
        ? `Zone ${Number(selectedZone.zoneId) + 1} mean`
        : null
      : selectedCell
      ? `Cell ${selectedCell.id}`
      : null;

  useEffect(() => {
    if (!measurements || !label) {
      setCropFit(null);
      setError(null);
      return;
    }
    let active = true;
    const context: CropFitMeasurementContext = {
      sourceScope: label,
      soilTestMethod,
      sampleDepth,
      ecMethod,
    };
    setLoading(true);
    setError(null);
    evaluateCropFit(measurements, context)
      .then((response) => {
        if (active) setCropFit(response);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Crop-fit service unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ecMethod, label, measurements, sampleDepth, soilTestMethod]);

  if (!result) {
    return (
      <div className="empty-panel">
        <Sprout size={20} />
        <p>Run zoning first. Then screen either the selected zone mean or a selected grid observation.</p>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <div className="inspector-kicker">
        <Sprout size={15} /> Evidence-aware screen
      </div>
      <h2>Crop fit</h2>
      <p className="muted">
        Apple, tomato, and potato are assessed independently. This is never a 100% probability split,
        yield forecast, or fertilizer prescription.
      </p>
      <div className="crop-scope">
        <button
          className={scope === 'zone' ? 'is-active' : ''}
          onClick={() => setScope('zone')}
          disabled={!selectedZone}
        >
          Selected zone
        </button>
        <button
          className={scope === 'cell' ? 'is-active' : ''}
          onClick={() => setScope('cell')}
          disabled={!selectedCell}
        >
          Selected cell
        </button>
      </div>

      {!measurements && (
        <div className="empty-inline">
          <p>Select {scope === 'zone' ? 'a calculated zone' : 'a field cell'} first.</p>
          <button className="text-button" onClick={onChooseZone}>
            Go to inspector <ChevronRight size={14} />
          </button>
        </div>
      )}

      {measurements && (
        <>
          <p className="crop-target">
            Evaluating <strong>{label}</strong>
          </p>
          <details className="measurement-context">
            <summary>Measurement context (required for fuller nutrient interpretation)</summary>
            <label>
              Soil test method
              <input
                value={soilTestMethod}
                onChange={(e) => setSoilTestMethod(e.target.value)}
                placeholder="e.g. Mehlich-3"
              />
            </label>
            <label>
              Sample depth
              <input
                value={sampleDepth}
                onChange={(e) => setSampleDepth(e.target.value)}
                placeholder="e.g. 0–15 cm"
              />
            </label>
            <label>
              EC method
              <input
                value={ecMethod}
                onChange={(e) => setEcMethod(e.target.value)}
                placeholder="e.g. saturation extract ECe"
              />
            </label>
          </details>

          {loading ? (
            <div className="empty-inline">
              <LoaderCircle className="spin" size={18} />
              <p>Checking source-backed factors…</p>
            </div>
          ) : error ? (
            <div className="empty-inline">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          ) : (
            <div className="crop-fit-list">
              {cropFit?.assessments.map((assessment) => (
                <article className="crop-fit-card" key={assessment.crop}>
                  <div>
                    <strong>{assessment.crop}</strong>
                    <span className="fit-state">Limited screen</span>
                  </div>
                  {assessment.factors.map((factor) => (
                    <div className="factor-row" key={factor.feature}>
                      <span>{factor.feature}</span>
                      <b
                        className={
                          factor.state === 'within_contextual_range'
                            ? 'factor-state factor-state--okay'
                            : factor.state === 'outside_contextual_range'
                            ? 'factor-state factor-state--review'
                            : 'factor-state'
                        }
                      >
                        {factor.state === 'within_contextual_range'
                          ? 'Within context'
                          : factor.state === 'outside_contextual_range'
                          ? 'Review'
                          : 'Not assessed'}
                      </b>
                      <p>{factor.reason}</p>
                      {factor.supportedRange && (
                        <small>
                          {factor.supportedRange.min}–{factor.supportedRange.max}{' '}
                          {factor.supportedRange.unit} ·{' '}
                          <a href={factor.source?.url} target="_blank" rel="noreferrer">
                            {factor.source?.label}
                          </a>
                        </small>
                      )}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}

          {cropFit && <p className="crop-limit">{cropFit.dataLimitations[1]}</p>}
        </>
      )}
    </div>
  );
}
