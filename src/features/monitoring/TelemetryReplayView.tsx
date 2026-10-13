import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import {
  controlTelemetryPlayback,
  getTelemetryHistory,
  getTelemetryMetadata,
  getTelemetrySnapshot,
  getTelemetryState,
  telemetryWebSocketUrl,
  type PlaybackControl,
  type ReplayLine,
  type ReplayPlaybackState,
  type TelemetryHistory,
  type TelemetryMetadata,
  type TelemetrySnapshot,
} from '../../services/telemetryApi';
import { buildHumiditySegments } from './telemetryViewModel';

const DAY_MS = 24 * 60 * 60 * 1000;
const SPEEDS = [1, 10, 60, 360] as const;
const LINE_STYLES = [
  { color: '#3b7b55', dash: undefined },
  { color: '#bc7a2b', dash: '7 4' },
  { color: '#5377a0', dash: '2 4' },
];

const panel = 'rounded-xl border border-line-border bg-parchment-50 p-4 shadow-instrument';
const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-line-border bg-parchment-50 px-3 text-xs font-semibold text-ink transition hover:bg-parchment-100 disabled:cursor-not-allowed disabled:opacity-50';

function formatUtc(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : `${date.toLocaleString(undefined, { timeZone: 'UTC' })} UTC`;
}

