import {
  SoilCell,
  SoilFeatureConfig,
  SoilFeatureKey,
  ScenarioDefinition,
  ScenarioId,
} from '../../features/field/types';

export const SOIL_FEATURES: Record<SoilFeatureKey, SoilFeatureConfig> = {
  nitrogen: {
    key: 'nitrogen',
    label: 'Nitrogen (N)',
    shortLabel: 'N',
    unit: 'mg/kg',
    min: 0,
    max: 250,
    precision: 0,
    step: 1,
    description: 'Available soil nitrate & ammonium; essential for vegetative leaf development.',
  },
  phosphorus: {
    key: 'phosphorus',
    label: 'Phosphorus (P)',
    shortLabel: 'P',
    unit: 'mg/kg',
    min: 0,
    max: 250,
    precision: 0,
    step: 1,
    description: 'Available phosphate (Olsen/Bray equivalent); critical for early rooting.',
  },
  potassium: {
    key: 'potassium',
    label: 'Potassium (K)',
    shortLabel: 'K',
    unit: 'mg/kg',
    min: 0,
    max: 250,
    precision: 0,
    step: 1,
    description: 'Exchangeable soil potassium; supports water regulation and disease resistance.',
  },
  pH: {
    key: 'pH',
    label: 'Soil pH',
    shortLabel: 'pH',
    unit: '',
    min: 3.0,
    max: 9.5,
    precision: 1,
    step: 0.1,
    description: 'Soil acidity/alkalinity in 1:2.5 water suspension; dictates nutrient availability.',
  },
  ec: {
    key: 'ec',
    label: 'Electrical Conductivity (EC)',
    shortLabel: 'EC',
    unit: 'dS/m',
    min: 0.0,
    max: 8.0,
    precision: 2,
    step: 0.01,
    description: 'Saturated paste extract salinity indicator; impacts osmotic soil water uptake.',
  },
  soilTemp: {
    key: 'soilTemp',
    label: 'Soil Temperature',
    shortLabel: 'Temp',
    unit: '°C',
    min: 0.0,
    max: 50.0,
    precision: 1,
    step: 0.1,
    description: 'Root-zone thermal snapshot (15 cm depth); influences biological nutrient mineralization.',
  },
};

export const SCENARIOS: Record<ScenarioId, ScenarioDefinition> = {
  baseline: {
    id: 'baseline',
    name: 'Garden East — Baseline',
    subtitle: 'Standard seeded field',
    seed: 42,
    focusFeature: 'nitrogen',
    description: 'Restores the original synthetic grid. "Baseline" denotes the initial fixture state, not an agronomically optimal soil condition.',
    patchDescription: 'Entire 18×12 field initialized to deterministic spatially coherent values.',
  },
  lowN: {
    id: 'lowN',
    name: 'Low Nitrogen Patch',
    subtitle: 'Simulated leaching pocket',
    seed: 42,
    focusFeature: 'nitrogen',
    description: 'Simulates localized nutrient depletion or subsoil leaching in the northwest quadrant.',
    patchDescription: 'Rows 4–8, Columns 3–7: N reduced by 18 mg/kg from seeded baseline.',
  },
  highEC: {
    id: 'highEC',
    name: 'High Salinity / EC Pocket',
    subtitle: 'Accumulated salt concentration',
    seed: 42,
    focusFeature: 'ec',
    description: 'Simulates poor drainage or evaporation-driven salt accumulation in the central eastern zone.',
    patchDescription: 'Rows 7–11, Columns 7–10: EC increased by 1.20 dS/m from seeded baseline.',
  },
  acidicWash: {
    id: 'acidicWash',
    name: 'Acidic Wash',
    subtitle: 'Local low-pH depression',
    seed: 42,
    focusFeature: 'pH',
    description: 'Simulates low-pH surface runoff runoff or pine litter acidification in the southern perimeter.',
    patchDescription: 'Rows 12 (12–16 clamped to grid), Columns 3–6: pH reduced by 0.8 from seeded baseline.',
  },
};

export const GRID_ROWS = 12;
export const GRID_COLS = 18;
export const TOTAL_CELLS = GRID_ROWS * GRID_COLS; // 216

/**
 * Deterministic mulberry32 PRNG implementation
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/**
 * Generate 216 cells deterministically for a scenario.
 * Strictly guarantees that reference cell R12 C8 matches Decision 0002:
 * pH 6.4, N 48 mg/kg, EC 1.42 dS/m, P 24 mg/kg, K 130 mg/kg, Soil Temp 24.5 °C.
 */
export function generateScenarioCells(scenarioId: ScenarioId): SoilCell[] {
  const rng = mulberry32(42);
  const cells: SoilCell[] = [];

  for (let r = 1; r <= GRID_ROWS; r++) {
    for (let c = 1; c <= GRID_COLS; c++) {
      const id = `r${r}-c${c}`;
      const nx = c / GRID_COLS;
      const ny = r / GRID_ROWS;
      const wave = Math.sin(nx * 3.1415) * Math.cos(ny * 2.718) * 0.35 + rng() * 0.65;

      // Base formula with spatial coherence
      let n = Math.round(52 + wave * 45 + rng() * 12);
      let p = Math.round(22 + wave * 18 + rng() * 8);
      let k = Math.round(115 + wave * 35 + rng() * 18);
      let ph = parseFloat((6.2 + wave * 0.6 + (rng() - 0.5) * 0.35).toFixed(1));
      let ec = parseFloat((1.15 + wave * 0.45 + rng() * 0.22).toFixed(2));
      let temp = parseFloat((22.5 + wave * 4.2 + rng() * 1.8).toFixed(1));

      // Enforce exact illustrative reference cell R12 C8 in baseline
      if (r === 12 && c === 8) {
        ph = 6.4;
        n = 48;
        ec = 1.42;
        p = 24;
        k = 130;
        temp = 24.5;
      }

      cells.push({
        id,
        row: r,
        col: c,
        nitrogen: clamp(n, 0, 250),
        phosphorus: clamp(p, 0, 250),
        potassium: clamp(k, 0, 250),
        pH: clamp(ph, 3.0, 9.5),
        ec: clamp(ec, 0.0, 8.0),
        soilTemp: clamp(temp, 0.0, 50.0),
        moisture: null, // explicitly unassessed
      });
    }
  }

  // Apply declared deterministic scenario patches
  if (scenarioId === 'lowN') {
    for (const cell of cells) {
      if (cell.row >= 4 && cell.row <= 8 && cell.col >= 3 && cell.col <= 7) {
        cell.nitrogen = clamp(cell.nitrogen - 18, 0, 250);
      }
    }
  } else if (scenarioId === 'highEC') {
    for (const cell of cells) {
      if (cell.row >= 7 && cell.row <= 11 && cell.col >= 7 && cell.col <= 10) {
        cell.ec = clamp(parseFloat((cell.ec + 1.2).toFixed(2)), 0.0, 8.0);
      }
    }
  } else if (scenarioId === 'acidicWash') {
    for (const cell of cells) {
      // Clamped to available rows (row 12)
      if (cell.row >= 12 && cell.row <= 16 && cell.col >= 3 && cell.col <= 6) {
        cell.pH = clamp(parseFloat((cell.pH - 0.8).toFixed(1)), 3.0, 9.5);
      }
    }
  }

  return cells;
}

/**
 * Produce a hash string of all current cell features to detect edits
 */
export function computeCellsFingerprint(cells: SoilCell[]): string {
  return cells
    .map((c) => `${c.id}:${c.nitrogen}:${c.pH}:${c.ec}:${c.phosphorus}:${c.potassium}:${c.soilTemp}`)
    .join('|');
}
