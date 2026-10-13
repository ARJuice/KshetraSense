import { describe, expect, it } from 'vitest';
import { getVerifiedCropSightBenchmark } from '../../services/monitoringApi';
import type { CircularAreaOfInterest } from './types';

describe('CropSight Integration Contracts (FM-05, FM-06, FM-07, FM-08)', () => {
  const sampleAoi: CircularAreaOfInterest = {
    latitude: 30.9015,
    longitude: 75.8524,
    radiusMeters: 250,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  };

  it('preserves circular AOI inputs and provenance without reading zoning state (FM-05)', () => {
    const result = getVerifiedCropSightBenchmark(sampleAoi);
    expect(result.aoi.latitude).toBe(30.9015);
    expect(result.aoi.longitude).toBe(75.8524);
    expect(result.aoi.radiusMeters).toBe(250);
    expect(result.aoi.startDate).toBe('2026-01-01');
    expect(result.aoi.endDate).toBe('2026-03-31');
    expect(result.provider).toContain('Google Earth Engine');
    expect(result.source).toContain('COPERNICUS/S2_SR_HARMONIZED');
  });

  it('reports verified algorithm labels and zone summaries (FM-06)', () => {
    const result = getVerifiedCropSightBenchmark(sampleAoi);
    expect(result.clusteringMethod).toContain('K-Means');
    expect(result.zonesIdentified).toBe(3);
    expect(result.zonalStats).toHaveLength(3);
    expect(result.zonalStats[0].meanNdvi).toBeLessThan(result.zonalStats[2].meanNdvi);
  });

  it('clearly marks benchmark runs as demonstration benchmarks (FM-07)', () => {
    const result = getVerifiedCropSightBenchmark(sampleAoi);
    expect(result.isBenchmark).toBe(true);
    expect(result.benchmarkSceneId).toBeDefined();
    expect(result.source).toContain('Verified Demonstration Benchmark');
  });

  it('uses exploratory scouting language rather than causal or prescription claims (FM-08)', () => {
    const result = getVerifiedCropSightBenchmark(sampleAoi);
    const recs = result.recommendations.join(' ');
    expect(recs.toLowerCase()).toContain('prioritize ground inspection');
    expect(recs.toLowerCase()).not.toContain('fertilizer prescription');
    expect(recs.toLowerCase()).not.toContain('irrigation command');
    expect(recs.toLowerCase()).not.toContain('yield guarantee');
  });

  it('guarantees that management zone area percentages sum to exactly 100% across all zone counts', async () => {
    const { generateZoneStats } = await import('../../services/monitoringApi');
    for (let k = 2; k <= 7; k += 1) {
      const stats = generateZoneStats(k, 0.612, 0.094);
      expect(stats).toHaveLength(k);
      const totalArea = stats.reduce((acc, z) => acc + z.areaPercentage, 0);
      expect(totalArea).toBe(100);
    }
  });

  it('supports custom numZones in verified benchmark mode', () => {
    const res4 = getVerifiedCropSightBenchmark(sampleAoi, 4);
    expect(res4.zonesIdentified).toBe(4);
    expect(res4.zonalStats).toHaveLength(4);
    const totalArea4 = res4.zonalStats.reduce((acc, z) => acc + z.areaPercentage, 0);
    expect(totalArea4).toBe(100);

    const res2 = getVerifiedCropSightBenchmark(sampleAoi, 2);
    expect(res2.zonesIdentified).toBe(2);
    expect(res2.zonalStats).toHaveLength(2);
    const totalArea2 = res2.zonalStats.reduce((acc, z) => acc + z.areaPercentage, 0);
    expect(totalArea2).toBe(100);
  });
});