function formatValue(value: number | null | undefined, digits = 1, unit = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}` : 'Not recorded';
}

function nextHistoryWindow(centerMs: number, startMs: number, endMs: number) {
  let start = Math.max(startMs, centerMs - DAY_MS / 2);
  let end = Math.min(endMs, start + DAY_MS);
  start = Math.max(startMs, end - DAY_MS);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

const Reading: React.FC<{ label: string; value: number | null | undefined; unit: string; digits?: number }> = ({ label, value, unit, digits = 1 }) => (
  <div className="rounded-lg border border-line-subtle bg-parchment-100/70 p-3">
    <dt className="text-[10px] font-semibold text-ink-subtle">{label}</dt>
    <dd className="mt-1 font-mono text-sm font-semibold text-ink">{formatValue(value, digits, unit)}</dd>
  </div>
);

export const TelemetryReplayView: React.FC = () => {
  const [metadata, setMetadata] = useState<TelemetryMetadata | null>(null);
  const [playback, setPlayback] = useState<ReplayPlaybackState | null>(null);
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [history, setHistory] = useState<Record<number, TelemetryHistory>>({});
  const [historyWindow, setHistoryWindow] = useState<{ start: string; end: string } | null>(null);
  const [initialHistoryAttempted, setInitialHistoryAttempted] = useState(false);
  const [historyLine, setHistoryLine] = useState<'all' | number>('all');
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'paused' | 'websocket' | 'polling'>('paused');
  const lastSeekRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextMetadata, nextPlayback, nextSnapshot] = await Promise.all([
        getTelemetryMetadata(),
        getTelemetryState(),
        getTelemetrySnapshot(),
      ]);
      setMetadata(nextMetadata);
      setPlayback(nextPlayback);
      setSnapshot(nextSnapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Historical telemetry service is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadHistory = useCallback(async (centerMs: number) => {
    if (!metadata || !playback) return;
    const range = nextHistoryWindow(centerMs, Date.parse(playback.startUtc), Date.parse(playback.endUtc));
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const values = await Promise.all(metadata.lines.map((line) =>
        getTelemetryHistory(line.lineId, range.start, range.end, 1000),
      ));
      setHistory(Object.fromEntries(values.map((result) => [result.lineId, result])));
      setHistoryWindow(range);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Could not load bounded history for this window.');
    } finally {
      setHistoryLoading(false);
    }
  }, [metadata, playback]);

  useEffect(() => {
    if (metadata && playback && !initialHistoryAttempted && !historyLoading) {
      setInitialHistoryAttempted(true);
      void loadHistory(Date.parse(playback.startUtc));
    }
  }, [metadata, playback, initialHistoryAttempted, historyLoading, loadHistory]);

  useEffect(() => {
    if (!playback?.isPlaying) {
      setTransport('paused');
      return;
    }

    let disposed = false;
    let polling = false;
    let pollTimer: number | undefined;
    let socket: WebSocket | undefined;

    const applySnapshot = (value: TelemetrySnapshot) => {
      if (disposed) return;
      setSnapshot(value);
      setPlayback((current) => current ? {
        ...current,
        timestamp: value.simulatedTimestampUtc,
        timestampMs: Date.parse(value.simulatedTimestampUtc),
        speed: value.playback.speed,
        isPlaying: value.playback.isPlaying,
        startUtc: value.playback.startUtc,
        endUtc: value.playback.endUtc,
      } : current);
    };

    const poll = async () => {
      try {
        const [state, value] = await Promise.all([getTelemetryState(), getTelemetrySnapshot()]);
        if (!disposed) {
          setPlayback(state);
          setSnapshot(value);
          setError(null);
          setTransport('polling');
        }
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : 'Replay connection lost.');
      }
    };

    const startPolling = () => {
      if (disposed || polling) return;
      polling = true;
      setTransport('polling');
      void poll();
      pollTimer = window.setInterval(() => { void poll(); }, 1000);
    };

    try {
      socket = new WebSocket(telemetryWebSocketUrl());
      socket.onopen = () => { if (!disposed) { setTransport('websocket'); setError(null); } };
      socket.onmessage = (event) => {
        try {
          const value = JSON.parse(String(event.data)) as TelemetrySnapshot;
          if (!value.simulatedTimestampUtc || !Array.isArray(value.lines)) throw new Error('Malformed replay snapshot.');
          applySnapshot(value);
        } catch {
          startPolling();
          socket?.close();
        }
      };
      socket.onerror = () => startPolling();
      socket.onclose = () => startPolling();
    } catch {
      startPolling();
    }

    return () => {
      disposed = true;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [playback?.isPlaying]);

  const runControl = async (control: PlaybackControl) => {
    setError(null);
    try {
      const next = await controlTelemetryPlayback(control);
      setPlayback(next);
      setPreviewMs(null);
      const value = await getTelemetrySnapshot();
      setSnapshot(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Playback control failed.');
    }
  };

  const commitSeek = () => {
    if (previewMs === null || lastSeekRef.current === previewMs) return;
    lastSeekRef.current = previewMs;
    void runControl({ action: 'seek', timestamp: new Date(previewMs).toISOString() });
  };

  const startOrRestart = async () => {
    if (playback && playback.timestampMs >= Date.parse(playback.endUtc)) {
      await runControl({ action: 'seek', timestamp: playback.startUtc });
      await runControl({ action: 'play' });
      return;
    }
    await runControl({ action: 'play' });
  };

  const selectedLines = useMemo(() => {
    const lines = snapshot?.lines ?? [];
    return historyLine === 'all' ? lines : lines.filter((line) => line.lineId === historyLine);
  }, [historyLine, snapshot]);

  const historyEntries = useMemo(() => {
    const ids = historyLine === 'all' ? Object.keys(history).map(Number) : [historyLine];
    return ids.flatMap((lineId) => {
      const record = history[lineId];
      return record ? [{ lineId, record, segments: buildHumiditySegments(record.samples) }] : [];
    });
  }, [history, historyLine]);

  const historyValues = historyEntries.flatMap((entry) => entry.segments.flatMap((segment) => segment.map((point) => point.value)));
  const yMin = historyValues.length ? Math.min(...historyValues) - 2 : 0;
  const yMax = historyValues.length ? Math.max(...historyValues) + 2 : 100;
  const ySpan = yMax - yMin || 1;
  const xMin = historyWindow ? Date.parse(historyWindow.start) : 0;
  const xMax = historyWindow ? Date.parse(historyWindow.end) : xMin + 1;
  const xSpan = xMax - xMin || 1;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3 border-b border-line-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-sage-700" />
            <h2 className="font-serif text-lg font-bold text-ink">Historical Telemetry Replay</h2>
            <span className="rounded-full border border-amberGold/30 bg-amberGold-subtle px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-amberGold-dark">Not live</span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">
            Replay the attributed Parma tomato research trial. These lines are experimental treatments—not KshetraSense field zones—and do not connect to hardware or change zoning.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className={button} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Retry service
        </button>
      </section>

      {metadata && (
        <section className="rounded-xl border border-amberGold/30 bg-amberGold-subtle p-4 text-xs leading-5 text-amberGold-dark">
          <div className="flex items-start gap-2">
            <Database size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">{metadata.replayLabel}</p>
              <p>{metadata.dataset.title} · Collected {metadata.dataset.collectedPeriodLocal} · source version {metadata.dataset.version}</p>
              <p className="flex flex-wrap items-center gap-x-1">
                {metadata.dataset.authors.join(', ')} · {metadata.dataset.license} · <a className="font-semibold underline" href={metadata.dataset.sourceUrl} target="_blank" rel="noreferrer">Mendeley Data {metadata.dataset.doi} <ExternalLink size={11} className="inline" /></a>
              </p>
              <p className="mt-1">Source-file SHA-256 verification: {metadata.dataQuality.sha256Verified ? 'passed' : 'not verified'} · {metadata.timeline.samples.toLocaleString()} ten-minute timeline steps. Raw observation times and missing values remain distinct from model-grid inputs.</p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-clay/30 bg-clay-subtle p-3 text-xs text-clay-dark">
          <div className="flex items-start gap-2"><ShieldAlert size={15} className="mt-0.5 shrink-0" /><span>{error}</span></div>
        </div>
      )}

      {loading && <div className={`${panel} text-sm text-ink-muted`}>Loading pinned replay metadata and current historical position…</div>}

      {!loading && !metadata && !error && <div className={`${panel} text-sm text-ink-muted`}>Historical replay metadata is unavailable.</div>}

      {metadata && playback && snapshot && (
        <>
          <section className={`${panel} space-y-3`} aria-label="Historical replay controls">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">Simulated timestamp · UTC</p>
                <p className="font-mono text-sm font-semibold text-ink">{formatUtc(playback.timestamp)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void (playback.isPlaying ? runControl({ action: 'pause' }) : startOrRestart())} className="button button--primary">
                  {playback.isPlaying ? <Pause size={14} /> : playback.timestampMs >= Date.parse(playback.endUtc) ? <RotateCcw size={14} /> : <Play size={14} />}
                  {playback.isPlaying ? 'Pause' : playback.timestampMs >= Date.parse(playback.endUtc) ? 'Restart' : 'Play'}
                </button>
                <div className="flex items-center gap-1 rounded-md border border-line-border bg-parchment-100 p-1" aria-label="Playback speed">
                  {SPEEDS.map((speed) => (
                    <button key={speed} type="button" aria-pressed={playback.speed === speed} onClick={() => void runControl({ action: 'set_speed', speed })}
                      className={`rounded px-2 py-1 text-[10px] font-mono font-semibold ${playback.speed === speed ? 'bg-sage-700 text-white' : 'text-ink-muted hover:bg-parchment-200'}`}>
                      {speed}×
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-ink-subtle">{transport === 'websocket' ? 'Replay stream connected' : transport === 'polling' ? 'Replay stream polling' : 'Paused'}</span>
              </div>
            </div>
            <input
              type="range"
              min={Date.parse(playback.startUtc)}
              max={Date.parse(playback.endUtc)}
              step={metadata.timeline.stepMinutes * 60 * 1000}
              value={previewMs ?? playback.timestampMs}
              aria-label="Seek through historical replay"
              className="w-full accent-sage-700"
              onChange={(event) => { setPreviewMs(Number(event.target.value)); lastSeekRef.current = null; }}
              onPointerUp={commitSeek}
              onKeyUp={commitSeek}
              onBlur={commitSeek}
            />
            <div className="flex justify-between gap-3 text-[10px] text-ink-subtle"><span>{formatUtc(playback.startUtc)}</span><span>{formatUtc(playback.endUtc)}</span></div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
            <section className={`${panel} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle pb-2">
                <div><h3 className="font-serif text-base font-bold text-ink">Soil and shared-station readings</h3><p className="text-[11px] text-ink-muted">Raw values at source observation timestamps; unavailable readings stay blank.</p></div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-ink-muted">Trial line
                  <select value={historyLine} onChange={(event) => setHistoryLine(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="rounded border border-line-border bg-white px-2 py-1 text-xs text-ink">
                    <option value="all">All three treatments</option>
                    {metadata.lines.map((line) => <option key={line.lineId} value={line.lineId}>Line {line.lineId}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-3">
                {selectedLines.map((line) => <LineReadings key={line.lineId} line={line} />)}
              </div>
            </section>

            <section className={`${panel} space-y-3`}>
              <h3 className="font-serif text-base font-bold text-ink">Replay data quality</h3>
              <p className="text-[11px] leading-5 text-ink-muted">Nominal model grid: {metadata.timeline.stepMinutes} minutes · environment observations: {metadata.dataQuality.environmentRows.toLocaleString()} · excluded/repeated rows: soil {metadata.dataQuality.soilExcludedRows}, environment {metadata.dataQuality.environmentExcludedRows}, meter {metadata.dataQuality.meterExcludedRows}.</p>
              {metadata.lines.filter((line) => historyLine === 'all' || line.lineId === historyLine).map((line) => {
                const stats = metadata.dataQuality.lineStats[String(line.lineId)];
                return <div key={line.lineId} className="rounded-lg border border-line-subtle bg-parchment-100/70 p-3 text-[11px]">
                  <p className="font-semibold text-ink">Line {line.lineId} · {line.treatment}</p>
                  <p className="mt-1 text-ink-muted">{stats.soilRows.toLocaleString()} soil rows · median interval {stats.soilMedianIntervalMinutes.toFixed(1)} min · {stats.modelFeatureInterpolatedValues.toLocaleString()} model-grid feature values aligned/interpolated.</p>
                </div>;
              })}
              <p className="text-[10px] leading-4 text-ink-subtle">{metadata.dataQuality.interpolation}</p>
            </section>
          </div>

          <section className={`${panel} space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-2">
              <div><h3 className="font-serif text-base font-bold text-ink">Measured soil humidity signal</h3><p className="text-[11px] text-ink-muted">%RH sensor output, not volumetric water content (VWC). Gaps over 30 minutes are not joined.</p></div>
              <button type="button" disabled={historyLoading} onClick={() => void loadHistory(playback.timestampMs)} className={button}>
                <RefreshCw size={12} className={historyLoading ? 'spin' : ''} /> Load 24h around playhead
              </button>
            </div>
            {historyWindow && <p className="text-[10px] text-ink-subtle">Source observations from {formatUtc(historyWindow.start)} to {formatUtc(historyWindow.end)} · history is bounded and may be downsampled if truncated.</p>}
            {historyError && <p role="alert" className="rounded border border-clay/30 bg-clay-subtle p-2 text-xs text-clay-dark">{historyError}</p>}
            {historyLoading && <p className="text-xs text-ink-muted">Loading raw observations…</p>}
            {!historyLoading && historyValues.length === 0 && <p className="rounded border border-dashed border-line-border p-5 text-center text-xs text-ink-subtle">No recorded soil humidity points in this history window.</p>}
            {!historyLoading && historyValues.length > 0 && historyWindow && (
              <div className="overflow-x-auto">
                <svg className="h-64 min-w-[640px] w-full" viewBox="0 0 720 230" role="img" aria-label="Measured soil humidity sensor signal chart; gaps greater than 30 minutes are disconnected">
                  {[0, 1, 2, 3].map((i) => {
                    const y = 22 + i * 54;
                    const value = yMax - (i / 3) * ySpan;
                    return <g key={i}><line x1="54" y1={y} x2="700" y2={y} stroke="#dce5dc" strokeDasharray="3 4" /><text x="48" y={y + 3} textAnchor="end" fontSize="9" fill="#758579">{value.toFixed(1)}</text></g>;
                  })}
                  {historyEntries.map((entry) => {
                    const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0];
                    return <g key={entry.lineId}>
                      {entry.segments.map((segment, segmentIndex) => {
                        const path = segment.map((point, pointIndex) => {
                          const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                          const y = 22 + ((yMax - point.value) / ySpan) * 162;
                          return `${pointIndex === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                        return <g key={segmentIndex}>
                          {segment.length > 1 && <path d={path} fill="none" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash} />}
                          {segment.map((point, pointIndex) => {
                            const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                            const y = 22 + ((yMax - point.value) / ySpan) * 162;
                            return <circle key={pointIndex} cx={x} cy={y} r="2.4" fill={style.color}><title>{`Line ${entry.lineId}: ${point.value.toFixed(2)} %RH at ${new Date(point.timestampMs).toISOString()}`}</title></circle>;
                          })}
                        </g>;
                      })}
                    </g>;
                  })}
                  <text x="58" y="210" fontSize="9" fill="#758579">{new Date(xMin).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC</text>
                  <text x="694" y="210" textAnchor="end" fontSize="9" fill="#758579">{new Date(xMax).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC</text>
                </svg>
                <div className="flex flex-wrap gap-3 text-[10px] text-ink-muted">
                  {historyEntries.map((entry) => { const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0]; return <span key={entry.lineId} className="inline-flex items-center gap-1.5"><i className="h-2 w-5" style={{ background: style.color, borderTop: style.dash ? `2px ${style.dash === '7 4' ? 'dashed' : 'dotted'} ${style.color}` : undefined }} />Line {entry.lineId}: {entry.record.historicalTreatment}</span>; })}
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className={`${panel} space-y-3`}>
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-serif text-base font-bold text-ink">GRU signal forecast</h3><p className="text-[11px] text-ink-muted">Exploratory model output only · %RH signal, not VWC.</p></div><span className="rounded-full border border-clay/30 bg-clay-subtle px-2 py-0.5 text-[9px] font-bold uppercase text-clay-dark">Not for irrigation</span></div>
              {selectedLines.map((line) => <ForecastSummary key={line.lineId} line={line} metadata={metadata} />)}
              <p className="rounded-lg border border-amberGold/30 bg-amberGold-subtle p-3 text-[11px] leading-5 text-amberGold-dark">The held-out GRU did not beat persistence at any evaluated horizon. Point outputs have no calibrated uncertainty and must not be used as field or irrigation forecasts.</p>
            </section>

            <section className={`${panel} space-y-3`}>
              <div><h3 className="font-serif text-base font-bold text-ink">Isolation Forest review screen</h3><p className="text-[11px] text-ink-muted">Unsupervised review candidates—not diagnosed sensor faults or probabilities.</p></div>
              <div className="space-y-2">{selectedLines.map((line) => <AnomalySummary key={line.lineId} line={line} />)}</div>
            </section>
          </div>

          <section className="rounded-lg border border-line-border bg-parchment-100/70 p-3 text-[11px] leading-5 text-ink-muted">
            <div className="flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amberGold-dark" /><div>
              <p className="font-semibold text-ink">Interpretation boundaries</p>
              <p>Trial treatments are not field zones. Air readings come from one shared station. Battery values remain percentages when present. The source-reported current-volume meter unit is shown without conversion; its scale is unvalidated, so no flow or irrigation event is inferred.</p>
              <p>No live gateway, actuation, pump state, irrigation advice, yield estimate, or automatic connection to Soil Zoning is provided by this replay screen.</p>
            </div></div>
          </section>
        </>
      )}
    </div>
  );
};

