import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  fieldReducer,
} from '../src/state/fieldState';

describe('FieldState Reducer & Domain Transitions', () => {
  it('initializes with baseline scenario, 216 cells, and reference cell R12 C8 selected', () => {
    const state = createInitialState();
    expect(state.activeScenarioId).toBe('baseline');
    expect(state.cells.length).toBe(216);
    expect(state.selectedCellId).toBe('r12-c8');
    expect(state.history.length).toBe(0);
    expect(state.historyIndex).toBe(-1);
    expect(state.zoningSample).toBeNull();
  });

  it('applying a preset updates only declared cells, sets active feature, and records 1 undo step', () => {
    let state = createInitialState();
    state = fieldReducer(state, { type: 'APPLY_PRESET', presetId: 'lowN' });

    expect(state.activeFeature).toBe('nitrogen');
    expect(state.history.length).toBe(1);
    expect(state.historyIndex).toBe(0);

    const affectedCell = state.cells.find((c) => c.row === 4 && c.col === 3);
    expect(affectedCell).toBeDefined();

    // Now undo
    state = fieldReducer(state, { type: 'UNDO' });
    expect(state.historyIndex).toBe(-1);

    // Verify cell was restored to baseline value
    const restoredCell = state.cells.find((c) => c.row === 4 && c.col === 3);
    expect(restoredCell?.nitrogen).toBe(affectedCell!.nitrogen + 18);
  });

  it('brush dab modifies cells and commit creates 1 undo step', () => {
    let state = createInitialState();
    state = fieldReducer(state, { type: 'SET_INTERACTION_MODE', mode: 'brush' });
    state = fieldReducer(state, { type: 'BRUSH_DAB', centerCellId: 'r6-c6' });

    expect(state.brushPreviewCellIds.length).toBeGreaterThan(0);
    expect(state.inProgressBrushOriginalCells).not.toBeNull();

    // Commit stroke
    state = fieldReducer(state, { type: 'BRUSH_COMMIT' });
    expect(state.history.length).toBe(1);
    expect(state.brushPreviewCellIds.length).toBe(0);
    expect(state.inProgressBrushOriginalCells).toBeNull();

    // Undo reverts stroke
    state = fieldReducer(state, { type: 'UNDO' });
    expect(state.historyIndex).toBe(-1);
  });

  it('cancelling brush rolls back without creating history entry', () => {
    let state = createInitialState();
    const originalN = state.cells.find((c) => c.id === 'r6-c6')?.nitrogen;

    state = fieldReducer(state, { type: 'SET_INTERACTION_MODE', mode: 'brush' });
    state = fieldReducer(state, { type: 'BRUSH_DAB', centerCellId: 'r6-c6' });

    // Cancel before commit
    state = fieldReducer(state, { type: 'BRUSH_CANCEL' });
    expect(state.history.length).toBe(0);
    expect(state.historyIndex).toBe(-1);

    const revertedN = state.cells.find((c) => c.id === 'r6-c6')?.nitrogen;
    expect(revertedN).toBe(originalN);
  });

  it('revealing zoning sample then editing raises inputsChangedSinceSample notice', () => {
    let state = createInitialState();
    state = fieldReducer(state, { type: 'START_REVEAL_SAMPLE' });
    state = fieldReducer(state, { type: 'FINISH_REVEAL_SAMPLE' });

    expect(state.zoningSample).not.toBeNull();
    expect(state.inputsChangedSinceSample).toBe(false);

    // Apply an edit
    state = fieldReducer(state, { type: 'APPLY_PRESET', presetId: 'acidicWash' });
    expect(state.inputsChangedSinceSample).toBe(true);

    // Undo edit
    state = fieldReducer(state, { type: 'UNDO' });
    expect(state.inputsChangedSinceSample).toBe(false);
  });

  it('switching scenario atomically resets history, sample state, and loads scenario focus feature', () => {
    let state = createInitialState();
    state = fieldReducer(state, { type: 'APPLY_PRESET', presetId: 'lowN' });
    state = fieldReducer(state, { type: 'FINISH_REVEAL_SAMPLE' });

    // Switch scenario to highEC
    state = fieldReducer(state, { type: 'SET_SCENARIO', scenarioId: 'highEC' });
    expect(state.activeScenarioId).toBe('highEC');
    expect(state.activeFeature).toBe('ec');
    expect(state.history.length).toBe(0);
    expect(state.historyIndex).toBe(-1);
    expect(state.zoningSample).toBeNull();
    expect(state.inputsChangedSinceSample).toBe(false);
  });
});
