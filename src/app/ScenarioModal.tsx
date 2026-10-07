import React from 'react';
import { useFieldStore } from '../state/useFieldStore';
import { SCENARIOS } from '../data/fixtures/scenarioFixtures';
import { ScenarioId } from '../features/field/types';
import { SpotlightCard } from '../components/ui/SpotlightCard';

export const ScenarioModal: React.FC = () => {
  const { state, dispatch } = useFieldStore();
  const { isScenarioModalOpen, activeScenarioId } = state;

  if (!isScenarioModalOpen) return null;

  const scenarioKeys: ScenarioId[] = ['baseline', 'lowN', 'highEC', 'acidicWash'];

  const handleSelect = (id: ScenarioId) => {
    dispatch({ type: 'SET_SCENARIO', scenarioId: id });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-parchment-50 border border-line-border p-6 shadow-instrument-raised">
        <div className="flex items-center justify-between pb-3 border-b border-line-border mb-4">
          <div>
            <h3 id="scenario-modal-title" className="font-editorial text-lg font-bold text-ink">
              Choose Synthetic Scenario
            </h3>
            <p className="text-xs text-ink-subtle">
              Deterministic seed #42 · Atomic reload clears local edits &amp; sample state
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCENARIO_MODAL', isOpen: false })}
            className="text-ink-subtle hover:text-ink text-sm p-1 rounded-md"
            aria-label="Close scenario modal"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 mb-5">
          {scenarioKeys.map((key) => {
            const sc = SCENARIOS[key];
            const isSelected = activeScenarioId === key;
            return (
              <SpotlightCard
                key={key}
                spotlightColor="rgba(56, 107, 90, 0.12)"
                className="rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(key)}
                  className={`w-full p-3 border text-left transition-all flex flex-col gap-1 ${
                    isSelected
                      ? 'border-sage-600 bg-sage-50 ring-1 ring-sage-600'
                      : 'border-line-border bg-parchment-100 hover:bg-parchment-200'
                  }`}
                >
                <div className="flex items-center justify-between">
                  <span className="font-editorial font-bold text-sm text-ink">{sc.name}</span>
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-parchment-200 text-ink-muted">
                    Focus: {sc.focusFeature.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{sc.description}</p>
                <div className="text-[11px] font-mono text-ink-subtle pt-1 border-t border-line-subtle/80">
                  {sc.patchDescription}
                </div>
              </button>
            </SpotlightCard>
            );
          })}
        </div>

        <div className="p-3 rounded-lg bg-parchment-200/60 border border-line-subtle text-xs text-ink-subtle leading-relaxed mb-4">
          <span className="font-semibold text-ink-muted block mb-0.5">Truthfulness Note</span>
          "Baseline" denotes the initial fixture state, not an agronomically optimal soil condition. All displayed values are fixture data with explicit units—not live sensor telemetry or agronomic recommendations.
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCENARIO_MODAL', isOpen: false })}
            className="px-4 py-2 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 text-ink text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
