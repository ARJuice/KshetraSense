import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import {
  FieldState,
  FieldAction,
  createInitialState,
  fieldReducer,
} from './fieldState';

interface FieldStoreContextType {
  state: FieldState;
  dispatch: React.Dispatch<FieldAction>;
  canUndo: boolean;
  canRedo: boolean;
  revealZoningSample: () => void;
}

const FieldStoreContext = createContext<FieldStoreContextType | null>(null);

export const FieldStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(fieldReducer, undefined, createInitialState);

  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  // Reveal zoning sample with brief, calm disclosure transition
  const revealZoningSample = useCallback(() => {
    dispatch({ type: 'START_REVEAL_SAMPLE' });
    const timer = setTimeout(() => {
      dispatch({ type: 'FINISH_REVEAL_SAMPLE' });
    }, 400); // 400ms calm transition per UX spec (not fake algorithm progress)
    return () => clearTimeout(timer);
  }, []);

  // Global keyboard shortcuts (Ctrl+Z, Ctrl+Y, Esc, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/select
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) dispatch({ type: 'UNDO' });
      }

      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        if (canRedo) dispatch({ type: 'REDO' });
      }

      // Esc: Cancel in-progress brush
      if (e.key === 'Escape') {
        dispatch({ type: 'BRUSH_CANCEL' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  return (
    <FieldStoreContext.Provider
      value={{
        state,
        dispatch,
        canUndo,
        canRedo,
        revealZoningSample,
      }}
    >
      {children}
    </FieldStoreContext.Provider>
  );
};

export function useFieldStore(): FieldStoreContextType {
  const context = useContext(FieldStoreContext);
  if (!context) {
    throw new Error('useFieldStore must be used within a FieldStoreProvider');
  }
  return context;
}
