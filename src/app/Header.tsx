import React from 'react';
import { useFieldStore } from '../state/useFieldStore';
import { SCENARIOS } from '../data/fixtures/scenarioFixtures';
import { DecryptedText } from '../components/ui/DecryptedText';

export const Header: React.FC = () => {
  const { state, dispatch, canUndo, canRedo } = useFieldStore();
  const currentScenario = SCENARIOS[state.activeScenarioId];

  return (
    <header className="h-16 px-5 border-b border-line-border bg-parchment-50 flex items-center justify-between shadow-instrument z-20">
      {/* Brand & Editorial Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-evergreen-900 border border-evergreen-850 flex items-center justify-center text-sage-300 font-editorial font-bold text-lg shadow-sm">
            K
          </div>
          <div>
            <div className="font-editorial font-bold text-base tracking-tight text-ink flex items-center gap-2">
              <span>KshetraSense</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-parchment-200 text-ink-subtle border border-line-border">
                Soil Atlas
              </span>
            </div>
            <p className="text-[11px] text-ink-subtle hidden sm:block">
              Applied-ML Demonstrator · Apple, Tomato, Potato
            </p>
          </div>
        </div>

        <div className="h-6 w-px bg-line-border hidden md:block" />

        {/* Persistent Scenario Badge with DecryptedText */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-parchment-200/70 border border-line-border">
            <span className="w-2 h-2 rounded-full bg-verdigris" />
            <span className="text-xs font-mono font-medium text-ink">
              SYNTHETIC SCENARIO:{' '}
              <span className="font-semibold text-verdigris">
                <DecryptedText
                  text={currentScenario.name}
                  speed={35}
                  maxIterations={7}
                  animateOn="change"
                />
              </span>{' '}
              (Seed #{currentScenario.seed})
            </span>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_SCENARIO_MODAL', isOpen: true })}
            className="text-xs py-1 px-2.5 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 text-ink font-medium transition-colors"
          >
            Switch Scenario ▾
          </button>
        </div>
      </div>

      {/* Undo / Redo / Reset Demo controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          title="Undo last action (Ctrl+Z)"
          className="text-xs font-mono py-1.5 px-3 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed text-ink transition-colors"
        >
          ↩ Undo
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          title="Redo action (Ctrl+Y)"
          className="text-xs font-mono py-1.5 px-3 rounded-lg border border-line-border bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 disabled:cursor-not-allowed text-ink transition-colors"
        >
          ↪ Redo
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESET_DEMO' })}
          className="text-xs font-mono py-1.5 px-3 rounded-lg border border-clay/30 bg-clay-subtle/60 hover:bg-clay-subtle text-clay-dark transition-colors font-medium"
        >
          ⟳ Reset Demo
        </button>
      </div>
    </header>
  );
};
