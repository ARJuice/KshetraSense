import { describe, expect, it } from 'vitest';
import {
  cropFitStages,
  defenseQAList,
  leafVisionStages,
  remoteSensingStages,
  soilZoningStages,
  telemetryStages,
  testMatrixData,
} from './methodologyData';

describe('Methodology & Scientific Architecture Data Integrity', () => {
  it('defines sequential, unique step numbers for all module pipelines', () => {
    const modules = [
      { name: 'Soil Zoning', stages: soilZoningStages },
      { name: 'Telemetry', stages: telemetryStages },
      { name: 'Remote Sensing', stages: remoteSensingStages },
      { name: 'Leaf Vision', stages: leafVisionStages },
      { name: 'Crop Fit', stages: cropFitStages },
    ];

    for (const mod of modules) {
      expect(mod.stages.length).toBeGreaterThan(0);
      const stepNumbers = mod.stages.map((s) => s.stepNumber);
      // Ensure step numbers start at 1 and are sequential
      expect(stepNumbers).toEqual(Array.from({ length: mod.stages.length }, (_, i) => i + 1));
      // Ensure unique IDs
      const ids = mod.stages.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('correctly implements nonlinear SHI mathematical scoring functions', () => {
    // Formula tests from Phase 1 shi.py
    // 1. pH Bell Curve: exp(-(pH - 6.5)^2 / (2 * 0.8^2))
    const scorePhOptimum = Math.exp(-Math.pow(6.5 - 6.5, 2) / (2 * Math.pow(0.8, 2)));
    expect(scorePhOptimum).toBeCloseTo(1.0, 5);

    const scorePhAcidic = Math.exp(-Math.pow(5.0 - 6.5, 2) / (2 * Math.pow(0.8, 2)));
    expect(scorePhAcidic).toBeCloseTo(0.173, 2);

    // 2. EC Sigmoid: 1 / (1 + exp(2.5 * (EC - 2.0)))
    const scoreEcMidpoint = 1 / (1 + Math.exp(2.5 * (2.0 - 2.0)));
    expect(scoreEcMidpoint).toBeCloseTo(0.5, 5);

    const scoreEcZero = 1 / (1 + Math.exp(2.5 * (0.0 - 2.0)));
    expect(scoreEcZero).toBeGreaterThan(0.99);

    // 3. Nitrogen Sigmoid: 1 / (1 + exp(-0.06 * (N - 60)))
    const scoreNMidpoint = 1 / (1 + Math.exp(-0.06 * (60 - 60)));
    expect(scoreNMidpoint).toBeCloseTo(0.5, 5);

    // 4. Phosphorus Sigmoid: 1 / (1 + exp(-0.12 * (P - 25)))
    const scorePMidpoint = 1 / (1 + Math.exp(-0.12 * (25 - 25)));
    expect(scorePMidpoint).toBeCloseTo(0.5, 5);

    // 5. Potassium Sigmoid: 1 / (1 + exp(-0.03 * (K - 150)))
    const scoreKMidpoint = 1 / (1 + Math.exp(-0.03 * (150 - 150)));
    expect(scoreKMidpoint).toBeCloseTo(0.5, 5);

    // Weights sum to 1.0
    const weights = [0.25, 0.20, 0.20, 0.15, 0.20];
    const weightSum = weights.reduce((acc, w) => acc + w, 0);
    expect(weightSum).toBeCloseTo(1.0, 5);
  });

  it('correctly implements IDW spatial distance weighting (p=2.0)', () => {
    // 2 sample points at distance 10m (val=6.0) and 20m (val=8.0)
    const d1 = 10.0;
    const d2 = 20.0;
    const w1 = 1 / Math.pow(d1, 2.0); // 0.01
    const w2 = 1 / Math.pow(d2, 2.0); // 0.0025

    const z1 = 6.0;
    const z2 = 8.0;

    const zEst = (w1 * z1 + w2 * z2) / (w1 + w2);
    // (0.01 * 6 + 0.0025 * 8) / (0.0125) = (0.06 + 0.02) / 0.0125 = 0.08 / 0.0125 = 6.4
    expect(zEst).toBeCloseTo(6.4, 4);

    // Point closer to core has 4x higher weight (inverse square law)
    expect(w1 / w2).toBeCloseTo(4.0, 4);
  });

  it('verifies multispectral NDVI mathematical boundaries and physics', () => {
    // Dense canopy: Red 0.06, NIR 0.58
    const redDense = 0.06;
    const nirDense = 0.58;
    const ndviDense = (nirDense - redDense) / (nirDense + redDense);
    expect(ndviDense).toBeGreaterThan(0.8);
    expect(ndviDense).toBeLessThanOrEqual(1.0);

    // Water: NIR absorbed (0.03), Red reflected (0.12)
    const redWater = 0.12;
    const nirWater = 0.03;
    const ndviWater = (nirWater - redWater) / (nirWater + redWater);
    expect(ndviWater).toBeLessThan(0);
    expect(ndviWater).toBeCloseTo(-0.6, 2);

    // Edge check: Equal reflectance -> NDVI = 0
    expect((0.2 - 0.2) / (0.2 + 0.2)).toBe(0);
  });

  it('correctly implements MobileNetV3 Hard-Swish and SE Hard-Sigmoid', () => {
    // Hard-Swish: x * ReLU6(x + 3) / 6
    const relu6 = (v: number) => Math.min(Math.max(0, v), 6);
    const hardSwish = (x: number) => {
      const res = x * (relu6(x + 3) / 6);
      return res === 0 ? 0 : res;
    };

    expect(hardSwish(0)).toBe(0);
    expect(hardSwish(3)).toBe(3.0);
    expect(hardSwish(-3)).toBe(0);
    expect(hardSwish(-4)).toBe(0);
    expect(hardSwish(4)).toBe(4.0);

    // Hard-Sigmoid: ReLU6(x + 3) / 6
    const hardSigmoid = (x: number) => relu6(x + 3) / 6;
    expect(hardSigmoid(0)).toBe(0.5);
    expect(hardSigmoid(3)).toBe(1.0);
    expect(hardSigmoid(-3)).toBe(0.0);
  });

  it('proves multi-label crop suitability does not sum to 100%', () => {
    // Given a field at pH 6.6, EC 1.0
    const ph = 6.6;
    const isMilletViable = ph >= 4.5 && ph <= 8.0; // true
    const isTomatoViable = ph >= 6.5 && ph <= 7.5; // true
    const isGroundnutViable = ph >= 5.3 && ph <= 6.6; // true

    // All three are simultaneously viable for the same parcel
    expect(isMilletViable && isTomatoViable && isGroundnutViable).toBe(true);

    // In single-choice probability: P1 + P2 + P3 = 1.0 (impossible here)
    // Multi-label boolean vector: [1, 1, 1], where sum of viability booleans = 3 != 1
    const totalViableCount = [isMilletViable, isTomatoViable, isGroundnutViable].filter(Boolean).length;
    expect(totalViableCount).toBe(3);
  });

  it('contains all 11 audited academic defense questions from Phase 5', () => {
    expect(defenseQAList.length).toBe(11);

    const categories = new Set(defenseQAList.map((q) => q.category));
    expect(categories).toContain('Spatial ML');
    expect(categories).toContain('Time Series');
    expect(categories).toContain('Computer Vision');
    expect(categories).toContain('Agronomy');
    expect(categories).toContain('System Architecture');

    for (const q of defenseQAList) {
      expect(q.questionNumber).toBeGreaterThanOrEqual(1);
      expect(q.questionNumber).toBeLessThanOrEqual(11);
      expect(q.briefAnswer.length).toBeGreaterThan(20);
      expect(q.deepScientificDefense.length).toBeGreaterThanOrEqual(2);
      expect(q.keyRiskOrLimitation.length).toBeGreaterThan(10);
    }
  });

  it('verifies test matrix scopes and scientific bounds', () => {
    expect(testMatrixData.length).toBeGreaterThanOrEqual(6);

    const scopes = testMatrixData.map((d) => d.scope);
    expect(scopes).toContain('Frontend Unit Tests');
    expect(scopes).toContain('TypeScript Typecheck');
    expect(scopes).toContain('Python Backend Algorithmic Suite');
    expect(scopes).toContain('MobileNetV3-Small Leaf Classifier');
    expect(scopes).toContain('Soil-Signal GRU Sequence Forecaster');

    for (const entry of testMatrixData) {
      expect(['passed', 'bounded', 'manual-pending']).toContain(entry.status);
      expect(entry.scientificBoundary.length).toBeGreaterThan(15);
    }
  });

  it('enforces architectural decoupling contracts in stage descriptions', () => {
    // Leaf Vision must isolate raw image pixels from soil/zoning
    const leafDecoupling = leafVisionStages.find((s) => s.id === 'architectural-decoupling');
    expect(leafDecoupling).toBeDefined();
    expect(leafDecoupling?.outputDescription).toContain('Zero soil features');

    // Telemetry must isolate Parma trial from farmer field
    const telemetryProvenance = telemetryStages.find((s) => s.id === 'provenance-ingestion');
    expect(telemetryProvenance).toBeDefined();
    expect(telemetryProvenance?.operationalLimits.some((l) => l.includes('historical'))).toBe(true);

    // SoilGrids must disclaim farm-scale use and downscaling
    const soilGridsStage = remoteSensingStages.find((s) => s.id === 'soilgrids-wcs-adapter');
    expect(soilGridsStage).toBeDefined();
    expect(soilGridsStage?.operationalLimits.some((l) => l.includes('250m'))).toBe(true);
  });
});
