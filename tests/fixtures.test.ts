import { describe, it, expect } from 'vitest';
import {
  generateScenarioCells,
  computeCellsFingerprint,
  SCENARIOS,
  GRID_ROWS,
  GRID_COLS,
  TOTAL_CELLS,
} from '../src/data/fixtures/scenarioFixtures';
import { getZoningSampleFixture } from '../src/data/fixtures/zoningFixtures';
import { evaluateCropFactors, CROP_PROFILES } from '../src/data/fixtures/cropFitFixtures';

describe('Scenario Fixtures & Determinism', () => {
  it('generates exactly 216 cells (18 cols x 12 rows)', () => {
    const cells = generateScenarioCells('baseline');
    expect(cells.length).toBe(TOTAL_CELLS);
    expect(cells.length).toBe(GRID_ROWS * GRID_COLS);
  });

  it('guarantees reference cell R12 C8 matches Decision 0002 exact baseline specifications', () => {
    const cells = generateScenarioCells('baseline');
    const refCell = cells.find((c) => c.row === 12 && c.col === 8);
    expect(refCell).toBeDefined();
    expect(refCell?.pH).toBe(6.4);
    expect(refCell?.nitrogen).toBe(48);
    expect(refCell?.ec).toBe(1.42);
    expect(refCell?.phosphorus).toBe(24);
    expect(refCell?.potassium).toBe(130);
    expect(refCell?.soilTemp).toBe(24.5);
    expect(refCell?.moisture).toBeNull();
  });

  it('generates consistent, deterministic fingerprint across multiple runs with same seed', () => {
    const run1 = generateScenarioCells('baseline');
    const run2 = generateScenarioCells('baseline');
    expect(computeCellsFingerprint(run1)).toBe(computeCellsFingerprint(run2));
  });

  it('Low Nitrogen preset only modifies declared cells (R4-8, C3-7) and feature (N)', () => {
    const baseline = generateScenarioCells('baseline');
    const lowN = generateScenarioCells('lowN');

    for (let i = 0; i < baseline.length; i++) {
      const b = baseline[i];
      const m = lowN[i];
      const inPatch = b.row >= 4 && b.row <= 8 && b.col >= 3 && b.col <= 7;

      if (inPatch) {
        expect(m.nitrogen).toBe(Math.max(0, b.nitrogen - 18));
      } else {
        expect(m.nitrogen).toBe(b.nitrogen);
      }
      // Other features untouched
      expect(m.pH).toBe(b.pH);
      expect(m.ec).toBe(b.ec);
      expect(m.phosphorus).toBe(b.phosphorus);
      expect(m.potassium).toBe(b.potassium);
    }
  });

  it('High Salinity preset only modifies declared cells (R7-11, C7-10) and feature (EC)', () => {
    const baseline = generateScenarioCells('baseline');
    const highEC = generateScenarioCells('highEC');

    for (let i = 0; i < baseline.length; i++) {
      const b = baseline[i];
      const m = highEC[i];
      const inPatch = b.row >= 7 && b.row <= 11 && b.col >= 7 && b.col <= 10;

      if (inPatch) {
        expect(m.ec).toBeCloseTo(b.ec + 1.2, 2);
      } else {
        expect(m.ec).toBe(b.ec);
      }
      expect(m.nitrogen).toBe(b.nitrogen);
      expect(m.pH).toBe(b.pH);
    }
  });
});

describe('Zoning Fixtures & Fuzzy C-Means', () => {
  it('creates valid K-means sample fixture with correct summaries and counts', () => {
    const sample = getZoningSampleFixture('baseline', 'kmeans', 3);
    expect(sample.k).toBe(3);
    expect(sample.assignments.length).toBe(216);
    expect(sample.summaries.length).toBe(3);

    const totalAssigned = sample.summaries.reduce((sum, s) => sum + s.cellCount, 0);
    expect(totalAssigned).toBe(216);
  });

  it('creates valid FCM sample fixture with membership matrix', () => {
    const sample = getZoningSampleFixture('baseline', 'fcm', 4);
    expect(sample.k).toBe(4);
    expect(sample.membershipMatrix).toBeDefined();
    expect(sample.membershipMatrix?.length).toBe(216);

    // Each row of membership matrix must sum approximately to 1.0
    for (const row of sample.membershipMatrix!) {
      const sum = row.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });
});

describe('Crop Fit Evaluation', () => {
  it('evaluates Apple, Tomato, and Potato independently with valid factor rows', () => {
    const crops: Array<'apple' | 'tomato' | 'potato'> = ['apple', 'tomato', 'potato'];
    for (const crop of crops) {
      const factors = evaluateCropFactors(crop, null);
      expect(factors.length).toBeGreaterThan(5);

      const calciumRow = factors.find((f) => f.factorKey === 'calcium');
      expect(calciumRow).toBeDefined();
      expect(calciumRow?.status).toBe('unassessed');
    }
  });
});
