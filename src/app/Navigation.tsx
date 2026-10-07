import React from 'react';
import { useFieldStore } from '../state/useFieldStore';
import { AppView } from '../state/fieldState';

export const Navigation: React.FC = () => {
  const { state, dispatch } = useFieldStore();
  const { currentView } = state;

  const navItems: Array<{ id: AppView; label: string; badge?: string }> = [
    { id: 'fieldlab', label: 'Field Lab & Zoning' },
    { id: 'leaf', label: 'Leaf Diagnosis (17-Class)' },
    { id: 'evidence', label: 'Evidence & Metrics' },
  ];

  return (
    <nav className="h-11 px-5 border-b border-line-border bg-parchment-100 flex items-center justify-between text-xs z-10">
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_VIEW', view: item.id })}
              className={`py-1.5 px-3 rounded-lg font-medium transition-all ${
                isActive
                  ? 'bg-parchment-50 text-ink shadow-sm border border-line-border font-semibold text-sage-800'
                  : 'text-ink-muted hover:text-ink hover:bg-parchment-200/60'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        {/* Disabled post-MVP item per UX-SPEC */}
        <span
          className="py-1.5 px-3 text-ink-subtle/50 cursor-not-allowed select-none italic"
          title="Post-MVP feature; weather-driven soil water balance requires verified parameters"
        >
          Water Balance (post-MVP)
        </span>
      </div>

      <div className="text-[11px] font-mono text-ink-subtle hidden md:flex items-center gap-2">
        <span>Desktop Review Baseline: 1280×800</span>
        <span className="text-line-border">|</span>
        <span className="text-verdigris">No remote dependencies</span>
      </div>
    </nav>
  );
};
