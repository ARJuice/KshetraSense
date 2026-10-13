import { describe, expect, it } from 'vitest';
import { fetchSoilGridsContext } from '../../services/monitoringApi';

describe('SoilGrids Context Contract (FM-03, FM-04)', () => {
  it('returns native resolution (250m), uncertainty quantiles, and modeled-context disclosure (FM-03)', async () => {
    const data = await fetchSoilGridsContext(12.9716, 77.5946, 'phh2o', '0-5cm');

    expect(data.property).toBe('phh2o');
    expect(data.depth).toBe('0-5cm');
    expect(data.nativeResolution).toBe('250 m');
    expect(data.quantiles.q05).toBeLessThanOrEqual(data.quantiles.q50);
    expect(data.quantiles.q50).toBeLessThanOrEqual(data.quantiles.q95);
    expect(data.modeledContextLabel).toBe('Modeled regional context — not a field measurement');
    expect(data.uncertaintyDisclosure).toContain('250m');
    expect(data.uncertaintyDisclosure.toLowerCase()).toContain('advises against');
    expect(data.disclaimer).toContain('must not replace field-collected soil samples');
    expect(data.disclaimer).toContain('do not alter or feed into Soil Zoning or Crop Fit');
  });

  it('provides distinct values across depths (depth attenuation)', async () => {
    const surface = await fetchSoilGridsContext(12.9716, 77.5946, 'nitrogen', '0-5cm');
    const deep = await fetchSoilGridsContext(12.9716, 77.5946, 'nitrogen', '100-200cm');

    expect(surface.depth).toBe('0-5cm');
    expect(deep.depth).toBe('100-200cm');
    // Nitrogen decreases with depth
    expect(deep.quantiles.q50).toBeLessThan(surface.quantiles.q50);
  });
});
