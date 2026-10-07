/**
 * ============================================================================
 * KSHETRASENSE FIELD RENDERER SEAM & CONTRACT
 * ============================================================================
 * 
 * This contract establishes the strict architectural boundary between the
 * React DOM application shell and the field visualizer.
 * 
 * CORE CONTRACT PRINCIPLES (per PRD, TRD, UX-SPEC, and Decision 0001/0002):
 * 1. STATE SEPARATION: Canonical soil data, undo/redo history, scenario selection,
 *    zoning state, and inspector context live strictly in the React/DOM layer.
 *    The renderer is a pure presentation consumer and user input emitter.
 * 2. CAMERA INDEPENDENCE: Camera position/orbit/zoom is owned by the renderer
 *    viewport and must never mutate soil or scenario state.
 * 3. NO PHYSICAL CLAIMS: Visual height/relief in 3D is a bounded analytical
 *    encoding of the selected soil feature, NOT topographic elevation or soil depth.
 * 4. PERFORMANCE BUDGETS: The later React Three Fiber (R3F) renderer must use
 *    instanced meshes (shared box geometry, <= 12 triangles/cell, max 8 draw calls
 *    total on desktop). No React component or separate mesh per cell.
 * 5. TRUTHFULNESS: Labels, legends, units, mock notices, and disclosures remain
 *    in the DOM.
 */

import {
  SoilCell,
  SoilFeatureKey,
  MapMode,
  InteractionMode,
  BrushConfig,
  ZoningSampleView,
} from './types';

export interface FieldViewModel {
  /** All 216 cells in deterministic order (row 1..12, col 1..18) */
  cells: SoilCell[];
  /** Grid dimensions (standard 18 cols x 12 rows = 216 cells) */
  rows: number;
  cols: number;
  /** Currently displayed soil feature in 'soil' map mode */
  activeFeature: SoilFeatureKey;
  /** Active visualization layer */
  mapMode: MapMode;
  /** Active zoning sample (or null if no sample loaded) */
  zoningSample: ZoningSampleView | null;
  /** Selected zone index (0..k-1) to highlight, or null if whole field shown */
  selectedZoneIndex: number | null;
  /** Active cluster index for FCM membership strength view */
  selectedFCMClusterIndex: number | null;
  /** Current interaction tool */
  interactionMode: InteractionMode;
  /** Active brush configuration (feature, direction, strength, footprint) */
  brushConfig: BrushConfig;
  /** Cell IDs currently touched during an active brush stroke */
  brushPreviewCellIds: string[];
  /** Selected cell ID (e.g. "r12-c8") */
  selectedCellId: string | null;
  /** Currently hovered cell ID */
  hoveredCellId: string | null;
  /** Recent preset/undo affected cell IDs for visual feedback */
  affectedFeedbackCellIds: string[];
  /** Whether the user prefers reduced motion */
  prefersReducedMotion: boolean;
}

export interface FieldRendererCallbacks {
  /** Fired when cursor moves over a cell or leaves the field */
  onCellHover: (cellId: string | null) => void;
  /** Fired when user clicks or presses Enter/Space on a cell */
  onCellSelect: (cellId: string) => void;
  /** Fired when a brush stroke modifies a cell cluster */
  onBrushApply: (centerCellId: string) => void;
  /** Fired when a brush drag stroke completes */
  onBrushCommit: () => void;
  /** Fired when user selects a zone on the field (or deselects with null) */
  onZoneSelect?: (zoneIndex: number | null) => void;
  /** Fired when camera fit is requested (keyboard 'F' or button) */
  onCameraFitRequest?: () => void;
}

export interface FieldRendererProps {
  viewModel: FieldViewModel;
  callbacks: FieldRendererCallbacks;
  className?: string;
}

/**
 * Type alias for any component implementing the Field Renderer seam.
 * In Phase 1, FieldRendererPlaceholder implements this interface.
 * In Phase 2, the Three.js / React Three Fiber scene will implement this interface.
 */
export type FieldRendererComponent = React.FC<FieldRendererProps>;
