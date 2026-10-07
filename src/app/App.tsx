import React from 'react';
import { FieldStoreProvider, useFieldStore } from '../state/useFieldStore';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { ScenarioModal } from './ScenarioModal';
import { FieldLabView } from '../features/field/FieldLabView';
import { LeafDiagnosisView } from '../features/leaf/LeafDiagnosisView';
import { EvidenceView } from '../features/evidence/EvidenceView';

const AppContent: React.FC = () => {
  const { state } = useFieldStore();
  const { currentView } = state;

  return (
    <div className="min-h-screen flex flex-col bg-parchment-100 text-ink antialiased">
      <Header />
      <Navigation />

      {/* Primary Workspaces */}
      {currentView === 'fieldlab' && <FieldLabView />}
      {currentView === 'leaf' && <LeafDiagnosisView />}
      {currentView === 'evidence' && <EvidenceView />}

      {/* Scenario Chooser Modal */}
      <ScenarioModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <FieldStoreProvider>
      <AppContent />
    </FieldStoreProvider>
  );
};

export default App;
