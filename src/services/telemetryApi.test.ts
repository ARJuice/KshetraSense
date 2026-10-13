import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  controlTelemetryPlayback,
  getTelemetryHistory,
  getTelemetryMetadata,
  TELEMETRY_API_URL,
  telemetryWebSocketUrl,
} from './telemetryApi';

afterEach(() => vi.unstubAllGlobals());

describe('historical telemetry API client', () => {
  it('targets the mounted local telemetry routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ apiVersion: 'telemetry-v1' })));
    vi.stubGlobal('fetch', fetchMock);

    await getTelemetryMetadata();

    expect(fetchMock).toHaveBeenCalledWith(`${TELEMETRY_API_URL}/metadata`);
  });

  it('sends bounded history parameters and playback commands in the API contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ lineId: 2, samples: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ index: 0, timestamp: '2023-07-01T00:00:00Z', timestampMs: 0, speed: 60, isPlaying: false, startUtc: '2023-07-01T00:00:00Z', endUtc: '2023-07-02T00:00:00Z' })));
    vi.stubGlobal('fetch', fetchMock);

    await getTelemetryHistory(2, '2023-07-01T00:00:00Z', '2023-07-02T00:00:00Z', 144);
    expect(String(fetchMock.mock.calls[0][0])).toContain('line_id=2');
    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=144');

    await controlTelemetryPlayback({ action: 'set_speed', speed: 60 });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ action: 'set_speed', speed: 60 });
  });

  it('surfaces server errors instead of substituting replay data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Dataset unavailable' }), { status: 503 })));

    await expect(getTelemetryMetadata()).rejects.toMatchObject({ message: 'Dataset unavailable', status: 503 });
  });

  it('converts HTTP origins to a read-only WebSocket URL', () => {
    const url = new URL(telemetryWebSocketUrl());
    expect(url.protocol).toBe('ws:');
    expect(url.pathname).toBe('/v1/telemetry/ws');
  });
});