const LineReadings: React.FC<{ line: ReplayLine }> = ({ line }) => {
  const soil = line.soilObservation;
  const air = line.sharedEnvironmentalObservation;
  return (
    <div className="rounded-lg border border-line-border p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="text-xs font-bold text-ink">Trial line {line.lineId}</h4><p className="text-[10px] text-ink-muted">{line.historicalTreatment}</p></div>
        <span className="text-right text-[9px] text-ink-subtle">Soil observation: {soil.observedAtUtc ? formatUtc(soil.observedAtUtc) : 'not recorded'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Reading label="Soil humidity signal" value={soil.humiditySignalPctRh} unit="%RH · not VWC" />
        <Reading label="Soil temperature · 20 cm" value={soil.temperatureC} unit="°C" />
        <Reading label="Soil electrical conductivity" value={soil.electricalConductivityUsCm} unit="µS/cm" />
      </dl>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-subtle">
        <span>Sensor battery: {formatValue(soil.batteryPercent, 1, '%')}</span>
        <span>Shared air station: {air.observedAtUtc ? formatUtc(air.observedAtUtc) : 'not recorded'}</span>
        <span>Air temp {formatValue(air.temperatureC, 1, '°C')}</span>
        <span>Air RH {formatValue(air.relativeHumidityPctRh, 1, '%RH')}</span>
      </div>
      <p className="mt-2 text-[10px] text-ink-subtle">
        Raw meter {line.waterMeter.field}: {formatValue(line.waterMeter.sourceReportedValue, 3, line.waterMeter.sourceUnit)} · {line.waterMeter.interpretation}
      </p>
    </div>
  );
};

const ForecastSummary: React.FC<{ line: ReplayLine; metadata: TelemetryMetadata }> = ({ line, metadata }) => {
  const forecast = line.forecast;
  return (
    <div className="rounded-lg border border-line-subtle bg-parchment-100/70 p-3">
      <h4 className="text-xs font-semibold text-ink">Line {line.lineId} · {line.historicalTreatment}</h4>
      {forecast?.status === 'exploratory_only' ? <>
        <p className="mt-1 text-[10px] text-ink-subtle">{forecast.modelVersion} · input window {forecast.inputWindowSteps ?? metadata.forecastModel.windowSteps} steps · {forecast.interpolatedInputValues ?? 0} aligned/interpolated model inputs.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">{(forecast.pointForecasts ?? []).map((point) => <div key={point.horizonHours} className="rounded border border-line-border bg-white p-2 text-center"><span className="block font-mono text-xs font-bold text-ink">{point.value.toFixed(2)}</span><span className="text-[9px] text-ink-subtle">+{point.horizonHours}h %RH</span></div>)}</div>
        {forecast.inputResamplingNote && <p className="mt-2 text-[10px] text-ink-subtle">{forecast.inputResamplingNote}</p>}
      </> : <p className="mt-1 text-[10px] text-ink-subtle">{forecast?.reason ?? 'A complete model input window is not available at this timestamp.'}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[10px]"><thead className="text-ink-subtle"><tr><th className="pb-1 pr-2">Holdout horizon</th><th className="pb-1 pr-2">GRU MAE (%RH)</th><th className="pb-1 pr-2">Persistence MAE</th><th className="pb-1">Result</th></tr></thead>
          <tbody>{metadata.forecastModel.horizonsHours.map((hours) => { const metric = metadata.forecastModel.holdoutMetrics[`${hours}h`]; return metric ? <tr key={hours} className="border-t border-line-subtle"><td className="py-1 pr-2">+{hours}h</td><td className="py-1 pr-2 font-mono">{metric.gru.maePctRh.toFixed(3)}</td><td className="py-1 pr-2 font-mono">{metric.persistenceBaseline.maePctRh.toFixed(3)}</td><td className="py-1">{metric.beatsPersistenceByMae ? 'beats' : 'does not beat'}</td></tr> : null; })}</tbody>
        </table>
      </div>
    </div>
  );
};

const AnomalySummary: React.FC<{ line: ReplayLine }> = ({ line }) => {
  const anomaly = line.anomalyReview;
  const text = anomaly?.status === 'review_candidate' ? 'Review candidate' : anomaly?.status === 'no_candidate' ? 'No candidate flagged' : 'Unavailable';
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-subtle bg-parchment-100/70 p-3 text-xs">
    <div><p className="font-semibold text-ink">Line {line.lineId} · {line.historicalTreatment}</p><p className="text-[10px] text-ink-subtle">{anomaly?.scoreMeaning ?? anomaly?.reason ?? 'No unsupervised score available at this point.'}</p></div>
    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${anomaly?.status === 'review_candidate' ? 'border-amberGold/30 bg-amberGold-subtle text-amberGold-dark' : 'border-line-border bg-white text-ink-muted'}`}>{text}{typeof anomaly?.score === 'number' ? ` · score ${anomaly.score.toFixed(3)}` : ''}</span>
  </div>;
};
