import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, Crosshair, FileUp, FlaskConical, LoaderCircle, Play, RefreshCcw, SlidersHorizontal, Sprout } from 'lucide-react';
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
} from '../../domain/soil';
import { evaluateCropFit, runZoning, type CropFitResponse, ZoningApiError } from '../../services/zoningApi';
import { ZoningFieldCanvas, type ZoningFieldZone } from './field';
import { importFieldCsv } from './fieldImport';

const ZONE_COLOURS = ['#387d65', '#c99037', '#4c79a6', '#9a5d8d', '#9a6d41', '#517e80'];

type WorkspacePane = 'inspect' | 'crop-fit';

const isCurrentResult = (field: FieldGrid, result: ZoningResult | null) => {
  if (!result) return false;
  return Object.keys(result.assignments).length === field.cells.length;
};

export function ZoningWorkspace() {
  const [field, setField] = useState<FieldGrid>(() => createStarterField());
  const [feature, setFeature] = useState<SoilFeatureKey>('nitrogen');
  const [method, setMethod] = useState<ClusteringMethod>('kmeans');
  const [clusterCount, setClusterCount] = useState(3);
  const [result, setResult] = useState<ZoningResult | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(field.cells[0]?.id ?? null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pane, setPane] = useState<WorkspacePane>('inspect');

  const selectedCell = field.cells.find((cell) => cell.id === selectedCellId) ?? null;
  const selectedZone = result?.zones.find((zone) => String(zone.zoneId) === selectedZoneId) ?? null;
  const fieldZones = useMemo<ZoningFieldZone[]>(() => (result?.zones ?? []).map((zone, index) => ({
    id: String(zone.zoneId),
    label: `Zone ${Number(zone.zoneId) + 1}`,
    color: ZONE_COLOURS[index % ZONE_COLOURS.length],
  })), [result]);

  const activeFeature = SOIL_FEATURES[feature];
  const zoningIsCurrent = isCurrentResult(field, result);

  const editSelectedValue = (next: string) => {
    if (!selectedCell) return;
    const parsed = Number(next);
    if (!Number.isFinite(parsed)) return;
    const definition = SOIL_FEATURES[feature];
    const bounded = Math.min(definition.max, Math.max(definition.min, parsed));
    setField((current) => ({
      ...current,
      source: current.source === 'starter' ? 'manual' : current.source,
      cells: current.cells.map((cell) => cell.id === selectedCell.id
        ? { ...cell, values: { ...cell.values, [feature]: Number(bounded.toFixed(definition.precision)) } }
        : cell),
    }));
    setResult(null);
    setSelectedZoneId(null);
  };

  const run = async () => {
    setError(null);
    setIsRunning(true);
    try {
      const nextResult = await runZoning(field, method, clusterCount);
      setResult(nextResult);
      setSelectedZoneId(null);
      setPane('inspect');
    } catch (reason) {
      const message = reason instanceof ZoningApiError
        ? reason.message
        : 'Unable to reach the local zoning service. Start it, then run zoning again.';
      setError(message.replace(/^"|"$/g, ''));
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
  };

  const importGrid = (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.csv')) { setImportError('Choose a .csv file using the required field-grid columns.'); return; }
    if (file.size > 2 * 1024 * 1024) { setImportError('Field CSV files must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importFieldCsv(String(reader.result ?? ''), file.name);
      if (!imported.field) { setImportError(imported.errors.join(' ')); return; }
      setField(imported.field);
      setResult(null);
      setSelectedCellId(imported.field.cells[0]?.id ?? null);
      setSelectedZoneId(null);
    };
    reader.onerror = () => setImportError('The selected CSV could not be read.');
    reader.readAsText(file);
  };

  return (
    <section className="workspace">
      <header className="workspace__header">
        <div>
          <p className="eyebrow">Analysis workspace</p>
          <h1>Soil zoning</h1>
          <p className="workspace__lede">Group comparable soil observations, inspect a zone, then review crop fit for that exact zone.</p>
        </div>
        <div className="workspace__header-actions">
          <span className={`status-dot ${zoningIsCurrent ? 'status-dot--success' : ''}`}>{zoningIsCurrent ? 'Current run' : 'Needs run'}</span>
          <button className="button button--secondary" onClick={resetPracticeField}><RefreshCcw size={15} /> Reset practice field</button>
        </div>
      </header>

      <div className="workspace__notice">
        <FlaskConical size={17} />
        <span><strong>{field.source === 'starter' ? 'Practice workspace.' : 'Working field.'}</strong> {field.source === 'starter' ? 'Values are generated starter observations; any displayed zones are calculated live from them.' : 'Changes invalidate the last zoning run until you run it again.'}</span>
      </div>

      <div className="zoning-layout">
        <aside className="panel zoning-controls" aria-label="Zoning controls">
          <div className="panel__heading"><SlidersHorizontal size={17} /><h2>Run configuration</h2></div>
          <label className="form-label" htmlFor="zoning-method">Method</label>
          <select id="zoning-method" className="select-control" value={method} onChange={(event) => setMethod(event.target.value as ClusteringMethod)}>
            <option value="kmeans">K-means — clear assignments</option>
            <option value="fuzzy-c-means">Fuzzy C-means — soft membership</option>
          </select>
          <label className="form-label" htmlFor="cluster-count">Zone count</label>
          <select id="cluster-count" className="select-control" value={clusterCount} onChange={(event) => setClusterCount(Number(event.target.value))}>
            {[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} zones</option>)}
          </select>
          <div className="control-rule" />
          <label className="form-label" htmlFor="feature">Field layer</label>
          <select id="feature" className="select-control" value={feature} onChange={(event) => setFeature(event.target.value as SoilFeatureKey)}>
            {FEATURE_KEYS.map((key) => <option key={key} value={key}>{SOIL_FEATURES[key].label}</option>)}
          </select>
          <p className="control-hint">All six listed observations feed the cluster algorithm. The field layer only changes this map’s color.</p>
          <label className="import-grid"><FileUp size={15} /><span>Import soil grid CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => importGrid(event.target.files?.[0])} /></label>
          <p className="control-hint">Columns: row, column, ph, nitrogen, phosphorus, potassium, ec, soil_temperature.</p>
          {importError && <p className="import-error">{importError}</p>}
          <button className="button button--primary button--run" disabled={isRunning} onClick={run}>
            {isRunning ? <LoaderCircle className="spin" size={17} /> : <Play size={17} fill="currentColor" />} {isRunning ? 'Running zoning…' : 'Run zoning'}
          </button>
          <p className="control-hint">Uses a local, deterministic service. Results are not crop advice.</p>
        </aside>

        <div className="field-stage">
          {error && <div className="error-banner"><AlertCircle size={17} /><div><strong>Local service unavailable</strong><span>{error}</span></div></div>}
          <ZoningFieldCanvas
            cells={field.cells.map((cell) => ({
              id: cell.id,
              row: cell.row,
              col: cell.column,
              value: cell.values[feature],
              zoneId: result ? String(result.assignments[cell.id]) : null,
              membership: result?.memberships?.[cell.id]?.[Number(result.assignments[cell.id])],
            }))}
            zones={fieldZones}
            featureLabel={result ? 'Zone assignment' : activeFeature.label}
            featureUnit={result ? undefined : activeFeature.unit}
            featureRange={[activeFeature.min, activeFeature.max]}
            selectedCellId={selectedCellId}
            selectedZoneId={selectedZoneId}
            onCellSelect={(cell) => setSelectedCellId(cell.id)}
            onZoneSelect={setSelectedZoneId}
          />
          <div className="field-stage__legend">
            {result ? <><span className="legend-label">Calculated zones</span>{fieldZones.map((zone) => <button key={zone.id} className={`zone-key ${zone.id === selectedZoneId ? 'zone-key--active' : ''}`} onClick={() => setSelectedZoneId(zone.id)}><i style={{ background: zone.color }} />{zone.label}</button>)}</> : <><span className="legend-label">{activeFeature.shortLabel}</span><span>{activeFeature.min}</span><div className="gradient-bar" /><span>{activeFeature.max} {activeFeature.unit}</span></>}
          </div>
        </div>

        <aside className="panel inspector-panel" aria-label="Selected observation or zone">
          <div className="segmented-control" role="tablist" aria-label="Analysis inspector">
            <button role="tab" aria-selected={pane === 'inspect'} className={pane === 'inspect' ? 'is-active' : ''} onClick={() => setPane('inspect')}>Inspect</button>
            <button role="tab" aria-selected={pane === 'crop-fit'} className={pane === 'crop-fit' ? 'is-active' : ''} onClick={() => setPane('crop-fit')}>Crop fit</button>
          </div>
          {pane === 'inspect' ? <InspectionPanel selectedCell={selectedCell} feature={feature} result={result} selectedZone={selectedZone} onEdit={editSelectedValue} /> : <CropFitPanel result={result} selectedZone={selectedZone} onChooseZone={() => setPane('inspect')} />}
        </aside>
      </div>
    </section>
  );
}

