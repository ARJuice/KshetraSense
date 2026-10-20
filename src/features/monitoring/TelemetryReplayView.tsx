import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Crosshair,
  Database,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
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
import { buildHumiditySegments, calculateHistoryWindow, DAY_MS } from './telemetryViewModel';
const SPEEDS = [1, 10, 60, 360] as const;
const LINE_STYLES = [
  { color: '#059669', dash: undefined },
  { color: '#d97706', dash: '7 4' },
  { color: '#2563eb', dash: '2 4' },
];

const panel = 'rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm';
const button = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

function formatUtc(value: string | number): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : `${date.toLocaleString(undefined, { timeZone: 'UTC' })} UTC`;
}

function formatTimeOnly(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatValue(value: number | null | undefined, digits = 1, unit = ''): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}${unit ? ` ${unit}` : ''}` : 'Not recorded';
}

function nextHistoryWindow(centerMs: number, startMs: number, endMs: number) {
  return calculateHistoryWindow(centerMs, startMs, endMs, DAY_MS);
}

const Reading: React.FC<{ label: string; value: number | null | undefined; unit: string; digits?: number }> = ({ label, value, unit, digits = 1 }) => (
  <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
    <dt className="text-[10px] font-semibold text-slate-400">{label}</dt>
    <dd className="mt-1 font-mono text-sm font-bold text-slate-900">{formatValue(value, digits, unit)}</dd>
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
  const [autoFollow, setAutoFollow] = useState(true);
  const [liveScanMode, setLiveScanMode] = useState(true);
  const [hoveredMs, setHoveredMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [transport, setTransport] = useState<'paused' | 'websocket' | 'polling'>('paused');
  const lastSeekRef = useRef<number | null>(null);
  const lastAutoLoadCenterRef = useRef<number | null>(null);

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

  const loadHistory = useCallback(async (centerMs: number, background = false) => {
    if (!metadata || !playback) return;
    const range = nextHistoryWindow(centerMs, Date.parse(playback.startUtc), Date.parse(playback.endUtc));
    if (!background) setHistoryLoading(true);
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
      if (!background) setHistoryLoading(false);
    }
  }, [metadata, playback]);

  useEffect(() => {
    if (metadata && playback && !initialHistoryAttempted && !historyLoading) {
      setInitialHistoryAttempted(true);
      void loadHistory(Date.parse(playback.startUtc));
    }
  }, [metadata, playback, initialHistoryAttempted, historyLoading, loadHistory]);

  useEffect(() => {
    if (!autoFollow || !playback?.isPlaying || historyLoading || !historyWindow) return;
    const current = playback.timestampMs;
    const wStart = Date.parse(historyWindow.start);
    const wEnd = Date.parse(historyWindow.end);
    const bufferMs = 15 * 60 * 1000;

    const shouldShift = current >= wEnd - bufferMs || current < wStart;
    if (shouldShift) {
      if (lastAutoLoadCenterRef.current === null || Math.abs(current - lastAutoLoadCenterRef.current) > 30 * 60 * 1000) {
        lastAutoLoadCenterRef.current = current;
        void loadHistory(current, true);
      }
    }
  }, [autoFollow, playback?.isPlaying, playback?.timestampMs, historyWindow, historyLoading, loadHistory]);

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
      setPreviewMs(null);
    }
  };

  const commitSeek = () => {
    if (previewMs === null || lastSeekRef.current === previewMs || !playback) return;
    const minMs = Date.parse(playback.startUtc);
    const maxMs = Date.parse(playback.endUtc);
    const clamped = Math.max(minMs, Math.min(maxMs, previewMs));
    lastSeekRef.current = clamped;
    void runControl({ action: 'seek', timestamp: new Date(clamped).toISOString() });
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
  const activeValues = (snapshot?.lines ?? []).flatMap((line) => {
    const val = line.soilObservation?.humiditySignalPctRh;
    return typeof val === 'number' && Number.isFinite(val) ? [val] : [];
  });
  const allValues = [...historyValues, ...activeValues];
  const yMin = allValues.length ? Math.min(...allValues) - 2 : 0;
  const yMax = allValues.length ? Math.max(...allValues) + 2 : 100;
  const ySpan = yMax - yMin || 1;
  const xMin = historyWindow ? Date.parse(historyWindow.start) : 0;
  const xMax = historyWindow ? Date.parse(historyWindow.end) : xMin + 1;
  const xSpan = xMax - xMin || 1;
  const currentSimulatedMs = previewMs ?? playback?.timestampMs ?? xMin;
  const isPlayheadInWindow = historyWindow
    ? currentSimulatedMs >= xMin && currentSimulatedMs <= xMax
    : false;
  const playheadRatio = Math.max(0, Math.min(1, (currentSimulatedMs - xMin) / xSpan));
  const playheadX = 58 + playheadRatio * 636;

  const getSvgChartX = (svg: SVGSVGElement, clientX: number): number => {
    try {
      const ctm = svg.getScreenCTM();
      if (ctm) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = 0;
        return pt.matrixTransform(ctm.inverse()).x;
      }
    } catch {
      // Fallback
    }
    const rect = svg.getBoundingClientRect();
    return rect.width > 0 ? ((clientX - rect.left) / rect.width) * 720 : 0;
  };

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!historyWindow || !playback) return;
    const chartX = getSvgChartX(event.currentTarget, event.clientX);
    if (chartX >= 58 && chartX <= 694) {
      const fraction = Math.max(0, Math.min(1, (chartX - 58) / 636));
      const seekMs = Math.round(xMin + fraction * xSpan);
      const minMs = Date.parse(playback.startUtc);
      const maxMs = Date.parse(playback.endUtc);
      const clampedSeekMs = Math.max(minMs, Math.min(maxMs, seekMs));
      lastSeekRef.current = clampedSeekMs;
      setPreviewMs(null);
      void runControl({ action: 'seek', timestamp: new Date(clampedSeekMs).toISOString() });
    }
  };

  const handleSvgMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!historyWindow || !playback) return;
    const chartX = getSvgChartX(event.currentTarget, event.clientX);
    if (chartX >= 58 && chartX <= 694) {
      const fraction = Math.max(0, Math.min(1, (chartX - 58) / 636));
      const hoverMs = Math.round(xMin + fraction * xSpan);
      const minMs = Date.parse(playback.startUtc);
      const maxMs = Date.parse(playback.endUtc);
      setHoveredMs(Math.max(minMs, Math.min(maxMs, hoverMs)));
    } else {
      setHoveredMs(null);
    }
  };

  const handleSvgMouseLeave = () => {
    setHoveredMs(null);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold tracking-tight text-slate-900">Historical Telemetry Replay</h2>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-amber-800">
              Controlled Benchmark Dataset
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            Replay the attributed Parma tomato research trial. These lines are experimental treatments—not KshetraSense field zones—and do not connect to hardware or change zoning.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className={button} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Retry service
        </button>
      </section>

      {metadata && (
        <section className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-5 text-xs leading-relaxed text-slate-600">
          <div className="flex items-start gap-3">
            <Database size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-bold text-slate-900">{metadata.replayLabel}</p>
              <p className="mt-0.5">{metadata.dataset.title} · Collected {metadata.dataset.collectedPeriodLocal} · source version {metadata.dataset.version}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1">
                {metadata.dataset.authors.join(', ')} · {metadata.dataset.license} · <a className="font-semibold text-emerald-600 underline hover:text-emerald-700" href={metadata.dataset.sourceUrl} target="_blank" rel="noreferrer">Mendeley Data {metadata.dataset.doi} <ExternalLink size={11} className="inline" /></a>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Source-file SHA-256 verification: {metadata.dataQuality.sha256Verified ? 'passed' : 'not verified'} · {metadata.timeline.samples.toLocaleString()} ten-minute timeline steps. Raw observation times and missing values remain distinct from model-grid inputs.</p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-900">
          <div className="flex items-start gap-2.5"><ShieldAlert size={16} className="mt-0.5 shrink-0 text-rose-600" /><span>{error}</span></div>
        </div>
      )}

      {loading && <div className={`${panel} text-sm text-slate-500`}>Loading pinned replay metadata and current historical position…</div>}

      {!loading && !metadata && !error && <div className={`${panel} text-sm text-slate-500`}>Historical replay metadata is unavailable.</div>}

      {metadata && playback && snapshot && (
        <>
          <section className={`${panel} space-y-4`} aria-label="Historical replay controls">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Simulated timestamp · UTC</p>
                <p className="font-mono text-sm font-bold text-slate-900">{formatUtc(playback.timestamp)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void (playback.isPlaying ? runControl({ action: 'pause' }) : startOrRestart())}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800"
                >
                  {playback.isPlaying ? <Pause size={14} /> : playback.timestampMs >= Date.parse(playback.endUtc) ? <RotateCcw size={14} /> : <Play size={14} />}
                  {playback.isPlaying ? 'Pause' : playback.timestampMs >= Date.parse(playback.endUtc) ? 'Restart' : 'Play'}
                </button>
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1" aria-label="Playback speed">
                  {SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={playback.speed === speed}
                      onClick={() => void runControl({ action: 'set_speed', speed })}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-semibold transition ${
                        playback.speed === speed
                          ? 'border border-slate-200/80 bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
                      }`}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                  {transport === 'websocket' ? 'WebSocket stream active' : transport === 'polling' ? 'Polling stream' : 'Paused'}
                </span>
              </div>
            </div>
            <input
              type="range"
              min={Date.parse(playback.startUtc)}
              max={Date.parse(playback.endUtc)}
              step={metadata.timeline.stepMinutes * 60 * 1000}
              value={previewMs ?? playback.timestampMs}
              aria-label="Seek through historical replay"
              className="w-full accent-emerald-600 cursor-pointer"
              onChange={(event) => { setPreviewMs(Number(event.target.value)); lastSeekRef.current = null; }}
              onPointerUp={commitSeek}
              onKeyUp={commitSeek}
              onBlur={commitSeek}
            />
            <div className="flex justify-between gap-3 font-mono text-[10px] text-slate-400"><span>{formatUtc(playback.startUtc)}</span><span>{formatUtc(playback.endUtc)}</span></div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(310px,0.7fr)]">
            <section className={`${panel} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-900">Soil and Shared-Station Readings</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">Raw values at source observation timestamps; unavailable readings stay blank.</p>
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span>Trial line</span>
                  <select
                    value={historyLine}
                    onChange={(event) => setHistoryLine(event.target.value === 'all' ? 'all' : Number(event.target.value))}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="all">All three treatments</option>
                    {metadata.lines.map((line) => <option key={line.lineId} value={line.lineId}>Line {line.lineId}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-3.5">
                {selectedLines.map((line) => <LineReadings key={line.lineId} line={line} />)}
              </div>
            </section>

            <section className={`${panel} space-y-4`}>
              <div>
                <h3 className="text-base font-bold tracking-tight text-slate-900">Replay Data Quality</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Nominal model grid: {metadata.timeline.stepMinutes} minutes · environment observations: {metadata.dataQuality.environmentRows.toLocaleString()} · excluded/repeated rows: soil {metadata.dataQuality.soilExcludedRows}, environment {metadata.dataQuality.environmentExcludedRows}, meter {metadata.dataQuality.meterExcludedRows}.
                </p>
              </div>
              <div className="space-y-2.5">
                {metadata.lines.filter((line) => historyLine === 'all' || line.lineId === historyLine).map((line) => {
                  const stats = metadata.dataQuality.lineStats[String(line.lineId)];
                  return (
                    <div key={line.lineId} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-[11px]">
                      <p className="font-bold text-slate-900">Line {line.lineId} · {line.treatment}</p>
                      <p className="mt-1 leading-relaxed text-slate-600">{stats.soilRows.toLocaleString()} soil rows · median interval {stats.soilMedianIntervalMinutes.toFixed(1)} min · {stats.modelFeatureInterpolatedValues.toLocaleString()} model-grid feature values aligned/interpolated.</p>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">{metadata.dataQuality.interpolation}</p>
            </section>
          </div>

          <section className={`${panel} space-y-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold tracking-tight text-slate-900">Measured Soil Humidity Signal</h3>
                  {playback.isPlaying ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                      </span>
                      Live Dynamic Trace ({playback.speed}×)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Paused
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  %RH sensor output, not volumetric water content (VWC). Gaps over 30 minutes are not joined. Click chart to seek time.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLiveScanMode((v) => !v)}
                  className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold shadow-2xs transition ${
                    liveScanMode
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Toggle dynamic illuminated trace along the simulation timeline"
                >
                  <Sparkles size={12} className={liveScanMode ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>Dynamic Trace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoFollow((v) => !v)}
                  className={`inline-flex min-h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold shadow-2xs transition ${
                    autoFollow
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Automatically center 24h window as the simulation plays"
                >
                  <Crosshair size={12} className={autoFollow ? 'text-emerald-600' : 'text-slate-400'} />
                  <span>Auto-Follow</span>
                </button>
                <button
                  type="button"
                  disabled={historyLoading}
                  onClick={() => {
                    lastAutoLoadCenterRef.current = playback.timestampMs;
                    void loadHistory(playback.timestampMs);
                  }}
                  className={button}
                  title="Load 24h history window centered at current playhead"
                >
                  <RefreshCw size={12} className={historyLoading ? 'spin' : ''} />
                  <span>Center 24h</span>
                </button>
              </div>
            </div>

            {historyWindow && !isPlayheadInWindow && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Current simulated playhead (<strong>{formatUtc(currentSimulatedMs)}</strong>) is outside this 24-hour window.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    lastAutoLoadCenterRef.current = currentSimulatedMs;
                    void loadHistory(currentSimulatedMs);
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-amber-700 transition"
                >
                  <Crosshair size={12} />
                  Jump window to playhead
                </button>
              </div>
            )}

            {historyWindow && (
              <p className="text-[10px] text-slate-400">
                Source observations from {formatUtc(historyWindow.start)} to {formatUtc(historyWindow.end)} · history is bounded and may be downsampled if truncated.
              </p>
            )}
            {historyError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">{historyError}</p>}
            {historyLoading && <p className="text-xs text-slate-500">Loading raw observations…</p>}
            {!historyLoading && historyValues.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                No recorded soil humidity points in this history window.
              </p>
            )}
            {!historyLoading && historyValues.length > 0 && historyWindow && (
              <div className="overflow-x-auto">
                <svg
                  className="h-64 min-w-[640px] w-full cursor-crosshair select-none"
                  viewBox="0 0 720 230"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Measured soil humidity sensor signal chart; gaps greater than 30 minutes are disconnected. Click to seek."
                  onClick={handleSvgClick}
                  onMouseMove={handleSvgMouseMove}
                  onMouseLeave={handleSvgMouseLeave}
                >
                  <defs>
                    <linearGradient id="scanner-beam-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
                      <stop offset="65%" stopColor="#059669" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="playhead-line-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="45%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                    <clipPath id="trail-clip-past">
                      <rect x="0" y="0" width={playheadX} height="230" />
                    </clipPath>
                    <clipPath id="trail-clip-future">
                      <rect x={playheadX} y="0" width={Math.max(0, 720 - playheadX)} height="230" />
                    </clipPath>
                  </defs>

                  {[0, 1, 2, 3].map((i) => {
                    const y = 22 + i * 54;
                    const value = yMax - (i / 3) * ySpan;
                    return (
                      <g key={i}>
                        <line x1="54" y1={y} x2="700" y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
                        <text x="48" y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" className="font-mono">
                          {value.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Curves: Dynamic Trace (Past vs Future) or Standard Single Pass */}
                  {liveScanMode && isPlayheadInWindow ? (
                    <>
                      {/* Past / Reached trace - illuminated with full saturation */}
                      <g clipPath="url(#trail-clip-past)">
                        {historyEntries.map((entry) => {
                          const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0];
                          return (
                            <g key={`past-${entry.lineId}`}>
                              {entry.segments.map((segment, segmentIndex) => {
                                const path = segment
                                  .map((point, pointIndex) => {
                                    const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                    const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                    return `${pointIndex === 0 ? 'M' : 'L'} ${x} ${y}`;
                                  })
                                  .join(' ');
                                return (
                                  <g key={`past-seg-${segmentIndex}`}>
                                    {segment.length > 1 && (
                                      <path
                                        d={path}
                                        fill="none"
                                        stroke={style.color}
                                        strokeWidth="2.4"
                                        strokeDasharray={style.dash}
                                      />
                                    )}
                                    {segment.map((point, pointIndex) => {
                                      const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                      const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                      return (
                                        <circle
                                          key={`past-pt-${pointIndex}`}
                                          cx={x}
                                          cy={y}
                                          r="2.8"
                                          fill={style.color}
                                        >
                                          <title>{`Line ${entry.lineId}: ${point.value.toFixed(2)} %RH at ${new Date(point.timestampMs).toISOString()}`}</title>
                                        </circle>
                                      );
                                    })}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                      </g>

                      {/* Future / Unreached trace - muted preview */}
                      <g clipPath="url(#trail-clip-future)" opacity="0.32">
                        {historyEntries.map((entry) => {
                          const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0];
                          return (
                            <g key={`future-${entry.lineId}`}>
                              {entry.segments.map((segment, segmentIndex) => {
                                const path = segment
                                  .map((point, pointIndex) => {
                                    const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                    const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                    return `${pointIndex === 0 ? 'M' : 'L'} ${x} ${y}`;
                                  })
                                  .join(' ');
                                return (
                                  <g key={`future-seg-${segmentIndex}`}>
                                    {segment.length > 1 && (
                                      <path
                                        d={path}
                                        fill="none"
                                        stroke={style.color}
                                        strokeWidth="1.5"
                                        strokeDasharray="4 4"
                                      />
                                    )}
                                    {segment.map((point, pointIndex) => {
                                      const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                      const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                      return (
                                        <circle
                                          key={`future-pt-${pointIndex}`}
                                          cx={x}
                                          cy={y}
                                          r="1.8"
                                          fill={style.color}
                                        >
                                          <title>{`Line ${entry.lineId}: ${point.value.toFixed(2)} %RH at ${new Date(point.timestampMs).toISOString()}`}</title>
                                        </circle>
                                      );
                                    })}
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}
                      </g>
                    </>
                  ) : (
                    historyEntries.map((entry) => {
                      const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0];
                      return (
                        <g key={entry.lineId}>
                          {entry.segments.map((segment, segmentIndex) => {
                            const path = segment
                              .map((point, pointIndex) => {
                                const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                return `${pointIndex === 0 ? 'M' : 'L'} ${x} ${y}`;
                              })
                              .join(' ');
                            return (
                              <g key={segmentIndex}>
                                {segment.length > 1 && (
                                  <path
                                    d={path}
                                    fill="none"
                                    stroke={style.color}
                                    strokeWidth="2"
                                    strokeDasharray={style.dash}
                                  />
                                )}
                                {segment.map((point, pointIndex) => {
                                  const x = 58 + ((point.timestampMs - xMin) / xSpan) * 636;
                                  const y = 22 + ((yMax - point.value) / ySpan) * 162;
                                  return (
                                    <circle key={pointIndex} cx={x} cy={y} r="2.8" fill={style.color}>
                                      <title>{`Line ${entry.lineId}: ${point.value.toFixed(2)} %RH at ${new Date(point.timestampMs).toISOString()}`}</title>
                                    </circle>
                                  );
                                })}
                              </g>
                            );
                          })}
                        </g>
                      );
                    })
                  )}

                  {/* Playhead vertical line, top badge, and active curve beacons */}
                  {isPlayheadInWindow && (
                    <g>
                      {/* Subtle scanner beam glow */}
                      <rect
                        x={Math.max(58, playheadX - 16)}
                        y="22"
                        width={Math.min(16, playheadX - 58)}
                        height="162"
                        fill="url(#scanner-beam-grad)"
                        opacity="0.8"
                      />

                      {/* Vertical Playhead Cursor Line */}
                      <line
                        x1={playheadX}
                        y1="18"
                        x2={playheadX}
                        y2="186"
                        stroke="url(#playhead-line-grad)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />

                      {/* Top Playhead Timestamp Badge */}
                      {(() => {
                        const badgeX = Math.max(92, Math.min(660, playheadX));
                        return (
                          <g transform={`translate(${badgeX}, 11)`}>
                            <rect
                              x="-42"
                              y="-9"
                              width="84"
                              height="18"
                              rx="4"
                              fill="#0f172a"
                              stroke="#10b981"
                              strokeWidth="1"
                            />
                            <text
                              x="0"
                              y="3.5"
                              textAnchor="middle"
                              fontSize="8.5"
                              fill="#f8fafc"
                              fontWeight="600"
                              className="font-mono tracking-tight"
                            >
                              {formatTimeOnly(currentSimulatedMs)} UTC
                            </text>
                          </g>
                        );
                      })()}

                      {/* Live Signal Beacons on each active line */}
                      {selectedLines.map((line) => {
                        const style = LINE_STYLES[line.lineId - 1] ?? LINE_STYLES[0];
                        const val = line.soilObservation?.humiditySignalPctRh;
                        if (typeof val !== 'number' || !Number.isFinite(val)) return null;
                        const beaconY = 22 + Math.max(0, Math.min(1, (yMax - val) / ySpan)) * 162;
                        const tagOnLeft = playheadX > 625;
                        const tagX = tagOnLeft ? playheadX - 56 : playheadX + 10;
                        const tagYOffset = (line.lineId - 2) * 14;
                        const tagY = Math.max(26, Math.min(176, beaconY + tagYOffset));

                        return (
                          <g key={`beacon-line-${line.lineId}`}>
                            {/* Animated pulsing wave */}
                            <circle
                              cx={playheadX}
                              cy={beaconY}
                              r="4"
                              fill="none"
                              stroke={style.color}
                              strokeWidth="1.5"
                              opacity="0.8"
                            >
                              <animate attributeName="r" from="4" to="14" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="0.85" to="0" dur="2s" repeatCount="indefinite" />
                            </circle>

                            {/* Solid center dot */}
                            <circle
                              cx={playheadX}
                              cy={beaconY}
                              r="4.5"
                              fill={style.color}
                              stroke="#ffffff"
                              strokeWidth="2"
                            />

                            {/* Floating live readout tag */}
                            <g transform={`translate(${tagX}, ${tagY - 8})`}>
                              <rect
                                width="46"
                                height="16"
                                rx="4"
                                fill="#ffffff"
                                stroke={style.color}
                                strokeWidth="1.25"
                                opacity="0.95"
                              />
                              <text
                                x="23"
                                y="11"
                                textAnchor="middle"
                                fontSize="8"
                                fontWeight="700"
                                fill={style.color}
                                className="font-mono"
                              >
                                L{line.lineId}: {val.toFixed(1)}%
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Hover guideline and seek indicator */}
                  {hoveredMs !== null && (() => {
                    const hoverX = 58 + Math.max(0, Math.min(1, (hoveredMs - xMin) / xSpan)) * 636;
                    const badgeX = Math.max(85, Math.min(665, hoverX));
                    return (
                      <g opacity="0.9">
                        <line
                          x1={hoverX}
                          y1="22"
                          x2={hoverX}
                          y2="184"
                          stroke="#64748b"
                          strokeDasharray="2 3"
                          strokeWidth="1.25"
                        />
                        <g transform={`translate(${badgeX}, 198)`}>
                          <rect
                            x="-44"
                            y="-8"
                            width="88"
                            height="16"
                            rx="3"
                            fill="#334155"
                            opacity="0.9"
                          />
                          <text
                            x="0"
                            y="3.5"
                            textAnchor="middle"
                            fontSize="8"
                            fill="#ffffff"
                            className="font-mono"
                          >
                            Seek: {formatTimeOnly(hoveredMs)}
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                  <text x="58" y="214" fontSize="9" fill="#94a3b8" className="font-mono">
                    {new Date(xMin).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC
                  </text>
                  <text x="694" y="214" textAnchor="end" fontSize="9" fill="#94a3b8" className="font-mono">
                    {new Date(xMax).toLocaleString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC
                  </text>
                </svg>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
                  <div className="flex flex-wrap items-center gap-4">
                    {historyEntries.map((entry) => {
                      const style = LINE_STYLES[entry.lineId - 1] ?? LINE_STYLES[0];
                      const liveLine = snapshot.lines.find((l) => l.lineId === entry.lineId);
                      const liveVal = liveLine?.soilObservation?.humiditySignalPctRh;
                      return (
                        <span key={entry.lineId} className="inline-flex items-center gap-2">
                          <i
                            className="h-2.5 w-5 rounded-xs"
                            style={{
                              background: style.color,
                              borderTop: style.dash ? `2px ${style.dash === '7 4' ? 'dashed' : 'dotted'} ${style.color}` : undefined,
                            }}
                          />
                          <span className="font-medium text-slate-800">Line {entry.lineId}</span>
                          <span className="text-slate-500">({entry.record.historicalTreatment})</span>
                          {typeof liveVal === 'number' && Number.isFinite(liveVal) && (
                            <span
                              className="font-mono font-bold px-1.5 py-0.5 rounded-md text-[10px]"
                              style={{ color: style.color, backgroundColor: `${style.color}15` }}
                            >
                              {liveVal.toFixed(1)} %RH
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Tip: Click anywhere on chart to seek replay time
                  </span>
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={`${panel} space-y-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-900">GRU Signal Forecast</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">Exploratory model output only · %RH signal, not VWC.</p>
                </div>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase text-rose-700">Not for irrigation</span>
              </div>
              {selectedLines.map((line) => <ForecastSummary key={line.lineId} line={line} metadata={metadata} />)}
              <p className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-[11px] leading-relaxed text-amber-900">The held-out GRU did not beat persistence at any evaluated horizon. Point outputs have no calibrated uncertainty and must not be used as field or irrigation forecasts.</p>
            </section>

            <section className={`${panel} space-y-4`}>
              <div>
                <h3 className="text-base font-bold tracking-tight text-slate-900">Isolation Forest Review Screen</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Unsupervised review candidates—not diagnosed sensor faults or probabilities.</p>
              </div>
              <div className="space-y-2.5">{selectedLines.map((line) => <AnomalySummary key={line.lineId} line={line} />)}</div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 text-[11px] leading-relaxed text-slate-600">
            <div className="flex items-start gap-2.5"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" /><div>
              <p className="font-bold text-slate-900">Interpretation boundaries</p>
              <p className="mt-0.5">Trial treatments are not field zones. Air readings come from one shared station. Battery values remain percentages when present. The source-reported current-volume meter unit is shown without conversion; its scale is unvalidated, so no flow or irrigation event is inferred.</p>
              <p className="mt-0.5">No live gateway, actuation, pump state, irrigation advice, yield estimate, or automatic connection to Soil Zoning is provided by this replay screen.</p>
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
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><h4 className="text-xs font-bold text-slate-900">Trial line {line.lineId}</h4><p className="text-[11px] text-slate-500">{line.historicalTreatment}</p></div>
        <span className="font-mono text-right text-[10px] text-slate-400">Soil observation: {soil.observedAtUtc ? formatUtc(soil.observedAtUtc) : 'not recorded'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Reading label="Soil humidity signal" value={soil.humiditySignalPctRh} unit="%RH · not VWC" />
        <Reading label="Soil temperature · 20 cm" value={soil.temperatureC} unit="°C" />
        <Reading label="Soil electrical conductivity" value={soil.electricalConductivityUsCm} unit="µS/cm" />
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span>Sensor battery: {formatValue(soil.batteryPercent, 1, '%')}</span>
        <span>Shared air station: {air.observedAtUtc ? formatUtc(air.observedAtUtc) : 'not recorded'}</span>
        <span>Air temp: {formatValue(air.temperatureC, 1, '°C')}</span>
        <span>Air RH: {formatValue(air.relativeHumidityPctRh, 1, '%RH')}</span>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Raw meter {line.waterMeter.field}: {formatValue(line.waterMeter.sourceReportedValue, 3, line.waterMeter.sourceUnit)} · {line.waterMeter.interpretation}
      </p>
    </div>
  );
};

const ForecastSummary: React.FC<{ line: ReplayLine; metadata: TelemetryMetadata }> = ({ line, metadata }) => {
  const forecast = line.forecast;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
      <h4 className="text-xs font-bold text-slate-900">Line {line.lineId} · {line.historicalTreatment}</h4>
      {forecast?.status === 'exploratory_only' ? <>
        <p className="mt-1 text-[11px] text-slate-500">{forecast.modelVersion} · input window {forecast.inputWindowSteps ?? metadata.forecastModel.windowSteps} steps · {forecast.interpolatedInputValues ?? 0} aligned/interpolated model inputs.</p>
        <div className="mt-3 grid grid-cols-3 gap-2.5">{(forecast.pointForecasts ?? []).map((point) => <div key={point.horizonHours} className="rounded-xl border border-slate-200 bg-white p-2.5 text-center shadow-2xs"><span className="block font-mono text-sm font-bold text-slate-900">{point.value.toFixed(2)}</span><span className="text-[10px] text-slate-400">+{point.horizonHours}h %RH</span></div>)}</div>
        {forecast.inputResamplingNote && <p className="mt-2 text-[10px] text-slate-400">{forecast.inputResamplingNote}</p>}
      </> : <p className="mt-1 text-[11px] text-slate-400">{forecast?.reason ?? 'A complete model input window is not available at this timestamp.'}</p>}
      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full text-left text-[11px]"><thead className="text-slate-400 border-b border-slate-200/70"><tr><th className="pb-1.5 pr-2 font-medium">Holdout horizon</th><th className="pb-1.5 pr-2 font-medium">GRU MAE (%RH)</th><th className="pb-1.5 pr-2 font-medium">Persistence MAE</th><th className="pb-1.5 font-medium">Result</th></tr></thead>
          <tbody>{metadata.forecastModel.horizonsHours.map((hours) => { const metric = metadata.forecastModel.holdoutMetrics[`${hours}h`]; return metric ? <tr key={hours} className="border-t border-slate-200/50 text-slate-700"><td className="py-1.5 pr-2">+{hours}h</td><td className="py-1.5 pr-2 font-mono font-semibold">{metric.gru.maePctRh.toFixed(3)}</td><td className="py-1.5 pr-2 font-mono">{metric.persistenceBaseline.maePctRh.toFixed(3)}</td><td className="py-1.5">{metric.beatsPersistenceByMae ? 'beats' : 'does not beat'}</td></tr> : null; })}</tbody>
        </table>
      </div>
    </div>
  );
};

const AnomalySummary: React.FC<{ line: ReplayLine }> = ({ line }) => {
  const anomaly = line.anomalyReview;
  const text = anomaly?.status === 'review_candidate' ? 'Review candidate' : anomaly?.status === 'no_candidate' ? 'No candidate flagged' : 'Unavailable';
  return <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 text-xs">
    <div><p className="font-bold text-slate-900">Line {line.lineId} · {line.historicalTreatment}</p><p className="mt-0.5 text-[11px] text-slate-500">{anomaly?.scoreMeaning ?? anomaly?.reason ?? 'No unsupervised score available at this point.'}</p></div>
    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase ${anomaly?.status === 'review_candidate' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600'}`}>{text}{typeof anomaly?.score === 'number' ? ` · score ${anomaly.score.toFixed(3)}` : ''}</span>
  </div>;
};
