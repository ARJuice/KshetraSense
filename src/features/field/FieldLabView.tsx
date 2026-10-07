import React, { useMemo } from 'react';
import { useFieldStore } from '../../state/useFieldStore';
import { FieldRendererPlaceholder } from './FieldRendererPlaceholder';
import { FieldControls } from './FieldControls';
import { FieldLegend } from './FieldLegend';
import { ContextualInspector } from '../../components/inspector/ContextualInspector';
import { FieldViewModel, FieldRendererCallbacks } from './FieldRenderer.interface';
import { GRID_ROWS, GRID_COLS } from '../../data/fixtures/scenarioFixtures';

export const FieldLabView: React.FC = () => {
  const { state, dispatch } = useFieldStore();

  // Construct typed FieldViewModel for the renderer seam
  const viewModel: FieldViewModel = useMemo(
    () => ({
      cells: state.cells,
      rows: GRID_ROWS,
      cols: GRID_COLS,
      activeFeature: state.activeFeature,
      mapMode: state.mapMode,
      zoningSample: state.zoningSample,
      selectedZoneIndex: state.selectedZoneIndex,
      selectedFCMClusterIndex: state.selectedFCMClusterIndex,
      interactionMode: state.interactionMode,
      brushConfig: state.brushConfig,
      brushPreviewCellIds: state.brushPreviewCellIds,
      selectedCellId: state.selectedCellId,
      hoveredCellId: state.hoveredCellId,
      affectedFeedbackCellIds: state.recentAffectedCellIds,
      prefersReducedMotion: false, // can check matchMedia in production
    }),
    [state]
  );

  // Construct typed FieldRendererCallbacks
  const callbacks: FieldRendererCallbacks = useMemo(
    () => ({
      onCellHover: (cellId) => dispatch({ type: 'HOVER_CELL', cellId }),
      onCellSelect: (cellId) => dispatch({ type: 'SELECT_CELL', cellId }),
      onBrushApply: (cellId) => dispatch({ type: 'BRUSH_DAB', centerCellId: cellId }),
      onBrushCommit: () => dispatch({ type: 'BRUSH_COMMIT' }),
      onZoneSelect: (zoneIndex) => dispatch({ type: 'SELECT_ZONE', zoneIndex }),
    }),
    [dispatch]
  );

  return (
    <div className="flex-1 flex overflow-hidden w-full h-[calc(100vh-68px)]">
      {/* ── LEFT SIDEBAR: FIELD CONTROLS & LEGEND ── */}
      <div className="w-80 lg:w-88 p-4 overflow-y-auto border-r border-line-border bg-parchment-100/60 flex flex-col gap-4">
        <FieldControls />
        <FieldLegend
          mapMode={state.mapMode}
          activeFeature={state.activeFeature}
          zoningSample={state.zoningSample}
          selectedZoneIndex={state.selectedZoneIndex}
          onSelectZone={(z) => dispatch({ type: 'SELECT_ZONE', zoneIndex: z })}
        />
      </div>

      {/* ── CENTER: FUNCTIONAL FIELD STAGE ── */}
      <main className="flex-1 flex flex-col p-4 bg-parchment-200/50 overflow-hidden relative">
        <FieldRendererPlaceholder
          viewModel={viewModel}
          callbacks={callbacks}
          className="flex-1 w-full"
        />
      </main>

      {/* ── RIGHT SIDEBAR: CONTEXTUAL INSPECTOR ── */}
      <ContextualInspector />
    </div>
  );
};
