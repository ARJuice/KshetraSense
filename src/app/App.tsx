import { useState } from 'react';
import { Activity, BarChart3, ChevronLeft, Database, Layers, LayoutGrid, Leaf, Menu, Sprout } from 'lucide-react';
import { ZoningWorkspace } from '../features/zoning/ZoningWorkspace';
import { FieldMonitoringView } from '../features/monitoring/FieldMonitoringView';
import { LeafDiagnosisView } from '../features/leaf/LeafDiagnosisView';
import { MethodologyLimitsView } from '../features/methodology/MethodologyLimitsView';

type AppModule = 'zoning' | 'leaf' | 'monitoring' | 'methods';

const modules: Array<{ id: AppModule; label: string; detail: string; icon: typeof LayoutGrid }> = [
  { id: 'zoning', label: 'Soil Zoning', detail: 'Variable management units', icon: Layers },
  { id: 'leaf', label: 'Leaf Diagnosis', detail: 'Image-only classifier', icon: Leaf },
  { id: 'monitoring', label: 'Field Monitoring', detail: 'Observations & satellite', icon: Activity },
  { id: 'methods', label: 'Methodology & Limits', detail: 'Pipelines & constraints', icon: BarChart3 },
];

export default function App() {
  const [activeModule, setActiveModule] = useState<AppModule>('zoning');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const active = modules.find((module) => module.id === activeModule)!;

  return (
    <div className={`app-shell ${sidebarOpen ? '' : 'app-shell--collapsed'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Sprout size={18} />
          </div>
          {sidebarOpen && (
            <div>
              <strong>KshetraSense</strong>
              <span>Precision Ag ERP</span>
            </div>
          )}
        </div>

        <nav className="sidebar__nav" aria-label="Primary navigation">
          <p className="sidebar__label">Workspace</p>
          {modules.map((module) => {
            const Icon = module.icon;
            const isActive = activeModule === module.id;
            return (
              <button
                key={module.id}
                className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                onClick={() => setActiveModule(module.id)}
                title={!sidebarOpen ? module.label : undefined}
              >
                <Icon size={18} />
                {sidebarOpen && (
                  <span>
                    <strong>{module.label}</strong>
                    <small>{module.detail}</small>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar__bottom">
          <div className="sidebar__meta">
            <Database size={14} className="text-slate-400" />
            {sidebarOpen && <span>Engine: 127.0.0.1:8000</span>}
          </div>
          <button
            className="collapse-button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="topbar__breadcrumbs">
            <span className="topbar__app">KshetraSense</span>
            <span className="topbar__divider">/</span>
            <span className="topbar__section">{active.label}</span>
          </div>
          <div className="topbar__env">
            <span className="topbar__tag">Local Workspace</span>
          </div>
        </div>

        {activeModule === 'zoning' && <ZoningWorkspace />}
        {activeModule === 'leaf' && <LeafDiagnosisView />}
        {activeModule === 'monitoring' && <FieldMonitoringView />}
        {activeModule === 'methods' && <MethodologyLimitsView />}
      </main>
    </div>
  );
}
