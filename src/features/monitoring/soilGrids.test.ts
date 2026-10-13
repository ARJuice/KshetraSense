import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSoilGridsContext } from '../../services/monitoringApi';

const context = {
  property: 'phh2o',
  propertyName: 'Soil pH (in H2O)',
  depth: '0-5cm',
  nativeResolution: '250 m',
  quantiles: { 'Q0.05': 5.8, 'Q0.50': 6.6, 'Q0.95': 7.4 },
  unit: 'pH',
  mappedValue: 6.6,
  source: 'ISRIC SoilGrids 2.0',
  retrievalDate: '2026-10-14T00:00:00Z',
  modeledContextLabel: 'Modeled regional context — not a field measurement',
  uncertaintyDisclosure: '250 m modeled context.',
  disclaimer: 'Do not replace field samples.',
  latitude: 12.9716,
  longitude: 77.5946,
};

afterEach(() => vi.unstubAllGlobals());

describe('SoilGrids client contract', () => {
  it('maps the real response shape without deriving missing values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(context))));

    const result = await fetchSoilGridsContext(12.9716, 77.5946);

    expect(result.quantiles).toEqual({ q05: 5.8, q50: 6.6, q95: 7.4 });
    expect(result.nativeResolution).toBe('250 m');
    expect(result.modeledContextLabel).toContain('not a field measurement');
  });

  it('surfaces provider unavailability instead of returning a local estimate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'No verified ISRIC data adapter is configured.' }), { status: 503 })));

    await expect(fetchSoilGridsContext(12.9716, 77.5946)).rejects.toMatchObject({
      status: 503,
      message: 'No verified ISRIC data adapter is configured.',
    });
  });

  it('rejects invalid coordinates before network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSoilGridsContext(95, 77)).rejects.toThrow(/valid latitude/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