function InspectionPanel({ selectedCell, feature, result, selectedZone, onEdit }: { selectedCell: SoilCell | null; feature: SoilFeatureKey; result: ZoningResult | null; selectedZone: ZoningResult['zones'][number] | null; onEdit: (value: string) => void }) {
  if (selectedZone) {
    return <div className="inspector-content"><div className="inspector-kicker"><Crosshair size={15} /> Zone profile</div><h2>Zone {Number(selectedZone.zoneId) + 1}</h2><p className="muted">{selectedZone.cellCount} observations · variance {selectedZone.variance.toFixed(3)}</p><dl className="metric-list">{FEATURE_KEYS.map((key) => <div key={key}><dt>{SOIL_FEATURES[key].shortLabel}</dt><dd>{formatSoilValue(key, selectedZone.mean[key])}</dd></div>)}</dl>{result?.silhouetteScore != null && <p className="quality-note">Separation score: <strong>{result.silhouetteScore.toFixed(2)}</strong></p>}</div>;
  }
  if (!selectedCell) return <div className="empty-panel"><Crosshair size={20} /><p>Select an observation on the field to inspect it.</p></div>;
  return <div className="inspector-content"><div className="inspector-kicker"><Crosshair size={15} /> Observation</div><h2>Row {selectedCell.row}, column {selectedCell.column}</h2><p className="muted">Edit one value at a time. Any edit makes prior zones stale.</p><dl className="metric-list">{FEATURE_KEYS.map((key) => <div key={key}><dt>{SOIL_FEATURES[key].label}</dt><dd>{formatSoilValue(key, selectedCell.values[key])}</dd></div>)}</dl><div className="inline-edit"><label htmlFor="selected-value">Edit {SOIL_FEATURES[feature].shortLabel}</label><input id="selected-value" type="number" aria-label={`Edit ${SOIL_FEATURES[feature].label}`} defaultValue={selectedCell.values[feature]} key={`${selectedCell.id}-${feature}-${selectedCell.values[feature]}`} min={SOIL_FEATURES[feature].min} max={SOIL_FEATURES[feature].max} step={10 ** -SOIL_FEATURES[feature].precision} onChange={(event) => onEdit(event.target.value)} /></div></div>;
}

