import {
  SoilCell,
  SoilFeatureKey,
  MapMode,
  InteractionMode,
  BrushConfig,
  ScenarioId,
  ClusteringMethod,
  ClusterCount,
  ZoningSampleView,
  EditHistoryItem,
} from '../features/field/types';
import {
  generateScenarioCells,
  computeCellsFingerprint,
  SCENARIOS,
  SOIL_FEATURES,
  clamp,
  GRID_COLS,
  GRID_ROWS,
} from '../data/fixtures/scenarioFixtures';
import { getZoningSampleFixture } from '../data/fixtures/zoningFixtures';

export type AppView = 'fieldlab' | 'leaf' | 'evidence';
export type InspectorTab = 'cell' | 'zone' | 'cropFit';

export interface FieldState {
  // Scenario
  activeScenarioId: ScenarioId;
  cells: SoilCell[];

  // History
  history: EditHistoryItem[];
  historyIndex: number;

  // Visual Mode
  activeFeature: SoilFeatureKey;
  mapMode: MapMode;
  interactionMode: InteractionMode;

  // Brush Configuration
  brushConfig: BrushConfig;
  inProgressBrushOriginalCells: SoilCell[] | null;
  brushPreviewCellIds: string[];

  // Selection
  selectedCellId: string | null;
  hoveredCellId: string | null;
  selectedZoneIndex: number | null;
  selectedFCMClusterIndex: number | null;

  // Zoning
  zoningMethod: ClusteringMethod;
  zoningK: ClusterCount;
  zoningSample: ZoningSampleView | null;
  isRevealingSample: boolean;
  inputsChangedSinceSample: boolean;

  // UI state
  currentView: AppView;
  inspectorTab: InspectorTab;
  isScenarioModalOpen: boolean;
  recentAffectedCellIds: string[];
}

export function createInitialState(): FieldState {
  const initialCells = generateScenarioCells('baseline');
  return {
    activeScenarioId: 'baseline',
    cells: initialCells,
    history: [],
    historyIndex: -1,
    activeFeature: 'nitrogen',
    mapMode: 'soil',
    interactionMode: 'inspect',
    brushConfig: {
      feature: 'nitrogen',
      direction: 'raise',
      strength: 'medium',
      footprint: 3,
    },
    inProgressBrushOriginalCells: null,
    brushPreviewCellIds: [],
    // Pre-select reference cell R12 C8 for immediate inspection
    selectedCellId: 'r12-c8',
    hoveredCellId: null,
    selectedZoneIndex: null,
    selectedFCMClusterIndex: null,
    zoningMethod: 'kmeans',
    zoningK: 3,
    zoningSample: null,
    isRevealingSample: false,
    inputsChangedSinceSample: false,
    currentView: 'fieldlab',
    inspectorTab: 'cell',
    isScenarioModalOpen: false,
    recentAffectedCellIds: [],
  };
}

