import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateFieldCropFit, runFieldZoning } from './zoningApi';
import type { FieldZoningRequest } from '../features/zoning/field/fieldTypes';

const request: FieldZoningRequest = {
  boundary: { type: 'Polygon', coordinates: [[[77, 13], [77.01, 13], [77.01, 13.01], [77, 13.01], [77, 13]]] },
  samples: [],
  cellSizeM: 10,
  method: 'fcm',
  maxK: 6,
  seed: 42,
  mergeThresholdZ: 0.5,
  perturbationRuns: 10,
  fcm: { fuzziness: 2, maxIterations: 150, tolerance: 1e-5 },
};

afterEach(() => vi.unstubAllGlobals());

describe('field zoning API boundary', () => {
  it('posts the complete field request to the versioned endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ runId: 'field-1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await runFieldZoning(request);

    expect(fetchMock.mock.calls[0][0]).toContain('/v2/zoning/run');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(request);
  });

  it('reports service errors rather than substituting a prepared result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'invalid boundary' }));

    await expect(runFieldZoning(request)).rejects.toMatchObject({ name: 'ZoningApiError', status: 422, message: 'invalid boundary' });
  });

  it('sends only the selected profile to the independent crop-fit endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ assessments: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const measurements = { pH: 6.4, ec: 1.2, nitrogen: 48, phosphorus: 22, potassium: 124 };
    const context = { sourceScope: 'Zone 2 mean', soilTestMethod: 'lab', sampleDepth: '0-15 cm', ecMethod: 'lab' };

    await evaluateFieldCropFit(measurements, context);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toContain('/v1/crop-fit/evaluate');
    expect(body.measurements).toEqual(measurements);
    expect(body.measurementContext).toEqual(context);
  });
});
