import React from 'react';
import { useFieldStore } from '../../state/useFieldStore';
import {
  SoilFeatureKey,
  BrushDirection,
  BrushStrength,
  BrushFootprint,
} from './types';
import { SOIL_FEATURES } from '../../data/fixtures/scenarioFixtures';
import { SpotlightCard } from '../../components/ui/SpotlightCard';

export const FieldControls: React.FC = () => {
  const { state, dispatch, canUndo, canRedo, revealZoningSample } = useFieldStore();
  const {
    activeFeature,
    mapMode,
    interactionMode,
    brushConfig,
    zoningMethod,
    zoningK,
    zoningSample,
    isRevealingSample,
    inputsChangedSinceSample,
  } = state;

  const featuresList = Object.values(SOIL_FEATURES);

  return (
    <div className="space-y-4">
      {/* ── SECTION 1: MAP VIEW & SOIL FEATURE SELECTION ── */}
      <SpotlightCard
        spotlightColor="rgba(56, 107, 90, 0.06)"
        className="bg-parchment-50 border border-line-border rounded-xl p-3.5 shadow-instrument"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-subtle font-semibold">
            1. Field Display Layer
          </span>
          <span className="text-[11px] text-verdigris font-mono">
            {mapMode === 'soil' ? SOIL_FEATURES[activeFeature].label : mapMode.toUpperCase()}
          </span>
        </div>

        {/* Map Mode Buttons */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-parchment-200/80 rounded-lg border border-line-subtle mb-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MAP_MODE', mode: 'soil' })}
            className={`py-1.5 px-2 text-xs font-medium rounded transition-all ${
              mapMode === 'soil'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Soil Attribute
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MAP_MODE', mode: 'zoning' })}
            disabled={!zoningSample}
            className={`py-1.5 px-2 text-xs font-medium rounded transition-all ${
              mapMode === 'zoning'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : !zoningSample
                ? 'text-ink-subtle/50 cursor-not-allowed'
                : 'text-ink-muted hover:text-ink'
            }`}
            title={!zoningSample ? 'Load zoning sample first' : 'View zones'}
          >
            Zone Map
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_MAP_MODE', mode: 'membership' })}
            disabled={!zoningSample || zoningSample.method !== 'fcm'}
            className={`py-1.5 px-2 text-xs font-medium rounded transition-all ${
              mapMode === 'membership'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : !zoningSample || zoningSample.method !== 'fcm'
                ? 'text-ink-subtle/50 cursor-not-allowed'
                : 'text-ink-muted hover:text-ink'
            }`}
            title="Available when FCM sample is loaded"
          >
            FCM Membership
          </button>
        </div>

        {/* Feature Selector Dropdown / Pills */}
        <div>
          <label htmlFor="soil-feature-select" className="block text-[11px] font-medium text-ink-muted mb-1">
            Active Soil Measurement
          </label>
          <select
            id="soil-feature-select"
            value={activeFeature}
            onChange={(e) =>
              dispatch({
                type: 'SET_ACTIVE_FEATURE',
                feature: e.target.value as SoilFeatureKey,
              })
            }
            className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-line-border bg-parchment-100 text-ink focus:border-sage-600 focus:bg-parchment-50 font-medium"
          >
            {featuresList.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} ({f.unit || 'unitless'}) — {f.min} to {f.max}
              </option>
            ))}
          </select>
        </div>
      </SpotlightCard>

      {/* ── SECTION 2: EDITING TOOLS & PRESETS (NO SLIDERS) ── */}
      <SpotlightCard
        spotlightColor="rgba(185, 94, 60, 0.05)"
        className="bg-parchment-50 border border-line-border rounded-xl p-3.5 shadow-instrument"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-subtle font-semibold">
            2. Field Editing
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={!canUndo}
              title="Undo last edit (Ctrl+Z)"
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-line-border bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={!canRedo}
              title="Redo edit (Ctrl+Y)"
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-line-border bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ↪ Redo
            </button>
          </div>
        </div>

        {/* Tool Mode Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-parchment-200/80 rounded-lg border border-line-subtle mb-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INTERACTION_MODE', mode: 'inspect' })}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              interactionMode === 'inspect'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Inspect Mode
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INTERACTION_MODE', mode: 'brush' })}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              interactionMode === 'brush'
                ? 'bg-clay-subtle text-clay-dark border border-clay/30 shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Manual Brush
          </button>
        </div>

        {/* Brush Parameters (Visible when in Brush mode) */}
        {interactionMode === 'brush' && (
          <div className="p-2.5 rounded-lg bg-clay-subtle/50 border border-clay/20 mb-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] text-clay-dark font-medium">
              <span>Painting {SOIL_FEATURES[brushConfig.feature].label}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'BRUSH_CANCEL' })}
                className="text-[10px] text-ink-muted underline hover:text-clay"
              >
                Cancel (Esc)
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Direction */}
              <div>
                <span className="block text-[10px] text-ink-subtle mb-0.5">Delta</span>
                <select
                  value={brushConfig.direction}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_BRUSH_CONFIG',
                      config: { direction: e.target.value as BrushDirection },
                    })
                  }
                  className="w-full text-xs p-1 rounded border border-line-border bg-parchment-50"
                >
                  <option value="raise">▲ Raise</option>
                  <option value="lower">▼ Lower</option>
                </select>
              </div>

              {/* Strength */}
              <div>
                <span className="block text-[10px] text-ink-subtle mb-0.5">Strength</span>
                <select
                  value={brushConfig.strength}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_BRUSH_CONFIG',
                      config: { strength: e.target.value as BrushStrength },
                    })
                  }
                  className="w-full text-xs p-1 rounded border border-line-border bg-parchment-50"
                >
                  <option value="light">Light (2%)</option>
                  <option value="medium">Medium (5%)</option>
                  <option value="strong">Strong (10%)</option>
                </select>
              </div>

              {/* Footprint */}
              <div>
                <span className="block text-[10px] text-ink-subtle mb-0.5">Radius</span>
                <select
                  value={brushConfig.footprint}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_BRUSH_CONFIG',
                      config: { footprint: parseInt(e.target.value) as BrushFootprint },
                    })
                  }
                  className="w-full text-xs p-1 rounded border border-line-border bg-parchment-50"
                >
                  <option value={1}>1 cell</option>
                  <option value={3}>3 cells</option>
                  <option value={5}>5 cells</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-ink-subtle italic">
              Click &amp; drag on field to paint. Clamped to feature bounds.
            </p>
          </div>
        )}

        {/* Quick Deterministic Presets */}
        <div>
          <span className="block text-[11px] font-medium text-ink-muted mb-1.5">
            Quick Deterministic Presets
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => dispatch({ type: 'APPLY_PRESET', presetId: 'lowN' })}
              className="text-left py-1.5 px-2.5 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-semibold text-ink text-xs group-hover:text-clay">
                  Low Nitrogen Patch
                </div>
                <div className="text-[10px] text-ink-subtle font-mono">
                  Rows 4–8, Cols 3–7 (N −18 mg/kg)
                </div>
              </div>
              <span className="text-xs text-ink-subtle font-mono">Apply ↵</span>
            </button>

            <button
              type="button"
              onClick={() => dispatch({ type: 'APPLY_PRESET', presetId: 'highEC' })}
              className="text-left py-1.5 px-2.5 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-semibold text-ink text-xs group-hover:text-clay">
                  High Salinity / EC Pocket
                </div>
                <div className="text-[10px] text-ink-subtle font-mono">
                  Rows 7–11, Cols 7–10 (EC +1.20 dS/m)
                </div>
              </div>
              <span className="text-xs text-ink-subtle font-mono">Apply ↵</span>
            </button>

            <button
              type="button"
              onClick={() => dispatch({ type: 'APPLY_PRESET', presetId: 'acidicWash' })}
              className="text-left py-1.5 px-2.5 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 transition-colors flex items-center justify-between group"
            >
              <div>
                <div className="font-semibold text-ink text-xs group-hover:text-clay">
                  Acidic Wash
                </div>
                <div className="text-[10px] text-ink-subtle font-mono">
                  Row 12, Cols 3–6 (pH −0.8)
                </div>
              </div>
              <span className="text-xs text-ink-subtle font-mono">Apply ↵</span>
            </button>
          </div>
        </div>
      </SpotlightCard>

      {/* ── SECTION 3: ZONING REVEAL ── */}
      <SpotlightCard
        spotlightColor="rgba(201, 138, 44, 0.06)"
        className="bg-parchment-50 border border-line-border rounded-xl p-3.5 shadow-instrument"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-subtle font-semibold">
            3. Crop-Neutral Zoning
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amberGold-subtle border border-amberGold/30 text-amberGold font-medium">
            FIXTURE DEMO
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label htmlFor="zoning-method-select" className="block text-[10px] text-ink-subtle mb-0.5">Method</label>
            <select
              id="zoning-method-select"
              value={zoningMethod}
              onChange={(e) =>
                dispatch({
                  type: 'SET_ZONING_CONFIG',
                  method: e.target.value as 'kmeans' | 'fcm',
                })
              }
              className="w-full text-xs p-1.5 rounded-lg border border-line-border bg-parchment-100 text-ink font-medium"
            >
              <option value="kmeans">K-means</option>
              <option value="fcm">Fuzzy C-means (FCM)</option>
            </select>
          </div>

          <div>
            <label htmlFor="zoning-k-select" className="block text-[10px] text-ink-subtle mb-0.5">Clusters (k)</label>
            <select
              id="zoning-k-select"
              value={zoningK}
              onChange={(e) =>
                dispatch({
                  type: 'SET_ZONING_CONFIG',
                  k: parseInt(e.target.value) as 3 | 4,
                })
              }
              className="w-full text-xs p-1.5 rounded-lg border border-line-border bg-parchment-100 text-ink font-medium"
            >
              <option value={3}>k = 3 zones</option>
              <option value={4}>k = 4 zones</option>
            </select>
          </div>
        </div>

        {/* Action Button: Show prepared sample */}
        <button
          type="button"
          onClick={revealZoningSample}
          disabled={isRevealingSample}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 ${
            isRevealingSample
              ? 'bg-sage-200 text-sage-700 cursor-wait'
              : 'bg-sage-700 text-parchment-50 hover:bg-sage-800 active:scale-[0.99]'
          }`}
        >
          {isRevealingSample ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-sage-600 border-t-transparent animate-spin" />
              Revealing prepared sample...
            </>
          ) : zoningSample ? (
            'Reload Prepared Sample'
          ) : (
            'Show Prepared Sample'
          )}
        </button>

        {/* Notice: Inputs Changed Since Sample View */}
        {inputsChangedSinceSample && (
          <div className="mt-3 p-2.5 rounded-lg bg-amberGold-subtle border border-amberGold/40 text-xs">
            <div className="font-semibold text-amberGold flex items-center gap-1.5">
              <span>⚠</span>
              <span>INPUTS CHANGED SINCE SAMPLE VIEW</span>
            </div>
            <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
              Sample output is unchanged and was not computed from these edits. Undo back to snapshot to clear.
            </p>
          </div>
        )}

        {/* Persistent Mock Output Label */}
        {zoningSample && !inputsChangedSinceSample && (
          <div className="mt-2 text-[10px] text-center text-ink-subtle font-mono">
            MOCK OUTPUT — prepared fixture, not an algorithm result
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};
