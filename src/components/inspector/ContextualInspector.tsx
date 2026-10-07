import React from 'react';
import { useFieldStore } from '../../state/useFieldStore';
import { CellInspectorTab } from './CellInspectorTab';
import { ZoneInspectorTab } from './ZoneInspectorTab';
import { CropFitTab } from './CropFitTab';

export const ContextualInspector: React.FC = () => {
  const { state, dispatch } = useFieldStore();
  const { inspectorTab, selectedCellId, cells, zoningSample, selectedZoneIndex } = state;

  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;
  const selectedZoneSummary =
    zoningSample && selectedZoneIndex !== null
      ? zoningSample.summaries[selectedZoneIndex]
      : null;

  return (
    <aside
      className="w-80 lg:w-96 flex flex-col bg-parchment-50 border-l border-line-border h-full shadow-instrument"
      aria-label="Contextual Field and Zoning Inspector"
    >
      {/* Inspector Tab Header */}
      <div className="p-3 border-b border-line-border bg-parchment-100/70">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
            Contextual Inspector
          </span>
          {zoningSample && (
            <span className="text-[10px] font-mono text-verdigris font-semibold">
              {zoningSample.method.toUpperCase()} k={zoningSample.k}
            </span>
          )}
        </div>

        {/* 3 Tabs: Cell / Zone / Crop Fit */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-parchment-200/80 rounded-lg border border-line-subtle">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INSPECTOR_TAB', tab: 'cell' })}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              inspectorTab === 'cell'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Cell
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INSPECTOR_TAB', tab: 'zone' })}
            disabled={!zoningSample}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              inspectorTab === 'zone'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : !zoningSample
                ? 'text-ink-subtle/50 cursor-not-allowed'
                : 'text-ink-muted hover:text-ink'
            }`}
            title={!zoningSample ? 'Load zoning sample first' : 'Inspect zone statistics'}
          >
            Zone
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_INSPECTOR_TAB', tab: 'cropFit' })}
            className={`py-1.5 text-xs font-medium rounded transition-all ${
              inspectorTab === 'cropFit'
                ? 'bg-parchment-50 text-ink shadow-sm font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Crop Fit
          </button>
        </div>
      </div>

      {/* Tab Body Scrollable Container */}
      <div className="flex-1 p-4 overflow-y-auto">
        {inspectorTab === 'cell' && <CellInspectorTab cell={selectedCell} />}
        {inspectorTab === 'zone' && (
          <ZoneInspectorTab
            zoningSample={zoningSample}
            selectedZoneIndex={selectedZoneIndex}
            onSelectZone={(z) => dispatch({ type: 'SELECT_ZONE', zoneIndex: z })}
            onGoToCropFit={() => dispatch({ type: 'SET_INSPECTOR_TAB', tab: 'cropFit' })}
          />
        )}
        {inspectorTab === 'cropFit' && (
          <CropFitTab selectedZoneSummary={selectedZoneSummary} />
        )}
      </div>
    </aside>
  );
};
