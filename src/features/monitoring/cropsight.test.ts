import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCropSightAnalysis } from '../../services/monitoringApi';
import type { CircularAreaOfInterest } from './types';

const aoi: CircularAreaOfInterest = {
  latitude: 12.9716,
  longitude: 77.5946,
  radiusMeters: 250,
  startDate: '2025-11-01',
  endDate: '2026-03-31',
};

const apiResult = {
  ndvi_stats: { mean: 0.61, stddev: 0.09, min: 0.24, max: 0.84 },
  zones_identified: 3,
  processing_time: 1.48,
  recommendations: ['Upstream rule note'],
  ndvi_time_series: {
    dates: ['2026-01-01', '2026-01-11'],
    ndvi_values: [0.42, 0.66],
    mean_ndvi: 0.54,
    trend: 'increasing',
  },
  rainfall_data: {
    dates: ['2026-01-01'],
    rainfall_values: [4.2],
    total_rainfall: 4.2,
    avg_daily_rainfall: 4.2,
    max_daily_rainfall: 4.2,
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('CropSight API contract', () => {
  it('sends the independent AOI and maps only values returned by CropSight', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(apiResult)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runCropSightAnalysis({
      aoi,
      clusteringMethod: 'K-Means',
      numZones: 3,
      cropType: 'Wheat',
      cropGrowthStage: 'Unspecified',
    });

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request).toMatchObject({
      latitude: aoi.latitude,
      longitude: aoi.longitude,
      buffer_size: 250,
      start_date: aoi.startDate,
      end_date: aoi.endDate,
      clustering_method: 'K-Means',
      num_zones: 3,
    });
    expect(result.ndviStats.mean).toBe(0.61);
    expect(result.ndviTimeSeries.ndviValues).toEqual([0.42, 0.66]);
    expect(result.source).toContain('COPERNICUS/S2_HARMONIZED');
    expect(result.processingTime).toBe(1.48);
    expect(result).not.toHaveProperty('zonalStats');
    expect(result).not.toHaveProperty('benchmarkSceneId');
  });

  it('does not replace authentication or provider errors with a canned benchmark', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Earth Engine authentication required' }), { status: 500 })));

    await expect(runCropSightAnalysis({
      aoi,
      clusteringMethod: 'K-Means',
      numZones: 3,
      cropType: 'Wheat',
      cropGrowthStage: 'Unspecified',
    })).rejects.toThrow(/Authentication \/ Project Error/);
  });

  it('rejects a response without the real date-aligned NDVI series', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...apiResult, ndvi_time_series: { dates: ['2026-01-01'], ndvi_values: [] } }))));

    await expect(runCropSightAnalysis({
      aoi,
      clusteringMethod: 'K-Means',
      numZones: 3,
      cropType: 'Wheat',
      cropGrowthStage: 'Unspecified',
    })).rejects.toThrow(/missing valid NDVI statistics/);
  });

  it('rejects malformed AOI inputs and unsupported clustering labels before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(runCropSightAnalysis({
      aoi: { ...aoi, startDate: '2026-04-01' },
      clusteringMethod: 'K-Means', numZones: 3, cropType: 'Other', cropGrowthStage: 'Unspecified',
    })).rejects.toThrow(/start date on or before/);
    await expect(runCropSightAnalysis({
      aoi,
      clusteringMethod: 'DBSCAN', numZones: 3, cropType: 'Other', cropGrowthStage: 'Unspecified',
    })).rejects.toThrow(/Only the CropSight K-Means path/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