function CropFitPanel({ result, selectedZone, onChooseZone }: { result: ZoningResult | null; selectedZone: ZoningResult['zones'][number] | null; onChooseZone: () => void }) {
  const [cropFit, setCropFit] = useState<CropFitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedZone) {
      setCropFit(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    evaluateCropFit(selectedZone).then((response) => {
      if (active) setCropFit(response);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Crop-fit service unavailable.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [selectedZone]);

  if (!result) return <div className="empty-panel"><Sprout size={20} /><p>Run zoning, then select a zone to review its crop fit.</p></div>;
  if (!selectedZone) return <div className="empty-panel"><Sprout size={20} /><p>Select a calculated zone first. Crop fit always evaluates the selected zone’s means, not the whole field.</p><button className="text-button" onClick={onChooseZone}>Go to inspector <ChevronRight size={14} /></button></div>;
  if (loading) return <div className="empty-panel"><LoaderCircle className="spin" size={20} /><p>Checking the selected zone against the versioned crop profiles…</p></div>;
  if (error) return <div className="empty-panel"><AlertCircle size={20} /><p>Crop fit could not run.</p><small>{error}</small></div>;
  return (
    <div className="inspector-content">
      <div className="inspector-kicker"><Sprout size={15} /> Zone-specific screening</div>
      <h2>Crop fit for zone {Number(selectedZone.zoneId) + 1}</h2>
      <p className="muted">Each crop is assessed independently from this zone’s mean values. No result is a probability, yield forecast, or prescription.</p>
      <div className="crop-fit-list">
        {cropFit?.assessments.map((assessment) => {
          const ph = assessment.factors.find((factor) => factor.feature === 'pH');
          return <article className="crop-fit-card" key={assessment.crop}>
            <div><strong>{assessment.crop}</strong><span className={ph?.state === 'within_contextual_range' ? 'fit-state fit-state--okay' : 'fit-state fit-state--review'}>{ph?.state === 'within_contextual_range' ? 'Within pH context' : 'Review pH'}</span></div>
            <p>{ph?.reason}</p>
            {ph?.supportedRange && <small>pH range {ph.supportedRange.min}–{ph.supportedRange.max} · <a href={ph.source?.url} target="_blank" rel="noreferrer">source</a></small>}
          </article>;
        })}
      </div>
      {cropFit && <p className="crop-limit">{cropFit.dataLimitations[1]}</p>}
    </div>
  );
}