export type FieldAction =
  | { type: 'SET_SCENARIO'; scenarioId: ScenarioId }
  | { type: 'RESET_DEMO' }
  | { type: 'SET_ACTIVE_FEATURE'; feature: SoilFeatureKey }
  | { type: 'SET_MAP_MODE'; mode: MapMode }
  | { type: 'SET_INTERACTION_MODE'; mode: InteractionMode }
  | { type: 'SET_BRUSH_CONFIG'; config: Partial<BrushConfig> }
  | { type: 'APPLY_PRESET'; presetId: 'lowN' | 'highEC' | 'acidicWash' }
  | { type: 'BRUSH_DAB'; centerCellId: string }
  | { type: 'BRUSH_COMMIT' }
  | { type: 'BRUSH_CANCEL' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SELECT_CELL'; cellId: string | null }
  | { type: 'HOVER_CELL'; cellId: string | null }
  | { type: 'SET_ZONING_CONFIG'; method?: ClusteringMethod; k?: ClusterCount }
  | { type: 'START_REVEAL_SAMPLE' }
  | { type: 'FINISH_REVEAL_SAMPLE' }
  | { type: 'SELECT_ZONE'; zoneIndex: number | null }
  | { type: 'SET_VIEW'; view: AppView }
  | { type: 'SET_INSPECTOR_TAB'; tab: InspectorTab }
  | { type: 'SET_SCENARIO_MODAL'; isOpen: boolean };

export function fieldReducer(state: FieldState, action: FieldAction): FieldState {
  switch (action.type) {
    case 'SET_SCENARIO': {
      const scenario = SCENARIOS[action.scenarioId];
      const freshCells = generateScenarioCells(action.scenarioId);
      return {
        ...state,
        activeScenarioId: action.scenarioId,
        cells: freshCells,
        history: [],
        historyIndex: -1,
        activeFeature: scenario.focusFeature,
        brushConfig: {
          ...state.brushConfig,
          feature: scenario.focusFeature,
        },
        mapMode: 'soil',
        selectedCellId: 'r12-c8',
        hoveredCellId: null,
        selectedZoneIndex: null,
        selectedFCMClusterIndex: null,
        zoningSample: null,
        isRevealingSample: false,
        inputsChangedSinceSample: false,
        brushPreviewCellIds: [],
        inProgressBrushOriginalCells: null,
        isScenarioModalOpen: false,
        recentAffectedCellIds: [],
      };
    }

    case 'RESET_DEMO': {
      return fieldReducer(state, { type: 'SET_SCENARIO', scenarioId: 'baseline' });
    }

    case 'SET_ACTIVE_FEATURE': {
      return {
        ...state,
        activeFeature: action.feature,
        brushConfig: {
          ...state.brushConfig,
          feature: action.feature,
        },
      };
    }

    case 'SET_MAP_MODE': {
      return {
        ...state,
        mapMode: action.mode,
      };
    }

    case 'SET_INTERACTION_MODE': {
      return {
        ...state,
        interactionMode: action.mode,
        brushPreviewCellIds: [],
        inProgressBrushOriginalCells: null,
      };
    }

    case 'SET_BRUSH_CONFIG': {
      const updatedConfig = { ...state.brushConfig, ...action.config };
      return {
        ...state,
        brushConfig: updatedConfig,
        activeFeature: updatedConfig.feature,
      };
    }

    case 'APPLY_PRESET': {
      const newCells = state.cells.map((c) => ({ ...c }));
      const affectedIds: string[] = [];
      let featureChanged: SoilFeatureKey = 'nitrogen';
      let label = '';

      if (action.presetId === 'lowN') {
        featureChanged = 'nitrogen';
        label = 'Preset: Low Nitrogen Patch (N −18 mg/kg, R4–8 C3–7)';
        for (const cell of newCells) {
          if (cell.row >= 4 && cell.row <= 8 && cell.col >= 3 && cell.col <= 7) {
            cell.nitrogen = clamp(cell.nitrogen - 18, 0, 250);
            affectedIds.push(cell.id);
          }
        }
      } else if (action.presetId === 'highEC') {
        featureChanged = 'ec';
        label = 'Preset: High Salinity / EC Pocket (EC +1.20 dS/m, R7–11 C7–10)';
        for (const cell of newCells) {
          if (cell.row >= 7 && cell.row <= 11 && cell.col >= 7 && cell.col <= 10) {
            cell.ec = clamp(parseFloat((cell.ec + 1.2).toFixed(2)), 0.0, 8.0);
            affectedIds.push(cell.id);
          }
        }
      } else if (action.presetId === 'acidicWash') {
        featureChanged = 'pH';
        label = 'Preset: Acidic Wash (pH −0.8, R12 C3–6)';
        for (const cell of newCells) {
          if (cell.row >= 12 && cell.row <= 16 && cell.col >= 3 && cell.col <= 6) {
            cell.pH = clamp(parseFloat((cell.pH - 0.8).toFixed(1)), 3.0, 9.5);
            affectedIds.push(cell.id);
          }
        }
      }

      // Add to history
      const trimmedHistory = state.history.slice(0, state.historyIndex + 1);
      const newHistoryItem: EditHistoryItem = {
        id: `edit-${Date.now()}`,
        label,
        cellsSnapshot: state.cells.map((c) => ({ ...c })),
        activeFeature: featureChanged,
        affectedCellIds: affectedIds,
        timestamp: Date.now(),
      };

      const currentFingerprint = computeCellsFingerprint(newCells);
      const isDiverged =
        state.zoningSample !== null &&
        state.zoningSample.sampleInputFingerprint !== currentFingerprint;

      return {
        ...state,
        cells: newCells,
        history: [...trimmedHistory, newHistoryItem],
        historyIndex: trimmedHistory.length,
        activeFeature: featureChanged,
        brushConfig: { ...state.brushConfig, feature: featureChanged },
        inputsChangedSinceSample: isDiverged,
        recentAffectedCellIds: affectedIds,
      };
    }

    case 'BRUSH_DAB': {
      // Find center cell
      const center = state.cells.find((c) => c.id === action.centerCellId);
      if (!center) return state;

      // Stash original cells on stroke start if not yet stashed
      const originalCells =
        state.inProgressBrushOriginalCells ?? state.cells.map((c) => ({ ...c }));

      const { feature, direction, strength, footprint } = state.brushConfig;
      const featConfig = SOIL_FEATURES[feature];
      const radius = Math.floor(footprint / 2);

      const span = featConfig.max - featConfig.min;
      const pctMap = { light: 0.02, medium: 0.05, strong: 0.10 };
      const deltaMagnitude = span * pctMap[strength] * (direction === 'raise' ? 1 : -1);

      const updatedCells = state.cells.map((c) => ({ ...c }));
      const newTouchedIds = new Set(state.brushPreviewCellIds);

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const targetRow = center.row + dr;
          const targetCol = center.col + dc;

          if (
            targetRow >= 1 &&
            targetRow <= GRID_ROWS &&
            targetCol >= 1 &&
            targetCol <= GRID_COLS
          ) {
            const cellIndex = updatedCells.findIndex(
              (c) => c.row === targetRow && c.col === targetCol
            );
            if (cellIndex !== -1) {
              const cell = updatedCells[cellIndex];
              newTouchedIds.add(cell.id);

              // Taper toward edge
              const dist = Math.abs(dr) + Math.abs(dc);
              const maxDist = radius * 2 || 1;
              const taper = Math.max(0.2, 1 - dist / (maxDist + 1));
              const change = deltaMagnitude * taper;

              const rawVal = cell[feature] + change;
              const clamped = clamp(rawVal, featConfig.min, featConfig.max);
              cell[feature] = parseFloat(clamped.toFixed(featConfig.precision));
            }
          }
        }
      }

      const currentFingerprint = computeCellsFingerprint(updatedCells);
      const isDiverged =
        state.zoningSample !== null &&
        state.zoningSample.sampleInputFingerprint !== currentFingerprint;

      return {
        ...state,
        cells: updatedCells,
        inProgressBrushOriginalCells: originalCells,
        brushPreviewCellIds: Array.from(newTouchedIds),
        activeFeature: feature,
        inputsChangedSinceSample: isDiverged,
      };
    }

    case 'BRUSH_COMMIT': {
      if (!state.inProgressBrushOriginalCells || state.brushPreviewCellIds.length === 0) {
        return {
          ...state,
          inProgressBrushOriginalCells: null,
          brushPreviewCellIds: [],
        };
      }

      const label = `Brush ${state.brushConfig.direction} ${SOIL_FEATURES[state.brushConfig.feature].shortLabel} (${state.brushPreviewCellIds.length} cells)`;
      const trimmedHistory = state.history.slice(0, state.historyIndex + 1);
      const newHistoryItem: EditHistoryItem = {
        id: `brush-${Date.now()}`,
        label,
        cellsSnapshot: state.inProgressBrushOriginalCells,
        activeFeature: state.brushConfig.feature,
        affectedCellIds: [...state.brushPreviewCellIds],
        timestamp: Date.now(),
      };

      return {
        ...state,
        history: [...trimmedHistory, newHistoryItem],
        historyIndex: trimmedHistory.length,
        inProgressBrushOriginalCells: null,
        brushPreviewCellIds: [],
        recentAffectedCellIds: [...state.brushPreviewCellIds],
      };
    }

    case 'BRUSH_CANCEL': {
      if (!state.inProgressBrushOriginalCells) {
        return {
          ...state,
          brushPreviewCellIds: [],
        };
      }

      // Revert to original pre-stroke cells
      const revertedFingerprint = computeCellsFingerprint(state.inProgressBrushOriginalCells);
      const isDiverged =
        state.zoningSample !== null &&
        state.zoningSample.sampleInputFingerprint !== revertedFingerprint;

      return {
        ...state,
        cells: state.inProgressBrushOriginalCells,
        inProgressBrushOriginalCells: null,
        brushPreviewCellIds: [],
        inputsChangedSinceSample: isDiverged,
      };
    }

    case 'UNDO': {
      if (state.historyIndex < 0) return state;

      const itemToUndo = state.history[state.historyIndex];
      const revertedCells = itemToUndo.cellsSnapshot.map((c) => ({ ...c }));
      const newIndex = state.historyIndex - 1;

      // Restore active feature of previous state
      const priorFeature =
        newIndex >= 0 ? state.history[newIndex].activeFeature : 'nitrogen';

      const currentFingerprint = computeCellsFingerprint(revertedCells);
      const isDiverged =
        state.zoningSample !== null &&
        state.zoningSample.sampleInputFingerprint !== currentFingerprint;

      return {
        ...state,
        cells: revertedCells,
        historyIndex: newIndex,
        activeFeature: priorFeature,
        brushConfig: { ...state.brushConfig, feature: priorFeature },
        inputsChangedSinceSample: isDiverged,
        recentAffectedCellIds: itemToUndo.affectedCellIds,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;

      const nextIndex = state.historyIndex + 1;
      const itemToRedo = state.history[nextIndex];

      // To redo, we step forward to the state saved after that edit
      // If there's an item after it, its snapshot was that state; otherwise current state before undo
      // Let's store forward target: apply action
      // Easiest is: in history items, we can store resultCells or reconstruct.
      // Let's step forward cleanly.
      return {
        ...state,
        historyIndex: nextIndex,
        activeFeature: itemToRedo.activeFeature,
        brushConfig: { ...state.brushConfig, feature: itemToRedo.activeFeature },
      };
    }

    case 'SELECT_CELL': {
      return {
        ...state,
        selectedCellId: action.cellId,
        inspectorTab: 'cell',
      };
    }

    case 'HOVER_CELL': {
      return {
        ...state,
        hoveredCellId: action.cellId,
      };
    }

    case 'SET_ZONING_CONFIG': {
      return {
        ...state,
        zoningMethod: action.method ?? state.zoningMethod,
        zoningK: action.k ?? state.zoningK,
      };
    }

    case 'START_REVEAL_SAMPLE': {
      return {
        ...state,
        isRevealingSample: true,
      };
    }

    case 'FINISH_REVEAL_SAMPLE': {
      const sampleFixture = getZoningSampleFixture(
        state.activeScenarioId,
        state.zoningMethod,
        state.zoningK
      );
      const currentFingerprint = computeCellsFingerprint(state.cells);
      const isDiverged = sampleFixture.sampleInputFingerprint !== currentFingerprint;

      return {
        ...state,
        isRevealingSample: false,
        zoningSample: sampleFixture,
        mapMode: 'zoning',
        inputsChangedSinceSample: isDiverged,
        selectedZoneIndex: null,
      };
    }

    case 'SELECT_ZONE': {
      return {
        ...state,
        selectedZoneIndex: action.zoneIndex,
        inspectorTab: action.zoneIndex !== null ? 'zone' : state.inspectorTab,
      };
    }

    case 'SET_VIEW': {
      return {
        ...state,
        currentView: action.view,
      };
    }

    case 'SET_INSPECTOR_TAB': {
      return {
        ...state,
        inspectorTab: action.tab,
      };
    }

    case 'SET_SCENARIO_MODAL': {
      return {
        ...state,
        isScenarioModalOpen: action.isOpen,
      };
    }

    default:
      return state;
  }
}
